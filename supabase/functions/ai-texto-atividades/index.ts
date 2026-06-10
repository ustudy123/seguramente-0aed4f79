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
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const { texto, funcaoNome } = await req.json();
    if (!texto || texto.trim().length < 20) {
      throw new Error("Texto muito curto. Forneça uma descrição mais detalhada.");
    }

    console.log("Extraindo atividades do texto...", texto.substring(0, 100));

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em análise de cargos e funções corporativas.
Sua tarefa é extrair atividades profissionais a partir de um texto descritivo de uma função/cargo.

Para cada atividade identificada, determine:
- nome: título curto e claro da atividade (máximo 60 caracteres, verbo no infinitivo)
- descricao: descrição detalhada do que a atividade envolve
- frequencia: "diaria", "semanal", "mensal" ou "eventual"
- complexidade: "baixa", "media" ou "alta"
- classificacao: "rotineira", "critica" ou "excepcional"

Extraia TODAS as atividades mencionadas, mesmo que citadas brevemente.
Seja objetivo nos nomes. Use verbos no infinitivo (Ex: "Elaborar relatórios mensais").
Responda SEMPRE em português brasileiro.`
          },
          {
            role: "user",
            content: `Função/Cargo: ${funcaoNome || "Não informado"}\n\nDescrição das atividades:\n"${texto}"\n\nExtraia todas as atividades profissionais mencionadas.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "registrar_atividades",
            description: "Registra as atividades extraídas do texto descritivo",
            parameters: {
              type: "object",
              properties: {
                atividades: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      nome: { type: "string" },
                      descricao: { type: "string" },
                      frequencia: { type: "string", enum: ["diaria", "semanal", "mensal", "eventual"] },
                      complexidade: { type: "string", enum: ["baixa", "media", "alta"] },
                      classificacao: { type: "string", enum: ["rotineira", "critica", "excepcional"] },
                    },
                    required: ["nome", "descricao", "frequencia", "complexidade", "classificacao"]
                  }
                }
              },
              required: ["atividades"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "registrar_atividades" } },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("AI error:", response.status, err);
      if (response.status === 429) {
        throw new Error("Limite de requisições excedido. Tente novamente em alguns segundos.");
      }
      if (response.status === 402) {
        throw new Error("Créditos de IA esgotados. Contate o administrador.");
      }
      throw new Error("Erro ao extrair atividades com IA");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("Resposta inválida da IA");

    const resultado = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
