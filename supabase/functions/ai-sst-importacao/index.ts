import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const SEGMENT_KEYWORDS: Record<string, string[]> = {
  PGR: ["inventário de riscos", "inventario de riscos", "identificação de perigos", "avaliação de riscos", "matriz de riscos", "gho", "grupo homogêneo", "fonte geradora", "medidas de controle", "nr-09", "nr 09"],
  PCMSO: ["exame", "exames", "periodicidade", "admissional", "periódico", "periodico", "retorno ao trabalho", "demissional", "monitoramento", "médico do trabalho", "nr-07", "nr 07"],
  LTCAT: ["agente nocivo", "agentes nocivos", "concentração", "concentracao", "intensidade", "habitual", "habitualidade", "permanência", "laudo técnico", "decreto 3048", "aposentadoria especial"],
  AET: ["ergonomia", "ergonômico", "posto de trabalho", "atividade real", "postura", "repetitividade", "esforço", "mobiliário", "organização do trabalho", "nr-17", "nr 17"],
  LAUDO_INSALUBRIDADE: ["insalubridade", "insalubre", "agente insalubre", "grau de insalubridade", "adicional de insalubridade", "nr-15", "nr 15", "limite de tolerância"],
  LAUDO_PERICULOSIDADE: ["periculosidade", "perigoso", "condição perigosa", "adicional de periculosidade", "nr-16", "nr 16", "inflamável", "explosivo", "eletricidade"],
};

// Âncoras primárias para localizar a seção do plano de ação
const PLAN_SECTION_ANCHORS = [
  "plano de ação", "plano de acao", "programa de ação", "programa de acao",
  "medidas de controle", "medidas recomendadas", "ações recomendadas", "acoes recomendadas",
  "cronograma de ações", "cronograma de acoes", "plano de adequação", "plano de adequacao",
  "ações corretivas", "acoes corretivas",
];

