// Espace de travail de l'équipe Artesa : offres et tarifs, prospection, tâches, agenda, notes, fichiers,
// service client et intégrations. Tout est partagé entre les comptes administrateurs.
import { useMemo, useRef, useState } from 'react';
import { LuPlus, LuTrash2, LuSave, LuCheck, LuChevronLeft, LuChevronRight, LuUpload, LuDownload, LuPin, LuMessageSquare, LuExternalLink, LuCircleCheck, LuCircleAlert, LuCircleDashed } from 'react-icons/lu';
import { api, OFFLINE } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { date, rel, iso } from '../../lib/format.js';
import { usePlatform, savePlatform, useWho } from '../../lib/platform.js';
import { WhoBar } from './prospects.jsx';
import { TopBar, Sec, Pill, useData, Loader, Empty, Chips, Sheet, Field, Table, SearchBar } from '../../ui/index.jsx';
import { uploadTo } from '../common/chat.jsx';

export { AdminPipeline, STAGES } from './prospects.jsx';

// ─────────────── Offres et tarifs ───────────────
export function AdminOffers() {
  const { profile, company, run } = useApp();
  const s = usePlatform();
  const [plans, setPlans] = useState(null);
  const [trial, setTrial] = useState(null);
  const [banner, setBanner] = useState(null);
  const P = plans ?? s.plans.map((p) => ({ ...p, features: [...(p.features || [])] }));
  const set = (i, k, v) => setPlans(P.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const save = () => run(async () => {
    const clean = P.map((p) => ({ ...p, name: String(p.name).trim(), price: Math.max(0, Number(p.price) || 0), users: Math.max(0, Number(p.users) || 0), features: p.features.map((f) => f.trim()).filter(Boolean) }));
    await savePlatform({ plans: clean, trial_days: Number(trial ?? s.trial_days), banner: banner ?? s.banner }, profile.id);
    // Les formules deviennent aussi des lignes prêtes à facturer dans les devis et factures d'Artesa
    if (company?.id) {
      const items = await api.select('items', { company_id: company.id }).catch(() => []);
      for (const p of clean) {
        const ref = 'ABO-' + p.id.toUpperCase(), ex = items.find((x) => x.ref === ref);
        const row = { name: `Abonnement Artesa ${p.name} (1 mois)`, ref, family: 'Abonnements', unit: 'mois', sale_price: p.price, purchase_price: 0, coef: 1, vat_rate: 20 };
        if (ex) await api.update('items', { id: ex.id }, row); else await api.insert('items', { ...row, company_id: company.id, kind: 'article' });
      }
    }
    setPlans(null); setTrial(null); setBanner(null);
  }, t('Tarifs enregistrés : ils sont à jour sur le site'));
  return (
    <div className="content">
      <TopBar title={t('Offres et tarifs')} sub={t('Ce que voient les artisans sur le site et dans leur abonnement')} />
      <div className="grid3">
        {P.map((p, i) => (
          <div key={p.id} className="card soft">
            <Field label={t('Nom de la formule')}><input value={p.name} onChange={(e) => set(i, 'name', e.target.value)} /></Field>
            <div className="form-grid two">
              <Field label={t('Prix HT / mois (€)')}><input type="number" min={0} step="1" value={p.price} onChange={(e) => set(i, 'price', e.target.value)} /></Field>
              <Field label={t('Utilisateurs (0 = illimité)')}><input type="number" min={0} value={p.users} onChange={(e) => set(i, 'users', e.target.value)} /></Field>
            </div>
            <Field label={t('Phrase courte')}><input value={p.desc} onChange={(e) => set(i, 'desc', e.target.value)} /></Field>
            <Field label={t('Ce qui est inclus (une ligne par avantage)')}><textarea rows={6} value={p.features.join('\n')} onChange={(e) => set(i, 'features', e.target.value.split('\n'))} /></Field>
          </div>
        ))}
      </div>
      <Sec title={t('Réglages généraux')} />
      <div className="form-grid two">
        <Field label={t('Durée de l’essai gratuit (jours)')} hint={t('pour les nouvelles inscriptions')}><input type="number" min={0} max={365} value={trial ?? s.trial_days} onChange={(e) => setTrial(e.target.value)} /></Field>
        <Field label={t('Bandeau d’information (facultatif)')} hint={t('ex. maintenance prévue dimanche')}><input value={banner ?? s.banner ?? ''} onChange={(e) => setBanner(e.target.value)} /></Field>
      </div>
      <p className="small muted">{t('Les artisans déjà inscrits gardent leur formule ; le nouveau prix s’affiche partout dès l’enregistrement. Pensez à prévenir les abonnés 15 jours avant une hausse (CGV).')}</p>
      <div className="btns"><button className="btn" onClick={save}><LuSave /> {t('Enregistrer les tarifs')}</button></div>
    </div>
  );
}

// ─────────────── Tâches ───────────────
export function AdminTasks() {
  const { profile, run } = useApp();
  const [who, , team] = useWho(profile);
  const [view, setView] = useState('todo');
  const [nt, setNt] = useState({ title: '', due_date: '', assignee: '' });
  const [tasks, reload] = useData(() => api.select('admin_tasks', {}, { order: 'due_date.asc' }), []);
  if (!tasks) return <div className="content"><TopBar title={t('Tâches')} /><Loader /></div>;
  const today = iso(new Date());
  const list = tasks.filter((x) => (view === 'todo' ? !x.done : view === 'done' ? x.done : !x.done && x.assignee === view))
    .sort((a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')));
  const add = () => run(async () => { await api.insert('admin_tasks', { title: nt.title.trim(), due_date: nt.due_date || null, assignee: nt.assignee || who, assignee_id: profile.id, created_by: profile.id }); setNt({ title: '', due_date: '', assignee: '' }); reload(); });
  const toggle = (x) => run(async () => { await api.update('admin_tasks', { id: x.id }, { done: !x.done, done_at: x.done ? null : new Date().toISOString(), details: x.done ? x.details : [x.details, who && t('Fait par {w}', { w: who })].filter(Boolean).join(' · ') }); reload(); });
  return (
    <div className="content">
      <TopBar title={t('Tâches')} sub={t('Partagées entre vous')} />
      <WhoBar />
      <div className="card soft row wrap" style={{ gap: 8 }}>
        <input className="input" style={{ flex: 2, minWidth: 200 }} value={nt.title} onChange={(e) => setNt({ ...nt, title: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter' && nt.title.trim()) add(); }} placeholder={t('Nouvelle tâche…')} />
        <input className="input" type="date" style={{ maxWidth: 170 }} value={nt.due_date} onChange={(e) => setNt({ ...nt, due_date: e.target.value })} aria-label={t('Échéance')} />
        <select className="input" style={{ maxWidth: 180 }} value={nt.assignee} onChange={(e) => setNt({ ...nt, assignee: e.target.value })} aria-label={t('Pour')}><option value="">{who ? t('Pour moi ({w})', { w: who }) : t('Pour…')}</option>{team.filter((n) => n !== who).map((n) => <option key={n} value={n}>{n}</option>)}</select>
        <button className="btn" disabled={!nt.title.trim()} onClick={add}><LuPlus /> {t('Ajouter')}</button>
      </div>
      <Chips scroll options={[['todo', t('À faire ({n})', { n: tasks.filter((x) => !x.done).length })], ...team.map((n) => [n, n]), ['done', t('Terminées')]]} value={view} onChange={setView} />
      {!list.length ? <Empty text={view === 'done' ? t('Rien de terminé pour l’instant') : t('Aucune tâche')} /> : <div className="list">{list.map((x) => (
        <div key={x.id} className="li">
          <button className={'checkbtn' + (x.done ? ' on' : '')} onClick={() => toggle(x)} aria-label={x.done ? t('Rouvrir') : t('Terminer')}>{x.done && <LuCheck />}</button>
          <div className="grow"><div className="t1" style={x.done ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>{x.title}</div>
            <div className="t2">{[x.due_date && <span key="d" className={!x.done && x.due_date < today ? 'red-t bold' : ''}>{date(x.due_date)}</span>, x.assignee && <span key="a" className="who-tag">{x.assignee}</span>, x.deal_id && <button key="p" className="link small" onClick={() => navigate('/admin/prospection')}>{t('prospect')}</button>, x.details && <span key="x" className="muted">{x.details}</span>].filter(Boolean).map((v, i) => <span key={i}>{i ? ' · ' : ''}{v}</span>)}</div></div>
          <button className="iconbtn" onClick={() => run(async () => { await api.remove('admin_tasks', { id: x.id }); reload(); })} aria-label={t('Supprimer')}><LuTrash2 /></button>
        </div>
      ))}</div>}
    </div>
  );
}

// ─────────────── Agenda ───────────────
export function AdminCalendar() {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [b] = useData(async () => {
    const [tasks, deals, appts] = await Promise.all([api.select('admin_tasks', {}).then((r) => r.filter((x) => !x.done)).catch(() => []), api.select('admin_deals', {}).catch(() => []), api.select('appointments', {}, { order: 'start_at.asc', limit: 500 }).catch(() => [])]);
    return { tasks, deals, appts };
  }, []);
  const days = useMemo(() => {
    const first = new Date(month); const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [month]);
  if (!b) return <div className="content"><TopBar title={t('Agenda')} /><Loader /></div>;
  const ev = (d) => {
    const k = iso(d);
    return [
      ...b.appts.filter((a) => String(a.start_at).slice(0, 10) === k).map((a) => ({ c: 'navy', l: new Date(a.start_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' ' + (a.title || a.type || t('RDV')), to: '/pro/planning/rdv/' + a.id })),
      ...b.tasks.filter((x) => x.due_date === k).map((x) => ({ c: 'red', l: '☐ ' + (x.assignee ? x.assignee + ' : ' : '') + x.title, to: '/admin/taches' })),
      ...b.deals.filter((x) => x.next_date === k && !['client', 'perdu'].includes(x.stage)).map((x) => ({ c: 'green', l: '→ ' + (x.owner ? x.owner + ' : ' : '') + x.title, to: '/admin/prospection' })),
    ];
  };
  const shift = (n) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const today = iso(new Date());
  return (
    <div className="content wide">
      <TopBar title={t('Agenda')} sub={t('Rendez-vous, tâches et relances de prospection')} right={<button className="btn sm" onClick={() => navigate('/pro/planning')}>{t('Planning détaillé')}</button>} />
      <div className="row between mb"><button className="iconbtn" onClick={() => shift(-1)} aria-label={t('Mois précédent')}><LuChevronLeft /></button><b style={{ textTransform: 'capitalize', fontSize: 18 }}>{month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</b><button className="iconbtn" onClick={() => shift(1)} aria-label={t('Mois suivant')}><LuChevronRight /></button></div>
      <div className="mcal">
        {['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map((d) => <div key={d} className="mcal-h">{t(d)}</div>)}
        {days.map((d) => { const e = ev(d); return (
          <div key={+d} className={'mcal-d' + (d.getMonth() !== month.getMonth() ? ' out' : '') + (iso(d) === today ? ' today' : '')}>
            <span className="mcal-n">{d.getDate()}</span>
            {e.slice(0, 3).map((x, i) => <button key={i} className={'mcal-e ' + x.c} onClick={() => navigate(x.to)}>{x.l}</button>)}
            {e.length > 3 && <span className="small muted">+{e.length - 3}</span>}
          </div>); })}
      </div>
      <p className="small muted mt"><span className="dot b2" /> {t('Rendez-vous')} · <span className="dot" /> {t('Tâches')} · <span className="dot green" /> {t('Prospection')}</p>
    </div>
  );
}

// ─────────────── Notes et wiki ───────────────
export function AdminNotes() {
  const { profile, run } = useApp();
  const [cur, setCur] = useState(null);
  const [q, setQ] = useState('');
  const [notes, reload] = useData(() => api.select('admin_notes', {}, { order: 'updated_at.desc' }), []);
  if (!notes) return <div className="content"><TopBar title={t('Notes')} /><Loader /></div>;
  const n = q.trim().toLowerCase();
  const list = notes.filter((x) => !n || (x.title + ' ' + x.content + ' ' + x.folder).toLowerCase().includes(n)).sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const folders = [...new Set(list.map((x) => x.folder || 'Général'))];
  const save = () => run(async () => {
    const row = { title: cur.title.trim() || t('Sans titre'), content: cur.content, folder: cur.folder.trim() || 'Général', pinned: !!cur.pinned, updated_by: profile.id, updated_at: new Date().toISOString() };
    const r = cur.id ? await api.update('admin_notes', { id: cur.id }, row) : await api.insert('admin_notes', row);
    setCur((c) => ({ ...c, ...(Array.isArray(r) ? r[0] : r) })); reload();
  }, t('Note enregistrée'));
  return (
    <div className="content wide">
      <TopBar title={t('Notes et wiki')} sub={t('Procédures, idées, comptes rendus, partagés entre vous')} right={<button className="btn sm" onClick={() => setCur({ title: '', content: '', folder: 'Général', pinned: false })}><LuPlus /> {t('Nouvelle note')}</button>} />
      <div className="grid2" style={{ gridTemplateColumns: 'minmax(220px, 1fr) 2fr' }}>
        <div>
          <SearchBar value={q} onChange={setQ} placeholder={t('Chercher dans les notes…')} />
          {!list.length ? <Empty text={t('Aucune note')} /> : folders.map((f) => (
            <div key={f}><Sec title={f} />
              <div className="list">{list.filter((x) => (x.folder || 'Général') === f).map((x) => (
                <button key={x.id} className={'li click' + (cur?.id === x.id ? ' on' : '')} onClick={() => setCur({ ...x })}>
                  <div className="grow"><div className="t1">{x.pinned && <LuPin size={12} />} {x.title}</div><div className="t2">{rel(x.updated_at)}</div></div>
                </button>))}</div>
            </div>))}
        </div>
        <div>
          {!cur ? <Empty text={t('Choisissez une note ou créez-en une.')} /> : <div className="card soft">
            <input className="input" style={{ fontSize: 20, fontWeight: 800 }} value={cur.title} onChange={(e) => setCur({ ...cur, title: e.target.value })} placeholder={t('Titre')} />
            <div className="row wrap mt" style={{ gap: 8 }}>
              <input className="input" style={{ maxWidth: 220 }} value={cur.folder} onChange={(e) => setCur({ ...cur, folder: e.target.value })} placeholder={t('Dossier')} aria-label={t('Dossier')} />
              <label className="check"><input type="checkbox" checked={!!cur.pinned} onChange={(e) => setCur({ ...cur, pinned: e.target.checked })} /><span className="small">{t('Épinglée')}</span></label>
            </div>
            <textarea className="input mt" rows={18} style={{ fontFamily: 'inherit', lineHeight: 1.6 }} value={cur.content} onChange={(e) => setCur({ ...cur, content: e.target.value })} placeholder={t('Écrivez ici… (listes avec « - », titres avec « # »)')} />
            <div className="row wrap mt" style={{ gap: 8 }}>
              <button className="btn" onClick={save}><LuSave /> {t('Enregistrer')}</button>
              {cur.id && <button className="btn ghost" onClick={() => run(async () => { await api.remove('admin_notes', { id: cur.id }); setCur(null); reload(); }, t('Note supprimée'))}><LuTrash2 /> {t('Supprimer')}</button>}
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}

// ─────────────── Fichiers partagés ───────────────
export function AdminDrive() {
  const { company, run } = useApp();
  const input = useRef(null);
  const [q, setQ] = useState('');
  const [files, reload] = useData(async () => (company ? (await api.select('files', { company_id: company.id, kind: 'doc' }, { order: 'created_at.desc' })).filter((f) => !f.client_id) : []), [company?.id]);
  if (!files) return <div className="content"><TopBar title={t('Fichiers')} /><Loader /></div>;
  const n = q.trim().toLowerCase();
  const list = files.filter((f) => !n || (f.name + ' ' + f.doc_type).toLowerCase().includes(n));
  const up = (fl) => run(async () => { for (const f of fl) { const u = await uploadTo(company.id + '/drive', f); await api.insert('files', { company_id: company.id, kind: 'doc', doc_type: 'autre', name: f.name, path: u.path, mime: f.type, size: f.size }); } reload(); }, t('Fichiers ajoutés'));
  const open = (f) => run(async () => { const u = await api.signedUrls([f.path]); if (u[f.path]) window.open(u[f.path], '_blank', 'noopener'); });
  return (
    <div className="content">
      <TopBar title={t('Fichiers partagés')} sub={t('Statuts, contrats, logos, présentations…')} right={<button className="btn sm" onClick={() => input.current?.click()}><LuUpload /> {t('Ajouter')}</button>} />
      <input ref={input} type="file" multiple hidden onChange={(e) => { if (e.target.files?.length) up([...e.target.files]); e.target.value = ''; }} />
      <SearchBar value={q} onChange={setQ} placeholder={t('Chercher un fichier…')} />
      <Table rows={list} empty={t('Aucun fichier. Glissez-en avec « Ajouter ».')} cols={[
        { label: t('Nom'), render: (f) => <button className="link bold" onClick={() => open(f)}>{f.name}</button> },
        { label: t('Taille'), render: (f) => <span className="small">{f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(f.size / 1024)) + ' ko'}</span> },
        { label: t('Ajouté'), render: (f) => <span className="small">{date(f.created_at)}</span> },
        { label: '', render: (f) => <span className="row" style={{ gap: 4 }}><button className="iconbtn" onClick={() => open(f)} aria-label={t('Télécharger')}><LuDownload /></button><button className="iconbtn" onClick={() => run(async () => { await api.removeFile(f.path).catch(() => {}); await api.remove('files', { id: f.id }); reload(); }, t('Fichier supprimé'))} aria-label={t('Supprimer')}><LuTrash2 /></button></span> },
      ]} />
    </div>
  );
}

// ─────────────── Service client ───────────────
export function AdminSupport() {
  const { run } = useApp();
  const [pick, setPick] = useState(false);
  const [q, setQ] = useState('');
  const [b] = useData(async () => {
    const [convs, cos] = await Promise.all([api.select('conversations', { kind: 'support' }, { order: 'last_at.desc' }), api.select('companies', {}, { limit: 1000 })]);
    return { convs, cos: cos.filter((c) => !c.is_platform), cm: Object.fromEntries(cos.map((c) => [c.id, c])) };
  }, []);
  if (!b) return <div className="content"><TopBar title={t('Service client')} /><Loader /></div>;
  const start = (c) => run(async () => { const id = await api.rpc('admin_support_start', { p_company: c.id }); navigate('/pro/messages/' + id); });
  const n = q.trim().toLowerCase();
  return (
    <div className="content">
      <TopBar title={t('Service client')} sub={t('Les pros et les particuliers vous écrivent depuis « Aide › Chat avec le support »')} right={<button className="btn sm" onClick={() => setPick(true)}><LuMessageSquare /> {t('Écrire à un pro')}</button>} />
      <div className="notice small">{t('Artesa reste invisible dans la recherche : seuls les pros que vous contactez, ou qui écrivent au support, vous voient. Ils peuvent vous répondre ici.')}</div>
      {!b.convs.length ? <Empty text={t('Aucune conversation pour l’instant')} /> : <div className="list mt">{b.convs.map((c) => { const co = b.cm[c.other_company_id]; return (
        <button key={c.id} className="li click" onClick={() => navigate('/pro/messages/' + c.id)}>
          <div className="grow"><div className="t1">{co?.name || t('Particulier')} <Pill c={co ? 'yellow' : 'grey'}>{co ? t('Pro') : t('Particulier')}</Pill></div><div className="t2">{c.last_message || t('Nouvelle conversation')}</div></div>
          <span className="small muted">{rel(c.last_at)}</span>
        </button>); })}</div>}
      <Sheet open={pick} onClose={() => setPick(false)} title={t('Écrire à un pro')}>
        <SearchBar value={q} onChange={setQ} placeholder={t('Nom de l’entreprise…')} />
        <div className="list">{b.cos.filter((c) => !n || (c.name + ' ' + c.city).toLowerCase().includes(n)).slice(0, 30).map((c) => <button key={c.id} className="li click" onClick={() => start(c)}><div className="grow"><div className="t1">{c.name}</div><div className="t2">{c.city}</div></div></button>)}</div>
      </Sheet>
    </div>
  );
}

// ─────────────── Intégrations ───────────────
export function AdminIntegrations() {
  const [b] = useData(async () => {
    if (OFFLINE) return { mail: false, vat: false };
    const mail = await api.fn('mail', { probe: true }).then((r) => !!r?.enabled).catch(() => false);
    const vat = await api.fn('vat-check', { vat: 'FR00' }).then((r) => r?.error === 'invalid' || 'valid' in (r || {})).catch(() => false);
    return { mail, vat };
  }, []);
  const ST = { ok: [LuCircleCheck, 'green-t', 'Connecté'], todo: [LuCircleAlert, 'red-t', 'À connecter'], later: [LuCircleDashed, 'muted', 'Plus tard'] };
  const rows = [
    ['Base de données et comptes', 'Supabase (Union européenne)', 'ok', 'https://supabase.com/dashboard'],
    ['Hébergement du site', 'Vercel', 'ok', 'https://vercel.com/dashboard'],
    ['Vérification RGE', 'ADEME, open data, sans clé', 'ok', 'https://data.ademe.fr/datasets/liste-des-entreprises-rge-2'],
    ['Vérification n° de TVA', 'VIES, Commission européenne', b?.vat ? 'ok' : 'todo', 'https://ec.europa.eu/taxation_customs/vies/'],
    ['Entreprises et adresses', 'API Recherche d’entreprises, Base Adresse Nationale', 'ok', 'https://annuaire-entreprises.data.gouv.fr/'],
    ['E-mails envoyés aux clients', 'Resend (gratuit jusqu’à 3 000 / mois) : clé RESEND_API_KEY à poser dans Supabase', b?.mail ? 'ok' : 'todo', 'https://resend.com'],
    ['Facturation électronique', 'Super PDP (plateforme agréée) : après l’immatriculation', 'later', 'https://www.superpdp.tech/'],
    ['Paiement des abonnements', 'Stripe ou GoCardless : à choisir', 'later', 'https://stripe.com/fr'],
    ['Agenda Google / Outlook', 'Abonnement iCal depuis Paramètres › Intégrations', 'ok', null],
  ];
  return (
    <div className="content">
      <TopBar title={t('Intégrations')} sub={t('Services branchés à la plateforme')} />
      {!b ? <Loader /> : <div className="list">{rows.map(([n, d, s, url]) => { const [I, cls, l] = ST[s]; return (
        <div key={n} className="li"><I className={cls} /><div className="grow"><div className="t1">{t(n)}</div><div className="t2">{t(d)}</div></div><span className={'small bold ' + cls}>{t(l)}</span>{url && <a className="iconbtn" href={url} target="_blank" rel="noopener noreferrer" aria-label={t('Ouvrir')}><LuExternalLink /></a>}</div>); })}</div>}
      <p className="small muted mt">{t('Par sécurité, les clés secrètes (Resend, Super PDP, paiement) se posent dans les réglages Supabase, jamais dans l’application ni dans un message.')}</p>
    </div>
  );
}
