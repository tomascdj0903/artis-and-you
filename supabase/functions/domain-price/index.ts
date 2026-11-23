// Prix d'un nom de domaine chez OVHcloud (catalogue public, sans clé) + disponibilité (RDAP, registres officiels).
// Sert à l'offre « Nom de domaine et e-mail pro » : Artis & You revend le domaine avec sa marge (réglée dans Admin › Offres et tarifs).
// Les prix OVH du catalogue sont hors taxes (la TVA d'achat est récupérée), en 1/100 000 000 d'euro.
// Appel public (page « Demander un devis ») : 60 appels par heure et par adresse IP, résultat du catalogue gardé 6 h en mémoire.
const ALLOWED = /^https:\/\/artis-and-you(-[a-z0-9-]+)?\.vercel\.app$|^http:\/\/localhost(:\d+)?$/;
const cors = (req: Request) => {
  const o = req.headers.get('origin') || '';
  return { 'Access-Control-Allow-Origin': ALLOWED.test(o) ? o : 'https://artis-and-you.vercel.app', Vary: 'Origin', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
};
const HOURLY = 60;
const hits = new Map<string, number[]>();
type Promo = { label: string; ends: string; minMonths: number; months: number; renew: number; start?: string; startDate?: string; endDate?: string; isForTestingPurpose?: boolean };
type Plan = { create: number; renew: number; promos: Promo[] };
let cat: { at: number; plans: Record<string, Plan> } | null = null;
const live = (x: any, now = Date.now()) => (!x.startDate || Date.parse(x.startDate) <= now) && (!x.endDate || Date.parse(x.endDate) > now) && !x.isForTestingPurpose;

async function catalog() {
  if (cat && Date.now() - cat.at < 6 * 3600_000) return cat.plans;
  const r = await fetch('https://eu.api.ovh.com/1.0/order/catalog/public/domain?ovhSubsidiary=FR');
  if (!r.ok) throw new Error('ovh_' + r.status);
  const d = await r.json();
  const plans: Record<string, Plan> = {};
  for (const p of d.plans || []) {
    const pr = (p.pricings || []).filter((x: any) => x.mode === 'create-default' && x.interval === 12 && x.intervalUnit === 'month');
    const create = pr.find((x: any) => (x.capacities || []).includes('installation'));
    const renew = pr.find((x: any) => !(x.capacities || []).includes('installation'));
    if (!create && !renew) continue;
    // Promotions OVH sur le renouvellement (ex. « 1 an offert pour toute souscription 3 ans ») : prix forcé sur une période, à condition d'une durée minimale
    const promos: Promo[] = [...(renew?.promotions || []), ...(create?.promotions || [])].filter((x: any) => x.total?.value != null).map((x: any) => ({
      label: String(x.description || x.name || ''), ends: x.endDate || '', minMonths: Number(x.minimumDuration || 0), months: Number(x.duration || 12), renew: Number(x.total.value) / 1e8, start: x.startDate, startDate: x.startDate, endDate: x.endDate, isForTestingPurpose: x.isForTestingPurpose,
    }));
    plans[String(p.planCode).toLowerCase()] = { create: (create?.price ?? renew?.price) / 1e8, renew: (renew?.price ?? create?.price) / 1e8, promos };
  }
  cat = { at: Date.now(), plans };
  return plans;
}

// Disponibilité : RDAP (404 = aucun enregistrement trouvé = a priori libre). null si on ne sait pas.
async function available(domain: string): Promise<boolean | null> {
  const url = domain.endsWith('.fr') ? 'https://rdap.nic.fr/domain/' + domain : 'https://rdap.org/domain/' + domain;
  try {
    const r = await fetch(url, { headers: { accept: 'application/rdap+json' }, redirect: 'follow', signal: AbortSignal.timeout(6000) });
    if (r.status === 404) return true;
    if (r.ok) return false;
    return null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  const CORS = cors(req);
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 3600_000);
  if (list.length >= HOURLY) return json({ error: 'rate' }, 429);
  list.push(now); hits.set(ip, list);

  const body = await req.json().catch(() => ({}));
  let domain = String(body.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  const ext = String(body.ext || '').trim().toLowerCase().replace(/^\./, '');
  if (!domain && ext) domain = '';
  if (domain && !/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(domain)) return json({ error: 'invalid' }, 400);

  let plans;
  try { plans = await catalog(); } catch (e) { return json({ error: 'ovh_unavailable', detail: String(e) }, 502); }
  // Extension la plus longue connue (ex. « co.uk » avant « uk »)
  const parts = (domain || 'x.' + (ext || 'fr')).split('.');
  let tld = '';
  for (let i = 1; i < parts.length; i++) { const c = parts.slice(i).join('.'); if (plans[c]) { tld = c; break; } }
  if (!tld) return json({ error: 'unknown_extension' }, 404);
  const p = plans[tld];
  const r2 = (n: number) => Math.round(n * 100) / 100;
  // Coût total d'achat HT pour 1, 2, 3 et 5 ans : 1re année au prix de création, puis renouvellements,
  // avec la promotion OVH en cours si la durée choisie la déclenche (durée minimale de renouvellement atteinte)
  const promos = p.promos.filter((x: any) => live(x));
  const packs = [1, 2, 3, 5].map((years) => {
    const renewMonths = (years - 1) * 12;
    let cost = p.create + p.renew * (years - 1), promo = '';
    for (const pr of promos) {
      if (renewMonths >= Math.max(pr.minMonths, pr.months)) {
        const saving = (p.renew * pr.months / 12) - pr.renew;
        if (saving > 0 && cost - saving < cost) { cost -= saving; promo = pr.label + (pr.ends ? ' (jusqu’au ' + new Date(pr.ends).toLocaleDateString('fr-FR') + ')' : ''); }
      }
    }
    return { years, cost_ht: r2(cost), promo };
  });
  return json({ domain: domain || null, ext: '.' + tld, create_ht: r2(p.create), renew_ht: r2(p.renew), packs, promos: promos.map((x) => ({ label: x.label, ends: x.ends, min_months: x.minMonths, renew_ht: r2(x.renew) })), available: domain ? await available(domain) : null, source: 'OVHcloud, catalogue public FR, prix HT' });
});
