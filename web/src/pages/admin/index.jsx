// Espace administrateur Artesa : tuiles d'administration de la plateforme + outils de l'activité d'Artesa
// (clients, devis, factures, comptabilité, facturation électronique), réservé au compte admin.
import { useEffect, useMemo, useState } from 'react';
import {
  LuShieldCheck, LuIdCard, LuFolderLock, LuStar, LuFlag, LuHammer, LuUsers, LuChartLine, LuBuilding2, LuUserRound, LuFileText,
  LuReceiptEuro, LuBellRing, LuChartColumn, LuCalendar, LuMessageSquare, LuCalculator, LuSend, LuLibrary, LuSettings, LuScale,
  LuDownload, LuCircleCheck, LuCircleAlert, LuClock, LuSparkles, LuArrowRight,
} from 'react-icons/lu';
import { api } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate, Link } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { money, money0, date, clientName, fullName } from '../../lib/format.js';
import { download } from '../../lib/xlsx.js';
import { PLANS } from '../../lib/docs.js';
import { TopBar, Sec, Pill, useData, Loader, Empty, Chips, Table, SearchBar } from '../../ui/index.jsx';
import { LawRefs } from '../../ui/lawref.jsx';

// ─────────────── Tuiles ───────────────
function Tile({ to, icon: I, label, sub, count, tone }) {
  return (
    <button type="button" className={'atile' + (tone ? ' ' + tone : '')} onClick={() => navigate(to)}>
      {count > 0 && <span className="atile-badge">{count}</span>}
      <I aria-hidden />
      <b>{label}</b>
      {sub && <small>{sub}</small>}
    </button>
  );
}

