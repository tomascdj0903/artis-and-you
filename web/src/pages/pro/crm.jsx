import { useState } from 'react';
import { LuFileSpreadsheet, LuPlus, LuChevronRight, LuDownload, LuMail, LuPencil, LuCamera, LuTrash2, LuCopy, LuX } from 'react-icons/lu';
import { api } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate } from '../../lib/router.jsx';
import { t, locale } from '../../lib/i18n.js';
import { money, money0, date, clientName, iso, num } from '../../lib/format.js';
import { STEPS, autoSteps, stepState, ALL_TRADES, VAT_RATES, kindLabel } from '../../lib/docs.js';
import { makeXlsx, download } from '../../lib/xlsx.js';
import { TopBar, SearchBar, Sec, Sheet, Field, Chips, Seg, useData, Loader, Empty, Pill, Table } from '../../ui/index.jsx';
import { KpiView } from './kpi.jsx';

export function CrmHome() {
  const { can } = useApp();
  const [q, setQ] = useState('');
  return (
    <div className="content">
      <TopBar title={t('CRM')} back={false} />
      <SearchBar placeholder={t('Recherchez un client')} value={q} onChange={setQ} onSubmit={() => q && navigate('/pro/recherche?q=' + encodeURIComponent(q))} />
      <div className="tiles home" style={{ marginTop: 10 }}>
        <button className="tile" onClick={() => navigate('/pro/crm/statut')}>{t('Statut projet')}</button>
        {can('kpi') && <button className="tile" onClick={() => navigate('/pro/crm/kpi')}>{t('KPI')}</button>}
        {can('prix') && <button className="tile wide" onClick={() => navigate('/pro/crm/bibliotheque')}>{t('Ma bibliothèque')}</button>}
        {can('kpi') && <button className="tile wide" onClick={() => navigate('/pro/crm/export')}><LuFileSpreadsheet /> {t('Export comptable')}</button>}
      </div>
    </div>
  );
}

