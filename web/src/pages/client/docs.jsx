import { useRef, useState } from 'react';
import { LuFilePen, LuFileText, LuHardHat, LuFolderOpen, LuChevronRight, LuDownload, LuPrinter, LuMessageSquare, LuCreditCard, LuLandmark, LuUser, LuHouse, LuUsers, LuBell, LuShield, LuCircleHelp, LuScale, LuLogOut, LuPalette, LuStar, LuCamera, LuDownload as LuDl } from 'react-icons/lu';
import { api, uid } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate, Link } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { money, date, dateMed, rel, dateShort, hm } from '../../lib/format.js';
import { statusPill, effectiveStatus, kindLabel, clientProgress, DOC_TYPES, VAULT_TYPES, docTypeLabel } from '../../lib/docs.js';
import { TopBar, SearchBar, Sec, Chips, Field, Toggle, useData, Loader, Empty, Avatar, Pill, StatusPill, Img, Lightbox, openFile, Sheet, KV } from '../../ui/index.jsx';
import { loadDoc, DocHero, DocSections, A4Preview, exportPdf, pdfName, totalsOf } from '../common/docview.jsx';
import { MenuRow } from '../pro/account.jsx';
import { loadMine, coName } from './main.jsx';

export function DocumentsHome() {
  const [q, setQ] = useState('');
  return (
    <div className="content">
      <TopBar back={false} title={t('Documents')} />
      <SearchBar placeholder={t('Recherchez un document')} value={q} onChange={setQ} onSubmit={() => navigate('/client/devis?q=' + encodeURIComponent(q))} />
      <div className="tiles home" style={{ marginTop: 10 }}>
        <button className="tile" onClick={() => navigate('/client/devis')}><LuFilePen />{t('Devis')}</button>
        <button className="tile" onClick={() => navigate('/client/factures')}><LuFileText />{t('Factures')}</button>
        <button className="tile" onClick={() => navigate('/client/chantiers')}><LuHardHat />{t('Mes chantiers')}</button>
        <button className="tile" onClick={() => navigate('/client/autres-docs')}><LuFolderOpen />{t('Autres docs')}</button>
      </div>
    </div>
  );
}

function useMyDocs() {
  return useData(async () => { const m = await loadMine(); const docs = m.cids.length ? await api.select('documents', { client_id: m.cids }, { order: 'issue_date.desc' }) : []; return { ...m, docs: docs.filter((d) => d.number) }; }, []);
}

function DocCards({ docs, cm, base }) {
  if (!docs.length) return <Empty text={t('Aucun document')} />;
  return (
    <div className="grid2">{docs.map((d) => (
      <Link key={d.id} to={base + d.id} className="rdvcard">
        <div className="row between"><b>{d.number}</b><StatusPill s={d.kind === 'devis' && effectiveStatus(d) === 'envoye' ? ['red', t('À signer')] : ['envoyee', 'retard', 'partielle'].includes(effectiveStatus(d)) && d.kind !== 'avoir' ? ['red', t('À payer')] : statusPill(d)} /></div>
        <div className="tt">{d.object || kindLabel(d.kind)}</div>
        <div className="row between small"><span className="muted">{coName(cm[d.company_id])} · {date(d.issue_date)}</span><b style={{ fontSize: 16 }}>{money(d.totals?.ttc)}</b></div>
      </Link>
    ))}</div>
  );
}

export function Quotes() {
  const [f, setF] = useState('');
  const [q, setQ] = useState(new URLSearchParams(location.search).get('q') || '');
  const [b] = useMyDocs();
  if (!b) return <div className="content"><TopBar title={t('Mes devis')} /><Loader /></div>;
  const list = b.docs.filter((d) => d.kind === 'devis').filter((d) => !f || (f === 'sign' ? effectiveStatus(d) === 'envoye' : f === 'ok' ? d.status === 'accepte' : d.status === 'refuse'))
    .filter((d) => !q || (d.number + ' ' + d.object + ' ' + coName(b.cm[d.company_id])).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="content">
      <TopBar title={t('Mes devis')} />
      <SearchBar placeholder={t('Recherchez un devis')} value={q} onChange={setQ} />
      <Chips options={[['', t('Tous')], ['sign', t('À signer')], ['ok', t('Signés')], ['ko', t('Refusés')]]} value={f} onChange={setF} />
      <DocCards docs={list} cm={b.cm} base="/client/devis/" />
    </div>
  );
}
export function Invoices() {
  const [f, setF] = useState('');
  const [q, setQ] = useState('');
  const [b] = useMyDocs();
  if (!b) return <div className="content"><TopBar title={t('Mes factures')} /><Loader /></div>;
  const list = b.docs.filter((d) => d.kind !== 'devis').filter((d) => !f || (f === 'pay' ? ['envoyee', 'partielle', 'retard'].includes(effectiveStatus(d)) && d.kind !== 'avoir' : d.status === 'payee'))
    .filter((d) => !q || (d.number + ' ' + d.object + ' ' + coName(b.cm[d.company_id])).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="content">
      <TopBar title={t('Mes factures')} />
      <SearchBar placeholder={t('Recherchez une facture')} value={q} onChange={setQ} />
      <Chips options={[['', t('Toutes')], ['pay', t('À payer')], ['paid', t('Payées')]]} value={f} onChange={setF} />
      <DocCards docs={list} cm={b.cm} base="/client/factures/" />
    </div>
  );
}

