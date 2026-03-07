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
      const texto = (documento_texto || "").substring(0, 15000);
      const tipo = documento_tipo || "DOCUMENTO_SST";

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
            {
              role: "system",
              content: `Você é um especialista em extração de dados de documentos SST brasileiros.
Analise o documento do tipo ${tipo} e extraia as informações de forma estruturada e conservadora.

REGRAS FUNDAMENTAIS:
1. NUNCA invente dados. Se não encontrar, use null.
2. NÃO faça suposições. Apenas extraia o que está escrito.
3. Classifique cada campo com score de confiança: "alta", "media" ou "baixa".
4. Para ações, identifique apenas frases com verbos no infinitivo que descrevam uma tarefa concreta.
5. Seja preciso com CNPJ, datas e registros profissionais.

Retorne JSON com esta estrutura EXATA:
{
  "dados_gerais": {
    "empresa": {"valor": "...", "confianca": "alta|media|baixa"},
    "cnpj": {"valor": "...", "confianca": "alta|media|baixa"},
    "cnae": {"valor": "...", "confianca": "alta|media|baixa"},
    "grau_risco": {"valor": "...", "confianca": "alta|media|baixa"},
    "data_emissao": {"valor": "...", "confianca": "alta|media|baixa"},
    "data_vigencia": {"valor": "...", "confianca": "alta|media|baixa"},
    "versao": {"valor": "...", "confianca": "alta|media|baixa"}
  },
  "estrutura_organizacional": {
    "unidades": [{"nome": "...", "endereco": "..."}],
    "setores": ["..."],
    "departamentos": ["..."]
  },
  "funcoes_atividades": [
    {"cargo": "...", "atividades": ["..."], "setor": "..."}
  ],
  "inventario_riscos": [
    {
      "setor": "...",
      "funcao": "...",
      "risco": "...",
      "tipo_risco": "fisico|quimico|biologico|ergonomico|acidente|psicossocial",
      "fonte_geradora": "...",
      "intensidade": "...",
      "tempo_exposicao": "...",
      "metodologia": "...",
      "danos": "...",
      "controles_existentes": ["..."],
      "confianca": "alta|media|baixa"
    }
  ],
  "plano_acao": [
    {
      "recomendacao": "...",
      "prioridade": "alta|media|baixa",
      "prazo": "...",
      "responsavel": "...",
      "setor": "...",
      "confianca": "alta|media|baixa"
    }
  ],
  "responsaveis_tecnicos": [
    {
      "nome": "...",
      "formacao": "...",
      "registro": "...",
      "conselho": "...",
      "funcao_no_doc": "..."
    }
  ],
  "pendencias": [
    {"campo": "...", "motivo": "...", "severidade": "critica|media|baixa"}
  ],
  "score_qualidade": {
    "geral": 0,
    "dados_gerais": 0,
    "inventario": 0,
    "plano_acao": 0,
    "responsaveis": 0
  }
}`,
            },
            {
              role: "user",
              content: `Extraia os dados deste documento SST (${tipo}):\n\n${texto}`,
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
