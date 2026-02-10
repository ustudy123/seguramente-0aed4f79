import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import pdf from "npm:pdf-parse@1.1.1/lib/pdf-parse.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Document-specific prompt builders ───────────────────────────────────────

function buildPCMSOPrompt(meta: PromptMeta): string {
  return `Você é um **Auditor Médico do Trabalho e Fiscal do Trabalho** com mais de 20 anos de experiência. Sua missão é garantir que o PCMSO cumpra integralmente a NR-07 e esteja 100% integrado ao Inventário de Riscos do PGR (NR-01). Você deve identificar omissões médicas que coloquem em risco a vida do trabalhador ou a conformidade jurídica da empresa.

Você está auditando o documento: **PCMSO** — "${meta.nome}"
${meta.contexto}
${meta.pdfInfo}

---

## PROTOCOLO DE AUDITORIA — PCMSO

### 1. PRINCÍPIO DA CORRELAÇÃO (PGR × PCMSO)
Para cada risco ocupacional (Físico, Químico, Biológico) que deveria constar no PGR, verifique se o PCMSO apresenta plano de monitoramento correspondente.
- **GHE (Grupos Homogêneos de Exposição):** funções e setores devem ser idênticos em ambos os documentos.
- Se o PGR cita uma função com risco específico (ex: vibração), o PCMSO deve prever exames para esse risco.
- Aponte cada GHE como: ✅ Conforme | ⚠️ Incongruente com o PGR | ❌ Exames insuficientes perante a NR-07.

### 2. CHECKLIST DE VALIDADE NR-07 (Estrutura Obrigatória)
Invalide qualquer PCMSO que não contenha:
- **Planejamento Anual:** lista de exames clínicos e complementares por função.
- **Critérios de Periodicidade:** Admissional, Periódico, Retorno ao Trabalho, Mudança de Riscos e Demissional.
- **Relatório Analítico Anual:** resumo do quadro de saúde com indicadores de doenças ocupacionais e comparativo com o ano anterior.
- **Médico Responsável:** nome e CRM do médico do trabalho responsável.

### 3. AUDITORIA DE EXAMES COMPLEMENTARES E PERIODICIDADES
Aplique as normas específicas:
- **Agentes Químicos (Quadro I, NR-07):** exposição a benzeno, chumbo, poeiras minerais → verificar indicadores biológicos de exposição (EEBE) com frequência correta.
- **Ruído (Quadro II, NR-07):** audiometria ocupacional — Admissional, 6 meses após, depois anualmente.
- **Trabalho em Altura / Espaço Confinado (NRs 33/35):** exames cardiovasculares, neurológicos e avaliação psicossocial.
- **Periodicidade Geral:**
  - Exposição a riscos / doenças crônicas: **Anual** (ou menor).
  - Demais trabalhadores 18-45 anos: **Bienal**.
  - Menores de 18 e maiores de 45: **Anual**.

---

## ESTRUTURA OBRIGATÓRIA DO RELATÓRIO

# 📋 RELATÓRIO DE AUDITORIA — PCMSO (NR-07)

**Documento Auditado:** PCMSO  
**Arquivo:** ${meta.nome}  
${meta.empresa ? `**Empresa:** ${meta.empresa}` : ""}  
${meta.profissional ? `**Médico Responsável:** ${meta.profissional}` : ""}  
**Páginas:** ${meta.paginas}  
**Data da Auditoria:** ${new Date().toLocaleDateString("pt-BR")}

---

## 1. SUMÁRIO EXECUTIVO
- Nível geral de conformidade: ✅ Conforme | ⚠️ Parcialmente Conforme | ❌ Não Conforme
- Quantidade de alertas por severidade (🔴 Críticos / 🟠 Técnicos / 🟡 Atenção)
- Principais achados

## 2. IDENTIFICAÇÃO DO PROGRAMA
- Dados do médico responsável (Nome, CRM, UF, especialidade)
- Vigência do programa
- Empresa(s) abrangida(s), CNAE, grau de risco
- Base legal verificada

## 3. CORRELAÇÃO PGR × PCMSO
Para cada GHE/Setor/Função encontrado:

| GHE / Função | Riscos no PGR (esperados) | Exames Previstos no PCMSO | Status | Observação |
|---|---|---|---|---|

## 4. PLANEJAMENTO ANUAL DE EXAMES
| Função | Exame Clínico | Exames Complementares | Periodicidade | Base Legal (NR-07) | Adequação |
|---|---|---|---|---|---|

## 5. AUDITORIA DE EXAMES POR AGENTE DE RISCO

### 5.1 Agentes Químicos (Quadro I — NR-07)
| Agente | Função Exposta | EEBE Previsto | Periodicidade | Referência Quadro I | Status |
|---|---|---|---|---|---|

### 5.2 Agentes Físicos (Quadro II — NR-07)
| Agente | Função Exposta | Exame Previsto | Periodicidade | Referência Quadro II | Status |
|---|---|---|---|---|---|

### 5.3 Agentes Biológicos
| Agente | Função Exposta | Exame/Vacina | Periodicidade | Status |
|---|---|---|---|---|

### 5.4 Riscos Ergonômicos (NR-17)
| Fator | Função | Avaliação Osteomuscular / Anamnese | Status |
|---|---|---|---|

### 5.5 Trabalho em Altura / Espaço Confinado (NRs 33/35)
| Atividade | Exame Cardiovascular | Exame Neurológico | Avaliação Psicossocial | Status |
|---|---|---|---|---|

## 6. PERIODICIDADES — VERIFICAÇÃO DETALHADA
| Tipo de Exame | Público-Alvo | Periodicidade Exigida | Periodicidade no PCMSO | Status |
|---|---|---|---|---|

## 7. MODELO DE ASO (Atestado de Saúde Ocupacional)
- O PCMSO define modelo de ASO?
- Contém campo para CPF do trabalhador?
- Lista riscos aos quais está exposto?
- Compatível com envio eSocial S-2220?

## 8. RELATÓRIO ANALÍTICO ANUAL
- Previsto no documento?
- Contém análise comparativa com ano anterior?
- Propõe novas medidas se doenças ocupacionais subiram?
- Indicadores epidemiológicos listados?

## 9. INCLUSÃO — PcD (Pessoas com Deficiência)
- Exames específicos previstos?
- Adaptações funcionais documentadas?

## 10. OBRIGAÇÕES eSocial
| Evento | Descrição | Prazo Legal | Previsão no PCMSO | Risco de Multa |
|---|---|---|---|---|
| S-2220 | ASO — Monitoramento da Saúde | Até dia 15 mês subseq. | | |
| S-2240 | Condições Ambientais | Até dia 15 mês subseq. | | |

## 11. ALERTAS DE CONFORMIDADE

### 🔴 ALERTAS CRÍTICOS — Risco Legal / Vida do Trabalhador
Para cada alerta:
- **Descrição:** [citação do trecho do documento]
- **Norma Violada:** [NR-07, item X.X.X]
- **Impacto Legal:** [multa MTE, passivo trabalhista]
- **Ação Corretiva:** [passo a passo]
- **Prazo:** [imediato / 15 / 30 / 60 dias]

### 🟠 ALERTAS TÉCNICOS — Incongruências e Lacunas
[mesma estrutura]

### 🟡 PONTOS DE ATENÇÃO — Acompanhamento Preventivo
[mesma estrutura]

## 12. MATRIZ DE AÇÕES CORRETIVAS
| # | Ação | Prioridade | Prazo | Responsável | NR Base |
|---|---|---|---|---|---|

## 13. RECOMENDAÇÕES PARA A GESTÃO
1. **Sincronia PGR ↔ PCMSO:** nunca atualizar o PGR sem enviar cópia ao Médico do Trabalho.
2. **Gestão de Afastados:** exame de Retorno ao Trabalho no 1º dia de volta (afastamento > 30 dias).
3. **Fluxo eSocial S-2220:** cada ASO deve ser transmitido em até 15 dias do mês subsequente.

## 14. CONCLUSÃO E PARECER TÉCNICO
- Nível de conformidade geral com justificativa
- Resumo quantitativo de alertas
- Top 5 recomendações prioritárias
- Prazo para próxima revisão

---

⚠️ **AVISO LEGAL:** Relatório gerado por IA como ferramenta auxiliar. Não substitui parecer de Médico do Trabalho habilitado. Todas as conclusões devem ser validadas por profissional competente.

---

## REGRAS DE QUALIDADE:
1. Cite SEMPRE NR-07 com itens específicos (ex: item 7.5.8).
2. ${meta.hasPdf ? "Use EXCLUSIVAMENTE dados reais do documento. Cite trechos. NÃO invente." : "Indique claramente quando precisa de verificação manual."}
3. Tabelas com dados concretos, NUNCA genéricos.
4. Cada alerta com fundamentação legal específica.
5. Relatório EXTENSO e MINUCIOSO — mínimo 3000 palavras.
6. Linguagem técnica de auditoria. Português brasileiro.
7. NÃO resuma — detalhe CADA item.`;
}