export function DocDetail({ params }) {
  const { run, confirm, wip } = useApp();
  const [b, reload] = useData(() => loadDoc(params.id), [params.id]);
  const [refuse, setRefuse] = useState(false);
  const [reason, setReason] = useState('');
  if (!b) return <div className="content"><TopBar title={t('Document')} /><Loader /></div>;
  if (!b.d) return <div className="content"><TopBar title={t('Document')} /><Empty text={t('Document introuvable')} /></div>;
  const { d } = b; const isQ = d.kind === 'devis'; const st = effectiveStatus(d);
  const base = isQ ? '/client/devis/' : '/client/factures/';
  const ask = async () => { const id = await api.rpc('start_conversation', { p_company: d.company_id }); navigate('/client/messages/' + id); };
  return (
    <div className="content">
      <TopBar title={kindLabel(d.kind)} sub={d.number} />
      <DocHero d={d} client={b.client} company={b.company} forClient />
      <div className="btns inline">
        {isQ && st === 'envoye' && <button className="btn" onClick={() => navigate(base + d.id + '/pdf')}>{t('Voir le devis en PDF et signer')}</button>}
        {!isQ && d.kind !== 'avoir' && ['envoyee', 'partielle', 'retard'].includes(st) && <button className="btn" onClick={() => navigate(base + d.id + '/payer')}><LuCreditCard /> {t('Payer {m}', { m: money(Math.max(0, totalsOf(d, b.company).net - d.paid_amount)) })}</button>}
        <div className="two">
          <button className="btn ghost sm" onClick={() => navigate(base + d.id + '/pdf')}>{isQ ? t('Voir le devis en PDF') : t('Voir la facture en PDF')}</button>
          <button className="btn ghost sm" onClick={ask}><LuMessageSquare /> {t('Poser une question')}</button>
        </div>
        {isQ && st === 'envoye' && <button className="btn light sm" onClick={() => setRefuse(true)}>{t('Refuser')}</button>}
        {d.status === 'payee' && <button className="btn ghost sm" onClick={() => navigate('/client/avis/' + d.company_id)}><LuStar /> {t('Donner mon avis')}</button>}
      </div>
      <DocSections {...b} forClient />
      <Sheet open={refuse} onClose={() => setRefuse(false)} title={t('Refuser le devis')}>
        <Field label={t('Raison (facultatif)')}><textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <button className="btn block" onClick={async () => { await run(() => api.rpc('client_quote_action', { p_id: d.id, p_action: 'refuse', p_reason: reason }), t('Devis refusé, l’artisan est prévenu')); setRefuse(false); reload(); }}>{t('Confirmer le refus')}</button>
      </Sheet>
    </div>
  );
}

export function DocPdf({ params }) {
  const { run, wip } = useApp();
  const [b] = useData(() => loadDoc(params.id), [params.id]);
  const ref = useRef();
  if (!b) return <div className="content"><TopBar title={t('Aperçu PDF')} /><Loader /></div>;
  const { d } = b; const isQ = d.kind === 'devis';
  return (
    <div className="content">
      <TopBar title={t('Aperçu PDF')} sub={pdfName(d)} />
      <A4Preview bundle={b} innerRef={ref} />
      <div className="btns inline">
        {isQ && effectiveStatus(d) === 'envoye' && <button className="btn" onClick={() => wip(t('La signature électronique'))}><LuFilePen /> {t('Signer le devis électroniquement')}</button>}
        {!isQ && d.kind !== 'avoir' && ['envoyee', 'partielle', 'retard'].includes(effectiveStatus(d)) && <button className="btn" onClick={() => navigate(`/client/factures/${d.id}/payer`)}>{t('Payer en ligne')}</button>}
        <div className="two">
          <button className="btn ghost" onClick={() => run(() => exportPdf(ref.current, pdfName(d)), t('PDF téléchargé'))}><LuDownload /> {t('Télécharger')}</button>
          <button className="btn ghost" onClick={() => window.print()}><LuPrinter /> {t('Imprimer')}</button>
        </div>
      </div>
    </div>
  );
}

