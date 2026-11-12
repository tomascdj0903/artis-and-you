// Planning : vues agenda / semaine / mois, créneaux libres, réglages partagés
import { kbd } from '../../lib/a11y.js';
import { useMemo, useRef, useState } from 'react';
import { PageFab } from '../../ui/fab.jsx';
import { LuChevronLeft, LuChevronRight, LuSettings, LuPlus, LuVideo } from 'react-icons/lu';
import { api } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate, useLocation, Link } from '../../lib/router.jsx';
import { t, locale } from '../../lib/i18n.js';
import { clientName, dateShort, hm, startOfWeek, addDays, weekNumber, iso, date } from '../../lib/format.js';
import { apptStatus, APPT_TYPES, expandAppointments } from '../../lib/docs.js';
import { TopBar, SearchBar, Sec, Sheet, Chips, useData, Loader, Empty, StatusPill, Picker } from '../../ui/index.jsx';


export const DEFAULT_DURATIONS = { Diagnostic: 60, 'Dépannage': 90, Devis: 60, Entretien: 60, Chantier: 240 };
const PALETTE = ['#2B1F1C', '#B4432A', '#1F6F78', '#6B4E9B', '#B5651D', '#2E7D32', '#AD1457', '#455A64'];
const hashColor = (s = '') => PALETTE[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
export const planSettings = (company) => ({ view: 'week', hours: [7, 19], weekend: false, colorBy: 'team', days: [1, 2, 3, 4, 5, 6], slot: [8, 18], duration: 60, manual: true, reminder: 24, visio: true, ...(company?.settings?.planning || {}), durations: { ...DEFAULT_DURATIONS, ...(company?.settings?.planning?.durations || {}) }, offered: company?.settings?.planning?.offered || APPT_TYPES.filter((x) => x !== 'Diagnostic') });
// Nombre de colonnes de la semaine : jusqu'au dernier jour travaillé (le dimanche s'affiche s'il est coché)
export const weekLength = (s) => (s.weekend || s.days.includes(0) ? 7 : s.days.includes(6) ? 6 : 5);

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
  const { company, teams, profile, can, run, confirm } = useApp();
  const s = planSettings(company);
  const { query } = useLocation();
  // Sur téléphone, la vue Jour est la plus lisible : c'est la vue d'ouverture
  const narrow = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches;
  const [view, setView] = useState(query.get('vue') || (narrow ? 'day' : s.view));
  const [anchor, setAnchor] = useState(() => query.get('d') ? new Date(query.get('d')) : new Date());
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [teamF, setTeamF] = useState(profile.member_role === 'ouvrier' && profile.team_id ? [profile.team_id] : []);
  const range = useMemo(() => {
    if (view === 'day' && !narrow) { const a = new Date(anchor); a.setHours(0, 0, 0, 0); return [a, addDays(a, 1)]; }
    if (view === 'month') { const a = new Date(anchor.getFullYear(), anchor.getMonth(), 1); const st = startOfWeek(a); return [st, addDays(st, 42)]; }
    const st = startOfWeek(anchor); return [st, addDays(st, 7)];
  }, [view, anchor]);
  const [proj, setProj] = useState(query.get('projet') || '');
  const [pick, setPick] = useState(false);
  const [shared] = useData(() => api.rpc('shared_projects').catch(() => []), []);
  const [data, refetch, loading] = useData(async () => {
    await api.rpc('finish_past_appointments').catch(() => 0);
    const [appts, clients] = await Promise.all([
      proj ? api.rpc('shared_project_planning', { p_project: proj, p_from: range[0].toISOString(), p_to: range[1].toISOString() }).then((r) => r || []) : api.select('appointments', { company_id: company.id, 'start_at<': range[1].toISOString(), status: ['a_valider', 'valide', 'termine'] }, { order: 'start_at.asc' }),
      api.select('clients', { company_id: company.id }, { columns: 'id,type,last_name,first_name,company_name,trade_name,site_city,billing_city' }),
    ]);
    return { appts, cm: Object.fromEntries(clients.map((c) => [c.id, c])) };
  }, [range[0].getTime(), view, proj]);
  // Recherche sur toutes les dates (pas seulement la semaine affichée)
  const [allData] = useData(async () => (q.trim() ? api.select('appointments', { company_id: company.id }, { order: 'start_at.desc', limit: 1000 }) : null), [!!q.trim()]);
  const tm = Object.fromEntries(teams.map((x) => [x.id, x]));
  const reload = () => refetch();
  const [undo, setUndo] = useState(null);
  const moveAppt = async (a, start) => {
    const dur = new Date(a.end_at) - new Date(a.start_at);
    if (+start === +new Date(a.start_at) || (a.company && !a.mine)) return;
    const c = data?.cm[a.client_id];
    const ok = await confirm({ title: t('Déplacer ce rendez-vous ?'), text: t('{t} : du {a} au {b}.', { t: a.title || t(a.type), a: `${dateShort(a.start_at)} ${hm(a.start_at)}`, b: `${dateShort(start)} ${hm(start)}` }) + (c?.user_id ? ' ' + t('{n} sera prévenu par notification.', { n: clientName(c) }) : ''), ok: t('Déplacer') });
    if (!ok) return;
    const prev = { start_at: a.start_at, end_at: a.end_at };
    await run(() => api.update('appointments', { id: a.id }, { start_at: start.toISOString(), end_at: new Date(+start + dur).toISOString() }));
    setUndo({ a, prev, label: `${dateShort(start)} ${hm(start)}` }); reload();
    setTimeout(() => setUndo((u) => (u && u.a.id === a.id ? null : u)), 8000);
  };
  const color = (a) => (a.company_id && a.company ? hashColor(a.company_id) : a.personal ? '#8A90A0' : s.colorBy === 'client' ? hashColor(a.client_id || a.title) : tm[a.team_id]?.color || '#2B1F1C');
  const all = data ? expandAppointments(data.appts, range[0], range[1]) : [];
  const nz = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const match = (a) => { const c = data?.cm[a.client_id]; const hay = nz([a.title, a.type, clientName(c), c?.company_name, c?.last_name, c?.first_name, a.address, a.contact_name, a.notes, dateShort(a.start_at)].join(' ')); return nz(q).trim().split(/\s+/).every((w) => hay.includes(w)); };
  // Légende cliquable : on masque / affiche une équipe, un pro du chantier, les dispos, les RDV à valider / validés, les visios
  const [hide, setHide] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem('ay-plan-hide') || '[]')); } catch { return new Set(); } });
  const tog = (k) => setHide((h) => { const n = new Set(h); n.has(k) ? n.delete(k) : n.add(k); try { localStorage.setItem('ay-plan-hide', JSON.stringify([...n])); } catch {} return n; });
  const evs = all.filter((a) => (!teamF.length || teamF.includes(a.team_id))
    && !(a.company ? hide.has('co:' + a.company_id) : a.team_id && hide.has('team:' + a.team_id))
    && !(a.status === 'a_valider' && hide.has('a_valider')) && !(['valide', 'termine'].includes(a.status) && hide.has('valide')) && !(a.mode === 'visio' && hide.has('visio')));
  const dragOk = can('planning') && profile.member_role !== 'ouvrier';
  const sp = (shared || []).find((x) => x.id === proj);
  const L = ({ k, children }) => <button type="button" className={hide.has(k) ? 'off' : ''} aria-pressed={!hide.has(k)} onClick={() => tog(k)}>{children}</button>;
  const move = (n) => { const a = new Date(anchor); if (view === 'day') a.setDate(a.getDate() + n); else if (view === 'month') a.setMonth(a.getMonth() + n); else a.setDate(a.getDate() + 7 * n); setAnchor(a); };
  const label = view === 'month' ? anchor.toLocaleDateString(locale(), { month: 'long', year: 'numeric' }) : view === 'day' ? dateShort(anchor) : t('Semaine {n}', { n: weekNumber(startOfWeek(anchor)) });
  const sub = view === 'week' ? `${range[0].toLocaleDateString(locale(), { day: 'numeric', month: 'short' })} – ${addDays(range[1], -1).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' })}` : '';
  const newAt = (d) => can('planning') && navigate('/pro/planning/nouveau?start=' + encodeURIComponent(d.toISOString()));

  return (
    <div className="content" style={{ maxWidth: 1400 }}>
      <TopBar title={t('Planning')} sub={sub} back={false} />
      {(shared || []).length > 0 && <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}><Picker options={shared.map((x) => [x.id, x.title, [x.address, (x.members || []).map((m) => m.name).join(', ')].filter(Boolean).join(' · ')])} value={proj} onChange={setProj} empty={t('Mon planning')} placeholder={t('Mon planning · tapez un chantier')} /></div>
      </div>}
      {sp && <div className="shared-head">
        <div className="sh-top"><div className="grow"><b>{sp.title}</b>{sp.address && <div className="small muted">{sp.address}</div>}</div>
          <button className="btn xs" onClick={() => navigate('/pro/planning/nouveau?project=' + sp.id)}><LuPlus /> {t('Mon intervention')}</button></div>
        <div className="sh-members">{sp.members.map((m) => <button type="button" key={m.id} className={hide.has('co:' + m.id) ? 'off' : ''} onClick={() => tog('co:' + m.id)} aria-pressed={!hide.has('co:' + m.id)}><i style={{ background: hashColor(m.id) }} />{m.name}{m.trades?.[0] ? ' · ' + t(m.trades[0]) : ''}</button>)}</div>
        <div className="small muted">{t('Touchez un pro pour l’afficher ou le masquer. Seuls vos propres rendez-vous sont modifiables.')}</div>
      </div>}
      <SearchBar placeholder={t('Recherchez un rendez-vous (client, objet, adresse)')} value={q} onChange={setQ} onFilter={() => setOpen(true)} filterActive={teamF.length > 0} />
      <div className="cal-head">
        <button className="round" onClick={() => move(-1)} aria-label={t('Précédent')}><LuChevronLeft /></button>
        <span style={{ position: 'relative' }}>
          <button className="pick-label" onClick={() => setPick(!pick)} aria-expanded={pick}>{label} ▾</button>
          {pick && <WeekPicker anchor={anchor} view={view} onPick={(d) => { setAnchor(d); setPick(false); }} onClose={() => setPick(false)} />}
        </span>
        <button className="round" onClick={() => move(1)} aria-label={t('Suivant')}><LuChevronRight /></button>
        <button className="btn xs ghost" onClick={() => setAnchor(new Date())}>{t("Aujourd'hui")}</button>
        <div style={{ flex: 1 }} />
        <div className="seg" style={{ margin: 0, minWidth: 210 }}>{[['day', narrow ? t('Agenda') : t('Jour')], ['week', t('Semaine')], ['month', t('Mois')]].map(([v, l]) => <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)} style={{ padding: '6px 8px', fontSize: 13, minHeight: 40 }}>{l}</button>)}</div>
        {profile.member_role !== 'ouvrier' && <Link to="/pro/planning/reglages" className="btn xs ghost"><LuSettings /> {t('Réglages')}</Link>}
      </div>
      <div className="cal-legend toggles" title={t('Touchez pour afficher ou masquer')}>
        {!proj && s.colorBy === 'team' && teams.map((x) => <L key={x.id} k={'team:' + x.id}><i style={{ background: x.color }} />{x.name}</L>)}
        {!proj && <L k="dispo"><i className="ev dispo" style={{ position: 'static' }} />{t('Dispo')}</L>}
        <L k="a_valider"><i style={{ border: '2px dashed var(--bordeaux)' }} />{t('À valider')}</L>
        <L k="valide"><i style={{ background: 'var(--ardoise)' }} />{t('Validé')}</L>
        <L k="visio"><LuVideo /> {t('Visio')}</L>
      </div>
      {undo && <div className="notice row" style={{ justifyContent: 'space-between', marginBottom: 8 }}><span>{t('Rendez-vous déplacé au {d}', { d: undo.label })}</span><button className="btn xs ghost" onClick={async () => { await run(() => api.update('appointments', { id: undo.a.id }, undo.prev)); setUndo(null); reload(); }}>{t('Annuler')}</button></div>}
      {q.trim() ? <SearchResults list={(allData || []).filter((a) => match(a)).filter((a) => !teamF.length || teamF.includes(a.team_id))} loading={!allData} cm={data?.cm || {}} color={color} q={q.trim()} />
      : loading ? <Loader /> : view === 'month' ? (
        <MonthGrid range={range} anchor={anchor} evs={evs} color={color} cm={data.cm} onDay={(d) => { setAnchor(d); setView('day'); }} onMove={dragOk ? moveAppt : null} />
      ) : (<>
        {narrow && view === 'day' ? <MobileAgenda anchor={anchor} setAnchor={setAnchor} evs={evs} busy={all} noFree={hide.has('dispo') || !!proj} s={s} cm={data.cm} color={color} onNew={newAt} /> : <>
        {narrow && view === 'week' && <p className="small muted" style={{ margin: '0 0 6px' }}>{t('Touchez un jour ou un rendez-vous pour voir le détail.')}</p>}
        <WeekGrid compact={narrow && view !== 'day'} onDay={(d) => { setAnchor(d); setView('day'); }} days={view === 'day' ? [range[0]] : Array.from({ length: weekLength(s) }, (_, i) => addDays(range[0], i))}
          s={s} evs={evs} busy={all} noFree={hide.has('dispo')} color={color} cm={data.cm} onNew={newAt} onMove={dragOk ? moveAppt : null} />
      </>}
      </>
      )}
      {dragOk && !q.trim() && view !== 'month' && !narrow && <p className="small faint" style={{ marginTop: 6 }}>{t('Astuce : faites glisser un rendez-vous pour le déplacer (par pas de 15 min).')}</p>}
      <PageFab hidden={!(can('planning') && profile.member_role !== 'ouvrier')} primary={{ label: t('Nouveau rendez-vous'), to: '/pro/planning/nouveau' }} />
      <Sheet open={open} onClose={() => setOpen(false)} title={t('Filtrer par équipe')}>
        <Chips multi options={teams.map((x) => [x.id, x.name])} value={teamF} onChange={setTeamF} />
        <div className="btns"><div className="two"><button className="btn ghost" onClick={() => setTeamF([])}>{t('Réinitialiser')}</button><button className="btn" onClick={() => setOpen(false)}>{t('Afficher')}</button></div></div>
      </Sheet>
    </div>
  );
}

