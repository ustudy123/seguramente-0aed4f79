/**
 * Escala de Severidade dos Riscos Psicossociais (1 a 5)
 * Conforme NR-1, ISO 45003 e referência clínica.
 */

export interface SeveridadeInfo {
  valor: number;
  label: string;
  exemplo: string;
  badgeClass: string;
  textClass: string;
  bgClass: string;
}

export const SEVERIDADE_ESCALA: SeveridadeInfo[] = [
  {
    valor: 1,
    label: "Insignificante",
    exemplo: "Sem dano ou dano mínimo reversível. Desconforto pontual, sem afastamento.",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    textClass: "text-emerald-700",
    bgClass: "bg-emerald-500",
  },
  {
    valor: 2,
    label: "Menor",
    exemplo: "Dano leve, reversível. Ansiedade situacional, irritabilidade.",
    badgeClass: "bg-lime-50 text-lime-700 border-lime-200",
    textClass: "text-lime-700",
    bgClass: "bg-lime-500",
  },
  {
    valor: 3,
    label: "Moderado",
    exemplo: "Dano com necessidade de tratamento. Síndrome de Burnout leve, afastamento curto.",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    textClass: "text-amber-700",
    bgClass: "bg-amber-500",
  },
  {
    valor: 4,
    label: "Grave",
    exemplo: "Dano severo, longa recuperação. Depressão grave, TEPT, afastamento prolongado.",
    badgeClass: "bg-orange-50 text-orange-700 border-orange-200",
    textClass: "text-orange-700",
    bgClass: "bg-orange-500",
  },
  {
    valor: 5,
    label: "Catastrófico",
    exemplo: "Incapacidade permanente ou óbito. Suicídio, invalidez permanente.",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    textClass: "text-rose-700",
    bgClass: "bg-rose-500",
  },
];

export const PROBABILIDADE_ESCALA = [
  { valor: 1, label: "Improvável", criterio: "Situação controlada, raramente ocorre. Histórico sem registros nos últimos 2 anos." },
  { valor: 2, label: "Possível", criterio: "Pode ocorrer em circunstâncias específicas. Registro esporádico ou relato isolado." },
  { valor: 3, label: "Provável", criterio: "Ocorre com alguma frequência. Relatos recorrentes, dados de afastamento." },
  { valor: 4, label: "Muito Provável", criterio: "Ocorre frequentemente. Alta frequência, padrão sistêmico identificado." },
  { valor: 5, label: "Certo", criterio: "Está ocorrendo ou ocorrerá em breve. Situação ativa e confirmada." },
];

export function getSeveridadeInfo(valor: number | null | undefined): SeveridadeInfo | null {
  if (!valor) return null;
  return SEVERIDADE_ESCALA.find((s) => s.valor === valor) ?? null;
}
