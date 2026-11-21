// Réglages de la plateforme (formules, prix, durée d'essai), modifiables par l'équipe Artis & You depuis l'espace admin.
// Lus dans la table platform_settings ; à défaut, valeurs par défaut de lib/docs.js.
import { useEffect, useState } from 'react';
import { api } from './api.js';
import { PLANS } from './docs.js';

// Offres complémentaires (en plus des formules) : proposées dans la demande de devis et reprises, avec leur prix, dans le devis préparé par l'équipe
// unit : 'forfait' (payé une fois) ou 'mois' (chaque mois, avec d'éventuels frais de mise en place « setup ») ; prix HT (grille Services et tarifs V4 du 16/11/2026, ajustée le 21/11/2026)
export const DEFAULT_EXTRAS = [
  {
  "id": "reprise",
  "label": "Reprise de nos données (clients, devis, factures)",
  "unit": "forfait",
  "price": 199.99,
  "setup": 0,
  "desc": "Nettoyage et import par l’équipe (l’import en autonomie reste gratuit)",
  "active": true
  },
  {
  "id": "accompagnement",
  "label": "Accompagnement à la mise en place",
  "unit": "forfait",
  "price": 19,
  "setup": 0,
  "desc": "Création du compte, logo, contacts et premier rendez-vous avec vous",
  "active": true
  },
  {
  "id": "bibliotheque",
  "label": "Bibliothèque d’articles et d’ouvrages sur mesure",
  "unit": "forfait",
  "price": 99.99,
  "setup": 0,
  "desc": "Créée par l’équipe à partir de vos anciens devis",
  "active": true
  },
  {
  "id": "fiche",
  "label": "Fiche Artis & You mise en forme",
  "unit": "forfait",
  "price": 49.99,
  "setup": 0,
  "desc": "Textes rédigés et plus belles photos choisies par l’équipe",
  "active": true
  },
  {
  "id": "google",
  "label": "Fiche Google",
  "unit": "forfait",
  "price": 49.99,
  "setup": 0,
  "desc": "Création ou reprise de votre fiche sur Google Maps",
  "active": true
  },
  {
  "id": "compta",
  "label": "Lien avec notre logiciel de comptabilité",
  "unit": "mois",
  "price": 19.99,
  "setup": 0,
  "desc": "",
  "active": true
  },
  {
  "id": "facturx",
  "label": "Facturation électronique",
  "unit": "mois",
  "price": 20,
  "setup": 0,
  "desc": "",
  "active": true
  },
  {
  "id": "dedie",
  "label": "Un interlocuteur dédié",
  "unit": "mois",
  "price": 20,
  "setup": 0,
  "desc": "Un point de 30 minutes chaque trimestre",
  "active": true
  },
  {
  "id": "agences",
  "label": "Plusieurs agences ou établissements",
  "unit": "mois",
  "price": 14.99,
  "setup": 0,
  "desc": "Par établissement en plus",
  "active": true
  },
  {
  "id": "domaine",
  "label": "Nom de domaine et e-mail pro",
  "unit": "mois",
  "price": 5,
  "setup": 29.99,
  "ovh": true,
  "margin_pct": 50,
  "margin_fixed": 3,
  "ext": ".fr",
  "desc": "Votre adresse contact@votre-entreprise.fr",
  "active": true
  },
  {
  "id": "avant",
  "label": "Mise en avant de la fiche",
  "unit": "mois",
  "price": 9.99,
  "setup": 0,
  "desc": "En premier dans votre zone, avec la mention « Sponsorisé »",
  "active": true
  }
  ];
const DEFAULT = { extras: DEFAULT_EXTRAS, plans: PLANS, trial_days: 30, banner: '', support_email: 'support@artisandyou.fr', team: ['Tomas', 'Clément'] };
let cache = null, pending = null;
const subs = new Set();

export function loadPlatform(force = false) {
  if (cache && !force) return Promise.resolve(cache);
  if (pending && !force) return pending;
  pending = api.select('platform_settings', { id: 'main' })
    .then((r) => { cache = { ...DEFAULT, ...(r?.[0] || {}) }; if (!Array.isArray(cache.plans) || !cache.plans.length) cache.plans = PLANS; if (!Array.isArray(cache.extras)) cache.extras = DEFAULT_EXTRAS; subs.forEach((f) => f(cache)); return cache; })
    .catch(() => cache || DEFAULT)
    .finally(() => { pending = null; });
  return pending;
}

export function usePlatform() {
  const [s, set] = useState(cache || DEFAULT);
  useEffect(() => { subs.add(set); loadPlatform().then(set); return () => subs.delete(set); }, []);
  return s;
}
export const usePlans = () => usePlatform().plans;

export async function savePlatform(patch, userId) {
  await api.update('platform_settings', { id: 'main' }, { ...patch, updated_at: new Date().toISOString(), updated_by: userId });
  return loadPlatform(true);
}

// « Qui travaille ? » : l'équipe peut partager un même identifiant, chacun choisit son nom sur son appareil
const WHO_KEY = 'ay_admin_who';
const whoSubs = new Set();
export function useWho(profile) {
  const { team } = usePlatform();
  const read = () => { try { return localStorage.getItem(WHO_KEY) || ''; } catch { return ''; } };
  const [who, set] = useState(read);
  useEffect(() => { whoSubs.add(set); return () => whoSubs.delete(set); }, []);
  const guess = team.find((n) => n.toLowerCase() === String(profile?.first_name || '').toLowerCase()) || '';
  const cur = team.includes(who) ? who : guess;
  const setWho = (n) => { try { localStorage.setItem(WHO_KEY, n); } catch { /* navigation privée */ } whoSubs.forEach((f) => f(n)); };
  return [cur, setWho, team];
}

// Nom de domaine relié à OVH : prix d'achat HT chez OVHcloud (TVA d'achat récupérée) + marge, arrondi à ,99 au-dessus.
// La marge se règle sur l'offre (Admin › Offres et tarifs › Compléments) : margin_pct (%) et margin_fixed (€ par an).
export const domainSale = (costHt, x = {}) => {
  const raw = Number(costHt || 0) * (1 + Number(x.margin_pct ?? 50) / 100) + Number(x.margin_fixed ?? 3);
  return raw > 0 ? Math.ceil(raw) - 0.01 : 0;
};
// Prix OVH d'un domaine (ou d'une extension) via la fonction serveur domain-price
export async function domainQuote(domainOrExt) {
  const v = String(domainOrExt || '').trim().toLowerCase();
  const body = v.startsWith('.') || !v.includes('.') ? { ext: v || '.fr' } : { domain: v };
  const r = await api.fn('domain-price', body).catch(() => null);
  return r && !r.error ? r : null;
}
// Nom proposé par défaut à partir du nom de l'entreprise : « Plomberie Morel » → plomberie-morel.fr
export const domainFromName = (name, ext = '.fr') => String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' et ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) + (ext.startsWith('.') ? ext : '.' + ext);
