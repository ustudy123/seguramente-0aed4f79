/// <reference types="cypress" />

// =====================================================================
// Módulo Desligamento — 1ª leva (validações de data do formulário).
//
// Regra da casa: todo it() aqui corresponde a um caso e2e DOCUMENTADO
// (Documentação de testes). A ponte caso ↔ it() vive em qa_cobertura_e2e
// (ver migration 20260819181500_qa_cobertura_desligamento_lote1.sql).
//
// Casos cobertos nesta leva:
//   DESL-011 — Data de desligamento não pode ser anterior à admissão
//   DESL-012 — Data de desligamento futura é bloqueada
//
// Só validações de data (erro visível calculado ao vivo pelo formulário),
// que dependem apenas de abrir o desligamento de um colaborador ativo.
// =====================================================================

import { credenciaisDeTeste } from "../support/credenciais";

describe("Módulo Desligamento", () => {
  const { email, senha: password } = credenciaisDeTeste();
  const baseUrl = Cypress.config("baseUrl") as string;

  function closeEmpresaModalIfNeeded() {
    cy.get("body", { timeout: 15000 }).then(($body) => {
      const pageText = $body.text();
      if (/Acesso Restrito/i.test(pageText)) {
        throw new Error("Usuário de teste sem empresa vinculada.");
      }
      if (!/Selecione a Empresa/i.test(pageText)) return;
      cy.contains(/Selecione a Empresa/i, { timeout: 10000 }).should("be.visible");
      cy.get("button.text-left:visible").first().click({ force: true });
      cy.contains("button", /Acessar|Continuar|Confirmar|Entrar/i, { timeout: 10000 })
        .should("be.visible")
        .and("not.be.disabled")
        .click({ force: true });
      cy.contains(/Selecione a Empresa/i, { timeout: 10000 }).should("not.exist");
    });
    cy.contains(/Sincronizando empresas/i, { timeout: 20000 }).should("not.exist");
  }

  function login() {
    cy.visit(`${baseUrl}/login`);
    cy.get('input[type="email"]', { timeout: 20000 })
      .should("exist").scrollIntoView().should("be.visible").clear().type(email);
    cy.get('input[autocomplete="current-password"]', { timeout: 20000 })
      .should("exist").scrollIntoView().should("be.visible").clear().type(password, { log: false });
    cy.contains("button", /^Entrar$/).should("be.visible").click();
    cy.aguardarSessaoSupabase();
    closeEmpresaModalIfNeeded();
    cy.wait(1500);
  }

  function goToColaboradores() {
    cy.visit(`${baseUrl}/colaboradores`);
    closeEmpresaModalIfNeeded();
    // Espera a lista assentar (pelo menos um menu de colaborador visível).
    cy.get('[data-testid="colab-menu"]:visible', { timeout: 30000 })
      .should("have.length.greaterThan", 0);
  }

  // Abre o formulário de desligamento do primeiro colaborador ATIVO da lista.
  // O item "Desligar" existe para qualquer colaborador; se o primeiro já
  // estiver desligado, ele mostra um toast e não abre — por isso confirmamos
  // que o campo de data do formulário apareceu de verdade.
  function abrirDesligamento() {
    cy.get('[data-testid="colab-menu"]:visible').first().click({ force: true });
    cy.get('[data-testid="colab-desligar"]:visible', { timeout: 10000 })
      .first()
      .click({ force: true });
    cy.get('[data-testid="input-data-desligamento"]', { timeout: 20000 })
      .should("be.visible");
  }

  beforeEach(() => {
    login();
    goToColaboradores();
  });

  // DESL-011: data de desligamento anterior à admissão é rejeitada.
  it("DESL-011: Data de desligamento não pode ser anterior à admissão", () => {
    abrirDesligamento();
    // Data claramente anterior a qualquer admissão real do staging.
    cy.get('[data-testid="input-data-desligamento"]').clear().type("2000-01-01");
    cy.contains(/anterior à data de admissão/i, { timeout: 10000 }).should("be.visible");
  });

  // DESL-012: data de desligamento futura é bloqueada.
  it("DESL-012: Data de desligamento futura é bloqueada", () => {
    abrirDesligamento();
    const futura = new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0];
    cy.get('[data-testid="input-data-desligamento"]').clear().type(futura);
    cy.contains(/não pode ser futura/i, { timeout: 10000 }).should("be.visible");
  });
});
