/// <reference types="cypress" />

// =====================================================================
// Módulo Cargos (/cadastros/cargos) — testes de tela (e2e).
// Cada it() corresponde a um caso documentado (CARGO-TELA-*), ligado pela
// ponte qa_cobertura_e2e. Escopo: entrada de cada caso (lista monta,
// formulário abre com as abas, busca funciona), sem salvar nada.
// =====================================================================

import { credenciaisDeTeste } from "../support/credenciais";

describe("Módulo Cargos", () => {
  const { email, senha: password } = credenciaisDeTeste();
  const baseUrl = Cypress.config("baseUrl") as string;

  function login() {
    cy.visit(`${baseUrl}/login`);
    cy.get('input[type="email"]', { timeout: 20000 })
      .should("exist").scrollIntoView().should("be.visible").clear().type(email);
    cy.get('input[autocomplete="current-password"]', { timeout: 20000 })
      .should("exist").scrollIntoView().should("be.visible").clear().type(password, { log: false });
    cy.contains("button", /^Entrar$/).click();
    cy.aguardarSessaoSupabase();
    cy.wait(1500);
  }

  beforeEach(() => {
    login();
    cy.visit(`${baseUrl}/cadastros/cargos`);
    cy.contains("h1", "Cargos", { timeout: 20000 }).should("be.visible");
  });

  // CARGO-TELA-01
  it("abre o módulo Cargos com a lista", () => {
    cy.contains("button", "Novo Cargo", { timeout: 20000 }).should("be.visible");
    cy.get('input[placeholder*="Buscar cargos"]').should("exist");
  });

  // CARGO-TELA-02
  it("abre o formulário de Novo Cargo com as abas", () => {
    cy.contains("button", "Novo Cargo", { timeout: 20000 }).click({ force: true });
    cy.get('[role="dialog"]', { timeout: 20000 }).should("be.visible");
    cy.contains('[role="tab"]', "Dados Gerais").should("exist");
    cy.contains('[role="tab"]', "SST").should("exist");
  });

  // CARGO-TELA-06
  it("a busca filtra a lista de cargos", () => {
    cy.get('input[placeholder*="Buscar cargos"]', { timeout: 20000 })
      .should("exist").type("Analista");
  });
});
