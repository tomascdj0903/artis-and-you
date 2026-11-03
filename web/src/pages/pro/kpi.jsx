import { useState } from 'react';
import { t, locale } from '../../lib/i18n.js';
import { money0, num, iso, date } from '../../lib/format.js';
import { Chips, Sec, Empty, Field } from '../../ui/index.jsx';

export const KPI_PERIODS = [['1', '1 mois'], ['3', '3 mois'], ['6', '6 mois'], ['12', '12 mois'], ['all', 'Depuis le début'], ['custom', 'Dates…']];

export function periodBounds(p, from, to) {
  const end = p === 'custom' && to ? to : iso(new Date());
  if (p === 'custom') return [from || '2000-01-01', end];
  if (p === 'all') return ['2000-01-01', end];
  const d = new Date(); d.setMonth(d.getMonth() - Number(p)); d.setDate(d.getDate() + 1);
  return [iso(d), end];
}

// Indicateurs simples et vérifiables (sans marge, qui demande des coûts que l'artisan ne saisit pas toujours)
export function computeKpis(docs, appts, [from, to]) {
  const inRange = (x) => x && x >= from && x <= to;
  const inv = docs.filter((d) => d.number && ['facture', 'acompte', 'avoir'].includes(d.kind) && d.status !== 'annulee' && inRange(d.issue_date));
  const sign = (d) => (d.kind === 'avoir' ? -1 : 1);
  const ht = (d) => sign(d) * Math.abs(Number(d.totals?.ht || 0));
  const ca = inv.reduce((s, d) => s + ht(d), 0);
  const factures = inv.filter((d) => d.kind !== 'avoir');
  const encaisse = factures.reduce((s, d) => s + Number(d.paid_amount || 0), 0);
  const allDue = docs.filter((d) => d.number && ['facture', 'acompte'].includes(d.kind) && d.status !== 'annulee');
  const resteDu = allDue.reduce((s, d) => s + Math.max(0, Number(d.totals?.net ?? d.totals?.ttc ?? 0) - Number(d.paid_amount || 0)), 0);
  const today = iso(new Date());
  const retard = allDue.filter((d) => d.due_date && d.due_date < today && Number(d.paid_amount || 0) < Number(d.totals?.net ?? d.totals?.ttc ?? 0) - 0.005).length;
  const quotes = docs.filter((d) => d.kind === 'devis' && d.number && inRange(d.issue_date));
  const signes = quotes.filter((d) => d.status === 'accepte');
  const interventions = appts.filter((a) => ['valide', 'termine'].includes(a.status) && !a.personal && inRange(a.start_at.slice(0, 10)) && a.start_at.slice(0, 10) <= today).length;
  // Graphique : par semaine sur 3 mois ou moins, sinon par mois
  const days = (new Date(to) - new Date(from)) / 864e5;
  const series = [];
  if (days <= 100) {
    let s = new Date(from); s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
    while (iso(s) <= to && series.length < 16) {
      const e = new Date(s); e.setDate(e.getDate() + 6);
      const a = iso(s), b = iso(e);
      series.push({ label: s.toLocaleDateString(locale(), { day: 'numeric', month: 'short' }).replace('.', ''), value: inv.filter((x) => x.issue_date >= a && x.issue_date <= b).reduce((t2, x) => t2 + ht(x), 0) });
      s.setDate(s.getDate() + 7);
    }
  } else {
    const first = from === '2000-01-01' ? (inv.map((d) => d.issue_date).sort()[0] || to) : from;
    const s = new Date(first.slice(0, 7) + '-01T12:00:00');
    while (iso(s).slice(0, 7) <= to.slice(0, 7)) {
      const key = iso(s).slice(0, 7);
      series.push({ label: s.toLocaleDateString(locale(), { month: 'short' }).replace('.', '') + (days > 370 ? ' ' + String(s.getFullYear()).slice(2) : ''), value: inv.filter((x) => x.issue_date.slice(0, 7) === key).reduce((t2, x) => t2 + ht(x), 0) });
      s.setMonth(s.getMonth() + 1);
    }
    if (series.length > 18) series.splice(0, series.length - 18);
  }
  const types = {};
  inv.forEach((d) => { const k = d.intervention_type || 'Chantier'; types[k] = types[k] || { ca: 0, n: 0 }; types[k].ca += ht(d); if (d.kind !== 'avoir') types[k].n++; });
  const byType = Object.entries(types).map(([type, v]) => ({ type, ca: v.ca, n: v.n, pct: ca ? Math.round((v.ca / ca) * 100) : 0 })).sort((a, b) => b.ca - a.ca);
  return { ca, nbFactures: factures.length, moyenne: factures.length ? ca / factures.length : 0, encaisse, resteDu, retard, devis: quotes.length, signes: signes.length, taux: quotes.length ? Math.round((signes.length / quotes.length) * 100) : null, interventions, series, byType };
}

