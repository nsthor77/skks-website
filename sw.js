/* PanyaSchoolKit service worker — installable + offline fallback.
   NETWORK-FIRST for everything (always fresh when online; cache is only an
   offline fallback) so a new deploy never gets stuck behind a stale cache.
   - Never touches cross-origin (Supabase/CDN) or /api/ requests. */
const CACHE = 'pk-shell-v1';

self.addEventListener('install', (e) => { self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;   // leave Supabase/CDN alone
  if (url.pathname.startsWith('/api/')) return;        // never cache API

  const cacheable = req.mode === 'navigate'
    || /\.(css|js|png|jpg|jpeg|svg|webp|gif|woff2?|ico)$/i.test(url.pathname);

  e.respondWith((async () => {
    try {
      const net = await fetch(req);
      if (net && net.ok && cacheable) {
        const c = await caches.open(CACHE);
        c.put(req, net.clone());
      }
      return net;
    } catch (_) {
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === 'navigate') return (await caches.match('/login.html')) || Response.error();
      return Response.error();
    }
  })());
});
