import { useState } from 'react';
import { t, locale } from '../../lib/i18n.js';
import { money0, num } from '../../lib/format.js';
import { Chips, Sec, Empty } from '../../ui/index.jsx';

export function computeKpis(docs, appts, months) {
  const from = new Date(); from.setDate(1); from.setHours(0, 0, 0, 0);
  if (months) from.setMonth(from.getMonth() - (months - 1)); else from.setFullYear(2000);
  const fromIso = from.toISOString().slice(0, 10);
  const inv = docs.filter((d) => d.number && ['facture', 'acompte', 'avoir'].includes(d.kind) && d.issue_date >= fromIso && d.status !== 'annulee');
  const sign = (d) => (d.kind === 'avoir' ? -1 : 1);
  const ht = (d) => sign(d) * Math.abs(Number(d.totals?.ht || 0));
  const mg = (d) => sign(d) * Math.abs(Number(d.totals?.margin ?? d.totals?.ht ?? 0));
  const ca = inv.reduce((s, d) => s + ht(d), 0);
  const marge = inv.reduce((s, d) => s + mg(d), 0);
  const factures = inv.filter((d) => d.kind === 'facture');
  const interventions = appts.filter((a) => ['valide', 'termine'].includes(a.status) && !a.personal && a.start_at.slice(0, 10) >= fromIso && a.start_at <= new Date().toISOString()).length;
  // CA par mois (6 derniers mois affichés, ou la période)
  const n = Math.min(months || 12, 12);
  const series = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    series.push({ label: d.toLocaleDateString(locale(), { month: 'short' }).replace('.', ''), value: inv.filter((x) => x.issue_date.slice(0, 7) === key).reduce((s, x) => s + ht(x), 0) });
  }
  const types = {};
  inv.forEach((d) => { const k = d.intervention_type || 'Chantier'; types[k] = types[k] || { ca: 0, marge: 0 }; types[k].ca += ht(d); types[k].marge += mg(d); });
  const byType = Object.entries(types).map(([type, v]) => ({ type, ca: v.ca, pct: v.ca ? Math.round((v.marge / v.ca) * 100) : 0 })).sort((a, b) => b.ca - a.ca);
  return { ca, marge, pct: ca ? Math.round((marge / ca) * 100) : 0, interventions, panier: factures.length ? ca / factures.length : 0, series, byType };
}

export function KpiView({ docs, appts }) {
  const [period, setPeriod] = useState(6);
  const k = computeKpis(docs, appts, period);
  const max = Math.max(...k.series.map((s) => s.value), 1);
  return (
    <>
      <Chips options={[[6, t('6 mois')], [12, t('12 mois')], [0, t('Depuis le début')]]} value={period} onChange={setPeriod} />
      <div className="kpis">
        <div className="kpi red"><div className="l">{t("Chiffre d'affaires")}</div><div className="n">{money0(k.ca)} <small>{t('HT')}</small></div></div>
        <div className="kpi red"><div className="l">{t('Marge')}</div><div className="n">{money0(k.marge)} <small>· {k.pct} %</small></div></div>
        <div className="kpi"><div className="l">{t('Interventions')}</div><div className="n">{k.interventions}</div></div>
        <div className="kpi"><div className="l">{t('Panier moyen')}</div><div className="n">{money0(k.panier)}</div></div>
      </div>
      <div className="grid2">
        <div>
          <Sec title={<>{t('CA par mois')} <span className="small muted">({t('€ HT')})</span></>} />
          <div className="bars">
            {k.series.map((s, i) => (
              <div className="b" key={i}>{s.value === max && s.value > 0 && <em>{money0(s.value)}</em>}<i style={{ height: `${(Math.max(0, s.value) / max) * 100}%` }} title={money0(s.value)} />{s.label}</div>
            ))}
          </div>
        </div>
        <div>
          <Sec title={t("Par type d'intervention")} />
          {k.byType.length ? (
            <div className="table-wrap"><table className="t"><thead><tr><th>{t('Type')}</th><th className="num">{t('CA HT')}</th><th className="num">{t('Marge')}</th></tr></thead>
              <tbody>{k.byType.map((r) => <tr key={r.type}><td className="strong">{t(r.type)}</td><td className="num">{money0(r.ca)}</td><td className="num" style={{ fontWeight: 400 }}>{num(r.pct, 0)} %</td></tr>)}</tbody></table></div>
          ) : <Empty text={t('Pas encore de facture sur la période')} />}
        </div>
      </div>
    </>
  );
}
