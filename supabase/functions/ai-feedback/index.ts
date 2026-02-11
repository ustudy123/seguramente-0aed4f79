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
    const { descricao, categoria, colaborador_nome } = await req.json();

    if (!descricao || !categoria) {
      return new Response(JSON.stringify({ error: "Descrição e categoria são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const categoriaContexto: Record<string, string> = {
      reconhecimento: "reforçar o comportamento positivo com tom apreciativo e motivador",
      alinhamento: "ajustar expectativas de forma clara, respeitosa e construtiva",
      desenvolvimento: "indicar pontos de melhoria com foco no crescimento profissional",
    };

    const prompt = `Você é um especialista em gestão de pessoas. Reescreva o seguinte relato de feedback como um texto profissional e estruturado para registro formal.

Categoria: ${categoria} — objetivo: ${categoriaContexto[categoria] || "registrar de forma profissional"}.
${colaborador_nome ? `Colaborador: ${colaborador_nome}` : ""}

Relato original do gestor:
"${descricao}"

Regras:
- Mantenha o sentido original, sem inventar informações
- Use linguagem profissional e respeitosa
- Elimine tom acusatório ou emocional excessivo
- Foque no fato observado, no impacto e na expectativa
- Mantenha objetividade e brevidade
- Não inclua saudações nem assinaturas

Retorne APENAS o texto reescrito, sem explicações adicionais.`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-nano",
        messages: [{ role: "user", content: prompt }],
        
        max_completion_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const texto = data.choices?.[0]?.message?.content?.trim() || descricao;

    return new Response(JSON.stringify({ texto_estruturado: texto }), {
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
