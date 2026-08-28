/// <reference types="cypress" />

// =====================================================================
// Módulo Meu Bem-Estar — testes de tela (nível e2e).
//
// Cada it() corresponde a um caso documentado (qa_casos_teste, nível e2e)
// ligado pela ponte qa_cobertura_e2e.
// Casos cobertos: BEM-001, BEM-002, BEM-011.
// Registrar resposta/gratidão grava dado do próprio usuário — documentado
// e sem spec por ora (a guarda só avisa).
// =====================================================================

import { credenciaisDeTeste } from "../support/credenciais";

describe("Módulo Meu Bem-Estar", () => {
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
    cy.visit(`${baseUrl}/felicidade`);
    cy.contains("h1", "Meu Bem-Estar no Trabalho", { timeout: 20000 }).should("be.visible");
  }

  beforeEach(() => {
    login();
    goToModulo();
  });

  it("carrega o Mapa de Bem-Estar", () => {
    cy.contains("Meu Mapa de Bem-Estar", { timeout: 20000 }).should("be.visible");
  });

  it("exibe o aviso de espaço seguro", () => {
    cy.contains("Espaço seguro", { timeout: 20000 }).should("be.visible");
  });

  it("abre o painel ao clicar num eixo", () => {
    // A legenda abaixo do radar tem um botão por eixo; o primeiro rótulo é
    // "Autoconhecimento" (de "Autoconhecimento & Emoções"). Clicar abre o
    // painel do eixo, cujo título mostra o rótulo completo.
    cy.contains("button", "Autoconhecimento", { timeout: 20000 })
      .scrollIntoView()
      .click({ force: true });
    cy.contains("Autoconhecimento & Emoções").should("be.visible");
  });
});
