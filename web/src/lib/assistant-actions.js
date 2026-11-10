// Actions de l'assistant : comprend les demandes sur VOS données et la navigation dans l'app,
// et y répond directement, sans IA (aucun token consommé), avec des boutons qui ouvrent la bonne page.
// Tout passe par l'API habituelle : chacun ne voit que les données de son entreprise (règles de sécurité Supabase).
//
// Ordre de lecture d'une demande :
//  1. politesse / « que sais-tu faire ? »
//  2. créer quelque chose (client, RDV, devis, facture… éventuellement pour un client et à une date)
//  3. infos sur un client (téléphone, adresse, e-mail, l'appeler, lui écrire, son historique, ses devis…)
//  4. planning (aujourd'hui, demain, lundi, le 15, semaine prochaine, à valider, prochain RDV…)
//  5. documents (à encaisser, en retard, devis en attente / expirés / signés, n° de document, brouillons…)
//  6. chiffres (CA du mois / mois dernier / année, nombre de clients, taux de signature)
//  7. compte (essai, abonnement, code parrainage, non lus)
//  8. aller sur une page (« ouvre les relances », « réglages des factures », « mode sombre »…)
//  9. un nom de client seul → sa fiche
import { api } from './api.js';
import { clientName, money, dateShort, hm } from './format.js';
import { effectiveStatus } from './docs.js';
import { t } from './i18n.js';
import { nz } from './assistant-kb.js';

const has = (q, ...re) => re.some((r) => r.test(q));
const iso = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

