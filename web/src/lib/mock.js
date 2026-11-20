import { PLANS } from './docs.js';
// Base locale (navigateur) qui imite Supabase : sert aux tests hors-ligne.
// Elle reproduit les tables, les fonctions (RPC) et les déclencheurs principaux, sans la sécurité serveur.
const KEY = 'ay-local-db';
const TABLES = ['platform_settings', 'quote_requests', 'admin_deals', 'admin_deal_events', 'admin_tasks', 'admin_notes', 'identity_checks', 'content_reports', 'profiles', 'companies', 'teams', 'company_invites', 'clients', 'projects', 'project_shares', 'items', 'documents', 'payments', 'purchases', 'appointments', 'files', 'conversations', 'messages', 'conversation_reads', 'network', 'network_requests', 'ratings', 'reviews', 'notifications', 'trades', '_users'];
const id = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now());
const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

import { ADMIN_EMAILS } from './api.js';
import { ALL_TRADES, tradeNorm } from './docs.js';
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
    if (!db.platform_settings.length) db.platform_settings.push({ id: 'main', plans: PLANS, trial_days: 30, banner: '', support_email: 'support@artisandyou.fr', team: ['Tomas', 'Clément'] });
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
    files: { doc_type: 'autre', shared_with_client: false, shared_with_pros: false, remind_days: 15, review_status: 'valide', review_note: '', meta: {} },
    items: { kind: 'article', trades: [], unit: 'pièce', purchase_price: 0, coef: 1, sale_price: 0, vat_rate: 20, components: [] },
    messages: { attachments: [], body: '' },
    reviews: { status: 'en_attente' },
    admin_deals: { stage: 'prospect', plan: 'solo', value: 0, owner: '', worked_by: [], tags: [], priority: 'normale', notes: '', contact_name: '', company_name: '', email: '', phone: '', city: '', source: '', next_action: '' },
    admin_tasks: { done: false, details: '', assignee: '' },
    admin_deal_events: { kind: 'note', who: '', content: '' },
    admin_notes: { folder: 'Général', pinned: false, content: '' },
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
  function notifyAdmins(cat, title, body, path) { db.profiles.filter((x) => ADMIN_EMAILS.includes(String(x.email).toLowerCase())).forEach((x) => notify(x.id, cat, title, body, '/' + (x.company_id ? 'pro' : 'client') + '/' + path)); }
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

  const approvedCo = (cid) => { const c = db.companies.find((x) => x.id === cid); return !!c && (c.verification_status === 'approved' || c.verified); };
  function visible(table, r) {
    const mc = myCompany(), mine = myClientIds();
    const convOk = (c) => c && ((mc && (c.company_id === mc || c.other_company_id === mc)) || c.client_user_id === me());
    switch (table) {
      case 'conversations': return convOk(r);
      case 'messages': return convOk(db.conversations.find((c) => c.id === r.conversation_id));
      case 'notifications': case 'conversation_reads': return r.user_id === me();
      case 'clients': return r.company_id === mc || r.user_id === me();
      case 'documents': return r.company_id === mc || (r.number && mine.includes(r.client_id) && approvedCo(r.company_id));
      case 'identity_checks': return r.user_id === me() || isAdmin();
      case 'admin_deals': case 'admin_deal_events': case 'admin_tasks': case 'admin_notes': case 'quote_requests': return isAdmin();
      case 'platform_settings': return true;
      case 'appointments': case 'projects': return r.company_id === mc || mine.includes(r.client_id);
      case 'trades': return r.status === 'valide' || r.created_by === me() || isAdmin();
      case 'files': return r.company_id === mc || (r.kind === 'vault' && isAdmin()) || (mine.includes(r.client_id) && (r.shared_with_client || r.kind === 'photo')) || (r.kind === 'vault' && r.shared_with_client && r.review_status === 'valide' && db.clients.some((c) => c.user_id === me() && c.company_id === r.company_id));
      case 'payments': case 'purchases': case 'items': case 'teams': case 'company_invites': case 'network': return r.company_id === mc;
      case 'network_requests': return r.from_company === mc || r.to_company === mc;
      case 'ratings': return r.author_company === mc;
      case 'project_shares': return r.company_id === mc || db.projects.some((p) => p.id === r.project_id && p.company_id === mc);
      case 'profiles': return r.id === me() || (mc && r.company_id === mc) || isAdmin();
      default: return true;
    }
  }
  const rpcs = {
    is_admin() { return isAdmin(); },
    admin_setup_platform() {
      if (!isAdmin()) throw new Error('Réservé à l’équipe Artesa.');
      let c = db.companies.find((x) => x.is_platform);
      if (!c) { c = { ...defaults.companies, id: id(), owner_id: me(), name: 'Artesa', trade_name: 'Artesa', legal_form: '', country: 'France', email: '', verification_status: 'approved', verified: true, verified_at: now(), visible_particuliers: false, visible_pros: false, is_platform: true, trades: [], trial_ends_at: null, created_at: now() }; db.companies.push(c); }
      const p = db.profiles.find((x) => x.id === me()); Object.assign(p, { kind: 'admin', company_id: c.id, member_role: 'gerant', permissions: { planning: true, clients: true, devis: true, prix: true, kpi: true } });
      return c;
    },
    support_conversation() {
      const plat = db.companies.find((x) => x.is_platform); if (!plat) throw new Error('Le support n’est pas encore disponible.');
      const mc = myCompany(); if (mc === plat.id) throw new Error('Impossible');
      let c = mc ? db.conversations.find((x) => x.kind === 'support' && x.company_id === plat.id && x.other_company_id === mc)
        : db.conversations.find((x) => x.kind === 'support' && x.company_id === plat.id && x.client_user_id === me());
      if (!c) { c = { id: id(), kind: 'support', company_id: plat.id, other_company_id: mc || null, client_user_id: mc ? null : me(), last_message: '', last_at: now(), created_at: now() }; db.conversations.push(c); }
      return c.id;
    },
    admin_support_start({ p_company }) {
      const plat = db.companies.find((x) => x.id === myCompany() && x.is_platform); if (!isAdmin() || !plat) throw new Error('Réservé à l’équipe Artesa.');
      let c = db.conversations.find((x) => x.kind === 'support' && x.company_id === plat.id && x.other_company_id === p_company);
      if (!c) { c = { id: id(), kind: 'support', company_id: plat.id, other_company_id: p_company, last_message: '', last_at: now(), created_at: now() }; db.conversations.push(c); }
      return c.id;
    },
    admin_support_start_user({ p_user }) {
      const plat = db.companies.find((x) => x.id === myCompany() && x.is_platform); if (!isAdmin() || !plat) throw new Error('Réservé à l’équipe Artesa.');
      const u = db.profiles.find((x) => x.id === p_user && x.kind === 'particulier'); if (!u) throw new Error('Compte introuvable');
      let c = db.conversations.find((x) => x.kind === 'support' && x.company_id === plat.id && x.client_user_id === p_user);
      if (!c) { c = { id: id(), kind: 'support', company_id: plat.id, other_company_id: null, client_user_id: p_user, last_message: '', last_at: now(), created_at: now() }; db.conversations.push(c); }
      return c.id;
    },
    support_rdv_book({ p_msg, p_start, p_mode, p_contact, p_platform, p_note }) {
      const m = db.messages.find((x) => x.id === p_msg); if (!m || m.card?.type !== 'artesa_rdv') throw new Error('Demande introuvable.');
      const c = db.conversations.find((x) => x.id === m.conversation_id); const plat = c.company_id; const team = myCompany() === plat;
      const st = m.card.status;
      if (st === 'propose') { if (team || m.sender_company_id !== plat) throw new Error('C’est à la personne contactée de choisir.'); }
      else if (st === 'demande') { if (!team) throw new Error('L’équipe Artesa doit confirmer.'); }
      else throw new Error('Ce rendez-vous a déjà été traité.');
      if (!String(p_contact || '').trim()) throw new Error('Indiquez où vous joindre.');
      const lbl = { telephone: 'Téléphone', whatsapp: 'WhatsApp', visio: 'Visio' }[p_mode] || p_platform || 'Autre';
      const fin = new Date(new Date(p_start).getTime() + (m.card.duration || 30) * 6e4).toISOString();
      let cid, pname;
      if (c.other_company_id) {
        const co = db.companies.find((x) => x.id === c.other_company_id); pname = co.trade_name || co.name;
        let cl = db.clients.find((x) => x.company_id === plat && x.type === 'pro' && x.company_name === co.name);
        if (!cl) { cl = { ...defaults.clients, id: id(), company_id: plat, type: 'pro', company_name: co.name, email: co.email || '', created_at: now() }; db.clients.push(cl); }
        cid = cl.id;
      } else {
        const pr = db.profiles.find((x) => x.id === c.client_user_id); pname = [pr.first_name, pr.last_name].join(' ');
        let cl = db.clients.find((x) => x.company_id === plat && x.user_id === pr.id);
        if (!cl) { cl = { ...defaults.clients, id: id(), company_id: plat, user_id: pr.id, type: 'particulier', first_name: pr.first_name, last_name: pr.last_name, email: pr.email, created_at: now() }; db.clients.push(cl); }
        cid = cl.id;
      }
      const base = { ...defaults.appointments, type: 'Rendez-vous Artesa', title: 'Rendez-vous Artesa · ' + lbl, start_at: p_start, end_at: fin, mode: 'visio', status: 'valide', notes: lbl + ' · ' + p_contact, contact_phone: p_contact, validated_at: now(), created_at: now() };
      const appt = { ...base, id: id(), company_id: plat, client_id: cid, contact_name: pname }; db.appointments.push(appt);
      let pro = null; if (c.other_company_id) { pro = { ...base, id: id(), company_id: c.other_company_id, contact_name: 'Artesa' }; db.appointments.push(pro); }
      m.card = { ...m.card, status: 'confirme', start: p_start, end: fin, mode: p_mode, contact: p_contact, platform: p_platform || '', note: p_note || '', appointment_id: appt.id, pro_appointment_id: pro?.id || null };
      const msg = { ...defaults.messages, id: id(), conversation_id: c.id, sender_id: me(), sender_company_id: myCompany(), sender_name: team ? 'Artesa' : pname, body: '', card: { type: 'rdv', title: 'Rendez-vous confirmé', sub: lbl + ' · ' + p_contact }, created_at: now() };
      db.messages.push(msg); c.last_message = 'Rendez-vous confirmé'; c.last_at = now();
      return { appointment_id: appt.id, pro_appointment_id: pro?.id || null };
    },
    admin_stats() {
      if (!isAdmin()) throw new Error('Réservé à l’équipe Artesa.');
      const co = db.companies.filter((c) => !c.is_platform), pr = db.profiles.filter((p) => p.kind !== 'admin'), ago = (d) => new Date(Date.now() - d * 864e5).toISOString(), nowS = now();
      const cids = new Set(co.map((c) => c.id));
      const plans = {}; co.filter((c) => c.trial_ends_at && c.trial_ends_at <= nowS && c.verification_status === 'approved').forEach((c) => { plans[c.plan || 'solo'] = (plans[c.plan || 'solo'] || 0) + 1; });
      const weeks = {}; pr.filter((p) => (p.created_at || '') > ago(84)).forEach((p) => { const d = new Date(p.created_at); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const k = d.toISOString().slice(0, 10); weeks[k] = (weeks[k] || 0) + 1; });
      return {
        users: pr.length, artisans: pr.filter((p) => p.kind === 'artisan').length, particuliers: pr.filter((p) => p.kind === 'particulier').length,
        new_30d: pr.filter((p) => (p.created_at || '') > ago(30)).length, new_7d: pr.filter((p) => (p.created_at || '') > ago(7)).length,
        companies: co.length, approved: co.filter((c) => c.verification_status === 'approved').length, pending: co.filter((c) => c.verification_status === 'pending').length, rejected: co.filter((c) => c.verification_status === 'rejected').length,
        in_trial: co.filter((c) => c.trial_ends_at > nowS).length,
        trial_ending_7d: co.filter((c) => c.trial_ends_at > nowS && c.trial_ends_at < new Date(Date.now() + 7 * 864e5).toISOString()).map((c) => ({ id: c.id, name: c.name, ends: c.trial_ends_at, plan: c.plan })),
        after_trial: co.filter((c) => c.trial_ends_at && c.trial_ends_at <= nowS && c.verification_status === 'approved').length, plans,
        quotes: db.documents.filter((d) => cids.has(d.company_id) && d.kind === 'devis' && d.number).length,
        invoices: db.documents.filter((d) => cids.has(d.company_id) && d.kind === 'facture' && d.number).length,
        appointments_30d: db.appointments.filter((a) => cids.has(a.company_id) && (a.created_at || '') > ago(30)).length,
        reviews: db.reviews.filter((r) => cids.has(r.company_id) && r.status === 'publie').length,
        signups_by_week: Object.entries(weeks).sort().map(([week, n]) => ({ week, n })),
        todo: { companies: co.filter((c) => c.verification_status === 'pending').length, identities: db.identity_checks.filter((i) => i.status === 'en_attente').length,
          vault: db.files.filter((f) => cids.has(f.company_id) && f.kind === 'vault' && f.review_status === 'en_attente').length, reviews: db.reviews.filter((r) => r.status === 'en_attente').length,
          reports: db.content_reports.filter((r) => r.status === 'recu').length, trades: db.trades.filter((x) => x.status === 'en_attente').length,
          quote_requests: (db.quote_requests || []).filter((q) => q.status === 'nouvelle').length },
      };
    },
    identity_submit({ p_purpose, p_doc_type, p_path, p_holder }) {
      const uid = me(); if (!uid) throw new Error('Connectez-vous.');
      if (!String(p_path || '').startsWith(uid + '/')) throw new Error('Fichier invalide');
      if (String(p_holder || '').trim().length < 3) throw new Error('Indiquez le nom tel qu’il figure sur la pièce.');
      let co = null;
      if (p_purpose === 'dirigeant') { co = db.companies.find((c) => c.owner_id === uid)?.id; if (!co) throw new Error('Seul le dirigeant qui a créé l’entreprise peut envoyer sa pièce.'); }
      if (db.identity_checks.some((i) => i.user_id === uid && i.purpose === p_purpose && i.status === 'verifie')) throw new Error('Votre identité est déjà vérifiée.');
      db.identity_checks.filter((i) => i.user_id === uid && i.purpose === p_purpose && i.status === 'en_attente').forEach((i) => { i.status = 'annule'; });
      const r = { id: id(), user_id: uid, purpose: p_purpose, company_id: co, doc_type: p_doc_type, holder_name: String(p_holder).trim(), file_path: p_path, status: 'en_attente', note: '', created_at: now() };
      db.identity_checks.push(r); return r.id;
    },
    admin_identity_review({ p_id, p_status, p_note = '' }) {
      if (!isAdmin()) throw new Error('Réservé à l’équipe Artesa');
      if (p_status === 'refuse' && !String(p_note).trim()) throw new Error('Indiquez le motif du refus.');
      const r = db.identity_checks.find((x) => x.id === p_id && x.status === 'en_attente'); if (!r) throw new Error('Demande déjà traitée');
      Object.assign(r, { status: p_status, note: String(p_note).trim(), reviewed_by: me(), reviewed_at: now() });
      notify(r.user_id, 'systeme', p_status === 'verifie' ? 'Identité vérifiée' : 'Pièce d’identité refusée', p_status === 'verifie' ? 'Votre identité est vérifiée. La copie de votre pièce a été supprimée.' : 'Motif : ' + String(p_note).trim() + '. La copie a été supprimée ; vous pouvez en envoyer une nouvelle.', r.purpose === 'dirigeant' ? '/pro/compte/entreprise' : '/client/compte');
      return r.file_path;
    },
    identity_file_deleted({ p_id }) {
      const r = db.identity_checks.find((x) => x.id === p_id && (isAdmin() || (x.user_id === me() && ['en_attente', 'annule'].includes(x.status))));
      if (r) Object.assign(r, { file_path: null, file_deleted_at: now() });
    },
    identity_cancel({ p_id }) {
      const r = db.identity_checks.find((x) => x.id === p_id && x.user_id === me() && x.status === 'en_attente'); if (!r) return null;
      r.status = 'annule'; return r.file_path;
    },
    client_certified({ p_client }) {
      const c = db.clients.find((x) => x.id === p_client && x.company_id === myCompany()); if (!c?.user_id) return null;
      const v = db.identity_checks.filter((i) => i.user_id === c.user_id && i.purpose === 'client' && i.status === 'verifie').map((i) => i.reviewed_at).sort().pop();
      return v || null;
    },
    admin_review_file({ p_id, p_status, p_note = '' }) {
      if (!isAdmin()) throw new Error('Réservé à l’équipe Artesa.');
      const f = db.files.find((x) => x.id === p_id && x.kind === 'vault'); if (!f) throw new Error('Document introuvable');
      Object.assign(f, { review_status: p_status, review_note: p_note, reviewed_at: now() });
      db.profiles.filter((p) => p.company_id === f.company_id && p.member_role === 'gerant').forEach((p) => notify(p.id, 'documents', p_status === 'valide' ? 'Document validé' : 'Document refusé', f.name + (p_status === 'refuse' && p_note ? ' · ' + p_note : ''), '/pro/coffre-fort/' + f.doc_type));
      return f;
    },
    propose_trade({ p_name, p_category = 'Autres métiers' }) {
      let nm = String(p_name || '').trim().replace(/\s+/g, ' '); nm = nm.charAt(0).toUpperCase() + nm.slice(1);
      if (nm.length < 3 || nm.length > 60 || !/\p{L}{3}/u.test(nm)) throw new Error('Nom de métier invalide (3 à 60 caractères).');
      const n = tradeNorm(nm);
      const built = ALL_TRADES.find((x) => tradeNorm(x) === n); if (built) return { name: built, status: 'valide', existing: true };
      const ex = db.trades.find((x) => x.norm === n);
      if (ex) { if (ex.status === 'refuse') throw new Error('Ce métier a été refusé par l’équipe Artesa. Choisissez-en un dans la liste.'); return { name: ex.name, status: ex.status, existing: true }; }
      if (db.trades.filter((x) => x.created_by === me() && x.status === 'en_attente').length >= 5) throw new Error('Vous avez déjà 5 métiers en attente de validation.');
      db.trades.push({ id: id(), name: nm, category: p_category || 'Autres métiers', norm: n, status: 'en_attente', builtin: false, created_by: me(), created_at: now() });
      notifyAdmins('systeme', 'Nouveau métier proposé', nm + ' (' + p_category + ')', 'admin?tab=metiers');
      return { name: nm, status: 'en_attente', existing: false };
    },
    admin_review_trade({ p_id, p_action, p_name = null, p_category = null }) {
      if (!isAdmin()) throw new Error('Réservé à l’équipe Artesa.');
      const tr = db.trades.find((x) => x.id === p_id); if (!tr) throw new Error('Métier introuvable');
      const swap = (from, to) => db.companies.forEach((c) => { if ((c.trades || []).includes(from)) c.trades = [...new Set(c.trades.map((x) => (x === from ? to : x)).filter(Boolean))]; });
      if (p_action === 'refuse') { tr.status = 'refuse'; swap(tr.name, null); if (tr.created_by) notify(tr.created_by, 'systeme', 'Métier non retenu', tr.name + ' : choisissez le métier le plus proche dans la liste.', '/pro/compte/entreprise'); return { status: 'refuse' }; }
      const nm = String(p_name || tr.name).trim().replace(/\s+/g, ' '); const n = tradeNorm(nm);
      const target = ALL_TRADES.find((x) => tradeNorm(x) === n) || db.trades.find((x) => x.norm === n && x.id !== tr.id)?.name;
      if (target) { swap(tr.name, target); db.trades = db.trades.filter((x) => x.id !== tr.id); }
      else { swap(tr.name, nm); Object.assign(tr, { name: nm, norm: n, category: p_category || tr.category, status: 'valide', reviewed_at: now() }); }
      if (tr.created_by) notify(tr.created_by, 'systeme', 'Métier validé', (target || nm) + ' est maintenant proposé à tous les pros et aux particuliers.', '/pro/compte/entreprise');
      return { status: 'valide', name: target || nm, merged: !!target };
    },
    admin_review_company({ p_id, p_status, p_note = '' }) {
      if (!isAdmin()) throw new Error('Réservé à l’équipe Artesa.');
      const c = db.companies.find((x) => x.id === p_id); if (!c) throw new Error('Entreprise introuvable');
      if (p_status === 'approved' && !db.identity_checks.some((i) => i.user_id === c.owner_id && i.purpose === 'dirigeant' && i.status === 'verifie')) throw new Error('La pièce d’identité du dirigeant n’est pas encore vérifiée.');
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
        referred_by: ref?.id || null, referral_code: Math.random().toString(36).slice(2, 10).toUpperCase(), trial_ends_at: new Date(Date.now() + (ref ? 60 : (db.platform_settings[0]?.trial_days ?? 30)) * 864e5).toISOString(), created_at: now(),
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
    async client_quote_sign({ p_id, p_name, p_image = '', p_agent = '', p_start_early = false }) {
      const d = db.documents.find((x) => x.id === p_id && x.kind === 'devis' && x.number && myClientIds().includes(x.client_id));
      if (!d) throw new Error('Devis introuvable');
      if (d.status !== 'envoye') throw new Error('Ce devis ne peut plus être signé.');
      if (!String(p_name || '').trim()) throw new Error('Indiquez votre nom.');
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode((d.number || '') + JSON.stringify(d.lines) + JSON.stringify(d.totals)));
      const hash = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
      Object.assign(d, { status: 'accepte', accepted_at: now(), signed_name: p_name.trim() });
      d.conditions = { ...d.conditions, signature: { image: p_image, at: now(), by: me(), hash, agent: p_agent, mention: 'Bon pour accord' } };
      const consumer = (db.clients.find((c) => c.id === d.client_id)?.type || 'particulier') === 'particulier';
      if (consumer) { const u = new Date(); u.setHours(23, 59, 59, 0); u.setDate(u.getDate() + 14); d.conditions.retractation = { applicable: true, until: u.toISOString(), start_early: !!p_start_early, informed_at: now() }; }
      notifyCompany(d.company_id, 'documents', 'Devis signé', d.number + ' · ' + p_name.trim() + (consumer ? (p_start_early ? ' · le client demande à commencer avant 14 jours' : ' · délai de rétractation de 14 jours en cours') : ''), '/pro/documents/' + d.id);
    },
    client_quote_withdraw({ p_id, p_reason = '' }) {
      const d = db.documents.find((x) => x.id === p_id && x.kind === 'devis' && myClientIds().includes(x.client_id));
      if (!d) throw new Error('Devis introuvable');
      const r = d.conditions?.retractation;
      if (d.status !== 'accepte' || !r?.applicable) throw new Error("Ce devis ne peut pas faire l'objet d'une rétractation en ligne.");
      if (new Date() > new Date(r.until)) throw new Error('Le délai de rétractation de 14 jours est dépassé.');
      d.status = 'retracte'; d.conditions = { ...d.conditions, retractation: { ...r, withdrawn_at: now(), reason: p_reason } };
      notifyCompany(d.company_id, 'documents', 'Rétractation du client', d.number + ' : le client a exercé son droit de rétractation.', '/pro/documents/' + d.id);
      notify(me(), 'documents', 'Accusé de réception de votre rétractation', 'Votre rétractation du devis ' + (d.number || '') + ' a bien été enregistrée le ' + new Date().toLocaleString('fr-FR') + ". L'artisan doit vous rembourser les sommes versées au plus tard 14 jours après cette date.", '/client/documents/' + d.id);
      return { at: now(), by: me(), reason: p_reason, number: d.number };
    },
    request_quote({ p }) {
      const email = String(p?.email || '').trim().toLowerCase();
      if (!p?.consent) throw new Error('Merci d’accepter d’être recontacté pour recevoir votre devis.');
      if (String(p.company_name || '').trim().length < 2) throw new Error('Indiquez le nom de votre entreprise.');
      if (String(p.contact_name || '').trim().length < 2) throw new Error('Indiquez votre nom.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Indiquez un e-mail valide pour recevoir votre devis.');
      db.quote_requests = db.quote_requests || [];
      const r = { id: id(), created_at: now(), updated_at: now(), user_id: me() || null, plan: p.plan || 'entreprise', company_name: p.company_name.trim(), siret: p.siret || '', trades: p.trades || '', city: p.city || '', team_size: p.team_size || '', users_needed: Number(String(p.users_needed || '').replace(/\D/g, '')) || null, sites_per_month: p.sites_per_month || '', options: (p.options || []).slice(0, 40), current_tools: p.current_tools || '', start_when: p.start_when || '', message: p.message || '', contact_name: p.contact_name.trim(), email, phone: p.phone || '', status: 'nouvelle', admin_note: '', handled_by: '' };
      db.quote_requests.push(r);
      db.profiles.filter((x) => ADMIN_EMAILS.includes(String(x.email).toLowerCase())).forEach((x) => notify(x.id, 'systeme', 'Nouvelle demande de devis', r.company_name + (r.team_size ? ' · ' + r.team_size : ''), '/admin/devis-entreprise'));
      return r.id;
    },
    report_content({ p_type, p_target = '', p_url = '', p_reason, p_explanation, p_name = '', p_email = '', p_good_faith = false }) {
      if (!p_good_faith) throw new Error('Merci de confirmer que votre signalement est fait de bonne foi.');
      if (String(p_explanation || '').trim().length < 10) throw new Error('Expliquez en quelques mots pourquoi ce contenu pose problème.');
      if (!me() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p_email || '')) throw new Error('Indiquez votre e-mail pour recevoir notre réponse.');
      const r = { id: id(), reporter_id: me() || null, reporter_name: p_name, reporter_email: p_email, target_type: p_type, target_id: p_target, target_url: p_url, reason: p_reason, explanation: p_explanation, good_faith: true, status: 'recu', decision: '', created_at: now() };
      db.content_reports.push(r);
      if (me()) notify(me(), 'systeme', 'Signalement reçu', 'Nous avons bien reçu votre signalement. Vous recevrez notre décision motivée.', '');
      return r.id;
    },
    admin_decide_report({ p_id, p_status, p_decision }) {
      if (!isAdmin()) throw new Error("Réservé à l'équipe Artesa");
      if (!['retire', 'rejete'].includes(p_status) || !String(p_decision || '').trim()) throw new Error('Indiquez la décision et son motif.');
      const r = db.content_reports.find((x) => x.id === p_id); if (!r) return;
      Object.assign(r, { status: p_status, decision: p_decision.trim(), decided_at: now() });
      if (r.reporter_id) notify(r.reporter_id, 'systeme', p_status === 'retire' ? 'Contenu retiré suite à votre signalement' : 'Signalement examiné : contenu maintenu', p_decision.trim(), '');
    },
    admin_moderate_review({ p_id, p_status, p_reason = '' }) {
      if (!isAdmin()) throw new Error("Réservé à l'équipe Artesa");
      if (p_status === 'refuse' && !String(p_reason).trim()) throw new Error('Indiquez le motif du refus.');
      const r = db.reviews.find((x) => x.id === p_id); if (!r) return;
      Object.assign(r, { status: p_status, refusal_reason: p_reason.trim() || null, decided_at: now() });
      if (r.author_id) notify(r.author_id, 'systeme', p_status === 'publie' ? 'Votre avis est publié' : "Votre avis n'a pas été publié", p_status === 'publie' ? 'Merci pour votre avis !' : 'Motif : ' + p_reason.trim() + '. Vous pouvez contester cette décision en écrivant à support@artisandyou.fr.', '');
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
        if (table === 'files' && !isAdmin()) { x.review_status = x.kind === 'vault' ? 'en_attente' : 'valide'; x.review_note = ''; }
        if (table === 'files' && x.review_status === 'en_attente') notifyAdmins('documents', 'Document à vérifier', (db.companies.find((c) => c.id === x.company_id)?.name || '') + ' · ' + x.name, 'admin?tab=coffre');
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
        if (table === 'files' && !isAdmin()) {
          const p2 = { ...patch }; delete p2.review_status; delete p2.review_note; delete p2.reviewed_at;
          if (r.kind === 'vault' && ['path', 'doc_type', 'issued_at', 'valid_until', 'meta'].some((k) => k in p2 && JSON.stringify(p2[k]) !== JSON.stringify(r[k]))) Object.assign(p2, { review_status: 'en_attente', review_note: '' });
          patch = p2;
        }
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
      try { if (!rpcs[name]) throw new Error('RPC inconnue ' + name); const r = await rpcs[name](args); await persist(); return wait(r); }
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
