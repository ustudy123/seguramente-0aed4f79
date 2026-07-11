import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Âncoras para localizar seção de plano de ação
const PLAN_SECTION_ANCHORS = [
  "plano de ação", "plano de acao", "programa de ação", "programa de acao",
  "medidas de controle", "medidas recomendadas", "ações recomendadas", "acoes recomendadas",
  "cronograma de ações", "cronograma de acoes", "plano de adequação", "plano de adequacao",
  "ações corretivas", "acoes corretivas",
];

// Tamanho máximo de cada chunk enviado à IA (em chars)
const CHUNK_SIZE = 60000;
// Máximo de chunks paralelos para varredura de riscos
const MAX_RISK_CHUNKS = 5;

// ── Dividir documento em chunks de tamanho igual para varredura completa ─────
function splitIntoChunks(text: string, chunkSize: number, overlap = 2000): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    if (end === text.length) break;
    start = end - overlap; // pequeno overlap para não perder dados nas bordas
  }
  return chunks;
}

// ── Localizar início da seção de plano de ação ───────────────────────────────
function findPlanStart(text: string): number {
  const lower = text.toLowerCase();
  const total = text.length;
  let planStart = -1;
  for (const anchor of PLAN_SECTION_ANCHORS) {
    let searchFrom = 0;
    while (searchFrom < total) {
      const idx = lower.indexOf(anchor, searchFrom);
      if (idx === -1) break;
      if (idx / total > 0.2) {
        if (planStart === -1 || idx < planStart) planStart = Math.max(0, idx - 500);
        break;
      }
      searchFrom = idx + anchor.length;
    }
  }
  return planStart === -1 ? Math.max(0, total - CHUNK_SIZE) : planStart;
}

// ── Sanitização de valores "null" string ────────────────────────────────────
function sanitizeNulls(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === "string") {
    const s = obj.trim();
    if (s === "null" || s === "undefined" || s === "N/A" || s === "n/a" || s === "-" || s === "") return null;
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeNulls).filter((v) => v !== null && v !== undefined && v !== "");
  }
  if (typeof obj === "object") {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) result[k] = sanitizeNulls(v);
    return result;
  }
  return obj;
}

// ── Chamada OpenAI com JSON obrigatório ──────────────────────────────────────
async function callOpenAI(systemPrompt: string, userContent: string, model = "gpt-4o"): Promise<any> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
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
    throw new Error(`OpenAI API ${resp.status}: ${errText.substring(0, 200)}`);
  }
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  const raw = JSON.parse(data.choices[0].message.content);
  return sanitizeNulls(raw);
}

// ── Prompts ──────────────────────────────────────────────────────────────────

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

  return `Você é especialista sênior em SST brasileiro (NR-01, NR-09, eSocial). Tipo: ${tipo}.
EXTRAIA dados gerais, estrutura organizacional, funções/cargos e responsáveis técnicos.
NUNCA invente dados. Se não encontrar, use null ou [].
Confiança: "alta"=explícito | "media"=inferido | "baixa"=incerto.
Para funcoes_atividades: extraia TODOS os cargos mencionados.
Para estrutura_organizacional: setores e departamentos como listas simples de strings.

REGRAS CRÍTICAS DE DATAS (NR-01 §1.5.4.4.6):
- "data_emissao" = data de ELABORAÇÃO original do documento (primeira emissão).
- "data_ultima_revisao" = data da revisão mais recente (ex.: "1ª Revisão: Outubro/2025"). Deixe null se não houver revisão.
- "data_vigencia" = data de VALIDADE / VENCIMENTO do documento. NÃO confunda com data de revisão nem de elaboração.
  * Para PGR: vigência máxima é 2 anos a partir da última revisão (ou 3 anos para MEI/ME/EPP com grau de risco 1 ou 2).
  * Para PCMSO: vigência de 1 ano a contar da emissão/revisão.
  * Para LTCAT/AET/Laudos: quando o documento não declara data de validade explícita, use null (confiança "baixa"). NUNCA use a data de elaboração/revisão como vigência.
- Retorne datas no formato ISO "YYYY-MM-DD" quando possível. Se só houver mês/ano, use o primeiro dia do mês.

Retorne JSON:
{
  "dados_gerais": {
    "empresa": {"valor": null, "confianca": "baixa"},
    "cnpj": {"valor": null, "confianca": "baixa"},
    ${extra}
    "data_emissao": {"valor": null, "confianca": "baixa"},
    "data_ultima_revisao": {"valor": null, "confianca": "baixa"},
    "data_vigencia": {"valor": null, "confianca": "baixa"},
    "versao": {"valor": null, "confianca": "baixa"}
  },
  "estrutura_organizacional": {
    "unidades": [{"nome": "...", "endereco": "..."}],
    "setores": ["setor1"],
    "departamentos": ["depto1"]
  },
  "funcoes_atividades": [{"cargo": "...", "setor": "...", "atividades": ["..."]}],
  "responsaveis_tecnicos": [{"nome": "...", "registro": "...", "funcao": "..."}]
}`;
}

