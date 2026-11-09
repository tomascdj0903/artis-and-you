// Sécurité du compte : codes TOTP (double authentification) et verrouillage biométrique de l'appareil

// ───── TOTP (RFC 6238), compatible Google Authenticator, Microsoft Authenticator, 1Password… ─────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function newSecret(len = 20) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let bits = '', out = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}
function b32decode(s) {
  const clean = s.replace(/[\s=]/g, '').toUpperCase();
  let bits = '';
  for (const c of clean) { const v = B32.indexOf(c); if (v < 0) continue; bits += v.toString(2).padStart(5, '0'); }
  const out = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return out;
}
export async function totp(secret, time = Date.now(), step = 30) {
  const counter = Math.floor(time / 1000 / step);
  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { msg[i] = c & 0xff; c = Math.floor(c / 256); }
  const key = await crypto.subtle.importKey('raw', b32decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, '0');
}
// Tolère un décalage d'horloge de ±30 s
export async function checkTotp(secret, code) {
  const c = String(code || '').replace(/\D/g, '');
  if (c.length !== 6) return false;
  for (const d of [0, -30e3, 30e3]) if ((await totp(secret, Date.now() + d)) === c) return true;
  return false;
}
export const otpauthUri = (secret, email) => `otpauth://totp/${encodeURIComponent('Artesa:' + email)}?secret=${secret}&issuer=${encodeURIComponent('Artesa')}&digits=6&period=30`;
export const groupSecret = (s) => s.replace(/(.{4})/g, '$1 ').trim();

// ───── Face ID / Touch ID / empreinte / Windows Hello (WebAuthn, sur cet appareil) ─────
const BKEY = 'ay-bio';
const UKEY = 'ay-unlocked';
const enc = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const dec = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const readBio = () => { try { return JSON.parse(localStorage.getItem(BKEY) || '{}'); } catch { return {}; } };

export async function bioAvailable() {
  try { return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { return false; }
}
export const bioEnabled = (userId) => !!(userId && readBio()[userId]);
export async function bioEnable(userId, email, name) {
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rp: { name: 'Artesa' },
    user: { id: new TextEncoder().encode(userId).slice(0, 64), name: email, displayName: name || email },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
    timeout: 60000, attestation: 'none',
  } });
  const all = readBio(); all[userId] = { id: enc(cred.rawId), at: new Date().toISOString() };
  localStorage.setItem(BKEY, JSON.stringify(all));
  markUnlocked(userId);
}
export function bioDisable(userId) { const all = readBio(); delete all[userId]; localStorage.setItem(BKEY, JSON.stringify(all)); }
export async function bioUnlock(userId) {
  const c = readBio()[userId]; if (!c) return true;
  await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: dec(c.id) }], userVerification: 'required', timeout: 60000 } });
  markUnlocked(userId);
  return true;
}
// Déverrouillé pour la durée de l'onglet ; reverrouillé après 15 min en arrière-plan
export function markUnlocked(userId) { try { sessionStorage.setItem(UKEY, JSON.stringify({ u: userId, at: Date.now() })); } catch {} }
export function isLocked(userId) {
  if (!bioEnabled(userId)) return false;
  try { const x = JSON.parse(sessionStorage.getItem(UKEY) || 'null'); return !x || x.u !== userId; } catch { return true; }
}
export function lockAfterHidden(userId, minutes = 15) {
  let hiddenAt = 0;
  const f = () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > minutes * 6e4) { try { sessionStorage.removeItem(UKEY); } catch {} window.dispatchEvent(new Event('ay-lock')); }
  };
  document.addEventListener('visibilitychange', f);
  return () => document.removeEventListener('visibilitychange', f);
}
