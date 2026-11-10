// Actions de l'assistant : comprend les demandes sur VOS données (« ouvre mon dernier client »,
// « mes RDV de demain », « factures en retard », « devis pour Dupont »…) et y répond directement,
// sans IA (donc sans consommer de tokens), avec des boutons qui ouvrent la bonne page.
// Tout passe par l'API habituelle : chacun ne voit que les données de son entreprise (règles de sécurité Supabase).
import { api } from './api.js';
import { clientName, money, dateShort, hm } from './format.js';
import { effectiveStatus } from './docs.js';
import { t } from './i18n.js';
import { nz } from './assistant-kb.js';

const has = (q, ...re) => re.some((r) => r.test(q));
const dayRange = (offset) => { const a = new Date(); a.setHours(0, 0, 0, 0); a.setDate(a.getDate() + offset); const b = new Date(a); b.setDate(b.getDate() + 1); return [a, b]; };
const weekRange = () => { const a = new Date(); a.setHours(0, 0, 0, 0); const d = (a.getDay() + 6) % 7; a.setDate(a.getDate() - d); const b = new Date(a); b.setDate(b.getDate() + 7); return [a, b]; };

// Cherche un client dont le nom apparaît dans la question
async function findClient(company, q) {
  const cl = await api.select('clients', { company_id: company.id }, { order: 'created_at.desc', limit: 500 });
  const words = nz(q).split(/[^a-z0-9-]+/).filter((w) => w.length > 2);
  const scored = cl.map((c) => {
    const names = nz([c.first_name, c.last_name, c.company_name, c.trade_name].filter(Boolean).join(' ')).split(/\s+/).filter((w) => w.length > 2);
    return { c, n: names.filter((x) => words.includes(x)).length };
  }).filter((x) => x.n).sort((a, b) => b.n - a.n);
  return { all: cl, match: scored[0]?.c, others: scored.slice(1, 4).map((x) => x.c) };
}
const apptLine = (a, cm) => `• ${dateShort(a.start_at)} ${hm(a.start_at)} — ${a.personal ? a.title : clientName(cm[a.client_id]) + (a.title ? ' · ' + a.title : '')}`;

