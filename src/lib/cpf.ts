/**
 * Utilitários para validação e formatação de CPF
 */

/**
 * Remove caracteres não numéricos do CPF
 */
export function cleanCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

/**
 * Formata CPF para exibição (XXX.XXX.XXX-XX)
 */
export function formatCpf(cpf: string): string {
  const cleaned = cleanCpf(cpf);
  
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
}

/**
 * Valida CPF verificando dígitos verificadores
 * @param cpf CPF com ou sem formatação
 * @returns true se o CPF é válido
 */
export function validateCpf(cpf: string): boolean {
  const cleaned = cleanCpf(cpf);
  
  // Deve ter 11 dígitos
  if (cleaned.length !== 11) return false;
  
  // Não pode ser sequência de números iguais
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(9))) return false;
  
  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(10))) return false;
  
  return true;
}

/**
 * Cria um validador Zod para CPF
 */
export function cpfSchema(message = "CPF inválido") {
  return {
    validate: (value: string) => {
      const cleaned = cleanCpf(value);
      if (cleaned.length === 0) return true; // Permite vazio se o campo não for obrigatório
      return validateCpf(value);
    },
    message,
  };
}
