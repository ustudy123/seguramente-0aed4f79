/// <reference types="cypress" />

// =====================================================================
// Módulo Plano de Ação — testes de tela (nível e2e).
//
// Cada it() corresponde a um caso documentado (PACAO-TELA-*), ligado pela
// ponte qa_cobertura_e2e. Escopo: a entrada de cada caso (o módulo/abas
// montam, o formulário abre), sem salvar nada nem depender de dado semeado.
// =====================================================================

import { credenciaisDeTeste } from "../support/credenciais";

describe("Módulo Plano de Ação", () => {
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

  function abrirAba(texto: string) {
    cy.contains('[role="tab"]', texto, { timeout: 20000 }).click({ force: true });
    cy.contains('[role="tab"]', texto).should("have.attr", "data-state", "active");
  }

  beforeEach(() => {
    login();
    cy.visit(`${baseUrl}/plano-acao`);
    cy.contains("h1", "Plano de Ação", { timeout: 20000 }).should("be.visible");
  });

  // PACAO-TELA-01
  it("abre o módulo Plano de Ação com as estatísticas e as abas", () => {
    cy.contains("button", "Nova Ação", { timeout: 20000 }).should("be.visible");
    cy.contains('[role="tab"]', "Todas").should("exist");
    cy.contains('[role="tab"]', "Minha Caixa").should("exist");
    cy.contains('[role="tab"]', "Críticas").should("exist");
  });

  // PACAO-TELA-02
  it("abre o formulário de Nova Ação", () => {
    cy.contains("button", "Nova Ação", { timeout: 20000 }).click({ force: true });
    cy.get('[role="dialog"]', { timeout: 20000 }).should("be.visible");
  });

  // PACAO-TELA-03
  it("tem a busca por código, título, descrição ou responsável", () => {
    cy.get('input[placeholder*="Buscar por código"]', { timeout: 20000 })
      .should("exist").type("teste");
  });

  // PACAO-TELA-04
  it("filtra pela situação com os chips de status", () => {
    cy.contains("Pendentes", { timeout: 20000 }).should("exist");
    cy.contains("Em andamento").should("exist");
    cy.contains("Concluídas").should("exist").click({ force: true });
  });

  // PACAO-TELA-06
  it("abre a aba Minha Caixa", () => {
    abrirAba("Minha Caixa");
  });

  // PACAO-TELA-07
  it("abre a aba Críticas", () => {
    abrirAba("Críticas");
  });
});
