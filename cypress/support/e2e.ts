// Ignora erros do app que não são bugs reais (ex: React Query cancelando requests)
Cypress.on("uncaught:exception", (err) => {
  // AbortError do React Query quando componente desmonta
  if (err.name === "AbortError" || err.message?.includes("signal is aborted") || err.message?.includes("aborted")) {
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
    err.message?.includes("JWT")
  ) {
    return false;
  }
  // Erros de React Query / cancelamento genérico
  if (err.message?.includes("cancelled") || err.message?.includes("canceled")) {
    return false;
  }
  // Deixa outros erros falharem normalmente
  return true;
});
