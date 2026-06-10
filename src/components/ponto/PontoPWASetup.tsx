import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share2 } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const HEAD_TAGS: Array<{ tag: "link" | "meta"; attrs: Record<string, string>; key: string }> = [
  { tag: "meta", attrs: { name: "theme-color", content: "#7c3aed" }, key: "ponto-pwa-theme" },
  { tag: "meta", attrs: { name: "apple-mobile-web-app-capable", content: "yes" }, key: "ponto-pwa-apple-cap" },
  { tag: "meta", attrs: { name: "apple-mobile-web-app-status-bar-style", content: "default" }, key: "ponto-pwa-apple-bar" },
  { tag: "meta", attrs: { name: "apple-mobile-web-app-title", content: "Meu Ponto" }, key: "ponto-pwa-apple-title" },
  { tag: "link", attrs: { rel: "apple-touch-icon", href: "/icons/ponto-192.png" }, key: "ponto-pwa-apple-icon" },
];

const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) && !(window as any).MSStream;

interface PontoPWASetupProps {
  token?: string;
}

const PONTO_SW_URL = "/ponto-sw.js";

export const PontoPWASetup = ({ token }: PontoPWASetupProps) => {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    if (!token) return;

    try {
      window.localStorage.setItem("ponto-pwa-token", token);
      window.localStorage.setItem("ponto-pwa-path", `/ponto-externo/${token}`);
    } catch {
      // Ignora falhas de storage e segue com a instalação normal.
    }

    // Guardas: iframe, preview do Lovable, SW indisponível
    let inIframe = false;
    try {
      inIframe = window.self !== window.top;
    } catch {
      inIframe = true;
    }
    const host = window.location.hostname;
    const isPreview = host.includes("id-preview--") || host.includes("lovableproject.com");
    if (inIframe || isPreview || !("serviceWorker" in navigator)) return;

    // Injeta tags fixas no <head>
    const nodes: HTMLElement[] = [];
    HEAD_TAGS.forEach(({ tag, attrs, key }) => {
      if (document.querySelector(`[data-ponto-pwa="${key}"]`)) return;
      const el = document.createElement(tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      el.setAttribute("data-ponto-pwa", key);
      document.head.appendChild(el);
      nodes.push(el);
    });

    // Manifest dinâmico com o token do colaborador (start_url e scope)
    const tokenPath = `/ponto-externo/${token}`;
    const manifest = {
      name: "Meu Ponto",
      short_name: "Meu Ponto",
      description: "Registro de ponto eletrônico",
      scope: tokenPath,
      start_url: tokenPath,
      display: "standalone",
      orientation: "portrait",
      background_color: "#ffffff",
      theme_color: "#7c3aed",
      icons: [
        { src: "/icons/ponto-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/ponto-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/ponto-512-mask.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
    const manifestUrl = URL.createObjectURL(blob);
    const manifestLink = document.createElement("link");
    manifestLink.rel = "manifest";
    manifestLink.href = manifestUrl;
    manifestLink.setAttribute("data-ponto-pwa", "ponto-pwa-manifest");
    document.head.appendChild(manifestLink);

    // Registra SW
    let updateInterval: ReturnType<typeof setInterval> | null = null;
    const onVisibleUpdate: { fn: (() => void) | null } = { fn: null };

    navigator.serviceWorker
      .register(PONTO_SW_URL, { scope: "/ponto-externo/", updateViaCache: "none" })
      .then(async (registration) => {
        await registration.update().catch(() => undefined);

        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;

          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              worker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });

        // PWA instalado pode ficar dias aberto sem recarregar — checa
        // atualização a cada 30min e sempre que o app volta ao foco
        // (o registro só checava no carregamento inicial)
        updateInterval = setInterval(() => {
          registration.update().catch(() => undefined);
        }, 30 * 60 * 1000);

        onVisibleUpdate.fn = () => {
          if (!document.hidden) registration.update().catch(() => undefined);
        };
        document.addEventListener("visibilitychange", onVisibleUpdate.fn);
      })
      .catch((err) => console.warn("[PontoPWA] SW register falhou:", err));

    const onControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // beforeinstallprompt (Android/Chrome)
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // iOS: sem beforeinstallprompt — mostra dica
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isIOS() && !standalone) setShowIOSHint(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      if (updateInterval) clearInterval(updateInterval);
      if (onVisibleUpdate.fn) document.removeEventListener("visibilitychange", onVisibleUpdate.fn);
      nodes.forEach((n) => n.parentNode?.removeChild(n));
      manifestLink.parentNode?.removeChild(manifestLink);
      URL.revokeObjectURL(manifestUrl);
    };
  }, [token]);

  const handleInstall = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallEvent(null);
  }, [installEvent]);

  if (installed) return null;

  if (installEvent) {
    return (
      <Button
        variant="outline"
        className="w-full h-10 text-xs bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100"
        onClick={handleInstall}
      >
        <Download className="w-4 h-4 mr-2" /> Instalar Meu Ponto no celular
      </Button>
    );
  }

  if (showIOSHint) {
    return (
      <div className="w-full text-[11px] text-slate-300 bg-slate-800/60 border border-slate-700 rounded-md p-2 flex items-start gap-2">
        <Share2 className="w-4 h-4 shrink-0 mt-0.5 text-violet-300" />
        <span>
          Para instalar no iPhone: toque em <strong>Compartilhar</strong> e depois em{" "}
          <strong>Adicionar à Tela de Início</strong>.
        </span>
      </div>
    );
  }

  return null;
};

export default PontoPWASetup;
