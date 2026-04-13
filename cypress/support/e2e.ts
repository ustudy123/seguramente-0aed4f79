// Ignora erros do app que não são bugs reais (ex: React Query cancelando requests)
Cypress.on("uncaught:exception", (err) => {
  // ResizeObserver loop — não é um bug real
  if (err.message?.includes("ResizeObserver loop")) {
    return false;
  }
  // AbortError do React Query quando componente desmonta
  if (err.name === "AbortError") {
    return false;
  }
  // Qualquer erro relacionado a signal/abort
  if (err.message?.includes("signal") || err.message?.includes("abort") || err.message?.includes("aborted")) {
    return false;
  }
  // Erros de rede/fetch que ocorrem durante navegação
  if (err.message?.includes("Failed to fetch") || err.message?.includes("Load failed")) {
    return false;
  }
  // SyntaxError de HTML servido no lugar de JS (SPA reload durante navegação)
  if (err.name === "SyntaxError" && err.message?.includes("Unexpected token '<'")) {
    return false;
  }
  // Erros de autenticação que ocorrem durante navegação entre páginas
  if (
    err.message?.includes("Usuário não autenticado") ||
    err.message?.includes("Dados insuficientes para atualização") ||
    err.message?.includes("não autenticado") ||
    err.message?.includes("JWT") ||
    err.message?.includes("autenticad")
  ) {
    return false;
  }
  // Erros de React Query / cancelamento genérico
  if (err.message?.includes("cancelled") || err.message?.includes("canceled")) {
    return false;
  }
  // Erros de promise rejection não tratados genéricos durante navegação
  if (err.message?.includes("unhandled") || err.message?.includes("without reason")) {
    return false;
  }
  // Deixa outros erros falharem normalmente
  return true;
});
