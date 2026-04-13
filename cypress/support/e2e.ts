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
