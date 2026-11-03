// Relances clients (façon Pennylane) : scénarios personnalisables par étape, pour les factures impayées et les devis sans réponse
import { api, uid } from './api.js';
import { t } from './i18n.js';
import { iso, date, money, clientName, fullName } from './format.js';

export const DEFAULT_SCENARIOS = {
  facture: [
    { id: 'f0', on: true, days: -3, tone: 'courtois', title: 'Rappel avant échéance',
      text: 'Bonjour {client},\n\nPetit rappel : la facture {numero} de {montant} arrive à échéance le {echeance}.\nVous pouvez la régler par virement (IBAN {iban}, référence {numero}).\n\nMerci et bonne journée,\n{entreprise}' },
    { id: 'f1', on: true, days: 1, tone: 'courtois', title: 'Première relance',
      text: 'Bonjour {client},\n\nSauf erreur de notre part, la facture {numero} de {montant}, échue le {echeance}, reste à régler ({reste} restant).\nSi le paiement est déjà parti, merci de ne pas tenir compte de ce message.\n\nCordialement,\n{entreprise}' },
    { id: 'f2', on: true, days: 8, tone: 'ferme', title: 'Deuxième relance',
      text: 'Bonjour {client},\n\nMalgré notre précédent message, la facture {numero} ({reste} restant) n’est toujours pas réglée alors qu’elle était due le {echeance}.\nMerci de procéder au paiement sous 8 jours ou de nous contacter si vous rencontrez une difficulté.\n\nCordialement,\n{entreprise}' },
    { id: 'f3', on: false, days: 20, tone: 'formel', title: 'Dernière relance avant mise en demeure',
      text: 'Bonjour {client},\n\nLa facture {numero} ({reste} restant, échue le {echeance}) demeure impayée malgré nos relances.\nSans règlement sous 8 jours, nous serons contraints d’engager une procédure de recouvrement. Des pénalités de retard sont applicables conformément à nos conditions.\n\n{entreprise}' },
  ],
  devis: [
    { id: 'd1', on: true, days: 7, tone: 'courtois', title: 'Suivi du devis',
      text: 'Bonjour {client},\n\nAvez-vous pu consulter notre devis {numero} ({montant}) ? Je reste disponible pour en parler ou l’ajuster si besoin.\n\nBonne journée,\n{entreprise}' },
    { id: 'd2', on: true, days: 21, tone: 'courtois', title: 'Dernier rappel du devis',
      text: 'Bonjour {client},\n\nNotre devis {numero} est valable jusqu’au {validite}. Souhaitez-vous que nous planifiions les travaux ?\n\nCordialement,\n{entreprise}' },
  ],
};
export const TONES = [['courtois', 'Courtois'], ['ferme', 'Ferme'], ['formel', 'Formel']];
export const VARS = ['{client}', '{numero}', '{montant}', '{reste}', '{echeance}', '{validite}', '{entreprise}', '{iban}'];

export const scenarios = (company) => {
  const s = company?.settings?.relances || {};
  return { auto: !!s.auto, facture: s.facture || DEFAULT_SCENARIOS.facture, devis: s.devis || DEFAULT_SCENARIOS.devis };
};

const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
export const remaining = (d) => Math.max(0, Number(d.totals?.net ?? d.totals?.ttc ?? 0) - Number(d.paid_amount || 0));

// Relances à faire aujourd'hui : pour chaque document, la dernière étape échue pas encore envoyée
export function dueReminders(docs, company, today = iso(new Date())) {
  const sc = scenarios(company);
  const out = [];
  for (const d of docs) {
    if (!d.number || d.status === 'annulee' || d.reminders_paused) continue;
    const sent = new Set((d.reminders || []).map((r) => r.step));
    let steps, ref;
    if (['facture', 'acompte'].includes(d.kind) && remaining(d) > 0.005 && d.due_date) { steps = sc.facture; ref = d.due_date; }
    else if (d.kind === 'devis' && d.status === 'envoye') { steps = sc.devis; ref = (d.sent_at || d.issue_date || '').slice(0, 10); }
    else continue;
    if (!ref) continue;
    const late = daysBetween(ref, today);
    const ready = steps.filter((s) => s.on && late >= s.days && !sent.has(s.id));
    if (!ready.length) continue;
    const step = ready[ready.length - 1]; // on n'envoie que la plus récente (pas de rafale)
    out.push({ d, step, late, ref, kind: d.kind === 'devis' ? 'devis' : 'facture' });
  }
  return out.sort((a, b) => b.late - a.late);
}

