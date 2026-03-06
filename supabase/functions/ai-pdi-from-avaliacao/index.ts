import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const {
      colaboradorNome,
      colaboradorCargo,
      colaboradorDepartamento,
      cicloNome,
      notaGeral,
      pontosFortes,
      areasDesenvolvimento,
      resumo,
      notas,
      dimensoes,
    } = body;

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY não configurada" }), { status: 500, headers: corsHeaders });
    }

    // Montar contexto das dimensões com notas
    const dimensoesTexto = (dimensoes || []).map((d: { nome: string; criterios: Array<{ id: string; nome: string }> }) => {
      const criteriosComNota = d.criterios
        .map((c: { id: string; nome: string }) => `  - ${c.nome}: ${(notas || {})[c.id] || "N/A"}/5`)
        .join("\n");
      return `${d.nome}:\n${criteriosComNota}`;
    }).join("\n\n");

    const prompt = `Você é um especialista em desenvolvimento humano e RH. Com base na avaliação de desempenho abaixo, gere de 2 a 3 metas SMART para o PDI do colaborador.

COLABORADOR: ${colaboradorNome}
CARGO: ${colaboradorCargo || "Não informado"}
DEPARTAMENTO: ${colaboradorDepartamento || "Não informado"}
CICLO: ${cicloNome || "Não informado"}
NOTA GERAL: ${notaGeral ? notaGeral.toFixed(1) + "/5" : "N/A"}

NOTAS POR DIMENSÃO:
${dimensoesTexto || "Não informado"}

PONTOS FORTES:
${pontosFortes || "Não informado"}

ÁREAS DE DESENVOLVIMENTO:
${areasDesenvolvimento || "Não informado"}

RESUMO DA AVALIAÇÃO:
${resumo || "Não informado"}

Retorne APENAS um JSON válido com o seguinte formato (sem markdown, sem texto extra):
{
  "metas": [
    {
      "titulo": "string (máx 80 chars)",
      "descricao": "string (1-2 frases)",
      "categoria": "tecnica" | "comportamental" | "processos" | "lideranca" | "cultura" | "saude_bem_estar",
      "especifica": "O que exatamente será desenvolvido",
      "mensuravel": "Como medir o progresso (ex: porcentagem, número, indicador)",
      "atingivel": "Por que é viável no contexto do colaborador",
      "relevante": "Por que é importante para a função/empresa",
      "temporal": "Prazo sugerido (ex: 3 meses, 6 meses)",
      "indicador_sucesso": "string",
      "peso": 1,
      "data_fim_sugerida": "YYYY-MM-DD (3 a 6 meses a partir de hoje)"
    }
  ],
  "titulo_pdi": "string (título sugerido para o PDI, ex: PDI 2026 — Desenvolvimento em Liderança)",
  "descricao_pdi": "string (1-2 frases descrevendo o foco do PDI)"
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Você é especialista em RH e desenvolvimento humano. Responda sempre em português brasileiro com JSON válido." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI error: ${err}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Tentar extrair JSON do texto
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { metas: [], titulo_pdi: "", descricao_pdi: "" };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-pdi-from-avaliacao error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
