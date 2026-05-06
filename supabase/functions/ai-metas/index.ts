import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const { acao, meta, nivelDestino, contexto, pergunta } = await req.json();

    let systemPrompt = `Você é um assistente especializado em gestão de metas corporativas, OKRs, BSC e planejamento estratégico.
Responda sempre em português brasileiro. Seja objetivo e prático.
Quando sugerir metas, use o formato SMART (Específica, Mensurável, Atingível, Relevante, Temporal).`;

    let userPrompt = "";

    switch (acao) {
      case "sugerir":
        userPrompt = `Sugira 3 metas ${nivelDestino || "estratégicas"} baseadas no contexto:
${contexto || "Empresa de segurança do trabalho e saúde ocupacional"}
${meta?.objetivo_estrategico ? `Objetivo estratégico: ${meta.objetivo_estrategico}` : ""}

Responda em JSON com a estrutura:
{
  "sugestoes": [
    {
      "titulo": "...",
      "descricao": "...",
      "indicador_nome": "...",
      "indicador_tipo": "quantitativo|qualitativo|percentual|financeiro|marco",
      "indicador_unidade": "...",
      "valor_alvo": number,
      "periodo": "mensal|trimestral|semestral|anual",
      "justificativa": "..."
    }
  ]
}`;
        break;

      case "desdobrar":
        userPrompt = `Desdobre a meta abaixo em 3 submetas no nível "${nivelDestino}":

Meta origem: ${meta?.titulo}
Descrição: ${meta?.descricao || "N/A"}
Nível atual: ${meta?.nivel}
Objetivo estratégico: ${meta?.objetivo_estrategico || "N/A"}

Responda em JSON:
{
  "desdobramentos": [
    {
      "titulo": "...",
      "descricao": "...",
      "indicador_nome": "...",
      "indicador_unidade": "...",
      "valor_alvo": number,
      "peso": number,
      "responsavel_sugerido": "...",
      "justificativa": "..."
    }
  ]
}`;
        break;

      case "analisar_risco":
        userPrompt = `Analise o risco de não atingimento desta meta:

Título: ${meta?.titulo}
Progresso: ${meta?.progresso}%
Valor atual: ${meta?.valor_atual} / Alvo: ${meta?.valor_alvo}
Período: ${meta?.data_inicio} a ${meta?.data_fim}
Status: ${meta?.status}

Responda em JSON:
{
  "nivel_risco": "baixo|medio|alto|critico",
  "probabilidade_atingimento": number (0-100),
  "fatores_risco": ["..."],
  "recomendacoes": ["..."],
  "resumo": "..."
}`;
        break;

      case "validar_consistencia":
        userPrompt = `Analise a consistência entre estas metas e identifique conflitos, duplicidades ou desalinhamentos:

${JSON.stringify(meta, null, 2)}

Responda em JSON:
{
  "alertas": [
    {
      "tipo": "duplicidade|conflito|desalinhamento|sobreposicao",
      "descricao": "...",
      "metas_envolvidas": ["..."],
      "sugestao": "..."
    }
  ],
  "resumo": "..."
}`;
        break;

      case "resumo_executivo":
        userPrompt = `Gere um resumo executivo sobre o estado das metas:

${JSON.stringify(meta, null, 2)}

Responda em JSON:
{
  "resumo": "...",
  "destaques_positivos": ["..."],
  "pontos_atencao": ["..."],
  "recomendacoes_prioritarias": ["..."]
}`;
        break;

      case "sugerir_titulo":
        userPrompt = `Sugira um TÍTULO claro, objetivo e no formato SMART para uma meta corporativa.
Contexto/rascunho fornecido pelo usuário:
Título atual: ${meta?.titulo || "(vazio)"}
Descrição atual: ${meta?.descricao || "(vazio)"}
Nível: ${meta?.nivel || "N/A"}

Responda em JSON:
{
  "titulo": "título sugerido (máx 120 caracteres, ação + métrica + prazo quando possível)",
  "justificativa": "1 frase explicando o porquê"
}`;
        break;

      case "sugerir_descricao":
        userPrompt = `Com base no título da meta, sugira uma DESCRIÇÃO clara, objetiva e contextualizada (2 a 4 frases).
Título: ${meta?.titulo || "(vazio)"}
Descrição atual (se houver, melhorar): ${meta?.descricao || "(vazio)"}
Nível: ${meta?.nivel || "N/A"}

A descrição deve explicar: o que será feito, por que é importante e como será medido (em linhas gerais).

Responda em JSON:
{
  "descricao": "descrição sugerida",
  "justificativa": "1 frase curta"
}`;
        break;

      case "sugerir_indicador":
        userPrompt = `Com base no título e descrição da meta abaixo, sugira o melhor indicador de medição (KPI):

Título: ${meta?.titulo || "N/A"}
Descrição: ${meta?.descricao || "N/A"}

Responda em JSON:
{
  "indicador_nome": "nome curto e claro do KPI",
  "indicador_tipo": "quantitativo|qualitativo|financeiro",
  "indicador_unidade": "uma de: %, un, qtd, horas, dias, R$, US$, €, nivel, status, conceito",
  "valor_alvo": number,
  "justificativa": "por que esse indicador mede bem essa meta (1 frase)"
}`;
        break;

      case "chat":
        userPrompt = pergunta || "Olá, como posso ajudá-lo com metas?";
        break;

      default:
        throw new Error(`Ação desconhecida: ${acao}`);
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.7,
        response_format: acao !== "chat" ? { type: "json_object" } : undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI error:", errorText);
      throw new Error(`Erro na API OpenAI: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (acao === "chat") {
      return new Response(JSON.stringify({ resposta: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(content);
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ai-metas:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
