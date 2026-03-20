import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const { evento } = await req.json();
    if (!evento) throw new Error("Dados do evento não fornecidos");

    const sistemPrompt = `Você é um especialista em Saúde e Segurança do Trabalho (SST) com expertise em:
- Investigação de acidentes e incidentes conforme NR-01 (GRO) e ISO 45001 §10.2
- Análise de causa raiz (5-Porquês, Ishikawa, Bow-Tie)
- Legislação previdenciária (FAP, NTEP, CAT, B91)
- Normas NR-17 (ergonomia), NR-15 (insalubridade), NR-12 (máquinas)
- eSocial SST (S-2210, S-2220, S-2240)

Ao analisar um evento SST:
1. NUNCA invente dados — baseie-se apenas nas informações fornecidas
2. Seja objetivo, técnico e acionável
3. Priorize recomendações de alto impacto
4. Cite as normas aplicáveis
5. Estruture a resposta em seções claras`;

    const eventoTexto = `
**DADOS DO EVENTO:**
- Tipo: ${evento.tipo === "acidente" ? "Acidente" : "Incidente (Near Miss)"}
- Data: ${evento.data_evento || "Não informada"}
- Setor: ${evento.setor || "Não informado"}
- Unidade: ${evento.unidade || "Não informada"}
- Categoria principal: ${evento.categoria_principal || "Não informada"}
- Origem predominante: ${evento.origem_predominante || "Não informada"}
- Descrição: ${evento.descricao || "Não fornecida"}
- Percepção de causa: ${evento.percepcao_causa || "Não informada"}
- Gravidade da lesão: ${evento.gravidade_lesao || "Não informada"}
- Afastamento: ${evento.afastamento || "Não informado"}
- Atendimento médico: ${evento.atendimento || "Não informado"}
- Fatores ergonômicos/psicossociais: ${evento.fatores_ergonomicos?.join(", ") || "Nenhum"}
- Óbito: ${evento.obito ? "SIM" : "Não"}
- Tipo legal: ${evento.tipo_acidente_legal || "Não classificado"}
- CID-10: ${evento.cid10 || "Não informado"}
- Nexo causal: ${evento.nexo_causal || "Não informado"}
- Agente causador eSocial: ${evento.agente_causador_esocial || "Não informado"}`;

    const userMessage = `${eventoTexto}

Por favor, realize uma análise técnica completa estruturada da seguinte forma:

## 🔍 1. ANÁLISE DO EVENTO
Descrição técnica do que provavelmente ocorreu, com base nos dados.

## 🌳 2. CAUSAS PROVÁVEIS (Árvore de Causas Simplificada)
- **Causa imediata:** (o que diretamente causou o evento)
- **Causa básica:** (por que a causa imediata existia)
- **Causa raiz:** (falha sistêmica subjacente)
- **Fatores contribuintes:** (condições que facilitaram)

## ⚖️ 3. IMPACTO LEGAL E PREVIDENCIÁRIO
- Obrigações legais identificadas (CAT, eSocial, NRs)
- Risco de NTEP/B91 se aplicável
- Prazo para comunicação ao eSocial

## ✅ 4. AÇÕES RECOMENDADAS (Prioridade Alta → Baixa)
Para cada ação: [PRIORIDADE] **Título** — Descrição objetiva | Norma | Prazo sugerido

## 🛡️ 5. MEDIDAS DE PREVENÇÃO SISTÊMICA
Medidas estruturais para evitar recorrência (EPCs, administrativas, treinamento).

## 📋 6. CHECKLIST PÓS-EVENTO
Itens críticos a verificar conforme NR-01 e ISO 45001 §10.2.

Seja conciso mas completo. Máximo 600 palavras.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: sistemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 1200,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    const analise = data.choices?.[0]?.message?.content || "Análise não disponível.";

    return new Response(JSON.stringify({ analise }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-sst-investigacao error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
