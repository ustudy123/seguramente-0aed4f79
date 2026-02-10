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
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { documento_tipo, documento_nome, action } = await req.json();

    let systemPrompt = "";

    if (action === "analise") {
      systemPrompt = `Você é um especialista em Saúde e Segurança do Trabalho (SST) no Brasil, com profundo conhecimento das Normas Regulamentadoras (NRs), legislação trabalhista e previdenciária.

Você está analisando um documento do tipo: ${documento_tipo} (${documento_nome}).

Realize uma leitura semântica e estrutural para identificar e organizar as seguintes informações presentes no documento:

1. **Funções e Setores** identificados
2. **Agentes de Risco** (físicos, químicos, biológicos, ergonômicos, mecânicos/de acidentes)
3. **Medidas de Controle** existentes e recomendadas
4. **Recomendações Técnicas** do profissional responsável
5. **Programas, Exames e Treinamentos** mencionados
6. **Conclusões e Observações** relevantes
7. **Alertas de Conformidade** — inconsistências, lacunas ou itens que merecem atenção

⚠️ IMPORTANTE: Você NÃO valida mérito técnico. Apenas organiza, estrutura e compara informações declaradas no documento.

Responda em formato estruturado com seções claras. Use emojis para classificar alertas:
🔴 Alerta Crítico — risco legal/previdenciário imediato
🟠 Alerta Técnico — inconsistência ou lacuna técnica
🟡 Atenção — item que merece acompanhamento

Responda sempre em português brasileiro.`;
    } else {
      systemPrompt = `Você é um especialista em SST. Responda à pergunta do usuário sobre o documento ${documento_tipo}.`;
    }

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
          { role: "user", content: `Analise o documento "${documento_nome}" do tipo ${documento_tipo}. Gere um relatório completo de análise de conformidade SST com os itens identificados, alertas e recomendações. Como este é um documento carregado recentemente, faça uma análise baseada no tipo do documento e nas normas aplicáveis.` },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-sst-analise error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
