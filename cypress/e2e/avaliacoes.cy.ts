/// <reference types="cypress" />

// =====================================================================
// Módulo Avaliações de Desempenho — testes de tela (nível e2e).
//
// Cada it() abaixo corresponde a UM caso documentado em qa_casos_teste
// (nível e2e) e está ligado a ele pela ponte qa_cobertura_e2e. Regra da
// casa: documentação vem antes do teste; não inventar it() sem caso.
//
// Casos cobertos: AVAL-001, AVAL-002, AVAL-050, AVAL-051.
// Os demais casos do módulo (criar ciclo, responder avaliação, etc.)
// seguem documentados e ainda sem spec — a guarda só avisa, não reprova.
// =====================================================================

import { credenciaisDeTeste } from "../support/credenciais";

describe("Módulo Avaliações de Desempenho", () => {
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
    cy.visit(`${baseUrl}/avaliacoes`);
    cy.contains("h1", "Avaliações de Desempenho", { timeout: 20000 }).should("be.visible");
  }

  // As abas rolam na horizontal; scrollIntoView + force evitam "não visível".
  function abrirAba(seletor: string) {
    cy.get(seletor).scrollIntoView().click({ force: true });
    cy.get(seletor).should("have.attr", "aria-selected", "true");
  }

  beforeEach(() => {
    login();
    goToModulo();
  });

  it("carrega o módulo de Avaliações com as abas do fluxo", () => {
    // A Inbox é a aba sempre presente (independe de perfil). As administrativas
    // (Config, Templates, Resultados, 9-Box) aparecem para o gestor/admin.
    cy.get("#tab-aval-inbox", { timeout: 20000 }).should("exist");
    cy.get("#tab-aval-formulario").should("exist");
    cy.get("#tab-aval-metas").should("exist");
  });

  it("mostra a Inbox de avaliações", () => {
    abrirAba("#tab-aval-inbox");
    // Com ou sem pendências, a aba monta sem estourar o ErrorBoundary.
    cy.contains("Algo deu errado").should("not.exist");
  });

  it("abre a aba de Resultados de um ciclo", () => {
    abrirAba("#tab-aval-resultados");
    cy.contains("Algo deu errado").should("not.exist");
  });

  it("abre a matriz 9-Box", () => {
    abrirAba("#tab-aval-9box");
    cy.contains("Algo deu errado").should("not.exist");
  });
});