export function Pay({ params }) {
  const { wip } = useApp();
  const [m, setM] = useState('card');
  const [b] = useData(() => loadDoc(params.id), [params.id]);
  if (!b) return <div className="content"><TopBar title={t('Payer en ligne')} /><Loader /></div>;
  const rest = Math.max(0, totalsOf(b.d, b.company).net - Number(b.d.paid_amount || 0));
  return (
    <div className="content narrow">
      <TopBar title={t('Payer en ligne')} sub={b.d.number} />
      <div className="hero center"><div className="l2">{t('Montant à payer')}</div><h2 style={{ fontSize: 36 }}>{money(rest)}</h2><div className="l2">{coName(b.company)} · {b.d.object}</div></div>
      <Sec title={t('Moyen de paiement')} />
      <button className={'opt' + (m === 'card' ? ' red' : '')} onClick={() => setM('card')}><LuCreditCard /><div><b>{t('Carte bancaire')}</b><small>Visa, Mastercard, CB</small></div></button>
      <button className={'opt' + (m === 'sepa' ? ' red' : '')} onClick={() => setM('sepa')}><LuLandmark /><div><b>{t('Virement SEPA')}</b><small>{t('Prélèvement sur votre compte')}</small></div></button>
      <div className="notice mt">{t('Ou par virement classique : IBAN {i}, référence {r}.', { i: b.company.iban || '—', r: b.d.number })}</div>
      <div className="btns"><button className="btn" onClick={() => wip(t('Le paiement en ligne'))}>{t('Payer {m}', { m: money(rest) })}</button><button className="btn ghost" onClick={() => navigate(`/client/factures/${b.d.id}/pdf`)}>{t('Télécharger la facture')}</button></div>
    </div>
  );
}

export function Review({ params }) {
  const { run } = useApp();
  const [n, setN] = useState(0);
  const [c, setC] = useState('');
  const [co] = useData(() => api.rpc('directory_get', { p_id: params.id }), [params.id]);
  if (!co) return <div className="content"><TopBar title={t('Donner mon avis')} /><Loader /></div>;
  return (
    <div className="content narrow">
      <TopBar title={t('Donner mon avis')} sub={coName(co)} />
      <div className="notice"><LuStar /><span>{t('Avis vérifié : seulement après un vrai rendez-vous. Il sera relu avant publication.')}</span></div>
      <div className="center starpick">{[1, 2, 3, 4, 5].map((i) => <button key={i} className={i <= n ? 'on' : ''} onClick={() => setN(i)} aria-label={i + '/5'}>★</button>)}</div>
      <Field label={t('Votre commentaire')}><textarea value={c} onChange={(e) => setC(e.target.value)} placeholder={t('Ponctualité, qualité du travail, propreté, explications…')} /></Field>
      <button className="btn block" disabled={!n} onClick={() => run(() => api.rpc('post_review', { p_company: params.id, p_rating: n, p_comment: c }), t('Merci ! Votre avis sera publié après relecture.')).then(() => navigate('/client/documents', { replace: true }))}>{t('Publier mon avis')}</button>
    </div>
  );
}

