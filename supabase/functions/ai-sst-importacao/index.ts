import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// ── Palavras-chave por tipo de documento para extração segmentada ─────────────
const SEGMENT_KEYWORDS: Record<string, string[]> = {
  PGR: [
    "inventário de riscos", "inventario de riscos", "identificação de perigos",
    "avaliação de riscos", "avaliacao de riscos", "matriz de riscos", "gho",
    "grupo homogêneo", "fonte geradora", "medidas de controle", "nr-09", "nr 09",
  ],
  PCMSO: [
    "exame", "exames", "periodicidade", "admissional", "periódico", "periodico",
    "retorno ao trabalho", "demissional", "monitoramento", "acompanhamento médico",
    "médico do trabalho", "medico do trabalho", "nr-07", "nr 07",
  ],
  LTCAT: [
    "agente nocivo", "agentes nocivos", "concentração", "concentracao",
    "intensidade", "habitual", "habitualidade", "permanência", "permanencia",
    "laudo técnico", "laudo tecnico", "nr-09", "decreto 3048", "aposentadoria especial",
  ],
  AET: [
    "ergonomia", "ergonômico", "posto de trabalho", "atividade real", "postura",
    "repetitividade", "esforço", "esforco", "mobiliário", "mobiliario",
    "organização do trabalho", "nr-17", "nr 17", "recomendação ergonômica",
  ],
  LAUDO_INSALUBRIDADE: [
    "insalubridade", "insalubre", "agente insalubre", "grau de insalubridade",
    "adicional de insalubridade", "nr-15", "nr 15", "limite de tolerância",
  ],
  LAUDO_PERICULOSIDADE: [
    "periculosidade", "perigoso", "condição perigosa", "adicional de periculosidade",
    "nr-16", "nr 16", "inflamável", "explosivo", "eletricidade",
  ],
};

const PLAN_KEYWORDS = [
  "recomenda-se", "recomendamos", "deverá", "devera", "sugere-se", "torna-se necessário",
  "é indispensável", "deve ser", "plano de ação", "plano de acao", "medidas recomendadas",
  "ações corretivas", "acoes corretivas", "prazo", "responsável", "responsavel",
  "necessária", "necessaria", "requer", "exige", "necessita",
];

