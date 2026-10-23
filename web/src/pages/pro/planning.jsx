import { useMemo, useState } from 'react';
import { LuChevronLeft, LuChevronRight, LuSettings, LuPlus, LuVideo, LuMapPin, LuSend, LuImage, LuCalendarPlus, LuNavigation, LuCheck } from 'react-icons/lu';
import { api } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate, useLocation, Link } from '../../lib/router.jsx';
import { t, locale } from '../../lib/i18n.js';
import { clientName, dateShort, dateTime, hm, startOfWeek, addDays, weekNumber, iso, fullName, date } from '../../lib/format.js';
import { apptStatus, APPT_TYPES, expandAppointments } from '../../lib/docs.js';
import { icsFile, rrule } from '../../lib/ics.js';
import { TopBar, SearchBar, KV, Sec, Sheet, Field, Chips, Seg, Toggle, useData, Loader, Empty, StatusPill, Img, Modal, Lightbox, Pill } from '../../ui/index.jsx';

const PALETTE = ['#00123B', '#7F1111', '#1F6F78', '#6B4E9B', '#B5651D', '#2E7D32', '#AD1457', '#455A64'];
const hashColor = (s = '') => PALETTE[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
export const planSettings = (company) => ({ view: 'week', hours: [7, 19], weekend: false, colorBy: 'team', days: [1, 2, 3, 4, 5, 6], slot: [8, 18], duration: 60, manual: true, reminder: 24, visio: true, ...(company?.settings?.planning || {}) });

// Créneaux libres d'une journée (pour l'affichage « Dispo » et la prise de RDV)
export function freeWindows(day, busy, s, minLen = 30) {
  const dow = day.getDay();
  if (!s.days.includes(dow)) return [];
  const start = new Date(day); start.setHours(s.slot[0], 0, 0, 0);
  const end = new Date(day); end.setHours(s.slot[1], 0, 0, 0);
  const now = new Date();
  let cur = start < now ? new Date(Math.ceil(now / 18e5) * 18e5) : start;
  const bs = busy.filter((b) => new Date(b.end_at) > start && new Date(b.start_at) < end).map((b) => [new Date(b.start_at), new Date(b.end_at)]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [a, b] of bs) { if (a - cur >= minLen * 6e4) out.push([new Date(cur), new Date(a)]); if (b > cur) cur = b; }
  if (end - cur >= minLen * 6e4) out.push([new Date(cur), end]);
  return out;
}

export function Planning() {
  const { company, teams, profile, can } = useApp();
  const s = planSettings(company);
  const { query } = useLocation();
  const [view, setView] = useState(query.get('vue') || s.view);
  const [anchor, setAnchor] = useState(() => query.get('d') ? new Date(query.get('d')) : new Date());
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [teamF, setTeamF] = useState(profile.member_role === 'ouvrier' && profile.team_id ? [profile.team_id] : []);
  const range = useMemo(() => {
    if (view === 'day') { const a = new Date(anchor); a.setHours(0, 0, 0, 0); return [a, addDays(a, 1)]; }
    if (view === 'month') { const a = new Date(anchor.getFullYear(), anchor.getMonth(), 1); const st = startOfWeek(a); return [st, addDays(st, 42)]; }
    const st = startOfWeek(anchor); return [st, addDays(st, 7)];
  }, [view, anchor]);
  const [data, , loading] = useData(async () => {
    const [appts, clients] = await Promise.all([
      api.select('appointments', { company_id: company.id, 'start_at<': range[1].toISOString(), status: ['a_valider', 'valide', 'termine'] }, { order: 'start_at.asc' }),
      api.select('clients', { company_id: company.id }, { columns: 'id,type,last_name,first_name,company_name,trade_name,site_city,billing_city' }),
    ]);
    return { appts, cm: Object.fromEntries(clients.map((c) => [c.id, c])) };
  }, [range[0].getTime(), view]);
  const tm = Object.fromEntries(teams.map((x) => [x.id, x]));
  const color = (a) => (a.personal ? '#8A90A0' : s.colorBy === 'client' ? hashColor(a.client_id || a.title) : tm[a.team_id]?.color || '#00123B');
  const all = data ? expandAppointments(data.appts, range[0], range[1]) : [];
  const evs = all.filter((a) => (!teamF.length || teamF.includes(a.team_id)) && (!q || [a.title, clientName(data.cm[a.client_id]), a.address].join(' ').toLowerCase().includes(q.toLowerCase())));
  const move = (n) => { const a = new Date(anchor); if (view === 'day') a.setDate(a.getDate() + n); else if (view === 'month') a.setMonth(a.getMonth() + n); else a.setDate(a.getDate() + 7 * n); setAnchor(a); };
  const label = view === 'month' ? anchor.toLocaleDateString(locale(), { month: 'long', year: 'numeric' }) : view === 'day' ? dateShort(anchor) : t('Semaine {n}', { n: weekNumber(startOfWeek(anchor)) });
  const sub = view === 'week' ? `${range[0].toLocaleDateString(locale(), { day: 'numeric', month: 'short' })} – ${addDays(range[1], -1).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' })}` : '';
  const newAt = (d) => can('planning') && navigate('/pro/planning/nouveau?start=' + encodeURIComponent(d.toISOString()));

  return (
    <div className="content" style={{ maxWidth: 1400 }}>
      <TopBar title={t('Planning')} sub={sub} back={false} />
      <SearchBar placeholder={t('Recherchez un rendez-vous')} value={q} onChange={setQ} onFilter={() => setOpen(true)} filterActive={teamF.length > 0} />
      <div className="cal-head">
        <button className="round" onClick={() => move(-1)} aria-label={t('Précédent')}><LuChevronLeft /></button>
        <b style={{ minWidth: 110, textAlign: 'center', textTransform: 'capitalize' }}>{label}</b>
        <button className="round" onClick={() => move(1)} aria-label={t('Suivant')}><LuChevronRight /></button>
        <button className="btn xs ghost" onClick={() => setAnchor(new Date())}>{t("Aujourd'hui")}</button>
        <div style={{ flex: 1 }} />
        <div className="seg" style={{ margin: 0, minWidth: 210 }}>{[['day', t('Jour')], ['week', t('Semaine')], ['month', t('Mois')]].map(([v, l]) => <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)} style={{ padding: '6px 8px', fontSize: 13 }}>{l}</button>)}</div>
        {profile.member_role !== 'ouvrier' && <Link to="/pro/planning/reglages" className="btn xs ghost"><LuSettings /> {t('Réglages')}</Link>}
      </div>
      <div className="cal-legend">
        {s.colorBy === 'team' && teams.map((x) => <span key={x.id}><i style={{ background: x.color }} />{x.name}</span>)}
        <span><i className="ev dispo" style={{ position: 'static' }} />{t('Dispo')}</span>
        <span><i style={{ border: '2px dashed var(--bordeaux)' }} />{t('À valider')}</span>
        <span><i style={{ background: 'var(--ardoise)' }} />{t('Validé')}</span>
        <span><LuVideo /> {t('Visio')}</span>
      </div>
      {loading ? <Loader /> : view === 'month' ? (
        <MonthGrid range={range} anchor={anchor} evs={evs} color={color} cm={data.cm} onDay={(d) => { setAnchor(d); setView('day'); }} />
      ) : (
        <WeekGrid days={view === 'day' ? [range[0]] : Array.from({ length: s.weekend ? 7 : 5 + (s.days.includes(6) ? 1 : 0) }, (_, i) => addDays(range[0], i))}
          s={s} evs={evs} busy={all} color={color} cm={data.cm} onNew={newAt} />
      )}
      {can('planning') && profile.member_role !== 'ouvrier' && <button className="fab" onClick={() => navigate('/pro/planning/nouveau')} aria-label={t('Nouveau rendez-vous')}><LuPlus /></button>}
      <Sheet open={open} onClose={() => setOpen(false)} title={t('Filtrer par équipe')}>
        <Chips multi options={teams.map((x) => [x.id, x.name])} value={teamF} onChange={setTeamF} />
        <div className="btns"><div className="two"><button className="btn ghost" onClick={() => setTeamF([])}>{t('Réinitialiser')}</button><button className="btn" onClick={() => setOpen(false)}>{t('Afficher')}</button></div></div>
      </Sheet>
    </div>
  );
}