// ─────────────── Chantiers ───────────────
function useProjects() {
  return useData(async () => {
    const m = await loadMine();
    if (!m.cids.length) return { ...m, projects: [], ctx: { docs: [], appts: [], reviews: [] } };
    const [projects, docs, appts, reviews] = await Promise.all([api.select('projects', { client_id: m.cids }, { order: 'created_at.desc' }), api.select('documents', { client_id: m.cids }), api.select('appointments', { client_id: m.cids }), api.select('reviews', { author_id: uid() })]);
    return { ...m, projects, ctx: { docs, appts, reviews } };
  }, []);
}
export function Projects() {
  const [f, setF] = useState('');
  const [b] = useProjects();
  if (!b) return <div className="content"><TopBar title={t('Mes chantiers')} /><Loader /></div>;
  const rows = b.projects.map((p) => ({ p, pr: clientProgress(p, b.ctx) })).filter(({ pr }) => !f || (f === 'done' ? pr.cur >= 5 : pr.cur < 5));
  return (
    <div className="content">
      <TopBar title={t('Mes chantiers')} />
      <Chips options={[['', t('Tous')], ['run', t('En cours')], ['done', t('Terminés')]]} value={f} onChange={setF} />
      {!rows.length ? <Empty icon={LuHardHat} text={t('Aucun chantier pour le moment.')} /> : (
        <div className="grid2">{rows.map(({ p, pr }) => (
          <Link key={p.id} to={'/client/chantiers/' + p.id} className="rdvcard">
            <div className="row between"><b style={{ fontSize: 17 }}>{p.title}</b><Pill c={pr.cur >= 5 ? 'green' : 'navy-o'}>{pr.cur >= 5 ? t('Terminé') : t('En cours')}</Pill></div>
            <div className="small muted">{coName(b.cm[p.company_id])}{p.address ? ' · ' + p.address : ''}</div>
            <div className="progress mt"><i style={{ width: (Math.min(pr.cur, 5) / 5) * 100 + '%' }} /></div>
            <div className="small bold">{pr.cur >= 5 ? t('Chantier terminé') : t('Étape : {s}', { s: t(pr.list[Math.max(0, pr.cur - 1)][0]) })}</div>
          </Link>
        ))}</div>
      )}
    </div>
  );
}
export function ProjectDetail({ params }) {
  const [big, setBig] = useState(null);
  const [b] = useProjects();
  const [photos] = useData(() => api.select('files', { project_id: params.id, kind: 'photo' }, { order: 'created_at.desc' }), [params.id]);
  if (!b) return <div className="content"><TopBar title={t('Suivi de chantier')} /><Loader /></div>;
  const p = b.projects.find((x) => x.id === params.id);
  if (!p) return <div className="content"><TopBar title={t('Suivi de chantier')} /><Empty text={t('Chantier introuvable')} /></div>;
  const pr = clientProgress(p, b.ctx);
  const co = b.cm[p.company_id];
  const next = b.ctx.appts.filter((a) => a.project_id === p.id && a.end_at >= new Date().toISOString() && ['valide', 'a_valider'].includes(a.status)).sort((x, y) => x.start_at.localeCompare(y.start_at))[0];
  return (
    <div className="content narrow">
      <TopBar title={t('Suivi de chantier')} sub={p.title} />
      <div className="card navy"><div className="small muted">{t('Où en est le chantier ?')}</div><b style={{ fontSize: 20 }}>{pr.cur >= 5 ? t('Chantier terminé') : t(pr.list[Math.max(0, pr.cur - 1)][0])}</b><div className="small muted">{pr.cur < 5 && t('Prochaine étape : {s}', { s: t(pr.list[pr.cur][0]) })}</div><div className="small muted">{coName(co)}{next ? ' · ' + t('prochain RDV {d} à {h}', { d: dateShort(next.start_at), h: hm(next.start_at) }) : ''}</div></div>
      <Sec title={t('Étapes')} />
      <div className="steps">{pr.list.map(([l], i) => <div key={l} className={'step ' + (i < pr.cur ? 'done' : i === pr.cur ? 'cur' : '')}><span className="b">{i < pr.cur ? '✓' : i + 1}</span><div><b>{t(l)}</b></div></div>)}</div>
      <Sec title={t('Photos du chantier')} meta={photos ? t('{n} photos', { n: photos.length }) : ''} />
      {photos?.length ? <div className="photos-grid">{photos.map((f) => <Img key={f.id} path={f.path} onClick={() => setBig(f.path)} />)}</div> : <Empty icon={LuCamera} text={t('Pas encore de photo.')} />}
      <div className="btns"><button className="btn" onClick={async () => { const id = await api.rpc('start_conversation', { p_company: p.company_id }); navigate('/client/messages/' + id); }}>{t("Écrire à l'artisan")}</button></div>
      <Lightbox path={big} onClose={() => setBig(null)} />
    </div>
  );
}

