import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Detecta quando uma nova versão do app foi publicada e oferece
 * a atualização ao usuário — resolve o problema de abas/PWAs que
 * ficam abertos por horas/dias rodando um build antigo.
 *
 * Como funciona: o index.html é servido sem cache e referencia o
 * bundle principal com hash no nome (/assets/index-XXXX.js). O hook
 * baixa o index.html periodicamente (e quando a aba volta ao foco),
 * extrai o hash do bundle e compara com o que está em execução.
 * Hash diferente = build novo publicado → toast com botão Atualizar.
 */

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const BUNDLE_REGEX = /\/assets\/index-[A-Za-z0-9_-]+\.js/;

const getBundleAtual = (): string | null => {
  const scripts = Array.from(document.querySelectorAll("script[src]"));
  for (const s of scripts) {
    const src = s.getAttribute("src") || "";
    const m = src.match(BUNDLE_REGEX);
    if (m) return m[0];
  }
  return null;
};

export function useVersionCheck() {
  const avisado = useRef(false);
  const bundleInicial = useRef<string | null>(null);

  useEffect(() => {
    bundleInicial.current = getBundleAtual();
    if (!bundleInicial.current) return; // dev server não tem bundle com hash

    let parado = false;

    const verificar = async () => {
      if (parado || avisado.current || document.hidden) return;
      try {
        const res = await fetch(`/?vchk=${Date.now()}`, {
          cache: "no-store",
          headers: { Accept: "text/html" },
        });
        if (!res.ok) return;
        const html = await res.text();
        const m = html.match(BUNDLE_REGEX);
        if (m && bundleInicial.current && m[0] !== bundleInicial.current) {
          avisado.current = true;
          toast.info("Nova versão disponível!", {
            description: "Atualize para receber as últimas correções.",
            duration: Infinity,
            action: {
              label: "Atualizar",
              onClick: () => window.location.reload(),
            },
          });
        }
      } catch {
        // offline/erro de rede: tenta de novo no próximo ciclo
      }
    };

    const interval = setInterval(verificar, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) verificar();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    // Primeira checagem após 1 min (evita custo no carregamento)
    const firstCheck = setTimeout(verificar, 60 * 1000);

    return () => {
      parado = true;
      clearInterval(interval);
      clearTimeout(firstCheck);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);
}

export function VersionCheck() {
  useVersionCheck();
  return null;
}
