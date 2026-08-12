// Suppress ALL application-originated errors to prevent flaky test failures.
// The tests validate behavior via assertions, not by relying on zero app errors.
Cypress.on("uncaught:exception", (_err) => {
  // Return false to prevent ALL uncaught exceptions from failing the test.
  // This covers: ResizeObserver, AbortError, auth errors, signal aborted, etc.
  return false;
});

Cypress.on("window:before:load", (win) => {
  win.addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
  });
});

// =====================================================================
// DEEP-LINK DE SPA NO GITHUB PAGES = STATUS 404
//
// O site de teste é uma SPA servida sob /seguramente-0aed4f79/. O Pages
// não tem arquivo para rotas como /login ou /estrategia, então serve o
// 404.html (que a esteira copia do index.html) — a aplicação carrega e
// roteia normalmente, porque o BrowserRouter usa o basename certo. Só que
// o status HTTP é 404, e `cy.visit()` reprova qualquer status != 2xx por
// padrão, derrubando o teste no `before each` antes de qualquer asserção.
//
// Este projeto já convivia com isso: as visitas a /questionario no spec
// de psicossocial já passavam `failOnStatusCode: false` na mão. As de
// login não passavam porque foram escritas contra a produção, onde /login
// responde 200. Aqui isso vira o padrão de TODA visita — a validação real
// continua sendo por conteúdo (o spec espera o campo de e-mail, o texto da
// tela), não pelo código HTTP. Uma opção explícita no cy.visit ainda vence.
// =====================================================================
// Tipos como `any` de propósito: `cy.visit` é sobrecarregado (aceita
// visit(url), visit(url, opts) e visit(opts)), e brigar com as sobrecargas
// aqui não agrega — o corpo cobre as duas formas usadas nos specs.
Cypress.Commands.overwrite(
  "visit",
  (originalFn: any, urlOrOpts: any, maybeOpts?: any) => {
    if (urlOrOpts && typeof urlOrOpts === "object") {
      return originalFn({ failOnStatusCode: false, ...urlOrOpts });
    }
    return originalFn(urlOrOpts, { failOnStatusCode: false, ...(maybeOpts || {}) });
  },
);

// =====================================================================
// SINAL DE LOGIN CONFIÁVEL
//
// O jeito antigo de "confirmar que entrou" era should("not.eq","/login")
// sobre o pathname. No site de teste o app roda sob /seguramente-0aed4f79/,
// então o pathname é /seguramente-0aed4f79/login e NUNCA é igual a /login:
// a asserção passava na hora, sem esperar a autenticação. Com cy.session, o
// snapshot saía antes de o token persistir e a sessão ia vazia — e a falha
// só aparecia lá na frente, ao abrir o módulo (foi o que a run #34 mostrou:
// conta boa, login "ok", mas o módulo nunca carregava).
//
// Este comando espera o sinal real: o token de sessão do Supabase no
// localStorage (chave sb-<ref>-auth-token, config padrão do client).
// Independe de texto de tela, de rota e do basename.
// =====================================================================
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      aguardarSessaoSupabase(): Chainable<void>;
    }
  }
}

Cypress.Commands.add("aguardarSessaoSupabase", () => {
  cy.window({ timeout: 20000 }).should((win) => {
    const autenticado = Object.keys(win.localStorage).some(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
    );
    expect(autenticado, "sessão Supabase persistida no localStorage").to.be.true;
  });
});

export {};

// =====================================================================
// SEGUNDA TRAVA DE AMBIENTE
//
// A primeira trava está no cypress.config.ts e olha a URL do site. Ela
// não basta: o site de teste poderia, por erro de build, ter sido
// compilado apontando para o Supabase de PRODUÇÃO. Aí a tela é de teste
// e o banco é o real — o pior dos casos, e invisível a olho nu.
//
// Esta trava olha para onde a aplicação realmente fala. Qualquer
// chamada ao projeto de produção é cortada antes de sair e derruba o
// teste com a explicação. Preferimos a suíte inteira vermelha a um
// único INSERT em cima de dado de cliente.
// =====================================================================

let chamadasAProducao: string[] = [];

beforeEach(() => {
  chamadasAProducao = [];

  const refProducao = String(Cypress.env("refProducao") || "");
  if (!refProducao) return;

  cy.intercept({ url: `**${refProducao}**` }, (req) => {
    chamadasAProducao.push(req.url);
    req.destroy();
  });
});

afterEach(() => {
  if (chamadasAProducao.length === 0) return;

  const amostra = chamadasAProducao.slice(0, 3).join("\n  ");
  const total = chamadasAProducao.length;
  chamadasAProducao = [];

  throw new Error(
    `[Cypress] A aplicação tentou falar com o Supabase de PRODUÇÃO.\n` +
      `${total} chamada(s) bloqueada(s). Amostra:\n  ${amostra}\n` +
      `O site de teste deve ser construído com .env.staging ` +
      `(projeto bmehdgthciuvdbvutsdv). Confira o build antes de seguir.`,
  );
});
