/// <reference types="cypress" />

describe("Módulo Incidentes & Acidentes", () => {
  const email = "renata_sophia_cortereal@cafefrossard.com";
  const password = "123456";
  const baseUrl = Cypress.config("baseUrl") || "https://seguramente.app.br";

  const texts = {
    modulo: "Incidentes & Acidentes",
    registrar: "Registrar Evento",
    guia: "Guia Rápido",
    tabs: ["Ocorrências", "Análise", "Indicadores", "Analytics", "Preditivo", "Cultura", "FAP", "Pirâmide"],
    categoria: "Quase queda",
    origem: "Comportamental",
    fator1: "Ritmo de trabalho acelerado / pressa",
    fator2: "Falta de pausas adequadas",
    agenteEsocial: "07.02 — Queda em mesmo nível",
  };

  function login() {
    cy.visit(`${baseUrl}/login`);
    cy.get('input[type="email"]').should("be.visible").clear().type(email);
    cy.get('input[autocomplete="current-password"]').should("be.visible").clear().type(password, { log: false });
    cy.contains("button", /^Entrar$/).click();
    cy.location("pathname", { timeout: 20000 }).should("not.eq", "/login");
  }

  function goToModulo() {
    cy.visit(`${baseUrl}/incidentes-acidentes`);
    cy.contains("h1", texts.modulo, { timeout: 20000 }).should("be.visible");
  }

  function openTab(label: string) {
    cy.contains('[role="tab"]', label).should("be.visible").click();
    cy.contains('[role="tab"]', label).should("have.attr", "aria-selected", "true");
  }

  function openRadixSelectByText(triggerText: string) {
    cy.contains('button[role="combobox"]', triggerText).should("be.visible").click();
  }

  function selectRadixOption(optionText: string) {
    cy.contains('[role="option"], [data-radix-collection-item], [cmdk-item]', optionText)
      .should("be.visible")
      .click({ force: true });
  }

  function openNthCombobox(index: number) {
    cy.get('button[role="combobox"]').eq(index).should("be.visible").click({ force: true });
  }

  function selectCmdkOption(searchPlaceholder: string, value: string) {
    cy.get(`input[placeholder="${searchPlaceholder}"]`).should("be.visible").clear().type(value);
    cy.contains('[cmdk-item]', value).should("be.visible").click({ force: true });
  }

  function nextStep() {
    cy.contains("button", /^Próximo$/).should("be.visible").click();
  }

  function previousStep() {
    cy.contains("button", /^Anterior$/).should("be.visible").click();
  }

  function fillTipoELocal(setor = "Administrativo", local = "Próximo ao refeitório", turno = "1º Turno") {
    cy.get('input[type="date"]').first().should("be.visible");
    openNthCombobox(0);
    cy.get('input[placeholder="Buscar estabelecimento..."]')
      .should("be.visible")
      .type("Matriz", { force: true });

    cy.get("body").then(($body) => {
      if ($body.find('[cmdk-item]').length > 0) {
        cy.get('[cmdk-item]').first().click({ force: true });
      } else {
        cy.get('input[placeholder="Buscar estabelecimento..."]').type("{enter}", { force: true });
      }
    });

    openNthCombobox(1);
    cy.get('input[placeholder="Buscar setor..."]').should("be.visible").clear().type(setor);
    cy.get("body").then(($body) => {
      if ($body.find('[cmdk-item]').length > 0) {
        cy.contains('[cmdk-item]', setor).click({ force: true });
      } else {
        cy.get('input[placeholder="Buscar setor..."]').type("{enter}", { force: true });
      }
    });

    cy.get('input[placeholder*="Linha 3"]').clear().type(local);
    cy.contains("label", "Turno").parent().within(() => {
      cy.get('button[role="combobox"]').click({ force: true });
    });
    selectRadixOption(turno);
  }

  function fillEnvolvidosManual(nome: string, cargo: string) {
    openRadixSelectByText("Selecione do cadastro ou digite");
    selectRadixOption("✏️ Digitar manualmente");
    cy.get('input[placeholder="Nome completo"]').clear().type(nome);
    cy.get('input[placeholder="Ex: Operador"]').clear().type(cargo);
    cy.get('textarea[placeholder*="testemunhas"]').clear().type("Maria teste, Pedro teste");
  }

  function fillClassificacao(gravidade = "Baixa") {
    cy.contains("button", texts.categoria).click();
    cy.contains("button", texts.origem).click();
    cy.contains("button", gravidade).click();
  }

  function fillGravidadeAcidente() {
    cy.contains("button", "Lesão leve").click();
    cy.contains("button", "Não houve afastamento").click();
    cy.contains("button", "Ambulatorial").click();
  }

  function fillClassificacaoLegal() {
    cy.contains("button", "Típico").click();
    cy.get('input[placeholder*="S60.0"]').clear().type("S60.0");
    cy.get('input[type="number"]').clear().type("3");
    cy.contains("button", "Confirmado").click();
    cy.get("select").select(texts.agenteEsocial);
  }

  function fillCat(emitir = true) {
    if (emitir) {
      cy.get("#cat_emitida").click({ force: true });
      cy.get('input[placeholder="Número"]').clear().type(`CAT-${Date.now()}`);
      cy.get('input[type="date"]').last().type("2026-03-31");
      cy.contains("button", "Inicial").click();
      cy.get("textarea").last().type("CAT emitida para teste automatizado.");
    } else {
      cy.contains("Marque acima se a CAT foi emitida").should("be.visible");
    }
  }

  function fillDescricao(sufixo: string) {
    cy.get("textarea").first().clear().type(`Descrição automatizada do evento ${sufixo}.`);
    cy.get("textarea").eq(1).clear().type(`Percepção inicial da causa do evento ${sufixo}.`);
  }

  function fillFatores() {
    cy.contains("button", texts.fator1).click();
    cy.contains("button", texts.fator2).click();
  }

  function submitForm() {
    cy.contains("button", /Registrar Evento|Salvar Alterações/i).should("be.visible").click();
    cy.contains("Registrar Novo Evento SST").should("not.exist");
  }

  function openRegistrarEvento() {
    cy.contains("button", texts.registrar).should("be.visible").click();
    cy.contains(/Registrar Novo Evento SST|Editar Evento/).should("be.visible");
  }

  function createIncidenteManual() {
    openRegistrarEvento();
    cy.contains("button", "Incidente").click();
    fillTipoELocal("Administrativo", `Próximo ao refeitório ${Date.now()}`, "1º Turno");
    nextStep();
    fillEnvolvidosManual(`João Incidente ${Date.now()}`, "Operador");
    nextStep();
    fillClassificacao("Baixa");
    nextStep();
    fillDescricao("incidente");
    nextStep();
    fillFatores();
    submitForm();
  }

  function createAcidenteManual(emitirCat = true) {
    openRegistrarEvento();
    cy.contains("button", "Acidente").click();
    fillTipoELocal("Administrativo", `Área de produção ${Date.now()}`, "2º Turno");
    nextStep();
    fillEnvolvidosManual(`Maria Acidente ${Date.now()}`, "Auxiliar");
    nextStep();
    fillClassificacao("Alta");
    nextStep();
    fillGravidadeAcidente();
    nextStep();
    fillClassificacaoLegal();
    nextStep();
    fillCat(emitirCat);
    nextStep();
    fillDescricao("acidente");
    nextStep();
    fillFatores();
    submitForm();
  }

  function ensureAtLeastOneRow() {
    openTab("Ocorrências");
    cy.get("body").then(($body) => {
      if ($body.text().includes("Nenhum evento encontrado.")) {
        createIncidenteManual();
      }
    });
    cy.get("tbody tr", { timeout: 20000 }).its("length").should("be.gte", 1);
  }

  beforeEach(() => {
    login();
    goToModulo();
  });

  it("carrega o módulo e todas as abas principais", () => {
    cy.contains("button", texts.guia).should("be.visible");
    cy.contains("button", texts.registrar).should("be.visible");

    texts.tabs.forEach((tab) => {
      openTab(tab);
    });
  });

  it("aplica filtros da aba ocorrências", () => {
    openTab("Ocorrências");
    cy.get('input[placeholder="Buscar por código, nome, setor..."]').clear().type("Administrativo");

    openNthCombobox(0);
    selectRadixOption("Incidentes");

    openNthCombobox(1);
    selectRadixOption("Em Aberto");

    cy.get('button[role="combobox"]').then(($buttons) => {
      if ($buttons.length > 3) {
        openNthCombobox(3);
        selectRadixOption("1º Turno");
      }
    });

    cy.get('input[type="date"]').eq(0).clear().type("2026-03-01");
    cy.get('input[type="date"]').eq(1).clear().type("2026-03-31");
  });

  it("cadastra um incidente com colaborador manual", () => {
    createIncidenteManual();
    cy.contains("Nenhum evento encontrado.").should("not.exist");
  });

  it("cadastra um acidente com CAT emitida", () => {
    createAcidenteManual(true);
    cy.contains("Nenhum evento encontrado.").should("not.exist");
  });

  it("cadastra um acidente sem CAT emitida", () => {
    createAcidenteManual(false);
    cy.contains("Nenhum evento encontrado.").should("not.exist");
  });

  it("abre detalhes por linha, volta e usa ações do detalhe", () => {
    ensureAtLeastOneRow();
    cy.get("tbody tr").first().click();

    cy.contains("button", "Voltar").should("be.visible");
    cy.contains("button", /Baixar Relatório|Baixar Relatório CAT/i).should("be.visible");
    cy.contains("button", "Criar Ação Vinculada").should("be.visible");

    cy.get("body").then(($body) => {
      if ($body.text().includes("Concluir Evento")) {
        cy.contains("button", "Concluir Evento").click();
      }
    });

    cy.contains("button", "Criar Ação Vinculada").click();
    cy.contains("button", "Voltar").click();
    cy.contains("h1", texts.modulo).should("be.visible");
  });

  it("abre edição pela tabela", () => {
    ensureAtLeastOneRow();
    cy.get('tbody tr').first().within(() => {
      cy.get('button[title="Editar"]').click({ force: true });
    });
    cy.contains("Editar Evento").should("be.visible");
    previousStep();
    cy.contains("Editar Evento").should("be.visible");
    cy.get('body').type('{esc}');
  });

  it("acessa a aba pirâmide, muda filtros e abre camadas", () => {
    openTab("Pirâmide");

    openNthCombobox(0);
    selectRadixOption("Setor");

    cy.get('button[role="combobox"]').then(($buttons) => {
      if ($buttons.length > 1) {
        openNthCombobox(1);
        cy.get("body").then(($body) => {
          if ($body.text().includes("Administrativo")) {
            selectRadixOption("Administrativo");
          } else if ($body.text().includes("Todos")) {
            selectRadixOption("Todos");
          }
        });
      }
    });

    cy.contains("button", "Desvio").click();
    cy.get('body').type('{esc}');

    [
      "Óbitos / Graves",
      "Acidentes c/ afastamento",
      "Acidentes s/ afastamento",
      "Incidentes / Quase-acid.",
      "Desvios de Segurança",
    ].forEach((layer) => {
      cy.contains("button", layer).click({ force: true });
      cy.get('body').type('{esc}');
    });
  });

  it("abre o guia rápido", () => {
    cy.contains("button", texts.guia).click();
    cy.contains(/Guia|Rápido|Incidentes/i).should("be.visible");
    cy.get('body').type('{esc}');
  });
});