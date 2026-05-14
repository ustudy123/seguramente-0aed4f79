import { z } from "zod";

/**
 * Política de senha alinhada com Supabase Auth (recomendada):
 * - Mínimo 12 caracteres
 * - Letra minúscula, maiúscula, dígito e símbolo
 * - Máximo 72 (limite bcrypt)
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 72;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `A senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(PASSWORD_MAX_LENGTH, `A senha não pode ultrapassar ${PASSWORD_MAX_LENGTH} caracteres`)
  .refine((v) => /[a-z]/.test(v), "Inclua ao menos uma letra minúscula")
  .refine((v) => /[A-Z]/.test(v), "Inclua ao menos uma letra maiúscula")
  .refine((v) => /\d/.test(v), "Inclua ao menos um número")
  .refine((v) => /[^A-Za-z0-9]/.test(v), "Inclua ao menos um símbolo (ex: !@#$%)");

export interface PasswordChecks {
  length: boolean;
  lower: boolean;
  upper: boolean;
  digit: boolean;
  symbol: boolean;
}

export function checkPassword(value: string): PasswordChecks {
  return {
    length: value.length >= PASSWORD_MIN_LENGTH,
    lower: /[a-z]/.test(value),
    upper: /[A-Z]/.test(value),
    digit: /\d/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value),
  };
}

export function passwordStrength(value: string): { score: number; label: string } {
  const c = checkPassword(value);
  const score = [c.length, c.lower, c.upper, c.digit, c.symbol].filter(Boolean).length;
  const label =
    score <= 2 ? "Fraca" : score === 3 ? "Razoável" : score === 4 ? "Boa" : "Forte";
  return { score, label };
}
