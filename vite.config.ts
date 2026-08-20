import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/** Projeto Supabase de PRODUÇÃO. Nenhum outro ambiente pode apontar para ele. */
const PROJETO_PRODUCAO = "diayjpsrcerycycyaxst";

/**
 * Trava de ambiente.
 *
 * O acidente que ela impede é específico e caro: um build de teste ou de
 * homologação apontando para o banco de produção. Não é hipótese — o
 * .env.staging traz o aviso escrito ("NUNCA aponte para a URL de produção:
 * os links de convite e redefinição de senha gerados no staging levariam o
 * usuário para o app real"), e aviso em comentário só protege quem lê.
 *
 * Com três ambientes o risco cresce: são três arquivos parecidos, e copiar
 * um para começar o outro é o caminho natural. Aqui o build simplesmente
 * não nasce.
 */
function exigirAmbienteCoerente(mode: string, env: Record<string, string>) {
  if (mode === "production" || mode === "development") return;

  const url = env.VITE_SUPABASE_URL ?? "";
  if (url.includes(PROJETO_PRODUCAO)) {
    throw new Error(
      `[ambiente] O build "${mode}" está apontando para o Supabase de PRODUÇÃO ` +
        `(${PROJETO_PRODUCAO}). Corrija VITE_SUPABASE_URL em .env.${mode} antes de continuar. ` +
        `Publicar um ambiente de teste sobre o banco real é o acidente que esta trava existe para impedir.`,
    );
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  exigirAmbienteCoerente(mode, loadEnv(mode, process.cwd(), ""));
  return {
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
    // ex.: 1.0.0-teste.20260817 — mesma base, origem inconfundível.
    //
    // O modo `staging` carimbava "homolog", de quando havia dois ambientes e
    // os nomes eram intercambiáveis. Com a homologação existindo de verdade,
    // o rótulo passou a apontar para o ambiente errado: quem lesse
    // "1.0.0-homolog" num relatório de bug estaria olhando o de TESTE.
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(
      (() => {
        const base = process.env.npm_package_version || "1.0.0";
        if (mode === "production") return base;
        const carimbo = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const rotulo =
          mode === "staging" ? "teste" : mode === "homologacao" ? "homolog" : mode;
        return `${base}-${rotulo}.${carimbo}`;
      })(),
    ),
    },
  };
});
