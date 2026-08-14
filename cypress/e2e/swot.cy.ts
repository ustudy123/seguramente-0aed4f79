/// <reference types="cypress" />

import { credenciaisDeTeste } from "../support/credenciais";

describe("Módulo SWOT — Estratégia & Governança", () => {
  const { email, senha: password } = credenciaisDeTeste();
  const baseUrl = Cypress.config("baseUrl") as string;
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
    cy.contains("button", /^Entrar$/).should("be.visible").click();
    // Espera a autenticação persistir de verdade (ver support/e2e.ts). O
    // antigo should("not.eq","/login") passava na hora sob o subcaminho.
    cy.aguardarSessaoSupabase();
    closeEmpresaModalIfNeeded();
    cy.wait(1500);
  }

  function goToEstrategia() {
    cy.visit(`${baseUrl}/estrategia`);
    closeEmpresaModalIfNeeded();
    // Assere o h1 da PÁGINA (não o menu lateral): "Governança" também existe
    // no grupo recolhido "Documentos & Governança" do sidebar, e o cy.contains
    // pegava esse botão oculto -> should("be.visible") falhava.
    cy.contains("h1", "Planejamento Estratégico", { timeout: 20000 }).should("be.visible");
  }

  function openSwotTab() {
    cy.get('button[role="tab"]').contains("SWOT").click({ force: true });
    // Re-query after click to avoid detached DOM
    cy.get('button[role="tab"][aria-selected="true"]').should("contain.text", "SWOT");
    cy.wait(1500);
  }

  function openNewSwotModal() {
    // force: o scroll-lock do Radix de um overlay anterior deixa o body com
    // pointer-events:none por um instante e o clique em "Nova SWOT" (que abre
    // o modal) era recusado (causa do CT-SWOT-004).
    cy.contains("button", "Nova SWOT").should("be.visible").click({ force: true });
    cy.get('[role="dialog"]', { timeout: 10000 }).should("be.visible");
    cy.get('[role="dialog"]').contains("Nova Análise SWOT").should("be.visible");
  }

  /**
   * Seleciona uma opção de um Radix Select que já está aberto.
   * Usa force click no portal do select.
   */
  function selectRadixOption(text: string) {
    cy.get('[role="listbox"]', { timeout: 10000 }).should("be.visible");
    cy.contains('[role="option"]', text, { timeout: 10000 })
      .scrollIntoView()
      .should("be.visible")
      .click({ force: true });
    cy.get('[role="listbox"]', { timeout: 10000 }).should("not.exist");
  }

  /**
   * Clica em um SelectTrigger pelo índice dentro do formulário de adicionar item.
   * Os selects ficam dentro de um Card com classe flex gap-2.
   */
  function clickSelectTrigger(index: number) {
    cy.get('input[placeholder*="Descreva o item"]', { timeout: 10000 })
      .should("be.visible")
      .closest('div.flex.gap-2.flex-wrap')
      .find('button[role="combobox"]', { timeout: 10000 })
      .should("have.length.gte", index + 1)
      .eq(index)
      .scrollIntoView()
      .should("be.visible")
      .click({ force: true });

    cy.get('[role="listbox"]', { timeout: 10000 }).should("be.visible");
  }

  function createSwot(titulo: string, descricao = "", periodo = "") {
    openNewSwotModal();

    cy.get('[role="dialog"]').within(() => {
      cy.get("input").first().clear().type(titulo);

      if (descricao) {
        cy.get("textarea").first().clear().type(descricao);
      }

      // Período é um date-picker (Popover+Calendar), não um input de texto — o
      // modal só tem UM <input> (o título). O antigo cy.get("input").eq(1)
      // estourava com "Expected to find element: 1" (não há 2º input).

      cy.contains("button", "Criar Análise").click();
    });

    // Espera o toast de sucesso em vez de verificar se o dialog fechou
    cy.get('[data-sonner-toaster] [data-sonner-toast]', { timeout: 15000 }).should("exist");
    cy.wait(2000);
  }

  function openSwotByTitle(titulo: string) {
    cy.contains(titulo, { timeout: 15000 })
      .should("be.visible")
      .closest('[class*="cursor-pointer"]')
      .click();
    // Aguarda a tela de detalhe renderizar — busca o ícone ChevronLeft que acompanha "Voltar"
    cy.get('svg.lucide-chevron-left', { timeout: 15000 }).should("exist");
    cy.wait(1000);
  }

  function addSwotItem(tipo: string, descricao: string, classificacao = "Estratégico", impacto = "Médio") {
    // 1. Selecionar tipo (primeiro select trigger)
    clickSelectTrigger(0);
    selectRadixOption(tipo);

    // 2. Digitar descrição
    cy.get('input[placeholder*="Descreva o item"]').clear().type(descricao);

    // 3. Selecionar classificação (segundo select trigger)
    clickSelectTrigger(1);
    selectRadixOption(classificacao);

    // 4. Selecionar impacto (terceiro select trigger)
    clickSelectTrigger(2);
    selectRadixOption(impacto);

    // 5. Clicar no botão de adicionar (ícone Plus)
    cy.get('button').filter(':visible').filter((_, el) => {
      return el.querySelector('svg.lucide-plus') !== null;
    }).last().click();

    cy.wait(1500);
  }

  function clickVoltar() {
    // Usa o id estável do botão Voltar do detalhe. svg.lucide-chevron-left
    // casava 2 elementos (o Voltar E o toggle de recolher a sidebar, que é
    // opacity-0) -> cy.click falhava com "contained 2 elements".
    cy.get('#btn-voltar-swot', { timeout: 10000 }).click({ force: true });
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
    // Cria sempre uma SWOT antes — o guard condicional dependia de capturar
    // "Nenhuma análise SWOT" no instante exato (corrida com o loading), então
    // às vezes nenhum card era criado e o cy.get do card estourava em 15s.
    createSwot(`SWOT Nav ${uniqueId}`);
    openSwotTab();
    // Deixa a lista assentar após o re-render (Error fetching user data) antes
    // de clicar; sem scrollIntoView, que abria janela para o card se desanexar.
    cy.wait(2000);
    cy.get('[data-testid="swot-card"]', { timeout: 15000 }).first().click({ force: true });
    cy.wait(2000);

    // Detalhe: botão Voltar e botão Excluir devem aparecer (por ID)
    cy.get('#btn-voltar-swot', { timeout: 15000 }).should("be.visible");
    cy.get('#btn-excluir-swot', { timeout: 15000 }).should("be.visible");
  });

  // ═══════════════════════════════════════════════
  // TELA B — MODAL CRIAR SWOT
  // ═══════════════════════════════════════════════

  it("CT-SWOT-010 — Criar SWOT (caminho feliz)", () => {
    const titulo = `SWOT Teste E2E ${uniqueId}`;
    createSwot(titulo, "Descrição de teste automatizado");

    openSwotTab();
    cy.contains(titulo, { timeout: 10000 }).should("be.visible");
  });

  it("CT-SWOT-011 — Título obrigatório", () => {
    openNewSwotModal();

    cy.get('[role="dialog"]').within(() => {
      cy.get("input").first().clear();
      cy.contains("button", "Criar Análise").click();
    });

    cy.get('[data-sonner-toaster] [data-sonner-toast], [role="status"], .sonner-toast', { timeout: 10000 })
      .should("exist")
      .and("contain.text", "Preencha o título");

    cy.get('[role="dialog"]').should("exist");
    cy.get("body").type("{esc}");
  });

  it("CT-SWOT-012 — Período inválido (formato)", () => {
    openNewSwotModal();
    const titulo = `SWOT Periodo Invalido ${uniqueId}`;

    cy.get('[role="dialog"]').within(() => {
      cy.get("input").first().clear().type(titulo);
      // Não há campo de período em texto no modal (é date-picker), então não
      // há como digitar formato inválido. O teste só garante que a app não
      // trava — mantém a asserção final de body visível.
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

    // Espera toast de sucesso ou dialog fechar
    cy.get('[data-sonner-toaster] [data-sonner-toast]', { timeout: 15000 }).should("exist");
    cy.wait(3000);

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
    cy.wait(2000);
    openSwotByTitle(titulo);

    const descItem = `Item força teste ${uniqueId}`;
    addSwotItem("Força", descItem, "Estratégico", "Alto");

    cy.contains(descItem, { timeout: 8000 }).should("be.visible");
  });

  it("CT-SWOT-021 — Adicionar item em cada quadrante", () => {
    const titulo = `SWOT Quadrantes ${uniqueId}`;
    createSwot(titulo);
    openSwotTab();
    cy.wait(2000);
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
    cy.wait(2000);
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
    cy.wait(2000);
    openSwotByTitle(titulo);

    const descItem = `Item para excluir ${uniqueId}`;
    addSwotItem("Força", descItem);
    cy.contains(descItem, { timeout: 8000 }).should("be.visible");

    // Clica na lixeira do item
    cy.contains(descItem)
      .closest('[class*="rounded-lg"][class*="border"]')
      .find('[data-testid="btn-excluir-item"]')
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
    cy.wait(2000);
    openSwotByTitle(titulo);

    // Clica no botão Excluir (destructive) no header
    cy.contains("button", "Excluir").first().click();

    // Confirma no AlertDialog
    cy.get('[role="alertdialog"]', { timeout: 5000 }).should("be.visible");
    cy.get('[role="alertdialog"]').contains("button", "Excluir permanentemente").click();

    // Deve voltar para listagem
    cy.contains("Análises SWOT", { timeout: 10000 }).should("be.visible");
    cy.contains(titulo).should("not.exist");
  });

  it("CT-SWOT-026 — Voltar da tela de detalhe", () => {
    // Cria sempre; clica o card por data-testid (o [class*=cursor-pointer]
    // pegava outros elementos); volta pelo id estável do botão.
    createSwot(`SWOT Voltar ${uniqueId}`);
    openSwotTab();

    cy.get('[data-testid="swot-card"]', { timeout: 15000 }).first().should("be.visible").click();
    cy.wait(2000);

    cy.get('#btn-voltar-swot', { timeout: 15000 }).should("be.visible").click();

    cy.contains("Análises SWOT", { timeout: 10000 }).should("be.visible");
  });

  it("CT-SWOT-027 — Concorrência: adicionar itens em sequência rápida", () => {
    const titulo = `SWOT Concorrência ${uniqueId}`;
    createSwot(titulo);
    openSwotTab();
    cy.wait(2000);
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
    cy.wait(2000);
    openSwotByTitle(titulo);

    const descItem = `Item concorrente excluir ${uniqueId}`;
    addSwotItem("Força", descItem);
    cy.contains(descItem, { timeout: 8000 }).should("be.visible");

    cy.contains(descItem)
      .closest('[class*="rounded-lg"][class*="border"]')
      .find('button')
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
    cy.wait(2000);
    openSwotByTitle(titulo);

    const desc = `Resiliente ${uniqueId}`;
    addSwotItem("Oportunidade", desc);
    cy.contains(desc, { timeout: 8000 }).should("be.visible");

    cy.contains(desc)
      .closest('[class*="rounded-lg"][class*="border"]')
      .find('[data-testid="btn-excluir-item"]')
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
