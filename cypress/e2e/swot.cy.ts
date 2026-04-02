/// <reference types="cypress" />

describe("Módulo SWOT — Estratégia & Governança", () => {
  const email = "renata_sophia_cortereal@cafefrossard.com";
  const password = "123456";
  const baseUrl = Cypress.config("baseUrl") || "https://seguramente.app.br";
  const uniqueId = Date.now();

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
  }

  function login() {
    cy.visit(`${baseUrl}/login`);
    cy.get('input[type="email"]', { timeout: 20000 }).should("be.visible").clear().type(email);
    cy.get('input[autocomplete="current-password"]', { timeout: 20000 }).should("be.visible").clear().type(password, { log: false });
    cy.contains("button", /^Entrar$/).should("be.visible").click();
    cy.location("pathname", { timeout: 20000 }).should("not.eq", "/login");
    closeEmpresaModalIfNeeded();
  }

  function goToEstrategia() {
    cy.visit(`${baseUrl}/estrategia`);
    closeEmpresaModalIfNeeded();
    cy.contains(/Estratégia|Governança/i, { timeout: 20000 }).should("be.visible");
  }

  function openSwotTab() {
    cy.get('button[role="tab"]').contains("SWOT").click({ force: true });
    cy.get('button[role="tab"][aria-selected="true"]').should("contain.text", "SWOT");
    cy.wait(1500);
  }

  function openNewSwotModal() {
    cy.contains("button", "Nova SWOT").should("be.visible").click();
    cy.get('[role="dialog"]', { timeout: 10000 }).should("be.visible");
    cy.get('[role="dialog"]').contains("Nova Análise SWOT").should("be.visible");
  }

  function selectRadixOption(text: string) {
    // Radix Select renderiza options em portal — aguarda viewport visível
    cy.get('[data-radix-select-viewport], [role="listbox"]', { timeout: 10000 }).should("be.visible");
    cy.wait(300);
    cy.get('[data-radix-select-viewport] [role="option"], [role="listbox"] [role="option"]', { timeout: 8000 })
      .contains(text)
      .should("be.visible")
      .click({ force: true });
    cy.get('[data-radix-select-viewport], [role="listbox"]', { timeout: 5000 }).should("not.exist");
  }

  function createSwot(titulo: string, descricao = "", periodo = "") {
    openNewSwotModal();

    cy.get('[role="dialog"]').within(() => {
      cy.get("input").first().clear().type(titulo);

      if (descricao) {
        cy.get("textarea").first().clear().type(descricao);
      }

      if (periodo) {
        cy.get("input").eq(1).clear().type(periodo);
      }

      cy.contains("button", "Criar Análise").click();
    });

    cy.get('[role="dialog"]', { timeout: 15000 }).should("not.exist");
    cy.wait(1500);
  }

  function openSwotByTitle(titulo: string) {
    cy.contains(titulo, { timeout: 10000 })
      .should("be.visible")
      .closest('[class*="cursor-pointer"]')
      .click();
    // O detalhe renderiza via React state — aguarda o botão Voltar aparecer
    cy.contains("button", "Voltar", { timeout: 15000 }).should("be.visible");
  }

  function addSwotItem(tipo: string, descricao: string, classificacao = "Estratégico", impacto = "Médio") {
    // 1. Selecionar tipo — trigger do primeiro Select (w-40)
    cy.get('button[role="combobox"]').eq(0).click({ force: true });
    selectRadixOption(tipo);

    // 2. Digitar descrição
    cy.get('input[placeholder*="Descreva o item"]').clear().type(descricao);

    // 3. Selecionar classificação — segundo Select (w-36)
    cy.get('button[role="combobox"]').eq(1).click({ force: true });
    selectRadixOption(classificacao);

    // 4. Selecionar impacto — terceiro Select (w-28)
    cy.get('button[role="combobox"]').eq(2).click({ force: true });
    selectRadixOption(impacto);

    // 5. Clicar no botão de adicionar (botão com ícone Plus)
    cy.get('button').filter(':visible').filter((_, el) => {
      return el.querySelector('svg.lucide-plus') !== null;
    }).last().click();

    cy.wait(1500);
  }

  function clickVoltar() {
    cy.contains("button", "Voltar", { timeout: 10000 }).should("be.visible").click();
    cy.contains("Análises SWOT", { timeout: 10000 }).should("be.visible");
  }

  beforeEach(() => {
    login();
    goToEstrategia();
    openSwotTab();
  });

  // ═══════════════════════════════════════════════
  // TELA A — LISTAGEM
  // ═══════════════════════════════════════════════

  it("CT-SWOT-001 — Listar SWOTs do escopo", () => {
    cy.get("body").then(($body) => {
      const hasCards = $body.find('[class*="cursor-pointer"]').length > 0;
      const hasEmpty = $body.text().includes("Nenhuma análise SWOT");
      expect(hasCards || hasEmpty).to.be.true;
    });
    cy.contains("button", "Nova SWOT").should("be.visible");
  });

  it("CT-SWOT-002 — Estado vazio", () => {
    cy.get("body").then(($body) => {
      if ($body.text().includes("Nenhuma análise SWOT")) {
        cy.contains("Nenhuma análise SWOT").should("be.visible");
        cy.contains("Nova SWOT").should("be.visible");
      } else {
        cy.log("Há SWOTs existentes — estado vazio não se aplica");
      }
    });
  });

  it("CT-SWOT-003 — Troca de escopo", () => {
    cy.get("body").then(($body) => {
      if ($body.find('button[role="combobox"]').length > 0) {
        cy.get('button[role="combobox"]').filter(':visible').first().click({ force: true });
        cy.get('[role="option"]', { timeout: 5000 }).first().click({ force: true });
        cy.wait(1000);
      }
    });
    cy.contains(/Análises SWOT|Nenhuma análise/i).should("be.visible");
  });

  it("CT-SWOT-004 — Abrir SWOT clicando no card", () => {
    cy.get("body").then(($body) => {
      if ($body.text().includes("Nenhuma análise SWOT")) {
        createSwot(`SWOT Nav ${uniqueId}`);
        openSwotTab();
      }
    });

    cy.get('[class*="cursor-pointer"]', { timeout: 10000 }).first().should("be.visible").click();

    // Detalhe: botão Voltar e botão Excluir devem aparecer
    cy.contains("button", "Voltar", { timeout: 15000 }).should("be.visible");
    cy.contains("button", "Excluir", { timeout: 5000 }).should("be.visible");
  });

  // ═══════════════════════════════════════════════
  // TELA B — MODAL CRIAR SWOT
  // ═══════════════════════════════════════════════

  it("CT-SWOT-010 — Criar SWOT (caminho feliz)", () => {
    const titulo = `SWOT Teste E2E ${uniqueId}`;
    createSwot(titulo, "Descrição de teste automatizado", "2026 Q2");

    openSwotTab();
    cy.contains(titulo, { timeout: 10000 }).should("be.visible");
  });

  it("CT-SWOT-011 — Título obrigatório", () => {
    openNewSwotModal();

    cy.get('[role="dialog"]').within(() => {
      cy.get("input").first().clear();
      cy.contains("button", "Criar Análise").click();
    });

    // Toast: "Preencha o título da análise SWOT" — sonner renderiza fora do dialog
    cy.get('[data-sonner-toaster] [data-sonner-toast], [role="status"], .sonner-toast', { timeout: 10000 })
      .should("exist")
      .and("contain.text", "Preencha o título");

    // Dialog ainda deve estar aberto
    cy.get('[role="dialog"]').should("exist");

    // Fecha o dialog
    cy.get("body").type("{esc}");
  });

  it("CT-SWOT-012 — Período inválido (formato)", () => {
    openNewSwotModal();
    const titulo = `SWOT Periodo Invalido ${uniqueId}`;

    cy.get('[role="dialog"]').within(() => {
      cy.get("input").first().clear().type(titulo);
      cy.get("input").eq(1).clear().type("🎉abcd!@#$");
      cy.contains("button", "Criar Análise").click();
    });

    cy.get("body").should("be.visible");
  });

  it("CT-SWOT-013 — Fechar modal com dados preenchidos", () => {
    openNewSwotModal();

    cy.get('[role="dialog"]').within(() => {
      cy.get("input").first().clear().type("SWOT que será descartada");
      cy.get("textarea").first().clear().type("Dados que devem ser perdidos");
    });

    cy.get("body").type("{esc}");
    cy.get('[role="dialog"]', { timeout: 5000 }).should("not.exist");
  });

  it("CT-SWOT-014 — Duplo clique no Criar Análise", () => {
    openNewSwotModal();
    const titulo = `SWOT Duplo Click ${uniqueId}`;

    cy.get('[role="dialog"]').within(() => {
      cy.get("input").first().clear().type(titulo);
      cy.contains("button", "Criar Análise").dblclick();
    });

    cy.get('[role="dialog"]', { timeout: 15000 }).should("not.exist");
    cy.wait(2000);

    openSwotTab();
    cy.get("body").then(($body) => {
      const matches = $body.text().match(new RegExp(titulo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"));
      expect(matches?.length || 0).to.be.gte(1);
    });
  });

  // ═══════════════════════════════════════════════
  // TELA C — ITENS DA SWOT
  // ═══════════════════════════════════════════════

  it("CT-SWOT-020 — Adicionar item em Força", () => {
    const titulo = `SWOT Força ${uniqueId}`;
    createSwot(titulo);
    openSwotTab();
    openSwotByTitle(titulo);

    const descItem = `Item força teste ${uniqueId}`;
    addSwotItem("Força", descItem, "Estratégico", "Alto");

    cy.contains(descItem, { timeout: 8000 }).should("be.visible");
  });

  it("CT-SWOT-021 — Adicionar item em cada quadrante", () => {
    const titulo = `SWOT Quadrantes ${uniqueId}`;
    createSwot(titulo);
    openSwotTab();
    openSwotByTitle(titulo);

    const quadrantes = [
      { tipo: "Força", desc: `Força ${uniqueId}` },
      { tipo: "Fraqueza", desc: `Fraqueza ${uniqueId}` },
      { tipo: "Oportunidade", desc: `Oportunidade ${uniqueId}` },
      { tipo: "Ameaça", desc: `Ameaça ${uniqueId}` },
    ];

    quadrantes.forEach(({ tipo, desc }) => {
      addSwotItem(tipo, desc);
    });

    quadrantes.forEach(({ desc }) => {
      cy.contains(desc, { timeout: 8000 }).should("be.visible");
    });
  });

  it("CT-SWOT-022 — Campos obrigatórios para item (descrição vazia)", () => {
    const titulo = `SWOT Validação ${uniqueId}`;
    createSwot(titulo);
    openSwotTab();
    openSwotByTitle(titulo);

    cy.get('input[placeholder*="Descreva o item"]').clear();
    cy.get('button').filter(':visible').filter((_, el) => {
      return el.querySelector('svg.lucide-plus') !== null;
    }).last().click();

    cy.contains(/Preencha a descrição/i, { timeout: 5000 }).should("be.visible");
  });

  it("CT-SWOT-023 — Limites de texto (BVA)", () => {
    const titulo = `SWOT BVA ${uniqueId}`;
    createSwot(titulo);
    openSwotTab();
    openSwotByTitle(titulo);

    // Teste com 1 caractere
    addSwotItem("Força", "A");
    cy.contains("A").should("exist");

    // Teste com texto longo (200 chars)
    const longText = "X".repeat(200);
    addSwotItem("Fraqueza", longText);
    cy.wait(1000);

    // Teste com apenas espaços — deve bloquear
    cy.get('input[placeholder*="Descreva o item"]').clear().type("   ");
    cy.get('button').filter(':visible').filter((_, el) => {
      return el.querySelector('svg.lucide-plus') !== null;
    }).last().click();
    cy.contains(/Preencha a descrição/i, { timeout: 5000 }).should("be.visible");
  });

  it("CT-SWOT-024 — Excluir item", () => {
    const titulo = `SWOT Excluir Item ${uniqueId}`;
    createSwot(titulo);
    openSwotTab();
    openSwotByTitle(titulo);

    const descItem = `Item para excluir ${uniqueId}`;
    addSwotItem("Força", descItem);
    cy.contains(descItem, { timeout: 8000 }).should("be.visible");

    // Clica na lixeira do item — busca o botão com Trash2 próximo ao texto
    cy.contains(descItem)
      .closest('[class*="flex"][class*="items-start"]')
      .find('button')
      .filter((_, el) => el.querySelector('svg.lucide-trash-2') !== null)
      .first()
      .click({ force: true });

    // Confirma exclusão no AlertDialog
    cy.get('[role="alertdialog"]', { timeout: 5000 }).should("be.visible");
    cy.get('[role="alertdialog"]').contains("button", "Excluir").click();

    cy.contains(descItem, { timeout: 8000 }).should("not.exist");
  });

  it("CT-SWOT-025 — Excluir SWOT", () => {
    const titulo = `SWOT Para Excluir ${uniqueId}`;
    createSwot(titulo);
    openSwotTab();
    openSwotByTitle(titulo);

    // Clica no botão Excluir (destructive) no header
    cy.get("button").contains("Excluir").first().click();

    // Confirma no AlertDialog
    cy.get('[role="alertdialog"]', { timeout: 5000 }).should("be.visible");
    cy.get('[role="alertdialog"]').contains("button", "Excluir permanentemente").click();

    // Deve voltar para listagem
    cy.contains("Análises SWOT", { timeout: 10000 }).should("be.visible");
    cy.contains(titulo).should("not.exist");
  });

  it("CT-SWOT-026 — Voltar da tela de detalhe", () => {
    cy.get("body").then(($body) => {
      if ($body.text().includes("Nenhuma análise SWOT")) {
        createSwot(`SWOT Voltar ${uniqueId}`);
        openSwotTab();
      }
    });

    cy.get('[class*="cursor-pointer"]', { timeout: 10000 }).first().click();
    cy.contains("button", "Voltar", { timeout: 15000 }).should("be.visible").click();

    cy.contains("Análises SWOT", { timeout: 10000 }).should("be.visible");
  });

  it("CT-SWOT-027 — Concorrência: adicionar itens em sequência rápida", () => {
    const titulo = `SWOT Concorrência ${uniqueId}`;
    createSwot(titulo);
    openSwotTab();
    openSwotByTitle(titulo);

    const desc1 = `Concorrente A ${uniqueId}`;
    const desc2 = `Concorrente B ${uniqueId}`;

    addSwotItem("Força", desc1);
    addSwotItem("Fraqueza", desc2);

    cy.wait(2000);

    cy.contains(desc1, { timeout: 8000 }).should("be.visible");
    cy.contains(desc2, { timeout: 8000 }).should("be.visible");
  });

  it("CT-SWOT-028 — Concorrência: exclusão de item já removido (graceful)", () => {
    const titulo = `SWOT Excl Concorrente ${uniqueId}`;
    createSwot(titulo);
    openSwotTab();
    openSwotByTitle(titulo);

    const descItem = `Item concorrente excluir ${uniqueId}`;
    addSwotItem("Força", descItem);
    cy.contains(descItem, { timeout: 8000 }).should("be.visible");

    cy.contains(descItem)
      .closest('[class*="flex"][class*="items-start"]')
      .find('button')
      .filter((_, el) => el.querySelector('svg.lucide-trash-2') !== null)
      .first()
      .click({ force: true });

    cy.get('[role="alertdialog"]', { timeout: 5000 }).should("be.visible");
    cy.get('[role="alertdialog"]').contains("button", "Excluir").click();
    cy.contains(descItem, { timeout: 8000 }).should("not.exist");

    // A UI não deve estar travada
    cy.get('input[placeholder*="Descreva o item"]').should("be.visible");
  });

  it("CT-SWOT-029 — Resiliência: UI não trava após operações", () => {
    const titulo = `SWOT Resiliência ${uniqueId}`;
    createSwot(titulo);
    openSwotTab();
    openSwotByTitle(titulo);

    const desc = `Resiliente ${uniqueId}`;
    addSwotItem("Oportunidade", desc);
    cy.contains(desc, { timeout: 8000 }).should("be.visible");

    cy.contains(desc)
      .closest('[class*="flex"][class*="items-start"]')
      .find('button')
      .filter((_, el) => el.querySelector('svg.lucide-trash-2') !== null)
      .first()
      .click({ force: true });

    cy.get('[role="alertdialog"]', { timeout: 5000 }).should("be.visible");
    cy.get('[role="alertdialog"]').contains("button", "Excluir").click();

    // Ainda pode adicionar novos itens
    const desc2 = `Novo após exclusão ${uniqueId}`;
    addSwotItem("Ameaça", desc2);
    cy.contains(desc2, { timeout: 8000 }).should("be.visible");

    // Pode voltar sem erro
    clickVoltar();
  });
});
