/// <reference types="cypress" />

import { credenciaisDeTeste } from "../support/credenciais";

describe("Colaboradores - Modal de Importação", () => {
  const { email, senha: password } = credenciaisDeTeste();
  const baseUrl = Cypress.config("baseUrl") as string;

  function closeEmpresaModalIfNeeded() {
    cy.get("body", { timeout: 15000 }).then(($body) => {
      const pageText = $body.text();
      if (!/Selecione a Empresa/i.test(pageText)) return;
      cy.get("button.text-left:visible").first().click({ force: true });
      cy.contains("button", /Acessar|Continuar|Confirmar|Entrar/i, { timeout: 10000 })
        .should("be.visible")
        .click({ force: true });
    });
  }

  function login() {
    cy.session(
      [email, password],
      () => {
        cy.visit(`${baseUrl}/login`);
        cy.get('input[type="email"]', { timeout: 20000 }).type(email);
        cy.get('input[autocomplete="current-password"]').type(password);
        cy.contains("button", /^Entrar$/).click();
        // Espera a autenticação persistir de verdade (ver support/e2e.ts). O
        // antigo should("not.eq","/login") passava na hora sob o subcaminho.
        cy.aguardarSessaoSupabase();
        closeEmpresaModalIfNeeded();
      },
      {
        validate() {
          cy.visit(`${baseUrl}/colaboradores`);
          cy.location("pathname", { timeout: 20000 }).should("not.eq", "/login");
        }
      }
    );
  }

  beforeEach(() => {
    login();
    cy.visit(`${baseUrl}/colaboradores`);
    closeEmpresaModalIfNeeded();
    // Wait for page to load
    cy.contains("Colaboradores", { timeout: 30000 }).should("be.visible");
  });

  it("deve abrir o modal de importação ao clicar no botão 'Importar Colaboradores' em qualquer aba", () => {
    // Textos EXATOS das abas (Radix TabsTrigger não emite data-value; "Admissões"
    // tem acento e o antigo :contains("Admissoes") não casava).
    const tabs = ["Ativos", "Admissões", "Desligados"];

    tabs.forEach((tab) => {
      // Clica na aba pelo texto real
      cy.contains('[role="tab"]', tab)
        .click({ force: true });
      
      cy.wait(500);

      // Clica no botão de importar (que agora é global na página)
      cy.get("#btn-importar-colaboradores")
        .should("be.visible")
        .click({ force: true });

      // Verifica se o modal abriu
      cy.get('[role="dialog"]', { timeout: 10000 })
        .should("be.visible")
        .within(() => {
          cy.contains("Importar Colaboradores").should("be.visible");
        });

      // Fecha o modal clicando no X, com ESC como plano B.
      // (Antes isto era um .catch() encadeado no cy.get — método que não
      // existe no Cypress: o passo quebrava sempre, nunca caía no plano
      // B. Condição em Cypress se escreve olhando o DOM primeiro.)
      cy.get("body").then(($body) => {
        const $fechar = $body.find('button:contains("X"), [aria-label="Close"]');

        if ($fechar.length > 0) {
          cy.wrap($fechar.first()).click({ force: true });
        } else {
          cy.get("body").type("{esc}");
        }
      });
      
      // Verifica se o modal fechou
      cy.get('[role="dialog"]').should("not.exist");
    });
  });
});
