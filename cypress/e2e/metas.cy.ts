/// <reference types="cypress" />

// =====================================================================
// Módulo Metas — testes de tela (nível e2e).
//
// Cada it() corresponde a um caso documentado (qa_casos_teste, nível e2e,
// prefixo METAS-TELA-*), ligado pela ponte qa_cobertura_e2e.
//
// Escopo: a ENTRADA de cada caso — a tela/aba monta e o ponto de partida
// (abas, formulário) aparece. Parte robusta e não destrutiva: navega e
// confere que a tela existe, sem salvar nada nem depender de dado semeado.
// =====================================================================

import { credenciaisDeTeste } from "../support/credenciais";

describe("Módulo Metas", () => {
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

  // Aba por id estável (definido em MetasModule.tsx: tab-metas-<area>).
  function abrirAba(id: string) {
    cy.get(`#${id}`, { timeout: 20000 }).click({ force: true });
    cy.get(`#${id}`).should("have.attr", "data-state", "active");
  }

  beforeEach(() => {
    login();
    cy.visit(`${baseUrl}/metas`);
    cy.contains("h1", "Metas", { timeout: 20000 }).should("be.visible");
  });

  // METAS-TELA-01
  it("abre o módulo Metas com o cabeçalho e as abas", () => {
    cy.get("#btn-nova-meta", { timeout: 20000 }).should("be.visible");
    cy.get("#tab-metas-dashboard").should("exist");
    cy.get("#tab-metas-lista").should("exist");
    cy.get("#tab-metas-consolidacao").should("exist");
    cy.get("#tab-metas-chat").should("exist");
  });

  // METAS-TELA-03
  it("abre o formulário de Nova Meta", () => {
    cy.get("#btn-nova-meta", { timeout: 20000 }).click({ force: true });
    cy.contains("Nova Meta", { timeout: 20000 }).should("be.visible");
    cy.get('[role="dialog"]').should("be.visible");
  });

  // METAS-TELA-04
  it("abre Minhas Metas com o filtro por nível", () => {
    abrirAba("tab-metas-lista");
    cy.contains("Filtrar por nível", { timeout: 20000 }).should("be.visible");
  });

  // METAS-TELA-05
  it("abre a aba Consolidação", () => {
    abrirAba("tab-metas-consolidacao");
  });

  // METAS-TELA-06
  it("abre a aba Assistente IA", () => {
    abrirAba("tab-metas-chat");
  });
});
