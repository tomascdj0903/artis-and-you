// Calculs des devis / factures, statuts, étapes de projet.
import { t } from './i18n.js';
import { iso } from './format.js';

export const VAT_RATES = [20, 10, 5.5, 2.1, 0];
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const newLine = (kind = 'item', extra = {}) => ({ id: Math.random().toString(36).slice(2, 9), kind, label: '', qty: 1, unit: 'u', price: 0, vat: 20, cost: 0, ...extra });
export const defaultLines = () => [newLine('section', { label: t('Détail fournitures') }), newLine('item'), newLine('section', { label: t('Détail prestations') }), newLine('item', { unit: 'h' })];

export function computeTotals(lines = [], { franchise = false, reverse = false, deductions = [] } = {}) {
  let ht = 0, cost = 0; const byRate = {};
  for (const l of lines) {
    if (l.kind !== 'item') continue;
    const base = r2(Number(l.qty || 0) * Number(l.price || 0));
    ht += base; cost += Number(l.qty || 0) * Number(l.cost || 0);
    const rate = franchise || reverse ? 0 : Number(l.vat ?? 20);
    byRate[rate] = (byRate[rate] || 0) + base;
  }
  const vat = Object.entries(byRate).map(([rate, base]) => ({ rate: Number(rate), base: r2(base), amount: r2((base * Number(rate)) / 100) })).sort((a, b) => b.rate - a.rate);
  const tva = r2(vat.reduce((s, v) => s + v.amount, 0));
  ht = r2(ht);
  const ttc = r2(ht + tva);
  const deducted = r2(deductions.reduce((s, d) => s + Number(d.ttc || 0), 0));
  return { ht, vat, tva, ttc, cost: r2(cost), margin: r2(ht - cost), deductions, deducted, net: r2(ttc - deducted) };
}

export function sectionSubtotals(lines = []) {
  const out = {}; let cur = null;
  for (const l of lines) {
    if (l.kind === 'section') { cur = l.id; out[cur] = 0; }
    else if (l.kind === 'item' && cur) out[cur] += Number(l.qty || 0) * Number(l.price || 0);
  }
  return out;
}

export const isInvoice = (d) => ['facture', 'acompte', 'avoir'].includes(d?.kind);
export const kindLabel = (k) => ({ devis: t('Devis'), facture: t('Facture'), acompte: t("Facture d'acompte"), avoir: t('Avoir') }[k] || k);

export function effectiveStatus(d) {
  if (d.kind === 'devis') {
    if (d.status === 'envoye' && d.issue_date) {
      const exp = new Date(d.issue_date); exp.setDate(exp.getDate() + Number(d.validity_days || 30));
      if (exp < new Date()) return 'expire';
    }
    return d.status;
  }
  if (['envoyee', 'partielle'].includes(d.status) && d.due_date && d.due_date < iso(new Date()) && d.kind !== 'avoir') return 'retard';
  return d.status;
}

export function statusPill(d) {
  const s = effectiveStatus(d);
  const map = {
    brouillon: ['grey', t('Brouillon')], envoye: ['navy-o', t('En attente')], accepte: ['green', t('Accepté')], refuse: ['grey', t('Refusé')], expire: ['grey', t('Expiré')],
    envoyee: ['navy-o', t('En attente')], partielle: ['yellow', t('Partielle')], payee: ['green', t('Payée')], retard: ['red', t('En retard')], annulee: ['grey', t('Annulée')],
  };
  if (d.kind === 'avoir' && s === 'envoyee') return ['green', t('Émis')];
  return map[s] || ['grey', s];
}

// ─────────────── Étapes d'un projet (statut projet) ───────────────
export const STEPS = [
  ['devis_en_cours', 'Devis en cours'], ['devis_envoye', 'Devis envoyé'], ['devis_signe', 'Devis signé'],
  ['chantier_planifie', 'Chantier planifié'], ['chantier_en_cours', 'Chantier en cours'], ['chantier_termine', 'Chantier terminé'],
  ['facture_faite', 'Facture faite'], ['facture_envoyee', 'Facture envoyée'], ['avis_poste', 'Avis posté'],
];
export function autoSteps(project, { docs = [], appts = [], reviews = [] }) {
  const pd = docs.filter((d) => d.project_id === project.id);
  const quotes = pd.filter((d) => d.kind === 'devis');
  const invs = pd.filter((d) => isInvoice(d) && d.kind !== 'avoir');
  const pa = appts.filter((a) => a.project_id === project.id && ['valide', 'termine'].includes(a.status));
  const nowIso = new Date().toISOString();
  return {
    devis_en_cours: quotes.length > 0,
    devis_envoye: quotes.some((q) => q.number),
    devis_signe: quotes.some((q) => q.status === 'accepte'),
    chantier_planifie: pa.length > 0,
    chantier_en_cours: pa.some((a) => a.start_at <= nowIso),
    chantier_termine: !!project.finished_at || pa.some((a) => a.status === 'termine'),
    facture_faite: invs.length > 0,
    facture_envoyee: invs.some((d) => d.number),
    avis_poste: reviews.some((r) => r.appointment_id && appts.some((a) => a.id === r.appointment_id && a.project_id === project.id)),
  };
}
export function stepState(project, auto, key) {
  const m = project.manual?.[key];
  if (m === false) return 'off';
  if (auto[key]) return 'auto';
  if (m === true) return 'man';
  return 'off';
}
// Étapes visibles côté particulier
export function clientProgress(project, ctx) {
  const a = autoSteps(project, ctx);
  const st = (k) => stepState(project, a, k) !== 'off';
  const list = [
    ['Demande', true],
    ['Diagnostic', st('devis_en_cours') || st('chantier_planifie') || ctx.appts.some((x) => x.project_id === project.id && x.status !== 'a_valider')],
    ['Devis signé', st('devis_signe')],
    ['Intervention', st('chantier_en_cours')],
    ['Terminé', st('chantier_termine')],
  ];
  let cur = list.findIndex((x) => !x[1]); if (cur === -1) cur = list.length;
  return { list, cur };
}

