/* Replaced with a content hash and exact asset list during production builds. */
const CACHE_PREFIX = '90day-fitness-';
const CACHE_NAME = CACHE_PREFIX + '76f28815d7789689';
const PRECACHE_URLS = ["./apple-touch-icon.png","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./index.html","./manifest.webmanifest","./src/app.js","./src/domain.js","./src/storage.js","./src/styles.css"];
const scopeURL = new URL(self.registration.scope);
const shellURL = new URL('./index.html', scopeURL).href;
const assetURLs = new Set(PRECACHE_URLS.map(path => new URL(path, scopeURL).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll([...assetURLs]);
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach(client => client.postMessage({ type: 'PWA_UPDATE_READY' }));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== scopeURL.origin || !url.pathname.startsWith(scopeURL.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      // Keep the shell and its assets on the same release until the waiting
      // worker activates. A network-first shell could reference newer assets
      // while this worker still serves the previous release's cached scripts.
      const cached = await (await caches.open(CACHE_NAME)).match(shellURL);
      if (cached) return cached;
      return fetch(request);
    })());
    return;
  }
  if (!assetURLs.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type !== 'opaque') await cache.put(request, response.clone());
    return response;
  })());
});
