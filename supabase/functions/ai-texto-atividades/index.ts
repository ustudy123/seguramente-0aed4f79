import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCompanyContext } from "../_shared/ai-helper.ts";

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

    // Tenta obter contexto da empresa (não bloqueia se falhar)
    let companyContext = "";
    try {
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        const payload = JSON.parse(
          atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
        );
        const userId = payload.sub;
        if (userId) {
          const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          );
          const { data: profile } = await supabase
            .from("profiles")
            .select("tenant_id")
            .eq("user_id", userId)
            .single();
          if (profile?.tenant_id) {
            companyContext = await getCompanyContext(supabase, profile.tenant_id);
          }
        }
      }
    } catch (ctxErr) {
      console.warn("Não foi possível carregar contexto da empresa:", ctxErr);
    }

    console.log("Extraindo atividades do texto...", texto.length, "chars");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 8000,
        messages: [
          {
            role: "system",
            content: `Você é um especialista sênior em análise de cargos e funções corporativas.
Sua tarefa é EXTRAIR EXAUSTIVAMENTE todas as atividades profissionais mencionadas em um texto descritivo de função/cargo.

${companyContext}

REGRAS OBRIGATÓRIAS DE EXTRAÇÃO:
1. Extraia TODAS as atividades citadas, mesmo que mencionadas de forma breve, em bullet points, listas, tabelas ou parágrafos corridos.
2. NÃO agrupe atividades distintas em uma só. Cada tarefa/responsabilidade descrita deve virar UMA atividade separada.
3. Se o texto tiver 30 atividades, retorne 30. Se tiver 50, retorne 50. Não há limite máximo.
4. Não invente atividades que não estejam no texto — extraia apenas o que estiver descrito ou claramente implícito.
5. Use o contexto da empresa (setor/CNAE/cultura) para dar precisão às descrições, mas NÃO para adicionar atividades inexistentes.

Para cada atividade identificada, determine:
- nome: título curto e claro (máx. 60 caracteres, verbo no infinitivo — ex: "Elaborar relatórios mensais")
- descricao: descrição detalhada do que a atividade envolve (2-4 frases)
- frequencia: "diaria" | "semanal" | "mensal" | "eventual"
- complexidade: "baixa" | "media" | "alta"
- classificacao: "rotineira" | "critica" | "excepcional"

Responda SEMPRE em português brasileiro.`
          },
          {
            role: "user",
            content: `Função/Cargo: ${funcaoNome || "Não informado"}\n\nDescrição das atividades:\n"""\n${texto}\n"""\n\nExtraia TODAS as atividades profissionais mencionadas — não deixe nenhuma de fora.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "registrar_atividades",
            description: "Registra TODAS as atividades extraídas do texto descritivo, sem omitir nenhuma.",
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
    console.log(`Atividades extraídas: ${resultado.atividades?.length ?? 0}`);

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
