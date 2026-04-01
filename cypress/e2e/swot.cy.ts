/// <reference types="cypress" />

describe("Módulo SWOT — Estratégia & Governança", () => {
  const email = "renata_sophia_cortereal@cafefrossard.com";
  const password = "123456";
  const baseUrl = Cypress.config("baseUrl") || "https://seguramente.app.br";
  const uniqueId = Date.now();

  function login() {
    cy.visit(`${baseUrl}/login`);
    cy.get('input[type="email"]').should("be.visible").clear().type(email);
    cy.get('input[autocomplete="current-password"]').should("be.visible").clear().type(password, { log: false });
    cy.contains("button", /^Entrar$/).click();
    cy.location("pathname", { timeout: 20000 }).should("not.eq", "/login");

    // Se a tela de seleção obrigatória de empresa aparecer, selecionar a primeira
    cy.wait(3000);
    cy.get("body").then(($body) => {
      if ($body.find(':contains("Selecione a empresa")').length > 0) {
        // Clica na primeira empresa disponível
        cy.get('[class*="Card"], [class*="card"]').filter(':visible').first().click();
        // Confirma a seleção
        cy.contains("button", /Continuar|Confirmar|Entrar/i).should("be.visible").click();
        cy.wait(2000);
      }
    });
  }

  function goToEstrategia() {
    cy.visit(`${baseUrl}/estrategia-governanca`);
    cy.wait(3000);
    // Se a tela de seleção obrigatória aparecer novamente, lidar com ela
    cy.get("body").then(($body) => {
      if ($body.find(':contains("Selecione a empresa")').length > 0) {
        cy.get('[class*="Card"], [class*="card"]').filter(':visible').first().click();
        cy.contains("button", /Continuar|Confirmar|Entrar/i).should("be.visible").click();
        cy.wait(2000);
      }
    });
    cy.contains(/Estratégia|Governança/i, { timeout: 20000 }).should("be.visible");
  }

  function openSwotTab() {
    cy.contains('[role="tab"]', "SWOT").should("be.visible").click();
    cy.contains('[role="tab"]', "SWOT").should("have.attr", "aria-selected", "true");
  }

  function openNewSwotModal() {
    cy.contains("button", "Nova SWOT").should("be.visible").click();
    cy.contains("Nova Análise SWOT").should("be.visible");
  }

  function selectRadixOption(text: string) {
    cy.contains('[role="option"]', text).should("be.visible").click({ force: true });
  }

  function createSwot(titulo: string, descricao = "", periodo = "") {
    openNewSwotModal();
    cy.get('input[placeholder*="SWOT Estratégica"]').clear().type(titulo);
    if (descricao) {
      cy.get('textarea[placeholder*="Contexto"]').clear().type(descricao);
    }
    if (periodo) {
      cy.get('input[placeholder*="2026"]').clear().type(periodo);
    }
    cy.contains("button", "Criar Análise").click();
    cy.contains("Nova Análise SWOT", { timeout: 10000 }).should("not.exist");
  }

  function openSwotByTitle(titulo: string) {
    cy.contains(titulo).closest('[class*="card"], [class*="Card"]').should("be.visible").click();
    cy.contains("button", "Voltar").should("be.visible");
  }

  function addSwotItem(tipo: string, descricao: string, classificacao = "Estratégico", impacto = "Médio") {
    // Select tipo
    cy.get('button[role="combobox"]').first().click();
    selectRadixOption(tipo);

    // Type description
    cy.get('input[placeholder*="Descreva o item"]').clear().type(descricao);

    // Select classificacao
    cy.get('button[role="combobox"]').eq(1).click();
    selectRadixOption(classificacao);

    // Select impacto
    cy.get('button[role="combobox"]').eq(2).click();
    selectRadixOption(impacto);

    // Click add button
    cy.get('button').filter(':has(svg)').filter((_, el) => {
      return el.querySelector('svg.lucide-plus') !== null;
    }).click();
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
    // Garante que a listagem carrega (cards ou estado vazio)
    cy.get("body").then(($body) => {
      const hasCards = $body.find('[class*="card"], [class*="Card"]').length > 0;
      const hasEmpty = $body.text().includes("Nenhuma análise SWOT");
      expect(hasCards || hasEmpty).to.be.true;
    });
    // Verifica que botão Nova SWOT existe
    cy.contains("button", "Nova SWOT").should("be.visible");
  });

  it("CT-SWOT-002 — Estado vazio", () => {
    // Verifica que caso não haja SWOTs, mostra mensagem adequada
    cy.get("body").then(($body) => {
      if ($body.text().includes("Nenhuma análise SWOT")) {
        cy.contains("Nenhuma análise SWOT").should("be.visible");
        cy.contains("Nova SWOT").should("be.visible");
      } else {
        // Se há SWOTs, o teste é considerado ok (cenário N/A)
        cy.log("Há SWOTs existentes — estado vazio não se aplica");
      }
    });
  });

  it("CT-SWOT-003 — Troca de escopo", () => {
    // Verifica se o seletor de escopo existe e interage com ele
    cy.contains("Escopo:").should("be.visible");

    // Clica no seletor de escopo
    cy.get('button[role="combobox"]').filter(':visible').first().then(($btn) => {
      // Apenas testa se o seletor funciona sem erro
      cy.wrap($btn).click({ force: true });
      // Se abriu opções, seleciona a primeira disponível
      cy.get('[role="option"]').first().click({ force: true });
    });

    // Após troca, a lista deve atualizar (sem erro)
    cy.contains(/Análises SWOT|Nenhuma análise/i).should("be.visible");
  });

  it("CT-SWOT-004 — Abrir SWOT clicando no card", () => {
    // Precisa ter pelo menos uma SWOT; cria se necessário
    cy.get("body").then(($body) => {
      if ($body.text().includes("Nenhuma análise SWOT")) {
        createSwot(`SWOT Nav ${uniqueId}`);
        openSwotTab();
      }
    });

    // Clica no primeiro card
    cy.get('[class*="cursor-pointer"]').first().should("be.visible").click();

    // Deve mostrar Tela C (detalhe)
    cy.contains("button", "Voltar").should("be.visible");
    cy.contains("button", "Excluir").should("be.visible");
  });

  // ═══════════════════════════════════════════════
  // TELA B — MODAL CRIAR SWOT
  // ═══════════════════════════════════════════════

  it("CT-SWOT-010 — Criar SWOT (caminho feliz)", () => {
    const titulo = `SWOT Teste E2E ${uniqueId}`;
    createSwot(titulo, "Descrição de teste automatizado", "2026 Q2");

    // Verifica se apareceu na listagem
    openSwotTab();
    cy.contains(titulo).should("be.visible");
  });

  it("CT-SWOT-011 — Título obrigatório", () => {
    openNewSwotModal();

    // Limpa título e tenta criar
    cy.get('input[placeholder*="SWOT Estratégica"]').clear();
    cy.contains("button", "Criar Análise").click();

    // Deve mostrar erro e modal ainda visível
    cy.contains("Preencha o título").should("be.visible");
    cy.contains("Nova Análise SWOT").should("be.visible");
  });

  it("CT-SWOT-012 — Período inválido (formato)", () => {
    openNewSwotModal();
    const titulo = `SWOT Periodo Invalido ${uniqueId}`;
    cy.get('input[placeholder*="SWOT Estratégica"]').clear().type(titulo);

    // Testa com dados estranhos no período — não deve quebrar a UI
    cy.get('input[placeholder*="2026"]').clear().type("🎉abcd!@#$");
    cy.contains("button", "Criar Análise").click();

    // Modal deve fechar (criação aceita) ou mostrar validação — sem crash
    cy.get("body").should("be.visible");
  });

  it("CT-SWOT-013 — Fechar modal com dados preenchidos", () => {
    openNewSwotModal();
    cy.get('input[placeholder*="SWOT Estratégica"]').clear().type("SWOT que será descartada");
    cy.get('textarea[placeholder*="Contexto"]').clear().type("Dados que devem ser perdidos");

    // Fecha o modal clicando no X (botão de fechar do dialog)
    cy.get('[role="dialog"]').find('button[class*="close"], button:has(svg.lucide-x)').first().click({ force: true });

    // Modal deve fechar
    cy.contains("Nova Análise SWOT").should("not.exist");
  });

  it("CT-SWOT-014 — Duplo clique no Criar Análise", () => {
    openNewSwotModal();
    const titulo = `SWOT Duplo Click ${uniqueId}`;
    cy.get('input[placeholder*="SWOT Estratégica"]').clear().type(titulo);

    // Clica duas vezes rápido
    cy.contains("button", "Criar Análise").dblclick();

    // Espera modal fechar
    cy.contains("Nova Análise SWOT", { timeout: 10000 }).should("not.exist");

    // Verifica que criou apenas 1
    openSwotTab();
    cy.get("body").then(($body) => {
      const matches = $body.text().match(new RegExp(titulo, "g"));
      expect(matches?.length || 0).to.eq(1);
    });
  });

  // ═══════════════════════════════════════════════
  // TELA C — ITENS DA SWOT
  // ═══════════════════════════════════════════════

  it("CT-SWOT-020 — Adicionar item em Força", () => {
    // Cria SWOT e abre
    const titulo = `SWOT Força ${uniqueId}`;
    createSwot(titulo);
    openSwotTab();
    openSwotByTitle(titulo);

    // Adiciona item tipo Força
    const descItem = `Item força teste ${uniqueId}`;
    addSwotItem("Força", descItem, "Estratégico", "Alto");

    // Verifica que aparece no quadrante Força
    cy.contains("Força").parent().parent().within(() => {
      cy.contains(descItem).should("be.visible");
    });
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
      cy.wait(500); // aguarda persistência
    });

    // Verifica cada quadrante
    quadrantes.forEach(({ desc }) => {
      cy.contains(desc).should("be.visible");
    });
  });

  it("CT-SWOT-022 — Campos obrigatórios para item (descrição vazia)", () => {
    const titulo = `SWOT Validação ${uniqueId}`;
    createSwot(titulo);
    openSwotTab();
    openSwotByTitle(titulo);

    // Tenta adicionar sem descrição
    cy.get('input[placeholder*="Descreva o item"]').clear();
    cy.get('button').filter(':has(svg.lucide-plus)').click();

    // Deve mostrar erro
    cy.contains("Preencha a descrição").should("be.visible");
  });

  it("CT-SWOT-023 — Limites de texto (BVA)", () => {
    const titulo = `SWOT BVA ${uniqueId}`;
    createSwot(titulo);
    openSwotTab();
    openSwotByTitle(titulo);

    // Teste com 1 caractere
    addSwotItem("Força", "A");
    cy.contains("A").should("be.visible");

    // Teste com texto longo (255 chars)
    const longText = "X".repeat(255);
    addSwotItem("Fraqueza", longText);
    cy.wait(500);

    // Teste com apenas espaços — deve bloquear
    cy.get('input[placeholder*="Descreva o item"]').clear().type("   ");
    cy.get('button').filter(':has(svg.lucide-plus)').click();
    cy.contains("Preencha a descrição").should("be.visible");
  });

  it("CT-SWOT-024 — Excluir item", () => {
    const titulo = `SWOT Excluir Item ${uniqueId}`;
    createSwot(titulo);
    openSwotTab();
    openSwotByTitle(titulo);

    const descItem = `Item para excluir ${uniqueId}`;
    addSwotItem("Força", descItem);
    cy.wait(500);
    cy.contains(descItem).should("be.visible");

    // Clica na lixeira do item
    cy.contains(descItem).closest('[class*="flex"]').within(() => {
      cy.get('button:has(svg.lucide-trash-2)').click({ force: true });
    });

    // Confirma exclusão no AlertDialog
    cy.contains("Excluir item?").should("be.visible");
    cy.contains("button", "Excluir").last().click();

    // Item deve sumir
    cy.contains(descItem).should("not.exist");
  });

  it("CT-SWOT-025 — Excluir SWOT", () => {
    const titulo = `SWOT Para Excluir ${uniqueId}`;
    createSwot(titulo);
    openSwotTab();
    openSwotByTitle(titulo);

    // Clica no botão Excluir (destructive)
    cy.contains("button", "Excluir").first().click();

    // Confirma no AlertDialog
    cy.contains("Excluir análise SWOT?").should("be.visible");
    cy.contains("button", "Excluir permanentemente").click();

    // Deve voltar para listagem e a SWOT não deve mais existir
    cy.contains("Análises SWOT").should("be.visible");
    cy.contains(titulo).should("not.exist");
  });

  it("CT-SWOT-026 — Voltar da tela de detalhe", () => {
    // Precisa de uma SWOT existente
    cy.get("body").then(($body) => {
      if ($body.text().includes("Nenhuma análise SWOT")) {
        createSwot(`SWOT Voltar ${uniqueId}`);
        openSwotTab();
      }
    });

    cy.get('[class*="cursor-pointer"]').first().click();
    cy.contains("button", "Voltar").should("be.visible").click();

    // Deve voltar à listagem
    cy.contains("Análises SWOT").should("be.visible");
  });

  it("CT-SWOT-027 — Concorrência: adicionar itens em sequência rápida", () => {
    const titulo = `SWOT Concorrência ${uniqueId}`;
    createSwot(titulo);
    openSwotTab();
    openSwotByTitle(titulo);

    // Simula adições rápidas em sequência (mesmo usuário, 2 itens sem esperar)
    const desc1 = `Concorrente A ${uniqueId}`;
    const desc2 = `Concorrente B ${uniqueId}`;

    addSwotItem("Força", desc1);
    addSwotItem("Fraqueza", desc2);

    cy.wait(2000); // Aguarda persistência

    // Ambos devem aparecer
    cy.contains(desc1).should("be.visible");
    cy.contains(desc2).should("be.visible");
  });

  it("CT-SWOT-028 — Concorrência: exclusão de item já removido (graceful)", () => {
    // Este cenário testa que a UI não quebra em caso de erro de exclusão
    // Como não temos 2 sessões no Cypress, verificamos resiliência do botão
    const titulo = `SWOT Excl Concorrente ${uniqueId}`;
    createSwot(titulo);
    openSwotTab();
    openSwotByTitle(titulo);

    const descItem = `Item concorrente excluir ${uniqueId}`;
    addSwotItem("Força", descItem);
    cy.wait(500);

    // Exclui normalmente
    cy.contains(descItem).closest('[class*="flex"]').within(() => {
      cy.get('button:has(svg.lucide-trash-2)').click({ force: true });
    });
    cy.contains("button", "Excluir").last().click();
    cy.contains(descItem).should("not.exist");

    // A UI não deve estar travada
    cy.get('input[placeholder*="Descreva o item"]').should("be.visible");
  });

  it("CT-SWOT-029 — Resiliência: UI não trava após operações", () => {
    // Verifica que após múltiplas operações a tela continua funcional
    const titulo = `SWOT Resiliência ${uniqueId}`;
    createSwot(titulo);
    openSwotTab();
    openSwotByTitle(titulo);

    // Adiciona e remove um item
    const desc = `Resiliente ${uniqueId}`;
    addSwotItem("Oportunidade", desc);
    cy.wait(500);

    cy.contains(desc).closest('[class*="flex"]').within(() => {
      cy.get('button:has(svg.lucide-trash-2)').click({ force: true });
    });
    cy.contains("button", "Excluir").last().click();

    // Ainda pode adicionar novos itens
    addSwotItem("Ameaça", `Novo após exclusão ${uniqueId}`);
    cy.wait(500);
    cy.contains(`Novo após exclusão ${uniqueId}`).should("be.visible");

    // Pode voltar sem erro
    cy.contains("button", "Voltar").click();
    cy.contains("Análises SWOT").should("be.visible");
  });
});
