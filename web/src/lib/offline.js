// Hors ligne (chantier sans réseau) :
//  - cache de lecture : la dernière réponse de chaque lecture est gardée dans IndexedDB et resservie quand le réseau manque ;
//  - file d'attente : les messages écrits hors ligne sont enregistrés puis envoyés au retour du réseau, dans l'ordre.
// Le cache est propre à l'utilisateur connecté (vidé à la déconnexion) et ne contient que ce que l'utilisateur a déjà vu.
const DB = 'artesa-offline', VER = 1;
let dbp = null;
const open = () => {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    try {
      const r = indexedDB.open(DB, VER);
      r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('reads')) d.createObjectStore('reads'); if (!d.objectStoreNames.contains('queue')) d.createObjectStore('queue', { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null);
    } catch { res(null); }
  });
  return dbp;
};
const tx = async (store, mode, fn) => {
  const d = await open(); if (!d) return undefined;
  return new Promise((res) => {
    try {
      const t = d.transaction(store, mode); const s = t.objectStore(store); const q = fn(s);
      t.oncomplete = () => res(q?.result); t.onerror = () => res(undefined); t.onabort = () => res(undefined);
    } catch { res(undefined); }
  });
};

// ─────────────── État réseau ───────────────
const subs = new Set();
let offline = typeof navigator !== 'undefined' && navigator.onLine === false;
export const isOffline = () => offline;
export const onNetwork = (fn) => { subs.add(fn); return () => subs.delete(fn); };
const set = (v) => { if (offline === v) return; offline = v; subs.forEach((f) => { try { f(offline); } catch { /* ignore */ } }); if (!v) flush(); };
if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => set(true));
  window.addEventListener('online', () => set(false));
}
// Appelé par la couche API : une requête qui échoue faute de réseau nous passe hors ligne, une qui réussit nous remet en ligne
export const noteFailure = () => set(true);
export const noteSuccess = () => { if (offline && navigator.onLine !== false) set(false); };
export const isNetworkError = (e) => /Connexion internet indisponible|Failed to fetch|NetworkError|Load failed/i.test(e?.message || '');

// ─────────────── Cache de lecture ───────────────
let scope = '';
export const setScope = (uid) => { const n = uid || ''; if (n !== scope) { scope = n; } };
export const cacheGet = async (key) => tx('reads', 'readonly', (s) => s.get(scope + '|' + key));
export const cachePut = (key, data) => { tx('reads', 'readwrite', (s) => s.put({ data, at: Date.now() }, scope + '|' + key)); };
export const cacheClear = () => tx('reads', 'readwrite', (s) => s.clear());

// ─────────────── File d'attente d'écritures ───────────────
let sender = null; // (item) => Promise, fourni par la couche API
export const setSender = (fn) => { sender = fn; };
export const enqueue = async (item) => { const it = { id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), at: new Date().toISOString(), ...item }; await tx('queue', 'readwrite', (s) => s.put(it)); subs.forEach((f) => { try { f(offline); } catch { /* ignore */ } }); return it; };
export const queued = async (filter) => { const all = (await tx('queue', 'readonly', (s) => s.getAll())) || []; return filter ? all.filter(filter) : all; };
let flushing = false;
export async function flush() {
  if (flushing || !sender) return 0;
  flushing = true; let n = 0;
  try {
    const items = ((await tx('queue', 'readonly', (s) => s.getAll())) || []).sort((a, b) => a.at.localeCompare(b.at));
    for (const it of items) {
      try { await sender(it); await tx('queue', 'readwrite', (s) => s.delete(it.id)); n++; }
      catch (e) { if (isNetworkError(e)) break; await tx('queue', 'readwrite', (s) => s.delete(it.id)); /* refusé par le serveur : on abandonne cet envoi */ }
    }
  } finally { flushing = false; }
  if (n) subs.forEach((f) => { try { f(offline, { flushed: n }); } catch { /* ignore */ } });
  return n;
}
