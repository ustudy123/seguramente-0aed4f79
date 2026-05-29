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

    const { quadrante, descricao_item, oceano_titulo } = await req.json();

    const quadranteDescricoes: Record<string, string> = {
      eliminar: "ELIMINAR — práticas, processos ou custos que devem ser completamente removidos",
      reduzir: "REDUZIR — fatores que devem ser diminuídos abaixo do padrão do setor",
      elevar: "ELEVAR — fatores que devem ser elevados acima do padrão do setor",
      criar: "CRIAR — fatores inéditos que a organização deve começar a oferecer",
    };

    const systemPrompt = `Você é um consultor estratégico especialista em Estratégia do Oceano Azul, gestão de SST (Segurança e Saúde do Trabalho) e governança corporativa.
Sua tarefa é gerar sugestões de ações práticas e específicas para o Plano de Ação, baseadas no contexto do item e do quadrante da Matriz Oceano Azul.
Todas as sugestões devem ser diretamente relacionadas ao conteúdo descrito pelo usuário.
Responda sempre em português brasileiro.`;

    const userPrompt = `Contexto da Matriz Oceano Azul: "${oceano_titulo || "Estratégia corporativa"}"
Quadrante: ${quadranteDescricoes[quadrante] || quadrante}
Item específico: "${descricao_item}"

Com base neste item específico, gere 4-5 sugestões de ações concretas e acionáveis para o Plano de Ação.
Cada sugestão deve ser diretamente relacionada ao conteúdo "${descricao_item}" e adequada ao quadrante "${quadrante}".
Inclua título curto, descrição detalhada do que fazer, justificativa (por quê) e como executar.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "registrar_sugestoes_oceano",
          description: "Registra sugestões de ações para o Plano de Ação baseadas no item do Oceano Azul",
          parameters: {
            type: "object",
            properties: {
              sugestoes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    titulo: { type: "string", description: "Título curto e objetivo da ação" },
                    descricao: { type: "string", description: "Descrição detalhada do que deve ser feito" },
                    porque: { type: "string", description: "Justificativa: por que esta ação é necessária" },
                    como: { type: "string", description: "Como executar: passos práticos" },
                    tipo: { type: "string", enum: ["corretiva", "preventiva", "melhoria"] },
                    prioridade: { type: "string", enum: ["baixa", "media", "alta", "urgente"] },
                  },
                  required: ["titulo", "descricao", "porque", "como", "tipo", "prioridade"],
                },
              },
            },
            required: ["sugestoes"],
          },
        },
      },
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "registrar_sugestoes_oceano" } },
        max_tokens: 2500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Erro na API OpenAI: ${response.status}`);
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
    console.error("Erro no Oceano Azul IA:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
