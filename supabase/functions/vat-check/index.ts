// Vérifie un numéro de TVA intracommunautaire auprès de VIES (Commission européenne, service gratuit, sans clé).
// VIES n'accepte pas les appels directs depuis un navigateur : cette fonction sert d'intermédiaire.
// Garde-fous : utilisateur connecté, format contrôlé avant l'appel, 60 vérifications par heure et par utilisateur (en mémoire).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const ALLOWED = /^https:\/\/(artis-and-you(-[a-z0-9-]+)?|artesa-pro)\.vercel\.app$|^http:\/\/localhost(:\d+)?$/;
const cors = (req: Request) => {
  const o = req.headers.get('origin') || '';
  return { 'Access-Control-Allow-Origin': ALLOWED.test(o) ? o : 'https://artis-and-you.vercel.app', Vary: 'Origin', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
};
const COUNTRIES = new Set(['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'XI']);
const HOURLY = 60;
const hits = new Map<string, number[]>();
const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();

Deno.serve(async (req) => {
  const CORS = cors(req);
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const user = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('authorization') || '' } } });
  const { data: u } = await user.auth.getUser();
  if (!u?.user) return json({ error: 'auth' }, 401);

  const now = Date.now();
  const list = (hits.get(u.user.id) || []).filter((t) => now - t < 3600_000);
  if (list.length >= HOURLY) return json({ error: 'rate' }, 429);
  list.push(now); hits.set(u.user.id, list);

  const body = await req.json().catch(() => ({}));
  const vat = String(body.vat || '').toUpperCase().replace(/[^A-Z0-9+*]/g, '');
  const cc = vat.slice(0, 2), num = vat.slice(2);
  if (!COUNTRIES.has(cc) || num.length < 2 || num.length > 12) return json({ error: 'invalid' }, 400);

  try {
    const r = await fetch(`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${cc}/vat/${encodeURIComponent(num)}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    const j = await r.json().catch(() => null);
    if (!j) return json({ error: 'unavailable' }, 502);
    // userError : VALID / INVALID / MS_UNAVAILABLE / TIMEOUT / SERVICE_UNAVAILABLE…
    if (j.userError && !['VALID', 'INVALID'].includes(j.userError)) return json({ error: 'unavailable', detail: j.userError }, 502);
    const name = clean(j.name); const address = clean(j.address);
    return json({ valid: !!j.isValid, name: name === '---' ? '' : name, address: address === '---' ? '' : address, checkedAt: j.requestDate || new Date().toISOString() });
  } catch {
    return json({ error: 'unavailable' }, 502);
  }
});
