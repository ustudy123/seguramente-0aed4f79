import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, documento_texto, documento_tipo, documento_nome } = await req.json();

    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    // ── Ação: classificar documento ──────────────────────────────────────────
    if (action === "classificar") {
      const amostra = (documento_texto || "").substring(0, 3000);
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `Você é um especialista em documentos de SST (Saúde e Segurança do Trabalho) brasileiro.
Analise o trecho de texto fornecido e classifique o tipo de documento.

Tipos possíveis:
- PGR (Programa de Gerenciamento de Riscos)
- PCMSO (Programa de Controle Médico de Saúde Ocupacional)
- LTCAT (Laudo Técnico das Condições Ambientais de Trabalho)
- PPP (Perfil Profissiográfico Previdenciário)
- APR (Análise Preliminar de Risco)
- NR12 (Análise de Risco NR12)
- AEP (Análise Ergonômica Preliminar)
- AET (Análise Ergonômica do Trabalho)
- LAUDO_INSALUBRIDADE (Laudo de Insalubridade)
- LAUDO_PERICULOSIDADE (Laudo de Periculosidade)
- AVALIACAO_AMBIENTAL (Avaliação Ambiental / Higiene Ocupacional)
- RELATORIO_MEDICOES (Relatório de Medições)
- RELATORIO_AUDITORIA (Relatório de Auditoria SST)
- PARECER_TECNICO (Parecer Técnico)
- OUTROS

Responda SOMENTE em JSON com o seguinte formato:
{
  "tipo": "PGR",
  "confianca": 92,
  "justificativa": "Texto contém 'Programa de Gerenciamento de Riscos' e seções típicas de inventário de riscos"
}`,
            },
            { role: "user", content: `Classifique este documento SST:\n\n${amostra}` },
          ],
        }),
      });
      const data = await resp.json();
      const content = JSON.parse(data.choices[0].message.content);
      return new Response(JSON.stringify(content), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Ação: extrair dados estruturados ─────────────────────────────────────
    if (action === "extrair") {
      // Para PGR usamos mais texto pois o inventário tende a ser extenso
      const maxChars = (documento_tipo || "").includes("PGR") ? 28000 : 18000;
      const texto = (documento_texto || "").substring(0, maxChars);
      const tipo = documento_tipo || "DOCUMENTO_SST";

      // Prompt especializado por tipo de documento
      const systemPrompt = buildExtractionPrompt(tipo);

      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Extraia TODOS os dados deste documento SST do tipo ${tipo}. Seja exaustivo no inventário de riscos — extraia CADA LINHA da tabela de riscos encontrada:\n\n${texto}`,
            },
          ],
        }),
      });

      const data = await resp.json();
      const content = JSON.parse(data.choices[0].message.content);

      // Calcular score de qualidade automaticamente
      const calcScore = (obj: any): number => {
        if (!obj) return 0;
        const vals = Object.values(obj);
        const filled = vals.filter((v) => v !== null && v !== "" && v !== undefined);
        return Math.round((filled.length / vals.length) * 100);
      };

      if (content.score_qualidade) {
        const dg = content.dados_gerais || {};
        const dgScore = calcScore(Object.fromEntries(Object.entries(dg).map(([k, v]: any) => [k, v?.valor])));
        const invScore = (content.inventario_riscos?.length || 0) > 0 ? Math.min(100, (content.inventario_riscos.length / 5) * 100) : 0;
        const paScore = (content.plano_acao?.length || 0) > 0 ? Math.min(100, (content.plano_acao.length / 3) * 100) : 0;
        const respScore = (content.responsaveis_tecnicos?.length || 0) > 0 ? 100 : 0;
        const geral = Math.round((dgScore + invScore + paScore + respScore) / 4);
        content.score_qualidade = {
          geral,
          dados_gerais: dgScore,
          inventario: Math.round(invScore),
          plano_acao: Math.round(paScore),
          responsaveis: respScore,
        };
      }

      return new Response(JSON.stringify(content), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("ai-sst-importacao error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
