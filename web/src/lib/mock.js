// Base locale (navigateur) qui imite Supabase : sert aux tests hors-ligne.
// Elle reproduit les tables, les fonctions (RPC) et les déclencheurs principaux, sans la sécurité serveur.
const KEY = 'ay-local-db';
const TABLES = ['profiles', 'companies', 'teams', 'company_invites', 'clients', 'projects', 'project_shares', 'items', 'documents', 'payments', 'purchases', 'appointments', 'files', 'conversations', 'messages', 'conversation_reads', 'network', 'reviews', 'notifications', '_users', '_blobs'];
const id = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now());
const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

export function mockBackend({ saveSession, getSession }) {
  // Stockage dans IndexedDB (grande capacité), avec reprise d'un ancien stockage localStorage
  let db = {};
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open('artis-and-you', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const ready = (async () => {
    try {
      const d = await idb();
      db = await new Promise((res) => { const q = d.transaction('kv').objectStore('kv').get(KEY); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }) || JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch { try { db = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { db = {}; } }
    TABLES.forEach((t) => { db[t] = db[t] || []; });
  })();
  let saving = null;
  const flush = async () => { try { const d = await idb(); d.transaction('kv', 'readwrite').objectStore('kv').put(db, KEY); } catch {} };
  addEventListener('pagehide', () => { if (saving) { clearTimeout(saving); saving = null; flush(); } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saving) { clearTimeout(saving); saving = null; flush(); } });
  const persist = () => {
    clearTimeout(saving);
    saving = setTimeout(async () => { saving = null;
      try { const d = await idb(); d.transaction('kv', 'readwrite').objectStore('kv').put(db, KEY); localStorage.removeItem(KEY); }
      catch (e) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { console.warn('stockage local plein', e); } }
    }, 150);
  };
  const me = () => getSession()?.user?.id;
  const profile = () => db.profiles.find((p) => p.id === me());
  const myCompany = () => profile()?.company_id || null;
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
    teams: { color: '#00123B' },
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
        c.last_message = (row.body || (row.card ? row.card.title : '📎 Pièce jointe')).slice(0, 140); c.last_at = row.created_at;
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
    if (table === 'appointments') {
      const cl = db.clients.find((c) => c.id === row.client_id);
      const u = cl?.user_id;
      if (u && u !== me()) {
        if (row.status !== oldRow.status) notify(u, 'rdv', { valide: 'RDV confirmé', refuse: 'RDV refusé', annule: 'RDV annulé', termine: 'Intervention terminée' }[row.status] || 'RDV mis à jour', `${row.title} · ${fmtDT(row.start_at)}`, '/client/rdv/' + row.id);
        else if (row.start_at !== oldRow.start_at) notify(u, 'rdv', 'RDV déplacé', `${row.title} · ${fmtDT(row.start_at)}`, '/client/rdv/' + row.id);
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
      case 'profiles': return r.id === me() || (mc && r.company_id === mc);
      default: return true;
    }
  }
  const rpcs = {
    is_admin() { return true; },
    create_company({ p }) {
      if (myCompany()) throw new Error('Vous avez déjà une entreprise');
      const ref = p.referral ? db.companies.find((c) => c.referral_code === p.referral.toUpperCase()) : null;
      const c = { ...defaults.companies, id: id(), owner_id: me(), name: p.name, siret: p.siret || '', siren: (p.siret || '').replace(/\D/g, '').slice(0, 9), trades: p.trades || [], city: p.city || '', zip: p.zip || '', address: p.address || '', phone: p.phone || '', email: p.email || '',
        referred_by: ref?.id || null, referral_code: Math.random().toString(36).slice(2, 10).toUpperCase(), trial_ends_at: new Date(Date.now() + 30 * 864e5).toISOString(), created_at: now(),
        settings: { planning: { view: 'week', hours: [7, 19], weekend: false, colorBy: 'team', days: [1, 2, 3, 4, 5, 6], slot: [8, 18], duration: 60, manual: true, reminder: 24, visio: true }, docs: { quotePrefix: 'DE', invoicePrefix: 'FA', creditPrefix: 'AV', vat: 20, validity: 30, paymentTerms: '30 jours fin de mois', penalties: "3 fois le taux d'intérêt légal", discount: 'Aucun pour paiement anticipé', onlinePayment: true, einvoice: true }, pdf: { color: '#7F1111', footer: '' }, notifications: { push: true, email: true, sms: false } } };
      db.companies.push(c);
      Object.assign(profile(), { kind: 'artisan', company_id: c.id, member_role: 'gerant' });
      db.teams.push({ id: id(), company_id: c.id, name: 'Équipe principale', color: '#00123B', created_at: now() });
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
      return db.companies.filter((c) => (c.visible_particuliers || myCompany()) &&
        (!q || (c.name + ' ' + (c.trade_name || '') + ' ' + c.trades.join(' ')).toLowerCase().includes(q)) &&
        (!t || c.trades.join(' ').toLowerCase().includes(t)) && (!ci || (c.city + ' ' + (c.zone || '')).toLowerCase().includes(ci)))
        .map((c) => ({ id: c.id, name: c.name, trade_name: c.trade_name, city: c.city, zip: c.zip, trades: c.trades, zone: c.zone, verified: c.verified, rating: avg(reviewsOf(c.id)), reviews_count: reviewsOf(c.id).length, visio: c.settings?.planning?.visio !== false, is_mine: db.clients.some((x) => x.company_id === c.id && x.user_id === me()), logo_path: c.logo_path }));
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
      if (p.text) { const m = { ...defaults.messages, id: id(), conversation_id: conv.id, sender_id: me(), sender_name: `${prof.first_name} ${prof.last_name}`.trim(), body: p.text, attachments: p.photos || [], created_at: now() }; db.messages.push(m); afterInsert('messages', m); }
      notifyCompany(p.company_id, 'rdv', 'Nouvelle demande de RDV', `${prof.first_name} ${prof.last_name} · ${p.type}`, '/pro/planning/rdv/' + aid);
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
    post_review({ p_company, p_rating, p_comment }) {
      const a = db.appointments.filter((x) => x.company_id === p_company && myClientIds().includes(x.client_id) && ['valide', 'termine'].includes(x.status) && x.start_at < now()).sort((x, y) => (x.start_at < y.start_at ? 1 : -1))[0];
      if (!a) throw new Error("Un avis ne peut être donné qu'après un vrai rendez-vous.");
      const p = profile();
      db.reviews.push({ id: id(), company_id: p_company, author_id: me(), author_label: `${p.first_name} ${(p.last_name || '').slice(0, 1)}.`, appointment_id: a.id, rating: p_rating, comment: p_comment, status: 'en_attente', created_at: now() });
      notifyCompany(p_company, 'systeme', 'Nouvel avis client', p_rating + '/5', '/pro/reglages/profil-public');
    },
  };

  return {
    ready,
    async dump() { await ready; return JSON.stringify(db); },
    async restore(json) { await ready; const d = JSON.parse(json); TABLES.forEach((t) => { db[t] = d[t] || []; }); persist(); await new Promise((r) => setTimeout(r, 400)); },
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
      persist(); return wait(many ? out : out[0]);
    },
    async upsert(table, row) { await ready;
      const keys = table === 'conversation_reads' ? ['conversation_id', 'user_id'] : table === 'network' ? ['company_id', 'pro_id'] : table === 'project_shares' ? ['project_id', 'company_id'] : ['id'];
      const ex = db[table].find((r) => keys.every((k) => r[k] === row[k]));
      if (ex) Object.assign(ex, row); else db[table].push({ created_at: now(), ...row });
      persist(); return wait(ex || row);
    },
    async update(table, filters, patch) { await ready;
      let last = null;
      for (const r of db[table].filter((x) => match(x, filters))) {
        if (table === 'documents' && r.locked && ('lines' in patch || 'totals' in patch || 'client_id' in patch)) return fail('Cette facture est émise : elle ne peut plus être modifiée. Créez un avoir.');
        const old = { ...r }; Object.assign(r, patch); afterUpdate(table, old, r); last = r;
      }
      persist(); return wait(last);
    },
    async remove(table, filters) { await ready;
      const rows = db[table].filter((x) => match(x, filters));
      if (table === 'documents' && rows.some((d) => d.number && d.kind !== 'devis')) return fail('Une facture numérotée ne peut pas être supprimée : créez un avoir.');
      db[table] = db[table].filter((x) => !rows.includes(x));
      if (table === 'payments') rows.forEach((p) => syncPaid(p.document_id));
      persist(); return wait(null);
    },
    async rpc(name, args = {}) { await ready;
      try { if (!rpcs[name]) throw new Error('RPC inconnue ' + name); const r = rpcs[name](args); persist(); return wait(r); }
      catch (e) { return fail(e.message); }
    },
    async upload(path, file) { await ready;
      const data = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(file); });
      db._blobs = db._blobs.filter((b) => b.path !== path); db._blobs.push({ path, data }); persist(); return path;
    },
    async signedUrls(paths) { await ready; const o = {}; paths.forEach((p) => { o[p] = db._blobs.find((b) => b.path === p)?.data || null; }); return o; },
    async removeFile(path) { await ready; db._blobs = db._blobs.filter((b) => b.path !== path); persist(); },
    async signUp(email, password, data) { await ready;
      if (db._users.some((u) => u.email === email)) return fail('Un compte existe déjà avec cet e-mail.');
      if ((password || '').length < 6) return fail('Le mot de passe doit contenir au moins 6 caractères.');
      const u = { id: id(), email, password, user_metadata: data };
      db._users.push(u);
      db.profiles.push({ ...defaults.profiles, id: u.id, kind: data.kind || 'particulier', first_name: data.first_name || '', last_name: data.last_name || '', email, phone: data.phone || '', lang: data.lang || 'fr', created_at: now() });
      persist(); saveSession({ access_token: 'local', user: { id: u.id, email } });
      return { needsConfirm: false };
    },
    async signIn(email, password, remember) { await ready;
      const u = db._users.find((x) => x.email === email && x.password === password);
      if (!u) return fail('E-mail ou mot de passe incorrect.');
      saveSession({ access_token: 'local', user: { id: u.id, email } }, remember);
    },
    async signOut() { await ready; saveSession(null); },
    async recover() { await ready; return wait(null); },
    async updatePassword(pw) { await ready; const u = db._users.find((x) => x.id === me()); if (u) u.password = pw; persist(); },
    async updateEmail(email) { await ready; const u = db._users.find((x) => x.id === me()); if (u) u.email = email; persist(); },
  };
}