function buildRiscosPrompt(tipo: string, chunkIndex: number, totalChunks: number): string {
  // PCMSO usa prompt e schema próprio para matriz_exames
  if (tipo === "PCMSO") {
    return `Você é especialista sênior em SST e medicina do trabalho brasileiro. Analisando trecho ${chunkIndex + 1} de ${totalChunks}.
MISSÃO: Extrair TODA a matriz de exames do PCMSO.

Procure ATENTAMENTE tabelas e listas com: Função/Cargo, Risco/GHO, Tipo de exame (admissional/periódico/retorno/demissional/mudança de função), Consulta/Exame clínico, Exames complementares, Periodicidade.

REGRAS CRÍTICAS:
1. Cada cargo/função = um item separado no array "matriz_exames". NÃO agrupe cargos.
2. "exames_clinicos" = exames de consulta médica (ex: "Consulta médica", "Audiometria clínica").
3. "exames_complementares" = exames laboratoriais ou de imagem (ex: "Hemograma", "Audiometria tonal", "Raio-X", "Espirometria", "EEG", "Acuidade visual").
4. "periodicidade" = frequência de realização (ex: "Anual", "Semestral", "A cada 2 anos", "No admissional e anual").
5. "tipos_exame" = lista dos tipos aplicáveis: "admissional", "periodico", "retorno_trabalho", "mudanca_funcao", "demissional".
6. Se não encontrar nenhuma matriz de exames neste trecho, retorne {"matriz_exames": [], "inventario_riscos": []}.
7. Não invente dados — extraia APENAS o que está escrito no texto.

Retorne JSON:
{
  "matriz_exames": [
    {
      "cargo": "Auxiliar de Produção",
      "setor": "Produção",
      "risco_relacionado": "Ruído, Calor",
      "exames_clinicos": ["Consulta médica ocupacional", "Avaliação audiológica"],
      "exames_complementares": ["Audiometria tonal liminar", "Hemograma completo"],
      "periodicidade": "Anual",
      "tipos_exame": ["admissional", "periodico", "demissional"],
      "observacoes": "Audiometria a cada 6 meses para expostos a ruído acima de 85dB",
      "confianca": "alta"
    }
  ],
  "inventario_riscos": []
}`;
  }

  const tipoDesc: Record<string, string> = {
    PGR: `inventário de riscos do PGR. Procure tabelas com: Setor, Cargo/Função, GHO, Agente, Fonte Geradora, Probabilidade, Severidade, Medida de Controle.
Normalize tipo_risco: "fisico"|"quimico"|"biologico"|"ergonomico"|"acidente"|"psicossocial"`,
    LTCAT: `avaliação de agentes nocivos do LTCAT. Foco em concentrações, limites de tolerância, habitualidade e permanência.
CRÍTICO para LTCAT: Para cada agente, identifique OBRIGATORIAMENTE:
- enquadramento_insalubridade: true/false se o laudo conclui insalubridade
- grau_insalubridade: "minimo"|"medio"|"maximo" (se insalubre - baseado em NR-15: mínimo=10%, médio=20%, máximo=40%)
- enquadramento_periculosidade: true/false se o laudo conclui periculosidade
- enquadramento_aposentadoria_especial: true/false se há conclusão de exposição habitual e permanente que caracterize aposentadoria especial
- anos_aposentadoria_especial: 15|20|25 (anos necessários para aposentadoria, se aplicável - Decreto 3048/99)
- caracterizado: true se a exposição está caracterizada como nociva, false se não
Normalize tipo_risco: "fisico"|"quimico"|"biologico"|"ergonomico"|"acidente"|"psicossocial"`,
    AET: `fatores ergonômicos da AET. Procure: postura, repetitividade, esforço físico, mobiliário.
Normalize tipo_risco como "ergonomico"`,
    LAUDO_INSALUBRIDADE: `agentes insalubres do laudo. Procure: agente, grau, medição, conclusão.
Normalize tipo_risco: "fisico"|"quimico"|"biologico"`,
    LAUDO_PERICULOSIDADE: `condições perigosas do laudo. Procure: condição, enquadramento, habitualidade.
Normalize tipo_risco como "acidente"`,
  };
  const desc = tipoDesc[tipo] || `riscos e perigos do documento SST. Normalize tipo_risco: "fisico"|"quimico"|"biologico"|"ergonomico"|"acidente"|"psicossocial"`;

  const ltcatExtraFields = tipo === "LTCAT" ? `
      "enquadramento_insalubridade": false,
      "grau_insalubridade": null,
      "enquadramento_periculosidade": false,
      "enquadramento_aposentadoria_especial": false,
      "anos_aposentadoria_especial": null,` : "";

  return `Você é especialista sênior em SST brasileiro. Analisando trecho ${chunkIndex + 1} de ${totalChunks}.
MISSÃO: Extrair TODOS os itens de ${desc}

REGRAS CRÍTICAS:
1. Cada linha/registro de tabela = um item separado no array. NÃO agrupe linhas.
2. NUNCA use "null", "N/A", "-" como valor. Omita o campo se não encontrar.
3. Campo "risco" DEVE ser nome descritivo real (ex: "Ruído", "Poeira de sílica", "Queda de nível").
4. Se não houver nenhuma tabela de riscos neste trecho, retorne {"inventario_riscos": []}.
5. Não invente dados — extraia APENAS o que está escrito.
${tipo === "LTCAT" ? "6. Para LTCAT: SEMPRE extraia os campos de enquadramento previdenciário (insalubridade, periculosidade, aposentadoria especial) baseado na conclusão técnica do laudo." : ""}

Retorne JSON:
{
  "inventario_riscos": [
    {
      "setor": "Produção",
      "funcao": "Operador de Máquina",
      "risco": "Ruído",
      "tipo_risco": "fisico",
      "fonte_geradora": "Máquinas de produção",
      "intensidade": "85 dB(A)",
      "metodologia": "NHO-01",
      "danos": "Perda auditiva",
      "controles_existentes": ["EPI - protetor auricular"],${ltcatExtraFields}
      "confianca": "alta"
    }
  ]
}`;
}

