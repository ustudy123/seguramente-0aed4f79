/// <reference types="cypress" />

// =====================================================================
// Módulo Empresa — checklist de cadastro (obrigatoriedade condicional).
//
// Regra da casa: todo it() aqui corresponde a um caso e2e DOCUMENTADO.
// A ponte caso ↔ it() vive em qa_cobertura_e2e (ver a migration
// ..._qa_cobertura_empresa_lote1.sql).
//
// Casos cobertos:
//   EMP-014 — Documento exigido acompanha o tipo de pessoa (CNPJ x CPF)
//   ENQ-018 — Mandato e membros viram obrigatórios com CIPA ativa
//
// ZERO mutação: só abrimos "Nova Empresa" e lemos o checklist de pendências.
// Nada é salvo (o rascunho vive só no localStorage do navegador). Por isso
// não confirmamos o cadastro em nenhum momento.
// =====================================================================

import { credenciaisDeTeste } from "../support/credenciais";

describe("Módulo Empresa — checklist de cadastro", () => {
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

  // Abre o formulário "Nova Empresa" a partir da lista. Confirma pela aba de
  // Dados (seletor específico da tela-destino) que o formulário abriu mesmo.
  function abrirNovaEmpresa() {
    cy.visit(`${baseUrl}/empresa`);
    closeEmpresaModalIfNeeded();
    cy.get('[data-testid="btn-nova-empresa"]', { timeout: 30000 })
      .should("be.visible")
      .click({ force: true });
    cy.get('[data-testid="tab-dados"]', { timeout: 20000 }).should("be.visible");
  }

  // Navega para uma aba do formulário pelo id estável do TabsTrigger.
  function irAba(nome: "dados" | "enquadramento" | "checklist") {
    cy.get(`[data-testid="tab-${nome}"]`).click({ force: true });
    cy.wait(500);
  }

  // Abre um Radix Select pelo testid do trigger e escolhe a opção pelo texto.
  function selecionar(testid: string, labelOpcao: string) {
    cy.get(`[data-testid="${testid}"]`).click({ force: true });
    cy.get('[role="listbox"]', { timeout: 10000 }).should("be.visible");
    cy.contains('[role="option"]', labelOpcao, { timeout: 10000 }).click({ force: true });
    cy.get('[role="listbox"]').should("not.exist");
  }

  beforeEach(() => {
    // testIsolation (Cypress 15) já zera cookies/localStorage/sessionStorage
    // entre os testes, então cada teste começa sem rascunho nem navegação
    // restaurada — a lista de empresas abre limpa.
    login();
  });

  // EMP-014: o documento obrigatório no checklist acompanha o tipo de pessoa.
  it("EMP-014: Documento exigido acompanha o tipo de pessoa", () => {
    abrirNovaEmpresa();

    // Padrão do formulário novo é Pessoa Jurídica → checklist cobra CNPJ.
    irAba("checklist");
    cy.get('[data-testid="checklist-pendencias"]', { timeout: 15000 })
      .should("contain.text", "CNPJ");

    // Troca para Pessoa Física → a pendência passa a ser CPF, e CNPJ some.
    irAba("dados");
    selecionar("select-tipo-pessoa", "Pessoa Física (CPF)");
    irAba("checklist");
    cy.get('[data-testid="checklist-pendencias"]', { timeout: 15000 })
      .should("contain.text", "CPF")
      .and("not.contain.text", "CNPJ");
  });

  // ENQ-018: mandato e membros da CIPA viram obrigatórios quando ela está ativa.
  it("ENQ-018: Mandato e membros viram obrigatórios com CIPA ativa", () => {
    abrirNovaEmpresa();

    // CIPA ativa → checklist passa a cobrar Mandato e Membros da CIPA.
    irAba("enquadramento");
    selecionar("select-cipa-situacao", "Ativa");
    irAba("checklist");
    cy.get('[data-testid="checklist-pendencias"]', { timeout: 15000 })
      .should("contain.text", "Mandato da CIPA")
      .and("contain.text", "Membros da CIPA");

    // CIPA não constituída → mandato e membros deixam de ser obrigatórios.
    irAba("enquadramento");
    selecionar("select-cipa-situacao", "Não Constituída");
    irAba("checklist");
    cy.get('[data-testid="checklist-pendencias"]', { timeout: 15000 })
      .should("not.contain.text", "Mandato da CIPA")
      .and("not.contain.text", "Membros da CIPA");
  });
});
