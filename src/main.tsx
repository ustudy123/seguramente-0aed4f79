import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const abortMessagePattern = /signal is aborted without reason|AbortError/i;

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = typeof reason === "string" ? reason : reason?.message;
    const name = typeof reason === "object" && reason ? reason.name : undefined;

    if (name === "AbortError" || abortMessagePattern.test(message ?? "")) {
      event.preventDefault();
    }
  });

  window.addEventListener("error", (event) => {
    const message = event.message || event.error?.message || "";
    const name = event.error?.name;

    if (name === "AbortError" || abortMessagePattern.test(message)) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
