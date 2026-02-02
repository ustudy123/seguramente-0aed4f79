import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AnaliseRequest {
  tipo: "imagem" | "documento" | "texto" | "video" | "audio";
  conteudo: string | string[]; // base64 para imagem, array de base64 para vídeo frames, texto para documento/texto
  contexto?: string;
  audioBase64?: string; // Áudio em base64 para transcrição
}

interface RiscoIdentificado {
  tipo: string;
  eixo: "fisico" | "cognitivo" | "organizacional";
  severidade: "baixo" | "medio" | "alto" | "critico";
  descricao: string;
  itemNR17?: string;
}

interface AnaliseResultado {
  riscosIdentificados: RiscoIdentificado[];
  lacunasNormativas: string[];
  recomendacoes: string[];
  conformidadeEstimada: number;
  resumoGeral: string;
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

    const { tipo, conteudo, contexto, audioBase64 }: AnaliseRequest = await req.json();

    if (!conteudo) {
      throw new Error("Conteúdo não fornecido");
    }

    // Transcribe audio if provided
    let audioTranscricao: string | null = null;
    if (audioBase64) {
      console.log("Transcrevendo áudio com Whisper...");
      try {
        // Extract base64 data (remove data URL prefix if present)
        const base64Data = audioBase64.includes(",") 
          ? audioBase64.split(",")[1] 
          : audioBase64;
        
        // Convert base64 to binary
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Create form data for Whisper API
        const audioBlob = new Blob([bytes], { type: "audio/webm" });
        const formData = new FormData();
        formData.append("file", audioBlob, "audio.webm");
        formData.append("model", "whisper-1");
        formData.append("language", "pt");
        
        const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
          },
          body: formData,
        });
        
        if (whisperResponse.ok) {
          const whisperData = await whisperResponse.json();
          audioTranscricao = whisperData.text;
          console.log("Transcrição obtida:", audioTranscricao);
        } else {
          console.error("Erro na transcrição:", await whisperResponse.text());
        }
      } catch (transcribeError) {
        console.error("Erro ao transcrever áudio:", transcribeError);
      }
    }

    const systemPrompt = `Você é um especialista em ergonomia ocupacional e NR-17 (Norma Regulamentadora de Ergonomia do Brasil).
Sua função é analisar evidências (fotos, vídeos, documentos, descrições, relatos em áudio) de postos de trabalho e identificar:

1. RISCOS ERGONÔMICOS classificados em três eixos:
   - Físico: postura, mobiliário, equipamentos, esforço repetitivo, levantamento de carga
   - Cognitivo: sobrecarga mental, atenção sustentada, complexidade de tarefas, estresse
   - Organizacional: ritmo de trabalho, pausas, jornada, pressão por metas, autonomia

2. LACUNAS NORMATIVAS em relação à NR-17, citando os itens específicos (ex: 17.3.2, 17.4.1)

3. RECOMENDAÇÕES práticas e acionáveis para correção

4. CONFORMIDADE ESTIMADA (0-100%) com base nos requisitos da NR-17

Seja técnico, objetivo e forneça sempre referências aos itens da NR-17 quando aplicável.
Responda SEMPRE em português brasileiro.`;

    let messages: any[] = [
      { role: "system", content: systemPrompt }
    ];

    // Build context with audio transcription if available
    let fullContext = contexto || "";
    if (audioTranscricao) {
      fullContext = `${fullContext}\n\nRelato em áudio do trabalhador/avaliador: "${audioTranscricao}"`;
    }

    if (tipo === "imagem") {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: `Analise esta imagem de posto de trabalho e identifique todos os riscos ergonômicos visíveis, lacunas normativas da NR-17 e recomendações de melhoria.${fullContext ? `\n\nContexto adicional: ${fullContext}` : ""}`
          },
          {
            type: "image_url",
            image_url: {
              url: (conteudo as string).startsWith("data:") ? conteudo as string : `data:image/jpeg;base64,${conteudo}`,
              detail: "high"
            }
          }
        ]
      });
    } else if (tipo === "video") {
      // Video analysis with multiple frames
      const frames = conteudo as string[];
      const imageContent: any[] = [
        {
          type: "text",
          text: `Analise estes ${frames.length} frames extraídos de um vídeo do posto de trabalho. Identifique riscos ergonômicos, movimentos repetitivos, posturas inadequadas, e qualquer padrão de comportamento que possa indicar problemas ergonômicos.${fullContext ? `\n\nContexto adicional: ${fullContext}` : ""}`
        }
      ];

      // Add each frame as an image (limit to prevent token overflow)
      const maxFramesToSend = Math.min(frames.length, 8);
      for (let i = 0; i < maxFramesToSend; i++) {
        const frame = frames[Math.floor(i * (frames.length / maxFramesToSend))];
        imageContent.push({
          type: "image_url",
          image_url: {
            url: frame.startsWith("data:") ? frame : `data:image/jpeg;base64,${frame}`,
            detail: "low" // Use low detail for frames to reduce tokens
          }
        });
      }

      messages.push({
        role: "user",
        content: imageContent
      });
    } else {
      // Text-based analysis (including audio transcription context)
      messages.push({
        role: "user",
        content: `Analise as seguintes evidências/descrição de posto de trabalho e identifique riscos ergonômicos, lacunas normativas da NR-17 e recomendações:\n\n${conteudo}${fullContext ? `\n\nContexto adicional: ${fullContext}` : ""}`
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        tools: [
          {
            type: "function",
            function: {
              name: "registrar_analise_ergonomica",
              description: "Registra o resultado da análise ergonômica estruturada",
              parameters: {
                type: "object",
                properties: {
                  riscosIdentificados: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        tipo: { type: "string", description: "Nome do risco identificado" },
                        eixo: { type: "string", enum: ["fisico", "cognitivo", "organizacional"] },
                        severidade: { type: "string", enum: ["baixo", "medio", "alto", "critico"] },
                        descricao: { type: "string", description: "Descrição detalhada do risco" },
                        itemNR17: { type: "string", description: "Item da NR-17 relacionado (ex: 17.3.2)" }
                      },
                      required: ["tipo", "eixo", "severidade", "descricao"]
                    }
                  },
                  lacunasNormativas: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de itens da NR-17 não atendidos"
                  },
                  recomendacoes: {
                    type: "array",
                    items: { type: "string" },
                    description: "Recomendações práticas de melhoria"
                  },
                  conformidadeEstimada: {
                    type: "number",
                    minimum: 0,
                    maximum: 100,
                    description: "Percentual de conformidade com a NR-17"
                  },
                  resumoGeral: {
                    type: "string",
                    description: "Resumo geral da análise em 2-3 frases"
                  }
                },
                required: ["riscosIdentificados", "lacunasNormativas", "recomendacoes", "conformidadeEstimada", "resumoGeral"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "registrar_analise_ergonomica" } },
        max_tokens: 4000,
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

    const resultado: AnaliseResultado = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro na análise:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido na análise" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
