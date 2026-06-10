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
    const { pdi } = await req.json();

    if (!pdi || !pdi.titulo) {
      return new Response(JSON.stringify({ error: "Dados do PDI são obrigatórios." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metasText = (pdi.metas || []).map((m: any, i: number) => {
      const acoes = (m.acoes || []).map((a: any) => `  - ${a.titulo} (${a.tipo}, status: ${a.status})`).join("\n");
      return `Meta ${i + 1}: ${m.titulo}
  Categoria: ${m.categoria || "N/A"}
  Status: ${m.status}
  Progresso: ${m.progresso}%
  Peso: ${m.peso}
  SMART - Específica: ${m.especifica || "N/A"}
  SMART - Mensurável: ${m.mensuravel || "N/A"}
  SMART - Atingível: ${m.atingivel || "N/A"}
  SMART - Relevante: ${m.relevante || "N/A"}
  SMART - Temporal: ${m.temporal || "N/A"}
  Indicador de sucesso: ${m.indicador_sucesso || "N/A"}
  Valor base: ${m.valor_base ?? "N/A"} | Valor alvo: ${m.valor_alvo ?? "N/A"} | Valor atual: ${m.valor_atual ?? "N/A"} ${m.unidade ? `(${m.unidade})` : ""}
  Período: ${m.data_inicio || "N/A"} a ${m.data_fim || "N/A"}
  Observações: ${m.observacoes || "N/A"}
  Ações (${(m.acoes || []).length}):
${acoes || "  (nenhuma)"}`;
    }).join("\n\n");

    const checkinsText = (pdi.checkins || []).map((c: any) => 
      `- ${c.created_at}: Avanços: ${c.avancos || "N/A"} | Bloqueios: ${c.bloqueios || "N/A"} | Próximo passo: ${c.proximo_passo || "N/A"} (por ${c.realizado_por_nome || "N/A"})`
    ).join("\n") || "(nenhum check-in registrado)";

    const feedbacksText = (pdi.feedbacks || []).map((f: any) =>
      `- [${f.tipo}] por ${f.autor_nome || "N/A"} em ${f.created_at}: Ponto forte: ${f.ponto_forte || "N/A"} | A melhorar: ${f.ponto_melhorar || "N/A"} | Recomendação: ${f.recomendacao || "N/A"}`
    ).join("\n") || "(nenhum feedback registrado)";

    const prompt = `Você é um consultor sênior de desenvolvimento humano e gestão de talentos. Com base nos dados do PDI abaixo, gere um DOCUMENTO DE PLANO DE DESENVOLVIMENTO INDIVIDUAL completo, profissional e visualmente rico em HTML.

DADOS DO PDI:
- Título: ${pdi.titulo}
- Colaborador: ${pdi.colaborador_nome}
- Cargo: ${pdi.colaborador_cargo || "N/A"}
- Departamento: ${pdi.colaborador_departamento || "N/A"}
- Status: ${pdi.status}
- Período: ${pdi.periodo}
- Datas: ${pdi.data_inicio} a ${pdi.data_fim}
- Progresso geral: ${pdi.progresso}%
- Líder/Responsável: ${pdi.responsavel_nome || "N/A"}
- Co-responsável: ${pdi.co_responsavel_nome || "N/A"}
- Gatilho: ${pdi.gatilho || "N/A"}
- Descrição: ${pdi.descricao || "N/A"}
- Observações: ${pdi.observacoes || "N/A"}

METAS SMART (${(pdi.metas || []).length}):
${metasText || "(nenhuma meta definida)"}

CHECK-INS:
${checkinsText}

FEEDBACKS:
${feedbacksText}

INSTRUÇÕES OBRIGATÓRIAS PARA O DOCUMENTO:

1. O documento DEVE ter as seguintes seções detalhadas:
   - Capa com título "Plano de Desenvolvimento Individual", nome do colaborador, cargo, departamento e período
   - Resumo Executivo (visão geral do PDI, objetivo, contexto e progresso atual com barra visual)
   - Dados do Colaborador (informações completas em formato de ficha profissional)
   - Cronograma e Período (linha do tempo visual do PDI)
   - Metas SMART (cada meta em card individual com TODOS os critérios SMART detalhados, barra de progresso, indicadores e ações vinculadas)
   - Plano de Ações (tabela consolidada de todas as ações com status, tipo, prazos)
   - Histórico de Check-ins (timeline visual dos acompanhamentos realizados)
   - Feedbacks Recebidos (cards com pontos fortes, áreas de melhoria e recomendações)
   - Indicadores de Progresso (dashboard visual com métricas consolidadas)
   - Assinaturas (espaço para assinatura do colaborador, líder e RH com linha e nome)

2. FORMATAÇÃO HTML OBRIGATÓRIA:
   - Use CSS inline em cada elemento
   - Use a paleta de cores: primário #1e3a5f (azul escuro), secundário #2d8a6e (verde), accent #f4a261 (laranja), sucesso #27ae60, alerta #e74c3c, fundo #f8f9fa, texto #1a1a2e
   - Fonte: font-family: 'Segoe UI', 'Inter', system-ui, sans-serif
   - Cada seção deve ter um cabeçalho com fundo colorido, ícone emoji e título grande
   - Use cards com border-radius: 12px, box-shadow e padding generoso (24px+)
   - Use ícones emoji relevantes (🎯 📊 👤 📅 ✅ 📈 💬 📝 🏆 ✍️)
   - Use barras de progresso visuais (div com background gradient)
   - Cada meta deve ter borda lateral colorida por categoria
   - Use alternância de cores de fundo nas seções
   - Tamanho mínimo: 15px corpo, 28px títulos seção, 42px capa
   - Espaçamento generoso: margin 40px+, padding 32px+
   - Tabelas estilizadas com cabeçalho colorido e linhas zebradas

3. O HTML deve ser SELF-CONTAINED (sem referências externas) e pronto para impressão com @media print
4. O documento deve ter aspecto de relatório corporativo premium
5. Adicione números de página no rodapé, data de geração e confidencialidade
6. Para metas sem detalhes SMART completos, ainda assim exiba os campos disponíveis de forma organizada
7. Use gradients sutis nos headers
8. Inclua um mini-dashboard visual no resumo com cards de métricas (total metas, concluídas, progresso médio)

Retorne APENAS o HTML completo sem explicações, markdown ou code blocks. O HTML deve começar com <!DOCTYPE html>.`;

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Você é um designer e consultor de RH/Desenvolvimento Humano. Gere apenas HTML completo e profissional para documentos de PDI. Nunca inclua markdown, code blocks ou explicações — apenas o HTML puro." },
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
        return new Response(JSON.stringify({ error: "Limite da API OpenAI atingido. Verifique o saldo/limites da chave." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let html = data.choices?.[0]?.message?.content?.trim() || "";

    // Remove markdown code fences if present
    if (html.startsWith("```")) {
      html = html.replace(/^```(?:html)?\s*\n?/, "").replace(/\n?\s*```\s*$/, "");
    }

    // Ensure the HTML is a complete document with proper viewport for iframe rendering
    if (html && !html.toLowerCase().includes("<!doctype")) {
      html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{margin:0;padding:20px;font-family:'Segoe UI','Inter',system-ui,sans-serif;}</style></head><body>${html}</body></html>`;
    }

    // Inject viewport meta if missing (some AI responses include <html> but skip viewport)
    if (html && !html.toLowerCase().includes("viewport")) {
      html = html.replace(/<head>/i, '<head><meta name="viewport" content="width=device-width, initial-scale=1.0">');
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
