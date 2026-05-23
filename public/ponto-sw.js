// Service Worker isolado para /ponto-externo/
// Prioriza rede para evitar servir builds antigas em atalhos instalados.
const CACHE_PREFIX = 'ponto';
const CACHE_VERSION = 'ponto-v2';
const HTML_CACHE = `${CACHE_VERSION}-html`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((n) => n.startsWith(CACHE_PREFIX) && ![HTML_CACHE, ASSET_CACHE].includes(n))
        .map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

const fetchWithTimeout = async (request, timeoutMs = 8000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(request, {
      signal: controller.signal,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timeout);
  }
};

const networkFirst = async (request, cacheName, fallbackResponse) => {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetchWithTimeout(request);

    if (response?.ok) {
      cache.put(request, response.clone()).catch(() => {});
    }

    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackResponse) return fallbackResponse();
    throw error;
  }
};

const offlineHtml = () =>
  new Response(
    '<html><body style="font-family:sans-serif;padding:24px;text-align:center"><h2>Sem conexão</h2><p>Tente novamente quando estiver online.</p></body></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
  );

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.hostname.endsWith('.supabase.co')) return;
  if (url.origin !== self.location.origin) return;

  const isNavigation = request.mode === 'navigate';
  const isAsset = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/');

  if (isNavigation && url.pathname.startsWith('/ponto-externo/')) {
    event.respondWith(networkFirst(request, HTML_CACHE, offlineHtml));
    return;
  }

  if (isAsset) {
    event.respondWith(networkFirst(request, ASSET_CACHE));
  }
});
