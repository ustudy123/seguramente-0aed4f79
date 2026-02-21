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

    const { audioBase64, funcaoNome } = await req.json();
    if (!audioBase64) throw new Error("Áudio não fornecido");

    // Step 1: Transcribe with Whisper
    console.log("Transcrevendo áudio...");
    const base64Data = audioBase64.includes(",") ? audioBase64.split(",")[1] : audioBase64;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const audioBlob = new Blob([bytes], { type: "audio/webm" });
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.webm");
    formData.append("model", "whisper-1");
    formData.append("language", "pt");

    const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const err = await whisperResponse.text();
      console.error("Whisper error:", err);
      throw new Error("Erro na transcrição do áudio");
    }

    const { text: transcricao } = await whisperResponse.json();
    console.log("Transcrição:", transcricao);

    // Step 2: Extract activities with GPT
    console.log("Extraindo atividades...");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em análise de cargos e funções corporativas. 
Sua tarefa é extrair atividades profissionais a partir de uma transcrição de entrevista/conversa com um colaborador.

Para cada atividade identificada, determine:
- nome: título curto e claro da atividade (máximo 60 caracteres)
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
            content: `Função/Cargo: ${funcaoNome || "Não informado"}\n\nTranscrição da entrevista:\n"${transcricao}"\n\nExtraia todas as atividades profissionais mencionadas.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "registrar_atividades",
            description: "Registra as atividades extraídas da entrevista",
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
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("GPT error:", response.status, err);
      throw new Error("Erro ao extrair atividades");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("Resposta inválida da IA");

    const resultado = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ transcricao, ...resultado }), {
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