// Bulle de choix : un mini-calendrier du mois, on touche une semaine (ou un jour) pour y aller
function WeekPicker({ anchor, view, onPick, onClose }) {
  const [m, setM] = useState(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  const st = startOfWeek(m);
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(st, w * 7 + i))).filter((w) => w[0].getMonth() === m.getMonth() || w[6].getMonth() === m.getMonth());
  const curWeek = iso(startOfWeek(anchor)), today = iso(new Date());
  const shift = (n) => setM(new Date(m.getFullYear(), m.getMonth() + n, 1));
  if (view === 'month') return (
    <><div className="pick-veil" onClick={onClose} /><div className="pick-pop">
      <div className="pick-head"><button onClick={() => setM(new Date(m.getFullYear() - 1, 0, 1))}>‹</button><b>{m.getFullYear()}</b><button onClick={() => setM(new Date(m.getFullYear() + 1, 0, 1))}>›</button></div>
      <div className="pick-months">{Array.from({ length: 12 }, (_, i) => new Date(m.getFullYear(), i, 1)).map((d) => <button key={d.getMonth()} className={d.getMonth() === anchor.getMonth() && d.getFullYear() === anchor.getFullYear() ? 'on' : ''} onClick={() => onPick(d)}>{d.toLocaleDateString(locale(), { month: 'short' })}</button>)}</div>
    </div></>
  );
  return (
    <><div className="pick-veil" onClick={onClose} /><div className="pick-pop">
      <div className="pick-head"><button onClick={() => shift(-1)} aria-label={t('Précédent')}>‹</button><b style={{ textTransform: 'capitalize' }}>{m.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })}</b><button onClick={() => shift(1)} aria-label={t('Suivant')}>›</button></div>
      <div className="pick-grid"><span className="wk">{t('Sem.')}</span>{weeks[0].map((d) => <span key={iso(d)} className="dn">{d.toLocaleDateString(locale(), { weekday: 'narrow' })}</span>)}</div>
      {weeks.map((w) => (
        <button key={iso(w[0])} className={'pick-grid pick-week' + (view === 'week' && iso(w[0]) === curWeek ? ' on' : '')} onClick={(e) => { if (view === 'week' || !e.target.dataset.day) onPick(w[0]); }}>
          <span className="wk">{weekNumber(w[0])}</span>
          {w.map((d) => <span {...(view === 'day' ? kbd : null)} key={iso(d)} data-day={view === 'day' ? '1' : undefined} onClick={view === 'day' ? (e) => { e.stopPropagation(); onPick(d); } : undefined}
            className={(d.getMonth() !== m.getMonth() ? 'out ' : '') + (iso(d) === today ? 'today ' : '') + (view === 'day' && iso(d) === iso(anchor) ? 'sel' : '')}>{d.getDate()}</span>)}
        </button>
      ))}
      <button className="btn xs ghost" style={{ marginTop: 6, width: '100%' }} onClick={() => onPick(new Date())}>{t("Aujourd'hui")}</button>
    </div></>
  );
}

