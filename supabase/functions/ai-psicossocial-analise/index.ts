import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { contexto, modo = "analise" } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const {
      campanha,
      instrumento,
      ips,
      classificacao,
      total_respostas,
      taxa_participacao,
      dimensoes_criticas = [],
      dimensoes_atencao = [],
      dimensoes_saudaveis = [],
    } = contexto;

    const classificacaoLabels: Record<string, string> = {
      saudavel: "Ambiente Saudável (80-100)",
      estavel: "Ambiente Estável (65-79)",
      atencao: "Atenção (50-64)",
      risco: "Risco Psicossocial (35-49)",
      critico: "Risco Crítico (0-34)",
    };

    if (modo === "plano_acao") {
      // Gerar sugestão 5W2H para plano de ação
      const prompt = `
Você é um especialista em saúde ocupacional e gestão de riscos psicossociais (ISO 45003, NR-01).

Diagnóstico da campanha "${campanha}" (instrumento: ${instrumento?.toUpperCase()}):
- IPS: ${ips}/100 — ${classificacaoLabels[classificacao] || classificacao}
- Dimensões críticas (IPS < 50): ${dimensoes_criticas.join(", ") || "nenhuma"}

Gere uma ação preventiva 5W2H estruturada para este diagnóstico.
Responda em JSON com os campos: titulo, descricao, porque, onde, como.
Seja objetivo e prático. Máximo 2 linhas por campo.
`;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_tokens: 500,
          temperature: 0.4,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI error: ${err}`);
      }

      const result = await response.json();
      const sugestao_acao = JSON.parse(result.choices[0].message.content);
      return new Response(JSON.stringify({ sugestao_acao }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Modo padrão: análise interpretativa
    const prompt = `
Você é um especialista em saúde organizacional e gestão de riscos psicossociais (ISO 45003, NR-01, NR-17).

Analise os resultados da campanha psicossocial "${campanha}" (instrumento: ${instrumento?.toUpperCase()}):

**IPS (Índice Psicossocial Seguramente):** ${ips}/100
**Classificação:** ${classificacaoLabels[classificacao] || classificacao}
**Participação:** ${total_respostas} respostas (${taxa_participacao?.toFixed(0)}% de participação)
**Dimensões críticas (IPS < 50):** ${dimensoes_criticas.join(", ") || "nenhuma identificada"}
**Dimensões de atenção (IPS 50-64):** ${dimensoes_atencao.join(", ") || "nenhuma"}
**Dimensões saudáveis (IPS ≥ 80):** ${dimensoes_saudaveis.join(", ") || "nenhuma ainda"}

Forneça uma análise interpretativa estruturada com:
1. **Diagnóstico geral** (2-3 frases sobre o cenário psicossocial)
2. **Fatores de risco prioritários** (baseado nas dimensões críticas)
3. **Recomendações** (3 ações práticas para o RH/gestão)
4. **Monitoramento** (indicadores a acompanhar)

Seja direto, prático e baseado em evidências. Use linguagem técnica mas acessível ao RH.
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI error: ${err}`);
    }

    const result = await response.json();
    const analise = result.choices[0].message.content;

    return new Response(JSON.stringify({ analise }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-psicossocial-analise error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
