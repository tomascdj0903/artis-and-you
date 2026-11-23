// Service worker : application installable, ouverture hors ligne (dernières données consultées) et notifications push.
const SHELL = 'ay-shell-v6';
const DATA = 'ay-data-v1';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/assets/app.js', '/assets/app.css', '/logo.svg', '/icon-192.png?v=7']).catch(() => {}))); self.skipWaiting(); });
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => ![SHELL, DATA].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim())));

// Réseau d'abord ; en cas d'échec (hors ligne), dernière version gardée en cache
const netFirst = async (req, cache, key) => {
  try { const r = await fetch(req); if (r.ok) (await caches.open(cache)).put(key || req, r.clone()); return r; }
  catch { const c = await caches.match(key || req); if (c) return c; throw new Error('offline'); }
};
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) {
    if (req.mode === 'navigate') return e.respondWith(netFirst(req, SHELL, '/'));
    if (u.pathname.startsWith('/assets/') || /\.(svg|png|webmanifest)$/.test(u.pathname)) return e.respondWith(netFirst(req, SHELL));
    return;
  }
  if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) return e.respondWith(netFirst(req, SHELL));
  // Données Supabase en lecture (pas d'authentification, de fichiers ni de temps réel)
  if (/\.supabase\.co$/.test(u.hostname) && u.pathname.startsWith('/rest/v1/')) return e.respondWith(netFirst(req, DATA));
});
// Déconnexion : on efface les données gardées hors ligne
self.addEventListener('message', (e) => { if (e.data === 'ay-clear-data') caches.delete(DATA); });

self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data.json(); } catch { d = { title: 'Artis & You', body: e.data?.text() || '' }; }
  const urgent = !!d.urgent;
  e.waitUntil(self.registration.showNotification(d.title || 'Artis & You', { body: d.body || '', icon: '/icon-192.png', badge: '/icon-192.png', tag: d.tag, data: { link: d.link || '/' },
    ...(urgent ? { requireInteraction: true, renotify: true, vibrate: [300, 120, 300, 120, 600] } : {}),
    // Demande urgente d'un RDV : boutons directement sur la notification
    ...(urgent && /^\/pro\/planning\/rdv\//.test(d.link || '') ? { actions: [{ action: 'accepter', title: 'Accepter' }, { action: 'voir', title: 'Voir' }] } : {}) }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  let link = e.notification.data?.link || '/';
  if (e.action === 'accepter') link += (link.includes('?') ? '&' : '?') + 'action=accepter';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => new URL(x.url).origin === self.location.origin);
    if (c) { c.focus(); return c.navigate(link).catch(() => {}); }
    return self.clients.openWindow(link);
  }));
});
