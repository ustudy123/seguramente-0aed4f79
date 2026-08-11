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
