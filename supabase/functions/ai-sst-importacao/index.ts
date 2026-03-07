import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// ── Palavras-chave que indicam seção de inventário de riscos ──────────────────
const RISK_SECTION_KEYWORDS = [
  "inventário de riscos", "inventario de riscos",
  "identificação de perigos", "identificacao de perigos",
  "avaliação de riscos", "avaliacao de riscos",
  "matriz de riscos", "quadro de riscos",
  "gho", "grupo homogêneo", "grupo homogeneo",
  "agente de risco", "agentes de risco",
  "fonte geradora", "medidas de controle",
  "ruído", "ruido", "calor", "vibração", "vibracao",
  "ergon", "quimico", "químico", "biologico", "biológico",
  "insalubridade", "periculosidade",
  "nr-09", "nr 09", "nr-15", "nr 15",
];

const PLAN_SECTION_KEYWORDS = [
  "plano de ação", "plano de acao", "recomendações", "recomendacoes",
  "medidas recomendadas", "ações corretivas", "acoes corretivas",
  "prazo", "responsável", "responsavel", "prioridade",
];

// ── Extrair segmentos relevantes do texto completo ──────────────────────────
function extractRelevantSegments(fullText: string, tipo: string): {
  cabecalho: string;
  inventario: string;
  planoAcao: string;
} {
  const lower = fullText.toLowerCase();
  const total = fullText.length;

  // Sempre pegar o cabeçalho (dados gerais + estrutura organizacional)
  const cabecalho = fullText.substring(0, 8000);

  // Buscar início da seção de inventário/riscos
  let riskStart = -1;
  for (const kw of RISK_SECTION_KEYWORDS) {
    const idx = lower.indexOf(kw);
    if (idx !== -1 && (riskStart === -1 || idx < riskStart)) {
      riskStart = Math.max(0, idx - 200); // um pouco antes para contexto
    }
  }

  // Buscar início da seção de plano de ação
  let planStart = -1;
  for (const kw of PLAN_SECTION_KEYWORDS) {
    const idx = lower.indexOf(kw, riskStart > 0 ? riskStart + 1000 : 0);
    if (idx !== -1 && (planStart === -1 || idx > planStart)) {
      planStart = Math.max(0, idx - 200);
    }
  }

  // Inventário: desde o início da seção de riscos até o início do plano (ou 40k chars)
  let inventario = "";
  if (riskStart !== -1) {
    const end = planStart > riskStart ? Math.min(planStart, riskStart + 40000) : riskStart + 40000;
    inventario = fullText.substring(riskStart, Math.min(end, total));
    console.log(`Inventário extraído: posição ${riskStart}–${Math.min(end, total)} (${inventario.length} chars)`);
  } else {
    // Fallback: pegar do meio do documento onde costuma estar o inventário
    const mid = Math.floor(total / 3);
    inventario = fullText.substring(mid, Math.min(mid + 30000, total));
    console.log(`Inventário (fallback mid): ${inventario.length} chars`);
  }

  // Plano de ação
  let planoAcao = "";
  if (planStart !== -1) {
    planoAcao = fullText.substring(planStart, Math.min(planStart + 15000, total));
    console.log(`Plano de ação extraído: posição ${planStart} (${planoAcao.length} chars)`);
  } else if (riskStart !== -1) {
    // Pegar o final do documento onde costumam estar as recomendações
    const tailStart = Math.max(0, total - 15000);
    planoAcao = fullText.substring(tailStart);
  }

  return { cabecalho, inventario, planoAcao };
}

