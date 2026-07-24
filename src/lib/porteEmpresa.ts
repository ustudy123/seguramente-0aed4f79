/**
 * Porte da empresa para fins de Plano de Ação PGR.
 *
 * O parâmetro é a QUANTIDADE DE COLABORADORES ATIVOS POR CNPJ — não o
 * enquadramento da Receita Federal (que usa receita bruta) nem o porte
 * devolvido pela BrasilAPI. Motivo: o plano de ação dimensiona estrutura
 * (comitê, ouvidoria, PAE, brigada de PSSM), e isso escala com gente, não com
 * faturamento. Uma empresa de 8 pessoas com receita alta não sustenta um
 * Comitê Multidisciplinar de Saúde Mental.
 *
 * Faixas: alinhadas ao limite de 19 trabalhadores que a NR-01 usa para o
 * regime simplificado de PGR (item 1.8.1), e ao corte de 100 do SEBRAE para
 * grande porte em comércio e serviços.
 *
 * São um DEFAULT, não uma imposição normativa — a NR-01 não fixa faixas de
 * porte por headcount. Se a empresa tiver critério próprio, ajuste aqui: este
 * arquivo é a fonte única da classificação.
 */

export type PorteEmpresa = "mei" | "pequeno_medio" | "grande";

export interface FaixaPorte {
  porte: PorteEmpresa;
  /** Rótulo como aparece no relatório. */
  label: string;
  /** Categoria dos modelos de referência da SudoMed. */
  categoria: string;
  min: number;
  /** null = sem limite superior. */
  max: number | null;
  /** Contexto passado à IA para calibrar o registro das ações. */
  perfil: string;
}

export const FAIXAS_PORTE: FaixaPorte[] = [
  {
    porte: "mei",
    label: "MEI e Microempresa (ME)",
    categoria: "Categoria A – MEI e Microempresa",
    min: 0,
    max: 19,
    perfil:
      "Estrutura enxuta, sem RH nem SESMT dedicados. O próprio proprietário ou " +
      "gestor direto executa as ações, apoiado por consultoria externa de SST. " +
      "Ações devem ser simples, de baixo custo, presenciais e sem exigir sistema " +
      "ou comitê formal. Nada que pressuponha departamento jurídico, ouvidoria " +
      "própria ou plataforma corporativa.",
  },
  {
    porte: "pequeno_medio",
    label: "Pequeno e Médio Porte",
    categoria: "Categoria B – Pequeno e Médio Porte",
    min: 20,
    max: 99,
    perfil:
      "Há RH e alguma estrutura de SST, com gestores de departamento. Comporta " +
      "política formalizada, canal de denúncia interno, treinamento de liderança " +
      "e pesquisa de clima. Não comporta diretoria de compliance, ouvidoria " +
      "independente terceirizada nem programa de assistência 24/7.",
  },
  {
    porte: "grande",
    label: "Grande Porte",
    categoria: "Categoria C – Grande Porte",
    min: 100,
    max: null,
    perfil:
      "Estrutura corporativa completa: diretorias, comitês multidisciplinares, " +
      "compliance, SESMT próprio e orçamento para programas contínuos. Comporta " +
      "ouvidoria independente auditável, PAE 24/7, brigada de facilitadores, " +
      "governança por indicadores e desdobramento para a cadeia de fornecedores.",
  },
];

/** Classifica pelo número de colaboradores ativos do CNPJ. */
export function classificarPorte(colaboradores: number): FaixaPorte {
  const n = Math.max(0, Math.floor(colaboradores || 0));
  return (
    FAIXAS_PORTE.find(f => n >= f.min && (f.max === null || n <= f.max)) ??
    FAIXAS_PORTE[FAIXAS_PORTE.length - 1]
  );
}

/** Ex.: "Pequeno e Médio Porte (34 colaboradores)" */
export function descreverPorte(colaboradores: number): string {
  const faixa = classificarPorte(colaboradores);
  return `${faixa.label} (${colaboradores} colaborador${colaboradores === 1 ? "" : "es"})`;
}

/** Faixa em texto, para exibir na tela ao lado do porte. */
export function faixaEmTexto(faixa: FaixaPorte): string {
  if (faixa.max === null) return `${faixa.min} ou mais colaboradores`;
  if (faixa.min === 0) return `até ${faixa.max} colaboradores`;
  return `de ${faixa.min} a ${faixa.max} colaboradores`;
}
