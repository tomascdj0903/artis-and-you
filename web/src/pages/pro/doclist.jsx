import { useState } from 'react';
import { LuPlus, LuX } from 'react-icons/lu';
import { navigate, useLocation } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { money, date, clientName, iso } from '../../lib/format.js';
import { statusPill, effectiveStatus, kindLabel } from '../../lib/docs.js';
import { SearchBar, Sec, Table, StatusPill, Sheet, Chips, Field } from '../../ui/index.jsx';

// Recherche tolérante : sans accents, sans espaces ni tirets (« de 2026 1 » trouve « DE-2026-001 »)
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const flat = (s) => norm(s).replace(/[\s\-_/.]/g, '').replace(/0+(\d)/g, '$1');
const EMPTY = { st: [], kinds: [], period: '', from: '', to: '', min: '', max: '', due: false };

function periodStart(p) {
  const d = new Date();
  if (p === 'mois') return iso(new Date(d.getFullYear(), d.getMonth(), 1));
  if (p === '3m') { d.setMonth(d.getMonth() - 3); return iso(d); }
  if (p === 'annee') return iso(new Date(d.getFullYear(), 0, 1));
  return '';
}

// Tableau des devis ou des factures (un client ou tous les clients)
export function DocList({ docs, clients, kind, newHref, from }) {
  const { query } = useLocation();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(() => ({ ...EMPTY, st: query.get('statut') ? [query.get('statut')] : [] }));
  const [sort, setSort] = useState('date');
  const isQ = kind === 'devis';
  const ttc = (d) => Number(d.totals?.ttc || 0);
  const remaining = (d) => Math.max(0, Number(d.totals?.net ?? d.totals?.ttc ?? 0) - Number(d.paid_amount || 0));
  const fromD = f.period === 'custom' ? f.from : periodStart(f.period);
  const toD = f.period === 'custom' ? f.to : '';
  const all = docs.filter((d) => (isQ ? d.kind === 'devis' : d.kind !== 'devis'));
  const qs = q.trim();
  const match = (d) => {
    if (!qs) return true;
    const c = clients[d.client_id];
    const hay = [d.number, d.object, clientName(c), c?.company_name, c?.first_name, c?.last_name, c?.number, kindLabel(d.kind), statusPill(d)[1], date(d.issue_date), d.intervention_type, ttc(d).toFixed(2), Math.round(ttc(d))].join(' ');
    return qs.split(/\s+/).every((w) => norm(hay).includes(norm(w))) || flat(hay).includes(flat(qs));
  };
  const list = all
    .filter((d) => !f.st.length || f.st.includes(effectiveStatus(d)))
    .filter((d) => !f.kinds.length || f.kinds.includes(d.kind))
    .filter((d) => !fromD || (d.issue_date || '') >= fromD)
    .filter((d) => !toD || (d.issue_date || '') <= toD)
    .filter((d) => f.min === '' || ttc(d) >= Number(f.min))
    .filter((d) => f.max === '' || ttc(d) <= Number(f.max))
    .filter((d) => !f.due || remaining(d) > 0.005)
    .filter(match)
    .sort((a, b) => sort === 'montant' ? ttc(b) - ttc(a) : sort === 'client' ? clientName(clients[a.client_id]).localeCompare(clientName(clients[b.client_id])) : sort === 'echeance' ? (a.due_date || '9').localeCompare(b.due_date || '9')
      : (b.issue_date || '').localeCompare(a.issue_date || '') || (b.number || 'z').localeCompare(a.number || 'z'));
  const meta = isQ ? t('{n} devis · {a} acceptés', { n: all.length, a: all.filter((d) => d.status === 'accepte').length })
    : t('{n} factures · {a} à payer', { n: all.filter((d) => d.kind !== 'avoir').length, a: all.filter((d) => ['envoyee', 'partielle', 'retard'].includes(effectiveStatus(d))).length });
  const opts = isQ ? [['brouillon', t('Brouillon')], ['envoye', t('En attente')], ['accepte', t('Accepté')], ['refuse', t('Refusé')], ['expire', t('Expiré')]]
    : [['brouillon', t('Brouillon')], ['envoyee', t('En attente')], ['partielle', t('Partielle')], ['retard', t('En retard')], ['payee', t('Payée')], ['annulee', t('Annulée')]];
  const periods = [['mois', t('Ce mois-ci')], ['3m', t('3 derniers mois')], ['annee', t('Cette année')], ['custom', t('Dates…')]];
  const set = (p) => setF({ ...f, ...p });
  // Filtres actifs sous forme d'étiquettes
  const chips = [
    ...f.st.map((s) => [opts.find((o) => o[0] === s)?.[1] || s, () => set({ st: f.st.filter((x) => x !== s) })]),
    ...f.kinds.map((k) => [kindLabel(k), () => set({ kinds: f.kinds.filter((x) => x !== k) })]),
    f.period && [f.period === 'custom' ? [f.from && t('du {d}', { d: date(f.from) }), f.to && t('au {d}', { d: date(f.to) })].filter(Boolean).join(' ') || t('Dates') : periods.find((p) => p[0] === f.period)[1], () => set({ period: '', from: '', to: '' })],
    f.min !== '' && [t('≥ {m}', { m: money(f.min) }), () => set({ min: '' })],
    f.max !== '' && [t('≤ {m}', { m: money(f.max) }), () => set({ max: '' })],
    f.due && [t('Reste à payer'), () => set({ due: false })],
  ].filter(Boolean);
  const total = list.reduce((s, d) => s + (d.kind === 'avoir' ? -1 : 1) * Math.abs(Number(d.totals?.ht || 0)), 0);
  return (
    <>
      <SearchBar placeholder={isQ ? t('N°, client, objet, montant…') : t('N°, client, objet, montant…')} value={q} onChange={setQ} onFilter={() => setOpen(true)} filterActive={chips.length > 0} />
      {chips.length > 0 && (
        <div className="chips" style={{ marginTop: -4 }}>
          {chips.map(([l, rm], i) => <button key={i} className="chip on" style={{ padding: '5px 12px', fontSize: 13 }} onClick={rm}>{l} <LuX /></button>)}
          <button className="link small" onClick={() => setF(EMPTY)}>{t('Tout effacer')}</button>
        </div>
      )}
      <Sec title={isQ ? t('Mes devis') : t('Mes factures')} meta={(qs || chips.length) ? t('{n} sur {m} · {s} HT', { n: list.length, m: all.length, s: money(total) }) : meta}
><select className="mini-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('Trier')}>
          <option value="date">{t('Plus récents')}</option><option value="montant">{t('Montant')}</option><option value="client">{t('Client')}</option>{!isQ && <option value="echeance">{t('Échéance')}</option>}
        </select></Sec>
      <Table rows={list} onRow={(d) => navigate('/pro/documents/' + d.id + (from ? '?from=' + from : ''))} empty={qs || chips.length ? t('Aucun résultat avec ces critères') : isQ ? t('Aucun devis pour le moment') : t('Aucune facture pour le moment')}
        cols={[
          { label: isQ ? t('N° devis') : t('N° facture'), render: (d) => <span className="small bold">{d.number || '—'}{d.kind !== 'devis' && d.kind !== 'facture' && <div className="faint">{kindLabel(d.kind)}</div>}</span> },
          { label: t('Statut'), render: (d) => <StatusPill s={statusPill(d)} /> },
          { label: t('Client'), render: (d) => clientName(clients[d.client_id]) },
          { label: t("Date d'émission"), render: (d) => <span className="small">{date(d.issue_date)}</span> },
          ...(!isQ ? [{ label: t('Échéance'), render: (d) => <span className={'small' + (effectiveStatus(d) === 'retard' ? ' red-t bold' : '')}>{d.due_date ? date(d.due_date) : '—'}</span> }] : []),
          { label: t('Total HT'), num: true, render: (d) => money(d.totals?.ht) },
          ...(!isQ ? [{ label: t('Reste dû'), num: true, render: (d) => (d.kind === 'avoir' || d.status === 'annulee' ? '—' : money(remaining(d))) }] : []),
        ]} />
      {newHref && <button className="fab" onClick={() => navigate(newHref)} aria-label={isQ ? t('Nouveau devis') : t('Nouvelle facture')}><LuPlus /></button>}
      <Sheet open={open} onClose={() => setOpen(false)} title={isQ ? t('Filtrer les devis') : t('Filtrer les factures')}>
        <div className="small bold">{t('Statut')}</div><Chips multi options={opts} value={f.st} onChange={(st) => set({ st })} />
        {!isQ && <><div className="small bold">{t('Type')}</div><Chips multi options={[['facture', t('Facture')], ['acompte', t("Facture d'acompte")], ['avoir', t('Avoir')]]} value={f.kinds} onChange={(kinds) => set({ kinds })} /></>}
        <div className="small bold">{t("Date d'émission")}</div><Chips options={periods} value={f.period} onChange={(period) => set({ period: f.period === period ? '' : period })} />
        {f.period === 'custom' && <div className="form-grid two"><Field label={t('Du')}><input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} /></Field><Field label={t('Au')}><input type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} /></Field></div>}
        <div className="form-grid two">
          <Field label={t('Montant TTC min.')}><input type="number" inputMode="decimal" min="0" value={f.min} onChange={(e) => set({ min: e.target.value })} placeholder="0 €" /></Field>
          <Field label={t('Montant TTC max.')}><input type="number" inputMode="decimal" min="0" value={f.max} onChange={(e) => set({ max: e.target.value })} placeholder="∞" /></Field>
        </div>
        {!isQ && <label className="check" style={{ margin: '6px 0 12px' }}><input type="checkbox" checked={f.due} onChange={(e) => set({ due: e.target.checked })} /> <span>{t('Seulement les factures avec un reste à payer')}</span></label>}
        <div className="btns"><div className="two"><button className="btn ghost" onClick={() => setF(EMPTY)}>{t('Réinitialiser')}</button><button className="btn" onClick={() => setOpen(false)}>{t('Afficher {n}', { n: list.length })}</button></div></div>
      </Sheet>
    </>
  );
}
