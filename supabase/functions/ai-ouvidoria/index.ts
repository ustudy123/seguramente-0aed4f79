import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface OuvidoriaRequest {
  tipo: string;
  assunto: string;
  mensagem: string;
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

    const { tipo, assunto, mensagem }: OuvidoriaRequest = await req.json();

    const systemPrompt = `Você é um especialista em análise de comunicações corporativas e recursos humanos.
Analise manifestações de ouvidoria (sugestões, reclamações, denúncias, elogios) e forneça:
1. Análise de sentimento (positivo, neutro, negativo, urgente)
2. Classificação automática de categoria/tema
3. Prioridade sugerida (baixa, normal, alta, urgente)
4. Resumo executivo
5. Palavras-chave identificadas
6. Sugestão de encaminhamento (RH, Gestão, Segurança, etc.)

Seja objetivo e imparcial. Responda em português brasileiro.`;

    const userPrompt = `Analise esta manifestação de ouvidoria:

Tipo: ${tipo}
Assunto: ${assunto}

Mensagem:
${mensagem}`;

    const tools = [
      {
        type: "function",
        function: {
          name: "registrar_analise_ouvidoria",
          description: "Registra a análise da manifestação de ouvidoria",
          parameters: {
            type: "object",
            properties: {
              sentimento: {
                type: "string",
                enum: ["positivo", "neutro", "negativo", "urgente"],
                description: "Sentimento geral da mensagem"
              },
              categoria: {
                type: "string",
                description: "Categoria/tema principal identificado"
              },
              subcategorias: {
                type: "array",
                items: { type: "string" },
                description: "Subcategorias ou temas secundários"
              },
              prioridade: {
                type: "string",
                enum: ["baixa", "normal", "alta", "urgente"],
                description: "Prioridade sugerida"
              },
              resumo: {
                type: "string",
                description: "Resumo executivo em 2-3 frases"
              },
              palavrasChave: {
                type: "array",
                items: { type: "string" },
                description: "Palavras-chave identificadas"
              },
              encaminhamento: {
                type: "string",
                description: "Setor sugerido para encaminhamento"
              },
              riscoIdentificado: {
                type: "boolean",
                description: "Se há risco de segurança, saúde ou compliance identificado"
              },
              acaoSugerida: {
                type: "string",
                description: "Ação sugerida para resposta"
              },
              confianca: {
                type: "number",
                minimum: 0,
                maximum: 100,
                description: "Nível de confiança da análise (0-100)"
              }
            },
            required: ["sentimento", "categoria", "prioridade", "resumo", "encaminhamento", "confianca"]
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
        tool_choice: { type: "function", function: { name: "registrar_analise_ouvidoria" } },
        max_tokens: 1500,
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
    console.error("Erro na análise de ouvidoria:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
