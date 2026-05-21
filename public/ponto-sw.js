// Service Worker isolado para /ponto-externo/
// Escopo restrito - não intercepta outras rotas do app.
const CACHE_VERSION = 'ponto-v1';
const SHELL_URL = '/ponto-externo/';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((n) => n.startsWith('ponto-') && n !== CACHE_VERSION)
        .map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

const networkFirstHTML = async (request) => {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeout);
    if (response && response.ok) {
      cache.put(SHELL_URL, response.clone()).catch(() => {});
    }
    return response;
  } catch (e) {
    const cached = await cache.match(SHELL_URL);
    if (cached) return cached;
    return new Response(
      '<html><body style="font-family:sans-serif;padding:24px;text-align:center"><h2>Sem conexão</h2><p>Tente novamente quando estiver online.</p></body></html>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
    );
  }
};

const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => cached);
  return cached || fetchPromise;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Não intercepta Supabase (API/Storage/Auth)
  if (url.hostname.endsWith('.supabase.co')) return;

  // Apenas mesma origem
  if (url.origin !== self.location.origin) return;

  // Só atua dentro do escopo /ponto-externo/ ou em assets que a tela precisa
  const isNavigation = request.mode === 'navigate';
  const isAsset = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/');

  if (isNavigation && url.pathname.startsWith('/ponto-externo/')) {
    event.respondWith(networkFirstHTML(request));
    return;
  }

  if (isAsset) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
