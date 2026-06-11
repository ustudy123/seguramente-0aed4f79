import { format, parseISO, type Locale } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Converte um valor de data em um objeto Date interpretado no fuso LOCAL.
 *
 * O problema: campos do tipo `DATE` no Postgres chegam ao front como string
 * pura "yyyy-MM-dd". `new Date("2026-06-10")` é interpretado como meia-noite
 * em UTC — que, em qualquer fuso a oeste de Greenwich (todo o Brasil, -03h),
 * "volta" para 09/06 21h. Resultado: a data aparece um dia antes da informada.
 *
 * `parseISO` (date-fns) interpreta "2026-06-10" como data LOCAL, sem esse
 * deslocamento. Para strings que já tragam hora/timezone (timestamptz), ou
 * para objetos Date, devolvemos como estão.
 */
export function toDateLocal(value: string | number | Date | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);

  const str = String(value).trim();
  if (!str) return null;

  // Data pura "yyyy-MM-dd" (sem hora) → parse local via parseISO.
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return parseISO(str);
  }

  // Já tem hora/timezone (timestamp) — new Date lida corretamente.
  return new Date(str);
}

/**
 * Formata uma data `DATE` pura para exibição, sem o bug de fuso (-1 dia).
 * Substitui o padrão inseguro `format(new Date(campo), ...)`.
 *
 * @param value   string "yyyy-MM-dd", Date ou timestamp
 * @param pattern padrão date-fns (default "dd/MM/yyyy")
 * @param locale  locale date-fns (default ptBR)
 * @returns       string formatada, ou "" se o valor for nulo/inválido
 */
export function formatDateBR(
  value: string | number | Date | null | undefined,
  pattern = "dd/MM/yyyy",
  locale: Locale = ptBR,
): string {
  const d = toDateLocal(value);
  if (!d || isNaN(d.getTime())) return "";
  return format(d, pattern, { locale });
}
