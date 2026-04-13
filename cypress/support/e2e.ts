const shouldIgnoreAppError = (message: string, name?: string) => {
  if (message.includes("ResizeObserver loop")) return true;
  if (name === "AbortError") return true;
  if (message.includes("signal") || message.includes("abort") || message.includes("aborted")) return true;
  if (message.includes("Failed to fetch") || message.includes("Load failed")) return true;
  if (name === "SyntaxError" && message.includes("Unexpected token '<'")) return true;
  if (
    message.includes("Usuário não autenticado") ||
    message.includes("Dados insuficientes para atualização") ||
    message.includes("não autenticado") ||
    message.includes("JWT") ||
    message.includes("autenticad")
  ) {
    return true;
  }
  if (message.includes("cancelled") || message.includes("canceled")) return true;
  if (message.includes("unhandled") || message.includes("without reason")) return true;
  return false;
};

Cypress.on("uncaught:exception", (err) => {
  const message = String(err?.message || "");
  const name = String(err?.name || "");

  if (shouldIgnoreAppError(message, name)) {
    return false;
  }

  return true;
});

Cypress.on("window:before:load", (win) => {
  win.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = String(reason?.message || reason || "");
    const name = String(reason?.name || "");

    if (shouldIgnoreAppError(message, name)) {
      event.preventDefault();
    }
  });
});
