/**
 * Utilitários para formatação de CEI e CAEPF
 */

export function cleanCei(value: string): string {
  return value.replace(/\D/g, "");
}

/** Formata CEI: XX.XXX.XXXXX/XX */
export function formatCei(value: string): string {
  const n = cleanCei(value);
  if (n.length <= 2) return n;
  if (n.length <= 5) return `${n.slice(0, 2)}.${n.slice(2)}`;
  if (n.length <= 10) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5)}`;
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 10)}/${n.slice(10, 12)}`;
}

export function cleanCaepf(value: string): string {
  return value.replace(/\D/g, "");
}

/** Formata CAEPF: XXX.XXX.XXX/XXXX-XX */
export function formatCaepf(value: string): string {
  const n = cleanCaepf(value);
  if (n.length <= 3) return n;
  if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`;
  if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
  if (n.length <= 13) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}/${n.slice(9)}`;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}/${n.slice(9, 13)}-${n.slice(13, 15)}`;
}
