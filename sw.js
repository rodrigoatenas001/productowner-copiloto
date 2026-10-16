// Service worker: guarda la aplicación para usarla sin conexión.
// Al publicar una versión nueva, cambia VERSION para que los navegadores la actualicen.
const VERSION = 'copiloto-v11';
const ARCHIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/almacen.js',
  './js/ia.js',
  './js/nucleo/historias.js',
  './js/nucleo/proyecto.js',
  './js/nucleo/exportar.js',
  './js/nucleo/importar.js',
  './js/nucleo/estimacion.js',
  './js/ui/estimar.js',
  './js/nucleo/preguntas.js',
  './js/nucleo/trivia.js',
  './js/nucleo/ejercicios.js',
  './js/ui/trivia.js',
  './js/ui/taller.js',
  './js/nucleo/retro.js',
  './js/ui/retro.js',
  './js/nucleo/definiciones.js',
  './js/nucleo/reportes.js',
  './js/ui/compartir.js',
  './js/nucleo/dosvoces.js',
  './js/nucleo/priorizacion.js',
  './js/ui/priorizar.js',
  './js/nucleo/casosborde.js',
  './js/nucleo/okr.js',
  './js/ui/okr.js',
  './js/nucleo/objetivo.js',
  './js/nucleo/issues.js',
  './js/ui/dom.js',
  './js/ui/historia.js',
  './js/ui/notas.js',
  './js/ui/backlog.js',
  './js/ui/sprint.js',
  './js/ui/ajustes.js',
  './icons/icono.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Solo archivos propios: primero la caché, y se actualiza en segundo plano.
// Las llamadas a servicios de IA (otros orígenes) no pasan por aquí.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const guardada = await cache.match(e.request, { ignoreSearch: true });
    const red = fetch(e.request).then((r) => {
      if (r.ok) cache.put(e.request, r.clone());
      return r;
    }).catch(() => guardada);
    return guardada || red;
  }));
});
