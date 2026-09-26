/* Offline shell. Bump CACHE when any file below changes. */
const CACHE = 'angle-lab-v4';

/* Without these the app does not run: if one is missing the install must fail loudly. */
const CORE = [
  './',
  'index.html',
  'src/ui/app.js',
  'src/ui/pointerGestures.js',
  'src/core/geometry.js',
  'src/core/calibration.js',
  'src/core/hittest.js',
  'src/core/viewport.js',
  'src/core/units.js',
  'src/core/uncertainty.js',
  'src/core/measurements.js',
  'src/core/model.js',
  'src/core/guides.js',
  'src/render/canvasRenderer.js',
  'src/render/imageLoader.js',
  'src/storage/db.js',
  'src/export/catalogRef.js',
  'src/export/csvExport.js',
  'src/export/guides.js',
  'src/styles/tokens.css',
  'src/styles/app.css',
];
/* Cosmetic. A missing icon must never cost the offline cache — same bug
   dryland-test-logger had from 2026-08-07 to 2026-08-21: addAll rejects on
   a single 404 and the install never completes. */
const EXTRAS = ['manifest.webmanifest', 'icon.svg', 'icon-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE).then(() => Promise.all(EXTRAS.map((u) => c.add(u).catch(() => {})))))
      .then(() => self.skipWaiting())
  );
});

/* Only delete OUR OWN old cache generations — dryland-test-logger shares
   this origin (tmnfhm7cnh-lang.github.io) and has its own cache name; see
   its sw.js for the matching half of this fix (LOTE 3 audit). */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('angle-lab-') && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('index.html')))
  );
});
