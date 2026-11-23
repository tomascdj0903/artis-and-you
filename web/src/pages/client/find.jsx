// Côté particulier : urgences, demande envoyée à plusieurs artisans, comparateur de devis.
import { useState } from 'react';
import { LuDroplets, LuZap, LuKeyRound, LuFlame, LuSquareSplitHorizontal, LuWrench, LuSiren, LuPlus, LuMapPin, LuVideo, LuCheck, LuShieldCheck, LuTriangleAlert } from 'react-icons/lu';
import { api, OFFLINE } from '../../lib/api.js';
import { ALL_TRADES } from '../../lib/docs.js';
import { LuCamera, LuSparkles } from 'react-icons/lu';
import { useApp } from '../../lib/store.jsx';
import { navigate, useLocation } from '../../lib/router.jsx';
import { t, locale } from '../../lib/i18n.js';
import { hm, money, date, iso, addDays } from '../../lib/format.js';
import { LuReceiptEuro } from 'react-icons/lu';
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
export function useNextFree(ids, minutes = 60, urgent = false) {
  const key = ids.slice(0, 80).join(',');
  const [rows] = useData(() => (key ? api.rpc('next_free', { p_ids: key.split(','), p_minutes: minutes, p_urgent: urgent }) : Promise.resolve([])), [key, minutes, urgent]);
  const map = {};
  (rows || []).forEach((r) => { map[r.company_id] = r; });
  return map;
}

