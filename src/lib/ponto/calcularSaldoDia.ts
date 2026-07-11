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
  toleranciaBatidaMin?: number | null; // default 5
  trabalhadoBrutoMin?: number | null;  // fallback quando não há escala definida
}

export interface CalcularSaldoDiaResult {
  saldoMin: number;
  trabalhadoAjustadoMin: number;
  usouAjuste: boolean;
}

export function calcularSaldoDia(input: CalcularSaldoDiaInput): CalcularSaldoDiaResult {
  const tol = Math.max(0, input.toleranciaBatidaMin ?? 5);
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

  // Entrada: dentro da tolerância → considera horário oficial; fora → considera real (atraso integral)
  const entradaConsiderada = entradaReal <= entradaEscala + tol
    ? entradaEscala
    : entradaReal;

  // Saída: dentro da tolerância (saiu até `tol` min antes) → considera oficial;
  // saída ≥ oficial → considera real (extras integrais); saída muito antes → real (débito integral).
  let saidaConsiderada: number;
  if (saidaReal >= saidaEscala) {
    saidaConsiderada = saidaReal;
  } else if (saidaReal >= saidaEscala - tol) {
    saidaConsiderada = saidaEscala;
  } else {
    saidaConsiderada = saidaReal;
  }

  const trabalhadoAjustado = Math.max(0, saidaConsiderada - entradaConsiderada - intervalo);
  const saldo = jornada > 0 ? trabalhadoAjustado - jornada : 0;
  return { saldoMin: saldo, trabalhadoAjustadoMin: trabalhadoAjustado, usouAjuste: true };
}