// Prochaine étape prévue (pour l'affichage « Prochaine relance le … »)
export function nextReminder(d, company) {
  const sc = scenarios(company);
  const steps = d.kind === 'devis' ? sc.devis : sc.facture;
  const ref = d.kind === 'devis' ? (d.sent_at || d.issue_date || '').slice(0, 10) : d.due_date;
  if (!ref) return null;
  const sent = new Set((d.reminders || []).map((r) => r.step));
  const s = steps.find((x) => x.on && !sent.has(x.id) && daysBetween(ref, iso(new Date())) < x.days);
  if (!s) return null;
  const at = new Date(ref + 'T12:00:00'); at.setDate(at.getDate() + s.days);
  return { step: s, at: iso(at) };
}

export function fillTemplate(text, d, client, company) {
  const v = {
    '{client}': client ? (client.type === 'pro' ? (client.contact_name || clientName(client)) : [client.civility, client.last_name].filter(Boolean).join(' ') || clientName(client)) : '',
    '{numero}': d.number || '', '{montant}': money(d.totals?.ttc), '{reste}': money(remaining(d)),
    '{echeance}': d.due_date ? date(d.due_date) : '',
    '{validite}': (() => { const x = new Date((d.issue_date || iso(new Date())) + 'T12:00:00'); x.setDate(x.getDate() + Number(d.validity_days || 30)); return date(iso(x)); })(),
    '{entreprise}': company.trade_name || company.name || '', '{iban}': company.iban || '—',
  };
  return Object.entries(v).reduce((s, [k, x]) => s.split(k).join(x), t(text));
}

// Envoi : message dans la messagerie Artis & You (si le client a un compte) et/ou e-mail
export async function sendReminder({ d, step, client, company, profile, text, channel }) {
  const body = text || fillTemplate(step.text, d, client, company);
  if (channel === 'app') {
    let conv = await api.one('conversations', { kind: 'client', company_id: company.id, client_id: client.id });
    if (!conv) conv = await api.insert('conversations', { kind: 'client', company_id: company.id, client_id: client.id, client_user_id: client.user_id || null });
    await api.insert('messages', { conversation_id: conv.id, sender_id: uid(), sender_name: fullName(profile) || company.name, sender_company_id: company.id, body,
      card: { type: 'relance', title: t(step.title) + ' · ' + d.number, sub: d.kind === 'devis' ? money(d.totals?.ttc) : t('{m} restant', { m: money(remaining(d)) }) } });
  } else {
    const subject = `${t(step.title)} · ${d.number} · ${company.trade_name || company.name}`;
    window.location.href = `mailto:${encodeURIComponent(client.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  const reminders = [...(d.reminders || []), { step: step.id, title: step.title, at: new Date().toISOString(), channel, by: profile.id }];
  await api.update('documents', { id: d.id }, { reminders });
  d.reminders = reminders;
}

// Envoi automatique (messagerie uniquement, clients avec compte) à l'ouverture de l'application
export async function autoReminders(company, profile) {
  if (!scenarios(company).auto) return 0;
  const [docs, clients] = await Promise.all([api.select('documents', { company_id: company.id }), api.select('clients', { company_id: company.id })]);
  const cm = Object.fromEntries(clients.map((c) => [c.id, c]));
  let n = 0;
  for (const r of dueReminders(docs, company)) {
    const c = cm[r.d.client_id];
    if (!c?.user_id) continue;
    await sendReminder({ ...r, client: c, company, profile, channel: 'app' }); n++;
  }
  return n;
}