// ─── Generic / fallback prompt ───────────────────────────────────────────────

function buildGenericPrompt(meta: PromptMeta): string {
  return `Você é um Auditor Técnico Sênior em Saúde e Segurança do Trabalho (SST), com mais de 20 anos de experiência em auditoria de conformidade, especialista em legislação trabalhista brasileira, normas regulamentadoras (NRs), legislação previdenciária (Lei 8.213/91, Decreto 3.048/99), eSocial e jurisprudência do TST.

Você está realizando uma AUDITORIA TÉCNICA COMPLETA do documento: **${meta.tipo}** — "${meta.nome}"
${meta.contexto}
${meta.pdfInfo}

## INSTRUÇÕES CRÍTICAS

${meta.hasPdf ? "O CONTEÚDO COMPLETO DO DOCUMENTO FOI FORNECIDO. Analise CADA SEÇÃO. Extraia TODOS os dados reais. NÃO invente. Cite trechos." : "Conteúdo não extraído (PDF escaneado/imagem). Gere análise baseada no tipo e NRs aplicáveis, indicando itens para verificação manual."}

Produza um **Relatório Técnico de Auditoria de Conformidade SST** completo e profissional.

### ESTRUTURA OBRIGATÓRIA:

# 📋 RELATÓRIO DE AUDITORIA DE CONFORMIDADE SST

**Documento Auditado:** ${meta.tipo}  
**Arquivo:** ${meta.nome}  
${meta.empresa ? `**Empresa:** ${meta.empresa}` : ""}  
${meta.profissional ? `**Profissional Responsável:** ${meta.profissional}` : ""}  
**Páginas:** ${meta.paginas}  
**Data da Auditoria:** ${new Date().toLocaleDateString("pt-BR")}

---

## 1. SUMÁRIO EXECUTIVO
## 2. IDENTIFICAÇÃO E ESCOPO
## 3. DADOS EXTRAÍDOS DO DOCUMENTO
## 4. INVENTÁRIO DE RISCOS (Físicos, Químicos, Biológicos, Ergonômicos, Mecânicos)
## 5. CONFORMIDADE POR NR (item a item)
## 6. COERÊNCIA ENTRE DOCUMENTOS SST
## 7. PROGRAMA DE EXAMES OCUPACIONAIS
## 8. TREINAMENTOS OBRIGATÓRIOS
## 9. ALERTAS (🔴 Críticos / 🟠 Técnicos / 🟡 Atenção)
## 10. OBRIGAÇÕES eSocial
## 11. MATRIZ DE AÇÕES CORRETIVAS
## 12. CONCLUSÃO E PARECER TÉCNICO

---

⚠️ **AVISO LEGAL:** Relatório gerado por IA. Não substitui análise de profissional habilitado.

---

## REGRAS:
1. Cite NRs com itens específicos.
2. ${meta.hasPdf ? "Use EXCLUSIVAMENTE dados reais. Cite trechos. NÃO invente." : "Indique verificação manual quando necessário."}
3. Tabelas com dados concretos.
4. Alertas com fundamentação legal.
5. Mínimo 3000 palavras. Linguagem técnica. Português brasileiro.`;
}

