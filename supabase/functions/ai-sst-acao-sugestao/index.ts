const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { achado_titulo, achado_descricao, norma, documento_tipo, severidade } = await req.json();

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OPENAI_API_KEY não configurada");

    const prazo = severidade === "critico" ? "7 dias" : severidade === "alerta" ? "30 dias" : "90 dias";

    const prompt = `Você é um especialista em SST (Saúde e Segurança do Trabalho) com profundo conhecimento das Normas Regulamentadoras brasileiras (NRs), CLT e legislação previdenciária.

Uma auditoria de IA identificou a seguinte não-conformidade em um documento SST:

**Documento:** ${documento_tipo}
**Tipo de Achado:** ${severidade === "critico" ? "🔴 CRÍTICO" : severidade === "alerta" ? "🟠 ALERTA TÉCNICO" : "🟡 ATENÇÃO"}
**Não-conformidade:** ${achado_titulo}
**Descrição:** ${achado_descricao}
${norma ? `**Norma Aplicável:** ${norma}` : ""}
**Prazo recomendado:** ${prazo}

Gere EXATAMENTE 2 sugestões de ação corretiva no formato 5W2H, respondendo em JSON puro (sem markdown, sem code blocks):

{
  "sugestoes": [
    {
      "titulo": "Título objetivo da ação (max 80 chars)",
      "descricao": "Descrição clara do que precisa ser feito",
      "como": "Passo a passo numerado (use \\n para quebras de linha):\n1. Primeiro passo\n2. Segundo passo\n3. Terceiro passo\n4. Quarto passo",
      "porque": "Justificativa técnica e legal (cite a norma específica)",
      "onde": "Local/setor onde a ação deve ser executada",
      "prioridade": "${severidade === "critico" ? "critica" : severidade === "alerta" ? "alta" : "media"}"
    }
  ]
}

Regras:
- Primeira sugestão: ação técnica direta (adequação do documento/processo)
- Segunda sugestão: ação de controle/governança (verificação/treinamento/monitoramento)
- Seja específico para SST brasileiro
- Cite NRs quando aplicável
- Responda APENAS com o JSON, sem texto adicional`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1200,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "Erro OpenAI");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
