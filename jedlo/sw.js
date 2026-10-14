// Offline cache pre appku. Pri zmene súborov zvýš verziu.
const CACHE = 'jedlo-v16';
const ASSETS = ['./', 'index.html', 'style.css?v=16', 'app.js?v=16', 'meniny.js?v=16', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'kucharka.bin'];

self.addEventListener('install', e => {
  // cache: 'reload', aby sa nevzala staršia kópia z HTTP cache prehliadača
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Sieť najprv (nová verzia hneď), cache ako záloha offline. Chybové odpovede sa neukladajú.
// API volania (iná doména) neriešime.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const cached = () => caches.match(e.request).then(r => r || caches.match(e.request, { ignoreSearch: true }));
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        if (!res.ok) return cached().then(c => c || res);
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => cached().then(c => c || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
