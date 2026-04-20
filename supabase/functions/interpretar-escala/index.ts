import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um especialista em legislação trabalhista brasileira (CLT) e interpretação de escalas de trabalho.

Sua tarefa: interpretar uma descrição em linguagem natural sobre a jornada de trabalho e extrair uma estrutura formal compatível com controle de ponto eletrônico.

Regras:
- Identifique dias da semana, horários de entrada/saída, intervalos, recorrências mensais e exceções.
- Calcule jornada diária somando blocos produtivos (excluindo intervalos).
- Calcule intervalo intrajornada pelo gap entre blocos.
- Classifique tipo da escala: "5x2", "6x1", "12x36" ou "personalizada".
- Sugira nome descritivo curto.
- Identifique trabalho noturno (22h-05h) e marque adicional noturno quando aplicável.
- Para recorrências como "2º sábado do mês", crie entrada em "recorrencias" — NÃO marque sábado_util como true.
- ATENÇÃO: em "recorrencias", os campos hora_inicio e hora_fim devem ser os HORÁRIOS REAIS DO RELÓGIO informados pelo usuário (ex: "08:00" e "12:00"), NUNCA a duração total. Se o usuário disser "trabalhamos 4 horas no segundo sábado das 08h às 12h", então hora_inicio="08:00" e hora_fim="12:00".
- Se o usuário mencionar apenas duração ("trabalhamos 4h num sábado") sem horário, adicione uma pergunta_complementar pedindo o horário exato e NÃO invente "00:00–04:00".
- Valide consistência: aponte alertas (ausência de DSR, jornada > 8h diária, ausência de intervalo em jornada > 6h, etc.).
- Indique nivel_confianca: "alta", "media" ou "baixa". Use "baixa" se a descrição for ambígua.
- Se houver ambiguidade, popule "perguntas_complementares" com perguntas objetivas.
- Gere "descricao_contratual" em prosa formal pronta para uso em contrato/eSocial.

Sempre retorne os campos via tool call. Horários em formato HH:MM. Minutos como inteiros.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const { descricao } = await req.json();
    if (!descricao || typeof descricao !== "string" || descricao.trim().length < 5) {
      return new Response(JSON.stringify({ error: "Descrição muito curta" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Interprete esta descrição de jornada:\n\n"${descricao}"` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "estruturar_escala",
            description: "Retorna a estrutura formal da escala interpretada",
            parameters: {
              type: "object",
              properties: {
                nome_sugerido: { type: "string" },
                tipo: { type: "string", enum: ["5x2", "6x1", "12x36", "personalizada"] },
                nivel_confianca: { type: "string", enum: ["alta", "media", "baixa"] },
                jornada_diaria_minutos: { type: "integer" },
                jornada_semanal_minutos: { type: "integer" },
                intervalo_intrajornada_minutos: { type: "integer" },
                hora_entrada_padrao: { type: "string", description: "HH:MM" },
                hora_saida_padrao: { type: "string", description: "HH:MM" },
                sabado_util: { type: "boolean" },
                domingo_util: { type: "boolean" },
                tem_adicional_noturno: { type: "boolean" },
                periodos_diarios: {
                  type: "array",
                  description: "Blocos de trabalho por dia da semana",
                  items: {
                    type: "object",
                    properties: {
                      dia_semana: { type: "string", enum: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"] },
                      blocos: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            inicio: { type: "string" },
                            fim: { type: "string" },
                          },
                          required: ["inicio", "fim"],
                        },
                      },
                    },
                    required: ["dia_semana", "blocos"],
                  },
                },
                recorrencias: {
                  type: "array",
                  description: "Exceções mensais (ex: 2º sábado do mês)",
                  items: {
                    type: "object",
                    properties: {
                      descricao: { type: "string" },
                      ordinal_mes: { type: "string", enum: ["1", "2", "3", "4", "ultimo", "todos"] },
                      dia_semana: { type: "string" },
                      hora_inicio: { type: "string" },
                      hora_fim: { type: "string" },
                    },
                  },
                },
                alertas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      severidade: { type: "string", enum: ["info", "atencao", "erro"] },
                      mensagem: { type: "string" },
                    },
                    required: ["severidade", "mensagem"],
                  },
                },
                perguntas_complementares: {
                  type: "array",
                  items: { type: "string" },
                },
                descricao_contratual: { type: "string" },
                resumo_interpretacao: { type: "string", description: "Resumo curto de como o sistema entendeu a escala" },
              },
              required: [
                "nome_sugerido", "tipo", "nivel_confianca",
                "jornada_diaria_minutos", "jornada_semanal_minutos", "intervalo_intrajornada_minutos",
                "hora_entrada_padrao", "hora_saida_padrao",
                "sabado_util", "domingo_util", "tem_adicional_noturno",
                "periodos_diarios", "alertas", "descricao_contratual", "resumo_interpretacao",
              ],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "estruturar_escala" } },
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("OpenAI error:", resp.status, err);
      return new Response(JSON.stringify({ error: "Falha na interpretação pela IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("IA não retornou estrutura");

    const estrutura = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ estrutura }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro interpretar-escala:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
