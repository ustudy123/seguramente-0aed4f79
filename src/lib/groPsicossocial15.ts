/**
 * Metodologia de Graduação de Risco Psicossocial — P x S (escala 1-5)
 *
 * Fonte única das tabelas 4.1 (Probabilidade), 4.2 (Severidade) e 4.3
 * (Nível de GRO) do relatório psicossocial, garantindo a MESMA nomenclatura
 * no PDF, no Inventário PGR e em qualquer outra tela.
 *
 * Regras de negócio:
 * - PROBABILIDADE é variável: deriva do score apurado nas respostas.
 * - SEVERIDADE é fixa por fator de risco: vem do catálogo de riscos
 *   psicossociais (tabela psicossocial_riscos, campo severidade 1-5).
 * - NÍVEL DE GRO = cruzamento P x S na matriz abaixo (inclui TRIVIAL).
 */
import { getSeveridadeInfo } from "@/lib/psicossocial-severidade";

export type Prob15 = 1 | 2 | 3 | 4 | 5;
export type Sev15 = 1 | 2 | 3 | 4 | 5;
export type NivelGRO15 = "trivial" | "baixo" | "medio" | "alto" | "critico";

/** Nomenclatura da Tabela 4.1 — Probabilidade */
export const PROB15_LABELS: Record<Prob15, string> = {
  1: "Aceitável/Improvável",
  2: "Remota",
  3: "Possível",
  4: "Frequente",
  5: "Quase Certa",
};

/**
 * Matriz da Tabela 4.3 — Nível de GRO.
 * Linha = probabilidade (1-5), coluna = severidade (1-5).
 */
const M: Record<Prob15, Record<Sev15, NivelGRO15>> = {
  5: { 1: "medio", 2: "medio", 3: "alto", 4: "critico", 5: "critico" },
  4: { 1: "medio", 2: "medio", 3: "medio", 4: "alto", 5: "critico" },
  3: { 1: "baixo", 2: "baixo", 3: "medio", 4: "alto", 5: "alto" },
  2: { 1: "trivial", 2: "baixo", 3: "baixo", 4: "medio", 5: "alto" },
  1: { 1: "trivial", 2: "trivial", 3: "baixo", 4: "baixo", 5: "medio" },
};

export function nivelGRO15(prob: Prob15, sev: Sev15): NivelGRO15 {
  return M[prob][sev];
}

/** Tokens exatamente como exibidos na matriz 4.3 */
export const NIVEL15_TOKENS: Record<NivelGRO15, string> = {
  trivial: "TRIVIAL",
  baixo: "BAIXO",
  medio: "MÉDIO",
  alto: "ALTO",
  critico: "CRÍTICO",
};

export const NIVEL15_LABELS: Record<NivelGRO15, string> = {
  trivial: "Risco Trivial",
  baixo: "Risco Baixo",
  medio: "Risco Médio",
  alto: "Risco Alto",
  critico: "Risco Crítico",
};

/** Ordem de severidade para ordenação (mais grave primeiro) */
export const NIVEL15_ORDEM: Record<NivelGRO15, number> = {
  critico: 0,
  alto: 1,
  medio: 2,
  baixo: 3,
  trivial: 4,
};

/**
 * Converte o score de risco da dimensão (0-100, alto = pior) em
 * probabilidade 1-5. Mesmos cortes históricos do sistema.
 */
export function scoreToProb15(scoreRisco: number): Prob15 {
  if (scoreRisco >= 75) return 5;
  if (scoreRisco >= 55) return 4;
  if (scoreRisco >= 35) return 3;
  if (scoreRisco >= 20) return 2;
  return 1;
}

/** Rótulo "N - Nome" para exibição rastreável às tabelas 4.1/4.2 */
export function probDisplay(p: Prob15): string {
  return `${p} - ${PROB15_LABELS[p]}`;
}

export function sevDisplay(s: Sev15): string {
  return `${s} - ${getSeveridadeInfo(s)?.label ?? s}`;
}

/**
 * Fallback de severidade quando o fator não está no catálogo
 * (ex.: dimensão não catalogada de instrumento externo): deriva do score,
 * espelhando a régua antiga, para nunca quebrar o relatório.
 */
export function sevFallbackFromScore(scoreRisco: number): Sev15 {
  if (scoreRisco >= 75) return 5;
  if (scoreRisco >= 55) return 4;
  if (scoreRisco >= 35) return 3;
  return 2;
}

/** Normaliza nomes de fatores para casar com o catálogo (acentos/caixa) */
export function normalizarNomeFator(nome: string): string {
  return (nome || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cores (Tailwind) por nível, incluindo TRIVIAL */
export const NIVEL15_BADGE: Record<NivelGRO15, string> = {
  trivial: "bg-slate-50 text-slate-600 border-slate-200",
  baixo: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medio: "bg-amber-50 text-amber-700 border-amber-200",
  alto: "bg-orange-50 text-orange-700 border-orange-200",
  critico: "bg-red-50 text-red-700 border-red-200",
};