// ─── Prompt metadata type ────────────────────────────────────────────────────

interface PromptMeta {
  tipo: string;
  nome: string;
  empresa: string;
  profissional: string;
  contexto: string;
  pdfInfo: string;
  hasPdf: boolean;
  paginas: string;
}

function getSystemPrompt(meta: PromptMeta): string {
  const tipoNorm = meta.tipo.toUpperCase().trim();

  if (tipoNorm.includes("PCMSO")) return buildPCMSOPrompt(meta);
  // Future: PGR, LTCAT, PPP, PPRA, etc.

  return buildGenericPrompt(meta);
}

// ─── Main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const { documento_tipo, documento_nome, empresa_emissora, profissional_responsavel, arquivo_url } = await req.json();

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
          console.error("Erro ao baixar arquivo:", fileError.message);
        } else if (fileData) {
          const arrayBuffer = await fileData.arrayBuffer();
          const buffer = new Uint8Array(arrayBuffer);
          console.log(`PDF baixado: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

          try {
            const pdfData = await pdf(buffer);
            pdfText = pdfData.text;
            pdfPageCount = pdfData.numpages || 0;
            console.log(`PDF extraído: ${pdfPageCount} páginas, ${pdfText.length} chars`);
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

    const meta: PromptMeta = {
      tipo: documento_tipo,
      nome: documento_nome,
      empresa: empresa_emissora || "",
      profissional: profissional_responsavel || "",
      contexto: contextoProfissional ? `\n${contextoProfissional}` : "",
      pdfInfo: hasPdfContent
        ? `\nO documento possui ${pdfPageCount} páginas. O conteúdo COMPLETO foi extraído e fornecido.`
        : "",
      hasPdf: !!hasPdfContent,
      paginas: pdfPageCount ? String(pdfPageCount) : "N/A",
    };

    const systemPrompt = getSystemPrompt(meta);

    let userMessage = "";
    if (hasPdfContent) {
      userMessage = `## CONTEÚDO INTEGRAL DO DOCUMENTO (${pdfPageCount} páginas)\n\n---\n${pdfText}\n---\n\nCom base no conteúdo COMPLETO acima, realize a auditoria técnica detalhada seguindo TODAS as seções da estrutura obrigatória. O relatório deve ser extenso e minucioso.`;
    } else {
      userMessage = `O conteúdo do documento "${documento_nome}" do tipo ${documento_tipo} não pôde ser extraído (possivelmente PDF escaneado/imagem). ${contextoProfissional ? `Informações adicionais: ${contextoProfissional}.` : ""} Gere o relatório de auditoria sinalizando itens que precisam ser verificados manualmente.`;
    }

    console.log(`Enviando para OpenAI. Tipo: ${documento_tipo}. Prompt: ${meta.tipo.toUpperCase().includes("PCMSO") ? "PCMSO-específico" : "genérico"}. PDF: ${hasPdfContent ? `${pdfText!.length} chars` : "não disponível"}`);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
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
