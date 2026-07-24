/**
 * Porte da empresa para fins de Plano de Ação PGR.
 *
 * CRITÉRIO: número de pessoas ocupadas por CNPJ, na classificação IBGE/SEBRAE,
 * que é a única classificação brasileira de porte baseada em headcount.
 *
 *   Comércio e serviços     Micro ≤ 9 | Pequena 10–49 | Média 50–99 | Grande ≥ 100
 *   Indústria e construção  Micro ≤ 19 | Pequena 20–99 | Média 100–499 | Grande ≥ 500
 *
 * Fonte: IPEA, Radar nº 55 — "Micro, pequenas e médias empresas: conceitos e
 * estatísticas", que documenta o critério de pessoal ocupado do SEBRAE, aplicado
 * sobre as pesquisas estruturais do IBGE (PIA, PAIC, PAS, PAC).
 *
 * IMPORTANTE — o que este critério NÃO é:
 *  • Não é a Lei Complementar 123/2006. ME e EPP ali são definidas por RECEITA
 *    BRUTA ANUAL (até R$ 360 mil e até R$ 4,8 milhões), não por empregados.
 *  • Não é a NR-01. O item 1.8 dá tratamento diferenciado a MEI, ME e EPP, mas
 *    se apoia no enquadramento da LC 123 combinado com o grau de risco do CNAE
 *    (NR-04). A NR-01 NÃO fixa faixa de porte por número de trabalhadores.
 *  • Não é o BNDES, que também usa receita operacional bruta.
 *
 * Por que headcount e não receita: o plano de ação dimensiona ESTRUTURA
 * (comitê, ouvidoria, PAE, brigada de PSSM). Estrutura escala com gente. Uma
 * empresa de 8 pessoas com receita alta não sustenta um Comitê Multidisciplinar
 * de Saúde Mental.
 *
 * Os três modelos de referência (SudoMed) têm três níveis, e o IBGE tem quatro.
 * Pequena e Média são agrupadas na Categoria B, que é como os documentos tratam.
 */

export type PorteEmpresa = "mei" | "pequeno_medio" | "grande";

/** IBGE/SEBRAE separa indústria e construção de comércio e serviços. */
export type SetorPorte = "industria_construcao" | "comercio_servicos";

export interface FaixaPorte {
  porte: PorteEmpresa;
  label: string;
  /** Categoria dos modelos de referência. */
  categoria: string;
  min: number;
  /** null = sem limite superior. */
  max: number | null;
  /** Contexto passado à IA para calibrar o registro das ações. */
  perfil: string;
}

const PERFIL: Record<PorteEmpresa, string> = {
  mei:
    "Estrutura enxuta, sem RH nem SESMT dedicados. O próprio proprietário ou " +
    "gestor direto executa as ações, apoiado por consultoria externa de SST. " +
    "Ações devem ser simples, de baixo custo, presenciais e sem exigir sistema " +
    "ou comitê formal. Nada que pressuponha departamento jurídico, ouvidoria " +
    "própria ou plataforma corporativa.",
  pequeno_medio:
    "Há RH e alguma estrutura de SST, com gestores de departamento. Comporta " +
    "política formalizada, canal de denúncia interno, treinamento de liderança " +
    "e pesquisa de clima. Não comporta diretoria de compliance, ouvidoria " +
    "independente terceirizada nem programa de assistência 24/7.",
  grande:
    "Estrutura corporativa completa: diretorias, comitês multidisciplinares, " +
    "compliance, SESMT próprio e orçamento para programas contínuos. Comporta " +
    "ouvidoria independente auditável, PAE 24/7, brigada de facilitadores, " +
    "governança por indicadores e desdobramento para a cadeia de fornecedores.",
};

const LABEL: Record<PorteEmpresa, { label: string; categoria: string }> = {
  mei: { label: "MEI e Microempresa (ME)", categoria: "Categoria A – MEI e Microempresa" },
  pequeno_medio: {
    label: "Pequeno e Médio Porte",
    categoria: "Categoria B – Pequeno e Médio Porte",
  },
  grande: { label: "Grande Porte", categoria: "Categoria C – Grande Porte" },
};

/** Cortes por setor, agrupando Pequena + Média do IBGE na Categoria B. */
const CORTES: Record<SetorPorte, { mei: number; pequenoMedio: number }> = {
  comercio_servicos: { mei: 9, pequenoMedio: 99 },
  industria_construcao: { mei: 19, pequenoMedio: 499 },
};

export const SETOR_LABEL: Record<SetorPorte, string> = {
  comercio_servicos: "Comércio e serviços",
  industria_construcao: "Indústria e construção",
};

function montarFaixa(porte: PorteEmpresa, min: number, max: number | null): FaixaPorte {
  return { porte, ...LABEL[porte], min, max, perfil: PERFIL[porte] };
}

export function faixasDoSetor(setor: SetorPorte): FaixaPorte[] {
  const c = CORTES[setor];
  return [
    montarFaixa("mei", 0, c.mei),
    montarFaixa("pequeno_medio", c.mei + 1, c.pequenoMedio),
    montarFaixa("grande", c.pequenoMedio + 1, null),
  ];
}

/**
 * Setor a partir da divisão do CNAE principal (dois primeiros dígitos, CNAE 2.0).
 *   05–09 indústrias extrativas
 *   10–33 indústrias de transformação
 *   41–43 construção
 * Tudo o mais cai em comércio e serviços, que é também o default seguro quando
 * não há CNAE: os cortes são mais baixos, então o porte tende a subir, e um
 * plano mais robusto do que o necessário é erro menos grave que o contrário.
 */
export function setorPorCnae(cnae?: string | null): SetorPorte {
  const digitos = (cnae ?? "").replace(/\D/g, "");
  if (digitos.length < 2) return "comercio_servicos";
  const divisao = Number(digitos.slice(0, 2));
  const industria =
    (divisao >= 5 && divisao <= 9) ||
    (divisao >= 10 && divisao <= 33) ||
    (divisao >= 41 && divisao <= 43);
  return industria ? "industria_construcao" : "comercio_servicos";
}

export function classificarPorte(colaboradores: number, setor: SetorPorte): FaixaPorte {
  const n = Math.max(0, Math.floor(colaboradores || 0));
  const faixas = faixasDoSetor(setor);
  return faixas.find(f => n >= f.min && (f.max === null || n <= f.max)) ?? faixas[faixas.length - 1];
}

/** Faixa em texto, para exibir ao lado do porte. */
export function faixaEmTexto(faixa: FaixaPorte): string {
  if (faixa.max === null) return `${faixa.min} ou mais colaboradores`;
  if (faixa.min === 0) return `até ${faixa.max} colaboradores`;
  return `de ${faixa.min} a ${faixa.max} colaboradores`;
}