export const APPT_TYPES = ['Diagnostic', 'Dépannage', 'Devis', 'Entretien', 'Chantier'];
export const apptStatus = (s) => ({ a_valider: ['red-o', t('À valider')], valide: ['green', t('Validé')], refuse: ['grey', t('Refusé')], annule: ['grey', t('Annulé')], termine: ['grey', t('Terminé')] }[s] || ['grey', s]);
export const clientApptStatus = (a) => ({ a_valider: ['navy-o', t('En attente de confirmation')], valide: ['green', t('Confirmé')], refuse: ['grey', t('Refusé')], annule: ['grey', t('Annulé')], termine: ['grey', t('Terminé')] }[a.status] || ['grey', a.status]);

// Occurrences (RDV récurrents) dans une période
export function expandAppointments(appts, from, to) {
  const out = [];
  for (const a of appts) {
    const dur = new Date(a.end_at) - new Date(a.start_at);
    if (!a.recurrence || a.recurrence === 'none') { if (a.start_at < to.toISOString() && a.end_at > from.toISOString()) out.push(a); continue; }
    let s = new Date(a.start_at); let n = 0;
    while (s < to && n < 400) {
      if (s >= from || new Date(+s + dur) > from) out.push({ ...a, start_at: s.toISOString(), end_at: new Date(+s + dur).toISOString(), occurrence: n });
      n++;
      s = new Date(s);
      if (a.recurrence === 'weekly') s.setDate(s.getDate() + 7); else if (a.recurrence === 'monthly') s.setMonth(s.getMonth() + 1); else s.setFullYear(s.getFullYear() + 1);
    }
  }
  return out;
}

export const DOC_TYPES = [
  ['attestation_tva', 'Attestation de TVA à taux réduit'], ['decennale', 'Attestation décennale'], ['certification', 'Attestation de certification (RGE, Qualibat…)'],
  ['kbis', 'Kbis'], ['urssaf', 'Attestation URSSAF ou MSA'], ['contrat', 'Contrats'], ['plan', 'Plans'], ['garantie', 'Garanties'], ['autre', 'Autres documents'],
];
export const VAULT_TYPES = [
  ['kbis', 'Kbis'], ['urssaf', 'Attestation de vigilance URSSAF'], ['decennale', 'Attestation décennale'], ['rcpro', 'Assurance RC Pro'],
  ['fiscale', 'Attestation de régularité fiscale'], ['certification', 'Certifications (RGE, Qualibat)'], ['btp', 'Cartes BTP'], ['contrat', 'Contrats'], ['autre', 'Autres documents'],
];
export const docTypeLabel = (k, list = DOC_TYPES) => t((list.find((x) => x[0] === k) || [k, k])[1]);
export function validity(f) {
  if (!f.valid_until) return ['green', t('À jour')];
  const d = new Date(f.valid_until + 'T23:59:59'), n = new Date();
  if (d < n) return ['grey', t('Expiré')];
  if ((d - n) / 864e5 <= (f.remind_days || 15) + 15) return ['red', t('Expire bientôt')];
  return ['green', t('À jour')];
}

export const TRADES = {
  'Bâtiment': ['Plomberie et chauffage', 'Électricité', 'Peinture', 'Carrelage', 'Menuiserie', 'Charpente', 'Couverture (toiture)', 'Maçonnerie', 'Plâtrerie', 'Serrurerie', 'Climatisation', 'Vitrerie', 'Isolation', 'Cuisiniste'],
  'Extérieur': ['Paysage', 'Piscine', 'Terrassement', 'Élagage', 'Clôture et portail'],
  'Automobile': ['Mécanique et carrosserie', 'Dépannage auto'],
  'Services': ['Nettoyage', 'Déménagement', 'Informatique', 'Électroménager', 'Ramonage', 'Multiservice'],
};
export const ALL_TRADES = Object.values(TRADES).flat();

export const PLANS = [
  { id: 'solo', name: 'Solo', price: 19, users: 1, desc: 'Pour l’artisan seul', features: ['Clients, devis et factures illimités', 'Planning et prise de RDV en ligne', 'Messagerie clients', 'Coffre-fort et documents', 'Export comptable Excel et FEC'] },
  { id: 'equipe', name: 'Équipe', price: 39, users: 5, desc: 'Jusqu’à 5 utilisateurs', features: ['Tout Solo', 'Équipes et couleurs au planning', 'Rôles et droits (chef d’équipe, ouvrier)', 'Messagerie d’équipe', 'Statut projet et KPI'] },
  { id: 'entreprise', name: 'Entreprise', price: 69, users: 0, desc: 'Utilisateurs illimités', features: ['Tout Équipe', 'Utilisateurs illimités', 'Chantiers partagés avec le réseau', 'Bibliothèque d’ouvrages avancée', 'Support prioritaire'] },
];