export function AdminHome() {
  const { profile, company, run, reload: reloadApp } = useApp();
  const [s, reload] = useData(() => (profile.is_admin ? api.rpc('admin_stats') : null), [profile.is_admin]);
  const ready = profile.kind === 'admin' && company?.is_platform;
  useEffect(() => { if (profile.is_admin && !ready) run(async () => { await api.rpc('admin_setup_platform'); await reloadApp(); }).catch(() => {}); }, [profile.is_admin, ready]);
  if (!profile.is_admin) return <div className="content"><TopBar title={t('Administration')} /><Empty text={t('Réservé à l’équipe Artesa.')} /></div>;
  const todo = s?.todo || {};
  const todoTotal = Object.values(todo).reduce((a, b) => a + Number(b || 0), 0);
  return (
    <div className="content">
      <TopBar title={t('Bonjour {n}', { n: profile.first_name || '' })} sub={t('Espace administrateur Artesa')} />
      {!ready && <div className="notice">{t('Mise en place de l’espace Artesa…')}</div>}
      {s && <div className="kpis mb">
        <div className="kpi"><small>{t('Comptes')}</small><b>{s.users}</b><span className="small muted">{t('+{n} en 7 jours', { n: s.new_7d })}</span></div>
        <div className="kpi"><small>{t('Entreprises validées')}</small><b>{s.approved}</b><span className="small muted">{t('{n} en attente', { n: s.pending })}</span></div>
        <div className="kpi"><small>{t('En essai gratuit')}</small><b>{s.in_trial}</b><span className="small muted">{t('{n} finissent sous 7 jours', { n: s.trial_ending_7d.length })}</span></div>
        <div className="kpi"><small>{t('Abonnements estimés')}</small><b>{money0(mrr(s))}</b><span className="small muted">{t('par mois, HT')}</span></div>
      </div>}

      <Sec title={t('À traiter')} meta={todoTotal ? t('{n} en attente', { n: todoTotal }) : t('Tout est à jour')} />
      <div className="atiles">
        <Tile to="/admin/gestion/siret" icon={LuShieldCheck} label={t('Entreprises à valider')} count={todo.companies} />
        <Tile to="/admin/gestion/identite" icon={LuIdCard} label={t('Pièces d’identité')} count={todo.identities} />
        <Tile to="/admin/gestion/coffre" icon={LuFolderLock} label={t('Documents des pros')} sub={t('Kbis, URSSAF, décennale')} count={todo.vault} />
        <Tile to="/admin/gestion/avis" icon={LuStar} label={t('Avis à relire')} count={todo.reviews} />
        <Tile to="/admin/gestion/signal" icon={LuFlag} label={t('Signalements')} count={todo.reports} />
        <Tile to="/admin/gestion/metiers" icon={LuHammer} label={t('Métiers proposés')} count={todo.trades} />
      </div>

      <Sec title={t('La plateforme')} />
      <div className="atiles">
        <Tile to="/admin/comptes" icon={LuUsers} label={t('Comptes')} sub={t('Artisans et particuliers')} tone="navy" />
        <Tile to="/admin/gestion/all" icon={LuBuilding2} label={t('Toutes les entreprises')} tone="navy" />
        <Tile to="/admin/stats" icon={LuChartLine} label={t('Statistiques')} sub={t('Inscriptions, essais, abonnements')} tone="navy" />
        <Tile to="/admin/legal" icon={LuScale} label={t('Juridique')} sub={t('Pages légales, conformité')} tone="navy" />
      </div>

      <Sec title={t('Notre activité Artesa')} meta={t('Clients, devis, factures et comptabilité d’Artesa')} />
      <div className="atiles">
        <Tile to="/pro/clients" icon={LuUserRound} label={t('Clients')} tone="light" />
        <Tile to="/pro/documents" icon={LuFileText} label={t('Devis et factures')} tone="light" />
        <Tile to="/pro/relances" icon={LuBellRing} label={t('Relances')} sub={t('Impayés')} tone="light" />
        <Tile to="/admin/compta" icon={LuCalculator} label={t('Tableau des comptes')} sub={t('Automatique')} tone="light" />
        <Tile to="/admin/facturation-electronique" icon={LuSend} label={t('Facturation électronique')} tone="light" />
        <Tile to="/pro/crm" icon={LuChartColumn} label={t('CRM et chantiers')} tone="light" />
        <Tile to="/pro/planning" icon={LuCalendar} label={t('Planning')} tone="light" />
        <Tile to="/pro/messages" icon={LuMessageSquare} label={t('Messages')} tone="light" />
        <Tile to="/pro/crm/bibliotheque" icon={LuLibrary} label={t('Prix et prestations')} tone="light" />
        <Tile to="/pro/compte/entreprise" icon={LuSettings} label={t('Infos Artesa')} sub={t('SIRET, TVA, mentions')} tone="light" />
      </div>
      <div className="row mt" style={{ justifyContent: 'center' }}><button className="link small" onClick={reload}><LuClock size={13} /> {t('Actualiser les compteurs')}</button></div>
    </div>
  );
}

const PRICE = Object.fromEntries((PLANS || []).map((p) => [p.id, Number(p.price) || 0]));
const mrr = (s) => Object.entries(s?.plans || {}).reduce((a, [k, n]) => a + (PRICE[k] || 0) * Number(n), 0);

