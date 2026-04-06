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
  // Deixa outros erros falharem normalmente
  return true;
});