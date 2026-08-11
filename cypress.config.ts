import { defineConfig } from "cypress";

// =====================================================================
// A suíte Cypress escreve dados (cria campanha, setor, função, EPI...).
// Por isso ela só pode existir contra o AMBIENTE DE TESTE. Rodar contra
// a produção criaria lixo em cima de dados reais de cliente — proibido
// pelas regras da casa (ver CLAUDE.md).
//
// O alvo padrão é o site de teste publicado pelo workflow staging.yml.
// Quem quiser outro alvo usa CYPRESS_BASE_URL, mas só passa pela trava
// abaixo se for um host da lista de permitidos.
// =====================================================================

const SITE_DE_TESTE = "https://ustudy123.github.io/seguramente-0aed4f79/";

// Lista de PERMITIDOS (não de proibidos): host novo só entra aqui de
// propósito. Uma lista de proibidos deixaria passar o que esquecêssemos.
const HOSTS_DE_TESTE = ["ustudy123.github.io", "localhost", "127.0.0.1"];

function exigirAmbienteDeTeste(url: string): string {
  let host: string;

  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(
      `[Cypress] CYPRESS_BASE_URL não é uma URL válida: ${url}\n` +
        `Alvo esperado: ${SITE_DE_TESTE}`,
    );
  }

  if (!HOSTS_DE_TESTE.includes(host)) {
    throw new Error(
      `[Cypress] ALVO RECUSADO: ${url}\n` +
        `Esta suíte grava dados e só roda no ambiente de teste.\n` +
        `Hosts permitidos: ${HOSTS_DE_TESTE.join(", ")}\n` +
        `Site de teste: ${SITE_DE_TESTE}`,
    );
  }

  return url;
}

export default defineConfig({
  e2e: {
    baseUrl: exigirAmbienteDeTeste(process.env.CYPRESS_BASE_URL || SITE_DE_TESTE),
    defaultCommandTimeout: 10000,
    pageLoadTimeout: 120000,
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.ts",
    env: {
      // Credenciais do usuário de teste. Vêm dos secrets do GitHub
      // (CYPRESS_EMAIL / CYPRESS_PASSWORD) — nunca do código, nunca de
      // uma conta de pessoa real. Ver cypress/support/credenciais.ts.
      email: process.env.CYPRESS_EMAIL || "",
      senha: process.env.CYPRESS_PASSWORD || "",
      // Projeto Supabase de produção — a suíte aborta se a aplicação
      // tentar falar com ele. Segunda trava, agora em tempo de execução.
      refProducao: "diayjpsrcerycycyaxst",
    },
  },
});
