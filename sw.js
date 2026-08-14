// Offline support for Celestial Tracker. Network-first, cache-as-fallback:
// online visits always get the freshest index.html (this app ships new
// commits often) and silently re-populate the cache as they go, so there's
// no manual version bump to remember on every deploy — only bump CACHE_NAME
// if a precached file is ever renamed/removed and the old entry needs to be
// evicted, not for routine content changes.
const CACHE_NAME = 'ct12-v1';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/favicon-16.png',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // POSTs (none in this app today) and cross-origin requests (none exist —
  // everything's inlined into index.html) aren't cacheable the same way;
  // let the browser handle anything outside plain same-origin GETs as usual.
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        // offline (or the request just failed): serve whatever's cached for
        // this exact URL, or fall back to index.html for a navigation (a
        // "/some/path" deep link with no cache entry of its own should
        // still open the app shell instead of a browser error page)
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        })
      )
  );
});
