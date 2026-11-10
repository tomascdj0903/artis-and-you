// Actions de l'assistant côté particulier : répond sur SES données (RDV, devis à signer, factures à payer,
// chantiers, artisans) et ouvre la bonne page, sans IA. Tout passe par l'API habituelle : le particulier
// ne voit que ce que les règles de sécurité Supabase lui ouvrent (ses fiches client chez les artisans).
import { api, uid } from './api.js';
import { money, dateShort, hm } from './format.js';
import { effectiveStatus, kindLabel, ALL_TRADES } from './docs.js';
import { t } from './i18n.js';
import { nz } from './assistant-kb.js';
import { parseWhen } from './assistant-actions.js';

const has = (q, ...re) => re.some((r) => r.test(q));
const coName = (co) => co?.trade_name || co?.name || t('Artisan');
const rest = (d) => Math.max(0, Number(d.totals?.ttc || 0) - Number(d.paid_amount || 0));

// Données du particulier, gardées 30 s (l'assistant pose souvent plusieurs questions d'affilée)
let cache = null;
async function mine() {
  if (cache && cache.uid === uid() && Date.now() - cache.at < 30000) return cache;
  const clients = await api.select('clients', { user_id: uid() }).catch(() => []);
  const cids = clients.map((c) => c.id);
  const ids = [...new Set(clients.map((c) => c.company_id))];
  const [cos, appts, docs, projects] = await Promise.all([
    ids.length ? api.select('companies', { id: ids }).catch(() => []) : [],
    cids.length ? api.select('appointments', { client_id: cids }, { order: 'start_at.asc' }).catch(() => []) : [],
    cids.length ? api.select('documents', { client_id: cids }, { order: 'issue_date.desc' }).catch(() => []) : [],
    cids.length ? api.select('projects', { client_id: cids }, { order: 'created_at.desc' }).catch(() => []) : [],
  ]);
  cache = { uid: uid(), at: Date.now(), cos, cm: Object.fromEntries(cos.map((c) => [c.id, c])), appts, docs: docs.filter((d) => d.number), projects };
  return cache;
}

// Un de MES artisans cité dans la phrase (nom commercial, raison sociale ou métier)
function findCo(cos, q) {
  const ws = q.split(' ').filter((w) => w.length > 2 && !IGN.has(w) && !tradeOf(w + ' '));
  let best = null, sc = 0;
  for (const c of cos) {
    const names = nz([c.trade_name, c.name].join(' ')).split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    const s = ws.filter((w) => names.some((n) => n === w || (w.length > 4 && (n.startsWith(w.slice(0, 5)) || w.startsWith(n.slice(0, 5)))))).length;
    if (s > sc) { sc = s; best = c; }
  }
  return best;
}
const IGN = new Set(['avec', 'pour', 'mon', 'mes', 'mon', 'artisan', 'artisans', 'rdv', 'rendez', 'vous', 'ecrire', 'message', 'telephone', 'numero', 'appeler', 'appelle', 'prendre', 'demande', 'demander', 'ouvre', 'fiche', 'les', 'des', 'son', 'est', 'quel', 'quelle', 'devis', 'facture', 'factures', 'chez', 'contacter', 'joindre', 'envoyer', 'envoie', 'nouveau', 'nouvelle']);

