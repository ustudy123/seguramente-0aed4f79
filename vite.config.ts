import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query", "react/jsx-runtime"],
    force: true,
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
  define: {
    "import.meta.env.VITE_APP_BUILD_TIME": JSON.stringify(new Date().toISOString()),
    // Versão base vem do package.json (fonte única da verdade).
    // Builds fora de produção ganham sufixo de pré-lançamento (SemVer),
    // ex.: 1.0.0-homolog.20260817 — mesma base, origem inconfundível.
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(
      (() => {
        const base = process.env.npm_package_version || "1.0.0";
        if (mode === "production") return base;
        const carimbo = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        return `${base}-${mode === "staging" ? "homolog" : mode}.${carimbo}`;
      })(),
    ),
  },
}));
