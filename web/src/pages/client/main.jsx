import { useState, useMemo } from 'react';
import { LuChevronRight, LuMapPin, LuVideo, LuPhone, LuMessageSquare, LuShieldCheck, LuCheck, LuPlus, LuCalendarPlus, LuSend, LuImage, LuStar, LuSearch, LuMessageSquarePlus } from 'react-icons/lu';
import { api, uid } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate, Link, useLocation } from '../../lib/router.jsx';
import { t, locale } from '../../lib/i18n.js';
import { dateLong, dateShort, hm, rel, iso, addDays, fullName, initials, date, dateTime, time } from '../../lib/format.js';
import { TRADES, ALL_TRADES, clientApptStatus, APPT_TYPES } from '../../lib/docs.js';
import { icsFile } from '../../lib/ics.js';
import { TopBar, SearchBar, Sec, Sheet, Chips, Field, Seg, useData, Loader, Empty, Avatar, Pill, Stars, KV, Img, pickFiles, Modal, StatusPill, Lightbox } from '../../ui/index.jsx';
import { Chat, uploadTo } from '../common/chat.jsx';
import { planSettings, freeWindows, MoveSheet } from '../pro/planning.jsx';

// Mes fiches client chez les artisans + leurs entreprises
export async function loadMine() {
  const clients = await api.select('clients', { user_id: uid() });
  const ids = [...new Set(clients.map((c) => c.company_id))];
  const cos = ids.length ? await api.select('companies', { id: ids }) : [];
  return { clients, cids: clients.map((c) => c.id), cm: Object.fromEntries(cos.map((c) => [c.id, c])) };
}
export const coName = (co) => co?.trade_name || co?.name || t('Artisan');

function RdvCard({ a, co, dark }) {
  const st = clientApptStatus(a);
  return (
    <Link to={'/client/rdv/' + a.id} className={'rdvcard' + (dark ? ' dark' : '')}>
      <div className="top"><span style={{ textTransform: 'capitalize' }}>{dateShort(a.start_at)}</span><span>{time(a.start_at)}</span></div>
      <div className="tt">{a.title}</div>
      <div className="small" style={{ opacity: .85 }}>{coName(co)} · {(co?.trades || [])[0] ? t(co.trades[0]) : ''}</div>
      <div className="row small"><StatusPill s={st} />{a.mode === 'visio' ? <span><LuVideo /> {t('Visio')}</span> : <span><LuMapPin /> {t('Sur site')}</span>}</div>
    </Link>
  );
}

export function Home() {
  const { profile } = useApp();
  const [q, setQ] = useState('');
  const [b] = useData(async () => {
    const mine = await loadMine();
    const [appts, convs, notifs] = await Promise.all([
      mine.cids.length ? api.select('appointments', { client_id: mine.cids, 'end_at>=': new Date().toISOString(), status: ['a_valider', 'valide'] }, { order: 'start_at.asc', limit: 10 }) : [],
      api.select('conversations', {}, { order: 'last_at.desc', limit: 10 }), api.select('notifications', { user_id: uid() }, { order: 'created_at.desc', limit: 10 }),
    ]);
    return { ...mine, appts, convs: convs.filter((c) => c.last_message), notifs };
  }, []);
  const go = () => navigate('/client/artisans' + (q ? '?q=' + encodeURIComponent(q) : ''));
  return (
    <div className="content">
      <TopBar back={false} home />
      <h1 className="hide-mob" style={{ fontSize: 28, marginBottom: 6 }}>{t('Bonjour {n}', { n: profile.first_name })}</h1>
      <SearchBar placeholder={t('Rechercher un artisan')} value={q} onChange={setQ} onSubmit={go} onFilter={go} />
      {!b ? <Loader /> : (
        <>
          <Sec title={t('Mes RDV')} to="/client/rdv" meta={t('{n} à venir', { n: b.appts.length })} />
          {b.appts.length ? <div className="carousel">{b.appts.map((a, i) => <RdvCard key={a.id} a={a} co={b.cm[a.company_id]} dark={i === 0} />)}</div>
            : <Empty icon={LuCalendarPlus} text={t('Aucun rendez-vous à venir.')}><button className="btn sm" onClick={() => navigate('/client/artisans')}>{t('Trouver un artisan')}</button></Empty>}
          <Sec title={t('Mes messages')} to="/client/messages" />
          {b.convs.length ? <div className="carousel">{b.convs.map((c) => { const co = b.cm[c.company_id]; return (
            <Link key={c.id} to={'/client/messages/' + c.id} className="rdvcard"><div className="row"><Avatar name={coName(co).split(' ')[0]} last={coName(co).split(' ')[1]} path={co?.logo_path} size="sm" /><div><b>{coName(co)}</b><div className="small muted">{(co?.trades || [])[0] ? t(co.trades[0]) : ''}</div></div></div><div className="small" style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{c.last_message}</div><div className="small faint">{rel(c.last_at)}</div></Link>
          ); })}</div> : <Empty text={t('Pas encore de message.')} />}
          <Sec title={t('Mes notifications')} to="/client/notifications" />
          {b.notifs.length ? <div className="carousel">{b.notifs.map((n) => (
            <Link key={n.id} to={n.link || '/client/notifications'} className="rdvcard"><div className="row between"><Pill c="navy">{t({ rdv: 'RDV', documents: 'Documents', paiement: 'Paiement', message: 'Message', systeme: 'Info' }[n.category])}</Pill>{!n.read && <span style={{ width: 10, height: 10, borderRadius: 5, background: 'var(--bordeaux)' }} />}</div><b>{t(n.title)}</b><div className="small">{n.body}</div><div className="small red-t bold">{rel(n.created_at)}</div></Link>
          ))}</div> : <Empty text={t('Aucune notification.')} />}
        </>
      )}
    </div>
  );
}