export function OtherDocs() {
  const [f, setF] = useState('');
  const [b] = useData(async () => { const m = await loadMine(); const files = await api.select('files', { kind: ['doc', 'vault'] }, { order: 'created_at.desc' }); return { ...m, files: files.filter((x) => x.shared_with_client) }; }, []);
  if (!b) return <div className="content"><TopBar title={t('Autres docs')} /><Loader /></div>;
  const isGar = (x) => ['garantie', 'contrat'].includes(x.doc_type);
  const list = b.files.filter((x) => !f || (f === 'gar' ? isGar(x) : !isGar(x)));
  return (
    <div className="content">
      <TopBar title={t('Autres docs')} sub={t('Attestations et garanties')} />
      <Chips options={[['', t('Tous')], ['att', t('Attestations')], ['gar', t('Garanties')]]} value={f} onChange={setF} />
      {!list.length ? <Empty text={t('Les attestations et garanties partagées par vos artisans apparaîtront ici.')} /> : (
        <div className="list">{list.map((x) => (
          <div key={x.id} className="li"><div className="ficon"><LuFileText /></div><div className="grow"><div className="t1">{x.name}</div><div className="t2">{coName(b.cm[x.company_id])} · {docTypeLabel(x.doc_type, x.kind === 'vault' ? VAULT_TYPES : DOC_TYPES)} · {date(x.issued_at || x.created_at)}</div></div><button className="round" onClick={() => openFile(x.path, x.name)} aria-label={t('Télécharger')}><LuDl /></button></div>
        ))}</div>
      )}
    </div>
  );
}

// ─────────────── Compte particulier ───────────────
export function Account() {
  const { profile } = useApp();
  const logout = async () => { await api.signOut(); navigate('/connexion', { replace: true }); };
  return (
    <div className="content narrow">
      <TopBar title={t('Profil et réglages')} />
      <div className="card navy row" style={{ gap: 14 }}><Avatar name={profile.first_name} last={profile.last_name} path={profile.avatar_path} size="lg" ring /><div><b style={{ fontSize: 19 }}>{profile.first_name} {profile.last_name}</b><div className="muted">{profile.email}</div></div></div>
      <Sec title={t('Compte')} />
      <div className="list"><MenuRow to="/client/compte/profil" icon={LuUser} label={t('Mon profil')} /><MenuRow to="/client/compte/logement" icon={LuHouse} label={t('Mon logement')} sub={[profile.home?.address, profile.home?.city].filter(Boolean).join(', ')} /><MenuRow to="/client/compte/artisans" icon={LuUsers} label={t('Mes artisans')} /></div>
      <Sec title={t('Application')} />
      <div className="list"><MenuRow to="/client/compte/notifications" icon={LuBell} label={t('Notifications')} /><MenuRow to="/client/compte/apparence" icon={LuPalette} label={t('Langue et apparence')} /><MenuRow to="/client/compte/donnees" icon={LuShield} label={t('Données et confidentialité')} />{profile.is_admin && <MenuRow to="/client/admin" icon={LuShield} label={t('Administration Artis & You')} />}</div>
      <Sec title={t('Aide')} />
      <div className="list"><MenuRow to="/client/compte/aide" icon={LuCircleHelp} label={t('Aide et support')} /><MenuRow to="/mentions-legales" icon={LuScale} label={t('Mentions légales')} /><MenuRow onClick={logout} icon={LuLogOut} label={t('Se déconnecter')} red /></div>
    </div>
  );
}

