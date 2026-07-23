// Cálculo do saldo diário aplicando a tolerância de forma correta:
// a tolerância é aplicada NA BATIDA (perdoa quem está dentro da janela),
// não no saldo consolidado. Assim, atrasos fora da tolerância viram
// débito integral e extras reais são contados integralmente.

const HHMM_RE = /^(\d{1,2}):(\d{2})/;

function toMinutes(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = HHMM_RE.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

export interface CalcularSaldoDiaInput {
  entradaReal?: string | null;       // HH:MM
  saidaReal?: string | null;         // HH:MM
  entradaEscala?: string | null;     // HH:MM
  saidaEscala?: string | null;       // HH:MM
  intervaloMin?: number | null;      // minutos de intervalo (almoço) da escala
  jornadaEsperadaMin: number;        // jornada oficial líquida (sem intervalo)
  toleranciaBatidaMin?: number | null; // default 10
  trabalhadoBrutoMin?: number | null;  // fallback quando não há escala definida
}

export interface CalcularSaldoDiaResult {
  saldoMin: number;
  trabalhadoAjustadoMin: number;
  usouAjuste: boolean;
}

/**
 * @deprecated NÃO é mais a fonte da verdade do saldo diário.
 *
 * A regra de crédito/débito por dia agora vive UMA única vez, no banco:
 * a função SQL `ponto_saldo_dias_competencia`. A apuração soma dela e a tela
 * de edição do banco de horas lê dela.
 *
 * Esta função existia em paralelo à implementação SQL, e manter as duas em
 * sincronia se mostrou inviável: a cada ajuste numa delas sobrava uma
 * diferença na outra, e as telas voltavam a divergir. Mantida apenas como
 * referência da regra (tolerância simétrica na batida) e para eventuais
 * cálculos locais que não alimentem o banco de horas.
 */
export function calcularSaldoDia(input: CalcularSaldoDiaInput): CalcularSaldoDiaResult {
  const tol = Math.max(0, input.toleranciaBatidaMin ?? 10);
  const jornada = Math.max(0, input.jornadaEsperadaMin || 0);

  const entradaReal = toMinutes(input.entradaReal);
  const saidaReal = toMinutes(input.saidaReal);
  const entradaEscala = toMinutes(input.entradaEscala);
  const saidaEscala = toMinutes(input.saidaEscala);
  const intervalo = Math.max(0, input.intervaloMin ?? 0);

  // Sem escala definida, cai no cálculo antigo: bruto - jornada
  if (entradaEscala == null || saidaEscala == null || entradaReal == null || saidaReal == null) {
    const bruto = Math.max(0, input.trabalhadoBrutoMin ?? 0);
    const saldo = jornada > 0 ? bruto - jornada : 0;
    return { saldoMin: saldo, trabalhadoAjustadoMin: bruto, usouAjuste: false };
  }

  // Tolerância SIMÉTRICA, aplicada na batida (regra da empresa: 10 min).
  // Dentro da tolerância (para mais ou para menos) considera-se o horário
  // oficial — não gera crédito nem débito. Fora dela, vale o horário REAL e o
  // tempo conta CHEIO, não só o que excede: chegar 11 min atrasado é 11 min de
  // débito; sair 11 min depois é 11 min de crédito.
  //
  // A simetria vale para os dois lados de cada batida — antes, sair mais tarde
  // creditava desde o primeiro minuto (sem tolerância) e chegar adiantado nunca
  // creditava. Agora os dois passam pela mesma janela de 10 min.
  const dentroDaTolerancia = (real: number, oficial: number) =>
    Math.abs(real - oficial) <= tol;

  const entradaConsiderada = dentroDaTolerancia(entradaReal, entradaEscala)
    ? entradaEscala
    : entradaReal;

  const saidaConsiderada = dentroDaTolerancia(saidaReal, saidaEscala)
    ? saidaEscala
    : saidaReal;

  const trabalhadoAjustado = Math.max(0, saidaConsiderada - entradaConsiderada - intervalo);
  const saldo = jornada > 0 ? trabalhadoAjustado - jornada : 0;
  return { saldoMin: saldo, trabalhadoAjustadoMin: trabalhadoAjustado, usouAjuste: true };
}
