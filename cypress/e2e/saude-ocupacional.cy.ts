/// <reference types="cypress" />

// =====================================================================
// Módulo Saúde Ocupacional (ASO) — testes de tela (nível e2e).
//
// Cada it() corresponde a um caso documentado (qa_casos_teste, nível e2e)
// ligado pela ponte qa_cobertura_e2e.
// Casos cobertos: ASO-001, ASO-010, ASO-020, ASO-021.
// =====================================================================

import { credenciaisDeTeste } from "../support/credenciais";

describe("Módulo Saúde Ocupacional (ASO)", () => {
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
    cy.visit(`${baseUrl}/saude-ocupacional`);
    cy.contains("h1", "Saúde Ocupacional (ASO)", { timeout: 20000 }).should("be.visible");
  }

  beforeEach(() => {
    login();
    goToModulo();
  });

  it("carrega o painel de ASOs com os cards de resumo", () => {
    cy.contains("Total de ASOs", { timeout: 20000 }).should("be.visible");
    cy.contains("ASOs Vencidos").should("be.visible");
    cy.contains("A Vencer").should("be.visible");
  });

  it("abre o formulário de Novo ASO", () => {
    cy.contains("button", "Novo ASO", { timeout: 20000 }).should("be.visible").click();
    cy.get('[role="dialog"]', { timeout: 15000 }).should("exist");
    // Não salva nada: fecha o diálogo (não-destrutivo).
    cy.get("body").type("{esc}");
  });

  it("filtra a lista pela busca", () => {
    cy.get('input[placeholder="Buscar por colaborador ou médico..."]', { timeout: 20000 })
      .should("be.visible")
      .clear()
      .type("Administrativo");
    cy.contains("Algo deu errado").should("not.exist");
  });

  it("mostra vazio orientativo quando a busca não acha", () => {
    const inexistente = `zzz-sem-resultado-${Date.now()}`;
    cy.get('input[placeholder="Buscar por colaborador ou médico..."]', { timeout: 20000 })
      .should("be.visible")
      .clear()
      .type(inexistente);
    cy.contains("Nenhum registro de ASO encontrado.").should("exist");
  });
});
