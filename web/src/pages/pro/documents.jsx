import { useRef, useState } from 'react';
import { LuFilePen, LuFileText, LuCamera, LuFolderOpen, LuLock, LuPlus, LuTrash2, LuArrowUp, LuArrowDown, LuBookOpen, LuMail, LuSend, LuPrinter, LuDownload, LuCopy, LuPencil, LuEye, LuCheck } from 'react-icons/lu';
import { api } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate, useLocation } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { money, iso, clientName, date, fullName } from '../../lib/format.js';
import { computeTotals, newLine, defaultLines, VAT_RATES, kindLabel, effectiveStatus, APPT_TYPES } from '../../lib/docs.js';
import { TopBar, Sec, Field, Seg, Chips, Sheet, Modal, useData, Loader, Empty, Toggle, SearchBar } from '../../ui/index.jsx';
import { DocList } from './doclist.jsx';
import { loadDoc, DocHero, DocSections, A4Preview, exportPdf, pdfName, totalsOf } from '../common/docview.jsx';

export function DocumentsHome() {
  const { can } = useApp();
  const [q, setQ] = useState('');
  return (
    <div className="content">
      <TopBar title={t('Documents')} back={false} />
      <SearchBar placeholder={t('Recherchez un document')} value={q} onChange={setQ} onSubmit={() => q && navigate('/pro/recherche?q=' + encodeURIComponent(q))} />
      <div className="tiles home" style={{ marginTop: 10 }}>
        {can('devis') && <button className="tile" onClick={() => navigate('/pro/documents/devis')}><LuFilePen />{t('Devis')}</button>}
        {can('devis') && <button className="tile" onClick={() => navigate('/pro/documents/factures')}><LuFileText />{t('Factures')}</button>}
        <button className="tile" onClick={() => navigate('/pro/photos')}><LuCamera />{t('Photos')}</button>
        <button className="tile" onClick={() => navigate('/pro/autres-docs')}><LuFolderOpen />{t('Autres docs')}</button>
        <button className="tile wide" onClick={() => navigate('/pro/coffre-fort')}><LuLock />{t('Mon coffre-fort')}</button>
      </div>
    </div>
  );
}

function AllDocs({ kind }) {
  const { company } = useApp();
  const [b] = useData(async () => {
    const [docs, clients] = await Promise.all([api.select('documents', { company_id: company.id }), api.select('clients', { company_id: company.id })]);
    return { docs, cm: Object.fromEntries(clients.map((c) => [c.id, c])) };
  }, [kind]);
  return (
    <div className="content">
      <TopBar title={kind === 'devis' ? t('Devis') : t('Factures')} sub={t('Tous les clients')} />
      {b ? <DocList docs={b.docs} clients={b.cm} kind={kind} newHref={`/pro/documents/nouveau?kind=${kind}`} /> : <Loader />}
    </div>
  );
}
export const QuotesAll = () => <AllDocs kind="devis" />;
export const InvoicesAll = () => <AllDocs kind="facture" />;

// Échéance selon les conditions de paiement
export function dueFrom(issue, terms = '') {
  const d = new Date(issue + 'T12:00:00');
  const n = Number((terms.match(/(\d+)\s*jours?/) || [])[1] || 0);
  if (/réception/i.test(terms) || !n) return iso(d);
  d.setDate(d.getDate() + n);
  if (/fin de mois/i.test(terms)) d.setMonth(d.getMonth() + 1, 0);
  return iso(d);
}
const TERMS = ['À réception', '15 jours', '30 jours', '30 jours fin de mois', '45 jours fin de mois', '60 jours'];

