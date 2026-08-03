/**
 * Rotulagem de dias no Espelho de Ponto e no Banco de Horas.
 *
 * RN14 — sábados fora do dia de equalização exibem apenas a abreviação do
 *        dia da semana ("SAB"), sem rótulo "Compensado": só o sábado de
 *        equalização tem obrigação de jornada no mês, e usar "Compensado"
 *        em todos sugeriria uma transação de compensação semanal que não
 *        existe.
 * RN15 — domingos exibem "DSR" (Descanso Semanal Remunerado). O rótulo NÃO
 *        se aplica ao sábado: apenas o domingo tem essa natureza jurídica
 *        (art. 67 CLT; Lei 605/1949).
 * RN16 — toda listagem de dias mostra a abreviação do dia da semana ao lado
 *        da data (ex.: "27/06/2026 SAB").
 * RN19 — minutos sempre com dois dígitos ("8h 08min", não "8h 8min").
 */

export const DIAS_SEMANA_ABREV = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"] as const;

/**
 * Converte "YYYY-MM-DD" em Date no fuso LOCAL.
 * `new Date("2026-06-21")` seria interpretado como UTC e, a oeste de
 * Greenwich, voltaria o dia anterior — trocando o dia da semana.
 */
export function dataLocalDeISO(dataISO: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dataISO || ""));
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d));
}

/** "2026-06-27" → "SAB". String vazia quando a data é inválida. */
export function abreviacaoDiaSemana(dataISO: string): string {
  const dt = dataLocalDeISO(dataISO);
  return dt ? DIAS_SEMANA_ABREV[dt.getDay()] : "";
}

export function ehDomingo(dataISO: string): boolean {
  return dataLocalDeISO(dataISO)?.getDay() === 0;
}

export function ehSabado(dataISO: string): boolean {
  return dataLocalDeISO(dataISO)?.getDay() === 6;
}

/**
 * Rótulo do tipo de dia (RN14/RN15), ou null quando o dia não pede rótulo.
 * O sábado de equalização mantém o rótulo próprio, já existente na tela.
 */
export function rotuloTipoDia(dataISO: string, opts?: { equalizacao?: boolean }): string | null {
  if (opts?.equalizacao) return "Equalização";
  if (ehDomingo(dataISO)) return "DSR";
  return null; // sábado comum e dias úteis: basta a abreviação do dia da semana
}

/** RN19 — reexport da fonte única (`@/lib/ponto/formatoHoras`). */
export { formatarHoraMinuto } from "./formatoHoras";

