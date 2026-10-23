import { useState } from 'react';
import { LuMessageSquarePlus, LuMapPin, LuMessageSquare, LuPlus, LuPhone, LuUserPlus, LuChevronRight, LuMail, LuShieldCheck } from 'react-icons/lu';
import { api, uid } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate, Link } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { clientName, rel, date, initials } from '../../lib/format.js';
import { TRADES } from '../../lib/docs.js';
import { TopBar, SearchBar, Sec, Sheet, Chips, useData, Loader, Empty, Avatar, Pill, Stars, KV, Field } from '../../ui/index.jsx';
import { Chat, convMeta } from '../common/chat.jsx';

async function loadConvCtx(company, teams, members) {
  const [convs, clients] = await Promise.all([api.select('conversations', {}, { order: 'last_at.desc', limit: 300 }), api.select('clients', { company_id: company.id })]);
  const others = [...new Set(convs.filter((c) => c.kind === 'pro').map((c) => (c.company_id === company.id ? c.other_company_id : c.company_id)))];
  const cos = others.length ? await api.select('companies', { id: others }) : [];
  return { convs, ctx: { mine: company.id, clients: Object.fromEntries(clients.map((c) => [c.id, c])), teams: Object.fromEntries(teams.map((x) => [x.id, x])), companies: Object.fromEntries(cos.map((c) => [c.id, c])), members }, clients };
}

export function Messages() {
  const { company, teams, members, unread, profile } = useApp();
  const [q, setQ] = useState('');
  const [kinds, setKinds] = useState([]);
  const [open, setOpen] = useState(false);
  const [nw, setNw] = useState(false);
  const [b] = useData(() => loadConvCtx(company, teams, members), []);
  if (!b) return <div className="content"><TopBar title={t('Messages')} /><Loader /></div>;
  const reads = unread.reads || {};
  const list = b.convs.filter((c) => (c.kind !== 'team' || profile.member_role === 'gerant' || !profile.team_id || c.team_id === profile.team_id))
    .map((c) => ({ c, m: convMeta(c, b.ctx) }))
    .filter(({ c, m }) => (!kinds.length || kinds.includes(c.kind)) && (!q || (m.name + ' ' + c.last_message).toLowerCase().includes(q.toLowerCase())) && (c.last_message || c.kind === 'team'));
  const unreadN = list.filter(({ c }) => c.last_message && (!reads[c.id] || reads[c.id] < c.last_at)).length;
  return (
    <div className="content">
      <TopBar title={t('Messages')} back={false} />
      <SearchBar placeholder={t('Recherchez un contact')} value={q} onChange={setQ} onFilter={() => setOpen(true)} filterActive={kinds.length > 0} />
      <Sec title={t('Conversations')} meta={t('{n} non lues', { n: unreadN })} />
      {!list.length ? <Empty icon={LuMessageSquare} text={t('Aucune conversation. Écrivez à un client, à une équipe ou à un pro avec le bouton en bas.')} /> : (
        <div className="list">{list.map(({ c, m }) => {
          const un = c.last_message && (!reads[c.id] || reads[c.id] < c.last_at);
          return (
            <button key={c.id} className="li click" onClick={() => navigate('/pro/messages/' + c.id)}>
              <div className={'avatar' + (c.kind === 'client' ? ' ring' : '')} style={c.kind === 'team' ? { background: m.color } : c.kind === 'pro' ? { background: 'var(--ardoise)' } : undefined}>{initials(...(m.initials || '').split(' '))}</div>
              <div className="grow"><div className="t1">{m.name} <Pill c={c.kind === 'client' ? 'red-o' : c.kind === 'team' ? 'navy' : 'grey'}>{m.tag}</Pill></div><div className="t2" style={un ? { fontWeight: 700, color: 'var(--text)' } : undefined}>{c.last_message || t('Aucun message')}</div></div>
              <div className="side-r"><span className={un ? 'red-t bold' : ''}>{rel(c.last_at)}</span>{un && <span className="badge-n">•</span>}</div>
            </button>
          );
        })}</div>
      )}
      <button className="fab" onClick={() => setNw(true)} aria-label={t('Nouvelle conversation')}><LuMessageSquarePlus /></button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('Filtrer')}>
        <Chips multi options={[['client', t('Clients')], ['team', t('Équipes')], ['pro', t('Artisans')]]} value={kinds} onChange={setKinds} />
        <button className="btn block" onClick={() => setOpen(false)}>{t('Afficher')}</button>
      </Sheet>
      <NewConv open={nw} onClose={() => setNw(false)} clients={b.clients} />
    </div>
  );
}