function buildPlanoAcaoPrompt(tipo: string, isComplementar = false): string {
  const contextoPorTipo: Record<string, string> = {
    PGR: "PRIORIDADE MAXIMA: Cada linha da tabela de Plano de Acao = uma acao separada. Colunas tipicas: Acao/Medida | Setor | Responsavel | Prazo | EPI/EPC | Tipo. Tambem extraia: implantacao de EPC, EPI, treinamentos, adequacoes.",
    PCMSO: "Extraia: exames a incluir/revisar, convocacoes pendentes, adequacoes de fluxo.",
    LTCAT: "Extraia: nova medicao, atualizacao do laudo, revisao de enquadramento, adequacoes ambientais.",
    AET: "Extraia: ajuste de mobiliario, adequacao de posto, pausa, revisao de ritmo, treinamento ergonomico.",
    LAUDO_INSALUBRIDADE: "Extraia: implantacao de EPC, adequacao de protecao, substituicao de agente, controle de exposicao.",
    LAUDO_PERICULOSIDADE: "Extraia: adequacao de area, isolamento, sinalizacao, revisao de procedimento.",
  };
  const contexto = contextoPorTipo[tipo] || "Extraia todas as acoes, recomendacoes e medidas do documento.";
  const parteLabel = isComplementar ? " (PARTE 2)" : " (PARTE 1)";

  return `Voce e especialista senior em SST brasileiro e gestao de riscos. Tipo: ${tipo}${parteLabel}
MISSAO: Extrair TODAS as acoes e recomendacoes deste trecho.
- Tabela de plano de acao: CADA LINHA = uma acao separada.
- Lista de recomendacoes: CADA ITEM = uma acao separada.
- NUNCA invente. So extraia o que esta escrito.
- Prioridade: alta (imediato), media (curto prazo), baixa (longo prazo).
${contexto}

Gatilhos: recomenda-se, devera, sugere-se, e necessario, deve ser, plano de acao, medida de controle, acao corretiva, implantar, realizar

Retorne JSON:
{
  "plano_acao": [
    {
      "recomendacao": "texto fiel da recomendacao",
      "what": "o que fazer", "why": "por que", "where": "onde",
      "who": "responsavel", "when": "prazo", "how": "como",
      "how_much": "custo", "prioridade": "alta",
      "setor": "...", "trecho_origem": "frase exata do doc", "confianca": "alta"
    }
  ]
}`;
}

