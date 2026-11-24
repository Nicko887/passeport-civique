// Service worker : l'application fonctionne hors ligne après la première visite.
// Incrémentez VERSION à chaque publication pour mettre à jour les fichiers en cache.
const VERSION = 'passeport-civique-v31';

const FICHIERS = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/config.js',
  'js/store.js',
  'js/data.js',
  'js/markdown.js',
  'js/audio.js',
  'js/icones.js',
  'manifest.webmanifest',
  'icones/icone.svg',
  'icones/icone-192.png',
  'data/naturalisation.json',
  'data/resident.json',
  'data/csp.json',
  'contenu/cours/principes.md',
  'contenu/cours/institutions.md',
  'contenu/cours/droits.md',
  'contenu/cours/histoire.md',
  'contenu/cours/societe.md',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(VERSION).then((c) => Promise.all(FICHIERS.map((f) => c.add(f).catch(() => {})))),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

// Réseau d'abord (contenu toujours à jour), cache en secours hors ligne.
self.addEventListener('fetch', (ev) => {
  if (ev.request.method !== 'GET' || new URL(ev.request.url).origin !== location.origin) return;
  ev.respondWith(
    fetch(ev.request)
      .then((rep) => {
        const copie = rep.clone();
        caches.open(VERSION).then((c) => c.put(ev.request, copie));
        return rep;
      })
      .catch(() => caches.match(ev.request, { ignoreSearch: true })),
  );
});
