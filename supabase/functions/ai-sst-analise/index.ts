import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import pdf from "npm:pdf-parse@1.1.1/lib/pdf-parse.js";

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

    const { documento_tipo, documento_nome, empresa_emissora, profissional_responsavel, arquivo_url, action } = await req.json();

    let pdfText: string | null = null;
    let pdfPageCount = 0;

    if (arquivo_url) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

        const { data: fileData, error: fileError } = await supabaseAdmin.storage
          .from("documentos")
          .download(arquivo_url);

        if (fileError) {
          console.error("Erro ao baixar arquivo do storage:", fileError.message);
        } else if (fileData) {
          const arrayBuffer = await fileData.arrayBuffer();
          const buffer = new Uint8Array(arrayBuffer);
          console.log(`PDF baixado: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

          try {
            const pdfData = await pdf(buffer);
            pdfText = pdfData.text;
            pdfPageCount = pdfData.numpages || 0;
            console.log(`PDF extraído com sucesso: ${pdfPageCount} páginas, ${pdfText.length} caracteres`);
          } catch (pdfErr) {
            console.error("Erro ao extrair texto do PDF:", pdfErr);
          }
        }
      } catch (downloadErr) {
        console.error("Erro ao processar arquivo:", downloadErr);
      }
    }

    const hasPdfContent = pdfText && pdfText.trim().length > 100;

    const contextoProfissional = [
      empresa_emissora ? `Empresa Emissora: ${empresa_emissora}` : "",
      profissional_responsavel ? `Profissional Responsável: ${profissional_responsavel}` : "",
    ].filter(Boolean).join("\n");

    const systemPrompt = `Você é um Auditor Técnico Sênior em Saúde e Segurança do Trabalho (SST), com mais de 20 anos de experiência em auditoria de conformidade, especialista em legislação trabalhista brasileira, normas regulamentadoras (NRs), legislação previdenciária (Lei 8.213/91, Decreto 3.048/99), eSocial e jurisprudência do TST.

Você está realizando uma AUDITORIA TÉCNICA COMPLETA do documento: **${documento_tipo}** — "${documento_nome}"
${contextoProfissional ? `\n${contextoProfissional}` : ""}
${hasPdfContent ? `\nO documento possui ${pdfPageCount} páginas. O conteúdo COMPLETO do documento foi extraído e fornecido abaixo.` : ""}

## INSTRUÇÕES CRÍTICAS

${hasPdfContent ? "O CONTEÚDO COMPLETO DO DOCUMENTO FOI FORNECIDO. Você DEVE analisar CADA SEÇÃO do documento. Extraia TODOS os dados reais presentes: nomes de profissionais, registros (CRM, CREA), datas, funções/cargos listados, setores, riscos identificados, agentes nocivos, medidas de controle, exames previstos, EPIs indicados, etc. NÃO invente dados. Use EXCLUSIVAMENTE o que está no documento. Cite trechos específicos do documento quando relevante." : "O conteúdo do documento não pôde ser extraído (pode ser um PDF escaneado/imagem). Gere uma análise baseada no tipo de documento e nas NRs aplicáveis, indicando claramente quais itens precisam ser verificados manualmente."}

Produza um **Relatório Técnico de Auditoria de Conformidade SST** completo, detalhado e profissional. O relatório deve ser EXTENSO e MINUCIOSO.

### ESTRUTURA OBRIGATÓRIA DO RELATÓRIO:

---

# 📋 RELATÓRIO DE AUDITORIA DE CONFORMIDADE SST

**Documento Auditado:** ${documento_tipo}  
**Arquivo:** ${documento_nome}  
${empresa_emissora ? `**Empresa:** ${empresa_emissora}` : ""}  
${profissional_responsavel ? `**Profissional Responsável:** ${profissional_responsavel}` : ""}  
**Páginas do Documento:** ${pdfPageCount || "N/A"}  
**Data da Auditoria:** ${new Date().toLocaleDateString("pt-BR")}

---

## 1. SUMÁRIO EXECUTIVO
- Visão geral do documento analisado com dados reais extraídos
- Nível geral de conformidade: ✅ Conforme | ⚠️ Parcialmente Conforme | ❌ Não Conforme
- Quantidade de alertas por severidade (🔴 Críticos / 🟠 Técnicos / 🟡 Atenção)
- Principais achados positivos e negativos

## 2. IDENTIFICAÇÃO E ESCOPO DO DOCUMENTO
- Dados de identificação extraídos do documento (CNPJ, razão social, endereço, CNAE)
- Profissional responsável pela elaboração (nome, registro profissional, habilitação)
- Data de elaboração, validade e periodicidade de revisão conforme legislação
- NRs diretamente aplicáveis (cite artigos e itens específicos)
- Escopo declarado no documento vs escopo exigido pela legislação

## 3. DADOS DETALHADOS EXTRAÍDOS DO DOCUMENTO
${hasPdfContent ? "Transcreva e organize TODOS os dados relevantes encontrados:" : "Indique quais dados devem constar:"}

### 3.1 Dados da Empresa
- Razão Social, CNPJ, endereço, CNAE, grau de risco
- Número de trabalhadores, turnos de trabalho

### 3.2 Profissionais Envolvidos
- Nome, registro profissional (CRM, CREA, etc.), especialidade
- Habilitação legal para elaboração do documento

### 3.3 Funções e Setores Mapeados
| Setor | Funções | Nº Trabalhadores | Turno |
|---|---|---|---|

### 3.4 Riscos e Agentes Identificados por Setor/Função
Liste DETALHADAMENTE cada risco mencionado no documento.

## 4. INVENTÁRIO COMPLETO DE RISCOS

### 4.1 Riscos Físicos
| Agente | Setor/Função | Fonte Geradora | Intensidade/Nível | Tempo Exposição | Limite NR-15 | Medida de Controle | Adequação |
|---|---|---|---|---|---|---|---|

### 4.2 Riscos Químicos
| Agente | Setor/Função | Via de Absorção | Concentração | LT (NR-15/ACGIH) | EPI Indicado | CA do EPI | Adequação |
|---|---|---|---|---|---|---|---|

### 4.3 Riscos Biológicos
| Agente | Setor/Função | Via de Transmissão | Classificação ANVISA | Medida de Controle | Adequação |
|---|---|---|---|---|---|

### 4.4 Riscos Ergonômicos
| Fator de Risco | Setor/Função | Descrição Detalhada | Metodologia Avaliação | Grau | Item NR-17 | Medida de Controle |
|---|---|---|---|---|---|---|

### 4.5 Riscos de Acidentes (Mecânicos)
| Fator | Setor/Função | Descrição | Probabilidade | Severidade | NR Aplicável | Medida de Controle |
|---|---|---|---|---|---|---|

## 5. ANÁLISE DE CONFORMIDADE POR NORMA REGULAMENTADORA

Analise ITEM A ITEM cada NR aplicável. Para cada uma:

### NR-01 — Disposições Gerais e Gerenciamento de Riscos Ocupacionais (GRO)
| Item | Requisito | Status | Evidência no Documento | Observação |
|---|---|---|---|---|

### NR-07 — PCMSO (se aplicável)
| Item | Requisito | Status | Evidência no Documento | Observação |
|---|---|---|---|---|

### NR-09 — Avaliação e Controle das Exposições Ocupacionais
| Item | Requisito | Status | Evidência no Documento | Observação |
|---|---|---|---|---|

### NR-15 — Atividades e Operações Insalubres (se aplicável)
| Item | Requisito | Status | Evidência no Documento | Observação |
|---|---|---|---|---|

### NR-16 — Atividades e Operações Perigosas (se aplicável)
| Item | Requisito | Status | Evidência no Documento | Observação |
|---|---|---|---|---|

(Inclua TODAS as NRs pertinentes ao tipo de documento e atividade da empresa)

## 6. COERÊNCIA ENTRE DOCUMENTOS SST
- Correlação esperada PGR ↔ PCMSO (riscos vs exames)
- Correlação LTCAT ↔ PGR (agentes nocivos vs medidas)
- EPIs indicados vs CAs e adequação ao risco específico
- Treinamentos exigidos pelas NRs vs previstos no documento
- Divergências e lacunas identificadas

## 7. PROGRAMA DE EXAMES OCUPACIONAIS (se PCMSO ou correlato)
| Função | Riscos Associados | Exame Obrigatório | Base Legal | Periodicidade | Previsto no Doc | Status |
|---|---|---|---|---|---|---|

## 8. PROGRAMA DE TREINAMENTOS OBRIGATÓRIOS
| NR | Treinamento | Carga Horária Mínima | Periodicidade Reciclagem | Público-Alvo | Previsto no Doc | Status |
|---|---|---|---|---|---|---|

## 9. ALERTAS DE CONFORMIDADE

### 🔴 ALERTAS CRÍTICOS — Risco Legal/Previdenciário Imediato
Para cada alerta:
- **Descrição:** [problema objetivo e específico, com citação do trecho do documento]
- **Norma Violada:** [NR-XX, item X.X.X — texto do item]
- **Fundamentação Legal Complementar:** [CLT art. XX / Lei 8.213/91 art. XX / Decreto 3.048/99]
- **Impacto Legal:** [tipo de infração, faixa de multa MTE, risco de interdição, passivo trabalhista]
- **Impacto Previdenciário:** [FAP, RAT, NTEP, estabilidade acidentária]
- **Ação Corretiva Detalhada:** [passo a passo do que fazer]
- **Prazo:** [imediato / 15 dias / 30 dias / 60 dias]
- **Responsável:** [cargo/função responsável pela correção]

### 🟠 ALERTAS TÉCNICOS — Inconsistências e Lacunas Normativas
[mesma estrutura detalhada acima]

### 🟡 PONTOS DE ATENÇÃO — Acompanhamento Preventivo
[mesma estrutura detalhada acima]

## 10. OBRIGAÇÕES eSocial RELACIONADAS
| Evento | Descrição | Prazo Legal | Dados Necessários do Documento | Situação Atual | Risco de Multa |
|---|---|---|---|---|---|
| S-2210 | CAT | Até 1º dia útil | [dados] | [status] | [valor] |
| S-2220 | Monitoramento da Saúde | [prazo] | [dados] | [status] | [valor] |
| S-2240 | Condições Ambientais | Até dia 15 | [dados] | [status] | [valor] |

## 11. MATRIZ DE AÇÕES CORRETIVAS PRIORITÁRIAS
| # | Ação Detalhada | Prioridade | Prazo | Responsável | NR Base | Estimativa de Investimento | Consequência da Omissão |
|---|---|---|---|---|---|---|---|

## 12. CONCLUSÃO E PARECER TÉCNICO
- Nível de conformidade geral com justificativa
- Resumo quantitativo: X alertas críticos, Y técnicos, Z atenção
- Análise qualitativa do documento (completude, profundidade técnica, adequação metodológica)
- Top 5 recomendações prioritárias com justificativa
- Prazo sugerido para próxima revisão do documento
- Considerações finais sobre a gestão de SST da empresa

---

⚠️ **AVISO LEGAL:** Este relatório foi gerado por inteligência artificial como ferramenta auxiliar de auditoria de conformidade. Não substitui a análise, parecer e responsabilidade técnica de profissionais legalmente habilitados (Engenheiro de Segurança do Trabalho, Médico do Trabalho, Técnico de Segurança do Trabalho). Todas as conclusões devem ser validadas por profissional competente.

---

## REGRAS DE QUALIDADE OBRIGATÓRIAS:
1. Cite SEMPRE os números das NRs com itens específicos (ex: NR-07, item 7.5.8)
2. ${hasPdfContent ? "Use EXCLUSIVAMENTE dados reais do documento. Cite trechos. NÃO invente informações." : "Indique claramente quando um item precisa de verificação manual."}
3. TODAS as tabelas devem conter dados concretos e específicos, NUNCA genéricos
4. Cada alerta DEVE ter fundamentação legal com artigo/item específico
5. O relatório deve ser EXTENSO, DETALHADO e PROFISSIONAL — mínimo 3000 palavras
6. Use linguagem técnica de auditoria de conformidade
7. Responda SEMPRE em português brasileiro
8. NÃO resuma ou abrevie seções — detalhe CADA item encontrado no documento`;

    // Build user message
    let userMessage = "";

    if (hasPdfContent) {
      userMessage = `## CONTEÚDO INTEGRAL DO DOCUMENTO (${pdfPageCount} páginas extraídas)

---
${pdfText}
---

Com base no conteúdo COMPLETO do documento acima, realize a auditoria técnica detalhada. Analise CADA seção, CADA risco mencionado, CADA função listada, CADA exame previsto. Produza o relatório de conformidade SST completo seguindo TODAS as 12 seções da estrutura obrigatória. O relatório deve ser extenso e minucioso, cobrindo cada item normativo aplicável.`;
    } else {
      userMessage = `O conteúdo do documento "${documento_nome}" do tipo ${documento_tipo} não pôde ser extraído (possivelmente PDF escaneado/imagem). ${contextoProfissional ? `Informações adicionais: ${contextoProfissional}.` : ""} Gere o relatório de auditoria baseado no tipo do documento e nas NRs aplicáveis, sinalizando todos os itens que precisam ser verificados manualmente no documento físico.`;
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    console.log(`Enviando para OpenAI. Texto do PDF: ${hasPdfContent ? `${pdfText!.length} chars, ${pdfPageCount} páginas` : "não disponível"}. Tipo: ${documento_tipo}`);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        stream: true,
        temperature: 0.15,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("OpenAI API error:", response.status, t);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: `Erro na API OpenAI: ${response.status}` }), {
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
