import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { missao, visao, valores, principios, comportamentos_esperados, comportamentos_nao_tolerados, empresa_nome } = await req.json();

    if (!missao && !visao && valores?.length === 0 && principios?.length === 0) {
      return new Response(JSON.stringify({ error: "Preencha ao menos Missão, Visão ou Valores antes de gerar o manual." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Você é um consultor sênior de cultura organizacional e employer branding. Com base nos dados culturais abaixo, gere um MANUAL DE CULTURA ORGANIZACIONAL completo, profissional e visualmente rico em HTML.

DADOS DA EMPRESA:
- Nome da empresa: ${empresa_nome || "Nossa Empresa"}
- Missão: ${missao || "(não informada)"}
- Visão: ${visao || "(não informada)"}
- Valores: ${valores?.length > 0 ? valores.join(", ") : "(nenhum)"}
- Princípios Culturais: ${principios?.length > 0 ? principios.join(", ") : "(nenhum)"}
- Comportamentos Esperados: ${comportamentos_esperados?.length > 0 ? comportamentos_esperados.join(", ") : "(nenhum)"}
- Comportamentos Não Tolerados: ${comportamentos_nao_tolerados?.length > 0 ? comportamentos_nao_tolerados.join(", ") : "(nenhum)"}

INSTRUÇÕES OBRIGATÓRIAS PARA O MANUAL:

1. O manual DEVE ter no mínimo 8 seções completas e detalhadas:
   - Capa com nome da empresa e título "Manual de Cultura Organizacional"
   - Mensagem de Boas-Vindas (2-3 parágrafos inspiradores)
   - Nossa Missão (explicação expandida com contexto e significado prático)
   - Nossa Visão de Futuro (detalhamento da visão com metas aspiracionais)
   - Nossos Valores (cada valor com título, descrição detalhada de 3-4 linhas e um exemplo prático de como vivenciá-lo no dia a dia)
   - Princípios Culturais (cada princípio com explicação aprofundada e diretrizes de aplicação)
   - Comportamentos Esperados (cada comportamento detalhado com cenários práticos e exemplos do que FAZER)
   - Comportamentos Não Tolerados (cada comportamento com explicação do impacto negativo e exemplos do que NÃO fazer)
   - Como Vivemos Nossa Cultura (seção integradora com dicas práticas para o dia a dia)
   - Compromisso Coletivo (encerramento motivacional)

2. FORMATAÇÃO HTML OBRIGATÓRIA:
   - Use CSS inline em cada elemento
   - Use a paleta de cores: primário #1e3a5f (azul escuro), secundário #2d8a6e (verde), accent #f4a261 (laranja), fundo #f8f9fa, texto #1a1a2e
   - Fonte: font-family: 'Segoe UI', 'Inter', system-ui, sans-serif
   - Cada seção deve ter um cabeçalho com fundo colorido, ícone emoji e título grande
   - Use cards com border-radius: 12px, box-shadow e padding generoso (24px+)
   - Use ícones emoji relevantes para cada seção (🎯 🚀 💎 🌟 ✅ 🚫 🤝 📌)
   - Use listas estilizadas com marcadores coloridos customizados
   - Use divisores visuais entre seções
   - A capa deve ser full-width com gradient de fundo
   - Cada valor/princípio deve estar em um card individual com borda lateral colorida
   - Use alternância de cores de fundo nas seções (branco e cinza claro)
   - Tamanho mínimo de fonte: 15px para corpo, 28px para títulos de seção, 42px para capa
   - Espaçamento generoso: margin entre seções de 40px+, padding interno de 32px+

3. O HTML deve ser SELF-CONTAINED (sem referências externas) e pronto para impressão com @media print
4. O documento deve ter aspecto de um manual corporativo premium, não um documento simples
5. Cada seção deve ter conteúdo SUBSTANCIAL — nunca menos de 3 parágrafos ou 5 itens detalhados
6. Para valores e princípios, EXPANDA cada item com contexto real e exemplos práticos mesmo que o usuário tenha dado apenas o título
7. Adicione uma barra lateral colorida (4px) à esquerda de cada card de valor/princípio
8. Use gradients sutis nos headers de seção
9. Adicione números de página no rodapé e data de geração

Retorne APENAS o HTML completo sem explicações, markdown ou code blocks. O HTML deve começar com <!DOCTYPE html>.`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um designer e consultor de cultura organizacional. Gere apenas HTML completo e profissional. Nunca inclua markdown, code blocks ou explicações — apenas o HTML puro." },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let html = data.choices?.[0]?.message?.content?.trim() || "";

    // Clean up markdown code blocks if present
    if (html.startsWith("```")) {
      html = html.replace(/^```html?\n?/, "").replace(/\n?```$/, "");
    }

    return new Response(JSON.stringify({ html }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
