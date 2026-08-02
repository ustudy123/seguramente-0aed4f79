/**
 * Alertas de irregularidade do dia no Espelho de Ponto.
 *
 * Duas decisões saem daqui e são usadas juntas na renderização:
 *
 * 1. `jornadaCoberta` — a jornada prevista foi integralmente fechada pela
 *    soma de atestado (parcial, em horas) + tempo trabalhado. Nesse caso a
 *    ausência é amparada e NÃO deve gerar alerta de saída antecipada.
 *    Caso real: atestado de 7h26 + trabalho de 1h12 fecham a jornada de
 *    8h38, mas o espelho acusava "Saída antecipada de 3h10".
 *
 * 2. `excedeLimiteDiario` — o total do dia ultrapassou a jornada acrescida
 *    de 2 horas suplementares (art. 59, caput, CLT). Caso real: 10h53
 *    trabalhadas contra um teto de 10h38, exibido como "Regular".
 */

/** Teto de horas suplementares por dia (art. 59, caput, CLT). */
export const LIMITE_EXTRA_DIARIO_MIN = 120;

export interface CoberturaJornadaInput {
  /** Jornada prevista na escala para o dia, em minutos. 0 = desconhecida. */
  jornadaPrevistaMin: number;
  /** Minutos de atestado de HORAS vigente no dia (0 quando não há). */
  atestadoMin: number;
  /** Total efetivamente trabalhado no dia, em minutos. */
  totalMin: number;
  /** Folga em minutos para arredondamento de borda. */
  toleranciaMin?: number;
}

export interface CoberturaJornada {
  /** Jornada fechada por atestado + trabalho: não sinalizar saída antecipada. */
  jornadaCoberta: boolean;
  /** Minutos acima da jornada + 2h suplementares (0 quando dentro do teto). */
  excedenteLimiteMin: number;
  /** Atalho de leitura para `excedenteLimiteMin > 0`. */
  excedeLimiteDiario: boolean;
}

export function calcularCoberturaJornada({
  jornadaPrevistaMin,
  atestadoMin,
  totalMin,
  toleranciaMin = 5,
}: CoberturaJornadaInput): CoberturaJornada {
  const jornada = Math.max(0, jornadaPrevistaMin || 0);
  const trabalhado = Math.max(0, totalMin || 0);
  const atestado = Math.max(0, atestadoMin || 0);

  // Sem jornada conhecida não há como afirmar cobertura nem excesso — o
  // silêncio é proposital: melhor não alertar do que alertar errado.
  if (jornada <= 0) {
    return { jornadaCoberta: false, excedenteLimiteMin: 0, excedeLimiteDiario: false };
  }

  const jornadaCoberta = atestado + trabalhado >= jornada - toleranciaMin;
  const excedenteLimiteMin = Math.max(0, trabalhado - (jornada + LIMITE_EXTRA_DIARIO_MIN));

  return {
    jornadaCoberta,
    excedenteLimiteMin,
    excedeLimiteDiario: excedenteLimiteMin > 0,
  };
}

/** "3h10" / "45min" — mesmo formato já usado nos selos do espelho. */
export function formatarMinutosCurto(min: number): string {
  const m = Math.max(0, Math.round(min));
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m}min`;
}