export function Home2() {
  const { profile, setProfile, run } = useApp();
  const [h, setH] = useState({ address: '', complement: '', zip: '', city: '', access: '', parking: '', type: 'Maison', surface: '', year: '', status: 'Propriétaire', ...(profile.home || {}) });
  const F = (k, l, p = {}) => <Field label={l}><input value={h[k] || ''} onChange={(e) => setH({ ...h, [k]: e.target.value })} {...p} /></Field>;
  return (
    <div className="content narrow">
      <TopBar title={t('Mon logement')} />
      <Sec title={t('Adresse')} />
      {F('address', t('Adresse'))}<div className="form-grid three">{F('complement', t('Complément'))}{F('zip', t('Code postal'))}{F('city', t('Ville'))}</div>
      <div className="form-grid two">{F('access', t('Accès (digicode, étage…)'))}{F('parking', t('Stationnement'))}</div>
      <Sec title={t('Le logement')} />
      <div className="form-grid two">
        <Field label={t('Type')}><select value={h.type} onChange={(e) => setH({ ...h, type: e.target.value })}>{['Maison', 'Appartement', 'Local professionnel', 'Autre'].map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></Field>
        {F('surface', t('Surface (m²)'), { type: 'number' })}{F('year', t('Année de construction'), { type: 'number' })}
        <Field label={t('Statut')}><select value={h.status} onChange={(e) => setH({ ...h, status: e.target.value })}>{['Propriétaire', 'Locataire', 'Syndic / copropriété'].map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></Field>
      </div>
      <p className="small muted">{t('Ces infos aident l’artisan à préparer son intervention (TVA à taux réduit si le logement a plus de 2 ans).')}</p>
      <button className="btn block" onClick={() => run(async () => { await api.update('profiles', { id: profile.id }, { home: h }); setProfile({ ...profile, home: h }); }, t('Logement enregistré'))}>{t('Enregistrer')}</button>
    </div>
  );
}

export function MyArtisans() {
  const [b] = useData(async () => { const m = await loadMine(); const appts = m.cids.length ? await api.select('appointments', { client_id: m.cids }, { order: 'start_at.desc' }) : []; return { ...m, appts }; }, []);
  if (!b) return <div className="content"><TopBar title={t('Mes artisans')} /><Loader /></div>;
  const now = new Date().toISOString();
  return (
    <div className="content narrow">
      <TopBar title={t('Mes artisans')} />
      {!Object.keys(b.cm).length ? <Empty text={t('Les artisans avec qui vous travaillez apparaîtront ici.')} /> : Object.values(b.cm).map((co) => {
        const mine = b.appts.filter((a) => a.company_id === co.id);
        const next = mine.filter((a) => a.start_at >= now && ['valide', 'a_valider'].includes(a.status)).slice(-1)[0];
        const last = mine.find((a) => a.start_at < now);
        return (
          <div key={co.id} className="card mb">
            <div className="row"><Avatar name={coName(co).split(' ')[0]} last={coName(co).split(' ')[1]} path={co.logo_path} /><div className="grow"><b>{coName(co)}</b><div className="small muted">{(co.trades || []).slice(0, 2).map(t).join(' · ')}</div></div></div>
            <div className="small mt">{next ? t('Prochain RDV : {d} à {h}', { d: dateShort(next.start_at), h: hm(next.start_at) }) : last ? t('Dernière intervention : {d}', { d: dateMed(last.start_at) }) : ''}</div>
            <div className="btns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', margin: '10px 0 0' }}>
              <button className="btn ghost sm" onClick={async () => { const id = await api.rpc('start_conversation', { p_company: co.id }); navigate('/client/messages/' + id); }}>{t('Message')}</button>
              <button className="btn sm" onClick={() => navigate(`/client/artisans/${co.id}/demande`)}>{t('Prendre RDV')}</button>
            </div>
          </div>
        );
      })}
      <button className="btn ghost block" onClick={() => navigate('/client/artisans')}>{t('Trouver un artisan')}</button>
    </div>
  );
}

export function NotifSettings() {
  const { profile, setProfile } = useApp();
  const [n, setN] = useState({ push: true, email: true, sms: false, rdv: true, message: true, chantier: true, documents: true, paiement: true, rappel: 24, dnd: false, ...(profile.notif_prefs || {}) });
  const set = async (k, v) => { const x = { ...n, [k]: v }; setN(x); await api.update('profiles', { id: profile.id }, { notif_prefs: x }); setProfile({ ...profile, notif_prefs: x }); };
  const R = ([k, l, s]) => <div key={k} className="r"><span className="k">{t(l)}{s && <div className="small faint">{t(s)}</div>}</span><Toggle checked={n[k]} onChange={(v) => set(k, v)} /></div>;
  return (
    <div className="content narrow">
      <TopBar title={t('Notifications')} />
      <Sec title={t('Comment être prévenu')} />
      <div className="kv">{[['push', 'Sur mon téléphone / ordinateur'], ['email', 'Par e-mail', 'Bientôt disponible'], ['sms', 'Par SMS', 'Bientôt disponible']].map(R)}</div>
      <Sec title={t('Ce que je reçois')} />
      <div className="kv">{[['rdv', 'Rendez-vous'], ['message', 'Messages'], ['chantier', 'Avancement du chantier'], ['documents', 'Devis et factures'], ['paiement', 'Paiements']].map(R)}</div>
      <Sec title={t('Rappels')} />
      <div className="kv"><div className="r"><span className="k">{t('Rappel avant un RDV')}</span><select value={n.rappel} onChange={(e) => set('rappel', +e.target.value)}>{[0, 1, 2, 24, 48].map((h) => <option key={h} value={h}>{h ? t('{n} h avant', { n: h }) : t('Aucun')}</option>)}</select></div>{R(['dnd', 'Ne pas déranger (21 h – 8 h)'])}</div>
    </div>
  );
}
