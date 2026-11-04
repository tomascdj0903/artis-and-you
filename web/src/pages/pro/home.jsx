import { SmartSearch } from '../../ui/smartsearch.jsx';
import { useEffect, useState } from 'react';
import { checkVaultReminders } from './files.jsx';
import { dueReminders, autoReminders } from '../../lib/relances.js';
import { LuShieldAlert, LuUsers, LuCalendar, LuFileText, LuChartColumn, LuMessageSquare, LuNetwork, LuSearch } from 'react-icons/lu';
import { useApp } from '../../lib/store.jsx';
import { navigate, Link, useLocation } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { api } from '../../lib/api.js';
import { TopBar, SearchBar, useData, Loader, Sec, Empty, StatusPill } from '../../ui/index.jsx';
import { clientName, money, date, dateShort, hm } from '../../lib/format.js';
import { statusPill, kindLabel, apptStatus } from '../../lib/docs.js';

export function Home() {
  const { company, can, profile } = useApp();
  const [relN, setRelN] = useState(0);
  const { unread } = useApp();
  // Demandes de RDV des particuliers à traiter (visibles dès l'accueil)
  const [reqs] = useData(async () => {
    if (!can('planning')) return [];
    const [ap, cl] = await Promise.all([api.select('appointments', { company_id: company.id, status: 'a_valider' }, { order: 'start_at.asc' }), api.select('clients', { company_id: company.id })]);
    const cm = Object.fromEntries(cl.map((c) => [c.id, c]));
    return ap.map((a) => ({ ...a, c: cm[a.client_id] }));
  }, [unread.rdv]);
  useEffect(() => {
    if (profile.member_role === 'ouvrier') return;
    checkVaultReminders(company, profile).catch(() => {});
    (async () => {
      if (!can('devis')) return;
      await autoReminders(company, profile).catch(() => 0);
      const docs = await api.select('documents', { company_id: company.id });
      setRelN(dueReminders(docs, company).length);
    })();
  }, [company.id]);
  const [q, setQ] = useState('');
  const days = company?.trial_ends_at ? Math.ceil((new Date(company.trial_ends_at) - new Date()) / 864e5) : null;
  const tiles = [
    ['/pro/clients', LuUsers, 'Clients', can('clients')], ['/pro/planning', LuCalendar, 'Planning', can('planning')],
    ['/pro/documents', LuFileText, 'Documents', can('devis') || can('clients')], ['/pro/crm', LuChartColumn, 'CRM', can('kpi') || can('devis')],
    ['/pro/messages', LuMessageSquare, 'Messages', true], ['/pro/reseau', LuNetwork, 'Mon réseau', true],
  ].filter((x) => x[3]);
  return (
    <div className="content">
      <TopBar back={false} home />
      <h1 className="hide-mob" style={{ fontSize: 28, marginBottom: 4 }}>{t('Bonjour {n}', { n: profile.first_name })} <span className="muted" style={{ fontSize: 18, fontWeight: 600 }}>· {company?.name}</span></h1>
      <SmartSearch />
      {company && (company.verification_status || (company.verified ? 'approved' : 'pending')) !== 'approved' && (
        <Link to="/pro/compte/entreprise" className="alert" style={{ color: 'inherit' }}>
          <LuShieldAlert className="red-t" size={28} style={{ flexShrink: 0 }} />
          <div>{company.verification_status === 'rejected'
            ? <><b>{t('Votre inscription est à compléter')}</b><div className="small">{company.verification_note || t('L’équipe Artizy a besoin d’informations supplémentaires.')}</div></>
            : <><b>{t('Compte en cours de validation')}</b><div className="small">{t('L’équipe Artizy vérifie votre SIRET et vos informations. Vous pouvez déjà utiliser l’application ; votre profil sera visible des clients après validation.')}</div></>}</div>
        </Link>
      )}
 {reqs?.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}><b>📥 {reqs.length > 1 ? t('{n} demandes de rendez-vous à traiter', { n: reqs.length }) : t('1 demande de rendez-vous à traiter')}</b><Link to="/pro/planning" className="small bold">{t('Planning')} ›</Link></div>
          <div className="list" style={{ marginTop: 8 }}>{reqs.slice(0, 4).map((a) => (
            <Link key={a.id} to={'/pro/planning/rdv/' + a.id} className="li click"><div className="grow"><div className="t1">{clientName(a.c) || a.contact_name} · {t(a.type)}</div><div className="t2">{dateShort(a.start_at)} {hm(a.start_at)}{a.mode === 'visio' ? ' · ' + t('Visio') : a.address ? ' · ' + a.address : ''}</div>{a.request_text && <div className="small muted ellipsis">« {a.request_text} »</div>}</div><span className="pill red-o">{t('À valider')}</span></Link>
          ))}</div>
        </div>
      )}
      {relN > 0 && <Link to="/pro/relances" className="notice">🔔 <span>{relN > 1 ? t('{n} relances clients à envoyer aujourd’hui', { n: relN }) : t('1 relance client à envoyer aujourd’hui')} →</span></Link>}
      {days !== null && days >= 0 && days <= 30 && company?.plan && (
        <Link to="/pro/compte/abonnement" className="notice">⏳ <span>{t('Essai gratuit : encore {n} jours. Choisir ma formule', { n: days })} →</span></Link>
      )}
      <div className="tiles home">
        {tiles.map(([to, I, l]) => <button key={to} className="tile" style={{ position: 'relative' }} onClick={() => navigate(to)}><I />{t(l)}{to === '/pro/planning' && unread.rdv > 0 && <span className="dot" style={{ position: 'absolute', top: 10, right: 12 }}>{unread.rdv}</span>}{to === '/pro/messages' && unread.messages > 0 && <span className="dot" style={{ position: 'absolute', top: 10, right: 12 }}>{unread.messages}</span>}</button>)}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 40 }}><Link to="/mentions-legales" className="bold">{t('Mentions légales')}</Link></div>
    </div>
  );
}

