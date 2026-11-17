// Réglages de la plateforme (formules, prix, durée d'essai), modifiables par l'équipe Artesa depuis l'espace admin.
// Lus dans la table platform_settings ; à défaut, valeurs par défaut de lib/docs.js.
import { useEffect, useState } from 'react';
import { api } from './api.js';
import { PLANS } from './docs.js';

const DEFAULT = { plans: PLANS, trial_days: 30, banner: '', support_email: 'support@artisandyou.fr', team: ['Tomas', 'Clément'] };
let cache = null, pending = null;
const subs = new Set();

export function loadPlatform(force = false) {
  if (cache && !force) return Promise.resolve(cache);
  if (pending && !force) return pending;
  pending = api.select('platform_settings', { id: 'main' })
    .then((r) => { cache = { ...DEFAULT, ...(r?.[0] || {}) }; if (!Array.isArray(cache.plans) || !cache.plans.length) cache.plans = PLANS; subs.forEach((f) => f(cache)); return cache; })
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
