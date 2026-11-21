// Côté particulier : urgences, demande envoyée à plusieurs artisans, comparateur de devis.
import { useState } from 'react';
import { LuDroplets, LuZap, LuKeyRound, LuFlame, LuSquareSplitHorizontal, LuWrench, LuPhone, LuSiren, LuPlus, LuMapPin, LuVideo, LuCheck, LuShieldCheck, LuTriangleAlert } from 'react-icons/lu';
import { api } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate, useLocation } from '../../lib/router.jsx';
import { t, locale } from '../../lib/i18n.js';
import { hm, money, date, iso, addDays } from '../../lib/format.js';
import { effectiveStatus } from '../../lib/docs.js';
import { TopBar, Sec, Chips, Field, useData, Loader, Empty, Avatar, Pill, Stars, pickFiles } from '../../ui/index.jsx';
import { uploadTo } from '../common/chat.jsx';
import { kbd } from '../../lib/a11y.js';
import { loadMine, coName } from './main.jsx';

// « Dispo aujourd'hui à 14 h 30 », « Dispo demain à 8 h », « Dispo jeu. 26 nov. »
export function dispoLabel(d) {
  if (!d) return '';
  const x = new Date(d), today = iso(new Date()), tomorrow = iso(addDays(new Date(), 1));
  if (iso(x) === today) return t('Dispo aujourd’hui à {h}', { h: hm(x) });
  if (iso(x) === tomorrow) return t('Dispo demain à {h}', { h: hm(x) });
  return t('Dispo {d}', { d: x.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' }) });
}
export const soonDays = (d) => (d ? (new Date(d) - Date.now()) / 864e5 : 99);

// Premier créneau libre de chaque artisan de la liste (une seule requête)
export function useNextFree(ids, minutes = 60) {
  const key = ids.slice(0, 80).join(',');
  const [rows] = useData(() => (key ? api.rpc('next_free', { p_ids: key.split(','), p_minutes: minutes }) : Promise.resolve([])), [key, minutes]);
  const map = {};
  (rows || []).forEach((r) => { map[r.company_id] = r; });
  return map;
}

// ─────────────── Urgence ───────────────
export const EMERGENCIES = [
  ['fuite', LuDroplets, 'Fuite d’eau', 'Plomberie et chauffage'],
  ['elec', LuZap, 'Panne électrique', 'Électricité'],
  ['serrure', LuKeyRound, 'Porte claquée ou serrure bloquée', 'Serrurerie'],
  ['chauffage', LuFlame, 'Plus de chauffage ou d’eau chaude', 'Plomberie et chauffage'],
  ['vitre', LuSquareSplitHorizontal, 'Vitre cassée', 'Vitrerie'],
  ['autre', LuWrench, 'Autre urgence', ''],
];
export function Urgence() {
  return (
    <div className="content narrow">
      <TopBar title={t('Urgence')} sub={t('Un artisan disponible au plus vite')} />
      <div className="notice"><LuSiren /><span>{t('Choisissez votre problème : nous affichons les artisans qui acceptent les urgences et interviennent chez vous, du plus tôt disponible au plus tard.')}</span></div>
      <div className="urg-grid">
        {EMERGENCIES.map(([k, I, label, trade]) => (
          <button key={k} className="urg-tile" onClick={() => navigate('/client/artisans?urgence=1&besoin=' + k + (trade ? '&metier=' + encodeURIComponent(trade) : ''))}>
            <I /><b>{t(label)}</b>
          </button>
        ))}
      </div>
      <div className="notice mt"><LuTriangleAlert /><span>{t('Danger immédiat (odeur de gaz, incendie, personne blessée) : appelez d’abord le 112 ou, pour le gaz, le numéro d’urgence de votre fournisseur.')}</span></div>
    </div>
  );
}

// ─────────────── Demande envoyée à plusieurs artisans ───────────────
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16)));
export function GroupRequest() {
  const { profile, setProfile, run } = useApp();
  const { query } = useLocation();
  const ids = (query.get('ids') || '').split(',').filter(Boolean).slice(0, 3);
  const urgent = query.get('urgence') === '1';
  const [type, setType] = useState(urgent ? 'Dépannage' : 'Devis');
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState([]);
  const [mode, setMode] = useState('site');
  const [home, setHome] = useState({ address: '', zip: '', city: '', ...(profile.home || {}) });
  const [busy, setBusy] = useState(false);
  const minutes = mode === 'visio' ? 30 : type === 'Dépannage' ? 90 : 60;
  const [cos] = useData(() => Promise.all(ids.map((id) => api.rpc('directory_get', { p_id: id }))), [ids.join(',')]);
  const free = useNextFree(ids, minutes);
  if (!ids.length) return <div className="content"><TopBar title={t('Demande à plusieurs artisans')} /><Empty text={t('Choisissez d’abord 2 ou 3 artisans dans la recherche.')}><button className="btn sm" onClick={() => navigate('/client/artisans')}>{t('Trouver un artisan')}</button></Empty></div>;
  if (!cos) return <div className="content"><TopBar title={t('Demande à plusieurs artisans')} /><Loader /></div>;
  const list = cos.filter(Boolean);
  const ready = list.filter((c) => free[c.id]?.next_at);
  const addPhotos = async () => { const fs = await pickFiles({ accept: 'image/*,video/*' }); setPhotos([...photos, ...fs].slice(0, 8)); };
  const send = async () => {
    if (text.trim().length < 10) return run(async () => { throw new Error(t('Décrivez votre besoin en quelques mots.')); });
    if (mode === 'site' && (!home.address || !home.city)) return run(async () => { throw new Error(t('Indiquez votre adresse pour une intervention sur place.')); });
    if (!ready.length) return run(async () => { throw new Error(t('Aucun de ces artisans n’a de créneau libre dans les 14 prochains jours : écrivez-leur directement.')); });
    setBusy(true);
    try {
      await run(async () => {
        if (JSON.stringify(home) !== JSON.stringify(profile.home || {})) { await api.update('profiles', { id: profile.id }, { home }); setProfile({ ...profile, home }); }
        const ups = [];
        for (const f of photos) ups.push(await uploadTo('u/' + profile.id + '/demandes', f));
        const group = uuid();
        const title = t(type) + ' · ' + text.trim().split(/[.\n?!]/)[0].slice(0, 60);
        for (const c of ready) {
          const st = new Date(free[c.id].next_at);
          await api.rpc('request_appointment', { p: { company_id: c.id, type, title, text: text.trim(), mode, start_at: st.toISOString(), end_at: new Date(+st + minutes * 6e4).toISOString(), photos: ups, group, group_size: ready.length, urgent } });
        }
        navigate('/client/rdv', { replace: true });
      }, ready.length > 1 ? t('Demande envoyée à {n} artisans', { n: ready.length }) : t('Demande envoyée'));
    } finally { setBusy(false); }
  };
  return (
    <div className="content narrow">
      <TopBar title={urgent ? t('Demande urgente') : t('Demande à plusieurs artisans')} sub={t('{n} artisans choisis', { n: list.length })} />
      <div className="grouplist">
        {list.map((c) => (
          <div key={c.id} className="li">
            <Avatar name={coName(c).split(' ')[0]} last={coName(c).split(' ')[1]} path={c.logo_path} />
            <div className="grow"><div className="t1">{coName(c)}</div>
              <div className="t2">{free[c.id] === undefined ? '…' : free[c.id]?.next_at ? t('Premier créneau libre : {d}', { d: new Date(free[c.id].next_at).toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }) : t('Pas de créneau libre sous 14 jours : il ne recevra pas cette demande')}</div></div>
            {free[c.id]?.next_at ? <LuCheck className="green-t" /> : null}
          </div>
        ))}
      </div>
      <p className="small muted">{t('Chaque artisan reçoit votre demande sur son premier créneau libre. Il peut l’accepter ou vous en proposer un autre. Vous comparez ensuite leurs réponses et leurs devis.')}</p>
      <Chips options={[['Devis', t('Devis')], ['Diagnostic', t('Diagnostic')], ['Dépannage', t('Dépannage')]]} value={type} onChange={setType} />
      <Sec title={t('Votre besoin')} />
      <textarea className="input" style={{ minHeight: 130, borderColor: 'var(--bordeaux)' }} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Décrivez le problème : depuis quand, où, ce que vous avez déjà fait…')} />
      <Sec title={t('Photos ou vidéo')} meta={String(photos.length)} />
      <div className="photos-grid">
        {photos.map((f, i) => <img {...kbd} aria-label={t('Retirer')} key={i} src={URL.createObjectURL(f)} alt="" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} />)}
        <button className="ph" style={{ border: '2px dashed var(--bordeaux)', color: 'var(--bordeaux)', fontSize: 28 }} onClick={addPhotos} aria-label={t('Ajouter des photos')}><LuPlus /></button>
      </div>
      <Sec title={t('Type de rendez-vous')} />
      <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr', display: 'grid' }}>
        <button className={'opt' + (mode === 'site' ? ' red' : '')} style={{ marginTop: 0 }} onClick={() => setMode('site')}><LuMapPin /><div><b>{t('Sur place')}</b><small>{t('À votre domicile')}</small></div></button>
        {!urgent && <button className={'opt' + (mode === 'visio' ? ' red' : '')} style={{ marginTop: 0 }} onClick={() => setMode('visio')}><LuVideo /><div><b>{t('En visio')}</b><small>{t('Diagnostic à distance')}</small></div></button>}
      </div>
      {mode === 'site' && <div className="form-grid three mt"><Field label={t('Adresse')}><input value={home.address} onChange={(e) => setHome({ ...home, address: e.target.value })} /></Field><Field label={t('Code postal')}><input value={home.zip} onChange={(e) => setHome({ ...home, zip: e.target.value })} /></Field><Field label={t('Ville')}><input value={home.city} onChange={(e) => setHome({ ...home, city: e.target.value })} /></Field></div>}
      <div className="btns"><button className="btn" onClick={send} disabled={busy}>{busy ? '…' : ready.length > 1 ? t('Envoyer à {n} artisans', { n: ready.length }) : t('Envoyer la demande')}</button></div>
    </div>
  );
}

