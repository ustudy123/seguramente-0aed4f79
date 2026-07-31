import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PassoResultado {
  titulo: string;
  status: "ok" | "falha" | "atencao" | "manual";
  detalhes: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { agente_id, origem = "manual" } = await req.json();
    if (!agente_id) throw new Error("agente_id é obrigatório");

    // ═══ Autorização: superadmin (execução manual) ou dispatcher agendado ═══
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    let autorizado = origem === "agendada" && token === ANON_KEY;
    if (!autorizado && token && token !== ANON_KEY) {
      const { data: userData } = await admin.auth.getUser(token);
      if (userData?.user) {
        const { data: isSA } = await admin.rpc("is_superadmin", { _user_id: userData.user.id });
        autorizado = !!isSA;
      }
    }
    if (!autorizado) {
      return new Response(JSON.stringify({ error: "Acesso restrito a superadmins" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ Carrega agente + documentação de teste ═══
    const { data: agente, error: agErr } = await admin
      .from("youreyes_agentes").select("*").eq("id", agente_id).single();
    if (agErr || !agente) throw new Error("Agente não encontrado");

    const { data: documentos } = await admin
      .from("youreyes_documentos")
      .select("id, titulo, modulo, submodulo, conteudo")
      .in("id", agente.documento_ids?.length ? agente.documento_ids : ["00000000-0000-0000-0000-000000000000"]);

    // ═══ Registra início da execução ═══
    const { data: execucao, error: exErr } = await admin
      .from("youreyes_execucoes")
      .insert({ agente_id, origem, status: "executando" })
      .select().single();
    if (exErr) throw exErr;

    try {
      // ═══ 1. Varredura automatizada real (reutiliza ai-qa-scan) ═══
      let scan: any = null;
      try {
        const scanResp = await fetch(`${SUPABASE_URL}/functions/v1/ai-qa-scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({ categoria: "todos" }),
        });
        if (scanResp.ok) scan = await scanResp.json();
      } catch (e) {
        console.error("ai-qa-scan indisponível:", e);
      }

      // ═══ 2. IA cruza a documentação de teste com os resultados da varredura ═══
      if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

      const docsTexto = (documentos || [])
        .map((d) => `## Documento: ${d.titulo} (módulo: ${d.modulo}${d.submodulo ? ` / ${d.submodulo}` : ""})\n${d.conteudo}`)
        .join("\n\n---\n\n") || "(nenhum documento vinculado)";

      const findingsTexto = scan
        ? JSON.stringify((scan.findings || []).slice(0, 60), null, 1)
        : "(varredura automatizada indisponível nesta execução)";

      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          max_tokens: 2500,
          messages: [
            {
              role: "system",
              content: `Você é "${agente.nome}", um agente de QA do sistema YourEyes (plataforma SaaS de RH/SST multi-tenant).
Você recebe: (a) a documentação de teste do(s) módulo(s) sob sua responsabilidade e (b) os resultados REAIS de uma varredura automatizada do banco/sistema.

Sua tarefa: avaliar cada ponto do roteiro de teste com base nas evidências da varredura.
- Marque "ok" apenas quando a varredura traz evidência de que o ponto está saudável.
- Marque "falha" quando há finding crítico/alto relacionado ao ponto.
- Marque "atencao" quando há finding médio/baixo relacionado.
- Marque "manual" quando o ponto exige teste manual/na interface e não pode ser verificado pela varredura. NUNCA invente resultado para esses casos.

Responda SOMENTE com JSON válido no formato:
{
  "score": <0-100, saúde geral do escopo testado>,
  "resumo": "<resumo executivo em 2-4 frases, em português do Brasil>",
  "passos": [{ "titulo": "...", "status": "ok|falha|atencao|manual", "detalhes": "..." }],
  "recomendacoes": ["...", "..."]
}`,
            },
            {
              role: "user",
              content: `DOCUMENTAÇÃO DE TESTE:\n${docsTexto}\n\nRESULTADOS DA VARREDURA AUTOMATIZADA:\n${findingsTexto}`,
            },
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errBody = await aiResponse.text();
        throw new Error(`Falha na análise de IA: ${aiResponse.status} ${errBody.slice(0, 300)}`);
      }

      const aiData = await aiResponse.json();
      let relatorio: {
        score?: number; resumo?: string; passos?: PassoResultado[]; recomendacoes?: string[];
      } = {};
      try {
        relatorio = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
      } catch {
        relatorio = { resumo: aiData.choices?.[0]?.message?.content || "Sem resposta da IA" };
      }

      const passos = Array.isArray(relatorio.passos) ? relatorio.passos : [];
      const falhas = passos.filter((p) => p.status === "falha").length;
      const atencoes = passos.filter((p) => p.status === "atencao").length;
      const score = typeof relatorio.score === "number"
        ? Math.max(0, Math.min(100, Math.round(relatorio.score)))
        : null;

      const statusFinal = falhas > 0 || (score !== null && score < 50)
        ? "falha"
        : atencoes > 0 || (score !== null && score < 80)
          ? "atencao"
          : "sucesso";

      const resultado = {
        passos,
        recomendacoes: Array.isArray(relatorio.recomendacoes) ? relatorio.recomendacoes : [],
        varredura: scan
          ? {
              total_findings: scan.total_findings, criticos: scan.criticos, altos: scan.altos,
              medios: scan.medios, baixos: scan.baixos, info: scan.info,
              findings: (scan.findings || []).slice(0, 60),
            }
          : null,
        documentos_avaliados: (documentos || []).map((d) => ({ id: d.id, titulo: d.titulo, modulo: d.modulo })),
      };

      await admin.from("youreyes_execucoes").update({
        status: statusFinal,
        score,
        resumo: relatorio.resumo || null,
        resultado,
        finalizado_em: new Date().toISOString(),
      }).eq("id", execucao.id);

      await admin.from("youreyes_agentes").update({
        ultima_execucao: new Date().toISOString(),
        ultimo_status: statusFinal,
      }).eq("id", agente_id);

      return new Response(JSON.stringify({
        success: true, execucao_id: execucao.id, status: statusFinal, score, resumo: relatorio.resumo,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (runErr: any) {
      await admin.from("youreyes_execucoes").update({
        status: "falha",
        resumo: `Erro na execução: ${runErr.message || String(runErr)}`,
        finalizado_em: new Date().toISOString(),
      }).eq("id", execucao.id);

      await admin.from("youreyes_agentes").update({
        ultima_execucao: new Date().toISOString(),
        ultimo_status: "falha",
      }).eq("id", agente_id);

      throw runErr;
    }
  } catch (e: any) {
    console.error("youreyes-run-agent error:", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
