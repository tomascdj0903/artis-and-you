// Vérifications gratuites auprès de sources officielles
//  - RGE : API open data de l'ADEME (liste des entreprises RGE), appelée directement depuis le navigateur
//  - N° de TVA intracommunautaire : contrôle de la clé française hors ligne, puis VIES (Commission européenne)
//    via la fonction Supabase « vat-check » (VIES n'autorise pas les appels directs depuis un navigateur)
import { api, OFFLINE } from './api.js';

const RGE_URL = 'https://data.ademe.fr/data-fair/api/v1/datasets/liste-des-entreprises-rge-2/lines';
const RGE_FIELDS = 'siret,nom_entreprise,domaine,meta_domaine,nom_qualification,organisme,lien_date_debut,lien_date_fin,url_qualification';
const rgeCache = new Map();

// Qualifications RGE en cours de validité pour un SIREN (9 chiffres) ou un SIRET (14 chiffres)
export async function rgeLookup(id) {
  const d = String(id || '').replace(/\D/g, '');
  if (d.length !== 9 && d.length !== 14) return { ok: false, list: [] };
  if (rgeCache.has(d)) return rgeCache.get(d);
  const qs = d.length === 14 ? `siret:"${d}"` : `siret:${d}*`;
  const p = fetch(`${RGE_URL}?${new URLSearchParams({ qs, size: '100', select: RGE_FIELDS })}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('rge ' + r.status))))
    .then((j) => {
      const today = new Date().toISOString().slice(0, 10);
      const seen = new Set();
      const list = (j.results || [])
        .filter((x) => !x.lien_date_fin || x.lien_date_fin >= today)
        .filter((x) => { const k = x.domaine + '|' + x.nom_qualification; if (seen.has(k)) return false; seen.add(k); return true; })
        .map((x) => ({ domaine: x.domaine, famille: x.meta_domaine, qualification: x.nom_qualification, organisme: String(x.organisme || '').toUpperCase(), debut: x.lien_date_debut, fin: x.lien_date_fin && x.lien_date_fin < '2090' ? x.lien_date_fin : '', url: x.url_qualification, siret: x.siret }))
        .sort((a, b) => a.domaine.localeCompare(b.domaine, 'fr'));
      return { ok: true, list, checkedAt: new Date().toISOString() };
    })
    .catch(() => { rgeCache.delete(d); return { ok: false, list: [], error: 'unreachable' }; });
  rgeCache.set(d, p);
  return p;
}

// ── TVA intracommunautaire ──
export const normVat = (v) => String(v || '').toUpperCase().replace(/[\s.\-]/g, '');

// Clé du numéro de TVA français : FR + clé (2 chiffres) + SIREN
export function frVatFromSiren(siren) {
  const s = String(siren || '').replace(/\D/g, '');
  if (s.length !== 9) return '';
  const key = (12 + 3 * (Number(s) % 97)) % 97;
  return 'FR' + String(key).padStart(2, '0') + s;
}

// Formats nationaux (Union européenne + Irlande du Nord) ; la clé est vérifiée pour la France
const FORMATS = {
  AT: /^U\d{8}$/, BE: /^[01]\d{9}$/, BG: /^\d{9,10}$/, CY: /^\d{8}[A-Z]$/, CZ: /^\d{8,10}$/, DE: /^\d{9}$/, DK: /^\d{8}$/, EE: /^\d{9}$/,
  EL: /^\d{9}$/, ES: /^[A-Z0-9]\d{7}[A-Z0-9]$/, FI: /^\d{8}$/, FR: /^[A-Z0-9]{2}\d{9}$/, HR: /^\d{11}$/, HU: /^\d{8}$/, IE: /^\d{7}[A-Z]{1,2}$|^\d[A-Z+*]\d{5}[A-Z]$/,
  IT: /^\d{11}$/, LT: /^(\d{9}|\d{12})$/, LU: /^\d{8}$/, LV: /^\d{11}$/, MT: /^\d{8}$/, NL: /^\d{9}B\d{2}$/, PL: /^\d{10}$/, PT: /^\d{9}$/,
  RO: /^\d{2,10}$/, SE: /^\d{12}$/, SI: /^\d{8}$/, SK: /^\d{10}$/, XI: /^(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/,
};

// Contrôle hors ligne : { ok, country, number, reason }
export function vatFormat(v, siren) {
  const n = normVat(v);
  const cc = n.slice(0, 2), num = n.slice(2);
  if (!n) return { ok: false, reason: 'empty' };
  if (!FORMATS[cc]) return { ok: false, reason: 'country', country: cc, number: num };
  if (!FORMATS[cc].test(num)) return { ok: false, reason: 'format', country: cc, number: num };
  if (cc === 'FR' && /^\d{2}$/.test(num.slice(0, 2))) {
    if (frVatFromSiren(num.slice(2)) !== n) return { ok: false, reason: 'key', country: cc, number: num };
    const s = String(siren || '').replace(/\D/g, '').slice(0, 9);
    if (s.length === 9 && num.slice(2) !== s) return { ok: false, reason: 'siren', country: cc, number: num };
  }
  return { ok: true, country: cc, number: num };
}

// Vérification complète : format puis registre VIES.
// Résultat : { status: 'valid' | 'invalid' | 'format' | 'unchecked', name, address, reason }
export async function checkVat(v, siren) {
  const f = vatFormat(v, siren);
  if (!f.ok) return { status: 'format', reason: f.reason };
  if (OFFLINE) return { status: 'unchecked', reason: 'offline' };
  try {
    const r = await api.fn('vat-check', { vat: f.country + f.number });
    if (r?.valid === true) return { status: 'valid', name: r.name || '', address: r.address || '', checkedAt: r.checkedAt };
    if (r?.valid === false) return { status: 'invalid' };
    return { status: 'unchecked', reason: r?.error || 'unavailable' };
  } catch { return { status: 'unchecked', reason: 'unavailable' }; }
}
