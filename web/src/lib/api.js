// Couche de données : Supabase (production) ou base locale (tests hors-ligne).
import { mockBackend } from './mock.js';

const ENV = typeof __ENV__ !== 'undefined' ? __ENV__ : {};
const URL_ = (ENV.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = ENV.SUPABASE_KEY || '';
export const OFFLINE = !URL_ || !KEY || new URLSearchParams(location.search).has('local');
export const APP_VERSION = ENV.APP_VERSION || '1.0.0';
export const GITHUB_REPO = ENV.GITHUB_REPO || '';

// ─────────────── Session ───────────────
const SKEY = 'ay-session';
let session = null;
const listeners = new Set();
function loadSession() {
  try { session = JSON.parse(localStorage.getItem(SKEY) || sessionStorage.getItem(SKEY) || 'null'); } catch { session = null; }
}
function saveSession(s, remember = true) {
  session = s;
  try {
    localStorage.removeItem(SKEY); sessionStorage.removeItem(SKEY);
    if (s) (remember ? localStorage : sessionStorage).setItem(SKEY, JSON.stringify(s));
  } catch {}
  listeners.forEach((fn) => fn(s));
}
loadSession();
export const onAuth = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getSession = () => session;
export const uid = () => session?.user?.id || null;

class ApiError extends Error {}
const frMsg = (m = '') => {
  const s = String(m);
  if (/Invalid login credentials/i.test(s)) return 'E-mail ou mot de passe incorrect.';
  if (/Email not confirmed/i.test(s)) return 'Confirmez votre adresse e-mail (lien reçu par e-mail) avant de vous connecter.';
  if (/already registered|already been registered/i.test(s)) return 'Un compte existe déjà avec cet e-mail.';
  if (/Password should be at least/i.test(s)) return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (/rate limit/i.test(s)) return 'Trop de tentatives, réessayez dans quelques minutes.';
  if (/JWT expired/i.test(s)) return 'Session expirée, reconnectez-vous.';
  if (/Failed to fetch|NetworkError/i.test(s)) return 'Connexion internet indisponible.';
  return s;
};

async function http(path, { method = 'GET', body, headers = {}, auth = true, raw = false } = {}) {
  const h = { apikey: KEY, ...headers };
  if (body !== undefined && !(body instanceof Blob) && !(body instanceof FormData)) h['Content-Type'] = 'application/json';
  if (auth && session?.access_token) h.Authorization = 'Bearer ' + session.access_token;
  else h.Authorization = 'Bearer ' + KEY;
  let res;
  try {
    res = await fetch(URL_ + path, { method, headers: h, body: body === undefined ? undefined : (body instanceof Blob || body instanceof FormData ? body : JSON.stringify(body)) });
  } catch (e) { throw new ApiError(frMsg(e.message)); }
  if (res.status === 401 && auth && session?.refresh_token && !path.includes('grant_type=refresh_token')) {
    const ok = await refresh();
    if (ok) return http(path, { method, body, headers, auth, raw });
  }
  if (raw) return res;
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) throw new ApiError(frMsg(data?.msg || data?.message || data?.error_description || data?.error || res.statusText));
  return data;
}

let refreshing = null;
async function refresh() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const d = await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token }, auth: false });
      saveSession({ ...d, expires_at: Date.now() / 1000 + d.expires_in }, !!localStorage.getItem(SKEY));
      return true;
    } catch { saveSession(null); return false; } finally { refreshing = null; }
  })();
  return refreshing;
}

// ─────────────── Requêtes PostgREST ───────────────
// filters : { col: val, col: [a,b], 'col>=': v, 'col<': v, 'col!=': v, 'col~': 'texte' (ilike), col: null }
function qs(filters = {}, { order, limit, columns } = {}) {
  const p = new URLSearchParams();
  p.set('select', columns || '*');
  for (const [k0, v] of Object.entries(filters)) {
    if (v === undefined) continue;
    const m = k0.match(/^(.*?)(>=|<=|>|<|!=|~)?$/);
    const k = m[1], op = m[2];
    let val;
    if (op === '>=') val = 'gte.' + v; else if (op === '<=') val = 'lte.' + v; else if (op === '>') val = 'gt.' + v;
    else if (op === '<') val = 'lt.' + v; else if (op === '!=') val = v === null ? 'not.is.null' : 'neq.' + v;
    else if (op === '~') val = 'ilike.*' + v + '*';
    else if (v === null) val = 'is.null';
    else if (Array.isArray(v)) val = 'in.(' + v.map((x) => '"' + x + '"').join(',') + ')';
    else if (typeof v === 'boolean') val = 'is.' + v;
    else val = 'eq.' + v;
    p.append(k, val);
  }
  if (order) p.set('order', order);
  if (limit) p.set('limit', limit);
  return p.toString();
}