function NewConv({ open, onClose, clients }) {
  const { company, teams } = useApp();
  const [tab, setTab] = useState('client');
  const [q, setQ] = useState('');
  const [pros] = useData(async () => { if (!open) return []; const n = await api.select('network', { company_id: company.id }); return n.length ? api.select('companies', { id: n.map((x) => x.pro_id) }) : []; }, [open]);
  if (!open) return null;
  const goTeam = async (tm) => {
    let c = await api.one('conversations', { kind: 'team', company_id: company.id, team_id: tm.id });
    if (!c) c = await api.insert('conversations', { kind: 'team', company_id: company.id, team_id: tm.id });
    navigate('/pro/messages/' + c.id);
  };
  const goPro = async (co) => { const id = await api.rpc('start_conversation', { p_company: co.id }); navigate('/pro/messages/' + id); };
  return (
    <Sheet open onClose={onClose} title={t('À qui voulez-vous écrire ?')}>
      <Chips options={[['client', t('Un client')], ['team', t('Une équipe')], ['pro', t('Un pro')]]} value={tab} onChange={setTab} />
      {tab === 'client' && <><input className="input mb" placeholder={t('Rechercher')} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="list">{clients.filter((c) => !q || clientName(c).toLowerCase().includes(q.toLowerCase())).slice(0, 30).map((c) => <button key={c.id} className="li click" onClick={() => navigate(`/pro/clients/${c.id}/chat`)}><div className="grow"><div className="t1">{clientName(c)}</div><div className="t2">{c.billing_city}</div></div><LuChevronRight /></button>)}</div></>}
      {tab === 'team' && <div className="list">{teams.map((tm) => <button key={tm.id} className="li click" onClick={() => goTeam(tm)}><span className="avatar sm" style={{ background: tm.color }}>{initials(tm.name)}</span><div className="grow t1">{tm.name}</div><LuChevronRight /></button>)}</div>}
      {tab === 'pro' && (!pros?.length ? <Empty text={t('Ajoutez d’abord des pros dans Mon réseau.')}><button className="btn sm" onClick={() => navigate('/pro/reseau/ajouter')}>{t('Ajouter un pro')}</button></Empty>
        : <div className="list">{pros.map((co) => <button key={co.id} className="li click" onClick={() => goPro(co)}><span className="avatar sm" style={{ background: 'var(--ardoise)' }}>{initials(...co.name.split(' '))}</span><div className="grow"><div className="t1">{co.trade_name || co.name}</div><div className="t2">{(co.trades || [])[0]} · {co.city}</div></div><LuChevronRight /></button>)}</div>)}
    </Sheet>
  );
}

export function Conversation({ params }) {
  const { company, teams, members } = useApp();
  const [b] = useData(async () => {
    const c = await api.one('conversations', { id: params.id });
    if (!c) return null;
    const ctx = await loadConvCtx(company, teams, members);
    const projects = c.kind === 'team' ? await api.select('projects', { company_id: company.id }, { order: 'created_at.desc', limit: 50 }) : c.client_id ? await api.select('projects', { client_id: c.client_id }) : [];
    const shared = c.project_id && c.kind === 'pro' ? await api.one('projects', { id: c.project_id }) : null;
    return { c, m: convMeta(c, ctx.ctx), projects, shared };
  }, [params.id]);
  if (b === null) return <div className="content"><TopBar title={t('Messages')} /><Empty text={t('Conversation introuvable')} /></div>;
  if (!b) return <div className="content"><TopBar title={t('Messages')} /><Loader /></div>;
  const titleLink = b.c.kind === 'client' && b.c.client_id ? '/pro/clients/' + b.c.client_id : b.c.kind === 'pro' ? '/pro/reseau/' + b.m.otherId : null;
  return (
    <div className="content narrow">
      <TopBar title={titleLink ? <Link to={titleLink}>{b.m.name}</Link> : b.m.name} sub={b.m.sub} right={b.c.kind === 'client' && <Link className="iconbtn" to={'/pro/clients/' + b.c.client_id} aria-label={t('Fiche client')}><LuChevronRight /></Link>} />
      <Chat convId={b.c.id} projects={b.projects} banner={b.shared && <div className="banner"><LuMapPin className="red-t" /><div><div className="small muted">{t('Chantier partagé')}</div><b>{b.shared.title}{b.shared.address ? ' · ' + b.shared.address : ''}</b></div></div>} />
    </div>
  );
}

