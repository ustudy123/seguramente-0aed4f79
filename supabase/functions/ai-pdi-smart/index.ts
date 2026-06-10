import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mode, step, titulo, categoria, texto, contexto } = await req.json();

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

    const stepLabels: Record<string, string> = {
      especifica: "S — Específica: O que exatamente será desenvolvido?",
      mensuravel: "M — Mensurável: Como vamos medir que foi alcançada?",
      atingivel: "A — Atingível: Quais recursos a pessoa tem para alcançar?",
      relevante: "R — Relevante: Por que isso é importante para a função e empresa?",
      temporal: "T — Temporal: Até quando? Quais marcos intermediários?",
    };

    const stepLabel = stepLabels[step] || step;
    const ctxMeta = `Meta: "${titulo || "não definida"}". Categoria: ${categoria || "geral"}.`;

    let systemPrompt: string;
    let userPrompt: string;

    if (mode === "sugestoes") {
      systemPrompt = "Você é um especialista em gestão de pessoas, PDI e metodologia SMART. Gere sugestões práticas, específicas e acionáveis para planos de desenvolvimento individual.";
      userPrompt = `${ctxMeta}
${contexto ? `Contexto adicional: ${contexto}` : ""}

Para o passo "${stepLabel}", gere exatamente 5 sugestões práticas e específicas que o gestor pode usar diretamente.

Cada sugestão deve ser um texto completo, detalhado (2-4 frases) e pronto para uso.

Retorne APENAS um JSON array com 5 strings, sem markdown, sem explicações. Exemplo:
["sugestão 1", "sugestão 2", "sugestão 3", "sugestão 4", "sugestão 5"]`;
    } else if (mode === "melhorar") {
      systemPrompt = "Você é um especialista em redação corporativa e gestão de pessoas. Melhore textos tornando-os mais claros, completos, profissionais e alinhados com a metodologia SMART.";
      userPrompt = `${ctxMeta}

Passo atual: ${stepLabel}

Texto original do gestor:
"${texto}"

Reescreva este texto de forma mais completa, profissional e estruturada, mantendo o sentido original. O texto deve:
- Ser mais detalhado e específico
- Usar linguagem profissional
- Estar alinhado com a metodologia SMART
- Ter entre 3-6 frases

Retorne APENAS o texto melhorado, sem explicações ou aspas.`;
    } else if (mode === "plano_acao") {
      systemPrompt = "Você é um especialista em gestão de pessoas e planos de ação corporativos (5W2H). Gere sugestões de ações práticas para apoiar o desenvolvimento de uma meta SMART de PDI.";
      
      const smartCtx = [
        contexto?.especifica ? `Específica: ${contexto.especifica}` : "",
        contexto?.mensuravel ? `Mensurável: ${contexto.mensuravel}` : "",
        contexto?.atingivel ? `Atingível: ${contexto.atingivel}` : "",
        contexto?.relevante ? `Relevante: ${contexto.relevante}` : "",
        contexto?.temporal ? `Temporal: ${contexto.temporal}` : "",
      ].filter(Boolean).join("\n");

      userPrompt = `${ctxMeta}
${smartCtx ? `\nDetalhes SMART:\n${smartCtx}` : ""}

Gere exatamente 5 sugestões de AÇÕES para um Plano de Ação que apoiem o alcance dessa meta de PDI.

Para cada ação retorne um objeto JSON com:
- "titulo": título curto e claro da ação (máx 80 caracteres)
- "descricao": descrição detalhada do que fazer (2-3 frases)
- "porque": por que essa ação é necessária (1-2 frases)
- "como": como executar essa ação (1-2 frases)

Retorne APENAS um JSON array com 5 objetos, sem markdown. Exemplo:
[{"titulo":"...","descricao":"...","porque":"...","como":"..."}]`;
    } else {
      return new Response(JSON.stringify({ error: "Mode inválido. Use 'sugestoes', 'melhorar' ou 'plano_acao'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_completion_tokens: 1500,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para IA." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      throw new Error(`AI error: ${response.status} - ${t}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";

    if (mode === "sugestoes" || mode === "plano_acao") {
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        const sugestoes = jsonMatch ? JSON.parse(jsonMatch[0]) : [content];
        return new Response(JSON.stringify({ sugestoes }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ sugestoes: [content] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ texto_melhorado: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("ai-pdi-smart error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
