import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      campo,
      colaborador_nome,
      colaborador_cargo,
      colaborador_departamento,
      periodo,
      gatilho,
      titulo,
      descricao,
      meta_titulo,
      contexto_extra,
    } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurado");

    const contexto = `
${colaborador_nome ? `Colaborador: ${colaborador_nome}` : ""}
${colaborador_cargo ? `Cargo: ${colaborador_cargo}` : ""}
${colaborador_departamento ? `Departamento: ${colaborador_departamento}` : ""}
${periodo ? `Período do PDI: ${periodo}` : ""}
${gatilho ? `Gatilho: ${gatilho}` : ""}
${titulo ? `Título do PDI: ${titulo}` : ""}
${descricao ? `Descrição do PDI: ${descricao}` : ""}
${meta_titulo ? `Meta atual: ${meta_titulo}` : ""}
${contexto_extra ? `Contexto adicional: ${contexto_extra}` : ""}
`.trim();

    const instrucoes: Record<string, string> = {
      titulo: `Sugira um TÍTULO curto e objetivo (máx. 80 caracteres) para um PDI. Inclua o período e nome do colaborador. Retorne APENAS o título.`,
      descricao: `Escreva uma DESCRIÇÃO clara e profissional (2-4 frases, máx. 400 caracteres) para um PDI. Foque em desenvolvimento de competências e resultados esperados. Retorne APENAS o texto.`,
      observacoes: `Escreva OBSERVAÇÕES gerais (2-3 frases) para o PDI, com pontos de atenção, oportunidades ou cuidados que o líder deve ter. Retorne APENAS o texto.`,
      avancos: `Escreva um relato de AVANÇOS de check-in (2-3 frases) com base no contexto. Use linguagem objetiva e profissional. Retorne APENAS o texto.`,
      bloqueios: `Liste BLOQUEIOS comuns que podem travar essa meta (2-3 frases). Seja realista e propositivo. Retorne APENAS o texto.`,
      proximo_passo: `Sugira o PRÓXIMO PASSO concreto e acionável (1-2 frases) para destravar essa meta. Retorne APENAS o texto.`,
      ponto_forte: `Escreva um PONTO FORTE estruturado (2 frases) para feedback de desenvolvimento. Use linguagem positiva e específica. Retorne APENAS o texto.`,
      ponto_melhorar: `Escreva um PONTO A MELHORAR (2 frases) construtivo para feedback. Linguagem respeitosa e propositiva. Retorne APENAS o texto.`,
      recomendacao: `Escreva uma RECOMENDAÇÃO acionável (1-2 frases) para o desenvolvimento da pessoa. Retorne APENAS o texto.`,
      comentario: `Escreva um COMENTÁRIO geral (2-3 frases) consolidando o feedback de forma equilibrada. Retorne APENAS o texto.`,
    };

    const instrucao = instrucoes[campo];
    if (!instrucao) throw new Error("Campo inválido");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um especialista em RH, desenvolvimento de pessoas e PDI. Suas sugestões são objetivas, profissionais, em português do Brasil." },
          { role: "user", content: `${instrucao}\n\nContexto:\n${contexto}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos no workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erro no gateway de IA");
    }

    const data = await response.json();
    const sugestao = (data.choices?.[0]?.message?.content || "").trim().replace(/^["']|["']$/g, "");

    return new Response(JSON.stringify({ sugestao }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-pdi-sugestao error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