function WeekGrid({ days, s, evs, busy, color, cm, onNew }) {
  const [h0, h1] = s.hours; const H = 46;
  const todayKey = iso(new Date());
  const top = (d) => ((d.getHours() + d.getMinutes() / 60 - h0) * H);
  return (
    <div className="cal" style={{ '--n': days.length, '--h': H + 'px' }}>
      <div className="cal-days"><div />{days.map((d) => <div key={d} className={iso(d) === todayKey ? 'today' : ''}>{d.toLocaleDateString(locale(), { weekday: 'short' }).replace('.', '')}<b>{d.getDate()}</b></div>)}</div>
      <div className="cal-body">
        <div className="cal-hours">{Array.from({ length: h1 - h0 }, (_, i) => <div key={i}>{h0 + i}h</div>)}</div>
        {days.map((d) => {
          const key = iso(d);
          const dayEv = evs.filter((a) => iso(new Date(a.start_at)) === key);
          const free = freeWindows(d, busy.filter((a) => a.status !== 'termine'), s, 30);
          return (
            <div key={key} className={'cal-col' + (s.days.includes(d.getDay()) ? '' : ' off')} style={{ height: (h1 - h0) * H }}
              onDoubleClick={(e) => { if (e.target !== e.currentTarget) return; const y = e.nativeEvent.offsetY; const x = new Date(d); x.setHours(h0, 0, 0, 0); x.setMinutes(Math.floor((y / H) * 2) * 30); onNew(x); }}>
              {free.map(([a, b], i) => <button key={'f' + i} className="ev dispo" style={{ top: top(a), height: Math.max(18, top(b) - top(a) - 2) }} onClick={() => onNew(a)} title={t('Créneau libre')}>{t('Dispo')}</button>)}
              {dayEv.map((a) => {
                const st = new Date(a.start_at), en = new Date(a.end_at);
                return (
                  <button key={a.id + (a.occurrence || '')} className={'ev' + (a.status === 'a_valider' ? ' pending' : '') + (a.status === 'termine' ? ' done' : '')} style={{ top: Math.max(0, top(st)), height: Math.max(22, top(en) - top(st) - 2), background: color(a) }} onClick={() => navigate('/pro/planning/rdv/' + a.id)}>
                    <b>{hm(st)}{a.mode === 'visio' && ' 🎥'}</b>{a.personal ? a.title : clientName(cm[a.client_id])}<br />{!a.personal && a.title}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthGrid({ range, anchor, evs, color, cm, onDay }) {
  const days = Array.from({ length: 42 }, (_, i) => addDays(range[0], i));
  return (
    <div className="cal">
      <div className="cal-month">
        {days.slice(0, 7).map((d) => <div key={'h' + d} className="small bold center" style={{ padding: 6, borderBottom: '1px solid var(--line-2)' }}>{d.toLocaleDateString(locale(), { weekday: 'short' })}</div>)}
        {days.map((d) => {
          const k = iso(d); const list = evs.filter((a) => iso(new Date(a.start_at)) === k);
          return (
            <div key={k} className={'cell' + (d.getMonth() !== anchor.getMonth() ? ' out' : '')} onClick={() => onDay(d)} style={{ cursor: 'pointer' }}>
              <span className="n">{d.getDate()}</span>
              {list.slice(0, 3).map((a) => <button key={a.id + (a.occurrence || '')} className="mini" style={{ background: a.status === 'a_valider' ? 'var(--bordeaux)' : color(a) }} onClick={(e) => { e.stopPropagation(); navigate('/pro/planning/rdv/' + a.id); }}>{hm(a.start_at)} {a.personal ? a.title : clientName(cm[a.client_id])}</button>)}
              {list.length > 3 && <span className="small faint">+{list.length - 3}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────── Détail d'un RDV ───────────────
export function ApptDetail({ params }) {
  const { company, teams, run, confirm, profile, toast } = useApp();
  const [b, reload] = useData(async () => {
    const a = await api.one('appointments', { id: params.id });
    if (!a) return { a: null };
    const [c, doc] = await Promise.all([a.client_id ? api.one('clients', { id: a.client_id }) : null, a.document_id ? api.one('documents', { id: a.document_id }) : null]);
    return { a, c, doc };
  }, [params.id]);
  const [enroute, setEnroute] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [big, setBig] = useState(null);
  if (!b) return <div className="content"><TopBar title={t('Rendez-vous')} /><Loader /></div>;
  const { a, c, doc } = b;
  if (!a) return <div className="content"><TopBar title={t('Rendez-vous')} /><Empty text={t('Rendez-vous introuvable')} /></div>;
  const team = teams.find((x) => x.id === a.team_id);
  const phone = a.contact_phone || c?.mobile || c?.phone || '';
  const wa = 'https://wa.me/' + phone.replace(/\D/g, '').replace(/^0/, '33');
  const notifyChat = async (card, body) => {
    if (!a.client_id) return;
    let conv = await api.one('conversations', { kind: 'client', company_id: company.id, client_id: a.client_id });
    if (!conv) conv = await api.insert('conversations', { kind: 'client', company_id: company.id, client_id: a.client_id, client_user_id: c?.user_id || null });
    await api.insert('messages', { conversation_id: conv.id, sender_name: fullName(profile) || company.name, sender_company_id: company.id, card, body: body || '' });
  };
  const validate = () => run(async () => {
    await api.update('appointments', { id: a.id }, { status: 'valide', validated_at: new Date().toISOString() });
    await notifyChat({ type: a.mode === 'visio' ? 'rdv' : 'cal', title: (a.mode === 'visio' ? t('Visio confirmée') : t('RDV confirmé')) + ' · ' + dateShort(a.start_at) + ' ' + hm(a.start_at), sub: a.mode === 'visio' ? t('Lien WhatsApp envoyé au client') : a.address });
    reload();
  }, t('Rendez-vous validé'));
  const setStatus = async (status, q) => { if (q && !(await confirm(q))) return; await run(() => api.update('appointments', { id: a.id }, { status }), t('Rendez-vous mis à jour')); reload(); };
  const goRoute = () => window.open('https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(a.address), '_blank');
  return (
    <div className="content">
      <TopBar title={t('Rendez-vous')} sub={a.personal ? t('Personnel') : clientName(c)} />
      <div className="hero">
        <span className="tag pill" style={{ border: '1.5px solid #fff', color: '#fff' }}>{a.mode === 'visio' ? <><LuVideo /> {t('Visio')}</> : <><LuMapPin /> {t('Sur site')}</>}</span>
        <h2 style={{ paddingRight: 100 }}>{a.title || t(a.type)}</h2>
        <div className="l2">{[a.personal ? '' : clientName(c), c?.site_city || c?.billing_city].filter(Boolean).join(' · ')}</div>
        <div className="row"><b>{dateShort(a.start_at)} · {hm(a.start_at)} – {hm(a.end_at)}</b><StatusPill s={a.status === 'a_valider' ? ['white', t('À valider')] : apptStatus(a.status)} /></div>
      </div>
      <div className="grid2">
        <div>
          <Sec title={t('Détails')} />
          <KV rows={[
            !a.personal && [t('Client'), c ? <Link to={'/pro/clients/' + c.id}>{clientName(c)}</Link> : '—'],
            [t('Type'), t(a.type)],
            [t('Équipe'), <select value={a.team_id || ''} onChange={(e) => run(() => api.update('appointments', { id: a.id }, { team_id: e.target.value || null }), t('Équipe mise à jour')).then(reload)} style={{ border: 0, background: 'transparent', fontWeight: 700, textAlign: 'right', color: 'inherit' }}>
              <option value="">—</option>{teams.map((x) => <option key={x.id} value={x.id}>● {x.name}</option>)}</select>],
            a.contact_name && [t('Contact sur place'), a.contact_name],
            phone && [t('Tél. mobile'), phone, { href: 'tel:' + phone }],
            doc && [t('Devis lié'), <Link to={'/pro/documents/' + doc.id}>{doc.number || t('Brouillon')}</Link>],
            a.recurrence !== 'none' && [t('Récurrence'), t({ weekly: 'Chaque semaine', monthly: 'Chaque mois', yearly: 'Chaque année' }[a.recurrence])],
            a.requested_by && [t('Demandé le'), dateTime(a.created_at)],
            a.validated_at && [t('Validé le'), dateTime(a.validated_at)],
            a.enroute_at && [t('En route depuis'), hm(a.enroute_at) + (a.eta_at ? ' · ' + t('arrivée {h}', { h: hm(a.eta_at) }) : '')],
          ]} />
          {(a.request_text || a.photos?.length > 0) && (
            <div className="card soft mt">
              <div className="row between small muted"><span>{t('Demande du client')}</span>{a.photos?.length > 0 && <span className="red-t bold"><LuImage /> {t('{n} photos', { n: a.photos.length })}</span>}</div>
              <p className="wsb" style={{ margin: '8px 0' }}>{a.request_text}</p>
              {a.photos?.length > 0 && <div className="photos-grid">{a.photos.map((p) => <Img key={p.path} path={p.path} onClick={() => setBig(p.path)} />)}</div>}
            </div>
          )}
          {a.notes && <div className="postit mt">{a.notes}</div>}
          {a.address && <div className="card soft mt row"><LuMapPin className="red-t" size={22} /><div><div className="small muted">{t("Adresse d'intervention")}</div><b>{a.address}</b></div></div>}
        </div>
        <div>
          <div className="btns">
            {a.status === 'a_valider' && <>
              {a.mode === 'visio' && phone && <a className="btn ghost" href={wa} target="_blank" rel="noreferrer"><LuVideo /> {t('Lancer la visio sur WhatsApp')} ↗</a>}
              <button className="btn" onClick={validate}>{t('Valider le rendez-vous')}</button>
              <div className="two"><button className="btn ghost sm" onClick={() => setMoveOpen(true)}>{t('Proposer un autre créneau')}</button><button className="btn light sm" onClick={() => setStatus('refuse', { title: t('Refuser ce rendez-vous ?'), ok: t('Refuser'), danger: true })}>{t('Refuser')}</button></div>
            </>}
            {a.status === 'valide' && <>
              {a.mode === 'visio' ? phone && <a className="btn" href={wa} target="_blank" rel="noreferrer"><LuVideo /> {t('Lancer la visio sur WhatsApp')} ↗</a>
                : a.address && <button className="btn" onClick={() => setEnroute(true)}><LuNavigation /> {t("Lancer l'itinéraire")}</button>}
              <div className="two"><button className="btn ghost sm" onClick={() => setMoveOpen(true)}>{t('Déplacer le rendez-vous')}</button><button className="btn light sm" onClick={() => setStatus('annule', { title: t('Annuler ce rendez-vous ?'), text: t('Le client sera prévenu.'), ok: t('Annuler le RDV'), danger: true })}>{t('Annuler')}</button></div>
              <button className="btn ghost sm" onClick={() => setStatus('termine')}><LuCheck /> {t('Marquer comme terminé')}</button>
            </>}
            {!a.personal && a.client_id && <div className="two">
              <button className="btn ghost sm" onClick={() => navigate(`/pro/documents/nouveau?kind=devis&client=${a.client_id}&project=${a.project_id || ''}&appt=${a.id}`)}>{t('Créer un devis')}</button>
              <button className="btn ghost sm" onClick={() => navigate(`/pro/clients/${a.client_id}/chat`)}>{t('Écrire au client')}</button>
            </div>}
            <div className="two">
              <button className="btn light sm" onClick={() => icsFile([{ id: a.id, start: a.start_at, end: a.end_at, title: (a.title || a.type) + (c ? ' · ' + clientName(c) : ''), location: a.address, rrule: rrule(a.recurrence) }])}><LuCalendarPlus /> {t('Mon agenda')}</button>
              <button className="btn light sm" onClick={() => navigate(`/pro/planning/rdv/${a.id}/modifier`)}>{t('Modifier')}</button>
            </div>
          </div>
        </div>
      </div>
      <EnRoute open={enroute} a={a} c={c} onClose={() => setEnroute(false)} done={() => { setEnroute(false); reload(); goRoute(); }} skip={() => { setEnroute(false); goRoute(); }} />
      <MoveSheet open={moveOpen} a={a} onClose={() => setMoveOpen(false)} onDone={async (start, end) => {
        await run(async () => {
          await api.update('appointments', { id: a.id }, { start_at: start.toISOString(), end_at: end.toISOString(), status: 'valide', validated_at: new Date().toISOString() });
          await notifyChat({ type: 'cal', title: t('Nouveau créneau proposé') + ' · ' + dateShort(start) + ' ' + hm(start), sub: t('Vous pouvez le déplacer depuis vos RDV si besoin.') });
        }, t('Rendez-vous déplacé, le client est prévenu'));
        setMoveOpen(false); reload();
      }} />
      <Lightbox path={big} onClose={() => setBig(null)} />
    </div>
  );
}

// Heure d'arrivée : position GPS + calcul d'itinéraire (OpenStreetMap), sinon saisie manuelle
async function estimateEta(address) {
  const pos = await new Promise((res, rej) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }) : rej());
  const g = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=fr&q=' + encodeURIComponent(address)).then((r) => r.json());
  if (!g[0]) throw new Error('adresse');
  const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${pos.coords.longitude},${pos.coords.latitude};${g[0].lon},${g[0].lat}?overview=false`).then((x) => x.json());
  const sec = r.routes?.[0]?.duration; if (!sec) throw new Error('route');
  return Math.round((sec * 1.15) / 60);
}

function EnRoute({ open, a, c, onClose, done, skip }) {
  const { run } = useApp();
  const [mins, setMins] = useState('');
  const [busy, setBusy] = useState(false);
  const yes = async () => {
    setBusy(true);
    let m = Number(mins);
    if (!m) { try { m = await estimateEta(a.address); } catch { m = 0; } }
    if (!m) { setBusy(false); setMins('20'); return; }
    const eta = new Date(Date.now() + m * 6e4);
    await run(() => api.update('appointments', { id: a.id }, { enroute_at: new Date().toISOString(), eta_at: eta.toISOString() }), t('{n} est prévenu de votre arrivée', { n: clientName(c) }));
    setBusy(false); done();
  };
  return (
    <Modal open={open} onClose={onClose}>
      <div className="big-ico"><LuSend /></div>
      <h3>{t('Je suis en route')}</h3>
      <p className="muted">{t('{n} sera prévenu de votre arrivée.', { n: a.contact_name || clientName(c) })}</p>
      <Field label={t('Temps de trajet (minutes)')} hint={t('laissez vide pour le calculer avec votre position')}><input type="number" min="1" value={mins} onChange={(e) => setMins(e.target.value)} /></Field>
      <div className="btns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <button className="btn ghost" onClick={skip}>{t('Non')}</button>
        <button className="btn" onClick={yes} disabled={busy}>{busy ? '…' : t('Oui')}</button>
      </div>
    </Modal>
  );
}

export function MoveSheet({ open, a, onClose, onDone }) {
  const [d, setD] = useState(a ? iso(new Date(a.start_at)) : '');
  const [h, setH] = useState(a ? hm(a.start_at) : '09:00');
  if (!open) return null;
  const dur = new Date(a.end_at) - new Date(a.start_at);
  return (
    <Sheet open onClose={onClose} title={t('Nouveau créneau')}>
      <div className="form-grid two"><Field label={t('Date')}><input type="date" value={d} onChange={(e) => setD(e.target.value)} /></Field><Field label={t('Heure')}><input type="time" value={h} onChange={(e) => setH(e.target.value)} step={900} /></Field></div>
      <button className="btn block" onClick={() => { const s = new Date(d + 'T' + h); onDone(s, new Date(+s + dur)); }}>{t('Confirmer')}</button>
    </Sheet>
  );
}

// ─────────────── Création / modification ───────────────
export function ApptEdit({ params }) {
  const { company, teams, run, profile } = useApp();
  const s = planSettings(company);
  const { query } = useLocation();
  const [a, setA] = useState(null);
  const [clients] = useData(() => api.select('clients', { company_id: company.id }, { order: 'last_name.asc' }), []);
  useData(async () => {
    if (params.id) { setA(await api.one('appointments', { id: params.id })); return; }
    const st = query.get('start') ? new Date(query.get('start')) : (() => { const x = new Date(); x.setDate(x.getDate() + 1); x.setHours(9, 0, 0, 0); return x; })();
    const cl = query.get('client') ? await api.one('clients', { id: query.get('client') }) : null;
    setA({ client_id: cl?.id || '', type: 'Chantier', title: '', start_at: st.toISOString(), end_at: new Date(+st + s.duration * 6e4).toISOString(), mode: 'site', status: 'valide', team_id: profile.team_id || teams[0]?.id || '', address: cl ? [cl.site_address, [cl.site_zip, cl.site_city].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '', contact_name: cl ? clientName(cl) : '', contact_phone: cl?.mobile || cl?.phone || '', recurrence: 'none', personal: false, notes: '' });
  }, [params.id]);
  if (!a || !clients) return <div className="content"><TopBar title={t('Rendez-vous')} /><Loader /></div>;
  const d = iso(new Date(a.start_at)), h1 = hm(a.start_at), h2 = hm(a.end_at);
  const setTime = (day, from, to) => setA({ ...a, start_at: new Date(day + 'T' + from).toISOString(), end_at: new Date(day + 'T' + to).toISOString() });
  const pickClient = (id) => {
    const cl = clients.find((x) => x.id === id);
    setA({ ...a, client_id: id, address: cl ? [cl.site_address, [cl.site_zip, cl.site_city].filter(Boolean).join(' ')].filter(Boolean).join(', ') : a.address, contact_name: cl ? clientName(cl) : '', contact_phone: cl?.mobile || cl?.phone || '' });
  };
  const save = async (e) => {
    e.preventDefault();
    if (new Date(a.end_at) <= new Date(a.start_at)) return run(async () => { throw new Error(t("L'heure de fin doit être après l'heure de début.")); });
    const row = { ...a, client_id: a.personal ? null : a.client_id || null, team_id: a.team_id || null, title: a.title || t(a.type) };
    delete row.id; delete row.created_at;
    await run(async () => {
      if (params.id) { await api.update('appointments', { id: params.id }, row); navigate(-1); }
      else {
        if (row.client_id && !row.project_id) { const p = await api.insert('projects', { company_id: company.id, client_id: row.client_id, title: row.title, address: row.address }); row.project_id = p.id; }
        const x = await api.insert('appointments', { ...row, company_id: company.id, validated_at: new Date().toISOString() });
        navigate('/pro/planning/rdv/' + x.id, { replace: true });
      }
    }, t('Rendez-vous enregistré'));
  };
  return (
    <div className="content narrow">
      <TopBar title={params.id ? t('Modifier le rendez-vous') : t('Nouveau rendez-vous')} />
      <form onSubmit={save}>
        <label className="check"><input type="checkbox" checked={a.personal} onChange={(e) => setA({ ...a, personal: e.target.checked })} />{t('RDV personnel (sans client)')}</label>
        {!a.personal && <Field label={t('Client')}><select value={a.client_id || ''} onChange={(e) => pickClient(e.target.value)} required><option value="">{t('Choisir un client')}</option>{clients.map((c) => <option key={c.id} value={c.id}>{clientName(c)} · {c.billing_city}</option>)}</select></Field>}
        {!a.personal && <Chips options={APPT_TYPES.map((x) => [x, t(x)])} value={a.type} onChange={(type) => setA({ ...a, type })} red />}
        <Field label={t('Objet')}><input value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} placeholder={t('ex. Changement d’un chauffe-eau')} /></Field>
        <div className="form-grid three">
          <Field label={t('Date')}><input type="date" value={d} onChange={(e) => setTime(e.target.value, h1, h2)} required /></Field>
          <Field label={t('Début')}><input type="time" value={h1} step={900} onChange={(e) => setTime(d, e.target.value, h2)} required /></Field>
          <Field label={t('Fin')}><input type="time" value={h2} step={900} onChange={(e) => setTime(d, h1, e.target.value)} required /></Field>
        </div>
        <Seg options={[['site', t('Sur site')], ['visio', t('En visio')]]} value={a.mode} onChange={(mode) => setA({ ...a, mode })} />
        <div className="form-grid two">
          <Field label={t('Équipe')}><select value={a.team_id || ''} onChange={(e) => setA({ ...a, team_id: e.target.value })}><option value="">—</option>{teams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label={t('Récurrence')}><select value={a.recurrence} onChange={(e) => setA({ ...a, recurrence: e.target.value })}><option value="none">{t('Aucune')}</option><option value="weekly">{t('Chaque semaine')}</option><option value="monthly">{t('Chaque mois')}</option><option value="yearly">{t('Chaque année (entretien)')}</option></select></Field>
        </div>
        {a.mode === 'site' && <Field label={t("Adresse d'intervention")}><input value={a.address} onChange={(e) => setA({ ...a, address: e.target.value })} /></Field>}
        {!a.personal && <div className="form-grid two"><Field label={t('Contact sur place')}><input value={a.contact_name} onChange={(e) => setA({ ...a, contact_name: e.target.value })} /></Field><Field label={t('Téléphone')}><input type="tel" value={a.contact_phone} onChange={(e) => setA({ ...a, contact_phone: e.target.value })} /></Field></div>}
        <Field label={t('Note interne')}><textarea value={a.notes || ''} onChange={(e) => setA({ ...a, notes: e.target.value })} /></Field>
        <button className="btn block">{t('Enregistrer')}</button>
      </form>
    </div>
  );
}

// ─────────────── Réglages du planning ───────────────
export function PlanningSettings() {
  const { company, setCompany, run, wip, teams } = useApp();
  const [s, setS] = useState(planSettings(company));
  const save = async (patch) => {
    const n = { ...s, ...patch }; setS(n);
    const settings = { ...company.settings, planning: n };
    await run(() => api.update('companies', { id: company.id }, { settings }));
    setCompany({ ...company, settings });
  };
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const DAYS = [[1, 'Lun'], [2, 'Mar'], [3, 'Mer'], [4, 'Jeu'], [5, 'Ven'], [6, 'Sam'], [0, 'Dim']];
  return (
    <div className="content narrow">
      <TopBar title={t('Réglages')} sub={t('Planning')} />
      <Sec title={t('Affichage')} />
      <div className="kv">
        <div className="r"><span className="k">{t('Vue par défaut')}</span><select value={s.view} onChange={(e) => save({ view: e.target.value })}><option value="day">{t('Jour')}</option><option value="week">{t('Semaine')}</option><option value="month">{t('Mois')}</option></select></div>
        <div className="r"><span className="k">{t('Heures affichées')}</span><span className="row"><select value={s.hours[0]} onChange={(e) => save({ hours: [+e.target.value, s.hours[1]] })}>{hours.map((h) => <option key={h} value={h}>{h} h</option>)}</select>–<select value={s.hours[1]} onChange={(e) => save({ hours: [s.hours[0], +e.target.value] })}>{hours.slice(1).map((h) => <option key={h} value={h}>{h} h</option>)}<option value={24}>24 h</option></select></span></div>
        <div className="r"><span className="k">{t('Afficher le week-end')}</span><Toggle checked={s.weekend} onChange={(v) => save({ weekend: v })} /></div>
      </div>
      <Sec title={t('Couleurs')} />
      <div className="kv">
        <div className="r"><span className="k">{t('Couleur par')}</span><span style={{ minWidth: 170 }}><Seg options={[['team', t('Équipes')], ['client', t('Clients')]]} value={s.colorBy} onChange={(v) => save({ colorBy: v })} /></span></div>
        <Link className="r" to="/pro/compte/equipe"><span className="k">{t('Couleurs des équipes')}</span><span className="row">{teams.map((x) => <i key={x.id} style={{ width: 18, height: 18, borderRadius: 9, background: x.color, display: 'inline-block' }} />)} ›</span></Link>
      </div>
      <Sec title={t('Rendez-vous')} />
      <div className="kv">
        <div className="r" style={{ display: 'block' }}><div className="k mb">{t('Plages disponibles')}</div>
          <Chips multi options={DAYS.map(([v, l]) => [v, t(l)])} value={s.days} onChange={(days) => save({ days })} />
          <span className="row">{t('de')} <select value={s.slot[0]} onChange={(e) => save({ slot: [+e.target.value, s.slot[1]] })}>{hours.map((h) => <option key={h} value={h}>{h} h</option>)}</select> {t('à')} <select value={s.slot[1]} onChange={(e) => save({ slot: [s.slot[0], +e.target.value] })}>{hours.map((h) => <option key={h} value={h}>{h} h</option>)}</select></span>
        </div>
        <div className="r"><span className="k">{t('Durée par défaut')}</span><select value={s.duration} onChange={(e) => save({ duration: +e.target.value })}>{[30, 60, 90, 120, 180, 240].map((m) => <option key={m} value={m}>{m < 60 ? m + ' min' : m / 60 + ' h'}</option>)}</select></div>
        <div className="r"><span className="k">{t('Validation manuelle')}</span><Toggle checked={s.manual} onChange={(v) => save({ manual: v })} /></div>
        <div className="r"><span className="k">{t('Rappel au client')}</span><select value={s.reminder} onChange={(e) => save({ reminder: +e.target.value })}>{[0, 2, 24, 48].map((h) => <option key={h} value={h}>{h ? t('{n} h avant', { n: h }) : t('Aucun')}</option>)}</select></div>
        <div className="r"><span className="k">{t('Visio WhatsApp')}</span><Toggle checked={s.visio} onChange={(v) => save({ visio: v })} /></div>
      </div>
      <Sec title={t('Synchronisation')} />
      <div className="kv">
        <button className="r" style={{ width: '100%', border: 0, background: 'transparent', color: 'inherit' }} onClick={() => wip(t('La synchronisation Google Agenda / Outlook'))}><span className="k">{t('Agenda externe')}</span><span className="v">Google, Outlook ›</span></button>
        <button className="r" style={{ width: '100%', border: 0, background: 'transparent', color: 'inherit' }} onClick={async () => {
          const ap = await api.select('appointments', { company_id: company.id, status: ['valide', 'a_valider'] });
          icsFile(ap.map((x) => ({ id: x.id, start: x.start_at, end: x.end_at, title: x.title, location: x.address, rrule: rrule(x.recurrence) })), 'planning-artis-and-you.ics');
        }}><span className="k">{t('Exporter mon planning (.ics)')}</span><span className="v">›</span></button>
      </div>
    </div>
  );
}