// ─────────────── Demande avec photo ───────────────
// Le particulier prend son problème en photo (et/ou le décrit) : l'assistant propose le métier, puis on affiche les artisans
const KEYWORDS = [
  [/fuite|robinet|wc|toilette|chauffe-eau|ballon|évier|lavabo|canalisation|tuyau|radiateur|chaudière|douche/i, 'Plomberie et chauffage'],
  [/prise|interrupteur|disjonct|tableau électrique|courant|électri|lumière|ampoule|câble/i, 'Électricité'],
  [/serrure|porte claquée|clé|cylindre|verrou/i, 'Serrurerie'],
  [/fissure|mur|cloison|placo|plâtre|enduit/i, 'Plâtrerie'],
  [/peinture|repeindre|papier peint/i, 'Peinture'],
  [/toit|tuile|gouttière|toiture|ardoise/i, 'Couverture'],
  [/carrelage|faïence|joint/i, 'Carrelage'],
  [/fenêtre|volet|vitre|baie/i, 'Menuiserie'],
  [/clim|climatisation|pompe à chaleur|pac/i, 'Climatisation'],
];
const guessFromText = (text) => { const k = KEYWORDS.find(([re]) => re.test(text || '')); const trade = k && ALL_TRADES.find((x) => x.toLowerCase().startsWith(k[1].toLowerCase().slice(0, 8))); return trade || ''; };
async function photoData(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  return c.toDataURL('image/jpeg', 0.72);
}
export function PhotoRequest() {
  const [img, setImg] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [trade, setTrade] = useState('');
  const pick = async (capture) => { const [f] = await pickFiles({ accept: 'image/*', multiple: false, ...(capture ? { capture: 'environment' } : {}) }); if (!f) return; try { setImg(await photoData(f)); setRes(null); } catch { setImg(''); } };
  const analyse = async () => {
    setBusy(true); setRes(null);
    const local = guessFromText(text);
    const r = OFFLINE ? null : await api.fn('assistant', { mode: 'photo', image: img || undefined, text, trades: ALL_TRADES }).catch(() => null);
    const out = r && !r.error ? r : { trade: local, besoin: '', urgent: false, confidence: local ? 0.5 : 0, fallback: true };
    if (!out.trade && local) out.trade = local;
    setRes(out); setTrade(out.trade || ''); setBusy(false);
  };
  const emergency = res?.urgent && EMERGENCIES.find((e) => e[3] === trade);
  const go = () => { const q = new URLSearchParams({ metier: trade }); if (emergency) { q.set('urgence', '1'); q.set('besoin', emergency[0]); } try { sessionStorage.setItem('ay-photo-need', JSON.stringify({ text: [res?.besoin, text].filter(Boolean).join(' · '), img, at: Date.now() })); } catch {} navigate('/client/artisans?' + q.toString()); };
  return (
    <div className="content narrow">
      <TopBar title={t('Demande avec photo')} sub={t('On vous aide à trouver le bon artisan')} />
      <p className="small muted">{t('Prenez votre problème en photo ou décrivez-le : nous vous proposons le métier à contacter. Vous choisissez ensuite l’artisan.')}</p>
      <div className="photo-req">
        {img ? <img src={img} alt={t('Votre photo')} /> : <div className="ph"><LuCamera size={32} /></div>}
        <div className="two"><button className="btn ghost sm" onClick={() => pick(true)}><LuCamera /> {img ? t('Reprendre') : t('Prendre une photo')}</button><button className="btn ghost sm" onClick={() => pick(false)}>{t('Choisir une photo')}</button></div>
      </div>
      <Field label={t('Ce qui se passe')} hint={t('facultatif')}><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t('ex. De l’eau coule sous l’évier depuis ce matin')} /></Field>
      <button className="btn block" disabled={busy || (!img && !text.trim())} onClick={analyse}><LuSparkles /> {busy ? t('Analyse en cours…') : t('Trouver le bon métier')}</button>
      {res && <div className="card soft mt">
        {res.trade ? <><div className="small muted">{t('Métier proposé')}</div><b style={{ fontSize: 18 }}>{t(res.trade)}</b>{res.besoin && <p className="small">{res.besoin}</p>}</>
          : <p>{t('Nous n’avons pas pu deviner le métier. Choisissez-le ci-dessous.')}</p>}
        <Field label={t('Métier')}><select value={trade} onChange={(e) => setTrade(e.target.value)}><option value="">—</option>{ALL_TRADES.map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></Field>
        {emergency && <div className="notice red">{t('Cela ressemble à une urgence : nous afficherons d’abord les artisans qui interviennent en urgence.')}</div>}
        <p className="small faint">{res.fallback ? t('Suggestion faite à partir de votre texte.') : t('Suggestion automatique : vérifiez-la avant de contacter un artisan.')}</p>
        <button className="btn block" disabled={!trade} onClick={go}>{t('Voir les artisans')}</button>
      </div>}
    </div>
  );
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
  const free = useNextFree(ids, minutes, urgent);
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
              {hasTarifs(c.tarifs) && <TarifsBox tarifs={c.tarifs} compact />}
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

// Tarifs communiqués par l'artisan (fiche, demande de dépannage, demande urgente)
export const hasTarifs = (x) => !!x && (x.deplacement != null || x.horaire != null || (x.items || []).some((i) => i.label));
export function TarifsBox({ tarifs, urgent, compact }) {
  const x = tarifs || {};
  if (!hasTarifs(x)) return compact ? null : <p className="small faint">{t('Cet artisan n’a pas encore publié ses tarifs : demandez-les avant l’intervention.')}</p>;
  const rows = [
    x.deplacement != null && [t('Déplacement'), x.deplacement ? money(x.deplacement) : t('Offert')],
    x.horaire != null && [t('Main-d’œuvre'), t('{p} / h', { p: money(x.horaire) })],
    x.maj_nuit ? [t('Majoration de nuit'), '+ ' + x.maj_nuit + ' %'] : null,
    x.maj_we ? [t('Week-end et jours fériés'), '+ ' + x.maj_we + ' %'] : null,
    [t('Devis'), x.devis_gratuit === false ? t('Payant') : t('Gratuit')],
  ].filter(Boolean);
  const items = (x.items || []).filter((i) => i.label);
  if (compact) return <span className="small muted">{rows.slice(0, 2).map(([k, v]) => k + ' ' + v).join(' · ')}</span>;
  return (
    <div className={'tarifs' + (urgent ? ' urgent' : '')}>
      <div className="row small bold" style={{ gap: 6 }}><LuReceiptEuro /> {t('Tarifs de l’artisan (TTC)')}</div>
      <div className="tarifs-grid">{rows.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
      {items.length > 0 && <ul className="tarifs-items">{items.map((i, k) => <li key={k}><span>{i.label}</span><b>{i.price != null ? (i.from ? t('dès {p}', { p: money(i.price) }) : money(i.price)) : '—'}</b></li>)}</ul>}
      <p className="small faint" style={{ margin: '6px 0 0' }}>{t('Prix indicatifs communiqués par l’artisan. Le devis ou la note remise avant le paiement fait foi.')}</p>
    </div>
  );
}

// ─────────────── Simulateur d'aides : TVA réduite (+ orientation MaPrimeRénov') ───────────────
// Taux : CGI art. 278-0 bis A (5,5 % rénovation énergétique) et art. 279-0 bis (10 % amélioration, transformation, aménagement, entretien),
// logement d'habitation achevé depuis plus de 2 ans ; sinon 20 %.
export const WORKS = [
  ['energie', 'Rénovation énergétique', 'Isolation, pompe à chaleur, chauffage au bois ou solaire, VMC, régulation du chauffage…', 5.5],
  ['amelioration', 'Amélioration ou entretien', 'Plomberie, électricité, peinture, carrelage, salle de bain, cuisine posée, menuiseries hors isolation…', 10],
  ['neuf', 'Construction, extension ou gros œuvre', 'Logement neuf, agrandissement, surélévation, remise à neuf de la majorité du gros œuvre…', 20],
];
export function AidSimulator() {
  const { profile } = useApp();
  const yr = Number(profile.home?.year) || null;
  const [age, setAge] = useState(yr ? (new Date().getFullYear() - yr > 2 ? 'old' : 'new') : 'old');
  const [kind, setKind] = useState('energie');
  const [ht, setHt] = useState('');
  const [habit, setHabit] = useState(true);
  const amount = Number(String(ht).replace(/\s/g, '').replace(',', '.')) || 0;
  const w = WORKS.find((x) => x[0] === kind);
  const rate = age === 'old' && habit ? w[3] : 20;
  const tva = (amount * rate) / 100, normal = (amount * 20) / 100;
  return (
    <div className="content narrow">
      <TopBar title={t('Simulateur d’aides')} sub={t('TVA réduite et MaPrimeRénov’')} />
      <div className="notice"><span>{t('Estimation indicative, pour vous aider à préparer votre projet. Le taux de TVA appliqué est indiqué par l’artisan sur son devis.')}</span></div>
      <Sec title={t('Votre logement')} />
      <Chips options={[['old', t('Achevé depuis plus de 2 ans')], ['new', t('Moins de 2 ans')]]} value={age} onChange={setAge} />
      <label className="check mt"><input type="checkbox" checked={habit} onChange={(e) => setHabit(e.target.checked)} /> {t('Il sert d’habitation (ou le deviendra après les travaux)')}</label>
      <Sec title={t('Vos travaux')} />
      <div className="aid-works">{WORKS.map(([k, l, d]) => (
        <button key={k} className={'opt' + (kind === k ? ' red' : '')} style={{ marginTop: 0 }} onClick={() => setKind(k)}><div><b>{t(l)}</b><small>{t(d)}</small></div></button>
      ))}</div>
      <Field label={t('Montant hors taxes du devis (€ HT)')}><input inputMode="decimal" placeholder="10 000" value={ht} onChange={(e) => setHt(e.target.value)} /></Field>
      <div className="aid-result">
        <div><span>{t('Taux de TVA')}</span><b>{String(rate).replace('.', ',')} %</b></div>
        <div><span>{t('TVA')}</span><b>{money(tva)}</b></div>
        <div><span>{t('Total TTC')}</span><b>{money(amount + tva)}</b></div>
        <div className="save"><span>{t('Économie par rapport à 20 %')}</span><b>{money(normal - tva)}</b></div>
      </div>
      <ul className="small muted aid-cond">
        <li>{t('Le taux réduit ne s’applique qu’aux travaux et équipements fournis et facturés par l’entreprise : le matériel que vous achetez vous-même reste à 20 %.')}</li>
        <li>{t('Vous remettez à l’artisan une attestation indiquant que le logement a plus de 2 ans (mention sur le devis ou la facture pour les travaux courants).')}</li>
        {kind === 'energie' && <li>{t('Le taux de 5,5 % concerne des équipements et matériaux précis (performances minimales). L’artisan vous confirme l’éligibilité sur son devis.')}</li>}
      </ul>
      {kind === 'energie' && <>
        <Sec title={t('MaPrimeRénov’')} />
        <p>{t('Pour une pompe à chaleur, un chauffage au bois, l’isolation ou une rénovation globale, vous pouvez peut-être aussi obtenir MaPrimeRénov’. Le montant dépend de vos revenus, du logement et des travaux, et les règles changent régulièrement.')}</p>
        <ul className="small muted aid-cond">
          <li>{t('L’artisan doit en général être certifié RGE.')}</li>
          <li>{t('La demande doit être déposée avant le début des travaux.')}</li>
        </ul>
        <div className="row wrap" style={{ gap: 8 }}>
          <a className="btn" href="https://france-renov.gouv.fr/" target="_blank" rel="noopener noreferrer">{t('Simulation officielle France Rénov’')}</a>
          <button className="btn ghost" onClick={() => navigate('/client/artisans?q=RGE')}>{t('Trouver un artisan')}</button>
        </div>
      </>}
      <p className="small faint mt">{t('Sources : code général des impôts, articles 278-0 bis A (5,5 %) et 279-0 bis (10 %) ; economie.gouv.fr, « TVA à taux réduit : pour quels travaux ? ».')}</p>
    </div>
  );
}
