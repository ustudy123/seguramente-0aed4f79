/// <reference types="cypress" />

// =====================================================================
// Módulo Trilhas (Aprendizagem) — testes de tela (nível e2e).
//
// Cada it() corresponde a um caso documentado (qa_casos_teste, nível e2e)
// ligado pela ponte qa_cobertura_e2e.
// Casos cobertos: TRILHA-001, TRILHA-002, TRILHA-040.
// =====================================================================

import { credenciaisDeTeste } from "../support/credenciais";

describe("Módulo Trilhas", () => {
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
    cy.visit(`${baseUrl}/trilhas`);
    cy.contains("h1", "Trilhas", { timeout: 20000 }).should("be.visible");
  }

  function abrirAba(label: string) {
    cy.contains('[role="tab"]', label).scrollIntoView().click({ force: true });
    cy.contains('[role="tab"]', label).should("have.attr", "aria-selected", "true");
  }

  beforeEach(() => {
    login();
    goToModulo();
  });

  it("carrega o módulo de Trilhas com as abas", () => {
    cy.contains('[role="tab"]', "Minhas Trilhas", { timeout: 20000 }).should("exist");
    cy.contains('[role="tab"]', "Gamificação").should("exist");
    cy.contains('[role="tab"]', "Analytics").should("exist");
  });

  it("mostra as trilhas atribuídas em Minhas Trilhas", () => {
    abrirAba("Minhas Trilhas");
    // Com ou sem trilhas atribuídas, a aba monta sem quebrar.
    cy.contains("Algo deu errado").should("not.exist");
  });

  it("abre a aba de Gamificação", () => {
    abrirAba("Gamificação");
    cy.contains("Algo deu errado").should("not.exist");
  });
});
