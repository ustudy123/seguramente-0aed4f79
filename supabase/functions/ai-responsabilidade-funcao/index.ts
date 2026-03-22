import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cargoNome, descricao, textoAtual, acao } = await req.json();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    let systemPrompt = "";
    let userPrompt = "";

    if (acao === "melhorar") {
      systemPrompt = "Você é um especialista em descrição de cargos e gestão de pessoas. Melhore textos de responsabilidade de função tornando-os mais profissionais, claros e completos. Retorne apenas o texto melhorado, sem explicações ou formatação adicional.";
      userPrompt = `Cargo: ${cargoNome}${descricao ? `\nDescrição: ${descricao}` : ""}

Texto atual de responsabilidade:
${textoAtual}

Melhore este texto tornando-o mais profissional, claro e completo. Mantenha o mesmo tom e escopo, mas melhore a clareza, objetividade e completude. Retorne apenas o texto melhorado.`;
    } else {
      // acao === "gerar"
      systemPrompt = "Você é um especialista em descrição de cargos, RH e gestão de pessoas. Gere textos profissionais de responsabilidade de função que descrevam objetivos, impacto no negócio e área de atuação. Retorne apenas o texto gerado, sem explicações ou formatação adicional.";
      userPrompt = `Cargo: ${cargoNome}${descricao ? `\nDescrição: ${descricao}` : ""}${textoAtual ? `\nContexto adicional: ${textoAtual}` : ""}

Gere um texto profissional de responsabilidade para este cargo. O texto deve descrever:
- Objetivo principal da função
- Impacto no negócio
- Área de atuação e escopo de responsabilidade
- Principais entregas esperadas

Seja objetivo, profissional e direto. Use linguagem corporativa adequada. Retorne apenas o texto (2 a 4 parágrafos), sem títulos nem formatação.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em breve." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const texto = data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ texto }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