// Distance d'édition (fautes de frappe : « rosi » → « rossi »)
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// --- Dates dites en français → [début, fin, libellé] ---
export function parseWhen(q) {
  const today = startOfDay(new Date());
  if (/apres.?demain/.test(q)) return [addDays(today, 2), addDays(today, 3), t('après-demain')];
  if (/\bdemain\b/.test(q)) return [addDays(today, 1), addDays(today, 2), t('demain')];
  if (/\bhier\b/.test(q)) return [addDays(today, -1), today, t('hier')];
  if (/aujourd|ce jour|\bce matin\b|cet apres.?midi|\bce soir\b/.test(q)) return [today, addDays(today, 1), t('aujourd’hui')];
  const mon = (d) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
  if (/semaine (prochaine|suivante|d apres)/.test(q)) { const a = addDays(mon(today), 7); return [a, addDays(a, 7), t('la semaine prochaine')]; }
  if (/semaine (derniere|passee)/.test(q)) { const a = addDays(mon(today), -7); return [a, addDays(a, 7), t('la semaine dernière')]; }
  if (/cette semaine|\bsemaine\b/.test(q)) { const a = mon(today); return [a, addDays(a, 7), t('cette semaine')]; }
  if (/mois prochain/.test(q)) { const a = new Date(today.getFullYear(), today.getMonth() + 1, 1); return [a, new Date(a.getFullYear(), a.getMonth() + 1, 1), t('le mois prochain')]; }
  if (/ce mois/.test(q)) { const a = new Date(today.getFullYear(), today.getMonth(), 1); return [a, new Date(a.getFullYear(), a.getMonth() + 1, 1), t('ce mois-ci')]; }
  const dn = DAYS.findIndex((d) => new RegExp('\\b' + d + '\\b').test(q));
  if (dn >= 0) { let diff = (dn - today.getDay() + 7) % 7; if (diff === 0 && /prochain/.test(q)) diff = 7; const a = addDays(today, diff); return [a, addDays(a, 1), DAYS[dn] + ' ' + a.getDate()]; }
  let m = q.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
  if (m) { const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : today.getFullYear(); const a = new Date(y, +m[2] - 1, +m[1]); if (!isNaN(a)) return [a, addDays(a, 1), dateShort(a)]; }
  m = q.match(/\b(?:le )?(\d{1,2})(?:er)? (janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b/);
  if (m) { let a = new Date(today.getFullYear(), MONTHS.indexOf(m[2]), +m[1]); if (a < addDays(today, -60)) a = new Date(today.getFullYear() + 1, MONTHS.indexOf(m[2]), +m[1]); return [a, addDays(a, 1), dateShort(a)]; }
  m = q.match(/\ble (\d{1,2})(?:er)?\b/);
  if (m && +m[1] >= 1 && +m[1] <= 31) { let a = new Date(today.getFullYear(), today.getMonth(), +m[1]); if (a < today) a = new Date(today.getFullYear(), today.getMonth() + 1, +m[1]); return [a, addDays(a, 1), dateShort(a)]; }
  return null;
}
// « à 14h », « 9h30 », « 14:00 »
const parseHour = (q) => { const m = q.match(/\b(\d{1,2})\s?(?:h|:)\s?(\d{2})?\b/); return m && +m[1] < 24 ? [+m[1], +(m[2] || 0)] : null; };

// --- Clients ---
let cache = null;
async function clients(company) {
  if (cache && cache.id === company.id && Date.now() - cache.at < 60e3) return cache.list;
  const list = await api.select('clients', { company_id: company.id }, { order: 'created_at.desc', limit: 2000 });
  cache = { id: company.id, at: Date.now(), list }; return list;
}
const IGNORE = new Set(['client', 'clients', 'fiche', 'devis', 'facture', 'factures', 'pour', 'avec', 'chez', 'ouvre', 'ouvrir', 'trouve', 'cherche', 'affiche', 'montre', 'voir', 'appelle', 'appeler', 'ecris', 'ecrire', 'message', 'telephone', 'numero', 'adresse', 'mail', 'email', 'historique', 'demain', 'aujourd', 'hui', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche', 'nouveau', 'nouvelle', 'creer', 'cree', 'faire', 'fais', 'prepare', 'rdv', 'rendez', 'vous', 'monsieur', 'madame', 'mme', 'mr', 'les', 'des', 'son', 'ses', 'sur', 'dans', 'mes', 'mon', 'quel', 'quelle', 'est', 'sont', 'combien', 'doit', 'solde', 'derniers', 'dernier', 'documents', 'projet', 'chantier']);
async function findClient(company, q) {
  const list = await clients(company);
  const words = nz(q).split(/[^a-z0-9-]+/).filter((w) => w.length > 2 && !IGNORE.has(w));
  if (!words.length) return { match: null, others: [] };
  const scored = list.map((c) => {
    const names = nz([c.first_name, c.last_name, c.company_name, c.trade_name, c.billing_city].filter(Boolean).join(' ')).split(/[^a-z0-9-]+/).filter((w) => w.length > 2);
    let n = 0;
    for (const w of words) { if (names.includes(w)) n += 2; else if (names.some((x) => w.length >= 4 && (x.startsWith(w) || lev(w, x) <= (w.length >= 6 ? 2 : 1)))) n += 1; }
    return { c, n };
  }).filter((x) => x.n).sort((a, b) => b.n - a.n);
  return { match: scored[0]?.c || null, others: scored.slice(1, 4).filter((x) => x.n >= scored[0].n - 1).map((x) => x.c) };
}
const notFound = () => ({ text: t('Je ne trouve pas ce client. Vérifiez l’orthographe, ou créez sa fiche.'), links: [{ label: 'Clients', to: '/pro/clients' }, { label: 'Nouveau client', to: '/pro/clients/nouveau' }] });
const apptLine = (a, cm) => `• ${dateShort(a.start_at)} ${hm(a.start_at)} — ${a.personal ? a.title : clientName(cm[a.client_id]) + (a.title ? ' · ' + a.title : '')}${a.status === 'a_valider' ? ' (' + t('à valider') + ')' : ''}`;
const rest = (d) => Math.max(0, Number(d.totals?.ttc || 0) - Number(d.paid_amount || 0));

// --- Pages de l'app (navigation) ---
const PAGES = [
  [/relance/, '/pro/relances', 'Relances'],
  [/reglage.*(devis)|numerotation.*devis|parametre.*devis/, '/pro/compte/devis', 'Réglages des devis'],
  [/reglage.*(facture)|parametre.*facture|mention|penalite/, '/pro/compte/factures', 'Réglages des factures'],
  [/reglage.*(planning|agenda)|horaire|jours travailles|synchronis|google agenda|outlook/, '/pro/planning/reglages', 'Réglages du planning'],
  [/reglage.*notif|notif.*(reglage|parametre|activer|desactiver)/, '/pro/compte/notifications', 'Réglages des notifications'],
  [/mise en page|modele.*pdf|\bpdf\b/, '/pro/compte/pdf', 'Mise en page des PDF'],
  [/integration|comptable|stripe|paiement en ligne/, '/pro/compte/integrations', 'Intégrations'],
  [/donnees|rgpd|exporter mes|supprimer mon compte|confidentialite/, '/pro/compte/donnees', 'Données et confidentialité'],
  [/mode sombre|theme|apparence|langue|anglais|portugais|italien/, '/pro/compte/apparence', 'Langue et apparence'],
  [/avis client|mes avis|note google/, '/pro/compte/avis', 'Mes avis clients'],
  [/profil public|vitrine|page publique/, '/pro/reglages/profil-public', 'Profil public'],
  [/abonnement|formule|essai|tarif|payer artesa/, '/pro/compte/abonnement', 'Abonnement'],
  [/parrain/, '/pro/compte/abonnement', 'Parrainage'],
  [/equipe|salarie|ouvrier|employe|membre/, '/pro/compte/equipe', 'Mon équipe'],
  [/mon entreprise|siret|siren|\blogo\b|assurance|decennale.*(info|numero)/, '/pro/compte/entreprise', 'Mon entreprise'],
  [/mon profil|mon nom|mot de passe|double authentification|2fa/, '/pro/compte/profil', 'Mon profil'],
  [/aide|support|contact/, '/pro/compte/aide', 'Aide et support'],
  [/coffre|kbis|urssaf|attestation/, '/pro/coffre-fort', 'Coffre-fort'],
  [/photo|galerie/, '/pro/photos', 'Photos'],
  [/autres? doc/, '/pro/autres-docs', 'Autres documents'],
  [/bibliotheque|produit|ouvrage|catalogue|tarifs? (de|des) (produit|prestation)/, '/pro/crm/bibliotheque', 'Ma bibliothèque'],
  [/statut.*projet|suivi.*chantier|projets?/, '/pro/crm/statut', 'Statut des projets'],
  [/\bkpi\b|indicateur|statistique|tableau de bord/, '/pro/crm/kpi', 'KPI'],
  [/export/, '/pro/crm/export', 'Export'],
  [/\bcrm\b/, '/pro/crm', 'CRM'],
  [/inviter.*client/, '/pro/reseau/inviter-clients', 'Inviter mes clients'],
  [/ajouter.*pro|trouver.*pro|annuaire/, '/pro/reseau/ajouter', 'Ajouter un pro'],
  [/reseau|partenaire|collegue/, '/pro/reseau', 'Mon réseau'],
  [/notification|alerte/, '/pro/notifications', 'Notifications'],
  [/message|conversation|discussion|chat/, '/pro/messages', 'Messages'],
  [/\bdevis\b/, '/pro/documents/devis', 'Mes devis'],
  [/facture/, '/pro/documents/factures', 'Mes factures'],
  [/document/, '/pro/documents', 'Documents'],
  [/planning|agenda|calendrier/, '/pro/planning', 'Planning'],
  [/clients?\b/, '/pro/clients', 'Clients'],
  [/parametre|reglage|compte/, '/pro/compte', 'Paramètres'],
  [/accueil|tableau|home/, '/pro', 'Accueil'],
];

export async function runAction(question, { company, profile }) {
  if (!company) return null;
  const q = nz(question).replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();
  const wantsOpen = has(q, /^(ouvr|affich|montre|va |vas |aller|emmene|direction|go )/);

  // 1) Politesse / présentation
  if (/^(bonjour|salut|hello|coucou|bonsoir|hey|yo)\b/.test(q) && q.split(' ').length <= 3) return { text: t('Bonjour ! Que puis-je faire pour vous ?'), sugg: CAPS };
  if (/^(merci|top|super|parfait|ok|d accord|cool|genial)\b/.test(q) && q.split(' ').length <= 4) return { text: t('Avec plaisir ! Autre chose ?') };
  if (has(q, /qui es.?tu|tu es qui|que (sais|peux).?tu|tu sais faire quoi|aide.?moi|comment tu marches/)) return { text: t('Je suis l’assistant Artesa. Je peux ouvrir une page, retrouver un client, préparer un devis ou un RDV, vous donner vos RDV, vos factures à encaisser, votre chiffre d’affaires, et répondre à vos questions sur l’app. Essayez :'), sugg: CAPS };

  // 2) Créer quelque chose
  const howTo = /^(comment|pourquoi|est.?ce que|est.?il possible|c est quoi|qu est.?ce|a quoi|ou (est|sont|se trouve|trouver)|quand|puis.?je|je peux|on peut|peut.?on)\b/.test(q);
  const shortFor = /^(devis|facture|acompte|avoir)\s+(pour|chez)\s+\S/.test(q) || /^(rdv|rendez.?vous)\s+(pour|chez)\s+\S/.test(q);
  // Question « comment faire… » : c'est de l'aide (base de connaissances / IA), sauf « où est… » qui ouvre la page
  if (howTo) {
    if (/^ou (est|sont|se trouve|trouver)/.test(q)) { const p = PAGES.find(([re]) => re.test(q)); if (p) return { text: t('C’est ici : {p}.', { p: t(p[2]) }), links: [{ label: p[2], to: p[1] }] }; }
    return null;
  }
  const create = !howTo && !has(q, /dernier|derniere|derniers/) && (shortFor || has(q, /\b(nouveau|nouvelle|creer|cree|ajoute|ajouter|faire|fais|fait|prepare|preparer|programme|planifie|planifier|cale|caler|prendre|redige|rediger|emettre|etablir)\b/));
  if (create) {
    const ent = has(q, /\bavoir\b/) ? 'avoir' : has(q, /acompte/) ? 'acompte' : has(q, /\bdevis\b|estimation|chiffrage/) ? 'devis' : has(q, /facture/) ? 'facture'
      : has(q, /\brdv\b|rendez.?vous|intervention|visite|passage|chantier le|creneau/) ? 'rdv' : has(q, /\bclient\b|fiche/) ? 'client'
      : has(q, /produit|ouvrage|article|prestation/) ? 'produit' : has(q, /message|conversation/) ? 'message' : has(q, /projet/) ? 'projet'
      : has(q, /salarie|ouvrier|employe|membre|equipe/) ? 'equipe' : has(q, /\bpro\b|artisan|partenaire/) ? 'pro' : null;
    if (ent === 'client') return { text: t('Je vous ouvre le formulaire : nom, téléphone et adresse du chantier suffisent.'), links: [{ label: 'Nouveau client', to: '/pro/clients/nouveau' }], go: '/pro/clients/nouveau' };
    if (ent === 'produit') return { text: t('Ajoutez le produit ou l’ouvrage à votre bibliothèque pour le réutiliser dans vos devis.'), links: [{ label: 'Ajouter un produit', to: '/pro/crm/bibliotheque/nouveau?kind=produit' }, { label: 'Ma bibliothèque', to: '/pro/crm/bibliotheque' }], go: '/pro/crm/bibliotheque/nouveau?kind=produit' };
    if (ent === 'projet') return { text: t('Les projets se créent depuis le CRM (statut des projets).'), links: [{ label: 'Statut des projets', to: '/pro/crm/statut' }], go: '/pro/crm/statut' };
    if (ent === 'equipe') return { text: t('Créez un code d’invitation dans Mon équipe : votre salarié le saisit à son inscription.'), links: [{ label: 'Mon équipe', to: '/pro/compte/equipe' }], go: '/pro/compte/equipe' };
    if (ent === 'pro') return { text: t('Cherchez le pro et envoyez-lui une demande de connexion.'), links: [{ label: 'Ajouter un pro', to: '/pro/reseau/ajouter' }], go: '/pro/reseau/ajouter' };
    if (ent) {
      const { match, others } = await findClient(company, q);
      const when = parseWhen(q), hour = parseHour(q);
      if (ent === 'message') {
        if (!match) return { text: t('À qui voulez-vous écrire ?'), links: [{ label: 'Messages', to: '/pro/messages' }] };
        return { text: t('Je vous ouvre la conversation avec {n}.', { n: clientName(match) }), links: [{ label: t('Écrire à {n}', { n: clientName(match) }), to: `/pro/clients/${match.id}/chat` }], go: `/pro/clients/${match.id}/chat` };
      }
      if (ent === 'rdv') {
        let to = '/pro/planning/nouveau', bits = [];
        const p = new URLSearchParams();
        if (match) { p.set('client', match.id); bits.push(clientName(match)); }
        if (when) { const s = new Date(when[0]); s.setHours(hour ? hour[0] : 9, hour ? hour[1] : 0, 0, 0); p.set('start', s.toISOString()); bits.push(dateShort(s) + ' ' + hm(s)); }
        else if (hour) { const s = startOfDay(addDays(new Date(), 1)); s.setHours(hour[0], hour[1]); p.set('start', s.toISOString()); bits.push(dateShort(s) + ' ' + hm(s)); }
        if (has(q, /visio/)) p.set('type', 'Visio');
        if ([...p].length) to += '?' + p;
        return { text: bits.length ? t('Je prépare le rendez-vous : {b}. Vérifiez et enregistrez.', { b: bits.join(' · ') }) : t('Je vous ouvre un nouveau rendez-vous.'), links: [{ label: 'Nouveau rendez-vous', to }, ...others.map((c) => ({ label: clientName(c), to: '/pro/planning/nouveau?client=' + c.id }))], go: to };
      }
      const kind = ent; // devis, facture, acompte, avoir
      const to = `/pro/documents/nouveau?kind=${kind}${match ? '&client=' + match.id : ''}`;
      const L = { devis: 'Nouveau devis', facture: 'Nouvelle facture', acompte: 'Nouvelle facture d’acompte', avoir: 'Nouvel avoir' }[kind];
      return { text: match ? t('C’est prêt : le client {n} est déjà rempli.', { n: clientName(match) }) : t('Je vous ouvre le formulaire. Choisissez le client en tapant son nom.'), links: [{ label: match ? t(L) + ' · ' + clientName(match) : L, to }, ...others.map((c) => ({ label: clientName(c), to: `/pro/documents/nouveau?kind=${kind}&client=${c.id}` }))], go: to };
    }
  }

  // 3) Infos ou actions sur un client précis
  const aboutClient = !has(q, /qui (me )?doi|me doivent|de l argent|mes clients/) && has(q, /(devis|factures?|documents) (de|du|pour|chez) |rdv avec|rendez.?vous avec|telephone|numero|\btel\b|portable|joindre|appel|adresse|ou habite|\bmail\b|email|courriel|ecri|historique|ses devis|ses factures|ses documents|ses rdv|ses rendez|doit|solde|reste a payer|fiche de|infos? (sur|de)/);
  if (aboutClient && !has(q, /^(mes|mon) /)) {
    const { match, others } = await findClient(company, q);
    if (!match && has(q, / de | a | sur | avec /)) return notFound();
    if (match) {
      const c = match, n = clientName(c), id = c.id;
      const phone = c.mobile || c.phone, addr = [c.site_address || c.billing_address, [c.site_zip || c.billing_zip, c.site_city || c.billing_city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
      const more = others.length ? '\n' + t('(Autres clients proches : {l})', { l: others.map(clientName).join(', ') }) : '';
      if (has(q, /appel/)) return phone ? { text: t('Appeler {n} : {p}', { n, p: phone }) + more, links: [{ label: t('Appeler'), href: 'tel:' + phone.replace(/\s/g, '') }, { label: t('Fiche de {n}', { n }), to: '/pro/clients/' + id }] } : { text: t('Pas de numéro enregistré pour {n}.', { n }), links: [{ label: t('Compléter la fiche'), to: `/pro/clients/${id}/modifier` }] };
      if (has(q, /telephone|numero|\btel\b|portable|joindre/)) return phone ? { text: t('Téléphone de {n} : {p}', { n, p: phone }) + (c.phone && c.mobile && c.phone !== c.mobile ? ' · ' + c.phone : '') + more, links: [{ label: t('Appeler'), href: 'tel:' + phone.replace(/\s/g, '') }, { label: 'SMS', href: 'sms:' + phone.replace(/\s/g, '') }, { label: t('Fiche de {n}', { n }), to: '/pro/clients/' + id }] } : { text: t('Pas de numéro enregistré pour {n}.', { n }), links: [{ label: t('Compléter la fiche'), to: `/pro/clients/${id}/modifier` }] };
      if (has(q, /adresse|ou habite/)) return addr ? { text: t('Adresse de {n} : {a}', { n, a: addr }) + more, links: [{ label: t('Itinéraire'), href: 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(addr) }, { label: t('Fiche de {n}', { n }), to: '/pro/clients/' + id }] } : { text: t('Pas d’adresse enregistrée pour {n}.', { n }), links: [{ label: t('Compléter la fiche'), to: `/pro/clients/${id}/modifier` }] };
      if (has(q, /\bmail\b|email|courriel/) && !has(q, /ecri.*message/)) return c.email ? { text: t('E-mail de {n} : {e}', { n, e: c.email }) + more, links: [{ label: t('Envoyer un e-mail'), href: 'mailto:' + c.email }, { label: t('Fiche de {n}', { n }), to: '/pro/clients/' + id }] } : { text: t('Pas d’e-mail enregistré pour {n}.', { n }), links: [{ label: t('Compléter la fiche'), to: `/pro/clients/${id}/modifier` }] };
      if (has(q, /ecri/)) return { text: t('Je vous ouvre la conversation avec {n}.', { n }), links: [{ label: t('Écrire à {n}', { n }), to: `/pro/clients/${id}/chat` }], go: `/pro/clients/${id}/chat` };
      if (has(q, /historique/)) return { text: t('Historique de {n} : RDV, déplacements, devis, factures et paiements.', { n }), links: [{ label: t('Historique'), to: `/pro/clients/${id}/historique` }], go: `/pro/clients/${id}/historique` };
      if (has(q, /ses rdv|ses rendez|rdv avec|rendez.?vous avec/)) {
        const ap = await api.select('appointments', { company_id: company.id, client_id: id, 'start_at>=': startOfDay(new Date()).toISOString(), status: ['a_valider', 'valide'] }, { order: 'start_at.asc', limit: 5 });
        return { text: ap.length ? t('Prochains RDV avec {n} :', { n }) + '\n' + ap.map((a) => `• ${dateShort(a.start_at)} ${hm(a.start_at)} — ${a.title || a.type}`).join('\n') : t('Aucun RDV à venir avec {n}.', { n }), links: [...ap.slice(0, 2).map((a) => ({ label: dateShort(a.start_at) + ' ' + hm(a.start_at), to: '/pro/planning/rdv/' + a.id })), { label: t('Nouveau RDV pour {n}', { n }), to: '/pro/planning/nouveau?client=' + id }] };
      }
      if (has(q, /doit|solde|reste a payer|ses factures|ses devis|ses documents|(devis|factures?|documents) (de|du|pour|chez) /)) {
        const docs = await api.select('documents', { company_id: company.id, client_id: id }, { order: 'created_at.desc', limit: 100 });
        const inv = docs.filter((d) => ['facture', 'acompte'].includes(d.kind) && d.number), qs = docs.filter((d) => d.kind === 'devis');
        const due = inv.filter((d) => ['retard', 'envoyee', 'partielle'].includes(effectiveStatus(d))).reduce((s, d) => s + rest(d), 0);
        return { text: t('{n} : {q} devis, {f} facture(s). Reste à payer : {m}.', { n, q: qs.length, f: inv.length, m: money(due) }), links: [{ label: t('Ses devis'), to: `/pro/clients/${id}/devis` }, { label: t('Ses factures'), to: `/pro/clients/${id}/factures` }] };
      }
      return { text: t('Voici la fiche de {n}.', { n }) + more, links: [{ label: t('Ouvrir la fiche de {n}', { n }), to: '/pro/clients/' + id }], go: '/pro/clients/' + id };
    }
  }

  // Dernier client
  if (has(q, /dernier client|client .*(cree|ajoute|enregistre)|nouveaux clients/)) {
    const list = await clients(company);
    if (!list.length) return { text: t('Vous n’avez encore aucun client.'), links: [{ label: 'Nouveau client', to: '/pro/clients/nouveau' }] };
    if (has(q, /nouveaux clients|derniers clients/)) return { text: t('Vos derniers clients :') + '\n' + list.slice(0, 5).map((c) => '• ' + clientName(c)).join('\n'), links: list.slice(0, 3).map((c) => ({ label: clientName(c), to: '/pro/clients/' + c.id })) };
    const c = list[0];
    return { text: t('Votre dernier client créé : {n}.', { n: clientName(c) }), links: [{ label: t('Ouvrir la fiche de {n}', { n: clientName(c) }), to: '/pro/clients/' + c.id }], go: '/pro/clients/' + c.id };
  }

  // 4) Planning
  const planningQ = has(q, /\brdv\b|rendez.?vous|planning|agenda|intervention|chantier|j ai quoi|qu est.?ce que j ai|je fais quoi|suis.?je (libre|dispo)|libre|dispo|occupe|programme/);
  if (planningQ && !wantsOpen) {
    if (has(q, /a valider|demande|en attente|confirmer/)) {
      const [ap, cl] = await Promise.all([api.select('appointments', { company_id: company.id, status: 'a_valider' }, { order: 'start_at.asc', limit: 20 }), clients(company)]);
      const cm = Object.fromEntries(cl.map((c) => [c.id, c]));
      return { text: ap.length ? t('{n} demande(s) de RDV à valider :', { n: ap.length }) + '\n' + ap.slice(0, 6).map((a) => apptLine(a, cm)).join('\n') : t('Aucune demande de RDV à valider.'), links: [...ap.slice(0, 3).map((a) => ({ label: hm(a.start_at) + ' · ' + clientName(cm[a.client_id]), to: '/pro/planning/rdv/' + a.id })), { label: 'Planning', to: '/pro/planning' }] };
    }
    const next = has(q, /prochain/) && !has(q, /semaine prochaine|lundi prochain|mardi prochain|mercredi prochain|jeudi prochain|vendredi prochain|samedi prochain|mois prochain/);
    const w = next ? [new Date(), addDays(new Date(), 90), ''] : parseWhen(q) || [startOfDay(new Date()), addDays(startOfDay(new Date()), 1), t('aujourd’hui')];
    const [ap, cl] = await Promise.all([
      api.select('appointments', { company_id: company.id, 'start_at>=': w[0].toISOString(), 'start_at<': w[1].toISOString(), status: ['a_valider', 'valide'] }, { order: 'start_at.asc', limit: next ? 1 : 40 }),
      clients(company),
    ]);
    const cm = Object.fromEntries(cl.map((c) => [c.id, c]));
    const dayLink = { label: t('Voir dans le planning'), to: `/pro/planning?d=${iso(w[0])}&vue=${(w[1] - w[0]) > 864e5 * 1.5 ? 'week' : 'day'}` };
    if (has(q, /libre|dispo|occupe/)) {
      return { text: ap.length ? t('{w}, vous avez {n} RDV :', { w: w[2], n: ap.length }) + '\n' + ap.slice(0, 8).map((a) => apptLine(a, cm)).join('\n') + '\n' + t('Les créneaux libres apparaissent en vert dans le planning.') : t('Rien de prévu {w} : vous êtes libre.', { w: w[2] }), links: [dayLink, { label: 'Nouveau rendez-vous', to: '/pro/planning/nouveau?start=' + encodeURIComponent(new Date(w[0].getTime() + 9 * 36e5).toISOString()) }] };
    }
    if (!ap.length) return { text: next ? t('Aucun rendez-vous prévu dans les 3 prochains mois.') : t('Aucun rendez-vous {w}.', { w: w[2] }), links: [dayLink, { label: 'Nouveau rendez-vous', to: '/pro/planning/nouveau' }] };
    const head = next ? t('Votre prochain rendez-vous :') : t('{n} RDV {w} :', { n: ap.length, w: w[2] });
    return { text: head + '\n' + ap.slice(0, 10).map((a) => apptLine(a, cm)).join('\n') + (ap.length > 10 ? '\n' + t('… et {n} autres.', { n: ap.length - 10 }) : ''), links: [...ap.slice(0, 3).map((a) => ({ label: dateShort(a.start_at) + ' ' + hm(a.start_at) + ' · ' + (a.personal ? a.title : clientName(cm[a.client_id])), to: '/pro/planning/rdv/' + a.id })), dayLink] };
  }

  // 5) Documents
  const num = q.match(/\b(de|fa|av|ac)[ -]?(\d{4})[ -]?(\d{1,4})\b/);
  if (num) {
    const docs = await api.select('documents', { company_id: company.id }, { order: 'created_at.desc', limit: 1000 });
    const want = `${num[2]}-${num[3].padStart(4, '0')}`;
    const d = docs.find((x) => (x.number || '').toLowerCase().endsWith(want) && (x.number || '').toLowerCase().startsWith(num[1]));
    if (d) return { text: t('{k} {n} — {m} TTC.', { k: d.kind === 'devis' ? t('Devis') : t('Facture'), n: d.number, m: money(d.totals?.ttc) }), links: [{ label: t('Ouvrir'), to: '/pro/documents/' + d.id }, { label: 'PDF', to: `/pro/documents/${d.id}/pdf` }], go: '/pro/documents/' + d.id };
    return { text: t('Je ne trouve pas le document {n}.', { n: question.match(/[A-Za-z]{2}[ -]?\d{4}[ -]?\d{1,4}/)?.[0] || '' }), links: [{ label: 'Documents', to: '/pro/documents' }] };
  }
  if (has(q, /retard|impaye|pas paye|paye pas|pas regle|encaiss|me doit|me doivent|doivent|qui doit|argent .*(du|attendu)|a recevoir/)) {
    const docs = (await api.select('documents', { company_id: company.id }, { order: 'due_date.asc', limit: 1000 })).filter((d) => ['facture', 'acompte'].includes(d.kind) && d.number);
    const open = docs.filter((d) => ['retard', 'envoyee', 'partielle'].includes(effectiveStatus(d)));
    const late = open.filter((d) => effectiveStatus(d) === 'retard');
    const total = open.reduce((s, d) => s + rest(d), 0), lateTotal = late.reduce((s, d) => s + rest(d), 0);
    if (!open.length) return { text: t('Aucune facture à encaisser : tout est réglé. 👍'), links: [{ label: 'Mes factures', to: '/pro/documents/factures' }] };
    const cm = Object.fromEntries((await clients(company)).map((c) => [c.id, c]));
    const list = (late.length ? late : open).slice(0, 6).map((d) => `• ${d.number} — ${clientName(cm[d.client_id])} — ${money(rest(d))}${effectiveStatus(d) === 'retard' ? ' (' + t('échue le {d}', { d: dateShort(d.due_date) }) + ')' : ''}`).join('\n');
    return { text: t('Reste à encaisser : {m} sur {n} facture(s). En retard : {l} facture(s), {lm}.', { m: money(total), n: open.length, l: late.length, lm: money(lateTotal) }) + '\n' + list,
      links: [...(late.length ? [{ label: 'Relances', to: '/pro/relances' }] : []), ...(late.length ? late : open).slice(0, 2).map((d) => ({ label: d.number, to: '/pro/documents/' + d.id })), { label: 'Mes factures', to: '/pro/documents/factures' }] };
  }
  if (has(q, /\bdevis\b/) && has(q, /attente|sans reponse|pas signe|non signe|en cours|pas repondu|expire|perime|signe|accepte|refuse/) && !create) {
    const all = (await api.select('documents', { company_id: company.id, kind: 'devis' }, { order: 'issue_date.desc', limit: 500 })).filter((d) => d.number);
    const st = has(q, /expire|perime/) ? 'expire' : has(q, /refuse/) ? 'refuse' : has(q, /attente|sans reponse|pas signe|non signe|en cours|pas repondu/) ? 'envoye' : 'accepte';
    const list = all.filter((d) => effectiveStatus(d) === st);
    const lbl = { envoye: 'en attente de signature', expire: 'expiré(s)', refuse: 'refusé(s)', accepte: 'signé(s)' }[st];
    if (!list.length) return { text: t('Aucun devis {s}.', { s: t(lbl) }), links: [{ label: 'Mes devis', to: '/pro/documents/devis' }] };
    const sum = list.reduce((s, d) => s + Number(d.totals?.ht || 0), 0);
    return { text: t('{n} devis {s} ({m} HT) :', { n: list.length, s: t(lbl), m: money(sum) }) + '\n' + list.slice(0, 6).map((d) => `• ${d.number} — ${money(d.totals?.ttc)} (${dateShort(d.issue_date)})`).join('\n'),
      links: [...list.slice(0, 2).map((d) => ({ label: d.number, to: '/pro/documents/' + d.id })), ...(st === 'envoye' || st === 'expire' ? [{ label: 'Relances', to: '/pro/relances' }] : []), { label: 'Mes devis', to: '/pro/documents/devis' }] };
  }
  if (has(q, /brouillon/)) {
    const list = (await api.select('documents', { company_id: company.id }, { order: 'created_at.desc', limit: 300 })).filter((d) => !d.number);
    return { text: list.length ? t('{n} brouillon(s) pas encore envoyé(s).', { n: list.length }) : t('Aucun brouillon.'), links: list.slice(0, 3).map((d) => ({ label: (d.kind === 'devis' ? t('Devis') : t('Facture')) + ' · ' + (d.object || dateShort(d.created_at)), to: `/pro/documents/${d.id}/modifier` })) };
  }
  const last = q.match(/dern(ier|iere|iers|ieres) (devis|facture|avoir)/);
  if (last) {
    const kind = last[2];
    const list = await api.select('documents', { company_id: company.id, kind }, { order: 'created_at.desc', limit: 5 });
    if (!list.length) return { text: t('Aucun document de ce type pour l’instant.'), links: [{ label: kind === 'devis' ? 'Nouveau devis' : 'Nouvelle facture', to: '/pro/documents/nouveau?kind=' + kind }] };
    if (/iers|ieres/.test(last[1])) return { text: list.map((d) => `• ${d.number || t('brouillon')} — ${money(d.totals?.ttc)}`).join('\n'), links: list.slice(0, 3).map((d) => ({ label: d.number || t('brouillon'), to: '/pro/documents/' + d.id })) };
    const d = list[0];
    return { text: t('{k} {n} — {m}.', { k: kind === 'devis' ? t('Dernier devis') : t('Dernière facture'), n: d.number || t('brouillon'), m: money(d.totals?.ttc) }), links: [{ label: t('Ouvrir'), to: '/pro/documents/' + d.id }], go: '/pro/documents/' + d.id };
  }

  // 6) Chiffres
  if (has(q, /chiffre d affaire|\bca\b|combien .*(gagne|facture|encaisse)|j ai facture|resultat/)) {
    const now = new Date();
    let a = new Date(now.getFullYear(), now.getMonth(), 1), b = new Date(now.getFullYear(), now.getMonth() + 1, 1), lbl = t('ce mois-ci');
    if (has(q, /mois dernier|mois precedent/)) { a = new Date(now.getFullYear(), now.getMonth() - 1, 1); b = new Date(now.getFullYear(), now.getMonth(), 1); lbl = t('le mois dernier'); }
    else if (has(q, /annee|an\b|depuis janvier/)) { a = new Date(now.getFullYear(), 0, 1); b = new Date(now.getFullYear() + 1, 0, 1); lbl = t('cette année'); }
    else if (has(q, /trimestre/)) { a = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); b = new Date(a.getFullYear(), a.getMonth() + 3, 1); lbl = t('ce trimestre'); }
    const docs = (await api.select('documents', { company_id: company.id, 'issue_date>=': iso(a), 'issue_date<': iso(b) }, { limit: 2000 })).filter((d) => d.number && ['facture', 'acompte', 'avoir'].includes(d.kind));
    const ca = docs.reduce((s, d) => s + (d.kind === 'avoir' ? -1 : 1) * Number(d.totals?.ht || 0), 0);
    const paid = docs.reduce((s, d) => s + (d.kind === 'avoir' ? 0 : Number(d.paid_amount || 0)), 0);
    return { text: t('Chiffre d’affaires facturé {l} : {m} HT ({n} document(s)). Déjà encaissé : {p} TTC.', { l: lbl, m: money(ca), n: docs.length, p: money(paid) }), links: [{ label: 'KPI', to: '/pro/crm/kpi' }, { label: 'CRM', to: '/pro/crm' }] };
  }
  if (has(q, /combien (de|d) clients|nombre de clients|j ai combien de clients/)) {
    const list = await clients(company);
    const m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0);
    return { text: t('Vous avez {n} clients, dont {m} ajoutés ce mois-ci.', { n: list.length, m: list.filter((c) => new Date(c.created_at) >= m0).length }), links: [{ label: 'Clients', to: '/pro/clients' }] };
  }
  if (has(q, /taux (de )?(signature|transformation|acceptation)|combien de devis (signe|accepte)/)) {
    const all = (await api.select('documents', { company_id: company.id, kind: 'devis' }, { limit: 2000 })).filter((d) => d.number);
    const ok = all.filter((d) => d.status === 'accepte').length, ko = all.filter((d) => ['refuse', 'expire'].includes(effectiveStatus(d))).length;
    return { text: all.length ? t('{o} devis signés sur {n} envoyés, soit {p} % de signature ({k} refusés ou expirés).', { o: ok, n: all.length, p: Math.round((ok / all.length) * 100), k: ko }) : t('Pas encore de devis envoyé.'), links: [{ label: 'KPI', to: '/pro/crm/kpi' }] };
  }

  // 7) Compte
  if (has(q, /essai|jours? (restant|gratuit)|fin de (mon )?essai|abonnement|ma formule/)) {
    const left = company.trial_ends_at ? Math.ceil((new Date(company.trial_ends_at) - Date.now()) / 864e5) : null;
    return { text: (left > 0 ? t('Il vous reste {n} jour(s) d’essai gratuit.', { n: left }) + ' ' : '') + t('Formule actuelle : {p}.', { p: company.plan || t('essai') }), links: [{ label: 'Abonnement', to: '/pro/compte/abonnement' }] };
  }
  if (has(q, /code (de )?parrain|mon code|parrainer/)) return { text: company.referral_code ? t('Votre code de parrainage : {c}. Votre filleul a 1 mois offert en plus de l’essai, vous gagnez 15 jours.', { c: company.referral_code }) : t('Votre code de parrainage est dans Abonnement et parrainage.'), links: [{ label: 'Mon parrainage', to: '/pro/compte/abonnement' }] };
  if (has(q, /non lu|pas lu|nouveaux? messages?|j ai des messages|nouvelles? notif/)) return { text: t('Vos messages et notifications non lus sont signalés par une pastille rouge.'), links: [{ label: 'Messages', to: '/pro/messages' }, { label: 'Notifications', to: '/pro/notifications' }] };

  // 8) Aller sur une page (« ouvre… », « où est… », ou simplement « mes factures », « mon équipe »)
  if (wantsOpen || /^(mes|mon|ma|les|la|le) [a-z ]{3,30}$/.test(q) || /^[a-z ]{3,25}$/.test(q) && PAGES.some(([re]) => re.test(q)) || /^(ou (est|sont|trouve|je trouve)|comment (aller|acceder))/.test(q)) {
    const p = PAGES.find(([re]) => re.test(q));
    if (p) return { text: wantsOpen ? t('Je vous ouvre : {p}.', { p: t(p[2]) }) : t('C’est par ici :'), links: [{ label: p[2], to: p[1] }], go: p[1] };
  }

  // 9) Un nom de client seul, ou « fiche / ouvre X »
  if (wantsOpen || has(q, /fiche|trouve|cherche|client/) || /^[a-z -]{3,40}$/.test(q)) {
    const { match, others } = await findClient(company, q);
    if (match) return { text: t('Voici la fiche de {n}.', { n: clientName(match) }) + (others.length ? '\n' + t('(Autres clients proches : {l})', { l: others.map(clientName).join(', ') }) : ''),
      links: [{ label: t('Ouvrir la fiche de {n}', { n: clientName(match) }), to: '/pro/clients/' + match.id }, ...others.map((c) => ({ label: clientName(c), to: '/pro/clients/' + c.id }))], go: wantsOpen ? '/pro/clients/' + match.id : undefined };
    if (wantsOpen) { const p = PAGES.find(([re]) => re.test(q)); if (p) return { text: t('Je vous ouvre : {p}.', { p: t(p[2]) }), links: [{ label: p[2], to: p[1] }], go: p[1] }; }
  }
  return null;
}

// Exemples proposés quand on demande ce que sait faire l'assistant
export const CAPS = [
  { id: 'c1', q: 'Mes rendez-vous de demain' }, { id: 'c2', q: 'Qui me doit de l’argent ?' }, { id: 'c3', q: 'Fais un devis pour…' },
  { id: 'c4', q: 'Téléphone de…' }, { id: 'c5', q: 'Mon chiffre d’affaires du mois' }, { id: 'c6', q: 'Devis en attente' }, { id: 'c7', q: 'Ouvre les relances' },
];