// ─────────────── Recherche d'artisans ───────────────
export function Search() {
  const { query } = useLocation();
  const [q, setQ] = useState(query.get('q') || '');
  const [term, setTerm] = useState(q);
  const [trade, setTrade] = useState('');
  const [city, setCity] = useState('');
  const [visio, setVisio] = useState(false);
  const [good, setGood] = useState(false);
  const [open, setOpen] = useState(false);
  const [res] = useData(() => api.rpc('directory_search', { p_query: term, p_trade: trade, p_city: city }), [term, trade, city]);
  const list = (res || []).filter((r) => (!visio || r.visio) && (!good || (r.rating || 0) >= 4)).sort((a, b) => b.is_mine - a.is_mine);
  return (
    <div className="content">
      <TopBar title={t('Rechercher un artisan')} />
      <SearchBar placeholder={t('Métier, nom, besoin…')} value={q} onChange={(v) => { setQ(v); if (v.length === 0 || v.length > 2) setTerm(v); }} onSubmit={() => setTerm(q)} onFilter={() => setOpen(true)} filterActive={!!(trade || city)} />
      <div className="chips scroll">
        <button className={'chip' + (trade ? ' on' : '')} onClick={() => setOpen(true)}>{trade ? t(trade) : t('Métier')}</button>
        <button className={'chip' + (city ? ' on' : '')} onClick={() => setOpen(true)}>{city || t('Ville et rayon')}</button>
        <button className={'chip' + (visio ? ' on' : '')} onClick={() => setVisio(!visio)}><LuVideo /> {t('Visio')}</button>
        <button className={'chip' + (good ? ' on' : '')} onClick={() => setGood(!good)}>★ 4+ {t('avis')}</button>
      </div>
      {!res ? <Loader /> : !list.length ? <Empty icon={LuSearch} text={t('Aucun artisan trouvé. Essayez un autre métier ou une autre ville.')} /> : (
        <div className="grid2">{list.map((a) => (
          <button key={a.id} className="card row" style={{ textAlign: 'left', background: 'var(--surface)', color: 'inherit', borderColor: a.is_mine ? 'var(--bordeaux)' : 'var(--line)', borderWidth: a.is_mine ? 2 : 1 }} onClick={() => navigate('/client/artisans/' + a.id)}>
            <Avatar name={coName(a).split(' ')[0]} last={coName(a).split(' ')[1]} path={a.logo_path} size="lg" />
            <div className="grow">
              <div className="bold" style={{ fontSize: 17 }}>{coName(a)}</div>
              <div className="small muted">{(a.trades || []).slice(0, 2).map(t).join(' · ')} · {a.city}</div>
              <div className="row small wrap" style={{ marginTop: 4, gap: 6 }}>{a.rating ? <span><Stars n={a.rating} /> {String(a.rating).replace('.', ',')} ({a.reviews_count})</span> : <span className="faint">{t('Nouveau')}</span>}
                {a.verified && <Pill c="green"><LuShieldCheck /> {t('Vérifié')}</Pill>}{a.is_mine && <Pill c="red">{t('Votre artisan')}</Pill>}{a.visio && <Pill c="grey"><LuVideo /> {t('Visio')}</Pill>}</div>
            </div><LuChevronRight />
          </button>
        ))}</div>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={t('Filtres')}>
        <Field label={t('Ville ou zone')}><input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t('ex. Nice, Antibes…')} /></Field>
        <div className="small bold mb">{t('Métier')}</div>
        {Object.entries(TRADES).map(([g, ls]) => <div key={g}><div className="small red-t bold">{t(g).toUpperCase()}</div><Chips options={ls.map((x) => [x, t(x)])} value={trade} onChange={(v) => setTrade(v === trade ? '' : v)} /></div>)}
        <div className="btns"><div className="two"><button className="btn ghost" onClick={() => { setTrade(''); setCity(''); }}>{t('Réinitialiser')}</button><button className="btn" onClick={() => setOpen(false)}>{t('Afficher {n} artisans', { n: list.length })}</button></div></div>
      </Sheet>
    </div>
  );
}

export function ArtisanCard({ params }) {
  const [big, setBig] = useState(null);
  const [p] = useData(() => api.rpc('directory_get', { p_id: params.id }), [params.id]);
  if (!p) return <div className="content"><TopBar title={t('Artisan')} /><Loader /></div>;
  const total = Object.values(p.distribution || {}).reduce((s, n) => s + n, 0);
  const msg = async () => { const id = await api.rpc('start_conversation', { p_company: p.id }); navigate('/client/messages/' + id); };
  return (
    <div className="content narrow">
      <TopBar title={coName(p)} sub={(p.trades || [])[0] ? t(p.trades[0]) : ''} />
      <div className="hero row" style={{ gap: 16 }}>
        <Avatar name={coName(p).split(' ')[0]} last={coName(p).split(' ')[1]} path={p.logo_path} size="lg" />
        <div><h2>{coName(p)}</h2><div className="l2">{p.name} · {p.city}</div><div className="row wrap mt" style={{ gap: 6 }}>{p.verified && <Pill c="green"><LuShieldCheck /> {t('Vérifié')}</Pill>}{p.rating && <Pill c="white">★ {String(p.rating).replace('.', ',')} · {t('{n} avis', { n: total })}</Pill>}</div></div>
      </div>
      <Sec title={t('Présentation')} />
      {p.description && <p className="wsb">{p.description}</p>}
      <KV rows={[[t('Métier'), (p.trades || []).map(t).join(', ')], [t("Zone d'intervention"), p.zone || p.city], [t('Téléphone'), p.phone, { href: p.phone && 'tel:' + p.phone }], [t('Visio possible'), p.planning?.visio !== false ? t('Oui, sur WhatsApp') : t('Non')], p.certifications && [t('Certifications'), p.certifications]]} />
      <div className="btns">
        <button className="btn" onClick={() => navigate(`/client/artisans/${p.id}/demande`)}>{t('Demander un RDV')}</button>
        <div className="two">{p.phone ? <a className="btn ghost" href={'tel:' + p.phone}><LuPhone /> {t('Appeler')}</a> : <span />}<button className="btn ghost" onClick={msg}><LuMessageSquare /> {t('Envoyer un message')}</button></div>
      </div>
      {p.photos?.length > 0 && <><Sec title={t('Réalisations')} /><div className="photos-grid">{p.photos.map((x) => <Img key={x} path={x} onClick={() => setBig(x)} />)}</div></>}
      <Sec title={t('Avis vérifiés')} meta={total ? t('{n} avis', { n: total }) : ''} />
      {!total ? <Empty icon={LuStar} text={t('Pas encore d’avis.')} /> : p.reviews.map((r, i) => (
        <div key={i} className="card soft mb"><div className="row between"><Stars n={r.rating} /><span className="small faint">{date(r.created_at)}</span></div><p style={{ margin: '6px 0' }}>{r.comment}</p><div className="small bold red-t">{r.author}</div>{r.reply && <div className="notice small"><b>{t('Réponse de l’artisan')} :</b> {r.reply}</div>}</div>
      ))}
      <Lightbox path={big} onClose={() => setBig(null)} />
    </div>
  );
}

// ─────────────── Nouvelle demande ───────────────
export function NewRequest({ params }) {
  const { profile, setProfile, run } = useApp();
  const [type, setType] = useState('Dépannage');
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState([]);
  const [mode, setMode] = useState('site');
  const [day, setDay] = useState(null);
  const [slot, setSlot] = useState(null);
  const [home, setHome] = useState({ address: '', zip: '', city: '', ...(profile.home || {}) });
  const [busy, setBusy] = useState(false);
  const from = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [b] = useData(async () => {
    const [p, busySlots] = await Promise.all([api.rpc('directory_get', { p_id: params.id }), api.rpc('busy_slots', { p_company: params.id, p_from: from.toISOString(), p_to: addDays(from, 21).toISOString() })]);
    return { p, busySlots };
  }, [params.id]);
  if (!b) return <div className="content"><TopBar title={t('Nouvelle demande')} /><Loader /></div>;
  const s = planSettings({ settings: { planning: b.p.planning || {} } });
  const days = Array.from({ length: 21 }, (_, i) => addDays(from, i)).filter((d) => s.days.includes(d.getDay()) && freeWindows(d, b.busySlots, s, 30).length);
  const curDay = day || days[0];
  const slots = [];
  if (curDay) {
    const st = new Date(curDay); st.setHours(s.slot[0], 0, 0, 0);
    const en = new Date(curDay); en.setHours(s.slot[1], 0, 0, 0);
    const free = freeWindows(curDay, b.busySlots, s, 30);
    for (let x = new Date(st); x < en; x = new Date(+x + 18e5)) {
      const ok = free.some(([a, z]) => x >= a && +x + 18e5 <= +z);
      slots.push([new Date(x), ok]);
    }
  }
  const addPhotos = async () => { const fs = await pickFiles({ accept: 'image/*,video/*' }); setPhotos([...photos, ...fs].slice(0, 8)); };
  const send = async () => {
    if (!slot) return run(async () => { throw new Error(t('Choisissez un créneau.')); });
    if (mode === 'site' && (!home.address || !home.city)) return run(async () => { throw new Error(t('Indiquez votre adresse pour une intervention sur place.')); });
    setBusy(true);
    try {
      await run(async () => {
        if (JSON.stringify(home) !== JSON.stringify(profile.home || {})) { await api.update('profiles', { id: profile.id }, { home }); setProfile({ ...profile, home }); }
        const ups = [];
        for (const f of photos) ups.push(await uploadTo('u/' + profile.id + '/demandes', f));
        const dur = mode === 'visio' ? 30 : Math.max(60, s.duration || 60);
        const id = await api.rpc('request_appointment', { p: { company_id: params.id, type, title: type + (text ? ' · ' + text.split(/[.\n]/)[0].slice(0, 50) : ''), text, mode, start_at: slot.toISOString(), end_at: new Date(+slot + dur * 6e4).toISOString(), photos: ups } });
        navigate('/client/demande-envoyee/' + id, { replace: true });
      });
    } finally { setBusy(false); }
  };
  return (
    <div className="content narrow">
      <TopBar title={t('Nouvelle demande')} sub={coName(b.p)} />
      <Chips options={['Dépannage', 'Devis', 'Entretien', 'Chantier'].map((x) => [x, t(x)])} value={type} onChange={setType} />
      <Sec title={t('Votre besoin')} />
      <textarea className="input" style={{ minHeight: 130, borderColor: 'var(--bordeaux)' }} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Décrivez le problème : depuis quand, où, ce que vous avez déjà fait…')} />
      <Sec title={t('Photos ou vidéo')} meta={t('{n} photos', { n: photos.length })} />
      <div className="photos-grid">
        {photos.map((f, i) => <img key={i} src={URL.createObjectURL(f)} alt="" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} title={t('Retirer')} />)}
        <button className="ph" style={{ border: '2px dashed var(--bordeaux)', color: 'var(--bordeaux)', fontSize: 28 }} onClick={addPhotos} aria-label={t('Ajouter des photos')}><LuPlus /></button>
      </div>
      <Sec title={t('Type de rendez-vous')} />
      <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr', display: 'grid' }}>
        <button className={'opt' + (mode === 'site' ? ' red' : '')} style={{ marginTop: 0 }} onClick={() => setMode('site')}><LuMapPin /><div><b>{t('Sur place')}</b><small>{t('À votre domicile')}</small></div></button>
        {b.p.planning?.visio !== false && <button className={'opt' + (mode === 'visio' ? ' red' : '')} style={{ marginTop: 0 }} onClick={() => setMode('visio')}><LuVideo /><div><b>{t('En visio')}</b><small>{t('Diagnostic à distance')}</small></div></button>}
      </div>
      {mode === 'site' && <div className="form-grid three mt"><Field label={t('Adresse')}><input value={home.address} onChange={(e) => setHome({ ...home, address: e.target.value })} /></Field><Field label={t('Code postal')}><input value={home.zip} onChange={(e) => setHome({ ...home, zip: e.target.value })} /></Field><Field label={t('Ville')}><input value={home.city} onChange={(e) => setHome({ ...home, city: e.target.value })} /></Field></div>}
      <Sec title={t('Créneau souhaité')} meta={t('Créneaux libres · 30 min')} />
      {!days.length ? <Empty text={t('Aucun créneau libre dans les 3 prochaines semaines : écrivez-lui directement.')} /> : (
        <>
          <div className="chips scroll">{days.map((d) => <button key={d} className={'chip' + (iso(d) === iso(curDay) ? ' on' : '')} onClick={() => { setDay(d); setSlot(null); }}>{d.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' })}</button>)}</div>
          <div className="slots">{slots.map(([x, ok]) => <button key={+x} className={'slot' + (slot && +slot === +x ? ' on' : '')} disabled={!ok} onClick={() => setSlot(x)}>{hm(x)}</button>)}</div>
        </>
      )}
      <div className="btns"><button className="btn" onClick={send} disabled={busy}>{busy ? '…' : t('Envoyer la demande')}</button></div>
    </div>
  );
}

export function RequestSent({ params }) {
  const [b] = useData(async () => { const a = await api.one('appointments', { id: params.id }); const co = a ? await api.one('companies', { id: a.company_id }) : null; return { a, co }; }, [params.id]);
  if (!b?.a) return <div className="content"><TopBar title={t('Demande envoyée')} /><Loader /></div>;
  const { a, co } = b;
  return (
    <div className="content narrow">
      <TopBar title={t('Demande envoyée')} sub={coName(co)} />
      <div className="center"><div className="big-ico" style={{ width: 86, height: 86, borderRadius: '50%', background: 'var(--bordeaux-100)', display: 'grid', placeItems: 'center', margin: '0 auto' }}><span style={{ width: 62, height: 62, borderRadius: '50%', background: 'var(--navy)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 30 }}><LuCheck /></span></div>
        <h2 className="mt" style={{ fontSize: 24 }}>{t('Votre demande est envoyée')}</h2><p className="muted">{t('{n} a reçu votre demande et vos photos. Il répond en général en moins de 2 h.', { n: coName(co) })}</p></div>
      <Sec title={t('Récapitulatif')} />
      <KV rows={[[t('Besoin'), a.title], [t('Photos'), t('{n} photos', { n: (a.photos || []).length })], [t('Rendez-vous souhaité'), `${a.mode === 'visio' ? t('Visio') : t('Sur place')} · ${dateShort(a.start_at)} · ${time(a.start_at)}`], [t('Statut'), <Pill c="navy-o">{t('En attente de confirmation')}</Pill>]]} />
      <Sec title={t('Et ensuite ?')} />
      <div className="steps">
        {[[t('{n} confirme le créneau', { n: coName(co) }), t('Vous recevez une notification.')], a.mode === 'visio' ? [t('Vous recevez le lien de la visio'), t('Dans vos messages et dans le détail du RDV.')] : [t('Il vous prévient quand il est en route'), t('Avec son heure d’arrivée.')], [t('Un rappel avant'), t('Pour ne pas oublier le rendez-vous.')]].map(([x, y], i) => <div key={i} className="step cur"><span className="b">{i + 1}</span><div><b>{x}</b><div className="small muted">{y}</div></div></div>)}
      </div>
      <div className="btns"><button className="btn" onClick={() => navigate('/client/rdv', { replace: true })}>{t('Voir mes RDV')}</button></div>
    </div>
  );
}

// ─────────────── Mes RDV ───────────────
export function Appointments() {
  const { query } = useLocation();
  const [tab, setTab] = useState(query.get('tab') || 'next');
  const [q, setQ] = useState('');
  const [b] = useData(async () => { const m = await loadMine(); const appts = m.cids.length ? await api.select('appointments', { client_id: m.cids }, { order: 'start_at.asc' }) : []; return { ...m, appts }; }, []);
  if (!b) return <div className="content"><TopBar title={t('Mes RDV')} /><Loader /></div>;
  const now = new Date().toISOString();
  const list = b.appts.filter((a) => (tab === 'next' ? a.end_at >= now && ['a_valider', 'valide'].includes(a.status) : !(a.end_at >= now && ['a_valider', 'valide'].includes(a.status))))
    .filter((a) => !q || (a.title + ' ' + coName(b.cm[a.company_id])).toLowerCase().includes(q.toLowerCase()));
  if (tab === 'past') list.reverse();
  return (
    <div className="content">
      <TopBar back={false} title={t('Mes RDV')} />
      <SearchBar placeholder={t('Rechercher un pro')} value={q} onChange={setQ} />
      {!list.length ? <Empty icon={LuCalendarPlus} text={tab === 'next' ? t('Aucun rendez-vous à venir.') : t('Aucun rendez-vous passé.')}>{tab === 'next' && <button className="btn sm" onClick={() => navigate('/client/artisans')}>{t('Trouver un artisan')}</button>}</Empty> : (
        <div className="grid2">{list.map((a) => { const co = b.cm[a.company_id]; return (
          <Link key={a.id} to={'/client/rdv/' + a.id} className="rdvcard">
            <div className="top"><span style={{ textTransform: 'capitalize' }}>{dateLong(a.start_at)}</span><span>{a.status === 'a_valider' && !a.validated_at ? hm(a.start_at) : hm(a.start_at)}</span></div>
            <div className="row"><Avatar name={coName(co).split(' ')[0]} last={coName(co).split(' ')[1]} path={co?.logo_path} /><div><b style={{ fontSize: 17 }}>{coName(co)}</b><div className="small muted">{(co?.trades || [])[0] ? t(co.trades[0]) : ''} · {a.mode === 'visio' ? t('en visio') : t('chez vous')}</div></div></div>
            <div className="row between"><b>{a.title}</b><StatusPill s={clientApptStatus(a)} /></div>
          </Link>
        ); })}</div>
      )}
      <div className="btns" style={{ gridTemplateColumns: '1fr 1fr', display: 'grid', position: 'sticky', bottom: 80 }}>
        <button className={'btn' + (tab === 'next' ? '' : ' ghost-red')} onClick={() => setTab('next')}>{t('À venir')}</button>
        <button className={'btn' + (tab === 'past' ? '' : ' ghost-red')} onClick={() => setTab('past')}>{t('Passés')}</button>
      </div>
    </div>
  );
}

export function ApptDetail({ params }) {
  const { query } = useLocation();
  const { run, confirm } = useApp();
  const [move, setMove] = useState(false);
  const [big, setBig] = useState(null);
  const [b, reload] = useData(async () => { const a = await api.one('appointments', { id: params.id }); if (!a) return { a: null }; const co = await api.one('companies', { id: a.company_id }); return { a, co }; }, [params.id]);
  const [enroute, setEnroute] = useState(query.get('enroute') === '1');
  if (!b) return <div className="content"><TopBar title={t('Rendez-vous')} /><Loader /></div>;
  const { a, co } = b;
  if (!a) return <div className="content"><TopBar title={t('Rendez-vous')} /><Empty text={t('Rendez-vous introuvable')} /></div>;
  const active = ['a_valider', 'valide'].includes(a.status) && a.end_at >= new Date().toISOString();
  const past = a.start_at < new Date().toISOString() && ['valide', 'termine'].includes(a.status);
  const wa = co?.phone ? 'https://wa.me/' + co.phone.replace(/\D/g, '').replace(/^0/, '33') : null;
  const isEnroute = a.enroute_at && a.eta_at && new Date(a.eta_at) > new Date(Date.now() - 36e5);
  const cancel = async () => { if (await confirm({ title: t('Annuler ce rendez-vous ?'), text: t('L’artisan sera prévenu.'), ok: t('Annuler le RDV'), danger: true })) { await run(() => api.rpc('client_appointment_action', { p_id: a.id, p_action: 'cancel', p: {} }), t('Rendez-vous annulé')); reload(); } };
  return (
    <div className="content narrow">
      <TopBar title={t('Rendez-vous')} sub={coName(co)} />
      <div className="hero">
        <span className="tag pill" style={{ border: '1.5px solid #fff', color: '#fff' }}>{a.mode === 'visio' ? <><LuVideo /> {t('Visio')}</> : <><LuMapPin /> {t('Sur site')}</>}</span>
        <h2 style={{ paddingRight: 90 }}>{a.title}</h2>
        <div className="l2">{coName(co)}</div>
        <div className="row"><b style={{ textTransform: 'capitalize' }}>{dateShort(a.start_at)} · {time(a.start_at)} – {time(a.end_at)}</b><StatusPill s={clientApptStatus(a)} /></div>
      </div>
      {isEnroute && <div className="alert mt"><LuSend className="red-t" /><div><b>{t('{n} est en route', { n: coName(co) })}</b><div className="small">{t('Arrivée prévue vers {h}', { h: hm(a.eta_at) })}</div></div></div>}
      <Sec title={t('Détails')} />
      <KV rows={[[t('Type'), t(a.type)], [t('Artisan'), <Link to={'/client/artisans/' + a.company_id}>{coName(co)}</Link>], a.mode === 'site' && [t('Adresse'), a.address], [t('Demandé le'), dateTime(a.created_at)], a.validated_at && [t('Confirmé le'), dateTime(a.validated_at)]]} />
      {(a.request_text || a.photos?.length > 0) && (
        <div className="card mt"><div className="row between"><b>{t('Votre demande')}</b>{a.photos?.length > 0 && <span className="small red-t bold">{t('{n} photos', { n: a.photos.length })}</span>}</div><p className="small wsb">{a.request_text}</p>{a.photos?.length > 0 && <div className="photos-grid">{a.photos.map((p) => <Img key={p.path} path={p.path} onClick={() => setBig(p.path)} />)}</div>}</div>
      )}
      <div className="btns">
        {active && a.mode === 'visio' && a.status === 'valide' && wa && <a className="btn" href={wa} target="_blank" rel="noreferrer"><LuVideo /> {t('Rejoindre la visio sur WhatsApp')}</a>}
        {active && <div className="two"><button className="btn ghost sm" onClick={() => icsFile([{ id: a.id, start: a.start_at, end: a.end_at, title: a.title + ' · ' + coName(co), location: a.address }])}>{t('Ajouter à mon agenda')}</button><button className="btn ghost sm" onClick={() => setMove(true)}>{t('Déplacer')}</button></div>}
        {active && <button className="btn light sm" onClick={cancel}>{t('Annuler le rendez-vous')}</button>}
        {past && <button className="btn ghost" onClick={() => navigate('/client/avis/' + a.company_id)}><LuStar /> {t('Donner mon avis')}</button>}
        <button className="btn ghost sm" onClick={async () => { const id = await api.rpc('start_conversation', { p_company: a.company_id }); navigate('/client/messages/' + id); }}>{t('Écrire à {n}', { n: coName(co) })}</button>
      </div>
      <Modal open={enroute && isEnroute} onClose={() => setEnroute(false)}>
        <div className="big-ico"><LuSend /></div>
        <h3>{t('{n} est en route', { n: coName(co) })}</h3>
        <p className="muted">{t('Arrivée prévue vers {h} pour : {o}.', { h: hm(a.eta_at), o: a.title })}</p>
        <div className="btns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>{co?.phone ? <a className="btn ghost" href={'tel:' + co.phone}><LuPhone /> {t('Appeler')}</a> : <span />}<button className="btn" onClick={() => setEnroute(false)}>OK</button></div>
      </Modal>
      <MoveSheet open={move} a={a} onClose={() => setMove(false)} onDone={async (s, e) => { await run(() => api.rpc('client_appointment_action', { p_id: a.id, p_action: 'move', p: { start_at: s.toISOString(), end_at: e.toISOString() } }), t('Nouveau créneau proposé à l’artisan')); setMove(false); reload(); }} />
      <Lightbox path={big} onClose={() => setBig(null)} />
    </div>
  );
}

// ─────────────── Messages ───────────────
export function Messages() {
  const { unread } = useApp();
  const [q, setQ] = useState('');
  const [nw, setNw] = useState(false);
  const [b] = useData(async () => { const m = await loadMine(); const convs = await api.select('conversations', {}, { order: 'last_at.desc' }); return { ...m, convs }; }, []);
  if (!b) return <div className="content"><TopBar title={t('Messages')} /><Loader /></div>;
  const reads = unread.reads || {};
  const list = b.convs.filter((c) => c.last_message && (!q || (coName(b.cm[c.company_id]) + ' ' + c.last_message).toLowerCase().includes(q.toLowerCase())));
  const n = list.filter((c) => !reads[c.id] || reads[c.id] < c.last_at).length;
  return (
    <div className="content">
      <TopBar back={false} title={t('Messages')} />
      <SearchBar placeholder={t('Rechercher un pro')} value={q} onChange={setQ} />
      <Sec title={t('Conversations')} meta={t('{n} non lue', { n })} />
      {!list.length ? <Empty icon={LuMessageSquare} text={t('Aucune conversation.')} /> : (
        <div className="list">{list.map((c) => { const co = b.cm[c.company_id]; const un = !reads[c.id] || reads[c.id] < c.last_at; return (
          <button key={c.id} className="li click" onClick={() => navigate('/client/messages/' + c.id)}>
            <Avatar name={coName(co).split(' ')[0]} last={coName(co).split(' ')[1]} path={co?.logo_path} />
            <div className="grow"><div className="t1">{coName(co)} {(co?.trades || [])[0] && <Pill c="grey">{t(co.trades[0])}</Pill>}</div><div className="t2" style={un ? { fontWeight: 700, color: 'var(--text)' } : undefined}>{c.last_message}</div></div>
            <div className="side-r"><span className={un ? 'red-t bold' : ''}>{rel(c.last_at)}</span>{un && <span className="badge-n">1</span>}</div>
          </button>
        ); })}</div>
      )}
      <button className="fab" onClick={() => setNw(true)} aria-label={t('Nouvelle conversation')}><LuMessageSquarePlus /></button>
      <Sheet open={nw} onClose={() => setNw(false)} title={t('À qui voulez-vous écrire ?')}>
        <div className="list">{Object.values(b.cm).map((co) => <button key={co.id} className="li click" onClick={async () => { const id = await api.rpc('start_conversation', { p_company: co.id }); navigate('/client/messages/' + id); }}><Avatar name={coName(co).split(' ')[0]} last={coName(co).split(' ')[1]} path={co.logo_path} size="sm" /><div className="grow"><div className="t1">{coName(co)}</div><div className="t2">{(co.trades || [])[0] ? t(co.trades[0]) : ''}</div></div><LuChevronRight /></button>)}</div>
        {!Object.keys(b.cm).length && <p className="muted">{t('Vous n’avez pas encore d’artisan.')}</p>}
        <button className="btn ghost block mt" onClick={() => navigate('/client/artisans')}>{t('Trouver un autre artisan')}</button>
      </Sheet>
    </div>
  );
}

export function Conversation({ params }) {
  const [b] = useData(async () => { const c = await api.one('conversations', { id: params.id }); const co = c ? await api.one('companies', { id: c.company_id }) : null; return { c, co }; }, [params.id]);
  if (!b) return <div className="content"><TopBar title={t('Messages')} /><Loader /></div>;
  if (!b.c) return <div className="content"><TopBar title={t('Messages')} /><Empty text={t('Conversation introuvable')} /></div>;
  return (
    <div className="content narrow">
      <TopBar title={<Link to={'/client/artisans/' + b.c.company_id}>{coName(b.co)}</Link>} sub={b.co?.name} />
      <Chat convId={b.c.id} />
    </div>
  );
}