// ─────────────── Éditeur ───────────────
export function DocEdit({ params }) {
  const { company, run, toast } = useApp();
  const { query } = useLocation();
  const ds = company.settings?.docs || {};
  const franchise = company.vat_regime === 'franchise';
  const [d, setD] = useState(null);
  const [lib, setLib] = useState(false);
  const [b] = useData(async () => {
    const [clients, projects, items] = await Promise.all([
      api.select('clients', { company_id: company.id }, { order: 'last_name.asc' }), api.select('projects', { company_id: company.id }, { order: 'created_at.desc' }), api.select('items', { company_id: company.id }, { order: 'name.asc' }),
    ]);
    let doc;
    if (params.id) doc = await api.one('documents', { id: params.id });
    else {
      const kind = query.get('kind') || 'devis';
      const from = query.get('from') ? await api.one('documents', { id: query.get('from') }) : null;
      const issue = iso(new Date());
      const cl = clients.find((c) => c.id === (query.get('client') || from?.client_id));
      const terms = cl?.payment_terms || ds.paymentTerms || '30 jours fin de mois';
      doc = { kind, client_id: cl?.id || '', project_id: query.get('project') || from?.project_id || '', object: from?.object || '', intervention_type: from?.intervention_type || 'Chantier', issue_date: issue, service_date: issue, due_date: dueFrom(issue, terms),
        validity_days: ds.validity || 30, start_date: '', duration: '', deposit_pct: 0, reverse_charge: false, vat_on_debits: false, operations_nature: 'Biens et services',
        work_address: cl ? [cl.site_name, [cl.site_address, cl.site_zip, cl.site_city].filter(Boolean).join(' ')].filter(Boolean).join(' · ') : '', delivery_address: '',
        lines: from ? structuredClone(from.lines) : defaultLines().map((l) => ({ ...l, vat: franchise ? 0 : ds.vat ?? 20 })), conditions: { paymentTerms: terms }, source_id: from?.id || null, totals: {} };
      if (from && kind === 'acompte') {
        const pct = Number(query.get('pct') || from.deposit_pct || 30);
        const tot = computeTotals(from.lines, { franchise });
        doc.lines = tot.vat.map((v) => newLine('item', { label: t('Acompte de {p} % sur le devis {n}', { p: pct, n: from.number }) + (tot.vat.length > 1 ? ` (TVA ${v.rate} %)` : ''), qty: 1, unit: 'u', price: Math.round(v.base * pct) / 100, vat: v.rate }));
        doc.object = t('Acompte') + ' · ' + from.object;
      }
      if (from && kind === 'facture' && from.kind === 'devis') {
        const deps = await api.select('documents', { source_id: from.id, kind: 'acompte' });
        doc.totals = { deductions: deps.filter((x) => x.number).map((x) => ({ id: x.id, number: x.number, ttc: x.totals?.ttc || 0 })) };
        doc.work_address = from.work_address; doc.delivery_address = from.work_address;
      }
      if (from && kind === 'avoir') { doc.object = t('Avoir sur la facture {n}', { n: from.number }); doc.work_address = from.work_address; }
    }
    setD(doc);
    return { clients, projects, items };
  }, [params.id]);
  if (!d || !b) return <div className="content"><TopBar title={t('Document')} /><Loader /></div>;
  if (d.locked) return <div className="content"><TopBar title={kindLabel(d.kind)} /><Empty text={t('Cette facture est émise : elle ne peut plus être modifiée. Créez un avoir.')} /></div>;
  const tot = computeTotals(d.lines, { franchise, reverse: d.reverse_charge, deductions: d.totals?.deductions || [] });
  const isQ = d.kind === 'devis';
  const upd = (patch) => setD({ ...d, ...patch });
  const setLine = (i, patch) => { const lines = d.lines.slice(); lines[i] = { ...lines[i], ...patch }; upd({ lines }); };
  const moveLine = (i, dir) => { const lines = d.lines.slice(); const j = i + dir; if (j < 0 || j >= lines.length) return; [lines[i], lines[j]] = [lines[j], lines[i]]; upd({ lines }); };
  const pickClient = (id) => { const cl = b.clients.find((c) => c.id === id); const terms = cl?.payment_terms || d.conditions?.paymentTerms; upd({ client_id: id, project_id: '', work_address: cl ? [cl.site_name, [cl.site_address, cl.site_zip, cl.site_city].filter(Boolean).join(' ')].filter(Boolean).join(' · ') : '', conditions: { ...d.conditions, paymentTerms: terms }, due_date: dueFrom(d.issue_date, terms) }); };
  const addItem = (it) => {
    const comps = it.kind === 'ouvrage' && it.components?.length ? it.components : null;
    const line = newLine('item', { label: it.name, desc: it.ref ? t('Réf. {r}', { r: it.ref }) : '', qty: 1, unit: it.unit === 'pièce' ? 'u' : it.unit, price: Number(it.sale_price), vat: franchise ? 0 : Number(it.vat_rate), cost: comps ? comps.reduce((s, c) => s + Number(c.cost || 0) * Number(c.qty || 1), 0) : Number(it.purchase_price), item_id: it.id });
    upd({ lines: [...d.lines, line] }); setLib(false); toast(t('« {n} » ajouté', { n: it.name }));
  };
  const save = async () => {
    if (!d.client_id) return toast(t('Choisissez un client.'), true);
    if (!d.lines.some((l) => l.kind === 'item' && l.label && Number(l.qty) && Number(l.price))) return toast(t('Ajoutez au moins une ligne avec un prix.'), true);
    const lines = d.lines.filter((l) => l.kind !== 'item' || l.label || Number(l.price));
    const cl = b.clients.find((c) => c.id === d.client_id);
    let project_id = d.project_id || null;
    const row = { ...d, lines, project_id, totals: tot, start_date: d.start_date || null, due_date: isQ ? null : d.due_date || null, service_date: isQ ? null : d.service_date || null, deposit_pct: Number(d.deposit_pct) || 0, validity_days: Number(d.validity_days) || 30 };
    delete row.id; delete row.created_at;
    return run(async () => {
      if (!project_id) { const p = await api.insert('projects', { company_id: company.id, client_id: d.client_id, title: d.object || t(d.intervention_type), address: d.work_address }); row.project_id = p.id; }
      if (params.id) { await api.update('documents', { id: params.id }, row); navigate('/pro/documents/' + params.id, { replace: true }); }
      else { const x = await api.insert('documents', { ...row, company_id: company.id }); navigate('/pro/documents/' + x.id, { replace: true }); }
      const appt = query.get('appt'); if (appt && isQ && !params.id) { /* lien RDV ↔ devis */ }
    }, t('Brouillon enregistré'));
  };
  const projects = b.projects.filter((p) => p.client_id === d.client_id);
  const L = (l, i) => (
    <div key={l.id} className={'line' + (l.kind === 'section' ? ' section' : '')}>
      {l.kind === 'section' || l.kind === 'text' ? (
        <div className="row"><input value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} placeholder={l.kind === 'section' ? t('Titre de section') : t('Texte libre')} style={{ fontWeight: l.kind === 'section' ? 800 : 400 }} />
          <LineTools i={i} /></div>
      ) : (
        <div className="lg">
          <input value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} placeholder={t('Désignation')} aria-label={t('Désignation')} />
          <input type="number" step="any" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} aria-label={t('Quantité')} />
          <select value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} aria-label={t('Unité')}>{['u', 'h', 'j', 'm', 'm²', 'm³', 'ml', 'kg', 'l', 'forfait', 'lot', 'kit', 'boîte'].map((x) => <option key={x}>{x}</option>)}</select>
          <input type="number" step="any" value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} aria-label={t('Prix unitaire HT')} placeholder={t('PU HT')} />
          <select value={l.vat} onChange={(e) => setLine(i, { vat: Number(e.target.value) })} disabled={franchise || d.reverse_charge} aria-label={t('TVA')}>{VAT_RATES.map((r) => <option key={r} value={r}>{r} %</option>)}</select>
          <b style={{ textAlign: 'right' }}>{money((Number(l.qty) || 0) * (Number(l.price) || 0))}</b>
          <LineTools i={i} />
        </div>
      )}
    </div>
  );
  function LineTools({ i }) {
    return <span className="row" style={{ gap: 2 }}><button type="button" className="iconbtn" style={{ width: 32, height: 32, fontSize: 16 }} onClick={() => moveLine(i, -1)} aria-label={t('Monter')}><LuArrowUp /></button><button type="button" className="iconbtn" style={{ width: 32, height: 32, fontSize: 16 }} onClick={() => moveLine(i, 1)} aria-label={t('Descendre')}><LuArrowDown /></button><button type="button" className="iconbtn" style={{ width: 32, height: 32, fontSize: 16 }} onClick={() => upd({ lines: d.lines.filter((_, j) => j !== i) })} aria-label={t('Supprimer la ligne')}><LuTrash2 /></button></span>;
  }
  return (
    <div className="content">
      <TopBar title={params.id ? t('Modifier') + ' · ' + kindLabel(d.kind) : t('Nouveau') + ' · ' + kindLabel(d.kind)} sub={d.number || t('Brouillon')} />
      <div style={{ maxWidth: 820 }}>
        <div>
          <Field label={t('Client')}><select value={d.client_id} onChange={(e) => pickClient(e.target.value)} disabled={!!d.source_id && d.kind !== 'devis'}><option value="">{t('Choisir un client')}</option>{b.clients.map((c) => <option key={c.id} value={c.id}>{clientName(c)}{c.billing_city ? ' · ' + c.billing_city : ''}</option>)}</select></Field>
          {!b.clients.length && <p className="small">{t('Aucun client : ')}{' '}<a className="red-t bold" href="/pro/clients/nouveau">{t('créer un client')}</a></p>}
          <Field label={t('Objet')}><input value={d.object} onChange={(e) => upd({ object: e.target.value })} placeholder={t('ex. Changement d’un chauffe-eau')} /></Field>
          <div className="form-grid two">
            <Field label={t('Projet / chantier')}><select value={d.project_id || ''} onChange={(e) => upd({ project_id: e.target.value })}><option value="">{t('Nouveau chantier')}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>
            <Field label={t("Type d'intervention")}><select value={d.intervention_type} onChange={(e) => upd({ intervention_type: e.target.value })}>{APPT_TYPES.map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></Field>
          </div>
          <div className="form-grid two">
            <Field label={t("Date d'émission")}><input type="date" value={d.issue_date} onChange={(e) => upd({ issue_date: e.target.value, due_date: dueFrom(e.target.value, d.conditions?.paymentTerms) })} /></Field>
            {isQ ? <Field label={t('Validité (jours)')}><input type="number" value={d.validity_days} onChange={(e) => upd({ validity_days: e.target.value })} /></Field>
              : <Field label={t('Date de la prestation')}><input type="date" value={d.service_date || ''} onChange={(e) => upd({ service_date: e.target.value })} /></Field>}
          </div>
          <Field label={isQ ? t('Lieu des travaux') : t('Adresse de livraison (lieu de la prestation)')}><input value={isQ ? d.work_address : d.delivery_address || d.work_address} onChange={(e) => upd(isQ ? { work_address: e.target.value } : { delivery_address: e.target.value })} /></Field>
          {isQ ? (
            <div className="form-grid three">
              <Field label={t('Début prévu')}><input type="date" value={d.start_date || ''} onChange={(e) => upd({ start_date: e.target.value })} /></Field>
              <Field label={t('Durée')}><input value={d.duration} onChange={(e) => upd({ duration: e.target.value })} placeholder={t('ex. 1 jour')} /></Field>
              <Field label={t('Acompte (%)')}><input type="number" min="0" max="100" value={d.deposit_pct} onChange={(e) => upd({ deposit_pct: e.target.value })} /></Field>
            </div>
          ) : (
            <div className="form-grid two">
              <Field label={t('Conditions de paiement')}><select value={d.conditions?.paymentTerms} onChange={(e) => upd({ conditions: { ...d.conditions, paymentTerms: e.target.value }, due_date: dueFrom(d.issue_date, e.target.value) })}>{[...new Set([...TERMS, d.conditions?.paymentTerms].filter(Boolean))].map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></Field>
              <Field label={t('Échéance')}><input type="date" value={d.due_date || ''} onChange={(e) => upd({ due_date: e.target.value })} /></Field>
              <Field label={t('Nature des opérations')}><select value={d.operations_nature} onChange={(e) => upd({ operations_nature: e.target.value })}>{['Biens et services', 'Prestations de services', 'Livraison de biens'].map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></Field>
              <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={d.vat_on_debits} onChange={(e) => upd({ vat_on_debits: e.target.checked })} />{t('TVA sur les débits')}</label>
            </div>
          )}
          {!franchise && <label className="check"><input type="checkbox" checked={d.reverse_charge} onChange={(e) => upd({ reverse_charge: e.target.checked })} />{t('Autoliquidation (sous-traitance BTP)')}</label>}
          {franchise && <div className="notice">{t('TVA non applicable, art. 293 B du CGI (réglage de votre entreprise).')}</div>}
        </div>
      </div>
      <div>
          <Sec title={t('Lignes')} meta={<button className="btn xs ghost" onClick={() => setLib(true)}><LuBookOpen /> {t('Bibliothèque')}</button>} />
          <div className="lines">{d.lines.map(L)}</div>
          <div className="row wrap mt">
            <button className="btn xs ghost" onClick={() => upd({ lines: [...d.lines, newLine('item', { vat: franchise ? 0 : ds.vat ?? 20 })] })}><LuPlus /> {t('Ligne')}</button>
            <button className="btn xs ghost" onClick={() => upd({ lines: [...d.lines, newLine('section', { label: '' })] })}><LuPlus /> {t('Section')}</button>
            <button className="btn xs ghost" onClick={() => upd({ lines: [...d.lines, newLine('text', { label: '' })] })}><LuPlus /> {t('Texte')}</button>
          </div>
      </div>
      <div className="grid2">
        <div>
          <Sec title={t('Totaux')} />
          <div className="kv">
            <div className="r"><span className="k">{t('Total HT')}</span><span className="v">{money(tot.ht)}</span></div>
            {tot.vat.filter((v) => v.base).map((v) => <div className="r" key={v.rate}><span className="k">{t('TVA {r} %', { r: v.rate })}</span><span className="v">{money(v.amount)}</span></div>)}
            <div className="r"><span className="k">{t('Total TTC')}</span><span className="v">{money(tot.ttc)}</span></div>
            {tot.deductions.map((x) => <div className="r" key={x.id}><span className="k">{t('Acompte déduit {n}', { n: x.number })}</span><span className="v">− {money(x.ttc)}</span></div>)}
            <div className="r"><span className="k">{t('Marge estimée')}</span><span className="v green-t">{money(tot.margin)}{tot.ht ? ` · ${Math.round((tot.margin / tot.ht) * 100)} %` : ''}</span></div>
            <div className="r total"><span className="k">{isQ ? t('Total TTC') : t('Net à payer')}</span><span className="v">{money(tot.net)}</span></div>
          </div>
        </div>
        <div>
          <Sec title={t('Notes sur le document')} />
          <Field label=""><textarea value={d.conditions?.notes || ''} onChange={(e) => upd({ conditions: { ...d.conditions, notes: e.target.value } })} placeholder={t('Mentions particulières, garanties…')} /></Field>
          <div className="btns"><button className="btn" onClick={save}>{t('Enregistrer le brouillon')}</button></div>
        </div>
      </div>
      <LibraryPicker open={lib} items={b.items} onClose={() => setLib(false)} onPick={addItem} />
    </div>
  );
}

function LibraryPicker({ open, items, onClose, onPick }) {
  const [q, setQ] = useState('');
  const list = items.filter((i) => !q || (i.name + ' ' + i.ref + ' ' + i.family).toLowerCase().includes(q.toLowerCase()));
  return (
    <Sheet open={open} onClose={onClose} title={t('Ma bibliothèque')}>
      <input className="input mb" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Rechercher un produit ou un ouvrage')} autoFocus />
      {!items.length ? <Empty text={t('Votre bibliothèque est vide. Ajoutez des produits dans CRM → Ma bibliothèque.')} /> : (
        <div className="list">{list.map((i) => <button key={i.id} className="li click" onClick={() => onPick(i)}><div className="grow"><div className="t1">{i.name}</div><div className="t2">{i.family} · {i.kind === 'ouvrage' ? t('Ouvrage') : t('Article')}</div></div><div className="side-r"><b>{money(i.sale_price)}</b>{t('HT / {u}', { u: i.unit })}</div></button>)}</div>
      )}
    </Sheet>
  );
}

// ─────────────── Détail (artisan) ───────────────
export function DocDetail({ params }) {
  const { company, run, confirm, wip, profile, toast } = useApp();
  const [b, reload] = useData(() => loadDoc(params.id), [params.id]);
  const [send, setSend] = useState(false);
  const [pay, setPay] = useState(false);
  const [sign, setSign] = useState(false);
  const [acompte, setAcompte] = useState(false);
  if (!b) return <div className="content"><TopBar title={t('Document')} /><Loader /></div>;
  const { d, client } = b;
  const isQ = d.kind === 'devis';
  const st = effectiveStatus(d);
  const dup = () => navigate(`/pro/documents/nouveau?kind=${d.kind === 'devis' ? 'devis' : 'facture'}&from=${d.id}&client=${d.client_id}`);
  const remind = async () => {
    const msg = isQ ? t('Bonjour, je me permets de vous relancer au sujet du devis {n} ({m}). N’hésitez pas si vous avez des questions.', { n: d.number, m: money(totalsOf(d, b.company).ttc) })
      : t('Bonjour, sauf erreur de ma part, la facture {n} ({m}) reste à régler. Merci d’avance.', { n: d.number, m: money(Math.max(0, totalsOf(d, b.company).net - d.paid_amount)) });
    if (b.clientLive?.user_id) {
      let conv = await api.one('conversations', { kind: 'client', company_id: company.id, client_id: d.client_id });
      if (!conv) conv = await api.insert('conversations', { kind: 'client', company_id: company.id, client_id: d.client_id, client_user_id: b.clientLive.user_id });
      await run(() => api.insert('messages', { conversation_id: conv.id, sender_name: fullName(profile), sender_company_id: company.id, body: msg }), t('Relance envoyée dans la messagerie du client'));
    } else window.location.href = `mailto:${client.email || ''}?subject=${encodeURIComponent((isQ ? t('Devis') : t('Facture')) + ' ' + d.number)}&body=${encodeURIComponent(msg)}`;
  };
  const del = async () => { if (await confirm({ title: t('Supprimer ce brouillon ?'), ok: t('Supprimer'), danger: true })) { await run(() => api.remove('documents', { id: d.id }), t('Brouillon supprimé')); navigate(-1); } };
  return (
    <div className="content">
      <TopBar title={kindLabel(d.kind)} sub={d.number || t('Brouillon')} right={!d.locked && <button className="iconbtn" onClick={() => navigate(`/pro/documents/${d.id}/modifier`)} aria-label={t('Modifier')}><LuPencil /></button>} />
      <DocHero d={d} client={client} company={b.company} />
      <div className="btns inline">
        {d.status === 'brouillon' && <>
          <button className="btn" onClick={() => setSend(true)}><LuSend /> {t('Envoyer au client')}</button>
          <div className="two"><button className="btn ghost sm" onClick={() => navigate(`/pro/documents/${d.id}/pdf`)}><LuEye /> {t('Aperçu PDF')}</button><button className="btn light sm" onClick={del}><LuTrash2 /> {t('Supprimer')}</button></div>
        </>}
        {isQ && d.number && st !== 'accepte' && st !== 'refuse' && <>
          <button className="btn" onClick={remind}>{t('Relancer le client')}</button>
          <div className="two"><button className="btn ghost sm" onClick={() => navigate(`/pro/documents/${d.id}/pdf`)}>{t('Télécharger le PDF')}</button><button className="btn ghost sm" onClick={() => navigate(`/pro/documents/${d.id}/modifier`)}>{t('Modifier')}</button></div>
          <div className="two"><button className="btn ghost sm" onClick={() => setSign(true)}><LuCheck /> {t('Marquer comme signé')}</button><button className="btn light sm" onClick={async () => { if (await confirm({ title: t('Marquer ce devis comme refusé ?'), ok: t('Refusé'), danger: true })) { await run(() => api.update('documents', { id: d.id }, { status: 'refuse', refused_at: new Date().toISOString() })); reload(); } }}>{t('Marquer comme refusé')}</button></div>
        </>}
        {isQ && st === 'accepte' && <>
          <button className="btn" onClick={() => navigate(`/pro/documents/nouveau?kind=facture&from=${d.id}`)}>{t('Transformer en facture')}</button>
          <div className="two"><button className="btn ghost sm" onClick={() => setAcompte(true)}>{t("Facture d'acompte")}</button><button className="btn ghost sm" onClick={() => navigate(`/pro/planning/nouveau?client=${d.client_id}`)}>{t('Planifier le chantier')}</button></div>
        </>}
        {!isQ && d.number && d.kind !== 'avoir' && <>
          {st !== 'payee' && st !== 'annulee' && <button className="btn" onClick={remind}>{t('Relancer le client')}</button>}
          <div className="two">{st !== 'payee' && st !== 'annulee' && <button className="btn ghost sm" onClick={() => setPay(true)}>{t('Enregistrer un paiement')}</button>}<button className="btn ghost sm" onClick={() => navigate(`/pro/documents/${d.id}/pdf`)}>{t('Télécharger le PDF')}</button></div>
          {st !== 'annulee' && <button className="btn light sm" onClick={() => navigate(`/pro/documents/nouveau?kind=avoir&from=${d.id}&client=${d.client_id}`)}>{t('Créer un avoir')}</button>}
        </>}
        {d.kind === 'avoir' && d.number && <button className="btn ghost sm" onClick={() => navigate(`/pro/documents/${d.id}/pdf`)}>{t('Télécharger le PDF')}</button>}
        {d.number && <button className="btn light sm" onClick={dup}><LuCopy /> {t('Dupliquer')}</button>}
      </div>
      <DocSections {...b} />
      <SendModal open={send} b={b} onClose={() => setSend(false)} onSent={reload} />
      <PaySheet open={pay} d={d} b={b} onClose={() => setPay(false)} onDone={() => { setPay(false); reload(); }} />
      <Sheet open={sign} onClose={() => setSign(false)} title={t('Devis signé')}>
        <SignForm onSave={async (name) => { await run(() => api.update('documents', { id: d.id }, { status: 'accepte', accepted_at: new Date().toISOString(), signed_name: name }), t('Devis marqué comme signé')); setSign(false); reload(); }} defaultName={clientName(client)} />
      </Sheet>
      <Sheet open={acompte} onClose={() => setAcompte(false)} title={t("Facture d'acompte")}>
        <AcompteForm d={d} onGo={(pct) => navigate(`/pro/documents/nouveau?kind=acompte&from=${d.id}&pct=${pct}`)} />
      </Sheet>
    </div>
  );
}
function SignForm({ onSave, defaultName }) {
  const [n, setN] = useState(defaultName);
  return <><p className="muted">{t('Pour un devis signé sur papier ou par un autre moyen.')}</p><Field label={t('Signé par')}><input value={n} onChange={(e) => setN(e.target.value)} /></Field><button className="btn block" onClick={() => onSave(n)}>{t('Enregistrer')}</button></>;
}
function AcompteForm({ d, onGo }) {
  const [p, setP] = useState(d.deposit_pct || 30);
  return <><Field label={t('Pourcentage du devis')}><input type="number" min="1" max="100" value={p} onChange={(e) => setP(e.target.value)} /></Field><button className="btn block" onClick={() => onGo(p)}>{t('Créer la facture d’acompte')}</button></>;
}

function PaySheet({ open, d, b, onClose, onDone }) {
  const { company, run } = useApp();
  const rest = Math.max(0, totalsOf(d, b.company).net - Number(d.paid_amount || 0));
  const [p, setP] = useState({ amount: '', method: 'Virement', paid_on: iso(new Date()), note: '' });
  if (!open) return null;
  return (
    <Sheet open onClose={onClose} title={t('Enregistrer un paiement')}>
      <p className="muted">{t('Reste à payer : {m}', { m: money(rest) })}</p>
      <div className="form-grid two">
        <Field label={t('Montant (€)')}><input type="number" step="0.01" value={p.amount || rest} onChange={(e) => setP({ ...p, amount: e.target.value })} /></Field>
        <Field label={t('Date')}><input type="date" value={p.paid_on} onChange={(e) => setP({ ...p, paid_on: e.target.value })} /></Field>
      </div>
      <Chips options={['Virement', 'Chèque', 'Espèces', 'Carte bancaire', 'Prélèvement'].map((m) => [m, t(m)])} value={p.method} onChange={(method) => setP({ ...p, method })} />
      <Field label={t('Note')}><input value={p.note} onChange={(e) => setP({ ...p, note: e.target.value })} placeholder={t('ex. Chèque remis sur place')} /></Field>
      <button className="btn block" onClick={() => run(async () => { await api.insert('payments', { company_id: company.id, document_id: d.id, amount: Number(p.amount || rest), method: p.method, paid_on: p.paid_on, note: p.note, via_platform: false }); onDone(); }, t('Paiement enregistré'))}>{t('Enregistrer')}</button>
    </Sheet>
  );
}

// Fenêtre d'envoi au client (12g / 11h)
export function SendModal({ open, b, onClose, onSent, pdfNode }) {
  const { run, wip } = useApp();
  if (!open) return null;
  const { d, client } = b;
  const isQ = d.kind === 'devis';
  const finalize = async () => {
    const x = d.number ? d : await api.rpc('finalize_document', { p_id: d.id });
    if (d.kind === 'avoir' && d.source_id) {
      const src = await api.one('documents', { id: d.source_id });
      if (src && Number(x.totals?.ttc) >= Number(src.totals?.ttc) - Number(src.paid_amount || 0) - 0.01) await api.update('documents', { id: src.id }, { status: 'annulee' });
    }
    return x;
  };
  const inApp = () => run(async () => { await finalize(); onClose(); onSent(); }, b.clientLive?.user_id ? t('Envoyé dans l’espace Artis & You du client') : t('Document émis. Le client le verra dès qu’il aura créé son compte avec cet e-mail.'));
  const byMail = () => run(async () => {
    const x = await finalize();
    onClose(); onSent();
    if (pdfNode?.current) await exportPdf(pdfNode.current, pdfName(x));
    const body = isQ ? t('Bonjour,\n\nVeuillez trouver ci-joint notre devis {n} pour : {o}.\n\nVous pouvez aussi le consulter et le signer dans votre espace Artis & You : {u}\n\nBien cordialement,\n{c}', { n: x.number, o: x.object, u: location.origin, c: b.company.name })
      : t('Bonjour,\n\nVeuillez trouver ci-joint notre facture {n} pour : {o}.\n\nVous pouvez la régler par virement (IBAN sur la facture) ou en ligne depuis votre espace Artis & You : {u}\n\nBien cordialement,\n{c}', { n: x.number, o: x.object, u: location.origin, c: b.company.name });
    window.location.href = `mailto:${client.email || ''}?subject=${encodeURIComponent((isQ ? t('Devis') : t('Facture')) + ' ' + x.number)}&body=${encodeURIComponent(body)}`;
  }, pdfNode ? t('PDF téléchargé : joignez-le à l’e-mail') : t('Document émis'));
  return (
    <div className="overlay center" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{isQ ? t('Envoyer le devis') : t('Envoyer la facture')}</h3>
        <p className="muted">{d.number || t('Brouillon')} · {clientName(client)}</p>
        {!d.number && <p className="small notice" style={{ textAlign: 'left' }}>{isQ ? t('Le devis reçoit son numéro définitif à l’envoi.') : t('À l’envoi, la facture reçoit son numéro définitif et ne pourra plus être modifiée (seulement corrigée par un avoir).')}</p>}
        {isQ ? <button className="opt red" onClick={() => wip(t('La signature électronique'))}><LuFilePen /><div><b>{t('Envoyer par signature électronique')}</b><small>{t('Via l’application, avec code SMS')}</small></div></button>
          : <button className="opt red" onClick={() => wip(t('La facture électronique via Artis & You'))}><LuFilePen /><div><b>{t('Envoyer via Artis & You')}</b><small>{t('Facture électronique + lien de paiement')}</small></div></button>}
        <button className="opt" onClick={inApp}><LuSend /><div><b>{t('Envoyer dans l’espace client')}</b><small>{b.clientLive?.user_id ? t('Visible tout de suite dans son application') : t('Visible dès qu’il crée son compte')}</small></div></button>
        <button className="opt" onClick={byMail}><LuMail /><div><b>{t('Envoyer par e-mail')}</b><small>{isQ ? t("À l'adresse de la fiche client") : t('PDF + lien de paiement')}</small></div></button>
        <button className="link mt" onClick={onClose}>{t('Annuler')}</button>
      </div>
    </div>
  );
}

export function DocPdf({ params }) {
  const [b, reload] = useData(() => loadDoc(params.id), [params.id]);
  const [send, setSend] = useState(false);
  const ref = useRef();
  const { run } = useApp();
  if (!b) return <div className="content"><TopBar title={t('Aperçu PDF')} /><Loader /></div>;
  return (
    <div className="content">
      <TopBar title={t('Aperçu PDF')} sub={pdfName(b.d)} />
      <A4Preview bundle={b} innerRef={ref} />
      <div className="center small faint mt"><span className="pill navy">{t('Page 1 / 1')}</span></div>
      <div className="btns inline">
        {b.d.status === 'brouillon' || b.d.kind !== 'avoir' ? <button className="btn" onClick={() => setSend(true)}>{t('Envoyer au client')}</button> : null}
        <div className="two">
          <button className="btn ghost" onClick={() => run(() => exportPdf(ref.current, pdfName(b.d)), t('PDF téléchargé'))}><LuDownload /> {t('Télécharger')}</button>
          <button className="btn ghost" onClick={() => window.print()}><LuPrinter /> {t('Imprimer')}</button>
        </div>
      </div>
      <SendModal open={send} b={b} onClose={() => setSend(false)} onSent={reload} pdfNode={ref} />
    </div>
  );
}