// ── Deduplicar riscos por chave composta ─────────────────────────────────────
function deduplicarRiscos(riscos: any[]): any[] {
  const seen = new Set<string>();
  return riscos.filter((r) => {
    const key = [
      (r.risco || "").substring(0, 50).toLowerCase().trim(),
      (r.setor || "").substring(0, 30).toLowerCase().trim(),
      (r.funcao || "").substring(0, 30).toLowerCase().trim(),
    ].join("|");
    if (!key.startsWith("|") && seen.has(key)) return false;
    if (key !== "||") seen.add(key);
    return true;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, documento_texto, documento_tipo, documento_nome } = await req.json();
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY nao configurada");

    // ── CLASSIFICAR ──────────────────────────────────────────────────────────
    if (action === "classificar") {
      const amostra = (documento_texto || "").substring(0, 5000);
      const content = await callOpenAI(
        `Voce e um especialista em documentos de SST brasileiro.
Analise o trecho e classifique o tipo de documento.
Tipos possiveis: PGR, PCMSO, LTCAT, PPP, APR, NR12, AEP, AET, LAUDO_INSALUBRIDADE, LAUDO_PERICULOSIDADE, AVALIACAO_AMBIENTAL, RELATORIO_MEDICOES, RELATORIO_AUDITORIA, PARECER_TECNICO, OUTROS
Responda SOMENTE em JSON: {"tipo": "PGR", "confianca": 92, "justificativa": "..."}`,
        `Classifique este documento SST:\n\n${amostra}`,
        "gpt-4o-mini"
      );
      return new Response(JSON.stringify(content), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── EXTRAIR ──────────────────────────────────────────────────────────────
    if (action === "extrair") {
      const textoCompleto = documento_texto || "";
      const tipo = documento_tipo || "DOCUMENTO_SST";
      const totalChars = textoCompleto.length;

      console.log(`Extracao iniciada. Tipo: ${tipo}, Total chars: ${totalChars}`);

      // 1. Dados gerais: usar os primeiros 12k chars (cabeçalho)
      const cabecalho = textoCompleto.substring(0, 12000);

      // 2. Riscos: dividir o documento INTEIRO em chunks e varrer TODOS em paralelo
      //    (máximo MAX_RISK_CHUNKS chunks mais o overlap para cobrir todo o conteúdo)
      const todosChunks = splitIntoChunks(textoCompleto, CHUNK_SIZE, 3000);
      // Limitar a MAX_RISK_CHUNKS chunks mais relevantes — mas se o doc for menor, usar todos
      const chunksParaRiscos = todosChunks.length <= MAX_RISK_CHUNKS
        ? todosChunks
        : (() => {
            // Selecionar chunks distribuídos ao longo do documento (não apenas os primeiros)
            const step = Math.floor(todosChunks.length / MAX_RISK_CHUNKS);
            return Array.from({ length: MAX_RISK_CHUNKS }, (_, i) => todosChunks[Math.min(i * step, todosChunks.length - 1)]);
          })();

      // 3. Plano de ação: localizar seção específica
      const planStart = findPlanStart(textoCompleto);
      const planoAcaoParte1 = textoCompleto.substring(planStart, Math.min(planStart + CHUNK_SIZE, totalChars));
      const planoAcaoParte2 = planStart + CHUNK_SIZE < totalChars
        ? textoCompleto.substring(planStart + CHUNK_SIZE, Math.min(planStart + CHUNK_SIZE * 2, totalChars))
        : "";

      console.log(`Chunks riscos: ${chunksParaRiscos.length} (de ${todosChunks.length} total) | planStart@${planStart}/${totalChars}`);

      // 4. Disparar todas as chamadas em paralelo
      const promptDadosGerais = buildDadosGeraisPrompt(tipo);
      const promptPlano1 = buildPlanoAcaoPrompt(tipo, false);
      const promptPlano2 = buildPlanoAcaoPrompt(tipo, true);

      const promiseDados = callOpenAI(promptDadosGerais, `Documento ${tipo} - Cabeçalho:\n\n${cabecalho}`);
      const promisesRiscos = chunksParaRiscos.map((chunk, i) =>
        callOpenAI(
          buildRiscosPrompt(tipo, i, chunksParaRiscos.length),
          `Documento ${tipo} - Trecho ${i + 1}/${chunksParaRiscos.length}:\n\n${chunk}`
        )
      );
      const promisePlano1 = callOpenAI(promptPlano1, `Documento ${tipo} - Plano de Ação (parte 1):\n\n${planoAcaoParte1}`);
      const promisePlano2 = planoAcaoParte2.length > 500
        ? callOpenAI(promptPlano2, `Documento ${tipo} - Plano de Ação (parte 2):\n\n${planoAcaoParte2}`)
        : Promise.resolve(null);

      console.log(`Disparando ${1 + promisesRiscos.length + 1 + (planoAcaoParte2.length > 500 ? 1 : 0)} chamadas paralelas OpenAI...`);

      const [resultDados, ...restResults] = await Promise.all([
        promiseDados,
        ...promisesRiscos,
        promisePlano1,
        promisePlano2,
      ]);

      const resultadosRiscos = restResults.slice(0, promisesRiscos.length);
      const resultPlano1 = restResults[promisesRiscos.length];
      const resultPlano2 = restResults[promisesRiscos.length + 1];

      // 5. Mesclar riscos de todos os chunks e deduplicar
      const todosRiscosRaw: any[] = [];
      for (let i = 0; i < resultadosRiscos.length; i++) {
        const inv = resultadosRiscos[i]?.inventario_riscos || [];
        const exames = resultadosRiscos[i]?.matriz_exames || [];
        const fatores = resultadosRiscos[i]?.fatores_ergonomicos || [];
        console.log(`Chunk ${i + 1}: ${inv.length} riscos, ${exames.length} exames, ${fatores.length} fatores`);
        todosRiscosRaw.push(...inv);
      }

      const matrizExamesRaw: any[] = resultadosRiscos.flatMap(r => r?.matriz_exames || []);
      const fatoresErgonomicosRaw: any[] = resultadosRiscos.flatMap(r => r?.fatores_ergonomicos || []);

      const inventarioRiscosValidos = deduplicarRiscos(
        todosRiscosRaw.filter((r: any) => r && r.risco && String(r.risco).trim() !== "")
      );
      // Para PCMSO, deduplicar exames por cargo+setor (não por risco)
      const deduplicarExames = (exames: any[]): any[] => {
        const seen = new Set<string>();
        return exames.filter((e) => {
          const key = [(e.cargo || "").substring(0, 60).toLowerCase().trim(), (e.setor || "").substring(0, 30).toLowerCase().trim()].join("|");
          if (seen.has(key)) return false;
          if (key !== "|") seen.add(key);
          return true;
        });
      };
      const matrizExames = deduplicarExames(matrizExamesRaw.filter((e: any) => e && e.cargo));
      const fatoresErgonomicos = deduplicarRiscos(fatoresErgonomicosRaw.filter((f: any) => f && f.posto));

      // 6. Mesclar e deduplicar ações
      const todasAcoes = [
        ...(resultPlano1?.plano_acao || []),
        ...(resultPlano2?.plano_acao || []),
      ];
      const planoAcaoExtraido = todasAcoes.filter((acao: any, idx: number) => {
        const key = (acao.what || acao.recomendacao || "").substring(0, 80).toLowerCase().trim();
        if (!key) return false;
        return todasAcoes.findIndex((a: any) =>
          (a.what || a.recomendacao || "").substring(0, 80).toLowerCase().trim() === key
        ) === idx;
      });

      // 7. Funções derivadas dos riscos (se não extraídas diretamente)
      let funcoesAtividades = resultDados?.funcoes_atividades || [];
      if (funcoesAtividades.length === 0 && inventarioRiscosValidos.length > 0) {
        const cargosMap = new Map<string, { cargo: string; setor: string; atividades: string[] }>();
        for (const r of inventarioRiscosValidos) {
          if (r.funcao && r.funcao !== "null" && r.funcao !== "") {
            const key = r.funcao.trim().toLowerCase();
            if (!cargosMap.has(key)) cargosMap.set(key, { cargo: r.funcao.trim(), setor: r.setor || "", atividades: [] });
          }
        }
        funcoesAtividades = Array.from(cargosMap.values());
      }
      if (funcoesAtividades.length === 0 && matrizExames.length > 0) {
        const cargosMap = new Map<string, { cargo: string; setor: string; atividades: string[] }>();
        for (const e of matrizExames) {
          if (e.cargo) {
            const key = e.cargo.trim().toLowerCase();
            if (!cargosMap.has(key)) cargosMap.set(key, { cargo: e.cargo.trim(), setor: e.setor || "", atividades: [] });
          }
        }
        funcoesAtividades = Array.from(cargosMap.values());
      }
      funcoesAtividades = funcoesAtividades.filter((f: any) => f && f.cargo && f.cargo !== "null" && f.cargo !== "");

      console.log(`Resultado final: ${inventarioRiscosValidos.length} riscos únicos, ${matrizExames.length} exames, ${planoAcaoExtraido.length} ações`);

      // 8. Score de qualidade
      const calcScore = (obj: any): number => {
        if (!obj) return 0;
        const vals = Object.values(obj);
        const filled = vals.filter((v) => v !== null && v !== "" && v !== undefined);
        return Math.round((filled.length / vals.length) * 100);
      };

      const dg = resultDados?.dados_gerais || {};
      const dgScore = calcScore(Object.fromEntries(Object.entries(dg).map(([k, v]: any) => [k, v?.valor])));

      let invCount = inventarioRiscosValidos.length;
      if (tipo === "PCMSO") invCount = Math.max(invCount, matrizExames.length);
      if (tipo === "AET") invCount = Math.max(invCount, fatoresErgonomicos.length);

      const invScore = invCount > 0 ? Math.min(100, Math.round((invCount / 10) * 100)) : 0;
      const paCount = planoAcaoExtraido.length;
      const paScore = paCount > 0 ? Math.min(100, Math.round((paCount / 5) * 100)) : 0;
      const respScore = (resultDados?.responsaveis_tecnicos?.length || 0) > 0 ? 100 : 0;
      const geral = Math.round((dgScore + invScore + paScore + respScore) / 4);

      console.log(`Score [${tipo}]: ${geral}% | DG:${dgScore}% Inv:${invScore}%(${invCount}) PA:${paScore}%(${paCount}) Resp:${respScore}%`);

      // 9. Pendências automáticas
      const pendencias: any[] = [];
      if (invCount === 0) {
        pendencias.push({
          campo: "inventario_riscos",
          motivo: tipo === "PCMSO"
            ? "Nenhum exame/cargo identificado — verifique se a matriz de exames está no documento"
            : "Nenhum risco identificado — o PDF pode ser baseado em imagem (escaneado), tente um PDF nativo com texto selecionável",
          severidade: "critica",
        });
      }
      if (dgScore < 50) pendencias.push({ campo: "dados_gerais", motivo: "Menos de 50% dos dados gerais identificados", severidade: "media" });
      if (paCount === 0) pendencias.push({ campo: "plano_acao", motivo: "Nenhuma recomendação ou ação identificada", severidade: "media" });
      if ((resultDados?.responsaveis_tecnicos?.length || 0) === 0) pendencias.push({ campo: "responsaveis_tecnicos", motivo: "Responsável técnico não identificado", severidade: "media" });
      if (!dg.data_vigencia?.valor) pendencias.push({ campo: "data_vigencia", motivo: "Vigência não identificada — necessária para controle de vencimento", severidade: "media" });

      const content = {
        tipo_documento: tipo,
        dados_gerais: dg,
        estrutura_organizacional: resultDados?.estrutura_organizacional || { unidades: [], setores: [], departamentos: [] },
        funcoes_atividades: funcoesAtividades,
        inventario_riscos: inventarioRiscosValidos,
        matriz_exames: matrizExames,
        fatores_ergonomicos: fatoresErgonomicos,
        plano_acao: planoAcaoExtraido,
        responsaveis_tecnicos: resultDados?.responsaveis_tecnicos || [],
        pendencias,
        score_qualidade: { geral, dados_gerais: dgScore, inventario: invScore, plano_acao: paScore, responsaveis: respScore },
      };

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
