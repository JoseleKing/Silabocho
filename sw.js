// Service worker de Silabocho: guarda el juego en el dispositivo para que funcione sin conexión.
// Al cambiar cualquier archivo del juego, sube VERSION para que los móviles reciban la nueva versión.
const VERSION = 'silabocho-v10';
const ARCHIVOS = [
  './', 'index.html', 'css/estilo.css', 'js/juego.js', 'data/tableros.json', 'manifest.webmanifest',
  'fonts/bricolage.woff2', 'fonts/atkinson-400.woff2', 'fonts/atkinson-700.woff2',
  'icons/favicon.svg', 'icons/favicon.ico', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/icon-maskable-192.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// La página y los tableros: primero la red (para recibir novedades) y, sin conexión, lo guardado.
// El resto (estilos, código, fuentes, iconos): primero lo guardado.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const red = req.mode === 'navigate' || req.url.endsWith('/data/tableros.json');
  if (red) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(VERSION).then(c => c.put(req, copia)); }
      return res;
    }).catch(() => caches.match(req, {ignoreSearch: true}).then(r => r || caches.match('index.html'))));
  } else {
    e.respondWith(caches.match(req).then(r => r || fetch(req)));
  }
});
