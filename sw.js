// Offline support: the app shell is cached; Meta AI calls always go to the network.
const VERSION = 'chairwise-hack-1';
const SHELL = [
  './', './index.html', './css/app.css', './manifest.webmanifest', './sample-receipt.jpg',
  './js/main.js', './js/ui.js', './js/state.js', './js/store.js', './js/categories.js', './js/ai.js',
  './js/recorder.js', './js/fallback.js', './js/export.js', './js/sample.js',
  './js/views/home.js', './js/views/ledger.js', './js/views/receipts.js', './js/views/taxes.js',
  './js/views/capture.js', './js/views/editor.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  // Network first for our own files so updates arrive; cache as the offline fallback.
  if (url.origin === location.origin) {
    event.respondWith(
      fetch(request)
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(request, copy)); } return res; })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }
  // Fonts: cache first.
  event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(request, copy)); return res; })));
});
