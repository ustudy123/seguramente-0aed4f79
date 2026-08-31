/// <reference types="cypress" />

// =====================================================================
// Módulo Mural Interno (Feed) — testes de tela (nível e2e).
//
// Cada it() corresponde a um caso documentado (qa_casos_teste, nível e2e)
// ligado pela ponte qa_cobertura_e2e.
// Casos cobertos: MURAL-001, MURAL-050, MURAL-060.
// Publicar/reagir/comentar escrevem no feed — ficam documentados e sem
// spec por ora (a guarda só avisa, não reprova).
// =====================================================================

import { credenciaisDeTeste } from "../support/credenciais";

describe("Módulo Mural Interno", () => {
  const { email, senha: password } = credenciaisDeTeste();
  const baseUrl = Cypress.config("baseUrl") as string;

  function login() {
    cy.visit(`${baseUrl}/login`);
    cy.get('input[type="email"]', { timeout: 20000 })
      .should("exist")
      .scrollIntoView()
      .should("be.visible")
      .clear()
      .type(email);
    cy.get('input[autocomplete="current-password"]', { timeout: 20000 })
      .should("exist")
      .scrollIntoView()
      .should("be.visible")
      .clear()
      .type(password, { log: false });
    cy.contains("button", /^Entrar$/).click();
    cy.aguardarSessaoSupabase();
    cy.wait(1500);
  }

  function goToModulo() {
    cy.visit(`${baseUrl}/feed`);
    cy.contains("h1", "Mural Interno", { timeout: 20000 }).should("be.visible");
  }

  beforeEach(() => {
    login();
    goToModulo();
  });

  it("carrega o Mural com o compositor e o feed", () => {
    cy.get('textarea[placeholder="No que você está pensando?"]', { timeout: 20000 })
      .should("exist");
  });

  it("trata o feed (posts ou estado vazio) sem erro", () => {
    // Feed com posts renderiza PostCard; sem posts, o estado vazio. Nos dois
    // casos a tela monta sem cair no ErrorBoundary.
    cy.contains("Algo deu errado").should("not.exist");
    cy.get('textarea[placeholder="No que você está pensando?"]').should("exist");
  });

  it("atualiza o feed", () => {
    cy.contains("button", "Atualizar", { timeout: 20000 }).should("be.visible").click();
    cy.contains("Algo deu errado").should("not.exist");
    cy.contains("h1", "Mural Interno").should("be.visible");
  });
});
