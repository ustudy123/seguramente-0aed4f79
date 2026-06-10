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

    const prompt = `Você é um especialista em gestão de pessoas e comunicação corporativa. Sua tarefa é REESCREVER COMPLETAMENTE o relato abaixo, transformando-o em um texto profissional, estruturado e formal para registro de feedback.

Categoria: ${categoria} — objetivo: ${categoriaContexto[categoria] || "registrar de forma profissional"}.
${colaborador_nome ? `Colaborador: ${colaborador_nome}` : ""}

Relato original do gestor:
"${descricao}"

INSTRUÇÕES IMPORTANTES:
- NÃO copie o texto original. Reescreva-o completamente com suas próprias palavras.
- Estruture o texto em: (1) Contexto/situação observada, (2) Impacto do comportamento, (3) Expectativa ou reforço positivo.
- Use linguagem profissional, respeitosa e em terceira pessoa.
- Elimine informalidades, tom acusatório ou emocional excessivo.
- Mantenha o sentido original sem inventar informações.
- O texto deve ser significativamente diferente do original em forma, mas fiel em conteúdo.
- Não inclua saudações, assinaturas, títulos ou explicações.

Retorne APENAS o texto reescrito.`;

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Você é um redator especialista em comunicação corporativa e gestão de pessoas. Sempre reescreva textos de forma profissional e estruturada, nunca repita o texto original." },
          { role: "user", content: prompt }
        ],
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
