import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campo, colaborador_nome, colaborador_cargo, colaborador_departamento, periodo, gatilho, titulo, descricao } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurado");

    const contexto = `
Colaborador: ${colaborador_nome || "não informado"}
Cargo: ${colaborador_cargo || "não informado"}
Departamento: ${colaborador_departamento || "não informado"}
Período: ${periodo || "trimestral"}
Gatilho: ${gatilho || "não informado"}
${titulo ? `Título atual: ${titulo}` : ""}
${descricao ? `Descrição atual: ${descricao}` : ""}
`.trim();

    let instrucao = "";
    if (campo === "titulo") {
      instrucao = `Sugira um TÍTULO curto e objetivo (máx. 80 caracteres) para um PDI (Plano de Desenvolvimento Individual). Inclua o período e o nome do colaborador. Retorne APENAS o título, sem aspas, sem explicações.`;
    } else if (campo === "descricao") {
      instrucao = `Escreva uma DESCRIÇÃO clara e profissional (2-4 frases, máx. 400 caracteres) para um PDI, contextualizando o objetivo de desenvolvimento do colaborador conforme cargo, departamento e gatilho. Foque em desenvolvimento de competências e resultados esperados. Retorne APENAS o texto, sem títulos ou marcadores.`;
    } else {
      throw new Error("Campo inválido");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um especialista em RH e desenvolvimento de pessoas. Suas sugestões são objetivas, profissionais e em português do Brasil." },
          { role: "user", content: `${instrucao}\n\nContexto:\n${contexto}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos no workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erro no gateway de IA");
    }

    const data = await response.json();
    const sugestao = (data.choices?.[0]?.message?.content || "").trim().replace(/^["']|["']$/g, "");

    return new Response(JSON.stringify({ sugestao }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-pdi-sugestao error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
