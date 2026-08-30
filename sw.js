// ============================================================
// CMK — Service Worker
// Met en cache l'application (coquille) pour un fonctionnement
// hors-ligne. Les données (produits, ventes...) restent gérées
// par l'application elle-même via localStorage + Firebase.
// ============================================================
const CACHE_NAME = 'cmk-app-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png'
];

// ---- Installation : met en cache la coquille de l'application ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ---- Activation : nettoie les anciens caches ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ---- Stratégie réseau ----
// - Requêtes vers Firebase (données/API) : toujours le réseau, jamais le cache.
// - Reste de l'application (HTML/CSS/JS/icônes/polices) : cache d'abord,
//   puis réseau (et mise à jour du cache en arrière-plan).
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  // Ne jamais mettre en cache les appels Firebase (données live)
  if (url.hostname.includes('firebaseio.com') || url.hostname.includes('googleapis.com')) {
    return; // laisse le navigateur gérer normalement (réseau direct)
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // hors-ligne : retombe sur le cache si le réseau échoue

      return cached || network;
    })
  );
});

// ---- Notifications (utilisées par l'app pour les alertes de stock bas) ----
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      if (clientList.length > 0) return clientList[0].focus();
      return self.clients.openWindow('/');
    })
  );
});