export function ProjectStatus() {
  const { company, run } = useApp();
  const [q, setQ] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [add, setAdd] = useState(false);
  const [b, reload] = useData(async () => {
    const [projects, clients, docs, appts, reviews] = await Promise.all([
      api.select('projects', { company_id: company.id }, { order: 'created_at.desc' }), api.select('clients', { company_id: company.id }),
      api.select('documents', { company_id: company.id }), api.select('appointments', { company_id: company.id }), api.select('reviews', { company_id: company.id }),
    ]);
    return { projects, cm: Object.fromEntries(clients.map((c) => [c.id, c])), clients, ctx: { docs, appts, reviews } };
  }, []);
  if (!b) return <div className="content"><TopBar title={t('Statut projet')} /><Loader /></div>;
  const rows = b.projects.map((p) => ({ p, auto: autoSteps(p, b.ctx) }))
    .filter(({ p, auto }) => (showDone || !(stepState(p, auto, 'avis_poste') !== 'off')) && (!q || (p.title + ' ' + clientName(b.cm[p.client_id])).toLowerCase().includes(q.toLowerCase())));
  const toggle = async (p, auto, k) => {
    const s = stepState(p, auto, k);
    const manual = { ...(p.manual || {}) };
    if (s === 'auto') manual[k] = false; else if (s === 'man') delete manual[k]; else manual[k] = true;
    if (s === 'off' && auto[k] && p.manual?.[k] === false) delete manual[k];
    await run(() => api.update('projects', { id: p.id }, { manual }));
    reload();
  };
  return (
    <div className="content" style={{ maxWidth: 1300 }}>
      <TopBar title={t('Statut projet')} sub={t('{n} projets en cours', { n: rows.length })} />
      <SearchBar placeholder={t('Recherchez un projet ou un client')} value={q} onChange={setQ} />
      <div className="row wrap small mb" style={{ gap: 14 }}>
        <span className="row"><span className="ck auto" style={{ width: 18, height: 18, borderRadius: 9, background: 'var(--vert)', display: 'inline-block' }} /> {t('Automatique')}</span>
        <span className="row"><span style={{ width: 18, height: 18, borderRadius: 9, border: '2px solid var(--vert)', display: 'inline-block' }} /> {t('Coché à la main')}</span>
        <span className="row"><span style={{ width: 18, height: 18, borderRadius: 9, border: '2px solid var(--line-2)', display: 'inline-block' }} /> {t('À venir')}</span>
        <label className="check" style={{ padding: 0, marginLeft: 'auto' }}><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />{t('Afficher les projets terminés')}</label>
      </div>
      <p className="small faint">{t('Touchez une case pour la cocher ou la décocher.')}</p>
      {!rows.length ? <Empty text={t('Aucun projet. Les projets sont créés avec les demandes de RDV, les devis ou le bouton +.')} /> : (
        <div className="sp">
          <table>
            <thead><tr><th>{t('Client')}</th>{STEPS.map(([k, l]) => <th key={k} className="v"><span>{t(l)}</span></th>)}</tr></thead>
            <tbody>{rows.map(({ p, auto }) => (
              <tr key={p.id}>
                <td><b style={{ cursor: 'pointer' }} onClick={() => p.client_id && navigate('/pro/clients/' + p.client_id)}>{clientName(b.cm[p.client_id])}</b><div className="small faint">{p.title}</div></td>
                {STEPS.map(([k, l]) => { const s = stepState(p, auto, k); return <td key={k}><button className={'ck ' + (s === 'auto' ? 'auto' : s === 'man' ? 'man' : '')} onClick={() => toggle(p, auto, k)} aria-label={t(l)} title={t(l)}>✓</button></td>; })}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <button className="fab" onClick={() => setAdd(true)} aria-label={t('Nouveau projet')}><LuPlus /></button>
      <NewProject open={add} clients={b.clients} onClose={() => setAdd(false)} onDone={() => { setAdd(false); reload(); }} />
    </div>
  );
}
function NewProject({ open, clients, onClose, onDone }) {
  const { company, run } = useApp();
  const [v, setV] = useState({ client_id: '', title: '', address: '' });
  if (!open) return null;
  return (
    <Sheet open onClose={onClose} title={t('Nouveau projet')}>
      <Field label={t('Client')}><select value={v.client_id} onChange={(e) => { const c = clients.find((x) => x.id === e.target.value); setV({ ...v, client_id: e.target.value, address: c ? [c.site_address, c.site_city].filter(Boolean).join(' ') : '' }); }}><option value="">{t('Choisir un client')}</option>{clients.map((c) => <option key={c.id} value={c.id}>{clientName(c)}</option>)}</select></Field>
      <Field label={t('Intitulé')}><input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder={t('ex. Rénovation salle de bains')} /></Field>
      <Field label={t('Adresse du chantier')}><input value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
      <button className="btn block" disabled={!v.client_id || !v.title} onClick={() => run(() => api.insert('projects', { ...v, company_id: company.id }), t('Projet créé')).then(onDone)}>{t('Créer')}</button>
    </Sheet>
  );
}

export function CompanyKpi() {
  const { company } = useApp();
  const [q, setQ] = useState('');
  const [b] = useData(async () => {
    const [docs, appts, clients] = await Promise.all([api.select('documents', { company_id: company.id }), api.select('appointments', { company_id: company.id }), api.select('clients', { company_id: company.id })]);
    return { docs, appts, cm: Object.fromEntries(clients.map((c) => [c.id, c])) };
  }, []);
  if (!b) return <div className="content"><TopBar title={t('KPI')} /><Loader /></div>;
  const match = (cid) => !q || clientName(b.cm[cid]).toLowerCase().includes(q.toLowerCase());
  return (
    <div className="content">
      <TopBar title={t('KPI')} sub={q ? q : t('Tous les clients')} />
      <SearchBar placeholder={t('Recherchez un client')} value={q} onChange={setQ} />
      <KpiView docs={b.docs.filter((d) => match(d.client_id))} appts={b.appts.filter((a) => match(a.client_id))} />
    </div>
  );
}

// ─────────────── Export comptable ───────────────
function periodRange(kind, ref) {
  const d = new Date(ref + '-01T12:00:00');
  if (kind === 'month') return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
  if (kind === 'quarter') { const q = Math.floor(d.getMonth() / 3) * 3; return [iso(new Date(d.getFullYear(), q, 1)), iso(new Date(d.getFullYear(), q + 3, 0))]; }
  return [iso(new Date(d.getFullYear(), 0, 1)), iso(new Date(d.getFullYear(), 11, 31))];
}
export function Export() {
  const { company, run, toast } = useApp();
  const [kind, setKind] = useState('month');
  const [ref, setRef] = useState(iso(new Date()).slice(0, 7));
  const [purchase, setPurchase] = useState(false);
  const [from, to] = periodRange(kind, ref);
  const [b, reload] = useData(async () => {
    const [docs, pays, purchases, clients] = await Promise.all([
      api.select('documents', { company_id: company.id, 'issue_date>=': from, 'issue_date<=': to }, { order: 'issue_date.asc' }),
      api.select('payments', { company_id: company.id, 'paid_on>=': from, 'paid_on<=': to }, { order: 'paid_on.asc' }),
      api.select('purchases', { company_id: company.id, 'date>=': from, 'date<=': to }, { order: 'date.asc' }),
      api.select('clients', { company_id: company.id }),
    ]);
    const allDocs = pays.length ? await api.select('documents', { id: [...new Set(pays.map((p) => p.document_id))] }) : [];
    return { inv: docs.filter((d) => d.number && d.kind !== 'devis'), pays, purchases, cm: Object.fromEntries(clients.map((c) => [c.id, c])), dm: Object.fromEntries(allDocs.map((d) => [d.id, d])) };
  }, [from, to]);
  const label = kind === 'month' ? new Date(ref + '-15').toLocaleDateString(locale(), { month: 'long', year: 'numeric' }) : kind === 'quarter' ? `T${Math.floor(new Date(ref + '-15').getMonth() / 3) + 1} ${ref.slice(0, 4)}` : ref.slice(0, 4);
  const fname = `Export_${(company.trade_name || company.name).replace(/\W+/g, '')}_${kind === 'month' ? ref : kind === 'quarter' ? ref.slice(0, 4) + '-T' + (Math.floor(new Date(ref + '-15').getMonth() / 3) + 1) : ref.slice(0, 4)}`;
  if (!b) return <div className="content"><TopBar title={t('Export comptable')} /><Loader /></div>;
  const sgn = (d) => (d.kind === 'avoir' ? -1 : 1);
  const ventes = b.inv.map((d) => [d.issue_date, d.number, kindLabel(d.kind), clientName(b.cm[d.client_id]), d.object, sgn(d) * Number(d.totals?.ht || 0), sgn(d) * Number(d.totals?.tva || 0), sgn(d) * Number(d.totals?.ttc || 0), (d.totals?.vat || []).map((v) => v.rate + '%').join(' ')]);
  const enc = b.pays.map((p) => [p.paid_on, b.dm[p.document_id]?.number || '', clientName(b.cm[b.dm[p.document_id]?.client_id]), t(p.method), p.via_platform ? 'Artis & You' : t('Manuel'), Number(p.amount)]);
  const achats = b.purchases.map((p) => [p.date, p.supplier, p.label, Number(p.amount_ht), Number(p.vat), Number(p.amount_ht) + Number(p.vat)]);
  const vatRates = {};
  b.inv.forEach((d) => (d.totals?.vat || []).forEach((v) => { vatRates[v.rate] = vatRates[v.rate] || { base: 0, tva: 0 }; vatRates[v.rate].base += sgn(d) * v.base; vatRates[v.rate].tva += sgn(d) * v.amount; }));
  const collected = Object.values(vatRates).reduce((s, v) => s + v.tva, 0);
  const deductible = b.purchases.reduce((s, p) => s + Number(p.vat), 0);
  const tvaRows = [...Object.entries(vatRates).map(([r, v]) => [t('TVA collectée {r} %', { r }), Math.round(v.base * 100) / 100, Math.round(v.tva * 100) / 100]), [t('TVA déductible (achats)'), '', Math.round(deductible * 100) / 100], [t('TVA à reverser'), '', Math.round((collected - deductible) * 100) / 100]];
  const sum = (rows, i) => rows.reduce((s, r) => s + (Number(r[i]) || 0), 0);
  const excel = async () => {
    const blob = await makeXlsx([
      { name: 'Ventes', rows: [[t('Date'), t('N° facture'), t('Type'), t('Client'), t('Objet'), t('Total HT'), t('TVA'), t('Total TTC'), t('Taux')], ...ventes] },
      { name: 'Encaissements', rows: [[t('Date'), t('N° facture'), t('Client'), t('Moyen'), t('Origine'), t('Montant')], ...enc] },
      { name: 'Achats', rows: [[t('Date'), t('Fournisseur'), t('Libellé'), t('HT'), t('TVA'), t('TTC')], ...achats] },
      { name: 'TVA', rows: [[t('Ligne'), t('Base HT'), t('Montant')], ...tvaRows] },
    ]);
    download(blob, fname + '.xlsx');
    return blob;
  };
  const fec = () => {
    const f2 = (n) => (Math.round(Math.abs(n) * 100) / 100).toFixed(2).replace('.', ',');
    const dd = (s) => s.replace(/-/g, '');
    const lines = [['JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib', 'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit', 'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise']];
    let n = 0;
    const push = (j, jl, date_, compte, clib, aux, auxl, piece, lib, debit, credit) => lines.push([j, jl, String(n), dd(date_), compte, clib, aux, auxl, piece, dd(date_), lib, f2(debit), f2(credit), '', '', dd(date_), '', '']);
    b.inv.forEach((d) => {
      n++; const c = b.cm[d.client_id]; const aux = c?.number || 'CLIENT'; const av = d.kind === 'avoir';
      const ttc = Number(d.totals?.ttc || 0), ht = Number(d.totals?.ht || 0);
      push('VE', 'Ventes', d.issue_date, '411000', 'Clients', aux, clientName(c), d.number, d.object, av ? 0 : ttc, av ? ttc : 0);
      push('VE', 'Ventes', d.issue_date, '706000', 'Prestations de services', '', '', d.number, d.object, av ? ht : 0, av ? 0 : ht);
      (d.totals?.vat || []).filter((v) => v.amount).forEach((v) => push('VE', 'Ventes', d.issue_date, '445710', 'TVA collectée ' + v.rate + '%', '', '', d.number, d.object, av ? v.amount : 0, av ? 0 : v.amount));
    });
    b.pays.forEach((p) => { n++; const d = b.dm[p.document_id]; const c = b.cm[d?.client_id];
      push('BQ', 'Banque', p.paid_on, '512000', 'Banque', '', '', d?.number || '', 'Règlement ' + (d?.number || ''), p.amount, 0);
      push('BQ', 'Banque', p.paid_on, '411000', 'Clients', c?.number || 'CLIENT', clientName(c), d?.number || '', 'Règlement ' + (d?.number || ''), 0, p.amount); });
    b.purchases.forEach((p) => { n++;
      push('HA', 'Achats', p.date, '607000', 'Achats', '', '', p.label || 'ACHAT', p.label, p.amount_ht, 0);
      if (Number(p.vat)) push('HA', 'Achats', p.date, '445660', 'TVA déductible', '', '', p.label || 'ACHAT', p.label, p.vat, 0);
      push('HA', 'Achats', p.date, '401000', 'Fournisseurs', 'FOUR', p.supplier, p.label || 'ACHAT', p.label, 0, Number(p.amount_ht) + Number(p.vat)); });
    const blob = new Blob([lines.map((l) => l.join('\t')).join('\r\n')], { type: 'text/plain;charset=utf-8' });
    download(blob, `${(company.siren || '000000000').replace(/\D/g, '')}FEC${dd(to)}.txt`);
  };
  const toAccountant = async () => {
    await excel();
    const a = company.accountant || {};
    if (!a.email) toast(t('Ajoutez l’e-mail de votre comptable dans Paramètres → Intégrations.'), true);
    window.location.href = `mailto:${a.email || ''}?subject=${encodeURIComponent(t('Export comptable {p} — {c}', { p: label, c: company.name }))}&body=${encodeURIComponent(t('Bonjour {n},\n\nVous trouverez ci-joint l’export comptable de {p} (ventes, encaissements, achats, TVA).\n\nBien cordialement,\n{c}', { n: a.name || '', p: label, c: company.name }))}`;
  };
  return (
    <div className="content">
      <TopBar title={t('Export comptable')} sub={t('Pour votre comptable')} />
      <Chips options={[['month', t('Mois')], ['quarter', t('Trimestre')], ['year', t('Année')]]} value={kind} onChange={setKind} />
      <div className="row mb"><input type="month" className="input" style={{ maxWidth: 220 }} value={ref} onChange={(e) => setRef(e.target.value)} aria-label={t('Période')} /><b style={{ textTransform: 'capitalize' }}>{label}</b></div>
      <div className="card navy row"><div className="ficon" style={{ background: '#fff' }}><LuFileSpreadsheet className="green-t" /></div><div><b>{fname}.xlsx</b><div className="small muted">{t('Généré automatiquement · du {a} au {b}', { a: date(from), b: date(to) })}</div></div></div>
      <div className="grid2">
        <div>
          <Sec title={t('Contenu du fichier')} />
          <div className="kv">
            <div className="r"><span><b>{t('Onglet « Ventes »')}</b><div className="small muted">{t('{n} factures', { n: ventes.length })}</div></span><b>{money0(sum(ventes, 5))} {t('HT')}</b></div>
            <div className="r"><span><b>{t('Onglet « Encaissements »')}</b><div className="small muted">{t('{n} paiements', { n: enc.length })}</div></span><b>{money0(sum(enc, 5))} {t('TTC')}</b></div>
            <div className="r"><span><b>{t('Onglet « Achats »')}</b><div className="small muted">{t('{n} justificatifs', { n: achats.length })}</div></span><b>{money0(sum(achats, 3))} {t('HT')}</b></div>
            <div className="r"><span><b>{t('Onglet « TVA »')}</b><div className="small muted">{t('Collectée / déductible')}</div></span><b>{money0(collected - deductible)} {t('à reverser')}</b></div>
          </div>
          <button className="btn ghost sm mt" onClick={() => setPurchase(true)}><LuPlus /> {t('Ajouter un achat')}</button>
        </div>
        <div>
          <Sec title={t('Aperçu')} meta={t('Onglet « Ventes »')} />
          <Table rows={ventes.slice(0, 8).map((r, i) => ({ id: i, r }))} empty={t('Aucune facture sur la période')} cols={[
            { label: t('Date'), render: (x) => <span className="small">{date(x.r[0])}</span> }, { label: t('N° facture'), render: (x) => <span className="small bold">{x.r[1]}</span> },
            { label: t('Client'), render: (x) => <span className="small">{x.r[3]}</span> }, { label: t('Total HT'), num: true, render: (x) => money(x.r[5]) }]} />
        </div>
      </div>
      <div className="btns inline">
        <button className="btn" onClick={() => run(excel, t('Fichier Excel téléchargé'))}><LuDownload /> {t('Télécharger le fichier Excel')}</button>
        <div className="two"><button className="btn ghost" onClick={() => run(async () => fec(), t('FEC téléchargé'))}>{t('Télécharger le FEC')}</button><button className="btn ghost" onClick={toAccountant}><LuMail /> {t('Envoyer à mon comptable')}</button></div>
      </div>
      <PurchaseSheet open={purchase} onClose={() => setPurchase(false)} onDone={() => { setPurchase(false); reload(); }} />
    </div>
  );
}
function PurchaseSheet({ open, onClose, onDone }) {
  const { company, run } = useApp();
  const [v, setV] = useState({ date: iso(new Date()), supplier: '', label: '', amount_ht: '', vat: '' });
  if (!open) return null;
  return (
    <Sheet open onClose={onClose} title={t('Ajouter un achat')}>
      <div className="form-grid two">
        <Field label={t('Date')}><input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
        <Field label={t('Fournisseur')}><input value={v.supplier} onChange={(e) => setV({ ...v, supplier: e.target.value })} /></Field>
        <Field label={t('Montant HT (€)')}><input type="number" step="0.01" value={v.amount_ht} onChange={(e) => setV({ ...v, amount_ht: e.target.value, vat: v.vat || String(Math.round(Number(e.target.value) * 20) / 100) })} /></Field>
        <Field label={t('TVA (€)')}><input type="number" step="0.01" value={v.vat} onChange={(e) => setV({ ...v, vat: e.target.value })} /></Field>
      </div>
      <Field label={t('Libellé')}><input value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} placeholder={t('ex. Facture fournisseur F-1234')} /></Field>
      <button className="btn block" onClick={() => run(() => api.insert('purchases', { ...v, amount_ht: Number(v.amount_ht) || 0, vat: Number(v.vat) || 0, company_id: company.id }), t('Achat ajouté')).then(onDone)}>{t('Enregistrer')}</button>
    </Sheet>
  );
}

// ─────────────── Bibliothèque ───────────────
export function Library() {
  const { company } = useApp();
  const [tab, setTab] = useState('article');
  const [fam, setFam] = useState('');
  const [q, setQ] = useState('');
  const [items] = useData(() => api.select('items', { company_id: company.id }, { order: 'name.asc' }), []);
  if (!items) return <div className="content"><TopBar title={t('Ma bibliothèque')} /><Loader /></div>;
  const families = [...new Set(items.filter((i) => i.kind === tab).map((i) => i.family).filter(Boolean))];
  const list = items.filter((i) => i.kind === tab && (!fam || i.family === fam) && (!q || (i.name + ' ' + i.ref + ' ' + i.family).toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="content">
      <TopBar title={t('Ma bibliothèque')} sub={(company.trades || []).slice(0, 2).map(t).join(' · ')} />
      <SearchBar placeholder={t('Recherchez un produit')} value={q} onChange={setQ} />
      <Seg options={[['article', t('Articles · {n}', { n: items.filter((i) => i.kind === 'article').length })], ['ouvrage', t('Ouvrages · {n}', { n: items.filter((i) => i.kind === 'ouvrage').length })]]} value={tab} onChange={(v) => { setTab(v); setFam(''); }} />
      {families.length > 0 && <Chips scroll options={[['', t('Tout')], ...families.map((f) => [f, f])]} value={fam} onChange={setFam} />}
      {!list.length ? <Empty text={tab === 'article' ? t('Ajoutez vos produits (fournitures) avec leur prix d’achat et de vente.') : t('Un ouvrage regroupe des articles et de la main-d’œuvre (ex. « Pose d’un chauffe-eau »).')} /> : (
        <div className="list">{list.map((i) => (
          <button key={i.id} className="li click" onClick={() => navigate('/pro/crm/bibliotheque/' + i.id)}>
            <div className="grow"><div className="t1">{i.name}</div><div className="t3">{i.family}</div><div className="row small" style={{ marginTop: 4, gap: 4 }}>{(i.trades || []).slice(0, 3).map((x) => <Pill key={x} c="grey">{t(x)}</Pill>)}</div></div>
            <div className="side-r"><b style={{ color: 'var(--text)', fontSize: 15 }}>{money(i.sale_price)}</b>{t('HT / {u}', { u: i.unit })}</div><LuChevronRight />
          </button>
        ))}</div>
      )}
      <button className="fab" onClick={() => navigate('/pro/crm/bibliotheque/nouveau?kind=' + tab)} aria-label={t('Ajouter un produit')}><LuPlus /></button>
    </div>
  );
}

export function ItemEdit({ params }) {
  const { company, run, confirm } = useApp();
  const isNew = params.id === 'nouveau';
  const [it, setIt] = useState(null);
  const [all] = useData(async () => {
    const items = await api.select('items', { company_id: company.id });
    const kind = new URLSearchParams(location.search).get('kind') || 'article';
    setIt(isNew ? { kind, name: '', ref: '', family: '', trades: [], unit: kind === 'ouvrage' ? 'u' : 'pièce', supplier: '', purchase_price: 0, coef: 1.3, sale_price: 0, vat_rate: company.vat_regime === 'franchise' ? 0 : 20, labour_hours: 0, components: [] } : items.find((x) => x.id === params.id));
    return items;
  }, [params.id]);
  if (!it || !all) return <div className="content"><TopBar title={t('Fiche produit')} /><Loader /></div>;
  const isO = it.kind === 'ouvrage';
  const labourRate = Number(company.settings?.docs?.labourRate || 45);
  const compCost = (it.components || []).reduce((s, c) => s + Number(c.cost || 0) * Number(c.qty || 0), 0) + Number(it.labour_hours || 0) * labourRate * 0;
  const purchase = isO ? compCost : Number(it.purchase_price || 0);
  const sale = Number(it.sale_price || 0);
  const marge = sale - purchase;
  const usedIn = all.filter((x) => x.kind === 'ouvrage' && (x.components || []).some((c) => c.item_id === it.id));
  const set = (patch) => {
    const n = { ...it, ...patch };
    if ('purchase_price' in patch || 'coef' in patch) n.sale_price = Math.round(Number(n.purchase_price) * Number(n.coef || 1) * 100) / 100;
    setIt(n);
  };
  const recomputeO = (comps, hours) => {
    const cost = comps.reduce((s, c) => s + Number(c.cost || 0) * Number(c.qty || 0), 0);
    const salesComp = comps.reduce((s, c) => s + Number(c.price || 0) * Number(c.qty || 0), 0);
    setIt({ ...it, components: comps, labour_hours: hours, purchase_price: Math.round(cost * 100) / 100, sale_price: Math.round((salesComp + Number(hours || 0) * labourRate) * 100) / 100 });
  };
  const save = () => run(async () => {
    const row = { ...it, purchase_price: purchase, sale_price: Number(it.sale_price) || 0, coef: Number(it.coef) || 1, vat_rate: Number(it.vat_rate) };
    delete row.id; delete row.created_at;
    if (isNew) { const x = await api.insert('items', { ...row, company_id: company.id }); navigate('/pro/crm/bibliotheque/' + x.id, { replace: true }); }
    else await api.update('items', { id: it.id }, row);
  }, t('Produit enregistré'));
  return (
    <div className="content narrow">
      <TopBar title={isO ? t('Fiche ouvrage') : t('Fiche produit')} sub={t('Ma bibliothèque')} />
      <div className="card soft row" style={{ alignItems: 'flex-start' }}>
        <div className="ficon" style={{ width: 64, height: 64, background: 'var(--marine-50)', color: 'var(--text-3)' }}><LuCamera /></div>
        <div className="grow">
          <input className="input" style={{ fontWeight: 800, fontSize: 18 }} value={it.name} onChange={(e) => set({ name: e.target.value })} placeholder={t('Nom du produit')} />
          <input className="input mt" value={it.ref} onChange={(e) => set({ ref: e.target.value })} placeholder={t('Référence fournisseur')} />
          {usedIn.length > 0 && <div className="small muted mt">{t('Utilisé dans {n} ouvrages', { n: usedIn.length })} : {usedIn.map((x) => x.name).join(', ')}</div>}
        </div>
      </div>
      <Sec title={t('Informations')} />
      <div className="kv">
        <div className="r"><span className="k">{t('Famille')}</span><input value={it.family} onChange={(e) => set({ family: e.target.value })} list="fams" placeholder={t('ex. Plomberie et sanitaire')} /><datalist id="fams">{[...new Set(all.map((x) => x.family).filter(Boolean))].map((f) => <option key={f} value={f} />)}</datalist></div>
        <div className="r" style={{ display: 'block' }}><div className="k mb">{t('Métiers')}</div><Chips multi options={(company.trades?.length ? company.trades : ALL_TRADES.slice(0, 8)).map((x) => [x, t(x)])} value={it.trades || []} onChange={(trades) => set({ trades })} /></div>
        <div className="r"><span className="k">{t('Unité')}</span><select value={it.unit} onChange={(e) => set({ unit: e.target.value })}>{['pièce', 'u', 'kit', 'm', 'ml', 'm²', 'm³', 'kg', 'l', 'h', 'forfait', 'cartouche', 'couronne', 'boîte'].map((u) => <option key={u}>{u}</option>)}</select></div>
        {!isO && <div className="r"><span className="k">{t('Fournisseur')}</span><input value={it.supplier} onChange={(e) => set({ supplier: e.target.value })} /></div>}
      </div>
      {isO && (
        <>
          <Sec title={t('Composition')} />
          <div className="lines">
            {(it.components || []).map((c, i) => (
              <div className="line" key={i}><div className="row"><b className="grow">{c.name}</b><input type="number" style={{ width: 80 }} value={c.qty} onChange={(e) => { const comps = it.components.slice(); comps[i] = { ...c, qty: e.target.value }; recomputeO(comps, it.labour_hours); }} /><span className="small">{money(c.price)}</span><button className="iconbtn" onClick={() => recomputeO(it.components.filter((_, j) => j !== i), it.labour_hours)} aria-label={t('Retirer')}><LuX /></button></div></div>
            ))}
          </div>
          <select className="input mt" value="" onChange={(e) => { const a = all.find((x) => x.id === e.target.value); if (a) recomputeO([...(it.components || []), { item_id: a.id, name: a.name, qty: 1, cost: Number(a.purchase_price), price: Number(a.sale_price) }], it.labour_hours); }}>
            <option value="">+ {t('Ajouter un article')}</option>{all.filter((x) => x.kind === 'article').map((a) => <option key={a.id} value={a.id}>{a.name} · {money(a.sale_price)}</option>)}
          </select>
          <Field label={t('Main-d’œuvre (heures, {r} €/h)', { r: labourRate })}><input type="number" step="0.25" value={it.labour_hours} onChange={(e) => recomputeO(it.components || [], e.target.value)} /></Field>
        </>
      )}
      <Sec title={t('Prix')} />
      <div className="kv">
        {!isO && <div className="r"><span className="k">{t("Prix d'achat HT")}</span><input type="number" step="0.01" value={it.purchase_price} onChange={(e) => set({ purchase_price: e.target.value })} /></div>}
        {isO && <div className="r"><span className="k">{t('Coût des fournitures HT')}</span><span className="v">{money(purchase)}</span></div>}
        {!isO && <div className="r"><span className="k">{t('Coefficient')}</span><input type="number" step="0.01" value={it.coef} onChange={(e) => set({ coef: e.target.value })} /></div>}
        <div className="r"><span className="k">{t('Prix de vente HT')}</span><input type="number" step="0.01" value={it.sale_price} onChange={(e) => setIt({ ...it, sale_price: e.target.value, coef: purchase ? Math.round((Number(e.target.value) / purchase) * 100) / 100 : it.coef })} style={{ color: 'var(--bordeaux)' }} /></div>
        <div className="r"><span className="k">{t('TVA')}</span><select value={it.vat_rate} onChange={(e) => set({ vat_rate: e.target.value })}>{VAT_RATES.map((r) => <option key={r} value={r}>{r} %</option>)}</select></div>
        <div className="r" style={{ background: 'var(--vert-50)' }}><span className="k green-t bold">{t('Marge par pièce')}</span><span className="v green-t">{money(marge)}{sale ? ` · ${Math.round((marge / sale) * 100)} %` : ''}</span></div>
      </div>
      <div className="btns">
        <button className="btn" onClick={save} disabled={!it.name}>{t('Enregistrer')}</button>
        {!isNew && <div className="two">
          <button className="btn ghost" onClick={() => run(async () => { const row = { ...it, name: it.name + ' ' + t('(copie)') }; delete row.id; delete row.created_at; const x = await api.insert('items', row); navigate('/pro/crm/bibliotheque/' + x.id, { replace: true }); }, t('Produit dupliqué'))}><LuCopy /> {t('Dupliquer')}</button>
          <button className="btn light" onClick={async () => { if (await confirm({ title: t('Supprimer ce produit ?'), ok: t('Supprimer'), danger: true })) { await run(() => api.remove('items', { id: it.id }), t('Produit supprimé')); navigate('/pro/crm/bibliotheque', { replace: true }); } }}><LuTrash2 /> {t('Supprimer')}</button>
        </div>}
      </div>
    </div>
  );
}