// ── Extrair segmentos relevantes do texto completo ──────────────────────────
function extractRelevantSegments(fullText: string, tipo: string): {
  cabecalho: string;
  conteudoPrincipal: string;
  planoAcao: string;
} {
  const lower = fullText.toLowerCase();
  const total = fullText.length;
  const keywords = SEGMENT_KEYWORDS[tipo] || SEGMENT_KEYWORDS["PGR"];

  // Cabeçalho sempre inclui os primeiros 8000 chars
  const cabecalho = fullText.substring(0, 8000);

  // Buscar início do conteúdo principal (riscos/exames/agentes/etc.)
  let mainStart = -1;
  for (const kw of keywords) {
    const idx = lower.indexOf(kw);
    if (idx !== -1 && (mainStart === -1 || idx < mainStart)) {
      mainStart = Math.max(0, idx - 200);
    }
  }

  // Buscar início do plano de ação
  let planStart = -1;
  for (const kw of PLAN_KEYWORDS) {
    const idx = lower.indexOf(kw, mainStart > 0 ? mainStart + 500 : 0);
    if (idx !== -1 && (planStart === -1 || idx > planStart)) {
      planStart = Math.max(0, idx - 200);
    }
  }

  // Conteúdo principal
  let conteudoPrincipal = "";
  if (mainStart !== -1) {
    const end = planStart > mainStart ? Math.min(planStart, mainStart + 45000) : mainStart + 45000;
    conteudoPrincipal = fullText.substring(mainStart, Math.min(end, total));
  } else {
    const mid = Math.floor(total / 4);
    conteudoPrincipal = fullText.substring(mid, Math.min(mid + 35000, total));
  }

  // Plano/recomendações
  let planoAcao = "";
  if (planStart !== -1) {
    planoAcao = fullText.substring(planStart, Math.min(planStart + 18000, total));
  } else {
    const tailStart = Math.max(0, total - 18000);
    planoAcao = fullText.substring(tailStart);
  }

  console.log(`Segmentos [${tipo}] — cabeçalho:${cabecalho.length} principal:${conteudoPrincipal.length} plano:${planoAcao.length}`);
  return { cabecalho, conteudoPrincipal, planoAcao };
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

// ── Prompts especializados por tipo ──────────────────────────────────────────

function buildDadosGeraisPrompt(tipo: string): string {
  const camposEspecificos: Record<string, string> = {
    PGR: `"grau_risco": {"valor": null, "confianca": "baixa"}, "cnae": {"valor": null, "confianca": "baixa"},`,
    PCMSO: `"medico_coordenador": {"valor": null, "confianca": "baixa"}, "crm": {"valor": null, "confianca": "baixa"},`,
    LTCAT: `"responsavel_tecnico": {"valor": null, "confianca": "baixa"}, "metodologia": {"valor": null, "confianca": "baixa"},`,
    AET: `"responsavel_tecnico": {"valor": null, "confianca": "baixa"}, "setor_avaliado": {"valor": null, "confianca": "baixa"},`,
    LAUDO_INSALUBRIDADE: `"grau_insalubridade": {"valor": null, "confianca": "baixa"}, "conclusao": {"valor": null, "confianca": "baixa"},`,
    LAUDO_PERICULOSIDADE: `"conclusao": {"valor": null, "confianca": "baixa"}, "condicao_perigosa": {"valor": null, "confianca": "baixa"},`,
  };
  const extra = camposEspecificos[tipo] || "";

  return `Você é especialista sênior em SST brasileiro (NR-01, NR-09, eSocial).

DOCUMENTO TIPO: ${tipo}

EXTRAIA os dados gerais, estrutura organizacional, funções/cargos e responsáveis técnicos.
NUNCA invente dados. Se não encontrar, use null ou [].
Classifique confiança: "alta"=dado explícito | "media"=inferido | "baixa"=incerto.

IMPORTANTE para funcoes_atividades:
- Extraia TODOS os cargos, funções e ocupações mencionados
- Para cada função, liste as atividades/tarefas descritas (se não houver, use [])
- NUNCA retorne objetos vazios

IMPORTANTE para estrutura_organizacional:
- setores: lista simples de strings
- departamentos: lista simples de strings
- unidades: lista de objetos {nome, endereco}

Retorne JSON com EXATAMENTE esta estrutura:
{
  "dados_gerais": {
    "empresa": {"valor": null, "confianca": "baixa"},
    "cnpj": {"valor": null, "confianca": "baixa"},
    ${extra}
    "data_emissao": {"valor": null, "confianca": "baixa"},
    "data_vigencia": {"valor": null, "confianca": "baixa"},
    "versao": {"valor": null, "confianca": "baixa"}
  },
  "estrutura_organizacional": {
    "unidades": [{"nome": "...", "endereco": "..."}],
    "setores": ["setor1"],
    "departamentos": ["depto1"]
  },
  "funcoes_atividades": [
    {"cargo": "...", "setor": "...", "atividades": ["..."]}
  ],
  "responsaveis_tecnicos": [
    {"nome": "...", "registro": "...", "funcao": "..."}
  ]
}`;
}

function buildConteudoPrincipalPrompt(tipo: string): string {
  switch (tipo) {
    case "PGR":
      return `Você é especialista sênior em SST brasileiro com domínio em NR-01, NR-09, NR-15 e eSocial.

MISSÃO: Extrair TODOS os riscos/perigos do inventário do PGR.
REGRAS:
1. Extraia CADA LINHA/REGISTRO da tabela de riscos — não pule nenhum.
2. NUNCA invente dados. Use null para campos não encontrados.
3. Normalize tipo_risco: "fisico" | "quimico" | "biologico" | "ergonomico" | "acidente" | "psicossocial"
4. Procure tabelas com: Setor, Cargo/Função, Agente, Fonte, GHO, NE, NA, NR, Probabilidade, Severidade, Risco

Retorne JSON:
{
  "inventario_riscos": [
    {
      "setor": "...", "funcao": "...", "risco": "...", "tipo_risco": "fisico",
      "fonte_geradora": "...", "intensidade": "...", "tempo_exposicao": "...",
      "metodologia": "...", "danos": "...", "controles_existentes": ["..."],
      "confianca": "alta"
    }
  ]
}`;

    case "PCMSO":
      return `Você é especialista em PCMSO e saúde ocupacional no Brasil (NR-07).

MISSÃO: Extrair a matriz de exames ocupacionais do PCMSO por cargo/função.
REGRAS:
1. Para cada cargo ou grupo, extraia os exames previstos e periodicidade.
2. Identifique o tipo de exame: admissional, periódico, mudança de risco, retorno, demissional.
3. Extraia exames clínicos e complementares separadamente quando possível.
4. NUNCA invente dados. Use null para campos não encontrados.

Retorne JSON:
{
  "matriz_exames": [
    {
      "cargo": "...", "setor": "...", "risco_relacionado": "...",
      "exames_clinicos": ["..."], "exames_complementares": ["..."],
      "periodicidade": "...", "tipo_exame": "...",
      "observacoes": "...", "confianca": "alta"
    }
  ]
}`;

    case "LTCAT":
      return `Você é especialista em LTCAT e previdência social (Decreto 3048/99, NR-09).

MISSÃO: Extrair avaliação dos agentes nocivos com foco previdenciário.
REGRAS:
1. Foque em agentes do Anexo I e II do Decreto 3048/99 (aposentadoria especial).
2. Registre concentrações/intensidades com valores numéricos e limites de tolerância.
3. Informe se cada agente está "acima" ou "abaixo" do LT/NPS.
4. Extraia a conclusão técnica sobre exposição habitual e permanente.
5. NUNCA invente dados.

Retorne JSON:
{
  "inventario_riscos": [
    {
      "setor": "...", "funcao": "...", "risco": "...", "tipo_risco": "fisico",
      "fonte_geradora": "...", "intensidade": "...", "tempo_exposicao": "...",
      "metodologia": "...", "limite_tolerancia": "...", "acima_limite": true,
      "conclusao_previdenciaria": "...", "danos": "...",
      "controles_existentes": ["..."], "confianca": "alta"
    }
  ]
}`;

    case "AET":
      return `Você é especialista em ergonomia e NR-17.

MISSÃO: Extrair os fatores ergonômicos analisados e recomendações da AET.
REGRAS:
1. Para cada posto/função analisada, extraia todos os fatores ergonômicos.
2. Identifique inconformidades e recomendações práticas.
3. Classifique fatores: "biomecânico", "cognitivo", "organizacional", "ambiental".
4. NUNCA invente dados.

Retorne JSON:
{
  "inventario_riscos": [
    {
      "setor": "...", "funcao": "...", "risco": "...",
      "tipo_risco": "ergonomico", "fator_ergonomico": "...",
      "nivel_risco": "...", "fonte_geradora": "...",
      "danos": "...", "controles_existentes": ["..."],
      "confianca": "alta"
    }
  ],
  "fatores_ergonomicos": [
    {
      "posto": "...", "cargo": "...",
      "postura": "...", "repetitividade": "...", "esforco_fisico": "...",
      "mobiliario": "...", "organizacao_trabalho": "...",
      "aspectos_cognitivos": "...", "nivel_risco": "alto|medio|baixo",
      "confianca": "alta"
    }
  ]
}`;

    case "LAUDO_INSALUBRIDADE":
      return `Você é especialista em laudos de insalubridade (NR-15, CLT Art.189).

MISSÃO: Extrair a caracterização de insalubridade por função/setor.
REGRAS:
1. Para cada função/setor avaliado, registre o agente insalubre, metodologia e conclusão.
2. Quando caracterizado, informe o grau (mínimo 10%, médio 20%, máximo 40%).
3. Registre se há medidas de neutralização ou eliminação.
4. NUNCA invente dados.

Retorne JSON:
{
  "inventario_riscos": [
    {
      "setor": "...", "funcao": "...", "risco": "...",
      "tipo_risco": "fisico", "agente_insalubre": "...",
      "intensidade": "...", "limite_tolerancia": "...",
      "metodologia": "...", "caracterizado": true,
      "grau_insalubridade": "maximo|medio|minimo",
      "conclusao": "...", "danos": "...",
      "controles_existentes": ["..."], "confianca": "alta"
    }
  ]
}`;

    case "LAUDO_PERICULOSIDADE":
      return `Você é especialista em laudos de periculosidade (NR-16, CLT Art.193).

MISSÃO: Extrair a caracterização de periculosidade por função/área.
REGRAS:
1. Para cada função/área avaliada, registre a condição perigosa, enquadramento e conclusão.
2. Informe o tipo de condição: inflamáveis, explosivos, eletricidade, roubos/violência, motocicleta.
3. Registre as proteções existentes e se são suficientes para descaracterizar.
4. NUNCA invente dados.

Retorne JSON:
{
  "inventario_riscos": [
    {
      "setor": "...", "funcao": "...", "risco": "...",
      "tipo_risco": "acidente", "condicao_perigosa": "...",
      "enquadramento_legal": "...", "habitualidade": "...",
      "caracterizado": true, "conclusao": "...",
      "controles_existentes": ["..."], "confianca": "alta"
    }
  ]
}`;

    default:
      return `Você é especialista sênior em SST brasileiro.
MISSÃO: Extrair os riscos, perigos e exposições identificados no documento.
REGRAS: NUNCA invente dados. Use null para campos não encontrados.
Normalize tipo_risco: "fisico" | "quimico" | "biologico" | "ergonomico" | "acidente" | "psicossocial"

Retorne JSON:
{
  "inventario_riscos": [
    {
      "setor": "...", "funcao": "...", "risco": "...", "tipo_risco": "fisico",
      "fonte_geradora": "...", "intensidade": "...", "tempo_exposicao": "...",
      "danos": "...", "controles_existentes": ["..."], "confianca": "alta"
    }
  ]
}`;
  }
}

function buildPlanoAcaoPrompt(tipo: string): string {
  // Frases geradoras de ação conforme a especificação
  const frasesAcao = `recomenda-se, deverá ser implantado, sugere-se, torna-se necessário,
é indispensável, deve ser providenciado, recomenda-se adequação, requer revisão,
necessária reavaliação, necessária correção, deve ser monitorado, deve ser renovado,
exige treinamento, necessita atualização`;

  const contextoPorTipo: Record<string, string> = {
    PGR: `Para PGR, priorize: implantação de EPC, fornecimento/revisão de EPI, treinamentos recomendados, adequações de procedimento, avaliações quantitativas pendentes, revisão de inventário.`,
    PCMSO: `Para PCMSO, priorize: exames complementares a incluir, revisão de periodicidade, convocações de periódico pendentes, adequações de fluxo de exames, atualizações do programa médico.`,
    LTCAT: `Para LTCAT, priorize: necessidade de nova medição, atualização do laudo, inconsistências de exposição, revisão de enquadramento, adequações ambientais.`,
    AET: `Para AET, priorize: ajuste de mobiliário, adequação de posto, implantação de pausa, revisão de ritmo de trabalho, treinamento ergonômico, alteração de processo ou ferramenta.`,
    LAUDO_INSALUBRIDADE: `Para Laudo de Insalubridade, priorize: implantação de EPC, adequação de proteção, substituição de agente/processo, controle de exposição, reavaliação após adequação.`,
    LAUDO_PERICULOSIDADE: `Para Laudo de Periculosidade, priorize: adequação de área de risco, isolamento/sinalização, revisão de procedimento, controle de energia, treinamento específico.`,
  };

  const contexto = contextoPorTipo[tipo] || "Priorize ações técnicas e preventivas identificadas no documento.";

  return `Você é especialista sênior em SST brasileiro e gestão de riscos.

DOCUMENTO TIPO: ${tipo}

MISSÃO: Extrair TODAS as ações, recomendações e medidas do texto.
NUNCA invente dados. Extraia apenas o que está escrito explicitamente.

FRASES GERADORAS DE AÇÃO (sempre que encontrar, gere uma ação):
${frasesAcao}

${contexto}

Para cada ação, preencha o modelo 5W2H:
- what: o que deve ser feito (extraído do texto)
- why: por que deve ser feito (justificativa do documento)
- where: onde deve ser feito (setor/área)
- who: responsável (se mencionado)
- when: prazo (se mencionado)
- how: como será executado (método/procedimento)
- how_much: custo estimado (se mencionado)

Retorne JSON:
{
  "plano_acao": [
    {
      "recomendacao": "texto completo da recomendação",
      "what": "...", "why": "...", "where": "...", "who": "...",
      "when": "...", "how": "...", "how_much": "...",
      "prioridade": "alta|media|baixa",
      "prazo": "...",
      "responsavel": "...",
      "setor": "...",
      "trecho_origem": "trecho exato do documento que gerou esta ação",
      "confianca": "alta|media|baixa"
    }
  ]
}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, documento_texto, documento_tipo, documento_nome } = await req.json();

    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    // ── Ação: classificar documento ──────────────────────────────────────────
    if (action === "classificar") {
      const amostra = (documento_texto || "").substring(0, 5000);
      const content = await callOpenAI(
        `Você é um especialista em documentos de SST brasileiro.
Analise o trecho e classifique o tipo de documento baseado em:
- título e palavras-chave recorrentes
- estrutura textual e terminologias técnicas
- presença de seções típicas e padrões de tabelas

Tipos possíveis: PGR, PCMSO, LTCAT, PPP, APR, NR12, AEP, AET, LAUDO_INSALUBRIDADE, LAUDO_PERICULOSIDADE, AVALIACAO_AMBIENTAL, RELATORIO_MEDICOES, RELATORIO_AUDITORIA, PARECER_TECNICO, OUTROS

Responda SOMENTE em JSON:
{"tipo": "PGR", "confianca": 92, "justificativa": "Identificado por: inventário de riscos, GHOs, NR-01..."}`,
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

      const { cabecalho, conteudoPrincipal, planoAcao } = extractRelevantSegments(textoCompleto, tipo);

      // Contexto enriquecido para dados gerais (inclui início do conteúdo principal)
      const contextoDadosGerais = `${cabecalho}\n\n--- CONTEÚDO PRINCIPAL (para extração de funções e setores) ---\n${conteudoPrincipal.substring(0, 6000)}`;

      // Prompts especializados por tipo
      const promptDadosGerais = buildDadosGeraisPrompt(tipo);
      const promptConteudo = buildConteudoPrincipalPrompt(tipo);
      const promptPlano = buildPlanoAcaoPrompt(tipo);

      console.log(`Iniciando 3 chamadas paralelas à OpenAI para tipo: ${tipo}...`);

      const [resultDados, resultConteudo, resultPlano] = await Promise.all([
        callOpenAI(promptDadosGerais, `Documento ${tipo} — Cabeçalho e estrutura:\n\n${contextoDadosGerais}`),
        callOpenAI(promptConteudo, `Documento ${tipo} — Conteúdo principal:\n\n${conteudoPrincipal}`),
        callOpenAI(promptPlano, `Documento ${tipo} — Recomendações e plano de ação:\n\n${planoAcao}`),
      ]);

      const inventarioRiscos = resultConteudo?.inventario_riscos || [];
      const matrizExames = resultConteudo?.matriz_exames || []; // PCMSO
      const fatoresErgonomicos = resultConteudo?.fatores_ergonomicos || []; // AET

      let funcoesAtividades = resultDados?.funcoes_atividades || [];

      // Fallback: extrair cargos únicos do inventário de riscos
      if (funcoesAtividades.length === 0 && inventarioRiscos.length > 0) {
        const cargosMap = new Map<string, { cargo: string; setor: string; atividades: string[] }>();
        for (const r of inventarioRiscos) {
          if (r.funcao && r.funcao !== "null" && r.funcao !== "") {
            const key = r.funcao.trim().toLowerCase();
            if (!cargosMap.has(key)) {
              cargosMap.set(key, { cargo: r.funcao.trim(), setor: r.setor || "", atividades: [] });
            }
          }
        }
        funcoesAtividades = Array.from(cargosMap.values());
      }

      // Fallback PCMSO: extrair cargos da matriz de exames
      if (funcoesAtividades.length === 0 && matrizExames.length > 0) {
        const cargosMap = new Map<string, { cargo: string; setor: string; atividades: string[] }>();
        for (const e of matrizExames) {
          if (e.cargo) {
            const key = e.cargo.trim().toLowerCase();
            if (!cargosMap.has(key)) {
              cargosMap.set(key, { cargo: e.cargo.trim(), setor: e.setor || "", atividades: [] });
            }
          }
        }
        funcoesAtividades = Array.from(cargosMap.values());
      }

      funcoesAtividades = funcoesAtividades.filter((f: any) => f && f.cargo && f.cargo !== "null" && f.cargo !== "");

      const planoAcaoExtraido = resultPlano?.plano_acao || [];

      console.log(`Conteúdo extraído: ${inventarioRiscos.length} riscos, ${matrizExames.length} exames, ${planoAcaoExtraido.length} ações`);

      const content: any = {
        tipo_documento: tipo,
        dados_gerais: resultDados?.dados_gerais || {},
        estrutura_organizacional: resultDados?.estrutura_organizacional || { unidades: [], setores: [], departamentos: [] },
        funcoes_atividades: funcoesAtividades,
        inventario_riscos: inventarioRiscos,
        matriz_exames: matrizExames, // específico PCMSO
        fatores_ergonomicos: fatoresErgonomicos, // específico AET
        plano_acao: planoAcaoExtraido,
        responsaveis_tecnicos: resultDados?.responsaveis_tecnicos || [],
        pendencias: [],
      };

      // Score de qualidade (adaptado por tipo)
      const calcScore = (obj: any): number => {
        if (!obj) return 0;
        const vals = Object.values(obj);
        const filled = vals.filter((v) => v !== null && v !== "" && v !== undefined);
        return Math.round((filled.length / vals.length) * 100);
      };

      const dg = content.dados_gerais || {};
      const dgScore = calcScore(Object.fromEntries(Object.entries(dg).map(([k, v]: any) => [k, v?.valor])));
      
      // Score de inventário adaptado ao tipo
      let invCount = inventarioRiscos.length;
      if (tipo === "PCMSO") invCount = Math.max(invCount, matrizExames.length);
      if (tipo === "AET") invCount = Math.max(invCount, fatoresErgonomicos.length);
      
      const invScore = invCount > 0 ? Math.min(100, Math.round((invCount / 10) * 100)) : 0;
      const paCount = planoAcaoExtraido.length;
      const paScore = paCount > 0 ? Math.min(100, Math.round((paCount / 5) * 100)) : 0;
      const respScore = (content.responsaveis_tecnicos?.length || 0) > 0 ? 100 : 0;
      const geral = Math.round((dgScore + invScore + paScore + respScore) / 4);

      content.score_qualidade = { geral, dados_gerais: dgScore, inventario: invScore, plano_acao: paScore, responsaveis: respScore };

      // Pendências automáticas por tipo
      const pendencias: any[] = [];
      if (invCount === 0) {
        const msg = tipo === "PCMSO"
          ? "Nenhum exame/cargo identificado — verifique se a matriz de exames está no documento"
          : "Nenhum risco/agente identificado — verifique se o inventário está no PDF ou tente um PDF nativo";
        pendencias.push({ campo: "inventario_riscos", motivo: msg, severidade: "critica" });
      }
      if (dgScore < 50) pendencias.push({ campo: "dados_gerais", motivo: "Menos de 50% dos dados gerais identificados", severidade: "media" });
      if (paCount === 0) pendencias.push({ campo: "plano_acao", motivo: "Nenhuma recomendação ou ação identificada", severidade: "media" });
      if ((content.responsaveis_tecnicos?.length || 0) === 0) {
        pendencias.push({ campo: "responsaveis_tecnicos", motivo: "Responsável técnico não identificado no documento", severidade: "media" });
      }
      if (!dg.data_vigencia?.valor) {
        pendencias.push({ campo: "data_vigencia", motivo: "Vigência não identificada — necessária para controle de vencimento", severidade: "media" });
      }
      content.pendencias = pendencias;

      console.log(`Score final [${tipo}]: ${geral}% | DG:${dgScore}% Inv:${invScore}%(${invCount}) PA:${paScore}%(${paCount}) Resp:${respScore}%`);

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
