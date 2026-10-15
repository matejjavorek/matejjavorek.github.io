// Offline cache pre appku. Pri zmene súborov zvýš verziu.
const CACHE = 'jedlo-v22';
const ASSETS = ['./', 'index.html', 'style.css?v=22', 'app.js?v=22', 'meniny.js?v=22', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'kucharka.bin'];

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

// Sieť najprv (nová verzia hneď), ale pri slabom signáli po 3 s ukáž uloženú verziu.
// Chybové odpovede sa neukladajú. API volania (iná doména) neriešime.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const cached = () => caches.match(e.request).then(r => r || caches.match(e.request, { ignoreSearch: true }));
  const net = fetch(e.request, { cache: 'no-cache' }).then(res => {
    if (!res.ok) return cached().then(c => c || res);
    const copy = res.clone();
    e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, copy)));
    return res;
  });
  const slow = new Promise(resolve => setTimeout(resolve, 3000)).then(cached);
  e.respondWith(
    Promise.race([net, slow.then(c => c || net)])
      .catch(() => cached().then(c => c || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
