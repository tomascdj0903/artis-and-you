// Carnet du logement : une fiche à garder (ou à donner à un acheteur, un locataire, un nouvel artisan).
// Logement, équipements et entretiens, chantiers réalisés, factures, repères de garanties. Export PDF A4.
import { useRef, useState } from 'react';
import { LuDownload, LuHouse } from 'react-icons/lu';
import { api } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { t } from '../../lib/i18n.js';
import { date, money, fullName } from '../../lib/format.js';
import { TopBar, useData, Loader } from '../../ui/index.jsx';
import { loadMine, coName } from './main.jsx';
import { eqInfo, nextDue } from './docs.jsx';
import { exportPdf } from '../common/docview.jsx';

const addYears = (d, n) => { const x = new Date(d); x.setFullYear(x.getFullYear() + n); return x; };
// Repères du Code civil (travaux de construction) : le point de départ légal est la réception des travaux
const GUARANTEES = [
  [1, 'Parfait achèvement', 'art. 1792-6 du Code civil'],
  [2, 'Bon fonctionnement des équipements', 'art. 1792-3 du Code civil'],
  [10, 'Décennale', 'art. 1792 et 1792-4-1 du Code civil'],
];

export function Carnet() {
  const { profile, run } = useApp();
  const ref = useRef();
  const [busy, setBusy] = useState(false);
  const [b] = useData(async () => {
    const m = await loadMine();
    if (!m.cids.length) return { ...m, projects: [], invoices: [] };
    const [projects, docs] = await Promise.all([
      api.select('projects', { client_id: m.cids }, { order: 'created_at.desc' }).catch(() => []),
      api.select('documents', { client_id: m.cids, kind: 'facture' }, { order: 'issue_date.desc' }).catch(() => []),
    ]);
    return { ...m, projects, invoices: docs.filter((d) => d.number && d.status !== 'brouillon') };
  }, []);
  if (!b) return <div className="content"><TopBar title={t('Carnet du logement')} /><Loader /></div>;
  const h = profile.home || {};
  const eqs = h.equipments || [];
  const done = b.projects.filter((p) => p.finished_at);
  const pdf = () => { setBusy(true); run(() => exportPdf(ref.current, 'carnet-du-logement.pdf'), t('PDF téléchargé')).finally(() => setBusy(false)); };
  const addr = [h.address, h.complement, [h.zip, h.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return (
    <div className="content">
      <TopBar title={t('Carnet du logement')} sub={t('Tout l’historique de votre logement')} />
      <div className="row mb" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn" onClick={pdf} disabled={busy}><LuDownload /> {busy ? t('Préparation…') : t('Télécharger en PDF')}</button>
        <span className="small muted">{t('Pratique pour une vente, une location ou un nouvel artisan.')}</span>
      </div>
      <div className="a4-wrap carnet-wrap">
        <div ref={ref} className="carnet">
          <header className="cn-head">
            <LuHouse size={30} aria-hidden />
            <div><h1>{t('Carnet du logement')}</h1><p>{addr || t('Adresse à compléter dans Mon logement')}</p></div>
            <div className="cn-date">{t('Édité le {d}', { d: date(new Date()) })}<br />{fullName(profile)}</div>
          </header>

          <section><h2>{t('Le logement')}</h2>
            <dl className="cn-facts">
              {[[t('Type'), h.type && t(h.type)], [t('Surface'), h.surface && h.surface + ' m²'], [t('Année de construction'), h.year], [t('Statut'), h.status && t(h.status)], [t('Accès'), h.access]].filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </section>

          <section><h2>{t('Équipements et entretien')}</h2>
            {!eqs.length ? <p className="cn-empty">{t('Aucun équipement renseigné.')}</p> : <table className="cn-table"><thead><tr><th>{t('Équipement')}</th><th>{t('Installé')}</th><th>{t('Dernier entretien')}</th><th>{t('Prochain')}</th><th>{t('Artisan')}</th></tr></thead>
              <tbody>{eqs.map((e) => { const nd = nextDue(e); return <tr key={e.id}><td>{e.label || t(eqInfo(e.type)[1])}</td><td>{e.installed || '—'}</td><td>{e.last_service ? date(e.last_service) : '—'}</td><td>{nd ? date(nd) : '—'}</td><td>{e.company_id ? coName(b.cm[e.company_id]) : '—'}</td></tr>; })}</tbody></table>}
          </section>

          <section><h2>{t('Travaux réalisés')}</h2>
            {!b.projects.length ? <p className="cn-empty">{t('Aucun chantier pour le moment.')}</p> : <table className="cn-table"><thead><tr><th>{t('Chantier')}</th><th>{t('Artisan')}</th><th>{t('Début')}</th><th>{t('Fin')}</th></tr></thead>
              <tbody>{b.projects.map((p) => <tr key={p.id}><td>{p.title}</td><td>{coName(b.cm[p.company_id])}</td><td>{date(p.created_at)}</td><td>{p.finished_at ? date(p.finished_at) : t('en cours')}</td></tr>)}</tbody></table>}
          </section>

          <section><h2>{t('Factures')}</h2>
            {!b.invoices.length ? <p className="cn-empty">{t('Aucune facture.')}</p> : <table className="cn-table"><thead><tr><th>{t('N°')}</th><th>{t('Artisan')}</th><th>{t('Date')}</th><th>{t('Objet')}</th><th className="r">{t('TTC')}</th></tr></thead>
              <tbody>{b.invoices.map((d) => <tr key={d.id}><td>{d.number}</td><td>{coName(b.cm[d.company_id])}</td><td>{date(d.issue_date)}</td><td>{d.object || '—'}</td><td className="r">{money(d.totals?.ttc)}</td></tr>)}</tbody></table>}
          </section>

          {done.length > 0 && <section><h2>{t('Repères de garanties')}</h2>
            <table className="cn-table"><thead><tr><th>{t('Chantier')}</th>{GUARANTEES.map(([n, l]) => <th key={n}>{t(l)} ({t('{n} an(s)', { n })})</th>)}</tr></thead>
              <tbody>{done.map((p) => <tr key={p.id}><td>{p.title}<br /><small>{coName(b.cm[p.company_id])}{b.cm[p.company_id]?.insurer ? ' · ' + t('assureur : {a}', { a: b.cm[p.company_id].insurer }) : ''}</small></td>{GUARANTEES.map(([n]) => <td key={n}>{t('jusqu’au {d}', { d: date(addYears(p.finished_at, n)) })}</td>)}</tr>)}</tbody></table>
            <p className="cn-note">{t('Dates indicatives calculées depuis la fin du chantier enregistrée dans l’app. Le point de départ légal est la réception des travaux, et ces garanties ne concernent que certains travaux. Références : {r}. En cas de doute, demandez à l’artisan ou à un professionnel du droit.', { r: GUARANTEES.map((g) => g[2]).join(' ; ') })}</p>
          </section>}
          <footer className="cn-foot">Artis & You · {t('Document établi à partir des informations saisies dans l’application.')}</footer>
        </div>
      </div>
    </div>
  );
}
