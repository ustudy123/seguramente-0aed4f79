# PWA isolado em /ponto-externo/ — "Meu Ponto"

## Objetivo
Permitir que o colaborador instale a página de registro de ponto como um app no celular ("Meu Ponto"), **sem afetar o restante do sistema** (painel admin, demais rotas, preview do Lovable).

## Princípio do isolamento
A combinação que garante o escopo restrito:
1. `scope` e `start_url` do manifest apontam para `/ponto-externo/`.
2. `<link rel="manifest">` é injetado **apenas** quando a rota `/ponto-externo/:token` está montada.
3. Service Worker registrado com `scope: "/ponto-externo/"` e **somente** dentro dessa rota.

Fora desse caminho o navegador não enxerga manifest nem SW — zero risco de capturar o admin.

## Arquivos a criar

### `public/ponto-manifest.webmanifest`
```json
{
  "name": "Meu Ponto",
  "short_name": "Meu Ponto",
  "description": "Registro de ponto eletrônico",
  "scope": "/ponto-externo/",
  "start_url": "/ponto-externo/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#7c3aed",
  "icons": [
    { "src": "/icons/ponto-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/ponto-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/ponto-512-mask.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```
Quando instalado a partir de `/ponto-externo/ABC123`, iOS/Android congelam essa URL como ponto de entrada — cada colaborador fica com o próprio ícone apontando para seu token. Comportamento desejado.

### `public/icons/ponto-192.png`, `ponto-512.png`, `ponto-512-mask.png`
Gerados com identidade visual de relógio/ponto (roxo `#7c3aed`).

### `public/ponto-sw.js`
SW enxuto, escrito à mão (sem `vite-plugin-pwa`):
- `install` → `skipWaiting`
- `activate` → `clients.claim` + limpa caches antigos
- `fetch`:
  - HTML navegação → **NetworkFirst** (timeout 3s, fallback ao shell)
  - `/assets/*` (JS/CSS hash do Vite) → **StaleWhileRevalidate**
  - `*.supabase.co` → **NetworkOnly**
- Cache versionado (`ponto-v1`) — invalida a cada deploy.
- Não usa `selfDestroying`.

### `src/components/ponto/PontoPWASetup.tsx`
Componente montado dentro de `PontoExterno.tsx`. Em `useEffect`:
1. **Guardas obrigatórios** — aborta se:
   - `window.self !== window.top` (iframe)
   - hostname contém `id-preview--` ou `lovableproject.com`
   - `navigator.serviceWorker` indisponível
2. Injeta no `<head>` (e remove no unmount):
   - `<link rel="manifest" href="/ponto-manifest.webmanifest">`
   - `<meta name="theme-color" content="#7c3aed">`
   - `<meta name="apple-mobile-web-app-capable" content="yes">`
   - `<meta name="apple-mobile-web-app-title" content="Meu Ponto">`
   - `<link rel="apple-touch-icon" href="/icons/ponto-192.png">`
3. Registra `navigator.serviceWorker.register('/ponto-sw.js', { scope: '/ponto-externo/' })`.
4. Captura `beforeinstallprompt`, guarda em estado, expõe botão "Instalar app" (Android/Chrome).
5. iOS: exibe instrução discreta "Compartilhar → Adicionar à Tela de Início" (Safari não dispara `beforeinstallprompt`).

## Arquivos a editar
- `src/pages/PontoExterno.tsx` — montar `<PontoPWASetup />` no topo do componente.
- `src/main.tsx` — confirmar que **não** há registro global de SW (auditado: nenhum registro existente, sem alteração necessária).

Sem alterações em `vite.config.ts` ou `index.html` (manifest não pode ser global).

## Limites e avisos
- Prompt de instalação **não aparece no preview do Lovable** (bloqueado pelas guardas). Só funciona em produção (`seguramente.lovable.app` e domínios próprios `youreyes.com.br`).
- iOS Safari nunca dispara `beforeinstallprompt` — instrução manual exibida.
- Cada link instala um ícone separado (start_url congelado na instalação).
- Offline real do registro **não é viável** (requer Supabase online). O cache garante carregamento da tela offline + mensagem "Sem conexão". Fila offline via IndexedDB fica para iteração futura.

## Fora do escopo
- Fila offline de marcações (IndexedDB + sync).
- PWA em outras rotas.
- Push notifications.