// ─────────────── Comparateur de devis ───────────────
export function CompareQuotes() {
  const { query } = useLocation();
  const want = (query.get('ids') || '').split(',').filter(Boolean);
  const [b] = useData(async () => {
    const m = await loadMine();
    const docs = m.cids.length ? await api.select('documents', { client_id: m.cids, kind: 'devis' }, { order: 'issue_date.desc' }) : [];
    const cos = await Promise.all([...new Set(docs.map((d) => d.company_id))].map((id) => api.rpc('directory_get', { p_id: id }).catch(() => null)));
    return { ...m, docs: docs.filter((d) => d.number), info: Object.fromEntries(cos.filter(Boolean).map((c) => [c.id, c])) };
  }, []);
  const [pick, setPick] = useState(null);
  if (!b) return <div className="content"><TopBar title={t('Comparer mes devis')} /><Loader /></div>;
  const open = b.docs.filter((d) => effectiveStatus(d) === 'envoye' || want.includes(d.id));
  const sel = (pick || (want.length ? want : open.slice(0, 3).map((d) => d.id))).filter((id) => b.docs.some((d) => d.id === id)).slice(0, 3);
  const docs = sel.map((id) => b.docs.find((d) => d.id === id));
  const toggle = (id) => setPick(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id].slice(-3));
  const ttc = (d) => Number(d.totals?.ttc || 0);
  const best = docs.length > 1 ? Math.min(...docs.map(ttc)) : null;
  const until = (d) => (d.validity_days && d.issue_date ? addDays(new Date(d.issue_date), d.validity_days) : null);
  const items = (d) => (d.lines || []).filter((l) => l.kind === 'item' && l.label);
  const rows = [
    [t('Total TTC'), (d) => <b className={ttc(d) === best ? 'green-t' : ''}>{money(ttc(d))}{ttc(d) === best && <small className="block">{t('Le moins cher')}</small>}</b>],
    [t('Total HT'), (d) => money(d.totals?.ht)],
    [t('TVA'), (d) => money(d.totals?.tva)],
    [t('Écart avec le moins cher'), (d) => (best == null || ttc(d) === best ? '—' : '+ ' + money(ttc(d) - best) + ' (' + Math.round(((ttc(d) - best) / best) * 100) + ' %)')],
    [t('Acompte demandé'), (d) => (d.deposit_pct ? d.deposit_pct + ' % · ' + money((ttc(d) * d.deposit_pct) / 100) : t('Aucun'))],
    [t('Début des travaux'), (d) => (d.start_date ? date(d.start_date) : '—')],
    [t('Durée estimée'), (d) => d.duration || '—'],
    [t('Valable jusqu’au'), (d) => (until(d) ? date(until(d)) : '—')],
    [t('Lignes du devis'), (d) => <ul className="cmp-lines">{items(d).slice(0, 8).map((l, i) => <li key={i}>{l.label}</li>)}{items(d).length > 8 && <li className="faint">{t('+ {n} autres', { n: items(d).length - 8 })}</li>}</ul>],
    [t('Note des clients'), (d) => { const c = b.info[d.company_id]; return c?.rating ? <span><Stars n={c.rating} /> {String(c.rating).replace('.', ',')}</span> : <span className="faint">{t('Pas encore d’avis')}</span>; }],
    [t('Assurance décennale'), (d) => b.info[d.company_id]?.profile?.insurer || <span className="faint">{t('Non affichée')}</span>],
    [t('Profil vérifié'), (d) => (b.info[d.company_id]?.verified ? <Pill c="green"><LuShieldCheck /> {t('Oui')}</Pill> : '—')],
  ];
  return (
    <div className="content">
      <TopBar title={t('Comparer mes devis')} sub={t('Jusqu’à 3 devis côte à côte')} />
      {open.length < 2 ? <Empty text={t('Il faut au moins 2 devis reçus pour les comparer.')}><button className="btn sm" onClick={() => navigate('/client/artisans')}>{t('Demander d’autres devis')}</button></Empty> : (
        <>
          <div className="chips scroll">{open.map((d) => <button key={d.id} className={'chip' + (sel.includes(d.id) ? ' on' : '')} onClick={() => toggle(d.id)}>{sel.includes(d.id) && <LuCheck />} {coName(b.cm[d.company_id]) || d.number} · {money(ttc(d))}</button>)}</div>
          {docs.length < 2 ? <Empty text={t('Choisissez au moins 2 devis.')} /> : (
            <div className="cmp-wrap">
              <table className="cmp">
                <thead><tr><th />{docs.map((d) => <th key={d.id}><div className="bold">{coName(b.cm[d.company_id])}</div><div className="small muted">{d.number} · {d.object || ''}</div></th>)}</tr></thead>
                <tbody>
                  {rows.map(([label, f]) => <tr key={label}><th scope="row">{label}</th>{docs.map((d) => <td key={d.id}>{f(d)}</td>)}</tr>)}
                  <tr><th />{docs.map((d) => <td key={d.id}><button className="btn sm block" onClick={() => navigate('/client/devis/' + d.id)}>{effectiveStatus(d) === 'envoye' ? t('Voir et signer') : t('Voir le devis')}</button></td>)}</tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="small faint mt">{t('Comparez aussi ce qui est inclus : un prix plus bas peut correspondre à moins de prestations. Artis & You ne recommande aucun artisan en particulier.')}</p>
        </>
      )}
    </div>
  );
}