// ── Extrair segmentos relevantes do texto completo ──────────────────────────
function extractRelevantSegments(fullText: string, tipo: string): {
  cabecalho: string;
  conteudoPrincipal: string;
  planoAcao: string;
  planoAcaoComplementar: string;
} {
  const lower = fullText.toLowerCase();
  const total = fullText.length;
  const keywords = SEGMENT_KEYWORDS[tipo] || SEGMENT_KEYWORDS["PGR"];

  const cabecalho = fullText.substring(0, 8000);

  let mainStart = -1;
  for (const kw of keywords) {
    const idx = lower.indexOf(kw);
    if (idx !== -1 && (mainStart === -1 || idx < mainStart)) {
      mainStart = Math.max(0, idx - 200);
    }
  }

  // Busca âncoras de seção — usa a PRIMEIRA ocorrência relevante (não a última)
  let planStart = -1;
  for (const anchor of PLAN_SECTION_ANCHORS) {
    let searchFrom = 0;
    while (searchFrom < total) {
      const idx = lower.indexOf(anchor, searchFrom);
      if (idx === -1) break;
      const relPos = idx / total;
      if (relPos > 0.3) {
        if (planStart === -1 || idx < planStart) {
          planStart = Math.max(0, idx - 300);
        }
        break;
      }
      searchFrom = idx + anchor.length;
    }
  }

  if (planStart === -1) {
    planStart = Math.max(0, total - 35000);
  }

  let conteudoPrincipal = "";
  if (mainStart !== -1) {
    const end = (planStart > mainStart + 2000)
      ? Math.min(planStart, mainStart + 50000)
      : mainStart + 50000;
    conteudoPrincipal = fullText.substring(mainStart, Math.min(end, total));
  } else {
    const mid = Math.floor(total / 4);
    conteudoPrincipal = fullText.substring(mid, Math.min(mid + 40000, total));
  }

  const PLAN_CHUNK = 40000;
  const planoAcao = fullText.substring(planStart, Math.min(planStart + PLAN_CHUNK, total));
  const complementStart = planStart + PLAN_CHUNK;
  const planoAcaoComplementar = complementStart < total
    ? fullText.substring(complementStart, Math.min(complementStart + 30000, total))
    : "";

  console.log(
    `Segmentos [${tipo}] — cabeçalho:${cabecalho.length} principal:${conteudoPrincipal.length} plano:${planoAcao.length} planoCompl:${planoAcaoComplementar.length} | planStart@${planStart}/${total} (${Math.round(planStart / total * 100)}%)`
  );
  return { cabecalho, conteudoPrincipal, planoAcao, planoAcaoComplementar };
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
1. Foque em agentes do Anexo I e II do Decreto 3048/99.
2. Registre concentrações/intensidades com valores numéricos e limites de tolerância.
3. Informe se cada agente está "acima" ou "abaixo" do LT/NPS.
4. Extraia a conclusão técnica sobre exposição habitual e permanente.
5. NUNCA invente dados.

Retorne JSON:
{
  "inventario_riscos": [
    {
      "setor": "...", "funcao": "...", "risco": "...", "tipo_risco": "fisico",
      "fonte_geradora": "...", "intensidade": "...", "metodologia": "...",
      "limite_tolerancia": "...", "acima_limite": true,
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
2. Identifique: postura, repetitividade, esforço físico, mobiliário, organização do trabalho.
3. Classifique o nível de risco: alto, medio, baixo.
4. NUNCA invente dados.

Retorne JSON:
{
  "inventario_riscos": [
    {
      "setor": "...", "funcao": "...", "risco": "...", "tipo_risco": "ergonomico",
      "nivel_risco": "...", "fonte_geradora": "...",
      "danos": "...", "controles_existentes": ["..."],
      "confianca": "alta"
    }
  ],
  "fatores_ergonomicos": [
    {
      "posto": "...", "cargo": "...", "postura": "...", "repetitividade": "...",
      "esforco_fisico": "...", "mobiliario": "...", "organizacao_trabalho": "...",
      "aspectos_cognitivos": "...", "nivel_risco": "alto|medio|baixo",
      "confianca": "alta"
    }
  ]
}`;

    case "LAUDO_INSALUBRIDADE":
      return `Você é especialista em laudos de insalubridade (NR-15, CLT).

MISSÃO: Extrair agentes insalubres, medições e conclusão do laudo.
REGRAS:
1. Extraia cada agente avaliado e sua metodologia.
2. Registre concentrações/intensidades e compare com limites de tolerância.
3. Extraia a conclusão sobre caracterização e grau de insalubridade.
4. NUNCA invente dados.

Retorne JSON:
{
  "inventario_riscos": [
    {
      "setor": "...", "funcao": "...", "risco": "...", "tipo_risco": "quimico",
      "fonte_geradora": "...", "intensidade": "...", "limite_tolerancia": "...",
      "caracterizado": true, "grau_insalubridade": "maximo|medio|minimo",
      "conclusao": "...", "danos": "...",
      "controles_existentes": ["..."], "confianca": "alta"
    }
  ]
}`;

    case "LAUDO_PERICULOSIDADE":
      return `Você é especialista em laudos de periculosidade (NR-16, CLT).

MISSÃO: Extrair condições perigosas avaliadas e conclusão do laudo.
REGRAS:
1. Extraia cada condição perigosa analisada.
2. Registre o enquadramento legal e a habitualidade/permanência.
3. Extraia a conclusão sobre caracterização da periculosidade.
4. NUNCA invente dados.

Retorne JSON:
{
  "inventario_riscos": [
    {
      "setor": "...", "funcao": "...", "risco": "...", "tipo_risco": "acidente",
      "condicao_perigosa": "...", "enquadramento_legal": "...", "habitualidade": "...",
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

function buildPlanoAcaoPrompt(tipo: string, isComplementar = false): string {
  const contextoPorTipo: Record<string, string> = {
    PGR: "PRIORIDADE MAXIMA: Extraia CADA LINHA da tabela de Plano de Acao do PGR como uma acao separada. Colunas tipicas: Acao/Medida | Setor | Responsavel | Prazo | EPI/EPC | Tipo. Tambem extraia: implantacao de EPC, fornecimento/revisao de EPI, treinamentos recomendados, adequacoes de procedimento, avaliacoes quantitativas pendentes.",
    PCMSO: "Extraia: exames a incluir/revisar, convocacoes de periodico pendentes, adequacoes de fluxo de exames, atualizacoes do programa medico, regularizacao de exames.",
    LTCAT: "Extraia: necessidade de nova medicao, atualizacao do laudo, revisao de enquadramento, adequacoes ambientais, complementacoes tecnicas.",
    AET: "Extraia: ajuste de mobiliario, adequacao de posto, implantacao de pausa, revisao de ritmo de trabalho, treinamento ergonomico, alteracao de processo ou ferramenta, cada recomendacao do relatorio.",
    LAUDO_INSALUBRIDADE: "Extraia: implantacao de EPC, adequacao de protecao, substituicao de agente/processo, controle de exposicao, reavaliacao tecnica.",
    LAUDO_PERICULOSIDADE: "Extraia: adequacao de area de risco, isolamento/sinalizacao, revisao de procedimento, controle de energia, treinamento especifico.",
  };

  const contexto = contextoPorTipo[tipo] || "Extraia todas as acoes, recomendacoes e medidas do documento.";
  const parteLabel = isComplementar ? " (PARTE 2 - CONTINUACAO)" : " (PARTE 1)";

  return `Voce e especialista senior em SST brasileiro e gestao de riscos.

DOCUMENTO TIPO: ${tipo}${parteLabel}

MISSAO CRITICA: Extrair TODAS as acoes e recomendacoes presentes neste trecho.
- Se houver uma TABELA de plano de acao, CADA LINHA e uma acao separada - nao agrupe!
- Se houver uma LISTA de recomendacoes, CADA ITEM e uma acao separada.
- NUNCA invente dados. So extraia o que esta escrito explicitamente.
- Classifique prioridade: alta (imediato/urgente), media (curto prazo), baixa (longo prazo).

${contexto}

GATILHOS DE ACAO - ao encontrar qualquer uma dessas expressoes, gere uma acao:
recomenda-se, devera, sugere-se, torna-se necessario, e indispensavel, deve ser, plano de acao, medida de controle, acao corretiva, acao preventiva, necessaria correcao, requer revisao, exige treinamento, necessita atualizacao, implantar, realizar

Para cada acao, preencha o modelo 5W2H com os dados do documento:
- what: o que deve ser feito
- why: por que (justificativa do documento)
- where: onde (setor/area, se mencionado)
- who: responsavel (se mencionado)
- when: prazo (se mencionado)
- how: como sera executado
- how_much: custo (se mencionado)

Retorne JSON:
{
  "plano_acao": [
    {
      "recomendacao": "texto completo e fiel da recomendacao/acao",
      "what": "...", "why": "...", "where": "...", "who": "...",
      "when": "...", "how": "...", "how_much": "...",
      "prioridade": "alta",
      "prazo": "...",
      "responsavel": "...",
      "setor": "...",
      "trecho_origem": "frase exata do documento que originou esta acao",
      "confianca": "alta"
    }
  ]
}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, documento_texto, documento_tipo, documento_nome } = await req.json();

    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY nao configurada");

    if (action === "classificar") {
      const amostra = (documento_texto || "").substring(0, 5000);
      const content = await callOpenAI(
        `Voce e um especialista em documentos de SST brasileiro.
Analise o trecho e classifique o tipo de documento baseado em:
- titulo e palavras-chave recorrentes
- estrutura textual e terminologias tecnicas
- presenca de secoes tipicas e padroes de tabelas

Tipos possiveis: PGR, PCMSO, LTCAT, PPP, APR, NR12, AEP, AET, LAUDO_INSALUBRIDADE, LAUDO_PERICULOSIDADE, AVALIACAO_AMBIENTAL, RELATORIO_MEDICOES, RELATORIO_AUDITORIA, PARECER_TECNICO, OUTROS

Responda SOMENTE em JSON:
{"tipo": "PGR", "confianca": 92, "justificativa": "Identificado por: inventario de riscos, GHOs, NR-01..."}`,
        `Classifique este documento SST:\n\n${amostra}`,
        "gpt-4o-mini"
      );
      return new Response(JSON.stringify(content), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "extrair") {
      const textoCompleto = documento_texto || "";
      const tipo = documento_tipo || "DOCUMENTO_SST";
      const totalChars = textoCompleto.length;

      console.log(`Extracao iniciada. Tipo: ${tipo}, Total chars: ${totalChars}`);

      const { cabecalho, conteudoPrincipal, planoAcao, planoAcaoComplementar } = extractRelevantSegments(textoCompleto, tipo);

      const contextoDadosGerais = `${cabecalho}\n\n--- CONTEUDO PRINCIPAL ---\n${conteudoPrincipal.substring(0, 6000)}`;

      const promptDadosGerais = buildDadosGeraisPrompt(tipo);
      const promptConteudo = buildConteudoPrincipalPrompt(tipo);
      const promptPlano = buildPlanoAcaoPrompt(tipo, false);
      const promptPlanoCompl = buildPlanoAcaoPrompt(tipo, true);

      const promises: Promise<any>[] = [
        callOpenAI(promptDadosGerais, `Documento ${tipo} - Cabecalho e estrutura:\n\n${contextoDadosGerais}`),
        callOpenAI(promptConteudo, `Documento ${tipo} - Conteudo principal:\n\n${conteudoPrincipal}`),
        callOpenAI(promptPlano, `Documento ${tipo} - Plano de acao (parte 1):\n\n${planoAcao}`),
      ];

      if (planoAcaoComplementar.length > 500) {
        promises.push(
          callOpenAI(promptPlanoCompl, `Documento ${tipo} - Plano de acao (parte 2 - continuacao):\n\n${planoAcaoComplementar}`)
        );
      }

      console.log(`Iniciando ${promises.length} chamadas paralelas a OpenAI para tipo: ${tipo}...`);

      const results = await Promise.all(promises);
      const [resultDados, resultConteudo, resultPlano, resultPlanoCompl] = results;

      const inventarioRiscos = resultConteudo?.inventario_riscos || [];
      const matrizExames = resultConteudo?.matriz_exames || [];
      const fatoresErgonomicos = resultConteudo?.fatores_ergonomicos || [];

      let funcoesAtividades = resultDados?.funcoes_atividades || [];

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

      // Merge e deduplicação das ações dos dois chunks
      const acoesParte1: any[] = resultPlano?.plano_acao || [];
      const acoesParte2: any[] = resultPlanoCompl?.plano_acao || [];
      const todasAcoes = [...acoesParte1, ...acoesParte2];

      const planoAcaoExtraido = todasAcoes.filter((acao: any, idx: number) => {
        const key = (acao.what || acao.recomendacao || "").substring(0, 80).toLowerCase().trim();
        if (!key) return false;
        return todasAcoes.findIndex((a: any) =>
          (a.what || a.recomendacao || "").substring(0, 80).toLowerCase().trim() === key
        ) === idx;
      });

      console.log(`Conteudo extraido: ${inventarioRiscos.length} riscos, ${matrizExames.length} exames, ${acoesParte1.length}+${acoesParte2.length}=${planoAcaoExtraido.length} acoes (apos dedup)`);

      const content: any = {
        tipo_documento: tipo,
        dados_gerais: resultDados?.dados_gerais || {},
        estrutura_organizacional: resultDados?.estrutura_organizacional || { unidades: [], setores: [], departamentos: [] },
        funcoes_atividades: funcoesAtividades,
        inventario_riscos: inventarioRiscos,
        matriz_exames: matrizExames,
        fatores_ergonomicos: fatoresErgonomicos,
        plano_acao: planoAcaoExtraido,
        responsaveis_tecnicos: resultDados?.responsaveis_tecnicos || [],
        pendencias: [],
      };

      const calcScore = (obj: any): number => {
        if (!obj) return 0;
        const vals = Object.values(obj);
        const filled = vals.filter((v) => v !== null && v !== "" && v !== undefined);
        return Math.round((filled.length / vals.length) * 100);
      };

      const dg = content.dados_gerais || {};
      const dgScore = calcScore(Object.fromEntries(Object.entries(dg).map(([k, v]: any) => [k, v?.valor])));

      let invCount = inventarioRiscos.length;
      if (tipo === "PCMSO") invCount = Math.max(invCount, matrizExames.length);
      if (tipo === "AET") invCount = Math.max(invCount, fatoresErgonomicos.length);

      const invScore = invCount > 0 ? Math.min(100, Math.round((invCount / 10) * 100)) : 0;
      const paCount = planoAcaoExtraido.length;
      const paScore = paCount > 0 ? Math.min(100, Math.round((paCount / 5) * 100)) : 0;
      const respScore = (content.responsaveis_tecnicos?.length || 0) > 0 ? 100 : 0;
      const geral = Math.round((dgScore + invScore + paScore + respScore) / 4);

      content.score_qualidade = { geral, dados_gerais: dgScore, inventario: invScore, plano_acao: paScore, responsaveis: respScore };

      const pendencias: any[] = [];
      if (invCount === 0) {
        const msg = tipo === "PCMSO"
          ? "Nenhum exame/cargo identificado — verifique se a matriz de exames esta no documento"
          : "Nenhum risco/agente identificado — verifique se o inventario esta no PDF ou tente um PDF nativo";
        pendencias.push({ campo: "inventario_riscos", motivo: msg, severidade: "critica" });
      }
      if (dgScore < 50) pendencias.push({ campo: "dados_gerais", motivo: "Menos de 50% dos dados gerais identificados", severidade: "media" });
      if (paCount === 0) pendencias.push({ campo: "plano_acao", motivo: "Nenhuma recomendacao ou acao identificada", severidade: "media" });
      if ((content.responsaveis_tecnicos?.length || 0) === 0) {
        pendencias.push({ campo: "responsaveis_tecnicos", motivo: "Responsavel tecnico nao identificado no documento", severidade: "media" });
      }
      if (!dg.data_vigencia?.valor) {
        pendencias.push({ campo: "data_vigencia", motivo: "Vigencia nao identificada — necessaria para controle de vencimento", severidade: "media" });
      }
      content.pendencias = pendencias;

      console.log(`Score final [${tipo}]: ${geral}% | DG:${dgScore}% Inv:${invScore}%(${invCount}) PA:${paScore}%(${paCount}) Resp:${respScore}%`);

      return new Response(JSON.stringify(content), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Acao invalida" }), {
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
