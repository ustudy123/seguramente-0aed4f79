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
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const { documento_tipo, documento_nome, empresa_emissora, profissional_responsavel, action } = await req.json();

    const contextoProfissional = [
      empresa_emissora ? `Empresa Emissora: ${empresa_emissora}` : "",
      profissional_responsavel ? `Profissional Responsável: ${profissional_responsavel}` : "",
    ].filter(Boolean).join("\n");

    let systemPrompt = "";

    if (action === "analise") {
      systemPrompt = `Você é um Auditor Técnico Sênior em Saúde e Segurança do Trabalho (SST), com especialização em legislação trabalhista, previdenciária e normas regulamentadoras brasileiras.

Você está auditando o documento: **${documento_tipo}** — "${documento_nome}"
${contextoProfissional ? `\n${contextoProfissional}` : ""}

## INSTRUÇÕES DE ANÁLISE

Produza um **Relatório Técnico de Conformidade** profissional e estruturado, com base nas Normas Regulamentadoras (NRs) aplicáveis ao tipo de documento.

### ESTRUTURA OBRIGATÓRIA DO RELATÓRIO:

---

# 📋 RELATÓRIO DE CONFORMIDADE SST
**Documento:** ${documento_tipo}  
**Arquivo:** ${documento_nome}  
**Data da Análise:** [data atual]

---

## 1. IDENTIFICAÇÃO E ESCOPO
- Tipo do documento e sua finalidade legal
- NRs diretamente aplicáveis (cite artigos e itens específicos)
- Obrigações legais vinculadas a este tipo de documento

## 2. REQUISITOS NORMATIVOS APLICÁVEIS
Para cada NR pertinente, liste:
- **Número e nome da NR** (ex: NR-07 – PCMSO)
- **Itens normativos específicos** que o documento deve atender
- **Obrigações do empregador** conforme a norma
- **Periodicidade** de revisão/atualização exigida

## 3. ANÁLISE DE CONFORMIDADE POR REQUISITO
Para cada requisito normativo, avalie:
| Requisito | NR | Status | Observação |
|---|---|---|---|
| [item] | [NR-XX, item Y.Z] | ✅ Conforme / ⚠️ Atenção / ❌ Não Conforme | [detalhe] |

## 4. FUNÇÕES, SETORES E RISCOS IDENTIFICADOS
- Funções/cargos mencionados ou aplicáveis
- Setores de trabalho
- Agentes de risco por categoria:
  - **Físicos** (ruído, calor, vibração, radiação)
  - **Químicos** (poeiras, gases, vapores, névoas)
  - **Biológicos** (vírus, bactérias, fungos)
  - **Ergonômicos** (postura, repetitividade, carga mental)
  - **De Acidentes** (mecânicos, elétricos, quedas)

## 5. MEDIDAS DE CONTROLE E RECOMENDAÇÕES
- Medidas de controle existentes (identificadas no documento)
- Medidas recomendadas (com base nas NRs)
- Hierarquia de controle aplicável (eliminação > substituição > engenharia > administrativa > EPI)

## 6. EXAMES E TREINAMENTOS OBRIGATÓRIOS
- Exames ocupacionais exigidos (admissional, periódico, demissional, retorno, mudança de risco)
- Treinamentos obrigatórios por NR (NR-06, NR-10, NR-12, NR-33, NR-35, etc.)
- Periodicidade de reciclagem

## 7. ALERTAS DE CONFORMIDADE

Classifique cada alerta usando:
- 🔴 **CRÍTICO** — Risco legal/previdenciário imediato, possível autuação do MTE ou passivo trabalhista
- 🟠 **ALERTA TÉCNICO** — Inconsistência normativa, lacuna técnica ou divergência entre documentos
- 🟡 **ATENÇÃO** — Item que requer acompanhamento ou atualização futura

Para cada alerta, indique:
- Descrição objetiva do problema
- NR e item normativo violado/em risco
- Impacto legal e previdenciário
- Ação corretiva recomendada com prazo sugerido

## 8. INTEGRAÇÕES COM OUTROS DOCUMENTOS SST
- Coerência necessária com PGR, PCMSO, LTCAT, AEP, PPP
- Eventos eSocial relacionados (S-2210, S-2220, S-2240)
- Obrigações previdenciárias vinculadas (NTEP, FAP, RAT)

## 9. CONCLUSÃO E RECOMENDAÇÕES PRIORITÁRIAS
- Resumo executivo do nível de conformidade
- Top 3 ações prioritárias com responsável sugerido e prazo
- Classificação geral: ✅ Conforme | ⚠️ Parcialmente Conforme | ❌ Não Conforme

---

⚠️ **Nota:** Este relatório é gerado por inteligência artificial como ferramenta auxiliar de auditoria. Não substitui a análise e responsabilidade técnica de profissionais legalmente habilitados (Engenheiro de Segurança, Médico do Trabalho, etc.).

---

## REGRAS IMPORTANTES:
1. Cite SEMPRE os números das NRs e seus itens específicos (ex: NR-07, item 7.5.8)
2. Diferencie entre obrigações do empregador, do trabalhador e do profissional de SST
3. Considere a legislação atualizada (CLT, Lei 8.213/91, Decreto 3.048/99)
4. Mantenha linguagem técnica, objetiva e profissional
5. Use formatação Markdown clara com tabelas, listas e destaques
6. Responda SEMPRE em português brasileiro`;
    } else {
      systemPrompt = `Você é um especialista sênior em SST com profundo conhecimento das NRs brasileiras. Responda à pergunta do usuário sobre o documento ${documento_tipo} de forma técnica e profissional, sempre citando as NRs aplicáveis.`;
    }

    const userMessage = action === "analise"
      ? `Realize a auditoria de conformidade do documento "${documento_nome}" do tipo ${documento_tipo}. ${contextoProfissional ? `Informações adicionais: ${contextoProfissional}.` : ""} Gere o relatório técnico completo seguindo a estrutura obrigatória, analisando todos os requisitos normativos aplicáveis a este tipo de documento SST conforme as Normas Regulamentadoras vigentes.`
      : `Pergunta sobre o documento ${documento_tipo}: ${documento_nome}`;

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
        temperature: 0.3,
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

      return new Response(JSON.stringify({ error: "Erro na API OpenAI" }), {
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
