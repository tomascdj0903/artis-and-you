// Reçoit les prospects trouvés par le workflow n8n « Prospects artisans 06 » et les ajoute à la page Prospects de l'admin.
// - Appel serveur à serveur (pas de navigateur) : pas de session utilisateur, on vérifie un jeton dans l'en-tête x-import-token.
//   Seule l'empreinte SHA-256 du jeton est stockée côté Supabase (table integration_tokens, ligne « n8n-prospects ») : le jeton lui-même n'est que dans n8n.
// - Ne fait qu'une chose : ajouter des lignes « À contacter » dans admin_deals (+ un événement « import » chacune). Pas de lecture renvoyée.
// - Doublons écartés comme l'import Excel de l'admin : même e-mail, téléphone, SIREN ou nom + ville.
// - Répartition 1 sur 2 entre les membres de l'équipe (réglage « team » de la plateforme : Tomas, Clément),
//   en commençant par celui qui a reçu le moins de prospects n8n jusque-là.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const MAX_ROWS = 1000;
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
const clean = (s: unknown, n = 300) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const norm = (s: unknown) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[_.]/g, ' ').replace(/\s+/g, ' ').trim();
const digits = (s: unknown) => String(s || '').replace(/\D/g, '');
const dupKey = (d: Record<string, unknown>) => [
  d.email && 'e:' + String(d.email).toLowerCase().trim(),
  digits(d.phone).length >= 9 && 'p:' + digits(d.phone).slice(-9),
  digits(d.siret).length >= 9 && 's:' + digits(d.siret).slice(0, 9),
  d.title && 'n:' + norm(d.title) + '|' + norm(d.city),
].filter(Boolean) as string[];

async function sha256(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const token = req.headers.get('x-import-token') || '';
  if (token.length < 32) return json({ error: 'auth' }, 401);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: tok } = await db.from('integration_tokens').select('sha256').eq('name', 'n8n-prospects').maybeSingle();
  if (!tok?.sha256 || !same(await sha256(token), String(tok.sha256))) return json({ error: 'auth' }, 401);

  const body = await req.json().catch(() => null);
  const rows: Record<string, unknown>[] = Array.isArray(body?.rows) ? body.rows : [];
  if (!rows.length) return json({ inserted: 0, duplicates: 0 });
  if (rows.length > MAX_ROWS) return json({ error: 'too_many' }, 413);
  const file = clean(body?.file || 'n8n', 120);

  const { data: settings } = await db.from('platform_settings').select('team, plans').eq('id', 'main').maybeSingle();
  const team: string[] = (Array.isArray(settings?.team) ? settings!.team : ['Tomas', 'Clément']).map(String).filter(Boolean);
  const plans: { id: string; price: number }[] = Array.isArray(settings?.plans) ? settings!.plans : [];
  const value = Number(plans.find((p) => p.id === 'solo')?.price ?? plans[0]?.price) || 0;

  // Doublons : tout ce qui est déjà dans les prospects (table d'équipe, quelques milliers de lignes au plus)
  const existing = new Set<string>();
  const counts = new Map(team.map((n) => [n, 0]));
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('admin_deals').select('title, city, email, phone, siret, owner, imported_from').range(from, from + 999);
    if (error) return json({ error: 'read' }, 500);
    for (const d of data || []) {
      dupKey(d).forEach((k) => existing.add(k));
      if (String(d.imported_from || '').startsWith('n8n') && counts.has(d.owner)) counts.set(d.owner, counts.get(d.owner)! + 1);
    }
    if (!data || data.length < 1000) break;
  }

  // Ordre de passage : celui qui a le moins de prospects n8n commence
  const order = [...team].sort((a, b) => counts.get(a)! - counts.get(b)!);
  const keep: Record<string, unknown>[] = [];
  let dup = 0;
  for (const r of rows) {
    const o = {
      title: clean(r['Entreprise'], 200), contact_name: clean(r['Contact'], 200), email: clean(r['E-mail'], 200).toLowerCase(),
      phone: clean(r['Téléphone'], 40), address: clean(r['Adresse']), zip: clean(r['Code postal'], 10), city: clean(r['Ville'], 120),
      trade: clean(r['Métier'], 120), siret: digits(r['SIRET']).slice(0, 14), website: clean(r['Site web'], 300),
    };
    if (!o.title) continue;
    const ks = dupKey(o);
    if (ks.some((k) => existing.has(k))) { dup++; continue; }
    ks.forEach((k) => existing.add(k));
    const infos = [
      ['Statut', r['Statut']], ['Créée le', r['Date de création']], ['Forme', r['Forme juridique']], ['Effectif', r['Effectif']],
      ['CA', r['Chiffre d’affaires'] ?? r["Chiffre d'affaires"]], ['RGE', r['RGE']], ['Google Maps', r['Fiche Google Maps']],
    ].filter(([, v]) => clean(v)).map(([k, v]) => `${k} : ${clean(v, 400)}`).join('\n');
    keep.push({
      ...o, owner: order.length ? order[keep.length % order.length] : '', worked_by: [], source: clean(r['Origine'], 300) || 'n8n',
      imported_from: 'n8n · ' + file, notes: infos, plan: 'solo', value, stage: 'prospect', updated_at: new Date().toISOString(),
    });
  }

  let inserted = 0;
  const per: Record<string, number> = {};
  for (let i = 0; i < keep.length; i += 200) {
    const { data, error } = await db.from('admin_deals').insert(keep.slice(i, i + 200)).select('id, owner');
    if (error) return json({ error: 'insert', inserted }, 500);
    inserted += data.length;
    data.forEach((d) => { per[d.owner || '—'] = (per[d.owner || '—'] || 0) + 1; });
    await db.from('admin_deal_events').insert(data.map((d) => ({ deal_id: d.id, kind: 'import', who: 'n8n', content: file })));
  }
  return json({ inserted, duplicates: dup, per_owner: per });
});
