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

  // Abre o Select (Radix) de motivo do desligamento e espera o listbox no portal.
  function abrirSelectMotivo() {
    cy.get('[data-testid="select-motivo-desligamento"]').click({ force: true });
    cy.get('[role="listbox"]', { timeout: 10000 }).should("be.visible");
  }

  // Abre o select de motivo e escolhe a opção pelo texto (label da UI).
  function selecionarMotivo(label: string) {
    abrirSelectMotivo();
    cy.contains('[role="option"]', label, { timeout: 10000 }).click({ force: true });
    cy.get('[role="listbox"]').should("not.exist");
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
    // A mensagem de erro é renderizada só quando a data é inválida (FormMessage
    // condicional), dentro do diálogo `position: fixed` com scroll interno — por
    // isso o `should("be.visible")` estrito do Cypress falha ("overflowed by
    // other elements") mesmo com o texto na tela. Existir no DOM já prova que a
    // validação disparou.
    cy.contains(/anterior à data de admissão/i, { timeout: 10000 }).should("exist");
  });

  // DESL-012: data de desligamento futura é bloqueada.
  it("DESL-012: Data de desligamento futura é bloqueada", () => {
    abrirDesligamento();
    const futura = new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0];
    cy.get('[data-testid="input-data-desligamento"]').clear().type(futura);
    // Mesmo motivo do DESL-011: mensagem condicional dentro do diálogo fixo com
    // scroll — basta existir no DOM para provar que a regra bloqueou a data.
    cy.contains(/não pode ser futura/i, { timeout: 10000 }).should("exist");
  });

  // DESL-010: sem data, não dá para confirmar (RNDES: o botão fica desabilitado).
  // Zero mutação: só verifica o estado do formulário, não confirma o desligamento.
  it("DESL-010: Data de desligamento é obrigatória", () => {
    abrirDesligamento();
    // Escolhe um motivo para isolar a DATA como o campo que ainda falta.
    selecionarMotivo("Pedido de demissão");
    cy.get('[data-testid="input-data-desligamento"]').should("have.value", "");
    // Sem data, o botão de confirmar permanece desabilitado.
    cy.get('[data-testid="btn-confirmar-desligamento"]').should("be.disabled");
  });

  // DESL-020: sem motivo, não dá para confirmar (mtvDeslig é obrigatório no S-2299).
  // Zero mutação: preenche uma data válida mas deixa o motivo em branco.
  it("DESL-020: Motivo do desligamento é obrigatório", () => {
    abrirDesligamento();
    // Data de hoje é válida (não futura, não anterior à admissão do staging).
    const hoje = new Date().toISOString().split("T")[0];
    cy.get('[data-testid="input-data-desligamento"]').clear().type(hoje);
    // Motivo continua no placeholder (nada escolhido).
    cy.get('[data-testid="select-motivo-desligamento"]').should("contain.text", "Selecione o motivo");
    // Mesmo com data válida, sem motivo o botão de confirmar fica desabilitado.
    cy.get('[data-testid="btn-confirmar-desligamento"]').should("be.disabled");
  });

  // DESL-021: a lista de motivos cobre as hipóteses legais de extinção do contrato.
  it("DESL-021: Motivos disponíveis cobrem as hipóteses legais de extinção", () => {
    abrirDesligamento();
    abrirSelectMotivo();
    const motivosLegais = [
      "Dispensa sem justa causa",
      "Dispensa com justa causa (art. 482 CLT)",
      "Pedido de demissão",
      "Acordo mútuo (art. 484-A CLT)",
      "Término de contrato",
      "Aposentadoria",
      "Falecimento",
      "Rescisão indireta (art. 483 CLT)",
      "Culpa recíproca",
    ];
    motivosLegais.forEach((motivo) => {
      cy.contains('[role="option"]', motivo, { timeout: 10000 }).should("exist");
    });
  });
});