export function GlobalSearch() {
  const { query } = useLocation();
  const { company } = useApp();
  const [q, setQ] = useState(query.get('q') || '');
  const [term, setTerm] = useState(q);
  const [res, , loading] = useData(async () => {
    if (!term) return null;
    const cid = company.id;
    const [c1, c2, c3, d1, d2, i1, a1] = await Promise.all([
      api.select('clients', { company_id: cid, 'last_name~': term }, { limit: 20 }), api.select('clients', { company_id: cid, 'company_name~': term }, { limit: 20 }),
      api.select('clients', { company_id: cid, 'trade_name~': term }, { limit: 20 }),
      api.select('documents', { company_id: cid, 'number~': term }, { limit: 20 }), api.select('documents', { company_id: cid, 'object~': term }, { limit: 20 }),
      api.select('items', { company_id: cid, 'name~': term }, { limit: 20 }), api.select('appointments', { company_id: cid, 'title~': term }, { limit: 20, order: 'start_at.desc' }),
    ]);
    const uniq = (arr) => [...new Map(arr.map((x) => [x.id, x])).values()];
    const clients = uniq([...c1, ...c2, ...c3]);
    const allClients = await api.select('clients', { company_id: cid });
    const cm = Object.fromEntries(allClients.map((c) => [c.id, c]));
    return { clients, docs: uniq([...d1, ...d2]), items: i1, appts: a1, cm };
  }, [term]);
  return (
    <div className="content">
      <TopBar title={t('Recherche')} />
      <SearchBar placeholder={t('Que recherchez-vous ?')} value={q} onChange={setQ} onSubmit={() => setTerm(q.trim())} />
      {loading && term ? <Loader /> : !res ? <Empty icon={LuSearch} text={t('Client, n° de devis ou facture, produit, rendez-vous…')} /> : (
        <>
          {!res.clients.length && !res.docs.length && !res.items.length && !res.appts.length && <Empty text={t('Aucun résultat pour « {q} »', { q: term })} />}
          {res.clients.length > 0 && <><Sec title={t('Clients')} meta={res.clients.length} /><div className="list">{res.clients.map((c) => <button key={c.id} className="li click" onClick={() => navigate('/pro/clients/' + c.id)}><div className="grow"><div className="t1">{clientName(c)}</div><div className="t2">{c.billing_city}</div></div></button>)}</div></>}
          {res.docs.length > 0 && <><Sec title={t('Devis et factures')} meta={res.docs.length} /><div className="list">{res.docs.map((d) => <button key={d.id} className="li click" onClick={() => navigate('/pro/documents/' + d.id)}><div className="grow"><div className="t1">{d.number || t('Brouillon')} <StatusPill s={statusPill(d)} /></div><div className="t2">{kindLabel(d.kind)} · {clientName(res.cm[d.client_id])} · {d.object}</div></div><div className="side-r"><b>{money(d.totals?.ht)}</b>{date(d.issue_date)}</div></button>)}</div></>}
          {res.appts.length > 0 && <><Sec title={t('Rendez-vous')} meta={res.appts.length} /><div className="list">{res.appts.map((a) => <button key={a.id} className="li click" onClick={() => navigate('/pro/planning/rdv/' + a.id)}><div className="grow"><div className="t1">{a.title} <StatusPill s={apptStatus(a.status)} /></div><div className="t2">{dateShort(a.start_at)} · {hm(a.start_at)} · {clientName(res.cm[a.client_id])}</div></div></button>)}</div></>}
          {res.items.length > 0 && <><Sec title={t('Bibliothèque')} meta={res.items.length} /><div className="list">{res.items.map((i) => <button key={i.id} className="li click" onClick={() => navigate('/pro/crm/bibliotheque/' + i.id)}><div className="grow"><div className="t1">{i.name}</div><div className="t2">{i.family}</div></div><div className="side-r"><b>{money(i.sale_price)}</b></div></button>)}</div></>}
        </>
      )}
    </div>
  );
}