export function KpiView({ docs, appts, scope = 'client' }) {
  const [period, setPeriod] = useState('6');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const bounds = periodBounds(period, from, to);
  const k = computeKpis(docs, appts, bounds);
  const max = Math.max(...k.series.map((s) => s.value), 1);
  return (
    <>
      <Chips options={KPI_PERIODS.map(([v, l]) => [v, t(l)])} value={period} onChange={setPeriod} scroll />
      {period === 'custom' && <div className="form-grid two"><Field label={t('Du')}><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label={t('Au')}><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field></div>}
      <p className="small muted" style={{ margin: '0 0 10px' }}>{period === 'all' ? t('Depuis le début') : t('Du {a} au {b}', { a: date(bounds[0]), b: date(bounds[1]) })}</p>
      <div className="kpis">
        <div className="kpi red"><div className="l">{t("Chiffre d'affaires")}</div><div className="n">{money0(k.ca)} <small>{t('HT')}</small></div><div className="small" style={{ opacity: .85 }}>{t('{n} factures', { n: k.nbFactures })}</div></div>
        <div className="kpi red"><div className="l">{t('Encaissé')}</div><div className="n">{money0(k.encaisse)} <small>{t('TTC')}</small></div><div className="small" style={{ opacity: .85 }}>{t('sur les factures de la période')}</div></div>
        <div className="kpi"><div className="l">{t('Reste à encaisser')}</div><div className="n">{money0(k.resteDu)}</div><div className={'small' + (k.retard ? ' red-t bold' : ' muted')}>{k.retard ? t('{n} factures en retard', { n: k.retard }) : t('Aucune facture en retard')}</div></div>
        <div className="kpi"><div className="l">{t('Facture moyenne')}</div><div className="n">{money0(k.moyenne)}</div><div className="small muted">{t('Montant HT moyen par facture')}</div></div>
        <div className="kpi"><div className="l">{t('Devis signés')}</div><div className="n">{k.signes} <small>/ {k.devis}</small></div><div className="small muted">{k.taux === null ? t('Aucun devis envoyé') : t('{n} % de devis acceptés', { n: k.taux })}</div></div>
        <div className="kpi"><div className="l">{t('Interventions')}</div><div className="n">{k.interventions}</div><div className="small muted">{t('RDV réalisés sur la période')}</div></div>
      </div>
      <div className="grid2">
        <div>
          <Sec title={<>{k.series.length && (new Date(bounds[1]) - new Date(bounds[0])) / 864e5 <= 100 ? t('CA par semaine') : t('CA par mois')} <span className="small muted">({t('€ HT')})</span></>} />
          {k.series.length ? (
            <div className="bars" style={{ gap: k.series.length > 10 ? 4 : 10 }}>
              {k.series.map((s, i) => (
                <div className="b" key={i}>{s.value === max && s.value > 0 && <em>{money0(s.value)}</em>}<i style={{ height: `${(Math.max(0, s.value) / max) * 100}%` }} title={money0(s.value)} /><span style={{ fontSize: k.series.length > 10 ? 9 : 12 }}>{s.label}</span></div>
              ))}
            </div>
          ) : <Empty text={t('Pas encore de facture sur la période')} />}
        </div>
        <div>
          <Sec title={t("Par type d'intervention")} />
          {k.byType.length ? (
            <div className="table-wrap"><table className="t"><thead><tr><th>{t('Type')}</th><th className="num">{t('Factures')}</th><th className="num">{t('CA HT')}</th><th className="num">{t('Part')}</th></tr></thead>
              <tbody>{k.byType.map((r) => <tr key={r.type}><td className="strong">{t(r.type)}</td><td className="num" style={{ fontWeight: 400 }}>{r.n}</td><td className="num">{money0(r.ca)}</td><td className="num" style={{ fontWeight: 400 }}>{num(r.pct, 0)} %</td></tr>)}</tbody></table></div>
          ) : <Empty text={t('Pas encore de facture sur la période')} />}
        </div>
      </div>
    </>
  );
}