// ─────────────── Mon réseau ───────────────
export function Network() {
  const { company } = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [trades, setTrades] = useState([]);
  const [b] = useData(async () => {
    const n = await api.select('network', { company_id: company.id }, { order: 'created_at.desc' });
    const cos = n.length ? await api.select('companies', { id: n.map((x) => x.pro_id) }) : [];
    const shares = await api.select('project_shares', {});
    const myProjects = new Set((await api.select('projects', { company_id: company.id }, { columns: 'id' })).map((p) => p.id));
    return n.map((x) => ({ ...x, co: cos.find((c) => c.id === x.pro_id), common: shares.filter((s) => s.company_id === x.pro_id && myProjects.has(s.project_id)).length })).filter((x) => x.co);
  }, []);
  if (!b) return <div className="content"><TopBar title={t('Mon réseau')} /><Loader /></div>;
  const list = b.filter((x) => (!trades.length || (x.co.trades || []).some((tr) => trades.includes(tr))) && (!q || (x.co.name + ' ' + x.co.trade_name + ' ' + x.co.city + ' ' + (x.co.trades || []).join(' ')).toLowerCase().includes(q.toLowerCase())));
  const startChat = async (co) => { const id = await api.rpc('start_conversation', { p_company: co.id }); navigate('/pro/messages/' + id); };
  return (
    <div className="content">
      <TopBar title={t('Mon réseau')} sub={t('Mes pros')} back={false} />
      <SearchBar placeholder={t('Recherchez un pro')} value={q} onChange={setQ} onFilter={() => setOpen(true)} filterActive={trades.length > 0} />
      <div className="sec"><h2>{t('Mes contacts')} <span className="small muted" style={{ fontWeight: 400 }}>· {t('{n} pros', { n: b.length })}</span></h2><button className="plus" onClick={() => navigate('/pro/reseau/ajouter')} aria-label={t('Ajouter un pro')}><LuPlus /></button></div>
      {!list.length ? <Empty icon={LuUserPlus} text={t('Ajoutez les artisans avec qui vous travaillez pour échanger et partager des chantiers.')}><button className="btn sm" onClick={() => navigate('/pro/reseau/ajouter')}>{t('Ajouter un pro')}</button></Empty> : (
        <div className="grid2">{list.map(({ co, common, created_at }) => (
          <div key={co.id} className="card soft row" style={{ cursor: 'pointer' }} onClick={() => navigate('/pro/reseau/' + co.id)}>
            <Avatar name={co.name.split(' ')[0]} last={co.name.split(' ')[1]} path={co.logo_path} color="var(--ardoise)" />
            <div className="grow"><div className="bold row wrap" style={{ gap: 6 }}>{co.trade_name || co.name} {(co.trades || [])[0] && <Pill c="navy">{t(co.trades[0])}</Pill>}</div>
              <div className="small muted">{co.name} · {co.city}</div>
              <div className="small red-t bold">{common ? t('{n} chantiers en commun', { n: common }) : t('Contact depuis {d}', { d: new Date(created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) })}</div></div>
            <button className="round" onClick={(e) => { e.stopPropagation(); startChat(co); }} aria-label={t('Message')}><LuMessageSquare /></button>
          </div>
        ))}</div>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={t('Filtrer par métier')} right={<span className="red-t bold small">{t('{n} sélectionnés', { n: trades.length })}</span>}>
        {Object.entries(TRADES).map(([g, ls]) => <div key={g}><div className="small bold red-t mt">{t(g).toUpperCase()}</div><div className="checklist">{ls.map((x) => <label key={x} className="check"><input type="checkbox" checked={trades.includes(x)} onChange={(e) => setTrades(e.target.checked ? [...trades, x] : trades.filter((y) => y !== x))} />{t(x)}</label>)}</div></div>)}
        <div className="btns"><div className="two"><button className="btn ghost" onClick={() => setTrades([])}>{t('Réinitialiser')}</button><button className="btn" onClick={() => setOpen(false)}>{t('Afficher {n} pros', { n: list.length })}</button></div></div>
      </Sheet>
    </div>
  );
}

export function NetworkAdd() {
  const { company, run } = useApp();
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [mine, reload] = useData(async () => new Set((await api.select('network', { company_id: company.id })).map((x) => x.pro_id)), []);
  const search = async (v) => { setQ(v); if (v.trim().length < 2) return setRes(null); const r = await api.rpc('directory_search', { p_query: v.trim(), p_trade: '', p_city: '' }); setRes(r.filter((x) => x.id !== company.id)); };
  const inviteMsg = t('Bonjour, je vous invite à me rejoindre sur Artis & You pour échanger sur nos chantiers. Avec mon code {c}, vous avez 1 mois offert : {u}', { c: company.referral_code, u: location.origin + '/inscription/artisan' });
  return (
    <div className="content narrow">
      <TopBar title={t('Ajouter un pro')} sub={t('Rechercher un professionnel')} />
      <label className="input row" style={{ borderRadius: 999, borderColor: 'var(--text)', padding: '6px 18px' }}><input autoFocus value={q} onChange={(e) => search(e.target.value)} placeholder={t('Nom, entreprise ou métier')} style={{ border: 0, outline: 0, flex: 1, padding: 8, background: 'transparent' }} /></label>
      {res && <p className="muted">{t('{n} pros trouvés sur Artis & You', { n: res.length })}</p>}
      {res && <div className="list">{res.map((co) => (
        <div key={co.id} className="li">
          <span className="avatar sm" style={{ background: 'var(--petrole)' }}>{initials(...co.name.split(' '))}</span>
          <div className="grow"><div className="t1 red-t">{co.trade_name || co.name}</div><div className="t2">{(co.trades || []).slice(0, 2).map(t).join(', ')} · {co.name} · {co.city}</div></div>
          {mine?.has(co.id) ? <span className="small muted">{t('Déjà dans vos pros')}</span> : <button className="btn xs" onClick={() => run(() => api.upsert('network', { company_id: company.id, pro_id: co.id }), t('Pro ajouté à votre réseau')).then(reload)}>{t('Ajouter')}</button>}
        </div>
      ))}</div>}
      <div className="alert mt" style={{ alignItems: 'flex-start' }}>
        <div className="grow"><b>{t('Il n’est pas encore sur Artis & You ?')}</b><div className="small">{t('Invitez-le par SMS ou e-mail : 1 mois offert pour lui.')}</div></div>
        <div className="row" style={{ flexDirection: 'column', gap: 6 }}>
          <a className="btn xs ghost-red" href={`sms:?&body=${encodeURIComponent(inviteMsg)}`}>{t('SMS')}</a>
          <a className="btn xs ghost-red" href={`mailto:?subject=${encodeURIComponent(t('Rejoignez-moi sur Artis & You'))}&body=${encodeURIComponent(inviteMsg)}`}><LuMail /> {t('E-mail')}</a>
        </div>
      </div>
    </div>
  );
}

export function ProProfile({ params }) {
  const { company, run } = useApp();
  const [share, setShare] = useState(false);
  const [b, reload] = useData(async () => {
    const [p, inNet, projects] = await Promise.all([api.rpc('directory_get', { p_id: params.id }), api.one('network', { company_id: company.id, pro_id: params.id }), api.select('projects', { company_id: company.id }, { order: 'created_at.desc', limit: 50 })]);
    return { p, inNet, projects };
  }, [params.id]);
  if (!b) return <div className="content"><TopBar title={t('Profil')} /><Loader /></div>;
  const { p } = b;
  if (!p) return <div className="content"><TopBar title={t('Profil')} /><Empty text={t('Profil introuvable')} /></div>;
  const startChat = async () => { const id = await api.rpc('start_conversation', { p_company: p.id }); navigate('/pro/messages/' + id); };
  const invite = async (pr) => {
    await run(async () => {
      await api.upsert('project_shares', { project_id: pr.id, company_id: p.id });
      const convId = await api.rpc('start_conversation', { p_company: p.id });
      await api.update('conversations', { id: convId }, { project_id: pr.id });
      await api.insert('messages', { conversation_id: convId, sender_name: company.name, sender_company_id: company.id, card: { type: 'cal', title: t('Chantier partagé') + ' · ' + pr.title, sub: pr.address }, body: '' });
      setShare(false); navigate('/pro/messages/' + convId);
    }, t('Chantier partagé'));
  };
  const total = Object.values(p.distribution || {}).reduce((s, n) => s + n, 0);
  return (
    <div className="content narrow">
      <TopBar title={t('Profil')} sub={t('Mon réseau')} />
      <div className="hero row" style={{ gap: 16 }}>
        <Avatar name={p.name.split(' ')[0]} last={p.name.split(' ')[1]} path={p.logo_path} size="lg" color="var(--ardoise)" />
        <div><h2>{p.trade_name || p.name}</h2><div className="l2">{p.name} · {p.city}</div>
          <div className="row wrap mt" style={{ gap: 6 }}>{(p.trades || []).slice(0, 3).map((x) => <Pill key={x} c="white">{t(x)}</Pill>)}{p.verified && <Pill c="green"><LuShieldCheck /> {t('Profil vérifié')}</Pill>}</div></div>
      </div>
      <Sec title={t('Note client')} />
      <div className="card soft row" style={{ gap: 24 }}>
        <div className="center"><div style={{ fontSize: 40, fontWeight: 800 }}>{p.rating ? String(p.rating).replace('.', ',') : '—'}</div><Stars n={p.rating || 0} /><div className="small muted">{t('{n} avis', { n: total })}</div></div>
        <div className="grow">{[5, 4, 3, 2, 1].map((s) => <div key={s} className="row small" style={{ gap: 8 }}><span>{s}</span><div className="progress grow"><i style={{ width: total ? (p.distribution[s] / total) * 100 + '%' : 0, background: 'var(--bordeaux)' }} /></div><span>{p.distribution?.[s] || 0}</span></div>)}</div>
      </div>
      {p.reviews?.[0] && <div className="card soft mt" style={{ background: 'var(--bordeaux-50)' }}>« {p.reviews[0].comment} »<div className="small red-t bold mt">{p.reviews[0].author} · {date(p.reviews[0].created_at)}</div></div>}
      <Sec title={t('Détails')} />
      <KV rows={[['SIREN', p.siren], [t("Zone d'intervention"), p.zone || p.city], [t('Certification'), p.certifications], [t('Téléphone'), p.phone, { href: p.phone && 'tel:' + p.phone }]]} />
      {p.description && <p className="wsb">{p.description}</p>}
      <div className="btns">
        {!b.inNet && <button className="btn ghost" onClick={() => run(() => api.upsert('network', { company_id: company.id, pro_id: p.id }), t('Pro ajouté à votre réseau')).then(reload)}><LuUserPlus /> {t('Ajouter à mon réseau')}</button>}
        <button className="btn" onClick={startChat}>{t('Envoyer un message')}</button>
        <div className="two">{p.phone ? <a className="btn ghost" href={'tel:' + p.phone}><LuPhone /> {t('Appeler')}</a> : <span />}<button className="btn ghost" onClick={() => setShare(true)}>{t('Inviter sur un chantier')}</button></div>
      </div>
      <Sheet open={share} onClose={() => setShare(false)} title={t('Inviter sur un chantier')}>
        <p className="small muted">{t('Le pro verra le nom et l’adresse du chantier, et pourra échanger avec vous. Il ne voit ni vos prix ni l’historique du client.')}</p>
        <div className="list">{b.projects.map((pr) => <button key={pr.id} className="li click" onClick={() => invite(pr)}><div className="grow"><div className="t1">{pr.title}</div><div className="t2">{pr.address}</div></div><LuChevronRight /></button>)}</div>
        {!b.projects.length && <Empty text={t('Aucun chantier.')} />}
      </Sheet>
    </div>
  );
}
