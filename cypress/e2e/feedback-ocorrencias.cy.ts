/// <reference types="cypress" />

// =====================================================================
// Módulo Feedback & Ocorrências — testes de tela (nível e2e).
//
// Cada it() corresponde a um caso documentado (qa_casos_teste, nível e2e)
// ligado pela ponte qa_cobertura_e2e.
// Casos cobertos: FBK-001, FBK-011, FBK-020, FBK-040.
// =====================================================================

import { credenciaisDeTeste } from "../support/credenciais";

describe("Módulo Feedback & Ocorrências", () => {
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
    cy.visit(`${baseUrl}/feedback-ocorrencias`);
    cy.contains("h1", "Feedback & Ocorrências", { timeout: 20000 }).should("be.visible");
  }

  function abrirAba(label: string) {
    cy.contains('[role="tab"]', label).scrollIntoView().click({ force: true });
    cy.contains('[role="tab"]', label).should("have.attr", "aria-selected", "true");
  }

  beforeEach(() => {
    login();
    goToModulo();
  });

  it("carrega o módulo com as quatro abas", () => {
    cy.contains('[role="tab"]', /Feedback$/, { timeout: 20000 }).should("exist");
    cy.contains('[role="tab"]', /^Feedbacks$/).should("exist");
    cy.contains('[role="tab"]', /Ocorrência$/).should("exist");
    cy.contains('[role="tab"]', /^Ocorrências$/).should("exist");
  });

  it("mantém o registro de feedback desabilitado sem os campos obrigatórios", () => {
    // Aba Novo Feedback é a inicial. Sem colaborador/categoria/descrição, o
    // botão Registrar Feedback fica desabilitado (guarda não-destrutiva).
    cy.contains("button", "Registrar Feedback", { timeout: 20000 })
      .should("be.disabled");
  });

  it("abre o histórico de Feedbacks", () => {
    abrirAba("Feedbacks");
    cy.contains("Histórico de Feedbacks").should("be.visible");
  });

  it("abre o histórico de Ocorrências", () => {
    abrirAba("Ocorrências");
    cy.contains("Histórico de Ocorrências").should("be.visible");
  });
});