// ── Chamada OpenAI ────────────────────────────────────────────────────────────
async function callOpenAI(systemPrompt: string, userContent: string, model = "gpt-4o"): Promise<any> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`OpenAI error ${resp.status}:`, errText);
    throw new Error(`OpenAI API retornou ${resp.status}: ${errText.substring(0, 200)}`);
  }

  const data = await resp.json();
  if (data.error) throw new Error(data.error.message || "Erro na API OpenAI");
  return JSON.parse(data.choices[0].message.content);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, documento_texto, documento_tipo, documento_nome } = await req.json();

    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    // ── Ação: classificar documento ──────────────────────────────────────────
    if (action === "classificar") {
      const amostra = (documento_texto || "").substring(0, 4000);
      const content = await callOpenAI(
        `Você é um especialista em documentos de SST brasileiro.
Analise o trecho e classifique o tipo de documento.

Tipos possíveis: PGR, PCMSO, LTCAT, PPP, APR, NR12, AEP, AET, LAUDO_INSALUBRIDADE, LAUDO_PERICULOSIDADE, AVALIACAO_AMBIENTAL, RELATORIO_MEDICOES, RELATORIO_AUDITORIA, PARECER_TECNICO, OUTROS

Responda SOMENTE em JSON:
{"tipo": "PGR", "confianca": 92, "justificativa": "..."}`,
        `Classifique este documento SST:\n\n${amostra}`,
        "gpt-4o-mini"
      );
      return new Response(JSON.stringify(content), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Ação: extrair dados estruturados ─────────────────────────────────────
    if (action === "extrair") {
      const textoCompleto = documento_texto || "";
      const tipo = documento_tipo || "DOCUMENTO_SST";
      const totalChars = textoCompleto.length;

      console.log(`Extração iniciada. Tipo: ${tipo}, Total chars: ${totalChars}`);

      // Estratégia de segmentação inteligente para documentos grandes
      const { cabecalho, inventario, planoAcao } = extractRelevantSegments(textoCompleto, tipo);

      // ── CHAMADA 1: Dados gerais + estrutura organizacional + funções ──────
      const promptDadosGerais = `Você é especialista sênior em SST brasileiro (NR-01, NR-09, eSocial).

EXTRAIA do trecho abaixo os dados gerais, estrutura organizacional, funções/cargos e responsáveis técnicos.
NUNCA invente dados. Se não encontrar, use null ou [].
Classifique confiança: "alta"=dado explícito | "media"=inferido | "baixa"=incerto.

IMPORTANTE para funcoes_atividades:
- Extraia TODOS os cargos, funções e ocupações mencionados no documento
- Inclua funções do inventário de riscos (coluna "Função" ou "Cargo")
- Inclua funções da estrutura organizacional, quadro de pessoal ou tabela de GHO
- Para cada função, liste as atividades/tarefas descritas (se não houver, use [])
- NUNCA retorne objetos vazios — todo item deve ter pelo menos o campo "cargo" preenchido

IMPORTANTE para estrutura_organizacional:
- setores: lista simples de strings com nomes dos setores/GHOs encontrados
- departamentos: lista simples de strings com nomes dos departamentos
- unidades: lista de objetos {nome, endereco}

Retorne JSON com EXATAMENTE esta estrutura:
{
  "dados_gerais": {
    "empresa": {"valor": null, "confianca": "baixa"},
    "cnpj": {"valor": null, "confianca": "baixa"},
    "cnae": {"valor": null, "confianca": "baixa"},
    "grau_risco": {"valor": null, "confianca": "baixa"},
    "data_emissao": {"valor": null, "confianca": "baixa"},
    "data_vigencia": {"valor": null, "confianca": "baixa"},
    "versao": {"valor": null, "confianca": "baixa"}
  },
  "estrutura_organizacional": {
    "unidades": [{"nome": "...", "endereco": "..."}],
    "setores": ["setor1", "setor2"],
    "departamentos": ["depto1", "depto2"]
  },
  "funcoes_atividades": [
    {
      "cargo": "nome do cargo ou função",
      "setor": "setor onde atua (se encontrado)",
      "atividades": ["atividade 1", "atividade 2"]
    }
  ],
  "responsaveis_tecnicos": [
    {
      "nome": "...",
      "registro": "CRP/CREA/CRM/etc",
      "funcao": "Engenheiro de Segurança / Técnico SST / Médico do Trabalho / etc"
    }
  ]
}`;

      // ── CHAMADA 2: Inventário de riscos (seção específica) ────────────────
      const promptInventario = buildRiskExtractionPrompt(tipo);

      // ── CHAMADA 3: Plano de ação ──────────────────────────────────────────
      const promptPlano = `Você é especialista sênior em SST brasileiro.

EXTRAIA todas as recomendações, medidas e ações do texto abaixo.
NUNCA invente dados. Use apenas o que está escrito explicitamente.

Retorne JSON:
{
  "plano_acao": [
    {
      "recomendacao": "...",
      "prioridade": "alta|media|baixa",
      "prazo": "...",
      "responsavel": "...",
      "setor": "...",
      "confianca": "alta|media|baixa"
    }
  ]
}`;

      // Executar as 3 chamadas em paralelo para economizar tempo
      console.log(`Iniciando 3 chamadas paralelas à OpenAI...`);
      const [resultDados, resultInventario, resultPlano] = await Promise.all([
        callOpenAI(promptDadosGerais, `Documento SST (${tipo}) — Cabeçalho e estrutura:\n\n${cabecalho}`),
        callOpenAI(promptInventario, `Documento SST (${tipo}) — Seção de inventário/riscos. Extraia TODOS os riscos, linha por linha:\n\n${inventario}`),
        callOpenAI(promptPlano, `Documento SST (${tipo}) — Seção de plano de ação e recomendações:\n\n${planoAcao}`),
      ]);

      console.log(`Inventário extraído: ${resultInventario?.inventario_riscos?.length || 0} riscos`);
      console.log(`Plano extraído: ${resultPlano?.plano_acao?.length || 0} ações`);

      // Mesclar resultados
      const content: any = {
        dados_gerais: resultDados?.dados_gerais || {},
        estrutura_organizacional: resultDados?.estrutura_organizacional || { unidades: [], setores: [], departamentos: [] },
        funcoes_atividades: resultDados?.funcoes_atividades || [],
        inventario_riscos: resultInventario?.inventario_riscos || [],
        plano_acao: resultPlano?.plano_acao || [],
        responsaveis_tecnicos: resultDados?.responsaveis_tecnicos || [],
        pendencias: [],
      };

      // Calcular score de qualidade
      const calcScore = (obj: any): number => {
        if (!obj) return 0;
        const vals = Object.values(obj);
        const filled = vals.filter((v) => v !== null && v !== "" && v !== undefined);
        return Math.round((filled.length / vals.length) * 100);
      };

      const dg = content.dados_gerais || {};
      const dgScore = calcScore(Object.fromEntries(Object.entries(dg).map(([k, v]: any) => [k, v?.valor])));
      const invCount = content.inventario_riscos?.length || 0;
      const invScore = invCount > 0 ? Math.min(100, Math.round((invCount / 10) * 100)) : 0;
      const paCount = content.plano_acao?.length || 0;
      const paScore = paCount > 0 ? Math.min(100, Math.round((paCount / 5) * 100)) : 0;
      const respScore = (content.responsaveis_tecnicos?.length || 0) > 0 ? 100 : 0;
      const geral = Math.round((dgScore + invScore + paScore + respScore) / 4);

      content.score_qualidade = { geral, dados_gerais: dgScore, inventario: invScore, plano_acao: paScore, responsaveis: respScore };

      // Gerar pendências automáticas
      const pendencias: any[] = [];
      if (invCount === 0) pendencias.push({ campo: "inventario_riscos", motivo: "Nenhum risco identificado — verifique se o inventário está no PDF ou tente um PDF nativo (texto selecionável)", severidade: "critica" });
      if (dgScore < 50) pendencias.push({ campo: "dados_gerais", motivo: "Menos de 50% dos dados gerais identificados", severidade: "media" });
      if (paCount === 0) pendencias.push({ campo: "plano_acao", motivo: "Nenhuma ação/recomendação identificada", severidade: "media" });
      content.pendencias = pendencias;

      console.log(`Score final: ${geral}% | DG:${dgScore}% Inv:${invScore}%(${invCount}) PA:${paScore}%(${paCount}) Resp:${respScore}%`);

      return new Response(JSON.stringify(content), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("ai-sst-importacao error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Prompt especializado de extração de riscos por tipo de documento ──────────
function buildRiskExtractionPrompt(tipo: string): string {
  const base = `Você é um especialista sênior em SST brasileiro com domínio em NR-01, NR-09, NR-15, NR-17 e eSocial.

MISSÃO: Extrair TODOS os riscos/perigos do inventário encontrado no texto.

REGRAS CRÍTICAS:
1. Extraia CADA LINHA/REGISTRO da tabela de riscos — não pule nenhum.
2. Se o texto contiver uma tabela com 30 linhas de riscos, retorne 30 objetos.
3. NUNCA invente dados. Use null para campos não encontrados.
4. Normalize o tipo_risco para: "fisico", "quimico", "biologico", "ergonomico", "acidente" ou "psicossocial".

Mapeamento de tipos:
- físico → Ruído, Calor, Frio, Vibração, Radiação, Iluminação, Pressão
- químico → Poeiras, Fumos, Névoas, Gases, Vapores, Substâncias químicas
- biológico → Vírus, Bactérias, Fungos, Parasitas
- ergonômico → Postura, Repetitividade, Esforço físico, Trabalho noturno, Monotonia
- acidente → Máquinas, Eletricidade, Incêndio, Queda, Corte, Explosão
- psicossocial → Assédio, Estresse, Pressão, Sobrecarga

Retorne JSON com EXATAMENTE esta estrutura:
{
  "inventario_riscos": [
    {
      "setor": "nome do setor ou GHO",
      "funcao": "cargo ou função exposta",
      "risco": "nome completo do agente de risco",
      "tipo_risco": "fisico|quimico|biologico|ergonomico|acidente|psicossocial",
      "fonte_geradora": "origem/equipamento gerador",
      "intensidade": "valor medido ou nível (ex: 85 dB, Alta, Acima do LT)",
      "tempo_exposicao": "duração diária (ex: 8h/dia, Habitual)",
      "metodologia": "método de avaliação utilizado",
      "danos": "danos à saúde possíveis",
      "controles_existentes": ["medida1", "medida2"],
      "confianca": "alta|media|baixa"
    }
  ]
}`;

  if (tipo === "PGR") {
    return base + `

DICAS ESPECÍFICAS PARA PGR:
- Procure tabelas com cabeçalhos: Setor, Cargo/Função, Agente, Fonte, GHO, NE, NA, NR, Probabilidade, Severidade, Risco
- Identifique seções: "Inventário de Riscos", "Identificação de Perigos", "Matriz de Risco"
- Cada GHO (Grupo Homogêneo de Exposição) pode ter múltiplos agentes de risco — extraia todos
- Considere também tabelas de "Avaliação Quantitativa" e "Avaliação Qualitativa" como fonte de riscos`;
  }

  if (tipo === "LTCAT") {
    return base + `

DICAS ESPECÍFICAS PARA LTCAT:
- Foque em agentes nocivos que ensejam aposentadoria especial (Anexos I e II do Decreto 3048/99)
- Extraia concentrações/intensidades com valores numéricos precisos e os limites de tolerância
- Registre se cada agente está "acima" ou "abaixo" do LT/NPS`;
  }

  return base;
}
