// Raumaufmaß (eigene Test-App): Dateien offline aus dem Cache, im Hintergrund aktualisieren.
const CACHE = 'raumaufmass-v7';
const SHELL = [
  './',
  'index.html',
  'app.css',
  'ra-app.js',
  'raumaufmass.js',
  'raumgeometrie.js',
  'ansicht3d.js',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  '../vendor/jspdf.umd.min.js',
  '../vendor/pdf.min.js',
  '../vendor/pdf.worker.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('raumaufmass-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => {
    const netz = fetch(req).then((res) => {
      if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
      return res;
    }).catch(() => hit);
    return hit || netz;
  }));
});
