// =====================================================================
// Credenciais do usuário de teste.
//
// Por que este arquivo existe: até 08/2026 os specs traziam o e-mail e a
// senha de uma pessoa real de cliente escritos no código, versionados no
// Git. Isso é dado pessoal exposto no repositório e senha em texto puro.
// A conta de teste agora é uma conta de robô do ambiente de teste, e a
// senha vive só nos secrets do GitHub (CYPRESS_EMAIL / CYPRESS_PASSWORD).
//
// Se faltar credencial, a suíte para aqui com uma mensagem que diz o que
// fazer — melhor do que quebrar lá na frente com "não achei o campo".
// =====================================================================

export interface CredenciaisDeTeste {
  email: string;
  senha: string;
}

export function credenciaisDeTeste(): CredenciaisDeTeste {
  const email = String(Cypress.env("email") || "");
  const senha = String(Cypress.env("senha") || "");

  if (!email || !senha) {
    throw new Error(
      "[Cypress] Faltam as credenciais do usuário de teste.\n" +
        "Defina as variáveis de ambiente antes de rodar:\n" +
        "  CYPRESS_EMAIL=<conta de teste do staging>\n" +
        "  CYPRESS_PASSWORD=<senha dessa conta>\n" +
        "Na esteira elas vêm dos secrets do repositório.\n" +
        "Nunca escreva credencial dentro de um spec.",
    );
  }

  return { email, senha };
}
