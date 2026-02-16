import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY não configurada");
    }

    const { nome, tipo, anos } = await req.json();
    // tipo: "aniversario" | "tempo_casa"

    let prompt = "";
    if (tipo === "aniversario") {
      prompt = `Gere uma mensagem curta e carinhosa de feliz aniversário para ${nome}. 
A mensagem deve ser profissional mas calorosa, adequada para um ambiente corporativo.
Use no máximo 3 frases. Inclua 1-2 emojis relevantes.
Responda APENAS com a mensagem, sem aspas nem prefixos.`;
    } else {
      prompt = `Gere uma mensagem curta de parabéns para ${nome} que completa ${anos} ano${anos > 1 ? "s" : ""} de empresa hoje.
A mensagem deve ser profissional mas calorosa, reconhecendo a dedicação e contribuição.
Use no máximo 3 frases. Inclua 1-2 emojis relevantes.
Responda APENAS com a mensagem, sem aspas nem prefixos.`;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Você é um assistente que gera mensagens de felicitação corporativas em português brasileiro." },
          { role: "user", content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      throw new Error(`Erro na API: ${response.status}`);
    }

    const data = await response.json();
    const mensagem = data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(
      JSON.stringify({ mensagem }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro ao gerar felicitação:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