// ─────────────── Comptes ───────────────
export function AdminAccounts() {
  const { profile } = useApp();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [b] = useData(async () => {
    if (!profile.is_admin) return null;
    const [ps, cos] = await Promise.all([api.select('profiles', {}, { order: 'created_at.desc', limit: 1000 }), api.select('companies', {}, { limit: 1000 })]);
    return { ps: ps.filter((p) => p.kind !== 'admin'), cm: Object.fromEntries(cos.map((c) => [c.id, c])) };
  }, [profile.is_admin]);
  const list = useMemo(() => {
    if (!b) return [];
    const n = q.trim().toLowerCase();
    return b.ps.filter((p) => (kind === 'all' || p.kind === kind) && (!n || [p.first_name, p.last_name, p.email, p.phone, b.cm[p.company_id]?.name].join(' ').toLowerCase().includes(n)));
  }, [b, q, kind]);
  if (!b) return <div className="content"><TopBar title={t('Comptes')} /><Loader /></div>;
  const csv = () => {
    const rows = [['Prénom', 'Nom', 'E-mail', 'Téléphone', 'Type', 'Entreprise', 'Statut entreprise', 'Inscrit le'], ...list.map((p) => [p.first_name, p.last_name, p.email, p.phone, p.kind, b.cm[p.company_id]?.name || '', b.cm[p.company_id]?.verification_status || '', (p.created_at || '').slice(0, 10)])];
    download(new Blob(['﻿' + rows.map((r) => r.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'comptes-artesa.csv');
  };
  return (
    <div className="content">
      <TopBar title={t('Comptes')} sub={t('{n} comptes', { n: b.ps.length })} />
      <div className="row wrap mb" style={{ gap: 8 }}>
        <div style={{ flex: 1, minWidth: 220 }}><SearchBar value={q} onChange={setQ} placeholder={t('Nom, e-mail, entreprise…')} /></div>
        <button className="btn ghost sm" onClick={csv}><LuDownload /> {t('Exporter (CSV)')}</button>
      </div>
      <Chips options={[['all', t('Tous')], ['artisan', t('Artisans')], ['particulier', t('Particuliers')]]} value={kind} onChange={setKind} />
      <Table rows={list} empty={t('Aucun compte')} cols={[
        { label: t('Nom'), render: (p) => <span><b>{fullName(p) || '—'}</b><div className="small muted">{p.email}</div></span> },
        { label: t('Type'), render: (p) => <Pill c={p.kind === 'artisan' ? 'yellow' : 'grey'}>{p.kind === 'artisan' ? t('Artisan') : t('Particulier')}</Pill> },
        { label: t('Entreprise'), render: (p) => { const c = b.cm[p.company_id]; return c ? <span className="small"><b>{c.name}</b> · {t({ approved: 'Validée', rejected: 'À compléter', pending: 'En attente' }[c.verification_status] || '')}</span> : <span className="small muted">—</span>; } },
        { label: t('Inscrit'), render: (p) => <span className="small">{date(p.created_at)}</span> },
      ]} />
    </div>
  );
}

// ─────────────── Statistiques ───────────────
export function AdminStats() {
  const { profile } = useApp();
  const [s] = useData(() => (profile.is_admin ? api.rpc('admin_stats') : null), [profile.is_admin]);
  if (!s) return <div className="content"><TopBar title={t('Statistiques')} /><Loader /></div>;
  const weeks = s.signups_by_week || [];
  const max = Math.max(1, ...weeks.map((w) => w.n));
  return (
    <div className="content">
      <TopBar title={t('Statistiques')} sub={t('Hors compte Artesa')} />
      <div className="kpis mb">
        <div className="kpi"><small>{t('Comptes')}</small><b>{s.users}</b><span className="small muted">{t('{a} artisans · {p} particuliers', { a: s.artisans, p: s.particuliers })}</span></div>
        <div className="kpi"><small>{t('Nouveaux (30 j)')}</small><b>{s.new_30d}</b></div>
        <div className="kpi"><small>{t('Devis émis')}</small><b>{s.quotes}</b></div>
        <div className="kpi"><small>{t('Factures émises')}</small><b>{s.invoices}</b></div>
        <div className="kpi"><small>{t('RDV (30 j)')}</small><b>{s.appointments_30d}</b></div>
        <div className="kpi"><small>{t('Avis publiés')}</small><b>{s.reviews}</b></div>
      </div>
      <div className="grid2">
        <div>
          <Sec title={t('Inscriptions par semaine')} meta={t('12 dernières semaines')} />
          <div className="card soft">
            {!weeks.length ? <Empty text={t('Pas encore d’inscription')} /> : <div className="abars" role="img" aria-label={t('Inscriptions par semaine')}>
              {weeks.map((w) => <div key={w.week} className="bar" title={`${date(w.week)} : ${w.n}`}><span style={{ height: `${(w.n / max) * 100}%` }} /><small>{w.week.slice(5).split('-').reverse().join('/')}</small></div>)}
            </div>}
          </div>
        </div>
        <div>
          <Sec title={t('Entreprises et abonnements')} />
          <div className="kv">
            <div className="r"><span>{t('Validées')}</span><b>{s.approved}</b></div>
            <div className="r"><span>{t('En attente de validation')}</span><b>{s.pending}</b></div>
            <div className="r"><span>{t('À compléter')}</span><b>{s.rejected}</b></div>
            <div className="r"><span>{t('En essai gratuit')}</span><b>{s.in_trial}</b></div>
            <div className="r"><span>{t('Essai terminé (abonnement attendu)')}</span><b>{s.after_trial}</b></div>
            {Object.entries(s.plans || {}).map(([k, n]) => <div key={k} className="r"><span>{t('Formule {p}', { p: (PLANS.find((p) => p.id === k)?.name) || k })}</span><b>{n} × {money0(PRICE[k] || 0)}</b></div>)}
            <div className="r"><span><b>{t('Revenu mensuel estimé')}</b><div className="small muted">{t('Estimation : le paiement des abonnements n’est pas encore relié.')}</div></span><b>{money0(mrr(s))} {t('HT')}</b></div>
          </div>
          <Sec title={t('Essais qui se terminent sous 7 jours')} />
          {!s.trial_ending_7d.length ? <Empty text={t('Aucun')} /> : <div className="list">{s.trial_ending_7d.map((c) => <div key={c.id} className="li"><b>{c.name}</b><span className="small muted">{t('fin le {d}', { d: date(c.ends) })}</span></div>)}</div>}
        </div>
      </div>
    </div>
  );
}

// ─────────────── Tableau des comptes (automatique) ───────────────
const ACC = { '411000': 'Clients', '706000': 'Prestations de services', '445710': 'TVA collectée', '512000': 'Banque', '607000': 'Achats', '445660': 'TVA déductible', '401000': 'Fournisseurs', '419100': 'Acomptes reçus' };
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

// Écritures comptables déduites des factures, avoirs, paiements et achats (même logique que le FEC)
export function buildEntries(docs, pays, purchases, cm) {
  const out = [];
  const dm = Object.fromEntries(docs.map((d) => [d.id, d]));
  docs.filter((d) => d.number && ['facture', 'avoir', 'acompte'].includes(d.kind)).forEach((d) => {
    const av = d.kind === 'avoir', ttc = Number(d.totals?.ttc || 0), ht = Number(d.totals?.ht || 0), who = clientName(cm[d.client_id]);
    const e = (acc, debit, credit) => out.push({ date: d.issue_date, journal: 'VE', acc, piece: d.number, lib: `${d.number} ${who}`, debit: r2(debit), credit: r2(credit) });
    e('411000', av ? 0 : ttc, av ? ttc : 0);
    e(d.kind === 'acompte' ? '419100' : '706000', av ? ht : 0, av ? 0 : ht);
    const tva = Number(d.totals?.tva || 0); if (tva) e('445710', av ? tva : 0, av ? 0 : tva);
  });
  pays.forEach((p) => { const d = dm[p.document_id];
    out.push({ date: p.paid_on, journal: 'BQ', acc: '512000', piece: d?.number || '', lib: `Règlement ${d?.number || ''}`, debit: r2(p.amount), credit: 0 });
    out.push({ date: p.paid_on, journal: 'BQ', acc: '411000', piece: d?.number || '', lib: `Règlement ${d?.number || ''}`, debit: 0, credit: r2(p.amount) }); });
  purchases.forEach((p) => { const ht = Number(p.amount_ht || 0), v = Number(p.vat || 0);
    out.push({ date: p.date, journal: 'HA', acc: '607000', piece: p.label || 'ACHAT', lib: `${p.supplier} ${p.label}`.trim(), debit: r2(ht), credit: 0 });
    if (v) out.push({ date: p.date, journal: 'HA', acc: '445660', piece: p.label || 'ACHAT', lib: `${p.supplier} ${p.label}`.trim(), debit: r2(v), credit: 0 });
    out.push({ date: p.date, journal: 'HA', acc: '401000', piece: p.label || 'ACHAT', lib: `${p.supplier} ${p.label}`.trim(), debit: 0, credit: r2(ht + v) }); });
  return out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function AdminCompta() {
  const { company } = useApp();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [view, setView] = useState('synthese');
  const [acc, setAcc] = useState('411000');
  const [b] = useData(async () => {
    if (!company) return null;
    const from = `${year}-01-01`, to = `${year}-12-31`;
    const [docs, pays, purchases, clients] = await Promise.all([
      api.select('documents', { company_id: company.id }, { order: 'issue_date.asc' }),
      api.select('payments', { company_id: company.id }, { order: 'paid_on.asc' }),
      api.select('purchases', { company_id: company.id }, { order: 'date.asc' }),
      api.select('clients', { company_id: company.id }),
    ]);
    const inY = (d) => d && d >= from && d <= to;
    return { docs, ydocs: docs.filter((d) => inY(d.issue_date)), pays: pays.filter((p) => inY(p.paid_on)), purchases: purchases.filter((p) => inY(p.date)), cm: Object.fromEntries(clients.map((c) => [c.id, c])) };
  }, [company?.id, year]);
  if (!b) return <div className="content"><TopBar title={t('Tableau des comptes')} /><Loader /></div>;
  const E = buildEntries(b.ydocs, b.pays, b.purchases, b.cm);
  const bal = {}; E.forEach((e) => { bal[e.acc] = bal[e.acc] || { d: 0, c: 0 }; bal[e.acc].d += e.debit; bal[e.acc].c += e.credit; });
  const solde = (k) => r2((bal[k]?.d || 0) - (bal[k]?.c || 0));
  const ca = -solde('706000'), achats = solde('607000'), tvaC = -solde('445710'), tvaD = solde('445660');
  const months = Array.from({ length: 12 }, (_, i) => { const m = `${year}-${String(i + 1).padStart(2, '0')}`;
    const f = (j, k, sgn = 1) => r2(E.filter((e) => e.journal === j && e.acc === k && String(e.date).startsWith(m)).reduce((s, e) => s + sgn * (e.credit - e.debit), 0));
    return { m, ca: f('VE', '706000'), enc: -f('BQ', '512000'), achats: -f('HA', '607000'), tva: f('VE', '445710') + f('HA', '445660') }; });
  const maxBar = Math.max(1, ...months.map((x) => Math.max(x.ca, x.enc)));
  // Factures non soldées (toutes années) et ancienneté
  const unpaid = b.docs.filter((d) => d.kind === 'facture' && d.number && !['payee', 'annulee'].includes(d.status)).map((d) => {
    const due = d.due_date || d.issue_date; const late = Math.floor((Date.now() - new Date(due)) / 864e5);
    return { ...d, late, rest: Number(d.totals?.ttc || 0) - Number(d.paid_amount || 0) };
  }).filter((d) => d.rest > 0.009);
  const aging = [[t('Non échu'), (d) => d.late <= 0], [t('1 à 30 j'), (d) => d.late > 0 && d.late <= 30], [t('31 à 60 j'), (d) => d.late > 30 && d.late <= 60], [t('Plus de 60 j'), (d) => d.late > 60]]
    .map(([l, f]) => [l, r2(unpaid.filter(f).reduce((s, d) => s + d.rest, 0))]);
  const csvEntries = () => {
    const rows = [['Date', 'Journal', 'Compte', 'Intitulé', 'Pièce', 'Libellé', 'Débit', 'Crédit'], ...E.map((e) => [e.date, e.journal, e.acc, ACC[e.acc], e.piece, e.lib, String(e.debit).replace('.', ','), String(e.credit).replace('.', ',')])];
    download(new Blob(['﻿' + rows.map((r) => r.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), `journal-artesa-${year}.csv`);
  };
  return (
    <div className="content">
      <TopBar title={t('Tableau des comptes')} sub={t('Calculé automatiquement depuis vos factures, paiements et achats')} />
      <div className="row wrap mb" style={{ gap: 8 }}>
        <select className="input" style={{ maxWidth: 120 }} value={year} onChange={(e) => setYear(e.target.value)} aria-label={t('Année')}>{[0, 1, 2].map((i) => String(new Date().getFullYear() - i)).map((y) => <option key={y}>{y}</option>)}</select>
        <Chips options={[['synthese', t('Synthèse')], ['balance', t('Balance')], ['grandlivre', t('Grand livre')], ['journal', t('Journal')]]} value={view} onChange={setView} />
      </div>
      <div className="kpis mb">
        <div className="kpi"><small>{t('Chiffre d’affaires HT')}</small><b>{money0(ca)}</b></div>
        <div className="kpi"><small>{t('Achats HT')}</small><b>{money0(achats)}</b></div>
        <div className="kpi"><small>{t('Résultat avant impôt (estimé)')}</small><b className={ca - achats < 0 ? 'red-t' : ''}>{money0(ca - achats)}</b></div>
        <div className="kpi"><small>{t('TVA à reverser')}</small><b>{money0(tvaC - tvaD)}</b></div>
        <div className="kpi"><small>{t('Trésorerie encaissée')}</small><b>{money0(solde('512000') + 0)}</b><span className="small muted">{t('hors achats payés')}</span></div>
        <div className="kpi"><small>{t('À encaisser')}</small><b>{money0(unpaid.reduce((s, d) => s + d.rest, 0))}</b><span className="small muted">{t('{n} factures', { n: unpaid.length })}</span></div>
      </div>
      {view === 'synthese' && <div className="grid2">
        <div>
          <Sec title={t('Facturé et encaissé par mois')} />
          <div className="card soft"><div className="abars two" role="img" aria-label={t('Facturé et encaissé par mois')}>
            {months.map((x) => <div key={x.m} className="bar" title={`${x.m} : ${money0(x.ca)} / ${money0(x.enc)}`}><span style={{ height: `${(x.ca / maxBar) * 100}%` }} /><span className="b2" style={{ height: `${(x.enc / maxBar) * 100}%` }} /><small>{x.m.slice(5)}</small></div>)}
          </div><div className="small muted mt"><span className="dot" /> {t('Facturé HT')} · <span className="dot b2" /> {t('Encaissé TTC')}</div></div>
          <Sec title={t('TVA par mois')} meta={t('collectée − déductible')} />
          <Table rows={months.filter((x) => x.tva || x.ca).map((x) => ({ id: x.m, ...x }))} empty={t('Rien sur l’année')} cols={[{ label: t('Mois'), render: (x) => x.m }, { label: t('CA HT'), num: true, render: (x) => money(x.ca) }, { label: t('TVA à reverser'), num: true, render: (x) => money(x.tva) }]} />
        </div>
        <div>
          <Sec title={t('Factures à encaisser')} meta={t('toutes années')} />
          <div className="kv">{aging.map(([l, v]) => <div key={l} className="r"><span>{l}</span><b className={v && l !== t('Non échu') ? 'red-t' : ''}>{money(v)}</b></div>)}</div>
          {unpaid.slice(0, 8).map((d) => <div key={d.id} className="li" style={{ cursor: 'pointer' }} onClick={() => navigate('/pro/documents/' + d.id)}><span><b>{d.number}</b> · {clientName(b.cm[d.client_id])}</span><span className={d.late > 0 ? 'red-t bold' : ''}>{money(d.rest)}{d.late > 0 ? ' · ' + t('{n} j de retard', { n: d.late }) : ''}</span></div>)}
          <div className="btns mt">
            <button className="btn ghost" onClick={() => navigate('/pro/crm/export')}><LuDownload /> {t('Export comptable (Excel, FEC)')}</button>
            <button className="btn ghost" onClick={csvEntries}><LuDownload /> {t('Journal des écritures (CSV)')}</button>
            <button className="btn ghost" onClick={() => navigate('/pro/relances')}><LuBellRing /> {t('Relancer les impayés')}</button>
          </div>
          <LawRefs ids={['com-L123-22', 'lpf-L102B', 'cgi-289']} title={t('Conservation et obligations')} />
        </div>
      </div>}
      {view === 'balance' && <Table rows={Object.keys(bal).sort().map((k) => ({ id: k, k }))} empty={t('Aucune écriture sur l’année')} cols={[
        { label: t('Compte'), render: (x) => <button className="link bold" onClick={() => { setAcc(x.k); setView('grandlivre'); }}>{x.k}</button> },
        { label: t('Intitulé'), render: (x) => t(ACC[x.k] || x.k) },
        { label: t('Débit'), num: true, render: (x) => money(bal[x.k].d) }, { label: t('Crédit'), num: true, render: (x) => money(bal[x.k].c) },
        { label: t('Solde'), num: true, render: (x) => <b>{money(solde(x.k))}</b> }]} />}
      {view === 'grandlivre' && <>
        <select className="input mb" style={{ maxWidth: 360 }} value={acc} onChange={(e) => setAcc(e.target.value)} aria-label={t('Compte')}>{Object.keys(ACC).map((k) => <option key={k} value={k}>{k} · {t(ACC[k])}</option>)}</select>
        <Table rows={E.filter((e) => e.acc === acc).map((e, i) => ({ id: i, ...e }))} empty={t('Aucune écriture sur ce compte')} cols={[
          { label: t('Date'), render: (e) => date(e.date) }, { label: t('Journal'), render: (e) => e.journal }, { label: t('Libellé'), render: (e) => e.lib },
          { label: t('Débit'), num: true, render: (e) => (e.debit ? money(e.debit) : '') }, { label: t('Crédit'), num: true, render: (e) => (e.credit ? money(e.credit) : '') }]} />
        <p className="small muted">{t('Solde du compte : {s}', { s: money(solde(acc)) })}</p>
      </>}
      {view === 'journal' && <>
        <button className="btn ghost sm mb" onClick={csvEntries}><LuDownload /> {t('Télécharger (CSV)')}</button>
        <Table rows={E.map((e, i) => ({ id: i, ...e }))} empty={t('Aucune écriture sur l’année')} cols={[
          { label: t('Date'), render: (e) => date(e.date) }, { label: t('Journal'), render: (e) => e.journal }, { label: t('Compte'), render: (e) => e.acc },
          { label: t('Libellé'), render: (e) => e.lib }, { label: t('Débit'), num: true, render: (e) => (e.debit ? money(e.debit) : '') }, { label: t('Crédit'), num: true, render: (e) => (e.credit ? money(e.credit) : '') }]} />
      </>}
      <p className="small faint mt">{t('Comptabilité de trésorerie simplifiée, calculée à partir des documents d’Artesa. Elle prépare le travail de l’expert-comptable et ne le remplace pas.')}</p>
    </div>
  );
}

// ─────────────── Facturation électronique ───────────────
export function AdminEInvoice() {
  const { company } = useApp();
  const [b] = useData(async () => (company ? api.select('documents', { company_id: company.id }, { order: 'issue_date.desc', limit: 200 }) : []), [company?.id]);
  if (!b) return <div className="content"><TopBar title={t('Facturation électronique')} /><Loader /></div>;
  const c = company || {};
  const checks = [
    [!!String(c.siret || '').replace(/\D/g, '').match(/^\d{14}$/), t('SIRET de l’entreprise (14 chiffres)')],
    [c.vat_regime === 'franchise' || /^FR\d{11}$/.test(String(c.vat_number || '').replace(/\s/g, '')), t('N° de TVA intracommunautaire (ou franchise de TVA)')],
    [!!(c.address && c.zip && c.city), t('Adresse complète')],
    [!!c.legal_form, t('Forme juridique')],
    [!!c.email, t('E-mail de facturation')],
  ];
  const ok = checks.every(([v]) => v);
  const inv = b.filter((d) => d.number && ['facture', 'avoir', 'acompte'].includes(d.kind));
  return (
    <div className="content">
      <TopBar title={t('Facturation électronique')} sub={t('Réforme 2026–2027')} />
      <div className="grid2">
        <div>
          <Sec title={t('Où en est Artesa ?')} />
          <div className="kv">
            <div className="r"><span>{t('Format des factures')}</span><b className="green-t"><LuCircleCheck size={14} /> Factur-X (PDF + XML)</b></div>
            <div className="r"><span>{t('Plateforme agréée (envoi et réception)')}</span><b className="muted"><LuClock size={14} /> {t('Pas encore connectée')}</b></div>
            <div className="r"><span>{t('Réception obligatoire')}</span><b>{t('depuis le 1er septembre 2026')}</b></div>
            <div className="r"><span>{t('Émission obligatoire (PME, micro)')}</span><b>{t('à partir du 1er septembre 2027')}</b></div>
          </div>
          <Sec title={t('Informations obligatoires')} />
          <div className="list">{checks.map(([v, l]) => <div key={l} className="li"><span>{l}</span>{v ? <LuCircleCheck className="green-t" /> : <LuCircleAlert className="red-t" />}</div>)}</div>
          {!ok && <button className="btn ghost sm mt" onClick={() => navigate('/pro/compte/entreprise')}>{t('Compléter les infos Artesa')} <LuArrowRight /></button>}
          <Sec title={t('Prochaine étape : Super PDP')} />
          <div className="card soft small" style={{ lineHeight: 1.6 }}>
            <p style={{ marginTop: 0 }}>{t('Super PDP est une plateforme agréée : elle transmettra nos factures et celles des artisans au format officiel, et recevra les factures des fournisseurs.')}</p>
            <ol style={{ paddingLeft: 18, margin: 0 }}>
              <li>{t('Créer le compte de test Super PDP (gratuit) une fois la société immatriculée.')}</li>
              <li>{t('Ajouter la clé dans les réglages Supabase (jamais dans le chat).')}</li>
              <li>{t('Envoyer une facture de test, vérifier le statut « Déposée », puis passer en production (0,01 € HT par facture).')}</li>
            </ol>
          </div>
          <LawRefs ids={['cgi-289', 'cgi-289bis', 'cgi-242nonies', 'cgi-1737']} title={t('Textes de loi')} />
        </div>
        <div>
          <Sec title={t('Factures émises par Artesa')} meta={t('{n} documents', { n: inv.length })} />
          <Table rows={inv} empty={t('Aucune facture pour l’instant')} cols={[
            { label: t('N°'), render: (d) => <button className="link bold" onClick={() => navigate('/pro/documents/' + d.id)}>{d.number}</button> },
            { label: t('Date'), render: (d) => date(d.issue_date) },
            { label: t('TTC'), num: true, render: (d) => money(d.totals?.ttc) },
            { label: t('Statut d’envoi'), render: () => <Pill c="grey">{t('Factur-X prêt')}</Pill> }]} />
          <p className="small muted">{t('Chaque facture se télécharge au format Factur-X depuis sa fiche. L’envoi automatique par la plateforme agréée sera activé avec Super PDP.')}</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────── Juridique ───────────────
export function AdminLegal() {
  const pages = [['/mentions-legales', 'Mentions légales'], ['/cgu', 'CGU'], ['/cgv', 'CGV artisans'], ['/confidentialite', 'Confidentialité'], ['/sous-traitance', 'Sous-traitance RGPD'], ['/signaler', 'Signaler un contenu']];
  return (
    <div className="content">
      <TopBar title={t('Juridique')} sub={t('Pages légales et conformité')} />
      <div className="notice">{t('À faire avant le lancement : compléter les informations de la société (en orange dans les mentions légales), choisir un médiateur de la consommation et faire relire les textes par un avocat.')}</div>
      <div className="atiles mt">{pages.map(([to, l]) => <Tile key={to} to={to} icon={LuScale} label={t(l)} tone="light" />)}</div>
      <Sec title={t('Ce qui est en place')} />
      <ul className="small" style={{ lineHeight: 1.8 }}>
        <li>{t('Bouton de rétractation en ligne sur les devis des particuliers, avec accusé de réception')}</li>
        <li>{t('Signalement des contenus et décisions motivées')}</li>
        <li>{t('Explication du classement et du contrôle des avis')}</li>
        <li>{t('Vérification d’identité des dirigeants, copies supprimées après contrôle')}</li>
        <li>{t('Mention de franchise de TVA mise à jour automatiquement au 1er janvier 2027')}</li>
      </ul>
      <LawRefs ids={['conso-L111-7', 'conso-L111-7-2', 'conso-L221-21', 'dsa-16', 'rgpd-5', 'lcen-1-1']} />
    </div>
  );
}
