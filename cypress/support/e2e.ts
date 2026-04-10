// Ignora erros do app que não são bugs reais (ex: React Query cancelando requests)
Cypress.on("uncaught:exception", (err) => {
  // AbortError do React Query quando componente desmonta
  if (err.message?.includes("signal is aborted") || err.name === "AbortError") {
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
  // (mutations disparadas antes do auth state estar pronto após cy.visit)
  if (err.message?.includes("Usuário não autenticado") || err.message?.includes("Dados insuficientes para atualização")) {
    return false;
  }
  // Deixa outros erros falharem normalmente
  return true;
});
