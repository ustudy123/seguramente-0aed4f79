import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

    // Extract auth token to download file from storage
    const authHeader = req.headers.get("Authorization");

    let pdfBase64: string | null = null;

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
          const uint8Array = new Uint8Array(arrayBuffer);
          // Manual base64 encoding for Deno
          let binary = "";
          for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }
          pdfBase64 = btoa(binary);
          console.log(`PDF baixado com sucesso: ${(uint8Array.length / 1024 / 1024).toFixed(2)} MB`);
        }
      } catch (downloadErr) {
        console.error("Erro ao processar arquivo:", downloadErr);
      }
    }

    const contextoProfissional = [
      empresa_emissora ? `Empresa Emissora: ${empresa_emissora}` : "",
      profissional_responsavel ? `Profissional Responsável: ${profissional_responsavel}` : "",
    ].filter(Boolean).join("\n");

    const systemPrompt = `Você é um Auditor Técnico Sênior em Saúde e Segurança do Trabalho (SST), com mais de 20 anos de experiência em auditoria de conformidade, especialista em legislação trabalhista brasileira, normas regulamentadoras (NRs), legislação previdenciária (Lei 8.213/91, Decreto 3.048/99), eSocial e jurisprudência do TST.

Você está realizando uma AUDITORIA TÉCNICA COMPLETA do documento: **${documento_tipo}** — "${documento_nome}"
${contextoProfissional ? `\n${contextoProfissional}` : ""}

## INSTRUÇÕES CRÍTICAS

${pdfBase64 ? "O CONTEÚDO COMPLETO DO DOCUMENTO FOI ANEXADO. Você DEVE ler e analisar CADA PÁGINA do documento. Extraia TODOS os dados reais presentes: nomes, datas, riscos, funções, setores, exames, medidas de controle, etc. NÃO invente dados. Use EXCLUSIVAMENTE o que está no documento." : "O conteúdo do documento não pôde ser carregado. Gere uma análise baseada no tipo de documento e nas NRs aplicáveis, indicando claramente quais itens precisam ser verificados manualmente."}

Produza um **Relatório Técnico de Auditoria de Conformidade SST** completo, detalhado e profissional.

### ESTRUTURA OBRIGATÓRIA DO RELATÓRIO:

---

# 📋 RELATÓRIO DE AUDITORIA DE CONFORMIDADE SST

**Documento Auditado:** ${documento_tipo}  
**Arquivo:** ${documento_nome}  
${empresa_emissora ? `**Empresa:** ${empresa_emissora}` : ""}  
${profissional_responsavel ? `**Profissional Responsável:** ${profissional_responsavel}` : ""}  
**Data da Auditoria:** ${new Date().toLocaleDateString("pt-BR")}

---

## 1. SUMÁRIO EXECUTIVO
- Visão geral do documento analisado
- Nível geral de conformidade: ✅ Conforme | ⚠️ Parcialmente Conforme | ❌ Não Conforme
- Quantidade de alertas por severidade
- Principais achados

## 2. IDENTIFICAÇÃO E ESCOPO DO DOCUMENTO
- Tipo e finalidade legal do documento
- NRs diretamente aplicáveis (cite artigos e itens específicos)
- Periodicidade legal de revisão/atualização
- Validade e vigência

## 3. DADOS EXTRAÍDOS DO DOCUMENTO
${pdfBase64 ? "Liste TODOS os dados reais encontrados:" : "Indique quais dados devem constar:"}
- CNPJ, Razão Social, endereço
- Profissional responsável (nome, registro, habilitação)
- Data de elaboração e validade
- Funções/cargos identificados
- Setores de trabalho
- Número de trabalhadores expostos (se constar)

## 4. INVENTÁRIO DE RISCOS IDENTIFICADOS
Para cada risco encontrado no documento, detalhe:

### 4.1 Riscos Físicos
| Agente | Setor/Função | Fonte Geradora | Intensidade/Nível | NR Aplicável | Medida de Controle |
|---|---|---|---|---|---|

### 4.2 Riscos Químicos
| Agente | Setor/Função | Forma de Exposição | Limite Tolerância | NR Aplicável | Medida de Controle |
|---|---|---|---|---|---|

### 4.3 Riscos Biológicos
| Agente | Setor/Função | Via de Transmissão | Classificação | NR Aplicável | Medida de Controle |
|---|---|---|---|---|---|

### 4.4 Riscos Ergonômicos
| Fator | Setor/Função | Descrição | Grau | NR-17 Item | Medida de Controle |
|---|---|---|---|---|---|

### 4.5 Riscos de Acidentes
| Fator | Setor/Função | Descrição | Probabilidade | NR Aplicável | Medida de Controle |
|---|---|---|---|---|---|

## 5. ANÁLISE DE CONFORMIDADE POR NORMA REGULAMENTADORA

Para CADA NR aplicável ao documento, analise:

### NR-XX — [Nome da NR]
| Item Normativo | Requisito | Status | Evidência no Documento | Observação |
|---|---|---|---|---|
| X.X.X | [descrição] | ✅/⚠️/❌ | [trecho ou referência] | [detalhe] |

**NRs que devem ser obrigatoriamente analisadas conforme o tipo de documento:**
- PGR: NR-01 (GRO/PGR), NR-09, NR-15, NR-16, e NRs específicas por atividade
- PCMSO: NR-07, NR-09 (correlação com PGR), NR-15, NR-17
- LTCAT: NR-15, NR-16, IN PRES/INSS 128/2022, Decreto 3.048/99
- AEP/AET: NR-17
- PPP: NR-01, NR-07, NR-09, NR-15, IN PRES/INSS 128/2022

## 6. COERÊNCIA ENTRE DOCUMENTOS SST
- Riscos do PGR vs exames do PCMSO (correlação)
- Agentes do LTCAT vs medidas do PGR
- EPI indicado vs CA e adequação ao risco
- Treinamentos exigidos vs realizados
- Divergências identificadas entre documentos

## 7. EXAMES OCUPACIONAIS E TREINAMENTOS
### 7.1 Exames Obrigatórios
| Função | Risco | Exame Exigido | Periodicidade | Base Legal | Status |
|---|---|---|---|---|---|

### 7.2 Treinamentos Obrigatórios
| NR | Treinamento | Carga Horária | Periodicidade | Público-Alvo | Status |
|---|---|---|---|---|---|

## 8. ALERTAS DE CONFORMIDADE

Classifique CADA alerta encontrado:

### 🔴 ALERTAS CRÍTICOS (Risco Legal/Previdenciário Imediato)
Para cada alerta:
- **Descrição:** [problema objetivo]
- **Norma Violada:** [NR-XX, item X.X.X]
- **Fundamentação Legal:** [artigo/lei/decreto]
- **Impacto:** [multa estimada, passivo trabalhista, interdição]
- **Ação Corretiva:** [o que fazer]
- **Prazo Sugerido:** [imediato/30 dias/60 dias]
- **Responsável Sugerido:** [cargo/função]

### 🟠 ALERTAS TÉCNICOS (Inconsistências e Lacunas)
[mesma estrutura acima]

### 🟡 PONTOS DE ATENÇÃO (Acompanhamento)
[mesma estrutura acima]

## 9. OBRIGAÇÕES eSocial RELACIONADAS
| Evento | Descrição | Prazo | Dados Necessários | Status |
|---|---|---|---|---|
| S-2210 | CAT | [prazo] | [dados] | [status] |
| S-2220 | ASO | [prazo] | [dados] | [status] |
| S-2240 | Condições Ambientais | [prazo] | [dados] | [status] |

## 10. MATRIZ DE AÇÕES CORRETIVAS PRIORITÁRIAS
| # | Ação | Prioridade | Prazo | Responsável | NR Base | Custo Estimado |
|---|---|---|---|---|---|---|
| 1 | [ação] | 🔴 Crítica | [prazo] | [cargo] | [NR] | [estimativa] |

## 11. CONCLUSÃO E PARECER TÉCNICO
- Resumo do nível de conformidade geral
- Principais riscos identificados
- Recomendações prioritárias (Top 5)
- Próximos passos sugeridos
- Prazo para próxima revisão do documento

---

⚠️ **AVISO LEGAL:** Este relatório foi gerado por inteligência artificial como ferramenta auxiliar de auditoria de conformidade. Não substitui a análise, parecer e responsabilidade técnica de profissionais legalmente habilitados (Engenheiro de Segurança do Trabalho, Médico do Trabalho, Técnico de Segurança do Trabalho). As conclusões apresentadas devem ser validadas por profissional competente antes de qualquer ação.

---

## REGRAS DE QUALIDADE:
1. Cite SEMPRE os números das NRs e seus itens específicos (ex: NR-07, item 7.5.8)
2. ${pdfBase64 ? "Use EXCLUSIVAMENTE dados reais do documento. NÃO invente informações." : "Indique claramente quando um item precisa de verificação manual."}
3. Diferencie entre obrigações do empregador, do trabalhador e do profissional de SST
4. Considere legislação atualizada: CLT, Lei 8.213/91, Decreto 3.048/99, Portarias do MTE
5. Tabelas DEVEM conter dados concretos, não genéricos
6. Cada alerta DEVE ter fundamentação legal específica
7. Use linguagem técnica, objetiva e profissional
8. O relatório deve ser extenso e detalhado — mínimo 2000 palavras
9. Responda SEMPRE em português brasileiro`;

    // Build messages with or without PDF content
    const userContent: any[] = [];

    if (pdfBase64) {
      userContent.push({
        type: "file",
        file: {
          filename: documento_nome || "documento.pdf",
          file_data: `data:application/pdf;base64,${pdfBase64}`,
        },
      });
    }

    userContent.push({
      type: "text",
      text: pdfBase64
        ? `Realize a auditoria técnica completa deste documento ${documento_tipo}. Leia TODAS as páginas do PDF anexado. Extraia TODOS os dados reais (funções, setores, riscos, agentes, medidas de controle, exames, profissionais, datas, etc.) e produza o relatório de conformidade SST completo e detalhado conforme a estrutura definida, analisando item a item das NRs aplicáveis.`
        : `Realize a auditoria de conformidade do documento "${documento_nome}" do tipo ${documento_tipo}. ${contextoProfissional ? `Informações adicionais: ${contextoProfissional}.` : ""} Como o PDF não pôde ser carregado, gere o relatório baseado no tipo do documento e nas NRs aplicáveis, sinalizando os itens que precisam ser verificados manualmente.`,
    });

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ];

    console.log(`Enviando para OpenAI. PDF anexado: ${!!pdfBase64}. Tipo: ${documento_tipo}`);

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
        temperature: 0.2,
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

      return new Response(JSON.stringify({ error: `Erro na API OpenAI: ${t}` }), {
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
