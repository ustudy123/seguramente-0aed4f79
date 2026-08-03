/**
 * RN19 — Fonte única de formatação de durações do módulo Ponto.
 *
 * Todas as telas (Espelho, Escalas, Banco de Horas, Folha, Fechamento,
 * Relatórios) devem importar daqui. Implementações locais são proibidas:
 * foi justamente a duplicação que gerou divergência entre telas
 * ("8h30" vs "8h 30min" vs "8:30" para o mesmo valor).
 */

const norm = (min: number): number => Math.round(Number(min) || 0);

export interface FormatoHoraOpts {
  /** Prefixa "+" para valores positivos (colunas de saldo). */
  sinal?: boolean;
}

/** Formato canônico: "8h 30min" / "-1h 05min" / "+0h 11min". */
export function formatarHoraMinuto(min: number, opts?: FormatoHoraOpts): string {
  const total = norm(min);
  const abs = Math.abs(total);
  const prefixo = opts?.sinal ? (total < 0 ? "-" : "+") : total < 0 ? "-" : "";
  return `${prefixo}${Math.floor(abs / 60)}h ${String(abs % 60).padStart(2, "0")}min`;
}

/** Formato compacto para selos e chips: "3h10" / "45min". Sempre absoluto. */
export function formatarMinutosCurto(min: number): string {
  const abs = Math.abs(norm(min));
  return abs >= 60 ? `${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, "0")}` : `${abs}min`;
}

/** Formato relógio para exportações e folha: "8:30" / "-1:05". */
export function formatarHoraRelogio(min: number): string {
  const total = norm(min);
  const abs = Math.abs(total);
  return `${total < 0 ? "-" : ""}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}

/** Saldo sempre sinalizado, com "—" quando neutro. */
export function formatarSaldo(min: number, opts?: { neutroComoTraco?: boolean }): string {
  const total = norm(min);
  if (total === 0 && opts?.neutroComoTraco) return "—";
  return formatarHoraMinuto(total, { sinal: true });
}
