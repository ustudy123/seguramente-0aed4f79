import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PlanoAcaoRequest {
  tipo: "sugerir" | "gerar_5w2h" | "priorizar" | "sugerir_campo";
  contexto: string;
  dados?: {
    titulo?: string;
    descricao?: string;
    origem?: string;
    risco?: string;
    campo?: string;
    valorAtual?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY não configurada");
    }

    const { tipo, contexto, dados }: PlanoAcaoRequest = await req.json();

    let systemPrompt = `Você é um especialista em gestão de segurança do trabalho e ergonomia, focado na metodologia 5W2H e Matriz GUT.
Responda sempre em português brasileiro de forma objetiva e acionável.`;

    let userPrompt = "";

    if (tipo === "sugerir") {
      userPrompt = `Com base no seguinte contexto, sugira 3-5 ações corretivas ou preventivas:

Contexto: ${contexto}
${dados?.risco ? `Risco identificado: ${dados.risco}` : ""}
${dados?.origem ? `Origem: ${dados.origem}` : ""}

Forneça sugestões práticas e específicas.`;
    } else if (tipo === "gerar_5w2h") {
      userPrompt = `Gere uma descrição completa usando a metodologia 5W2H para a seguinte ação:

Título: ${dados?.titulo || "Ação corretiva"}
Descrição inicial: ${dados?.descricao || contexto}
${dados?.origem ? `Origem: ${dados.origem}` : ""}

Preencha todos os campos do 5W2H de forma detalhada.`;
    } else if (tipo === "priorizar") {
      userPrompt = `Analise a seguinte ação e sugira a priorização usando a Matriz GUT (Gravidade, Urgência, Tendência) de 1 a 5:

Ação: ${dados?.titulo || contexto}
Descrição: ${dados?.descricao || ""}
${dados?.risco ? `Risco relacionado: ${dados.risco}` : ""}

Justifique cada pontuação e calcule o GUT total.`;
    }

    const tools = [
      {
        type: "function",
        function: {
          name: "registrar_resultado_plano",
          description: "Registra o resultado da análise de plano de ação",
          parameters: {
            type: "object",
            properties: {
              sugestoes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    titulo: { type: "string" },
                    descricao: { type: "string" },
                    tipo: { type: "string", enum: ["corretiva", "preventiva", "melhoria"] },
                    prioridade: { type: "string", enum: ["baixa", "media", "alta", "urgente"] }
                  },
                  required: ["titulo", "descricao", "tipo", "prioridade"]
                },
                description: "Lista de ações sugeridas"
              },
              w5h2: {
                type: "object",
                properties: {
                  what: { type: "string", description: "O que será feito" },
                  why: { type: "string", description: "Por que será feito" },
                  where: { type: "string", description: "Onde será feito" },
                  when: { type: "string", description: "Quando será feito" },
                  who: { type: "string", description: "Quem será responsável" },
                  how: { type: "string", description: "Como será feito" },
                  howMuch: { type: "string", description: "Quanto custará (estimativa)" }
                }
              },
              gut: {
                type: "object",
                properties: {
                  gravidade: { type: "integer", minimum: 1, maximum: 5 },
                  urgencia: { type: "integer", minimum: 1, maximum: 5 },
                  tendencia: { type: "integer", minimum: 1, maximum: 5 },
                  total: { type: "integer" },
                  justificativa: { type: "string" }
                }
              },
              resumo: { type: "string", description: "Resumo da análise" }
            },
            required: ["resumo"]
          }
        }
      }
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools,
        tool_choice: { type: "function", function: { name: "registrar_resultado_plano" } },
        max_tokens: 2000,
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
    console.error("Erro no plano de ação IA:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
