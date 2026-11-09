import { SmartSearch } from '../../ui/smartsearch.jsx';
import { useEffect, useState } from 'react';
import { checkVaultReminders } from './files.jsx';
import { dueReminders, autoReminders } from '../../lib/relances.js';
import { LuHandshake, LuShieldAlert, LuUsers, LuCalendar, LuFileText, LuChartColumn, LuMessageSquare, LuNetwork, LuSearch } from 'react-icons/lu';
import { useApp } from '../../lib/store.jsx';
import { navigate, Link, useLocation } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { api } from '../../lib/api.js';
import { TopBar, SearchBar, useData, Loader, Sec, Empty, StatusPill } from '../../ui/index.jsx';
import { clientName, money, date, dateShort, hm } from '../../lib/format.js';
import { statusPill, kindLabel, apptStatus, effectiveStatus } from '../../lib/docs.js';

const tileSub = (to, st, unread) => {
  if (!st) return null;
  const n = (k, one, many) => (k === 1 ? t(one) : t(many, { n: k }));
  switch (to) {
    case '/pro/clients': return [n(st.clients, '1 fiche client', '{n} fiches clients')];
    case '/pro/planning': return [st.today ? n(st.today, '1 RDV aujourd’hui', '{n} RDV aujourd’hui') : t('Aucun RDV aujourd’hui')];
    case '/pro/documents': return st.late ? ['! ' + n(st.late, '1 facture en retard', '{n} factures en retard'), true] : [st.pending ? n(st.pending, '1 devis en attente', '{n} devis en attente') : t('Devis et factures')];
    case '/pro/crm': return [t('Suivi et chiffres')];
    case '/pro/messages': return [unread.messages ? n(unread.messages, '1 message non lu', '{n} messages non lus') : t('Clients et équipe')];
    case '/pro/reseau': return [st.net ? n(st.net, '1 pro dans mon réseau', '{n} pros dans mon réseau') : t('Trouver des pros')];
    default: return null;
  }
};

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
  // Chiffres de l'accueil : RDV du jour, devis en attente, CA du mois, compteurs des tuiles
  const [st] = useData(async () => {
    const d0 = new Date(); d0.setHours(0, 0, 0, 0); const d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
    const m0 = new Date(d0.getFullYear(), d0.getMonth(), 1).toISOString().slice(0, 10);
    const [ap, docs, cl, net] = await Promise.all([
      can('planning') ? api.select('appointments', { company_id: company.id }) : [],
      can('devis') || can('kpi') ? api.select('documents', { company_id: company.id }) : [],
      can('clients') ? api.select('clients', { company_id: company.id }, { columns: 'id' }) : [],
      api.select('network', { company_id: company.id }).catch(() => []),
    ]);
    const today = ap.filter((a) => ['valide', 'a_valider'].includes(a.status) && new Date(a.start_at) >= d0 && new Date(a.start_at) < d1).length;
    const pending = docs.filter((d) => d.kind === 'devis' && d.number && effectiveStatus(d) === 'envoye').length;
    const late = docs.filter((d) => ['facture', 'acompte'].includes(d.kind) && effectiveStatus(d) === 'retard').length;
    const ca = docs.filter((d) => d.number && (d.issue_date || '') >= m0 && ['facture', 'acompte', 'avoir'].includes(d.kind)).reduce((s, d) => s + (d.kind === 'avoir' ? -1 : 1) * Number(d.totals?.ht || 0), 0);
    return { today, pending, late, ca, clients: cl.length, net: net.length };
  }, [unread.rdv]);
  const days = company?.trial_ends_at ? Math.ceil((new Date(company.trial_ends_at) - new Date()) / 864e5) : null;
  const tiles = [
    ['/pro/clients', LuUsers, 'Clients', can('clients')], ['/pro/planning', LuCalendar, 'Planning', can('planning')],
    ['/pro/documents', LuFileText, 'Documents', can('devis') || can('clients')], ['/pro/crm', LuChartColumn, 'CRM', can('kpi') || can('devis')],
    ['/pro/messages', LuMessageSquare, 'Messages', true], ['/pro/reseau', LuNetwork, 'Mon réseau', true],
  ].filter((x) => x[3]);
  return (
    <div className="content">
      <section className="home-band">
        <TopBar back={false} home />
        <div className="hb-hello"><span>{t('Bonjour {n}', { n: profile.first_name })}</span><b>{company?.trade_name || company?.name}</b></div>
        <SmartSearch />
        {st && <div className="hb-kpis">
          {can('planning') && <Link to="/pro/planning" className="hb-kpi"><span className="hk-ic"><LuCalendar /></span><b>{st.today}</b><span>{t('RDV aujourd’hui')}</span></Link>}
          {can('devis') && <Link to="/pro/documents/devis" className="hb-kpi"><span className="hk-ic"><LuFileText /></span><b>{st.pending}</b><span>{t('devis en attente')}</span></Link>}
          {can('kpi') && <Link to="/pro/crm/kpi" className="hb-kpi"><span className="hk-ic"><LuChartColumn /></span><b>{money(st.ca).replace(/,00\s?€/, ' €')}</b><span>{t('CA HT du mois')}</span></Link>}
        </div>}
        {((days !== null && days >= 0 && days <= 30 && company?.plan) || company?.referral_code) && <div className="hb-foot">
          {days !== null && days >= 0 && days <= 30 && company?.plan && <Link to="/pro/compte/abonnement">⏳ {t('Essai gratuit : {n} jours restants', { n: days })}<span className="hb-long"> ·</span> <u>{t('Choisir ma formule')}</u></Link>}
          {company?.referral_code && <ReferralLink code={company.referral_code} />}
        </div>}
      </section>
      <div className="htiles">
        {tiles.map(([to, I, l]) => { const sub = tileSub(to, st, unread); return (
          <Link key={to} to={to} className="htile">
            <span className="ht-ic"><I /></span>
            <b>{t(l)}</b>
            {sub && <small className={sub[1] ? 'warn' : ''}>{sub[0]}</small>}
            {to === '/pro/messages' && unread.messages > 0 && <span className="dot">{unread.messages}</span>}
            {to === '/pro/planning' && unread.rdv > 0 && <span className="dot">{unread.rdv}</span>}
          </Link>
        ); })}
      </div>
      {company && (company.verification_status || (company.verified ? 'approved' : 'pending')) !== 'approved' && (
        <Link to="/pro/compte/entreprise" className="alert" style={{ color: 'inherit' }}>
          <LuShieldAlert className="red-t" size={28} style={{ flexShrink: 0 }} />
          <div>{company.verification_status === 'rejected'
            ? <><b>{t('Votre inscription est à compléter')}</b><div className="small">{company.verification_note || t('L’équipe Artesa a besoin d’informations supplémentaires.')}</div></>
            : <><b>{t('Compte en cours de validation')}</b><div className="small">{t('L’équipe Artesa vérifie votre SIRET et vos informations. Vous pouvez déjà utiliser l’application ; votre profil sera visible des clients après validation.')}</div></>}</div>
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

// Parrainage mis en avant : lien d'inscription avec le code prérempli, partage natif ou copie
export function ReferralCard({ code }) {
  const { toast } = useApp();
  const [hide, setHide] = useState(() => { try { return localStorage.getItem('ay-ref-hide') === code; } catch { return false; } });
  if (hide) return null;
  const url = `${location.origin}/inscription/artisan?parrain=${encodeURIComponent(code)}`;
  const msg = t('Je gère mes devis, factures et rendez-vous avec Artesa. Inscris-toi avec mon code {c} : 1 mois offert en plus de l’essai.', { c: code });
  const share = async () => {
    try { if (navigator.share) { await navigator.share({ title: 'Artesa', text: msg, url }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(msg + ' ' + url); toast(t('Lien de parrainage copié')); } catch {}
  };
  return (
    <div className="notice ref">
      🎁 <span><b>{t('Parrainez un artisan : 1 mois offert pour lui, 15 jours pour vous')}</b><small className="block">{t('Votre code : {c}', { c: code })}</small></span>
      <button className="btn xs" onClick={share}>{t('Partager')}</button>
      <button className="link small" aria-label={t('Masquer')} onClick={() => { try { localStorage.setItem('ay-ref-hide', code); } catch {} setHide(true); }}>✕</button>
    </div>
  );
}

// Parrainage intégré au bandeau : un lien discret qui partage le code
function ReferralLink({ code }) {
  const { toast } = useApp();
  const url = `${location.origin}/inscription/artisan?parrain=${encodeURIComponent(code)}`;
  const msg = t('Je gère mes devis, factures et rendez-vous avec Artesa. Inscris-toi avec mon code {c} : 1 mois offert en plus de l’essai.', { c: code });
  const share = async () => {
    try { if (navigator.share) { await navigator.share({ title: 'Artesa', text: msg, url }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(msg + ' ' + url); toast(t('Lien de parrainage copié')); } catch {}
  };
  return <button type="button" onClick={share}>🎁 <span className="hb-long">{t('Parrainez un artisan : 1 mois offert pour lui, 15 jours pour vous')} ·</span><span className="hb-short">{t('1 mois offert')}</span> <u>{t('Parrainer')}</u></button>;
}
