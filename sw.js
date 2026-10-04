// Offline-Betrieb: die App-Dateien kommen aus dem Cache und werden im
// Hintergrund aktualisiert. Anfragen an GitHub laufen nie über den Cache.
const CACHE = 'tagesberichte-v56';
const SHELL = [
  './',
  'index.html',
  'app.css',
  'app.js',
  'db.js',
  'media.js',
  'report.js',
  'sync.js',
  'pdf.js',
  'stunden.js',
  'i18n.js',
  'translate.js',
  'markup.js',
  'plaene.js',
  'fotoaufmass.js',
  'handbuch.js',
  'handbuch.md',
  'vendor/jspdf.umd.min.js',
  'vendor/pdf.min.js',
  'vendor/pdf.worker.min.js',
  'icons/logo-mt.jpg',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' umgeht den Browser-Cache, damit wirklich die neuen Dateien geladen werden
  event.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // Videos und PDFs (Anleitung) direkt vom Netz laden, nicht durch die App ersetzen
  if (req.headers.has('range') || /\.(mp4|pdf)$/i.test(url.pathname)) return;

  const key = req.mode === 'navigate' ? 'index.html' : req;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(key, { ignoreSearch: true });
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(key, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    }),
  );
});
