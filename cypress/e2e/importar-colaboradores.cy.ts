/// <reference types="cypress" />

describe("Colaboradores - Modal de Importação", () => {
  const email = "renata_sophia_cortereal@cafefrossard.com";
  const password = "123456";
  const baseUrl = (Cypress.config("baseUrl") as string) || "https://seguramente.app.br";

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
        cy.location("pathname", { timeout: 20000 }).should("not.eq", "/login");
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
    const tabs = ["ativos", "admissoes", "desligados"];

    tabs.forEach((tab) => {
      // Clica na aba
      cy.get(`[role="tab"][data-value="${tab}"], [role="tab"]:contains("${tab.charAt(0).toUpperCase() + tab.slice(1)}")`)
        .first()
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

      // Fecha o modal clicando no X ou fora
      cy.get('button:contains("X"), [aria-label="Close"]').first().click({ force: true }).catch(() => {
        // Fallback: pressiona ESC
        cy.get("body").type("{esc}");
      });
      
      // Verifica se o modal fechou
      cy.get('[role="dialog"]').should("not.exist");
    });
  });
});