export async function runAction(question, { company }) {
  if (!company) return null;
  const q = nz(question);

  // --- Dernier client créé / ouvrir un client ---
  if (has(q, /dernier client/, /client .*(cree|ajoute|enregistre)/, /nouveau client .*(ajoute|cree)/) && !has(q, /creer un|ajouter un/)) {
    const [c] = await api.select('clients', { company_id: company.id }, { order: 'created_at.desc', limit: 1 });
    if (!c) return { text: t('Vous n’avez encore aucun client.'), links: [{ label: 'Nouveau client', to: '/pro/clients/nouveau' }] };
    return { text: t('Votre dernier client créé : {n}.', { n: clientName(c) }), links: [{ label: t('Ouvrir la fiche de {n}', { n: clientName(c) }), to: '/pro/clients/' + c.id }], go: '/pro/clients/' + c.id };
  }

  // --- Devis / facture / RDV pour un client nommé ---
  const forClient = q.match(/(devis|facture|rdv|rendez vous|rendez-vous)\s+(pour|a|chez|de)\s+(.+)/);
  if (forClient && has(q, /(fai|cree|nouveau|nouvelle|prepare|ajoute)/)) {
    const { match } = await findClient(company, forClient[3]);
    const kind = forClient[1].startsWith('rdv') || forClient[1].startsWith('rendez') ? 'rdv' : forClient[1];
    if (!match) return { text: t('Je ne trouve pas ce client. Vérifiez l’orthographe ou créez sa fiche.'), links: [{ label: 'Clients', to: '/pro/clients' }, { label: 'Nouveau client', to: '/pro/clients/nouveau' }] };
    const to = kind === 'rdv' ? '/pro/planning/nouveau?client=' + match.id : `/pro/documents/nouveau?kind=${kind}&client=${match.id}`;
    const label = kind === 'rdv' ? t('Nouveau RDV pour {n}', { n: clientName(match) }) : kind === 'devis' ? t('Nouveau devis pour {n}', { n: clientName(match) }) : t('Nouvelle facture pour {n}', { n: clientName(match) });
    return { text: t('C’est prêt : le client {n} est déjà rempli.', { n: clientName(match) }), links: [{ label, to }], go: to };
  }

  // --- Rendez-vous : aujourd'hui / demain / semaine / prochain ---
  if (has(q, /\brdv\b/, /rendez.?vous/, /planning/, /agenda/) && has(q, /aujourd/, /demain/, /semaine/, /prochain/, /mes rdv/, /quels? rdv/, /j ai quoi/)) {
    const [a, b] = has(q, /demain/) ? dayRange(1) : has(q, /semaine/) ? weekRange() : has(q, /prochain/) ? [new Date(), new Date(Date.now() + 60 * 864e5)] : dayRange(0);
    const [ap, cl] = await Promise.all([
      api.select('appointments', { company_id: company.id, 'start_at>=': a.toISOString(), 'start_at<': b.toISOString(), status: ['a_valider', 'valide'] }, { order: 'start_at.asc', limit: has(q, /prochain/) ? 1 : 20 }),
      api.select('clients', { company_id: company.id }),
    ]);
    const cm = Object.fromEntries(cl.map((c) => [c.id, c]));
    const when = has(q, /demain/) ? t('demain') : has(q, /semaine/) ? t('cette semaine') : has(q, /prochain/) ? '' : t('aujourd’hui');
    if (!ap.length) return { text: has(q, /prochain/) ? t('Aucun rendez-vous prévu dans les 60 prochains jours.') : t('Aucun rendez-vous {w}.', { w: when }), links: [{ label: 'Nouveau rendez-vous', to: '/pro/planning/nouveau' }] };
    const head = has(q, /prochain/) ? t('Votre prochain rendez-vous :') : t('{n} RDV {w} :', { n: ap.length, w: when });
    return { text: head + '\n' + ap.slice(0, 8).map((x) => apptLine(x, cm)).join('\n'), links: [...ap.slice(0, 3).map((x) => ({ label: hm(x.start_at) + ' · ' + (x.personal ? x.title : clientName(cm[x.client_id])), to: '/pro/planning/rdv/' + x.id })), { label: 'Planning', to: '/pro/planning' }] };
  }

  // --- Factures en retard / impayées / reste à encaisser ---
  if (has(q, /retard/, /impaye/, /pas paye/, /paye pas/, /encaiss/, /me doit/, /doivent/)) {
    const docs = (await api.select('documents', { company_id: company.id }, { order: 'due_date.asc', limit: 500 })).filter((d) => ['facture', 'acompte'].includes(d.kind) && d.number);
    const open = docs.filter((d) => ['retard', 'envoyee', 'partielle'].includes(effectiveStatus(d)));
    const late = open.filter((d) => effectiveStatus(d) === 'retard');
    const rest = (d) => Math.max(0, Number(d.totals?.ttc || 0) - Number(d.paid_amount || 0));
    const total = open.reduce((s, d) => s + rest(d), 0);
    if (!open.length) return { text: t('Aucune facture à encaisser : tout est réglé. 👍'), links: [{ label: 'Mes factures', to: '/pro/documents/factures' }] };
    const list = (late.length ? late : open).slice(0, 5).map((d) => `• ${d.number} — ${money(rest(d))}${effectiveStatus(d) === 'retard' ? ' (' + t('en retard') + ')' : ''}`).join('\n');
    return { text: t('Reste à encaisser : {m} sur {n} facture(s), dont {l} en retard.', { m: money(total), n: open.length, l: late.length }) + '\n' + list,
      links: [...(late.length ? [{ label: 'Relances', to: '/pro/relances' }] : []), ...(late.length ? late : open).slice(0, 2).map((d) => ({ label: d.number, to: '/pro/documents/' + d.id })), { label: 'Mes factures', to: '/pro/documents/factures' }] };
  }

  // --- Devis en attente / sans réponse ---
  if (has(q, /devis/) && has(q, /attente/, /sans reponse/, /pas signe/, /en cours/, /pas repondu/)) {
    const docs = (await api.select('documents', { company_id: company.id, kind: 'devis' }, { order: 'issue_date.desc', limit: 300 })).filter((d) => d.number && effectiveStatus(d) === 'envoye');
    if (!docs.length) return { text: t('Aucun devis en attente de réponse.'), links: [{ label: 'Mes devis', to: '/pro/documents/devis' }] };
    return { text: t('{n} devis en attente de signature :', { n: docs.length }) + '\n' + docs.slice(0, 5).map((d) => `• ${d.number} — ${money(d.totals?.ttc)} (${dateShort(d.issue_date)})`).join('\n'),
      links: [...docs.slice(0, 2).map((d) => ({ label: d.number, to: '/pro/documents/' + d.id })), { label: 'Relances', to: '/pro/relances' }, { label: 'Mes devis', to: '/pro/documents/devis' }] };
  }

  // --- Dernier devis / dernière facture ---
  const last = q.match(/dern(ier|iere) (devis|facture)/);
  if (last) {
    const kind = last[2];
    const [d] = await api.select('documents', { company_id: company.id, kind }, { order: 'created_at.desc', limit: 1 });
    if (!d) return { text: kind === 'devis' ? t('Vous n’avez encore aucun devis.') : t('Vous n’avez encore aucune facture.'), links: [{ label: kind === 'devis' ? 'Nouveau devis' : 'Nouvelle facture', to: '/pro/documents/nouveau?kind=' + kind }] };
    return { text: t('{k} {n} — {m}.', { k: kind === 'devis' ? t('Dernier devis') : t('Dernière facture'), n: d.number || t('brouillon'), m: money(d.totals?.ttc) }), links: [{ label: t('Ouvrir'), to: '/pro/documents/' + d.id }], go: '/pro/documents/' + d.id };
  }

  // --- Chiffre d'affaires ---
  if (has(q, /chiffre d affaire/, /\bca\b/, /combien .*(gagne|facture)/)) {
    const m0 = new Date(); m0.setDate(1); const k = m0.toISOString().slice(0, 10);
    const docs = (await api.select('documents', { company_id: company.id, 'issue_date>=': k }, { limit: 500 })).filter((d) => d.number && ['facture', 'acompte', 'avoir'].includes(d.kind));
    const ca = docs.reduce((s, d) => s + (d.kind === 'avoir' ? -1 : 1) * Number(d.totals?.ht || 0), 0);
    return { text: t('Chiffre d’affaires facturé ce mois-ci : {m} HT ({n} document(s)).', { m: money(ca), n: docs.length }), links: [{ label: 'CRM', to: '/pro/crm' }] };
  }

  // --- Trouver / ouvrir un client par son nom ---
  if (has(q, /(ouvr|trouv|cherch|affich|fiche|voir|montre)/) || /^[a-z -]{3,40}$/.test(q.trim())) {
    const { match, others } = await findClient(company, q);
    if (match) return { text: t('Voici la fiche de {n}.', { n: clientName(match) }) + (others.length ? '\n' + t('Autres clients proches : {l}', { l: others.map(clientName).join(', ') }) : ''),
      links: [{ label: t('Ouvrir la fiche de {n}', { n: clientName(match) }), to: '/pro/clients/' + match.id }, ...others.map((c) => ({ label: clientName(c), to: '/pro/clients/' + c.id }))] };
  }
  return null;
}