// Métier cherché, à partir du métier ou du besoin (« fuite » → plombier)
const NEEDS = [
  [/plomb|fuite|chauffe.?eau|ballon|robinet|wc|toilette|evier|canalis|chaudiere|chauffage|radiateur|debouch/, 'Plomberie et chauffage'],
  [/electri|prise|courant|disjonct|tableau electrique|eclairage|luminaire|panne de courant/, 'Électricité'],
  [/peint|tapisser|papier peint|enduit/, 'Peinture'], [/carrel|faience|sol |parquet/, 'Carrelage'],
  [/menuis|porte|fenetre|volet|placard|escalier/, 'Menuiserie'], [/charpent/, 'Charpente'], [/toit|couvreur|couverture|tuile|gouttiere/, 'Couverture (toiture)'],
  [/macon|mur |murs|dalle|beton|fissure/, 'Maçonnerie'], [/platr|placo|cloison|faux plafond/, 'Plâtrerie'], [/serrur|cle |cles|verrou|claque|bloque dehors/, 'Serrurerie'],
  [/clim|pompe a chaleur|pac\b/, 'Climatisation'], [/vitr|carreau casse|vitre/, 'Vitrerie'], [/isol/, 'Isolation'], [/cuisin/, 'Cuisiniste'],
  [/jardin|paysag|haie|pelouse|gazon/, 'Paysage'], [/piscine/, 'Piscine'], [/terrass/, 'Terrassement'], [/elag|arbre/, 'Élagage'], [/clotur|portail/, 'Clôture et portail'],
  [/garag|mecani|carross|voiture/, 'Mécanique et carrosserie'], [/depann.*(auto|voiture)|remorqu/, 'Dépannage auto'], [/nettoy|menage/, 'Nettoyage'],
  [/demenag/, 'Déménagement'], [/informati|ordinateur|wifi|box/, 'Informatique'], [/electromenager|lave.?linge|frigo|four|lave.?vaisselle/, 'Électroménager'],
  [/ramon|cheminee/, 'Ramonage'], [/multiservice|bricol|petits travaux/, 'Multiservice'],
];
const tradeOf = (q) => NEEDS.find(([re]) => re.test(q))?.[1] || ALL_TRADES.find((x) => q.includes(nz(x)));
const cityOf = (q) => { const m = q.match(/\b(?:a|sur|vers|pres de|autour de|dans le coin de)\s+((?:saint |st |le |la |les )?[a-z-]{3,}(?: [a-z-]{3,})?)\s*$/); return m && !/^(domicile|maison|distance|partir|venir|faire)/.test(m[1]) ? m[1].replace(/\b\w/g, (c) => c.toUpperCase()) : null; };

// Pages de l'espace particulier
const PAGES = [
  [/devis/, '/client/devis', 'Mes devis'], [/factur/, '/client/factures', 'Mes factures'], [/chantier|travaux/, '/client/chantiers', 'Mes chantiers'],
  [/autres? doc|garantie|attestation|plan/, '/client/autres-docs', 'Autres docs'], [/document/, '/client/documents', 'Documents'],
  [/\brdv\b|rendez|agenda|planning/, '/client/rdv', 'Mes RDV'], [/message|conversation|discussion/, '/client/messages', 'Messages'],
  [/notif.*(regl|param)|(regl|param).*notif/, '/client/compte/notifications', 'Réglages des notifications'], [/notif/, '/client/notifications', 'Notifications'],
  [/logement|maison|appartement/, '/client/compte/logement', 'Mon logement'], [/mes artisans|mes pros/, '/client/compte/artisans', 'Mes artisans'],
  [/trouver|annuaire|chercher un|recherche/, '/client/artisans', 'Trouver un artisan'], [/profil|mes infos|mon nom|mon telephone/, '/client/compte/profil', 'Mon profil'],
  [/langue|sombre|theme|apparence/, '/client/compte/apparence', 'Langue et apparence'], [/donnees|confidential|rgpd|supprimer mon compte/, '/client/compte/donnees', 'Données et confidentialité'],
  [/aide|support/, '/client/compte/aide', 'Aide et support'], [/compte|reglage|parametre/, '/client/compte', 'Profil et réglages'], [/accueil/, '/client', 'Accueil'],
];

const apptLine = (a, cm) => `• ${dateShort(a.start_at)} ${hm(a.start_at)} — ${coName(cm[a.company_id])}${a.title ? ' · ' + a.title : ''}${a.status === 'a_valider' ? ' (' + t('en attente de confirmation') + ')' : ''}`;
const docLink = (d) => ({ label: `${d.number} · ${money(d.kind === 'devis' ? d.totals?.ttc : rest(d))}`, to: (d.kind === 'devis' ? '/client/devis/' : '/client/factures/') + d.id });

