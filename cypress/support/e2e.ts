// Suppress ALL application-originated errors to prevent flaky test failures.
// The tests validate behavior via assertions, not by relying on zero app errors.
// Antes de engolir, guardamos a mensagem para o diagnóstico de falha (abaixo):
// quando um teste quebra sem achar o conteúdo esperado, saber QUAL erro a app
// jogou (ex.: um throw que caiu no ErrorBoundary "Algo deu errado") é o que
// separa "spec desatualizado" de "tela realmente quebrada".
const errosCapturados: string[] = [];

Cypress.on("uncaught:exception", (err) => {
  try {
    errosCapturados.push("uncaught: " + (err?.message || String(err)));
  } catch {
    /* nunca deixa o diagnóstico derrubar o teste */
  }
  // Return false to prevent ALL uncaught exceptions from failing the test.
  // This covers: ResizeObserver, AbortError, auth errors, signal aborted, etc.
  return false;
});

Cypress.on("window:before:load", (win) => {
  win.addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
  });

  // React registra erros de render via console.error ANTES do ErrorBoundary
  // assumir. Interceptar aqui é o jeito de capturar "por que a página não
  // montou" mesmo com as exceções sendo engolidas acima.
  try {
    const orig = win.console.error;
    win.console.error = (...args: unknown[]) => {
      try {
        errosCapturados.push(
          "console.error: " +
            args
              .map((a) => (a && (a as Error).stack ? (a as Error).message : String(a)))
              .join(" "),
        );
      } catch {
        /* idem */
      }
      orig.apply(win.console, args as []);
    };
  } catch {
    /* idem */
  }
});

// Diagnóstico de falha: quando um teste falha (inclusive no before each, que é
// onde toda a suíte está caindo), despeja no LOG DO CI a rota, o texto visível
// da página e os erros capturados. É o único canal legível daqui — os prints
// vão para o painel/artefato, mas o texto no log conta a história na hora.
// Roda ~1x por arquivo (os demais testes ficam pending e não disparam hooks).
afterEach(function () {
  const estado = this.currentTest?.state;
  if (estado === "passed") {
    errosCapturados.length = 0;
    return;
  }
  cy.document({ log: false }).then((doc) => {
    let rota = "?";
    let corpo = "";
    let estado = "";
    try {
      rota = doc.location ? doc.location.pathname + doc.location.search : "?";
      corpo = (doc.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 900);
      // Sonda compacta (só aparece em falha): spinner de carregamento, diálogos
      // e o input de nome de campanha — para diagnosticar sem re-instrumentar.
      const spinner = doc.querySelectorAll(".animate-spin").length;
      const dialogs = doc.querySelectorAll('[role="dialog"]').length;
      const inp = doc.querySelector("#input-campanha-nome") as HTMLElement | null;
      const inpInfo = inp ? `existe h=${inp.offsetHeight}` : "ausente";
      estado = `spinner=${spinner} dialogs=${dialogs} input-campanha-nome=${inpInfo}`;
    } catch {
      /* segue com o que tiver */
    }
    const erros = errosCapturados.slice(0, 6).join("  ||  ") || "(nenhum)";
    errosCapturados.length = 0;
    cy.task(
      "diag",
      `[FALHA] ${this.currentTest?.title}\n  rota=${rota}\n  estado=${estado}\n  erros=${erros}\n  corpo="${corpo}"`,
      { log: false },
    );
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
// BARRA DUPLA NA ROTA = 404 (causa real das 5 falhas de before each)
//
// Os specs montam a URL como `${baseUrl}/epis`. O baseUrl vem de
// Cypress.config("baseUrl"), que a esteira passa por CYPRESS_BASE_URL COM
// barra final (o Cypress restaura essa barra por cima da normalização do
// cypress.config.ts). Resultado: `.../seguramente-0aed4f79//epis` — o
// BrowserRouter trata `//epis` como rota inexistente e renderiza o 404
// "Page not found", dentro do layout (por isso o menu lateral aparecia e
// dava falso-positivo em asserções amplas). Aqui colapsamos barras
// repetidas SÓ no caminho, preservando o `://` do esquema e a query.
function colapsarBarrasNoCaminho(u: string): string {
  return u.replace(
    /^(https?:\/\/[^/]+)(\/[^?#]*)?/,
    (m, base, caminho) => (caminho ? base + caminho.replace(/\/{2,}/g, "/") : m),
  );
}

// Tipos como `any` de propósito: `cy.visit` é sobrecarregado (aceita
// visit(url), visit(url, opts) e visit(opts)), e brigar com as sobrecargas
// aqui não agrega — o corpo cobre as duas formas usadas nos specs.
Cypress.Commands.overwrite(
  "visit",
  (originalFn: any, urlOrOpts: any, maybeOpts?: any) => {
    if (urlOrOpts && typeof urlOrOpts === "object") {
      const opts = { ...urlOrOpts };
      if (typeof opts.url === "string") opts.url = colapsarBarrasNoCaminho(opts.url);
      return originalFn({ failOnStatusCode: false, ...opts });
    }
    const url =
      typeof urlOrOpts === "string" ? colapsarBarrasNoCaminho(urlOrOpts) : urlOrOpts;
    return originalFn(url, { failOnStatusCode: false, ...(maybeOpts || {}) });
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
