// Service worker minimal : rend l'application installable (Android, ordinateur) sans mettre de données en cache.
// Toutes les requêtes passent par le réseau : l'application reste toujours à jour.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