export async function runClientAction(question) {
  if (!uid()) return null;
  const q = nz(question).replace(/[’']/g, ' ').replace(/[?!.]/g, ' ').replace(/\s+/g, ' ').trim();
  const wantsOpen = /^(ouvr|affich|montre|va |vas |aller|emmene)/.test(q);

  // 1) Politesse / présentation
  if (/^(bonjour|salut|hello|coucou|bonsoir|hey)\b/.test(q) && q.split(' ').length <= 3) return { text: t('Bonjour ! Que puis-je faire pour vous ?'), sugg: CLIENT_CAPS };
  if (/^(merci|top|super|parfait|ok|d accord|cool|genial)\b/.test(q) && q.split(' ').length <= 4) return { text: t('Avec plaisir ! Autre chose ?') };
  if (/qui es.?tu|tu es qui|que (sais|peux).?tu|tu sais faire quoi|aide.?moi|comment tu marches/.test(q)) return { text: t('Je suis l’assistant Artesa. Je peux vous trouver un artisan, vous donner vos prochains rendez-vous, les devis à signer et les factures à payer, l’avancement de vos travaux, joindre un de vos artisans, et répondre à vos questions sur l’app. Essayez :'), sugg: CLIENT_CAPS };

  // 2) Question « comment… » : aide (fiches / IA), sauf « où est… » qui ouvre la page
  if (/^(comment|pourquoi|c est quoi|qu est.?ce|a quoi|puis.?je|je peux|on peut|peut.?on|est.?ce que je peux|que veut dire|ca veut dire)\b/.test(q)) return null;
  if (/^ou (est|sont|se trouve|trouver|je trouve)/.test(q)) { const p = PAGES.find(([re]) => re.test(q)); return p ? { text: t('C’est ici : {p}.', { p: t(p[2]) }), links: [{ label: p[2], to: p[1] }] } : null; }

  const d = await mine();
  const now = new Date().toISOString();
  const co = findCo(d.cos, q);

  // 3) Trouver un artisan (par métier, besoin ou ville)
  const trade = tradeOf(q);
  if (has(q, /\b(trouve|trouver|cherche|chercher|besoin|il me faut|recommande|conseille|connais|un bon|une bonne|qui peut|quelqu un)\b/) && (trade || /artisan|\bpro\b|professionnel|depanneur|ouvrier/.test(q)) && !co) {
    const city = cityOf(q);
    const p = new URLSearchParams(); if (trade) p.set('metier', trade); if (city) p.set('ville', city);
    const to = '/client/artisans' + ([...p].length ? '?' + p : '');
    return { text: trade ? t('Voici les pros en {m}{v}. Comparez les avis, puis demandez un rendez-vous.', { m: t(trade), v: city ? ' — ' + city : '' }) : t('Je vous ouvre l’annuaire des artisans : tapez le métier ou votre besoin.'), links: [{ label: 'Trouver un artisan', to }], go: to };
  }

  // 4) Prendre RDV avec un de mes artisans / avec un métier
  if (has(q, /(prendre|demander|demande|reserver|fixer|caler|planifier).*(rdv|rendez|visite|passage|intervention|creneau)|(rdv|rendez.?vous) (avec|chez)/) && !has(q, /mes |prochain|quand|demain|aujourd/)) {
    if (co) { const to = `/client/artisans/${co.id}/demande`; return { text: t('Je vous ouvre la demande de rendez-vous chez {n} : décrivez votre besoin et choisissez un créneau.', { n: coName(co) }), links: [{ label: t('Demander un RDV à {n}', { n: coName(co) }), to }], go: to }; }
    const to = '/client/artisans' + (trade ? '?metier=' + encodeURIComponent(trade) : '');
    return { text: t('Choisissez d’abord l’artisan, puis « Demander un RDV » sur sa fiche.'), links: [{ label: 'Trouver un artisan', to }, ...d.cos.slice(0, 3).map((c) => ({ label: t('Demander un RDV à {n}', { n: coName(c) }), to: `/client/artisans/${c.id}/demande` }))], go: to };
  }

  // 5) Joindre un de mes artisans : téléphone, appel, message
  if (has(q, /telephone|numero|appeler|appelle|joindre|contacter|ecrire|message|parler/) && !co && !has(q, /\b(mon|ma|mes) (numero|telephone|profil|mail)/) && /\b(de|a|au|chez) [a-z]{3,}/.test(q) && !has(q, /mon artisan|l artisan|mon (plombier|electricien|peintre|macon|menuisier)/)) {
    return { text: t('Je ne trouve pas cet artisan parmi les vôtres.') + (d.cos.length ? ' ' + t('Vos artisans :') : ''), links: d.cos.length ? d.cos.slice(0, 4).map((x) => ({ label: coName(x), to: '/client/artisans/' + x.id })) : [{ label: 'Trouver un artisan', to: '/client/artisans' }] };
  }
  if (has(q, /telephone|numero|appeler|appelle|joindre|contacter|ecrire|message|parler/) && (co || has(q, /mon artisan|mes artisans|l artisan|mon (plombier|electricien|peintre|macon|menuisier)/))) {
    const c = co || (d.cos.length === 1 ? d.cos[0] : null);
    if (!d.cos.length) return { text: t('Vous n’êtes encore en relation avec aucun artisan.'), links: [{ label: 'Trouver un artisan', to: '/client/artisans' }] };
    if (!c) return { text: t('Lequel de vos artisans ?'), links: d.cos.slice(0, 5).map((x) => ({ label: coName(x), to: '/client/artisans/' + x.id })) };
    if (has(q, /ecrire|message|parler/)) {
      const conv = (await api.select('conversations', { company_id: c.id }).catch(() => []))[0];
      const to = conv ? '/client/messages/' + conv.id : '/client/artisans/' + c.id;
      return { text: conv ? t('Je vous ouvre la conversation avec {n}.', { n: coName(c) }) : t('Touchez « Envoyer un message » sur la fiche de {n}.', { n: coName(c) }), links: [{ label: t('Écrire à {n}', { n: coName(c) }), to }], go: to };
    }
    return c.phone ? { text: t('Téléphone de {n} : {p}', { n: coName(c), p: c.phone }), links: [{ label: t('Appeler {n}', { n: coName(c) }), href: 'tel:' + c.phone.replace(/\s/g, '') }, { label: 'Sa fiche', to: '/client/artisans/' + c.id }] }
      : { text: t('{n} n’a pas indiqué de téléphone. Écrivez-lui plutôt.', { n: coName(c) }), links: [{ label: 'Sa fiche', to: '/client/artisans/' + c.id }] };
  }

  // 6) Rendez-vous
  if (has(q, /\brdv\b|rendez|vient|viennent|passe|passage|intervention|visite|agenda/) || (parseWhen(q) && !has(q, /devis|factur/))) {
    const live = d.appts.filter((a) => ['a_valider', 'valide'].includes(a.status));
    if (has(q, /attente|confirm|pas (encore )?(valide|repondu)/)) {
      const w = live.filter((a) => a.status === 'a_valider' && a.end_at >= now);
      return { text: w.length ? t('{n} demande(s) en attente de confirmation :', { n: w.length }) + '\n' + w.map((a) => apptLine(a, d.cm)).join('\n') : t('Aucune demande en attente : tout est confirmé.'), links: w.slice(0, 3).map((a) => ({ label: dateShort(a.start_at) + ' ' + hm(a.start_at), to: '/client/rdv/' + a.id })) };
    }
    const when = parseWhen(q);
    if (when) {
      const l = live.filter((a) => a.start_at >= when[0].toISOString() && a.start_at < when[1].toISOString());
      return { text: l.length ? t('Vos rendez-vous {w} :', { w: when[2] }) + '\n' + l.map((a) => apptLine(a, d.cm)).join('\n') : t('Aucun rendez-vous {w}.', { w: when[2] }), links: [...l.slice(0, 3).map((a) => ({ label: coName(d.cm[a.company_id]) + ' · ' + hm(a.start_at), to: '/client/rdv/' + a.id })), { label: 'Mes RDV', to: '/client/rdv' }] };
    }
    const next = live.filter((a) => a.end_at >= now).filter((a) => !co || a.company_id === co.id);
    if (has(q, /prochain|quand|a quelle heure|vient|passe/) || q.split(' ').length <= 4) {
      const a = next[0];
      if (!a) return { text: co ? t('Aucun rendez-vous prévu avec {n}.', { n: coName(co) }) : t('Aucun rendez-vous à venir.'), links: [{ label: 'Trouver un artisan', to: '/client/artisans' }, { label: 'Mes RDV', to: '/client/rdv' }] };
      return { text: t('Prochain rendez-vous : {d} à {h} avec {n}{s}.', { d: dateShort(a.start_at), h: hm(a.start_at), n: coName(d.cm[a.company_id]), s: a.status === 'a_valider' ? ' (' + t('en attente de confirmation') + ')' : '' }) + (next.length > 1 ? '\n' + t('Puis :') + '\n' + next.slice(1, 4).map((x) => apptLine(x, d.cm)).join('\n') : ''),
        links: [{ label: 'Voir le rendez-vous', to: '/client/rdv/' + a.id }, { label: 'Mes RDV', to: '/client/rdv' }], go: wantsOpen ? '/client/rdv/' + a.id : undefined };
    }
  }

  // 7) Devis et factures
  const num = q.match(/\b([a-z]{1,3})[ -]?(\d{4})[ -]?(\d{1,5})\b/);
  if (num) { const x = d.docs.find((v) => nz(v.number).replace(/[^a-z0-9]/g, '').includes((num[1] + num[2] + num[3]).replace(/^0+/, ''))); if (x) return { text: `${kindLabel(x.kind)} ${x.number} — ${coName(d.cm[x.company_id])} · ${money(x.totals?.ttc)}`, links: [docLink(x)], go: wantsOpen ? docLink(x).to : undefined }; }
  const toSign = d.docs.filter((x) => x.kind === 'devis' && effectiveStatus(x) === 'envoye');
  const toPay = d.docs.filter((x) => ['facture', 'acompte'].includes(x.kind) && ['envoyee', 'partielle', 'retard'].includes(effectiveStatus(x)));
  if (has(q, /a signer|signer|en attente.*devis|devis.*(attente|recu|nouveau)|nouveau devis/)) {
    return { text: toSign.length ? t('{n} devis à signer :', { n: toSign.length }) + '\n' + toSign.map((x) => `• ${x.number} — ${coName(d.cm[x.company_id])} · ${x.object || ''} · ${money(x.totals?.ttc)}`).join('\n') : t('Aucun devis à signer pour le moment.'), links: toSign.length ? toSign.slice(0, 3).map(docLink) : [{ label: 'Mes devis', to: '/client/devis' }] };
  }
  if (has(q, /a payer|payer|je dois|dois.?je|reste a|combien.*(dois|reste)|impaye|en retard|regler/)) {
    const tot = toPay.reduce((s, x) => s + rest(x), 0);
    const late = toPay.filter((x) => effectiveStatus(x) === 'retard');
    return { text: toPay.length ? t('{n} facture(s) à payer, {m} au total', { n: toPay.length, m: money(tot) }) + (late.length ? ' ' + t('(dont {n} en retard)', { n: late.length }) : '') + ' :\n' + toPay.map((x) => `• ${x.number} — ${coName(d.cm[x.company_id])} · ${money(rest(x))}${x.due_date ? ' · ' + t('échéance') + ' ' + dateShort(x.due_date) : ''}`).join('\n') : t('Vous n’avez aucune facture à payer.'), links: toPay.length ? toPay.slice(0, 3).map((x) => ({ label: t('Payer') + ' ' + x.number, to: `/client/factures/${x.id}/payer` })) : [{ label: 'Mes factures', to: '/client/factures' }] };
  }
  if (has(q, /dernier devis|derniere facture|dernier document|derniers? (devis|factures|documents)/)) {
    const kind = has(q, /devis/) ? ['devis'] : has(q, /factur/) ? ['facture', 'acompte', 'avoir'] : null;
    const x = d.docs.filter((v) => !kind || kind.includes(v.kind))[0];
    if (!x) return { text: t('Aucun document pour le moment.'), links: [{ label: 'Documents', to: '/client/documents' }] };
    return { text: `${kindLabel(x.kind)} ${x.number} — ${coName(d.cm[x.company_id])} · ${x.object || ''} · ${money(x.totals?.ttc)} · ${dateShort(x.issue_date)}`, links: [docLink(x)], go: wantsOpen ? docLink(x).to : undefined };
  }
  if (co && has(q, /devis|factur|document/)) {
    const l = d.docs.filter((v) => v.company_id === co.id && (has(q, /devis/) ? v.kind === 'devis' : has(q, /factur/) ? v.kind !== 'devis' : true));
    return { text: l.length ? t('Documents de {n} :', { n: coName(co) }) + '\n' + l.slice(0, 6).map((x) => `• ${kindLabel(x.kind)} ${x.number} · ${money(x.totals?.ttc)}`).join('\n') : t('Aucun document de {n}.', { n: coName(co) }), links: l.slice(0, 3).map(docLink) };
  }

  // 8) Travaux / chantiers
  if (has(q, /chantier|travaux|avancement|ou en (est|sont)|etape/)) {
    const ps = d.projects.filter((p) => !co || p.company_id === co.id);
    if (!ps.length) return { text: t('Aucun chantier pour le moment.'), links: [{ label: 'Mes chantiers', to: '/client/chantiers' }] };
    return { text: t('Vos chantiers :') + '\n' + ps.slice(0, 5).map((p) => `• ${p.title} — ${coName(d.cm[p.company_id])}${p.finished_at ? ' · ' + t('terminé') : ''}`).join('\n'), links: ps.slice(0, 3).map((p) => ({ label: p.title, to: '/client/chantiers/' + p.id })), go: wantsOpen && ps.length === 1 ? '/client/chantiers/' + ps[0].id : undefined };
  }

  // 9) Mes artisans
  if (has(q, /mes artisans|mes pros|avec qui|quels artisans|combien d artisans/)) {
    return { text: d.cos.length ? t('Vos artisans :') + '\n' + d.cos.map((c) => `• ${coName(c)}${(c.trades || [])[0] ? ' · ' + t(c.trades[0]) : ''}`).join('\n') : t('Vous n’êtes encore en relation avec aucun artisan.'), links: d.cos.length ? d.cos.slice(0, 4).map((c) => ({ label: coName(c), to: '/client/artisans/' + c.id })) : [{ label: 'Trouver un artisan', to: '/client/artisans' }] };
  }
  if (has(q, /non lu|pas lu|nouveaux? messages?|nouvelles? notif/)) return { text: t('Vos messages et notifications non lus sont signalés par une pastille rouge.'), links: [{ label: 'Messages', to: '/client/messages' }, { label: 'Notifications', to: '/client/notifications' }] };

  // 10) Aller sur une page
  if (wantsOpen || /^(mes|mon|ma|les|la|le) [a-z ]{3,30}$/.test(q) || (/^[a-z ]{3,25}$/.test(q) && PAGES.some(([re]) => re.test(q)))) {
    if (co && wantsOpen) return { text: t('Voici la fiche de {n}.', { n: coName(co) }), links: [{ label: coName(co), to: '/client/artisans/' + co.id }], go: '/client/artisans/' + co.id };
    const p = PAGES.find(([re]) => re.test(q));
    if (p) return { text: wantsOpen ? t('Je vous ouvre : {p}.', { p: t(p[2]) }) : t('C’est par ici :'), links: [{ label: p[2], to: p[1] }], go: p[1] };
  }
  // 11) Un de mes artisans cité seul
  if (co && q.split(' ').length <= 4) return { text: t('Voici la fiche de {n}.', { n: coName(co) }), links: [{ label: coName(co), to: '/client/artisans/' + co.id }, { label: t('Demander un RDV à {n}', { n: coName(co) }), to: `/client/artisans/${co.id}/demande` }] };
  // Un métier ou un besoin seul (« plombier », « fuite d'eau ») → l'annuaire
  if (trade && q.split(' ').length <= 9) { const to = '/client/artisans?metier=' + encodeURIComponent(trade); return { text: t('Voici les pros en {m}{v}. Comparez les avis, puis demandez un rendez-vous.', { m: t(trade), v: '' }), links: [{ label: 'Trouver un artisan', to }] }; }
  return null;
}

export const CLIENT_CAPS = [
  { id: 'k1', q: 'Mon prochain rendez-vous' }, { id: 'k2', q: 'Devis à signer' }, { id: 'k3', q: 'Factures à payer' },
  { id: 'k4', q: 'Trouver un plombier' }, { id: 'k5', q: 'Où en sont mes travaux ?' }, { id: 'k6', q: 'Téléphone de mon artisan' },
];
