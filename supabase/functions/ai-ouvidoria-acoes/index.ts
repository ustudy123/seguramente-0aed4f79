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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const { tipo, assunto, mensagem } = await req.json();

    const systemPrompt = `Você é um especialista em gestão de riscos, segurança do trabalho e governança corporativa.
Com base em uma manifestação de ouvidoria, sugira até 5 ações práticas e estruturadas no formato 5W2H para o Plano de Ação.

Cada ação deve ter:
- titulo: título claro e objetivo (máx 100 caracteres)
- descricao: descrição detalhada da ação
- porque: justificativa (por quê essa ação é necessária)
- onde: local ou setor de aplicação
- como: como será executada
- tipo: "corretiva", "preventiva" ou "melhoria"
- gravidade: 1-5 (escala GUT)
- urgencia: 1-5 (escala GUT)
- tendencia: 1-5 (escala GUT)

Considere o tipo de manifestação e proponha ações realistas e proporcionais.
Responda em português brasileiro.`;

    const userPrompt = `Manifestação de Ouvidoria:
Tipo: ${tipo}
Assunto: ${assunto}
Mensagem: ${mensagem}

Sugira até 5 ações para o Plano de Ação.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "sugerir_acoes",
          description: "Retorna sugestões de ações para o plano de ação",
          parameters: {
            type: "object",
            properties: {
              acoes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    titulo: { type: "string" },
                    descricao: { type: "string" },
                    porque: { type: "string" },
                    onde: { type: "string" },
                    como: { type: "string" },
                    tipo: { type: "string", enum: ["corretiva", "preventiva", "melhoria"] },
                    gravidade: { type: "number", minimum: 1, maximum: 5 },
                    urgencia: { type: "number", minimum: 1, maximum: 5 },
                    tendencia: { type: "number", minimum: 1, maximum: 5 },
                  },
                  required: ["titulo", "descricao", "porque", "onde", "como", "tipo", "gravidade", "urgencia", "tendencia"],
                  additionalProperties: false,
                },
              },
            },
            required: ["acoes"],
            additionalProperties: false,
          },
        },
      },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "sugerir_acoes" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Erro no gateway de IA: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("Resposta inválida da IA");
    }

    const resultado = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao sugerir ações:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
