// Base locale (navigateur) qui imite Supabase : sert aux tests hors-ligne.
// Elle reproduit les tables, les fonctions (RPC) et les déclencheurs principaux, sans la sécurité serveur.
const KEY = 'ay-local-db';
const TABLES = ['profiles', 'companies', 'teams', 'company_invites', 'clients', 'projects', 'project_shares', 'items', 'documents', 'payments', 'purchases', 'appointments', 'files', 'conversations', 'messages', 'conversation_reads', 'network', 'network_requests', 'ratings', 'reviews', 'notifications', '_users'];
const id = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now());
const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

import { ADMIN_EMAILS } from './api.js';
import { newSecret, checkTotp, otpauthUri } from './security.js';
export function mockBackend({ saveSession, getSession }) {
  // Stockage dans IndexedDB : les tables dans « kv », les fichiers (photos, PDF) dans « blobs ».
  // Chaque modification attend que l'écriture soit terminée : rien n'est perdu si on ferme la fenêtre.
  let db = {};
  let pendingMfa = null;
  let conn = null;
  const idb = () => conn || (conn = new Promise((res, rej) => {
    const r = indexedDB.open('artis-and-you', 2);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const req = (q) => new Promise((res, rej) => { q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  const done = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = tx.onabort = () => rej(tx.error); });
  const ready = (async () => {
    try {
      const d = await idb();
      db = (await req(d.transaction('kv').objectStore('kv').get(KEY))) || JSON.parse(localStorage.getItem(KEY) || '{}');
      if (db._blobs?.length) { const tx = d.transaction('blobs', 'readwrite'); db._blobs.forEach((b) => tx.objectStore('blobs').put(b.data, b.path)); await done(tx); }
    } catch { try { db = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { db = {}; } }
    delete db._blobs;
    TABLES.forEach((t) => { db[t] = db[t] || []; });
  })();
  const persist = async () => {
    try { const d = await idb(); const tx = d.transaction('kv', 'readwrite'); tx.objectStore('kv').put(db, KEY); await done(tx); try { localStorage.removeItem(KEY); } catch {} }
    catch (e) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { console.warn('stockage local plein', e); } }
  };
  const blobPut = async (path, data) => { const d = await idb(); const tx = d.transaction('blobs', 'readwrite'); tx.objectStore('blobs').put(data, path); await done(tx); };
  const blobGet = async (path) => { try { const d = await idb(); return await req(d.transaction('blobs').objectStore('blobs').get(path)); } catch { return null; } };
  const blobDel = async (path) => { try { const d = await idb(); const tx = d.transaction('blobs', 'readwrite'); tx.objectStore('blobs').delete(path); await done(tx); } catch {} };
  const me = () => getSession()?.user?.id;
  const profile = () => db.profiles.find((p) => p.id === me());
  const myCompany = () => profile()?.company_id || null;
  const isAdmin = () => ADMIN_EMAILS.includes(String(profile()?.email || '').toLowerCase());
  const myClientIds = () => db.clients.filter((c) => c.user_id === me()).map((c) => c.id);
  const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 40));
  const fail = (m) => Promise.reject(new Error(m));

  const defaults = {
    profiles: { kind: 'particulier', first_name: '', last_name: '', phone: '', lang: 'fr', theme: 'light', member_role: 'gerant', permissions: { planning: true, clients: true, devis: true, prix: true, kpi: true }, home: {}, notif_prefs: {}, privacy: {} },
    companies: { trades: [], settings: {}, counters: {}, accountant: {}, plan: 'solo', vat_regime: 'normal', visible_particuliers: true, visible_pros: true, verified: false, insurance_coverage: 'France métropolitaine' },
    clients: { type: 'particulier', status: 'actif', payment_terms: '30 jours fin de mois', payment_mode: 'Virement', max_outstanding: 0, note: '' },
    documents: { status: 'brouillon', lines: [], totals: {}, conditions: {}, paid_amount: 0, locked: false, validity_days: 30, intervention_type: 'Chantier', operations_nature: 'Biens et services', vat_on_debits: false, reverse_charge: false, deposit_pct: 0, issue_date: today() },
    appointments: { status: 'a_valider', mode: 'site', recurrence: 'none', personal: false, type: 'Chantier' },
    files: { doc_type: 'autre', shared_with_client: false, shared_with_pros: false, remind_days: 15 },
    items: { kind: 'article', trades: [], unit: 'pièce', purchase_price: 0, coef: 1, sale_price: 0, vat_rate: 20, components: [] },
    messages: { attachments: [], body: '' },
    reviews: { status: 'en_attente' },
    notifications: { read: false, category: 'rdv' },
    projects: { manual: {} },
    teams: { color: '#2B1F1C' },
  };

  function match(row, filters = {}) {
    for (const [k0, v] of Object.entries(filters)) {
      if (v === undefined) continue;
      const m = k0.match(/^(.*?)(>=|<=|>|<|!=|~)?$/);
      const k = m[1], op = m[2], x = row[k];
      if (op === '>=') { if (!(x >= v)) return false; }
      else if (op === '<=') { if (!(x <= v)) return false; }
      else if (op === '>') { if (!(x > v)) return false; }
      else if (op === '<') { if (!(x < v)) return false; }
      else if (op === '!=') { if (v === null ? x == null : x === v) return false; }
      else if (op === '~') { if (!String(x || '').toLowerCase().includes(String(v).toLowerCase())) return false; }
      else if (v === null) { if (x != null) return false; }
      else if (Array.isArray(v)) { if (!v.includes(x)) return false; }
      else if (x !== v) return false;
    }
    return true;
  }
  function sort(rows, order) {
    if (!order) return rows;
    const parts = order.split(',').map((p) => { const [c, d] = p.split('.'); return [c, d === 'desc' ? -1 : 1]; });
    return rows.sort((a, b) => { for (const [c, d] of parts) { if (a[c] < b[c]) return -d; if (a[c] > b[c]) return d; } return 0; });
  }
  function notify(userId, category, title, body, link) {
    if (!userId) return;
    db.notifications.push({ id: id(), user_id: userId, category, title, body, link, read: false, created_at: now() });
  }
  function notifyCompany(cid, cat, title, body, link) { db.profiles.filter((p) => p.company_id === cid).forEach((p) => notify(p.id, cat, title, body, link)); }
  const fmtDT = (s) => new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  // Déclencheurs
  function afterInsert(table, row) {
    if (table === 'messages') {
      const c = db.conversations.find((x) => x.id === row.conversation_id);
      if (c) {
        c.last_message = (row.card?.type === 'demande' ? '📅 ' + row.card.title + (row.body ? ' · ' + row.body : '') : row.body || (row.card ? row.card.title : (row.attachments || []).some((a) => a.kind === 'voice' || /^audio\//.test(a.mime || '')) ? '🎤 Message vocal' : (row.attachments || []).some((a) => /^image\//.test(a.mime || '')) ? '📷 Photo' : '📎 Pièce jointe')).slice(0, 140); c.last_at = row.created_at;
        if (row.sender_id) { const r = db.conversation_reads.find((x) => x.conversation_id === c.id && x.user_id === row.sender_id); if (r) { if (!r.last_read_at || r.last_read_at < row.created_at) r.last_read_at = row.created_at; } else db.conversation_reads.push({ conversation_id: c.id, user_id: row.sender_id, last_read_at: row.created_at }); }
        if (c.client_user_id && c.client_user_id !== row.sender_id) notify(c.client_user_id, 'message', 'Nouveau message', `${row.sender_name} : ${(row.body || row.card?.title || '📎').slice(0, 80)}`, '/client/messages/' + c.id);
      }
    }
    if (table === 'payments') syncPaid(row.document_id);
    if (table === 'appointments') {
      const cl = db.clients.find((c) => c.id === row.client_id);
      if (cl?.user_id && cl.user_id !== me()) notify(cl.user_id, 'rdv', 'Nouveau RDV', `${row.title} · ${fmtDT(row.start_at)}`, '/client/rdv/' + row.id);
    }
  }
  function afterUpdate(table, oldRow, row) {
    if (table === 'appointments' && (oldRow.start_at !== row.start_at || oldRow.end_at !== row.end_at)) {
      row.history = [...(row.history || []), { at: now(), kind: 'moved', from: oldRow.start_at, from_end: oldRow.end_at, to: row.start_at, to_end: row.end_at, by: me() }];
      const cl = db.clients.find((c) => c.id === row.client_id);
      if (cl && !row.personal) {
        let c = db.conversations.find((x) => x.kind === 'client' && x.company_id === row.company_id && x.client_id === cl.id);
        if (!c) { c = { id: id(), kind: 'client', company_id: row.company_id, client_id: cl.id, client_user_id: cl.user_id || null, last_message: '', last_at: now(), created_at: now() }; db.conversations.push(c); }
        const co = db.companies.find((x) => x.id === row.company_id);
        const m = { id: id(), conversation_id: c.id, sender_id: me(), sender_name: co?.name || '', sender_company_id: row.company_id, body: `Votre rendez-vous « ${row.title} » a été déplacé du ${fmtDT(oldRow.start_at)} au ${fmtDT(row.start_at)}.`, card: { type: 'rdv_change', title: 'RDV déplacé', sub: fmtDT(row.start_at), appointment_id: row.id }, attachments: [], created_at: now() };
        db.messages.push(m); c.last_message = ('📅 RDV déplacé · ' + fmtDT(row.start_at)); c.last_at = m.created_at;
      }
    }
    if (table === 'appointments') {
      const cl = db.clients.find((c) => c.id === row.client_id);
      const u = cl?.user_id;
      if (u && u !== me()) {
        // Ce qui a changé (date, heure, équipe, visio / sur site, adresse) : une seule notification qui liste tout
        const d0 = new Date(oldRow.start_at), d1 = new Date(row.start_at);
        const ch = [];
        if (d0.toDateString() !== d1.toDateString()) ch.push('date : ' + d1.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
        if (d0.toTimeString().slice(0, 5) !== d1.toTimeString().slice(0, 5) || oldRow.end_at !== row.end_at) ch.push('heure : ' + d1.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '–' + new Date(row.end_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
        if ((oldRow.team_id || null) !== (row.team_id || null)) ch.push('équipe : ' + (db.teams.find((x) => x.id === row.team_id)?.name || '—'));
        if (oldRow.mode !== row.mode) ch.push(row.mode === 'visio' ? 'en visio (WhatsApp)' : 'sur site');
        if ((oldRow.address || '') !== (row.address || '') && row.mode !== 'visio') ch.push('adresse : ' + row.address);
        const detail = ch.length ? ' · ' + ch.join(' · ') : '';
        if (row.status !== oldRow.status) notify(u, 'rdv', { valide: ch.length ? 'RDV confirmé (modifié)' : 'RDV confirmé', refuse: 'RDV refusé', annule: 'RDV annulé', termine: 'Intervention terminée' }[row.status] || 'RDV mis à jour', `${row.title} · ${fmtDT(row.start_at)}${row.status === 'valide' ? detail : ''}`, '/client/rdv/' + row.id);
        else if (ch.length) notify(u, 'rdv', 'RDV modifié', `${row.title}${detail}`, '/client/rdv/' + row.id);
        else if (row.enroute_at && row.enroute_at !== oldRow.enroute_at) notify(u, 'rdv', 'Votre artisan est en route', row.eta_at ? 'Arrivée prévue vers ' + new Date(row.eta_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '', '/client/rdv/' + row.id + '?enroute=1');
      }
    }
    if (table === 'documents') {
      const cl = db.clients.find((c) => c.id === row.client_id);
      if (cl?.user_id && row.status === 'payee' && oldRow.status !== 'payee') notify(cl.user_id, 'paiement', 'Paiement enregistré', row.number, '/client/factures/' + row.id);
    }
  }
  function syncPaid(docId) {
    const d = db.documents.find((x) => x.id === docId); if (!d) return;
    const paid = db.payments.filter((p) => p.document_id === docId).reduce((s, p) => s + Number(p.amount), 0);
    const old = { ...d };
    d.paid_amount = paid;
    const total = Number(d.totals?.ttc || 0);
    if (paid >= total - 0.005 && total > 0) d.status = 'payee'; else if (paid > 0) d.status = 'partielle';
    afterUpdate('documents', old, d);
  }

  function ensureClient(companyId) {
    let c = db.clients.find((x) => x.company_id === companyId && x.user_id === me());
    if (c) return c.id;
    const p = profile();
    c = db.clients.find((x) => x.company_id === companyId && !x.user_id && x.email && String(x.email).toLowerCase() === String(p.email).toLowerCase());
    if (c) { c.user_id = me(); return c.id; }
    const n = db.clients.filter((x) => x.company_id === companyId).length + 1;
    c = { ...defaults.clients, id: id(), company_id: companyId, user_id: me(), number: 'CL-' + String(n).padStart(5, '0'), last_name: p.last_name, first_name: p.first_name, email: p.email, mobile: p.phone,
      billing_address: p.home?.address || '', billing_zip: p.home?.zip || '', billing_city: p.home?.city || '', site_address: p.home?.address || '', site_zip: p.home?.zip || '', site_city: p.home?.city || '', created_at: now() };
    db.clients.push(c);
    return c.id;
  }
  const reviewsOf = (cid) => db.reviews.filter((r) => r.company_id === cid && r.status === 'publie');
  const avg = (rs) => (rs.length ? Math.round((rs.reduce((s, r) => s + r.rating, 0) / rs.length) * 10) / 10 : null);

  function visible(table, r) {
    const mc = myCompany(), mine = myClientIds();
    const convOk = (c) => c && ((mc && (c.company_id === mc || c.other_company_id === mc)) || c.client_user_id === me());
    switch (table) {
      case 'conversations': return convOk(r);
      case 'messages': return convOk(db.conversations.find((c) => c.id === r.conversation_id));
      case 'notifications': case 'conversation_reads': return r.user_id === me();
      case 'clients': return r.company_id === mc || r.user_id === me();
      case 'documents': return r.company_id === mc || (r.number && mine.includes(r.client_id));
      case 'appointments': case 'projects': return r.company_id === mc || mine.includes(r.client_id);
      case 'files': return r.company_id === mc || (mine.includes(r.client_id) && (r.shared_with_client || r.kind === 'photo')) || (r.kind === 'vault' && r.shared_with_client && db.clients.some((c) => c.user_id === me() && c.company_id === r.company_id));
      case 'payments': case 'purchases': case 'items': case 'teams': case 'company_invites': case 'network': return r.company_id === mc;
      case 'network_requests': return r.from_company === mc || r.to_company === mc;
      case 'ratings': return r.author_company === mc;
      case 'project_shares': return r.company_id === mc || db.projects.some((p) => p.id === r.project_id && p.company_id === mc);
      case 'profiles': return r.id === me() || (mc && r.company_id === mc);
      default: return true;
    }
  }
  const rpcs = {
    is_admin() { return isAdmin(); },
    admin_review_company({ p_id, p_status, p_note = '' }) {
      if (!isAdmin()) throw new Error('Réservé à l’équipe Artesa.');
      const c = db.companies.find((x) => x.id === p_id); if (!c) throw new Error('Entreprise introuvable');
      Object.assign(c, { verification_status: p_status, verified: p_status === 'approved', verification_note: p_note, verified_at: now() });
      notifyCompany(c.id, 'systeme', p_status === 'approved' ? 'Votre entreprise est validée' : 'Votre inscription est à compléter', p_status === 'approved' ? 'Votre profil est maintenant visible des clients.' : p_note, '/pro/compte/entreprise');
      return c;
    },
    // Après une demande de compléments : le gérant renvoie son dossier à l'équipe
    calendar_token({ p_reset } = {}) {
      const c = db.companies.find((x) => x.id === myCompany()); if (!c) throw new Error('Réservé aux entreprises');
      if (!c.calendar_token || p_reset) c.calendar_token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
      return c.calendar_token;
    },
    resubmit_company() {
      const c = db.companies.find((x) => x.id === myCompany()); if (!c) throw new Error('Entreprise introuvable');
      if (c.verification_status !== 'rejected') return c;
      Object.assign(c, { verification_status: 'pending' });
      db.profiles.filter((x) => ADMIN_EMAILS.includes(String(x.email).toLowerCase())).forEach((x) => notify(x.id, 'systeme', 'Dossier complété à revalider', c.name + ' · SIRET ' + c.siret, '/' + (x.company_id ? 'pro' : 'client') + '/admin'));
      return c;
    },
    create_company({ p }) {
      if (myCompany()) throw new Error('Vous avez déjà une entreprise');
      const sir = String(p.siret || '').replace(/\D/g, '');
      if (sir && db.companies.some((c) => String(c.siret || '').replace(/\D/g, '') === sir)) throw new Error('Ce SIRET est déjà utilisé par une entreprise inscrite sur Artesa. Connectez-vous avec le compte existant ou contactez-nous.');
      let ref = p.referral ? db.companies.find((c) => c.referral_code === p.referral.toUpperCase()) : null;
      if (ref && db.companies.filter((c) => c.referred_by === ref.id).length >= 10) ref = null;
      if (ref) { ref.trial_ends_at = new Date(Math.max(Date.now(), +new Date(ref.trial_ends_at || 0)) + 15 * 864e5).toISOString(); notifyCompany(ref.id, 'systeme', 'Parrainage réussi 🎁', p.name + ' a rejoint Artesa avec votre code : 15 jours offerts pour vous.', '/pro/compte/abonnement'); }
      const c = { ...defaults.companies, id: id(), owner_id: me(), name: p.name, siret: p.siret || '', siren: (p.siret || '').replace(/\D/g, '').slice(0, 9), trades: p.trades || [], city: p.city || '', zip: p.zip || '', address: p.address || '', country: p.country || 'France', legal_form: p.legal_form || '', phone: p.phone || '', email: p.email || '', verification_status: 'pending', verified: false,
        referred_by: ref?.id || null, referral_code: Math.random().toString(36).slice(2, 10).toUpperCase(), trial_ends_at: new Date(Date.now() + (ref ? 60 : 30) * 864e5).toISOString(), created_at: now(),
        settings: { planning: { view: 'week', hours: [7, 19], weekend: false, colorBy: 'team', days: [1, 2, 3, 4, 5, 6], slot: [8, 18], duration: 60, manual: true, reminder: 24, visio: true }, docs: { quotePrefix: 'DE', invoicePrefix: 'FA', creditPrefix: 'AV', vat: 20, validity: 30, paymentTerms: '30 jours fin de mois', penalties: "3 fois le taux d'intérêt légal", discount: 'Aucun pour paiement anticipé', onlinePayment: true, einvoice: true }, pdf: { color: '#B4432A', footer: '' }, notifications: { push: true, email: true, sms: false } } };
      db.companies.push(c);
      Object.assign(profile(), { kind: 'artisan', company_id: c.id, member_role: 'gerant' });
      db.teams.push({ id: id(), company_id: c.id, name: 'Équipe principale', color: '#2B1F1C', created_at: now() });
      db.profiles.filter((x) => ADMIN_EMAILS.includes(String(x.email).toLowerCase())).forEach((x) => notify(x.id, 'systeme', 'Nouvelle entreprise à valider', c.name + ' · SIRET ' + c.siret, '/' + (x.company_id ? 'pro' : 'client') + '/admin'));
      return c;
    },
    join_company({ p_code }) {
      const i = db.company_invites.find((x) => x.code === String(p_code).toUpperCase() && !x.used_by);
      if (!i) throw new Error('Code invalide ou déjà utilisé');
      const perms = { ouvrier: { planning: true, clients: false, devis: false, prix: false, kpi: false }, chef: { planning: true, clients: true, devis: true, prix: true, kpi: false } }[i.member_role] || defaults.profiles.permissions;
      Object.assign(profile(), { kind: 'artisan', company_id: i.company_id, member_role: i.member_role, team_id: i.team_id, permissions: perms });
      i.used_by = me();
      return i.company_id;
    },
    finalize_document({ p_id }) {
      const d = db.documents.find((x) => x.id === p_id);
      if (!d || d.company_id !== myCompany()) throw new Error('Document introuvable');
      if (d.number) return d;
      const c = db.companies.find((x) => x.id === d.company_id);
      const cl = db.clients.find((x) => x.id === d.client_id);
      const docs = c.settings?.docs || {};
      const prefix = d.kind === 'devis' ? docs.quotePrefix || 'DE' : d.kind === 'avoir' ? docs.creditPrefix || 'AV' : docs.invoicePrefix || 'FA';
      const key = prefix + '-' + (d.issue_date || today()).slice(0, 4);
      const n = (c.counters[key] || 0) + 1;
      c.counters[key] = n;
      const { counters, settings, ...snapC } = c;
      Object.assign(d, { number: key + '-' + String(n).padStart(4, '0'), status: d.kind === 'devis' ? 'envoye' : 'envoyee', sent_at: now(), locked: d.kind !== 'devis', snapshot: { company: snapC, client: cl } });
      if (cl?.user_id) notify(cl.user_id, 'documents', d.kind === 'devis' ? 'Nouveau devis à signer' : d.kind === 'avoir' ? 'Nouvel avoir' : 'Nouvelle facture', d.number + ' · ' + (d.object || ''), (d.kind === 'devis' ? '/client/devis/' : '/client/factures/') + d.id);
      return d;
    },
    directory_search({ p_query = '', p_trade = '', p_city = '' }) {
      const q = p_query.toLowerCase(), t = p_trade.toLowerCase(), ci = p_city.toLowerCase();
      return db.companies.filter((c) => (c.verification_status === 'approved' || c.verified) && (c.visible_particuliers || myCompany()) &&
        (!q || (c.name + ' ' + (c.trade_name || '') + ' ' + c.trades.join(' ')).toLowerCase().includes(q)) &&
        (!t || c.trades.join(' ').toLowerCase().includes(t)) && (!ci || (c.city + ' ' + (c.zone || '')).toLowerCase().includes(ci)))
        .map((c) => ({ id: c.id, name: c.name, trade_name: c.trade_name, city: c.city, zip: c.zip, trades: c.trades, zone: c.zone, verified: c.verified, rating: avg(reviewsOf(c.id)), reviews_count: reviewsOf(c.id).length, visio: c.settings?.planning?.visio !== false, zone_lat: c.zone_lat, zone_lon: c.zone_lon, zone_km: c.zone_km, is_mine: db.clients.some((x) => x.company_id === c.id && x.user_id === me()), logo_path: c.logo_path }));
    },
    directory_get({ p_id }) {
      const c = db.companies.find((x) => x.id === p_id); if (!c) return null;
      const rs = reviewsOf(c.id);
      const distribution = {}; [1, 2, 3, 4, 5].forEach((s) => { distribution[s] = rs.filter((r) => r.rating === s).length; });
      return { ...c, planning: c.settings?.planning, rating: avg(rs), distribution, reviews: rs.slice().reverse().map((r) => ({ rating: r.rating, comment: r.comment, author: r.author_label, reply: r.reply, created_at: r.created_at })), photos: db.files.filter((f) => f.company_id === c.id && f.kind === 'photo' && f.shared_with_pros).map((f) => f.path) };
    },
    busy_slots({ p_company, p_from, p_to }) {
      return db.appointments.filter((a) => a.company_id === p_company && ['a_valider', 'valide'].includes(a.status) && a.start_at < p_to && a.end_at > p_from).map((a) => ({ start_at: a.start_at, end_at: a.end_at }));
    },
    ensure_client({ p_company }) { return ensureClient(p_company); },
    request_appointment({ p }) {
      const cid = ensureClient(p.company_id); const prof = profile();
      const pid = id();
      db.projects.push({ id: pid, company_id: p.company_id, client_id: cid, title: p.title || p.type, address: [prof.home?.address, prof.home?.city].filter(Boolean).join(' '), manual: {}, created_at: now() });
      const aid = id();
      db.appointments.push({ ...defaults.appointments, id: aid, company_id: p.company_id, client_id: cid, project_id: pid, type: p.type, title: p.title || p.type, start_at: p.start_at, end_at: p.end_at, mode: p.mode || 'site', status: 'a_valider', request_text: p.text || '', photos: p.photos || [],
        address: [prof.home?.address, [prof.home?.zip, prof.home?.city].filter(Boolean).join(' ')].filter(Boolean).join(', '), contact_name: `${prof.first_name} ${prof.last_name}`.trim(), contact_phone: prof.phone, requested_by: me(), created_at: now() });
      let conv = db.conversations.find((c) => c.kind === 'client' && c.company_id === p.company_id && c.client_user_id === me());
      if (!conv) { conv = { id: id(), kind: 'client', company_id: p.company_id, client_id: cid, client_user_id: me(), project_id: pid, last_message: '', last_at: now(), created_at: now() }; db.conversations.push(conv); }
      // La demande apparaît comme une carte « Demande de RDV envoyée » dans la conversation
      const when = fmtDT(p.start_at);
      const m = { ...defaults.messages, id: id(), conversation_id: conv.id, sender_id: me(), sender_name: `${prof.first_name} ${prof.last_name}`.trim(), body: p.text || '', attachments: p.photos || [], card: { type: 'demande', title: 'Demande de RDV envoyée', sub: `${p.type} · ${when}${p.mode === 'visio' ? ' · visio' : ''}`, appointment_id: aid }, created_at: now() };
      db.messages.push(m); afterInsert('messages', m);
      notifyCompany(p.company_id, 'rdv', 'Nouvelle demande de RDV', `${prof.first_name} ${prof.last_name} · ${p.type} · ${when}`, '/pro/planning/rdv/' + aid);
      // Confirmation d'envoi pour le particulier
      const co = db.companies.find((c) => c.id === p.company_id);
      notify(me(), 'rdv', 'Demande envoyée', `${co?.trade_name || co?.name || ''} · ${p.type} · ${when} · en attente de confirmation`, '/client/rdv/' + aid);
      return aid;
    },
    start_conversation({ p_company }) {
      const mine = myCompany();
      if (mine) {
        let c = db.conversations.find((x) => x.kind === 'pro' && ((x.company_id === mine && x.other_company_id === p_company) || (x.company_id === p_company && x.other_company_id === mine)));
        if (!c) { c = { id: id(), kind: 'pro', company_id: mine, other_company_id: p_company, last_message: '', last_at: now(), created_at: now() }; db.conversations.push(c); }
        return c.id;
      }
      const cid = ensureClient(p_company);
      let c = db.conversations.find((x) => x.kind === 'client' && x.company_id === p_company && x.client_user_id === me());
      if (!c) { c = { id: id(), kind: 'client', company_id: p_company, client_id: cid, client_user_id: me(), last_message: '', last_at: now(), created_at: now() }; db.conversations.push(c); }
      return c.id;
    },
    client_appointment_action({ p_id, p_action, p = {} }) {
      const a = db.appointments.find((x) => x.id === p_id && myClientIds().includes(x.client_id));
      if (!a) throw new Error('RDV introuvable');
      if (p_action === 'cancel') { a.status = 'annule'; notifyCompany(a.company_id, 'rdv', 'RDV annulé par le client', a.title, '/pro/planning/rdv/' + a.id); }
      if (p_action === 'move') { Object.assign(a, { start_at: p.start_at, end_at: p.end_at, status: 'a_valider' }); notifyCompany(a.company_id, 'rdv', 'Le client propose un autre créneau', a.title, '/pro/planning/rdv/' + a.id); }
    },
    client_quote_action({ p_id, p_action, p_reason = '' }) {
      const d = db.documents.find((x) => x.id === p_id && myClientIds().includes(x.client_id));
      if (!d) throw new Error('Devis introuvable');
      if (p_action === 'refuse') { Object.assign(d, { status: 'refuse', refused_at: now() }); d.conditions = { ...d.conditions, refusal_reason: p_reason }; notifyCompany(d.company_id, 'documents', 'Devis refusé', d.number, '/pro/documents/' + d.id); }
    },
    async client_quote_sign({ p_id, p_name, p_image = '', p_agent = '' }) {
      const d = db.documents.find((x) => x.id === p_id && x.kind === 'devis' && x.number && myClientIds().includes(x.client_id));
      if (!d) throw new Error('Devis introuvable');
      if (d.status !== 'envoye') throw new Error('Ce devis ne peut plus être signé.');
      if (!String(p_name || '').trim()) throw new Error('Indiquez votre nom.');
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode((d.number || '') + JSON.stringify(d.lines) + JSON.stringify(d.totals)));
      const hash = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
      Object.assign(d, { status: 'accepte', accepted_at: now(), signed_name: p_name.trim() });
      d.conditions = { ...d.conditions, signature: { image: p_image, at: now(), by: me(), hash, agent: p_agent, mention: 'Bon pour accord' } };
      notifyCompany(d.company_id, 'documents', 'Devis signé', d.number + ' · ' + p_name.trim(), '/pro/documents/' + d.id);
    },
    network_request({ p_to, p_message = '' }) {
      const mc = myCompany(); if (!mc || p_to === mc) throw new Error('Demande impossible');
      if (db.network.some((n) => n.company_id === mc && n.pro_id === p_to)) return 'connected';
      const rev = db.network_requests.find((r) => r.from_company === p_to && r.to_company === mc && r.status === 'pending');
      if (rev) { rpcs.network_answer({ p_id: rev.id, p_accept: true }); return 'connected'; }
      let r = db.network_requests.find((x) => x.from_company === mc && x.to_company === p_to);
      if (r) Object.assign(r, { status: 'pending', message: p_message, created_at: now() });
      else db.network_requests.push({ id: id(), from_company: mc, to_company: p_to, status: 'pending', message: p_message, created_at: now() });
      const co = db.companies.find((c) => c.id === mc);
      notifyCompany(p_to, 'systeme', 'Demande de connexion', `${co?.trade_name || co?.name} veut rejoindre votre réseau`, '/pro/reseau?demandes=1');
      return 'pending';
    },
    network_answer({ p_id, p_accept }) {
      const mc = myCompany(); const r = db.network_requests.find((x) => x.id === p_id && x.to_company === mc && x.status === 'pending');
      if (!r) throw new Error('Demande introuvable');
      r.status = p_accept ? 'accepted' : 'declined'; r.answered_at = now();
      if (p_accept) {
        [[r.from_company, r.to_company], [r.to_company, r.from_company]].forEach(([a, b]) => { if (!db.network.some((n) => n.company_id === a && n.pro_id === b)) db.network.push({ id: id(), company_id: a, pro_id: b, created_at: now() }); });
        const co = db.companies.find((c) => c.id === mc);
        notifyCompany(r.from_company, 'systeme', 'Demande acceptée', `${co?.trade_name || co?.name} fait maintenant partie de votre réseau`, '/pro/reseau/' + mc);
      }
    },
    network_remove({ p_pro }) { const mc = myCompany(); db.network = db.network.filter((n) => !((n.company_id === mc && n.pro_id === p_pro) || (n.company_id === p_pro && n.pro_id === mc))); },
    network_requests_list() {
      const mc = myCompany();
      return db.network_requests.filter((r) => r.from_company === mc || r.to_company === mc).map((r) => { const o = db.companies.find((c) => c.id === (r.from_company === mc ? r.to_company : r.from_company)) || {}; return { id: r.id, status: r.status, created_at: r.created_at, message: r.message, incoming: r.to_company === mc, company: { id: o.id, name: o.name || '', trade_name: o.trade_name, city: o.city, trades: o.trades || [], logo_path: o.logo_path } }; });
    },
    shared_projects() {
      const mc = myCompany();
      const ids = new Set([...db.projects.filter((p) => p.company_id === mc).map((p) => p.id).filter((pid) => db.project_shares.some((s) => s.project_id === pid && s.status !== 'pending')), ...db.project_shares.filter((s) => s.company_id === mc && s.status !== 'pending').map((s) => s.project_id)]);
      return [...ids].map((pid) => { const p = db.projects.find((x) => x.id === pid); if (!p) return null; const cids = [p.company_id, ...db.project_shares.filter((s) => s.project_id === pid && s.status !== 'pending').map((s) => s.company_id)]; return { id: p.id, title: p.title, address: p.address, owner: p.company_id, members: [...new Set(cids)].map((c) => { const co = db.companies.find((x) => x.id === c) || {}; return { id: c, name: co.trade_name || co.name || '', trades: co.trades || [] }; }) }; }).filter(Boolean);
    },
    shared_project_planning({ p_project, p_from, p_to }) {
      const mc = myCompany(); const sp = rpcs.shared_projects().find((x) => x.id === p_project); if (!sp) return [];
      return db.appointments.filter((a) => a.project_id === p_project && sp.members.some((m) => m.id === a.company_id) && a.end_at >= p_from && a.start_at <= p_to && !['annule', 'refuse'].includes(a.status)).map((a) => { const m = sp.members.find((x) => x.id === a.company_id); return { id: a.id, title: a.title, start_at: a.start_at, end_at: a.end_at, status: a.status, company: m.name, trades: m.trades, company_id: a.company_id, mine: a.company_id === mc }; });
    },
    rate_pro({ p_company, p_rating, p_comment = '' }) {
      const mc = myCompany();
      if (mc) {
        const worked = rpcs.shared_projects().some((p) => p.members.some((m) => m.id === p_company)) && p_company !== mc;
        if (!worked) throw new Error('Vous pourrez noter ce pro après avoir travaillé ensemble sur un chantier.');
        if (db.ratings.some((r) => r.author_company === mc && r.target_company === p_company)) throw new Error('Vous avez déjà noté ce pro.');
        db.ratings.push({ id: id(), kind: 'pro_pro', author_company: mc, author_user: me(), target_company: p_company, rating: p_rating, comment: p_comment, created_at: now() });
        notifyCompany(p_company, 'systeme', 'Nouvelle note d’un pro', p_rating + '/5', '/pro/reglages/profil-public');
      }
    },
    rate_client({ p_client, p_rating, p_comment = '' }) {
      const mc = myCompany(); const cl = db.clients.find((c) => c.id === p_client && c.company_id === mc); if (!cl) throw new Error('Client introuvable');
      if (!db.appointments.some((a) => a.client_id === p_client && a.start_at < now() && ['valide', 'termine'].includes(a.status)) && !db.documents.some((d) => d.client_id === p_client && d.number)) throw new Error('Vous pourrez noter ce client après un premier rendez-vous ou document.');
      if (db.ratings.some((r) => r.author_company === mc && r.target_client === p_client)) throw new Error('Vous avez déjà noté ce client.');
      db.ratings.push({ id: id(), kind: 'pro_client', author_company: mc, author_user: me(), target_client: p_client, target_user: cl.user_id, rating: p_rating, comment: p_comment, created_at: now() });
    },
    client_score({ p_client }) {
      const mc = myCompany(); const cl = db.clients.find((c) => c.id === p_client);
      const rs = db.ratings.filter((r) => r.kind === 'pro_client' && (r.target_client === p_client || (cl?.user_id && r.target_user === cl.user_id)));
      return { avg: rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : null, n: rs.length, mine: rs.find((r) => r.author_company === mc)?.rating || null };
    },
    pro_score({ p_company }) {
      const mc = myCompany(); const rs = db.ratings.filter((r) => r.kind === 'pro_pro' && r.target_company === p_company);
      return { avg: rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : null, n: rs.length, mine: rs.find((r) => r.author_company === mc)?.rating || null };
    },
    project_invite({ p_project, p_company }) {
      const mc = myCompany(); const pr = db.projects.find((p) => p.id === p_project && p.company_id === mc);
      if (!pr) throw new Error('Seul le pro qui a créé le chantier peut inviter.');
      if (!db.network.some((n) => n.company_id === mc && n.pro_id === p_company)) throw new Error("Ajoutez d'abord ce pro à votre réseau : il doit accepter votre demande avant d'être invité sur un chantier.");
      if (db.project_shares.some((x) => x.project_id === p_project && x.company_id === p_company)) throw new Error('Ce pro est déjà invité sur ce chantier.');
      db.project_shares.push({ project_id: p_project, company_id: p_company, status: 'pending', invited_by: mc, created_at: now() });
      const conv = rpcs.start_conversation({ p_company }); const co = db.companies.find((c) => c.id === mc);
      const m = { id: id(), conversation_id: conv, sender_id: me(), sender_name: co.name, sender_company_id: mc, body: '', attachments: [], card: { type: 'project_invite', title: 'Invitation sur un chantier · ' + pr.title, sub: pr.address || '', project_id: pr.id }, created_at: now() };
      db.messages.push(m); afterInsert('messages', m);
      notifyCompany(p_company, 'systeme', 'Invitation sur un chantier', `${co.trade_name || co.name} vous invite sur « ${pr.title} »`, '/pro/messages/' + conv);
      return conv;
    },
    project_invite_answer({ p_project, p_accept }) {
      const mc = myCompany(); const sh = db.project_shares.find((x) => x.project_id === p_project && x.company_id === mc && x.status === 'pending');
      if (!sh) throw new Error('Invitation introuvable ou déjà traitée.');
      const pr = db.projects.find((p) => p.id === p_project); const co = db.companies.find((c) => c.id === mc);
      if (p_accept) sh.status = 'accepted'; else db.project_shares = db.project_shares.filter((x) => x !== sh);
      const conv = rpcs.start_conversation({ p_company: pr.company_id });
      const m = { id: id(), conversation_id: conv, sender_id: me(), sender_name: co.name, sender_company_id: mc, body: '', attachments: [], card: { type: p_accept ? 'done' : 'info', title: p_accept ? 'Invitation acceptée' : 'Invitation refusée', sub: pr.title, project_id: pr.id }, created_at: now() };
      db.messages.push(m); afterInsert('messages', m);
      notifyCompany(pr.company_id, 'systeme', p_accept ? 'Invitation acceptée' : 'Invitation refusée', `${co.trade_name || co.name} ${p_accept ? 'rejoint' : 'ne rejoint pas'} le chantier « ${pr.title} »`, '/pro/planning?projet=' + pr.id);
    },
    project_invites_list() {
      const mc = myCompany();
      return db.project_shares.filter((x) => x.company_id === mc && x.status === 'pending').map((x) => { const p = db.projects.find((y) => y.id === x.project_id) || {}; const c = db.companies.find((y) => y.id === p.company_id) || {}; return { project_id: p.id, title: p.title, address: p.address, created_at: x.created_at, from: { id: c.id, name: c.trade_name || c.name } }; });
    },
    delete_my_account() {
      const p = profile(); if (!p) throw new Error('Connexion requise.');
      if (p.company_id && (p.member_role || 'gerant') === 'gerant') {
        if (db.profiles.some((x) => x.company_id === p.company_id && x.id !== p.id)) throw new Error('Retirez d’abord les membres de votre équipe (Paramètres › Mon équipe), puis recommencez.');
        const c = db.companies.find((x) => x.id === p.company_id); if (c) { c.archived_at = now(); c.visible_particuliers = false; c.visible_pros = false; }
      }
      db.clients.forEach((c) => { if (c.user_id === p.id) c.user_id = null; });
      db.conversations.forEach((c) => { if (c.client_user_id === p.id) c.client_user_id = null; });
      db.profiles = db.profiles.filter((x) => x.id !== p.id);
      return 'ok';
    },
    referral_stats() { return { count: db.companies.filter((c) => c.referred_by && c.referred_by === myCompany()).length, max: 10 }; },
    siret_status({ p_siret }) { const d = String(p_siret).replace(/\D/g, ''); return db.companies.some((c) => String(c.siret || '').replace(/\D/g, '') === d) ? 'active' : 'new'; },
    finish_past_appointments() {
      const mc = myCompany(); let n = 0;
      db.appointments.filter((a) => a.company_id === mc && a.status === 'valide' && a.end_at < now()).forEach((a) => { a.status = 'termine'; n++; });
      return n;
    },
    post_review({ p_company, p_rating, p_comment }) {
      if (db.reviews.some((r) => r.company_id === p_company && r.author_id === me())) throw new Error('Vous avez déjà donné votre avis sur ce pro.');
      const a = db.appointments.filter((x) => x.company_id === p_company && myClientIds().includes(x.client_id) && ['valide', 'termine'].includes(x.status) && x.start_at < now()).sort((x, y) => (x.start_at < y.start_at ? 1 : -1))[0];
      if (!a) throw new Error("Un avis ne peut être donné qu'après un vrai rendez-vous.");
      const p = profile();
      db.reviews.push({ id: id(), company_id: p_company, author_id: me(), author_label: `${p.first_name} ${(p.last_name || '').slice(0, 1)}.`, appointment_id: a.id, rating: p_rating, comment: p_comment, status: 'en_attente', created_at: now() });
      notifyCompany(p_company, 'systeme', 'Nouvel avis client', p_rating + '/5', '/pro/reglages/profil-public');
    },
  };

  return {
    ready,
    async dump() { await ready; const d = await idb(); const st = d.transaction('blobs').objectStore('blobs'); const keys = await req(st.getAllKeys()); const vals = await req(d.transaction('blobs').objectStore('blobs').getAll()); return JSON.stringify({ ...db, _blobs: keys.map((k, i) => ({ path: k, data: vals[i] })) }); },
    async restore(json) { await ready; const d = JSON.parse(json); TABLES.forEach((t) => { db[t] = d[t] || []; }); for (const b of d._blobs || []) await blobPut(b.path, b.data); await persist(); },
    async select(table, filters, opts = {}) { await ready; let rows = db[table].filter((r) => visible(table, r) && match(r, filters)); rows = sort(rows, opts.order); if (opts.limit) rows = rows.slice(0, opts.limit); return wait(rows); },
    async one(table, filters) { await ready; return wait(db[table].find((r) => visible(table, r) && match(r, filters)) || null); },
    async insert(table, row) { await ready;
      const many = Array.isArray(row);
      const out = (many ? row : [row]).map((r) => {
        const x = { ...(defaults[table] || {}), id: id(), created_at: now(), ...r };
        if (table === 'messages' && !x.sender_id) x.sender_id = me();
        if (table === 'files' && !x.uploaded_by) x.uploaded_by = me();
        if (table === 'documents' && !x.created_by) x.created_by = me();
        db[table].push(x); afterInsert(table, x); return x;
      });
      await persist(); return wait(many ? out : out[0]);
    },
    async upsert(table, row) { await ready;
      const keys = table === 'conversation_reads' ? ['conversation_id', 'user_id'] : table === 'network' ? ['company_id', 'pro_id'] : table === 'project_shares' ? ['project_id', 'company_id'] : ['id'];
      const ex = db[table].find((r) => keys.every((k) => r[k] === row[k]));
      if (ex) Object.assign(ex, row); else db[table].push({ created_at: now(), ...row });
      await persist(); return wait(ex || row);
    },
    async update(table, filters, patch) { await ready;
      let last = null;
      for (const r of db[table].filter((x) => match(x, filters))) {
        if (table === 'companies' && !isAdmin() && ('verified' in patch || 'verification_status' in patch)) return fail('Seule l’équipe Artesa peut valider une entreprise.');
        if (table === 'documents' && r.locked && ('lines' in patch || 'totals' in patch || 'client_id' in patch)) return fail('Cette facture est émise : elle ne peut plus être modifiée. Créez un avoir.');
        const old = { ...r }; Object.assign(r, patch); afterUpdate(table, old, r); last = r;
      }
      await persist(); return wait(last);
    },
    async remove(table, filters) { await ready;
      const rows = db[table].filter((x) => match(x, filters));
      if (table === 'documents' && rows.some((d) => d.number && d.kind !== 'devis')) return fail('Une facture numérotée ne peut pas être supprimée : créez un avoir.');
      db[table] = db[table].filter((x) => !rows.includes(x));
      if (table === 'payments') rows.forEach((p) => syncPaid(p.document_id));
      await persist(); return wait(null);
    },
    async rpc(name, args = {}) { await ready;
      try { if (!rpcs[name]) throw new Error('RPC inconnue ' + name); const r = rpcs[name](args); await persist(); return wait(r); }
      catch (e) { return fail(e.message); }
    },
    async upload(path, file) { await ready;
      const data = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(file); });
      await blobPut(path, data); return path;
    },
    async signedUrls(paths) { await ready; const o = {}; for (const p of paths) o[p] = (await blobGet(p)) || null; return o; },
    async removeFile(path) { await ready; await blobDel(path); },
    async signUp(email, password, data) { await ready;
      email = String(email).toLowerCase();
      if (db._users.some((u) => u.email === email)) return fail('Un compte existe déjà avec cet e-mail.');
      if ((password || '').length < 6) return fail('Le mot de passe doit contenir au moins 6 caractères.');
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const u = { id: id(), email, password, user_metadata: data, verified: false, code, code_at: now() };
      db._users.push(u);
      db.profiles.push({ ...defaults.profiles, ...(data.home ? { home: data.home } : {}), id: u.id, kind: data.kind || 'particulier', civility: data.civility || '', first_name: data.first_name || '', last_name: data.last_name || '', email, phone: data.phone || '', lang: data.lang || 'fr', created_at: now() });
      await persist();
      // Mode local : aucun e-mail n'est envoyé, le code est renvoyé pour être affiché à l'écran
      return { needsConfirm: true, devCode: code };
    },
    async verifyEmail(email, code) { await ready;
      const u = db._users.find((x) => x.email === String(email).toLowerCase());
      if (!u) return fail('Compte introuvable.');
      if (!u.verified && String(code).trim() !== u.code) return fail('Code incorrect.');
      u.verified = true; delete u.code; await persist();
      saveSession({ access_token: 'local', user: { id: u.id, email: u.email } });
    },
    async resendCode(email) { await ready;
      const u = db._users.find((x) => x.email === String(email).toLowerCase());
      if (!u) return fail('Compte introuvable.');
      u.code = String(Math.floor(100000 + Math.random() * 900000)); await persist();
      return { devCode: u.code };
    },
    async signIn(email, password, remember) { await ready;
      const u = db._users.find((x) => x.email === String(email).toLowerCase() && x.password === password);
      if (!u) return fail('E-mail ou mot de passe incorrect.');
      if (u.verified === false) { const e = new Error('Confirmez votre adresse e-mail avant de vous connecter.'); e.code = 'email_not_confirmed'; throw e; }
      if (u.mfa_secret) { pendingMfa = { u, remember }; return { mfa: true }; }
      saveSession({ access_token: 'local', user: { id: u.id, email: u.email } }, remember);
      return {};
    },
    async mfaLogin(code) { await ready;
      if (!pendingMfa) return fail('Reconnectez-vous.');
      if (!(await checkTotp(pendingMfa.u.mfa_secret, code))) return fail('Code incorrect. Vérifiez l’heure de votre téléphone et réessayez.');
      const { u, remember } = pendingMfa; pendingMfa = null;
      saveSession({ access_token: 'local', user: { id: u.id, email: u.email } }, remember);
    },
    async mfaStatus() { await ready; const u = db._users.find((x) => x.id === me()); return { enabled: !!u?.mfa_secret, factorId: 'local' }; },
    async mfaEnroll() { await ready; const u = db._users.find((x) => x.id === me()); u.mfa_pending = newSecret(); await persist(); return { factorId: 'local', secret: u.mfa_pending, uri: otpauthUri(u.mfa_pending, u.email) }; },
    async mfaConfirm(_id, code) { await ready; const u = db._users.find((x) => x.id === me());
      if (!u?.mfa_pending || !(await checkTotp(u.mfa_pending, code))) return fail('Code incorrect. Vérifiez l’heure de votre téléphone et réessayez.');
      u.mfa_secret = u.mfa_pending; delete u.mfa_pending; await persist(); },
    async mfaDisable() { await ready; const u = db._users.find((x) => x.id === me()); delete u.mfa_secret; await persist(); },
    async signOut() { await ready; saveSession(null); },
    async recover() { await ready; return wait(null); },
    async updatePassword(pw) { await ready; const u = db._users.find((x) => x.id === me()); if (u) u.password = pw; await persist(); },
    async updateEmail(email) { await ready; const u = db._users.find((x) => x.id === me()); if (u) u.email = email; await persist(); },
  };
}