const remote = {
  async select(table, filters, opts) { return http(`/rest/v1/${table}?${qs(filters, opts)}`); },
  async one(table, filters) { const r = await remote.select(table, filters, { limit: 1 }); return r[0] || null; },
  async insert(table, row) {
    const r = await http(`/rest/v1/${table}`, { method: 'POST', body: row, headers: { Prefer: 'return=representation' } });
    return Array.isArray(row) ? r : r[0];
  },
  async upsert(table, row) {
    const r = await http(`/rest/v1/${table}`, { method: 'POST', body: row, headers: { Prefer: 'return=representation,resolution=merge-duplicates' } });
    return r[0];
  },
  async update(table, filters, patch) {
    const r = await http(`/rest/v1/${table}?${qs(filters)}`, { method: 'PATCH', body: patch, headers: { Prefer: 'return=representation' } });
    return r[0];
  },
  async remove(table, filters) { await http(`/rest/v1/${table}?${qs(filters)}`, { method: 'DELETE' }); },
  async rpc(name, args = {}) { return http(`/rest/v1/rpc/${name}`, { method: 'POST', body: args }); },

  // Fichiers
  async upload(path, file) {
    await http(`/storage/v1/object/files/${encodeURI(path)}`, { method: 'POST', body: file, headers: { 'x-upsert': 'true', 'Content-Type': file.type || 'application/octet-stream' } });
    return path;
  },
  async signedUrls(paths) {
    if (!paths.length) return {};
    const r = await http('/storage/v1/object/sign/files', { method: 'POST', body: { expiresIn: 3600, paths } });
    const out = {};
    (r || []).forEach((x) => { if (x.signedURL) out[x.path] = URL_ + '/storage/v1' + x.signedURL; });
    return out;
  },
  async removeFile(path) { await http('/storage/v1/object/files', { method: 'DELETE', body: { prefixes: [path] } }); },

  // Authentification
  async signUp(email, password, data) {
    const d = await http('/auth/v1/signup', { method: 'POST', body: { email, password, data }, auth: false });
    if (d.access_token) saveSession({ ...d, expires_at: Date.now() / 1000 + d.expires_in });
    return { needsConfirm: !d.access_token };
  },
  async signIn(email, password, remember = true) {
    const d = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, auth: false });
    saveSession({ ...d, expires_at: Date.now() / 1000 + d.expires_in }, remember);
  },
  async signOut() { try { await http('/auth/v1/logout', { method: 'POST' }); } catch {} saveSession(null); },
  async recover(email) { await http('/auth/v1/recover?redirect_to=' + encodeURIComponent(location.origin + '/nouveau-mot-de-passe'), { method: 'POST', body: { email }, auth: false }); },
  async updatePassword(password) { await http('/auth/v1/user', { method: 'PUT', body: { password } }); },
  async updateEmail(email) { await http('/auth/v1/user', { method: 'PUT', body: { email } }); },
};

// Retour d'un lien e-mail (confirmation ou mot de passe oublié)
if (!OFFLINE && location.hash.includes('access_token=')) {
  const h = new URLSearchParams(location.hash.slice(1));
  saveSession({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: +h.get('expires_in'), user: null, recovery: h.get('type') === 'recovery' });
  history.replaceState(null, '', location.pathname);
  http('/auth/v1/user').then((u) => saveSession({ ...session, user: u })).catch(() => {});
}

export const api = OFFLINE ? mockBackend({ saveSession, getSession: () => session }) : remote;

// ─────────────── URLs de fichiers (cache) ───────────────
const urlCache = new Map();
export async function fileUrls(paths) {
  const need = [...new Set(paths.filter((p) => p && !urlCache.has(p)))];
  if (need.length) {
    const r = await api.signedUrls(need);
    need.forEach((p) => urlCache.set(p, r[p] || null));
  }
  const out = {};
  paths.forEach((p) => { out[p] = urlCache.get(p); });
  return out;
}
export const cachedUrl = (p) => urlCache.get(p);