// Planning sur téléphone : agenda du jour (bandeau de la semaine, puis Matin / Après-midi / Soir).
// Les RDV qui se chevauchent sont regroupés dans un encadré avec une frise qui montre qui recouvre qui.
function MobileAgenda({ anchor, setAnchor, evs, busy, noFree, s, cm, color, onNew }) {
  const st = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(st, i));
  const key = iso(anchor), todayKey = iso(new Date());
  const count = (d) => evs.filter((a) => iso(new Date(a.start_at)) === iso(d)).length;
  const dayEv = evs.filter((a) => iso(new Date(a.start_at)) === key).map((a) => ({ ...a, _s: +new Date(a.start_at), _e: +new Date(a.end_at) })).sort((a, b) => a._s - b._s);
  // Regroupe les RDV qui se recouvrent
  const groups = []; let g = null;
  for (const a of dayEv) { if (g && a._s < g.end) { g.items.push(a); g.end = Math.max(g.end, a._e); } else { g = { start: a._s, end: a._e, items: [a] }; groups.push(g); } }
  const free = noFree ? [] : freeWindows(new Date(anchor), busy, s, 30).map(([a, b]) => ({ free: true, start: +a, end: +b }));
  const blocks = [...groups, ...free].sort((a, b) => a.start - b.start);
  const part = (ms) => { const h = new Date(ms).getHours(); return h < 12 ? 0 : h < 18 ? 1 : 2; };
  const label = [t('Matin'), t('Après-midi'), t('Soir')];
  const open = (a) => (!a.company || a.mine) && navigate('/pro/planning/rdv/' + a.id);
  const who = (a) => (a.company ? a.company : a.personal ? t('Perso') : clientName(cm[a.client_id]));
  const Card = ({ a }) => (
    <button className="ag-card" onClick={() => open(a)}>
      <span className="ag-time"><b>{hm(new Date(a._s))}</b><small>{hm(new Date(a._e))}</small></span>
      <i style={{ background: color(a) }} />
      <span className="ag-body"><b>{a.personal || a.company ? a.title || who(a) : who(a)}</b><small>{[a.personal || a.company ? who(a) : a.title || t(a.type), a.address].filter(Boolean).join(' · ')}</small></span>
      {a.status === 'a_valider' && <span className="pill">{t('À valider')}</span>}
    </button>
  );
  let last = -1;
  return (
    <div className="agenda">
      <div className="ag-week">{days.map((d) => { const n = count(d); const on = iso(d) === key; return (
        <button key={iso(d)} className={(on ? 'on' : '') + (iso(d) === todayKey ? ' today' : '')} onClick={() => setAnchor(d)}>
          <small>{d.toLocaleDateString(locale(), { weekday: 'short' }).replace('.', '')}</small><b>{d.getDate()}</b>
          <span className="dots">{Array.from({ length: Math.min(n, 3) }, (_, i) => <i key={i} />)}</span>
        </button>); })}</div>
      <div className="ag-day">
        <div className="ag-head"><b style={{ textTransform: 'capitalize' }}>{anchor.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })}</b><span>{dayEv.length ? t('{n} RDV', { n: dayEv.length }) : t('Aucun RDV')}</span></div>
        {!blocks.length && <button className="ag-free" onClick={() => { const x = new Date(anchor); x.setHours(s.slot?.[0] || 8, 0, 0, 0); onNew(x); }}>+ {t('Ajouter un rendez-vous')}</button>}
        {blocks.map((b, i) => {
          const p = part(b.start); const head = p !== last ? <div className="ag-part">{label[p]}</div> : null; last = p;
          if (b.free) return <div key={'f' + i}>{head}<button className="ag-free" onClick={() => onNew(new Date(b.start))}>+ {t('Libre {a} – {b}', { a: hm(new Date(b.start)), b: hm(new Date(b.end)) })}</button></div>;
          if (b.items.length === 1) return <div key={b.items[0].id}>{head}<Card a={b.items[0]} /></div>;
          const span = b.end - b.start;
          return (
            <div key={'g' + i}>{head}
              <div className="ag-overlap">
                <div className="ag-ov-head">⚠ {t('{n} RDV en même temps', { n: b.items.length })} · {hm(new Date(b.start))} – {hm(new Date(b.end))}</div>
                <div className="ag-ov-scale"><span>{hm(new Date(b.start))}</span><span>{hm(new Date(b.end))}</span></div>
                {b.items.map((a) => (
                  <button key={a.id} className="ag-ov-row" onClick={() => open(a)}>
                    <span className="ag-ov-txt"><b>{hm(new Date(a._s))}–{hm(new Date(a._e))}</b> {a.personal || a.company ? a.title || who(a) : who(a)}</span>
                    <span className="ag-ov-track"><i style={{ left: ((a._s - b.start) / span) * 100 + '%', width: Math.max(4, ((a._e - a._s) / span) * 100) + '%', background: color(a) }} /></span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// RDV qui se chevauchent : côte à côte (comme Google Agenda) au lieu de se recouvrir
function lanes(list) {
  const ev = list.map((a) => ({ ...a, _s: +new Date(a.start_at), _e: +new Date(a.end_at) })).sort((a, b) => a._s - b._s || b._e - a._e);
  let group = [], ends = [], groupEnd = 0;
  const flush = () => { group.forEach((x) => { x._lanes = ends.length; }); group = []; ends = []; groupEnd = 0; };
  for (const a of ev) {
    if (group.length && a._s >= groupEnd) flush();
    let i = ends.findIndex((e) => e <= a._s);
    if (i < 0) { i = ends.length; ends.push(a._e); } else ends[i] = a._e;
    a._lane = i; group.push(a); groupEnd = Math.max(groupEnd, a._e);
  }
  flush();
  return ev;
}

function WeekGrid({ days, s, evs, busy, noFree, color, cm, onNew, onMove, compact, onDay }) {
  const [h0, h1] = s.hours; const H = 46;
  const todayKey = iso(new Date());
  const top = (d) => ((d.getHours() + d.getMinutes() / 60 - h0) * H);
  const drag = useRef(null);
  const [ghost, setGhost] = useState(null); // { id, day, start }
  // Glisser-déposer à la souris ou au doigt : pas de 15 min, d'un jour à l'autre
  const down = (e, a) => {
    if (!onMove || a.occurrence > 0 || (a.recurrence && a.recurrence !== 'none' && a.occurrence !== 0) || e.button > 0) return;
    const st = new Date(a.start_at);
    drag.current = { a, x: e.clientX, y: e.clientY, st, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const moveEv = (e) => {
    const g = drag.current; if (!g) return;
    const dy = e.clientY - g.y, dx = e.clientX - g.x;
    if (!g.moved && Math.hypot(dx, dy) < 6) return;
    g.moved = true;
    const col = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.dataset?.day);
    const day = col ? col.dataset.day : iso(g.st);
    const mins = Math.round(((g.st.getHours() * 60 + g.st.getMinutes()) + (dy / H) * 60) / 15) * 15;
    const start = new Date(day + 'T00:00:00'); start.setMinutes(Math.max(h0 * 60, Math.min((h1 * 60) - 15, mins)));
    g.start = start; setGhost({ id: g.a.id, day, start });
  };
  const up = (e) => {
    const g = drag.current; drag.current = null; setGhost(null);
    if (!g) return;
    if (!g.moved) { navigate('/pro/planning/rdv/' + g.a.id); return; }
    if (g.start) onMove(g.a, g.start);
  };
  return (
    <div className="cal" style={{ '--n': days.length, '--h': H + 'px' }}>
      <div {...(compact ? kbd : null)} className="cal-days"><div />{days.map((d) => <div key={d} className={iso(d) === todayKey ? 'today' : ''} onClick={compact ? () => onDay(d) : undefined} style={compact ? { cursor: 'pointer' } : undefined}>{d.toLocaleDateString(locale(), { weekday: 'short' }).replace('.', '')}<b>{d.getDate()}</b></div>)}</div>
      <div className="cal-body">
        <div className="cal-hours">{Array.from({ length: h1 - h0 }, (_, i) => <div key={i}>{h0 + i}h</div>)}</div>
        {days.map((d) => {
          const key = iso(d);
          const dayEv = lanes(evs.filter((a) => iso(new Date(a.start_at)) === key));
          const free = noFree || compact || busy.some((a) => a.company) ? [] : freeWindows(d, busy, s, 30);
          return (
            <div key={key} data-day={key} className={'cal-col' + (s.days.includes(d.getDay()) ? '' : ' off') + (ghost?.day === key ? ' drop' : '')} style={{ height: (h1 - h0) * H }}
              onDoubleClick={(e) => { if (e.target !== e.currentTarget) return; const y = e.nativeEvent.offsetY; const x = new Date(d); x.setHours(h0, 0, 0, 0); x.setMinutes(Math.floor((y / H) * 2) * 30); onNew(x); }}>
              {free.map(([a, b], i) => <button key={'f' + i} className="ev dispo" style={{ top: top(a), height: Math.max(18, top(b) - top(a) - 2) }} onClick={() => onNew(a)} title={t('Créneau libre')}>{t('Dispo')}</button>)}
              {dayEv.map((a) => {
                const st = new Date(a.start_at), en = new Date(a.end_at);
                // Dans un chantier partagé, on ne déplace que ses propres RDV
                const fixed = !onMove || (a.recurrence && a.recurrence !== 'none') || (a.company && !a.mine);
                return (
                  <button key={a.id + (a.occurrence || '')} className={'ev' + (compact && a._lanes > 1 ? ' slim' : '') + (compact ? ' compact' : '') + (a.status === 'a_valider' ? ' pending' : '') + (a.status === 'termine' ? ' done' : '') + (fixed ? '' : ' draggable') + (ghost?.id === a.id ? ' dragging' : '')} style={{ top: Math.max(0, top(st)), height: Math.max(22, top(en) - top(st) - 2), background: color(a), left: `calc(${(a._lane / a._lanes) * 100}% + 2px)`, width: `calc(${100 / a._lanes}% - 4px)`, right: 'auto' }}
                    onPointerDown={fixed || compact ? undefined : (e) => down(e, a)} onPointerMove={fixed ? undefined : moveEv} onPointerUp={fixed || compact ? undefined : up} onPointerCancel={() => { drag.current = null; setGhost(null); }}
                    onClick={compact ? () => onDay(new Date(a.start_at)) : fixed ? () => (!a.company || a.mine) && navigate('/pro/planning/rdv/' + a.id) : undefined} title={fixed ? undefined : t('Cliquez pour ouvrir, faites glisser pour déplacer')}>
                    <b>{hm(st)}{a.mode === 'visio' && ' 🎥'}</b>{a.company ? a.company : a.personal ? a.title : clientName(cm[a.client_id])}<br />{a.company ? (a.trades?.[0] ? t(a.trades[0]) : a.title) : !a.personal && a.title}
                  </button>
                );
              })}
              {ghost?.day === key && (() => { const a = evs.find((x) => x.id === ghost.id); const dur = new Date(a.end_at) - new Date(a.start_at); const en = new Date(+ghost.start + dur); return <div className="ev ghost" style={{ top: top(ghost.start), height: Math.max(22, top(en) - top(ghost.start) - 2) }}><b>{hm(ghost.start)} – {hm(en)}</b></div>; })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SearchResults({ list, loading, cm, color, q }) {
  if (loading) return <Loader />;
  if (!list.length) return <Empty text={t('Aucun rendez-vous pour « {q} »', { q })} />;
  const now = iso(new Date());
  const up = list.filter((a) => iso(new Date(a.start_at)) >= now).sort((a, b) => a.start_at.localeCompare(b.start_at));
  const past = list.filter((a) => iso(new Date(a.start_at)) < now);
  const row = (a) => (
    <button key={a.id} className="r" style={{ width: '100%', border: 0, background: 'transparent', color: 'inherit', textAlign: 'left' }} onClick={() => navigate('/pro/planning/rdv/' + a.id)}>
      <span className="row" style={{ gap: 10 }}><i style={{ width: 10, height: 34, borderRadius: 4, background: color(a), display: 'inline-block' }} />
        <span><b>{date(a.start_at)} · {hm(a.start_at)}–{hm(a.end_at)}</b><div className="small muted">{a.personal ? a.title : `${clientName(cm[a.client_id])} · ${a.title || t(a.type)}`}{a.address ? ' · ' + a.address : ''}</div></span></span>
      <StatusPill s={apptStatus(a.status)} />
    </button>
  );
  return (
    <>
      <Sec title={t('À venir')} meta={String(up.length)} />
      {up.length ? <div className="kv">{up.map(row)}</div> : <p className="small muted">{t('Aucun rendez-vous à venir')}</p>}
      <Sec title={t('Passés')} meta={String(past.length)} />
      {past.length ? <div className="kv">{past.slice(0, 50).map(row)}</div> : <p className="small muted">{t('Aucun rendez-vous passé')}</p>}
    </>
  );
}

function MonthGrid({ range, anchor, evs, color, cm, onDay, onMove }) {
  const [over, setOver] = useState(null);
  const days = Array.from({ length: 42 }, (_, i) => addDays(range[0], i));
  return (
    <div className="cal">
      <div className="cal-month">
        {days.slice(0, 7).map((d) => <div key={'h' + d} className="small bold center" style={{ padding: 6, borderBottom: '1px solid var(--line-2)' }}>{d.toLocaleDateString(locale(), { weekday: 'short' })}</div>)}
        {days.map((d) => {
          const k = iso(d); const list = evs.filter((a) => iso(new Date(a.start_at)) === k);
          return (
            <div {...kbd} key={k} className={'cell' + (d.getMonth() !== anchor.getMonth() ? ' out' : '') + (over === k ? ' drop' : '')} onClick={() => onDay(d)} style={{ cursor: 'pointer' }}
              onDragOver={onMove ? (e) => { e.preventDefault(); setOver(k); } : undefined} onDragLeave={() => setOver(null)}
              onDrop={onMove ? (e) => { e.preventDefault(); setOver(null); const a = evs.find((x) => x.id === e.dataTransfer.getData('text/plain')); if (!a) return; const o = new Date(a.start_at); const n = new Date(d); n.setHours(o.getHours(), o.getMinutes(), 0, 0); onMove(a, n); } : undefined}>
              <span className="n">{d.getDate()}</span>
              {list.slice(0, 3).map((a) => <button key={a.id + (a.occurrence || '')} draggable={!!onMove && (!a.recurrence || a.recurrence === 'none')} onDragStart={(e) => e.dataTransfer.setData('text/plain', a.id)} className="mini" style={{ background: a.status === 'a_valider' ? 'var(--bordeaux)' : color(a) }} onClick={(e) => { e.stopPropagation(); navigate('/pro/planning/rdv/' + a.id); }}>{hm(a.start_at)} {a.personal ? a.title : clientName(cm[a.client_id])}</button>)}
              {list.length > 3 && <span className="small faint">+{list.length - 3}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────── Détail d'un RDV ───────────────
