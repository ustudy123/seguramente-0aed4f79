import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type TipoDocumento = "contrato" | "prorrogacao" | "efetivacao" | "rescisao";

function buildPrompt(tipo: TipoDocumento, dados: any): string {
  const base = `
DADOS DO COLABORADOR E CONTRATO:
- Nome: ${dados.colaborador_nome}
- CPF: ${dados.colaborador_cpf}
- Cargo: ${dados.cargo || "N/A"}
- Departamento: ${dados.departamento || "N/A"}
- Filial: ${dados.filial || "N/A"}
- Gestor imediato: ${dados.gestor_imediato || "N/A"}
- Salário: R$ ${dados.salario ? Number(dados.salario).toFixed(2).replace(".", ",") : "N/A"}
- Jornada: ${dados.jornada_trabalho || "44 horas semanais"}
- Data de admissão: ${dados.data_admissao}

DADOS DA EMPRESA:
- Razão social: ${dados.empresa_razao_social || "EMPRESA CONTRATANTE"}
- CNPJ: ${dados.empresa_cnpj || "N/A"}
- Endereço: ${dados.empresa_endereco || "N/A"}
`;

  const clausulaInfo = dados.clausula_assecuratoria
    ? "O contrato POSSUI cláusula assecuratória do direito recíproco de rescisão antecipada (art. 481 CLT)."
    : "O contrato NÃO possui cláusula assecuratória. Rescisão antecipada segue art. 479/480 CLT.";

  switch (tipo) {
    case "contrato":
      return `Você é um advogado trabalhista especialista em CLT. Gere um CONTRATO DE TRABALHO POR EXPERIÊNCIA completo, profissional e juridicamente correto em HTML.

${base}

DADOS DO PERÍODO DE EXPERIÊNCIA:
- Duração do 1º período: ${dados.duracao_primeiro_periodo} dias
- Data fim do 1º período: ${dados.data_fim_primeiro_periodo}
- ${clausulaInfo}

INSTRUÇÕES OBRIGATÓRIAS:
1. O contrato deve conter:
   - Identificação completa das partes (empregador e empregado)
   - Objeto do contrato (contratação por experiência – art. 443 e 445 CLT)
   - Função/cargo e descrição sumária das atividades
   - Local de trabalho
   - Jornada de trabalho
   - Remuneração e forma de pagamento
   - Prazo determinado do contrato de experiência com datas precisas
   - Possibilidade de prorrogação (uma única vez, dentro do limite de 90 dias)
   ${dados.clausula_assecuratoria ? "- Cláusula assecuratória do direito recíproco de rescisão antecipada (art. 481 CLT)" : "- Regras de rescisão antecipada (art. 479 e 480 CLT)"}
   - Obrigações do empregado (sigilo, regulamento interno, etc.)
   - Disposições gerais
   - Local, data e espaço para assinaturas (empregador, empregado, testemunhas)
2. Numere as cláusulas
3. Use linguagem jurídica formal e precisa
4. Cite os artigos da CLT relevantes`;

    case "prorrogacao":
      return `Você é um advogado trabalhista especialista em CLT. Gere um TERMO ADITIVO DE PRORROGAÇÃO DE CONTRATO DE EXPERIÊNCIA completo em HTML.

${base}

DADOS DA PRORROGAÇÃO:
- 1º período: ${dados.duracao_primeiro_periodo} dias (até ${dados.data_fim_primeiro_periodo})
- Prorrogação: ${dados.duracao_prorrogacao} dias
- Início prorrogação: ${dados.data_inicio_prorrogacao}
- Fim prorrogação: ${dados.data_fim_prorrogacao}
- Total: ${dados.duracao_primeiro_periodo + dados.duracao_prorrogacao} dias
- ${clausulaInfo}

INSTRUÇÕES OBRIGATÓRIAS:
1. O termo deve conter:
   - Referência ao contrato de experiência original
   - Identificação das partes
   - Cláusula de prorrogação com datas precisas (início e fim do novo período)
   - Menção ao art. 445 CLT (limite de 90 dias e uma única prorrogação)
   - Manutenção de todas as demais condições do contrato original
   - Local, data e espaço para assinaturas
2. Deve ser conciso (termo aditivo, não contrato novo)`;

    case "efetivacao":
      return `Você é um advogado trabalhista especialista em CLT. Gere um TERMO DE EFETIVAÇÃO / TRANSFORMAÇÃO DO CONTRATO DE EXPERIÊNCIA EM PRAZO INDETERMINADO completo em HTML.

${base}

DADOS DA EFETIVAÇÃO:
- Período total de experiência: ${dados.duracao_total || dados.duracao_primeiro_periodo} dias
- ${dados.prorrogado ? `Foi prorrogado: ${dados.duracao_prorrogacao} dias (até ${dados.data_fim_prorrogacao})` : "Não houve prorrogação"}
- Data da efetivação: ${dados.data_efetivacao}
- Efetivado por: ${dados.efetivado_por_nome || "N/A"}

INSTRUÇÕES OBRIGATÓRIAS:
1. O termo deve conter:
   - Referência ao contrato de experiência original e período cumprido
   - Declaração de que o contrato passa a vigorar por prazo indeterminado a partir da data de efetivação
   - Manutenção do cargo, salário e demais condições
   - Contagem do tempo de serviço desde a admissão original
   - Local, data e espaço para assinaturas`;

    case "rescisao":
      const tiposLabel: Record<string, string> = {
        termino_normal: "Término normal do contrato de experiência",
        rescisao_antecipada_empregador: "Rescisão antecipada pelo empregador",
        rescisao_antecipada_empregado: "Rescisão antecipada pelo empregado",
      };
      return `Você é um advogado trabalhista especialista em CLT. Gere um TERMO DE RESCISÃO DO CONTRATO DE EXPERIÊNCIA completo em HTML.

${base}

DADOS DA RESCISÃO:
- Tipo: ${tiposLabel[dados.tipo_encerramento] || dados.tipo_encerramento}
- Data de encerramento: ${dados.data_encerramento}
- Motivo: ${dados.motivo_encerramento || "N/A"}
- ${clausulaInfo}
- Período total trabalhado: ${dados.duracao_total || dados.duracao_primeiro_periodo} dias
- ${dados.prorrogado ? `Prorrogado por ${dados.duracao_prorrogacao} dias` : "Sem prorrogação"}

INSTRUÇÕES OBRIGATÓRIAS:
1. O termo deve conter:
   - Identificação das partes
   - Referência ao contrato original
   - Tipo de rescisão e fundamentação legal
   ${dados.tipo_encerramento === "termino_normal" ? "- Art. 443 e 479 CLT – término normal" : ""}
   ${dados.tipo_encerramento === "rescisao_antecipada_empregador" && !dados.clausula_assecuratoria ? "- Indenização de metade dos dias restantes (art. 479 CLT)" : ""}
   ${dados.tipo_encerramento === "rescisao_antecipada_empregado" && !dados.clausula_assecuratoria ? "- Possível indenização ao empregador (art. 480 CLT)" : ""}
   ${dados.clausula_assecuratoria ? "- Aplicação das regras de aviso prévio como contrato indeterminado (art. 481 CLT)" : ""}
   - Verbas rescisórias devidas (saldo salário, 13º proporcional, férias proporcionais + 1/3)
   - Data e local, espaço para assinaturas
2. Seja preciso nas referências legais`;

    default:
      throw new Error(`Tipo de documento não suportado: ${tipo}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tipo, dados } = await req.json();

    if (!tipo || !dados) {
      return new Response(JSON.stringify({ error: "Campos 'tipo' e 'dados' são obrigatórios." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = buildPrompt(tipo as TipoDocumento, dados);

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
          {
            role: "system",
            content: `Você é um advogado trabalhista e designer de documentos jurídicos. Gere APENAS HTML completo e profissional para documentos trabalhistas. 

REGRAS DE FORMATAÇÃO HTML:
- Use CSS inline em cada elemento
- Paleta: primário #1e3a5f, secundário #2d8a6e, accent #c9a84c, fundo #f8f9fa, texto #1a1a2e
- Fonte: font-family: 'Georgia', 'Times New Roman', serif para corpo; 'Segoe UI', sans-serif para cabeçalhos
- Estilo de documento jurídico formal: margens amplas, espaçamento 1.5, cláusulas numeradas
- Cabeçalho com logo placeholder e dados da empresa
- Rodapé com número de página, confidencialidade e data de geração
- Espaços para assinatura com linhas e nome embaixo
- Use @media print para impressão correta
- HTML SELF-CONTAINED (sem referências externas)
- Comece com <!DOCTYPE html>
- Nunca inclua markdown, code blocks ou explicações`
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI error:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    let html = data.choices?.[0]?.message?.content?.trim() || "";

    // Clean markdown fences
    if (html.startsWith("```")) {
      html = html.replace(/^```(?:html)?\s*\n?/, "").replace(/\n?\s*```\s*$/, "");
    }

    // Ensure complete HTML document
    if (html && !html.toLowerCase().includes("<!doctype")) {
      html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{margin:40px;padding:0;font-family:Georgia,'Times New Roman',serif;line-height:1.6;color:#1a1a2e;}</style></head><body>${html}</body></html>`;
    }

    if (html && !html.toLowerCase().includes("viewport")) {
      html = html.replace(/<head>/i, '<head><meta name="viewport" content="width=device-width, initial-scale=1.0">');
    }

    const tipoLabels: Record<string, string> = {
      contrato: "Contrato de Experiência",
      prorrogacao: "Termo de Prorrogação",
      efetivacao: "Termo de Efetivação",
      rescisao: "Termo de Rescisão",
    };

    return new Response(JSON.stringify({ 
      html,
      tipo,
      titulo: tipoLabels[tipo] || tipo,
    }), {
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
