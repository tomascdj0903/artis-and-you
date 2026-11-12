// Planning : fiche d'un rendez-vous, création / modification, déplacement, « je suis en route »
import { useState } from 'react';
import { LuVideo, LuMapPin, LuSend, LuImage, LuNavigation } from 'react-icons/lu';
import { api } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate, useLocation, Link } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { clientName, dateShort, dateTime, hm, iso, fullName, date } from '../../lib/format.js';
import { apptStatus, APPT_TYPES } from '../../lib/docs.js';
import { TopBar, KV, Sec, Sheet, Field, Chips, Seg, useData, Loader, Empty, StatusPill, Img, Modal, Lightbox, Picker } from '../../ui/index.jsx';

import { planSettings } from './planning.jsx';

export function ApptDetail({ params }) {
  const { company, teams, run, confirm, profile } = useApp();
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
            [t('Équipe'), <select key="v" value={a.team_id || ''} onChange={(e) => run(() => api.update('appointments', { id: a.id }, { team_id: e.target.value || null }), t('Équipe mise à jour')).then(reload)} style={{ border: 0, background: 'transparent', fontWeight: 700, textAlign: 'right', color: 'inherit' }}>
              <option value="">—</option>{teams.map((x) => <option key={x.id} value={x.id}>● {x.name}</option>)}</select>],
            a.contact_name && [t('Contact sur place'), a.contact_name],
            phone && [t('Tél. mobile'), phone, { href: 'tel:' + phone }],
            doc && [t('Devis lié'), <Link key="v" to={'/pro/documents/' + doc.id}>{doc.number || t('Brouillon')}</Link>],
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
              <div className="two"><button className="btn ghost sm" onClick={() => setMoveOpen(true)}>{t('Déplacer le rendez-vous')}</button><button className="btn ghost-red sm" onClick={() => setStatus('annule', { title: t('Annuler ce rendez-vous ?'), text: t('Le client sera prévenu.'), ok: t('Annuler le RDV'), danger: true })}>{t('Annuler')}</button></div>
            </>}
            {!a.personal && a.client_id && <div className="two">
              <button className="btn ghost sm" onClick={() => navigate(`/pro/documents/nouveau?kind=devis&client=${a.client_id}&project=${a.project_id || ''}&appt=${a.id}`)}>{t('Créer un devis')}</button>
              <button className="btn ghost sm" onClick={() => navigate(`/pro/clients/${a.client_id}/chat`)}>{t('Écrire au client')}</button>
            </div>}
            <button className="btn ghost-red sm" onClick={() => navigate(`/pro/planning/rdv/${a.id}/modifier`)}>{t('Modifier')}</button>
          </div>
        </div>
      </div>
      <EnRoute open={enroute} a={a} c={c} onClose={() => setEnroute(false)} done={() => { setEnroute(false); reload(); goRoute(); }} skip={() => { setEnroute(false); goRoute(); }} />
      <MoveSheet open={moveOpen} a={a} settings={planSettings(company)} onClose={() => setMoveOpen(false)} onDone={async (start, end) => {
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

export function MoveSheet({ open, a, onClose, onDone, settings }) {
  const [d, setD] = useState(a ? iso(new Date(a.start_at)) : '');
  const [h, setH] = useState(a ? hm(a.start_at) : '09:00');
  const [busy] = useData(async () => (open && a?.company_id ? api.select('appointments', { company_id: a.company_id, status: ['valide', 'a_valider'] }).catch(() => []) : []), [open, d]);
  if (!open) return null;
  const dur = new Date(a.end_at) - new Date(a.start_at);
  // Heures proposées : toutes les 15 min sur la plage de travail ; celles qui chevauchent un autre RDV sont signalées
  const [h0, h1] = settings?.slot || [7, 20];
  const opts = [];
  for (let m = h0 * 60; m + dur / 6e4 <= h1 * 60; m += 15) opts.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
  if (!opts.includes(h)) opts.unshift(h);
  const taken = (hh) => { const st = new Date(d + 'T' + hh), en = new Date(+st + dur); return (busy || []).some((x) => x.id !== a.id && new Date(x.start_at) < en && new Date(x.end_at) > st); };
  return (
    <Sheet open onClose={onClose} title={t('Nouveau créneau')}>
      <div className="form-grid two">
        <Field label={t('Date')}><input type="date" value={d} onChange={(e) => setD(e.target.value)} /></Field>
        <Field label={t('Heure')}><select value={h} onChange={(e) => setH(e.target.value)}>{opts.map((x) => <option key={x} value={x}>{x}{taken(x) ? ' · ' + t('déjà occupé') : ''}</option>)}</select></Field>
      </div>
      <p className="small muted">{t('Durée conservée : {d}', { d: fmtDur(Math.round(dur / 6e4)) })} · {t('fin à {h}', { h: hm(new Date(+new Date(d + 'T' + h) + dur)) })}</p>
      <button className="btn block" onClick={() => { const st = new Date(d + 'T' + h); onDone(st, new Date(+st + dur)); }}>{t('Confirmer')}</button>
    </Sheet>
  );
}

// ─────────────── Création / modification ───────────────
export function ApptEdit({ params }) {
  const { company, teams, run, profile, toast } = useApp();
  const [orig, setOrig] = useState(null);
  const s = planSettings(company);
  const { query } = useLocation();
  const [a, setA] = useState(null);
  const [clients] = useData(() => api.select('clients', { company_id: company.id }, { order: 'last_name.asc' }), []);
  const [sharedP] = useData(() => api.rpc('shared_projects').catch(() => []), []);
  useData(async () => {
    if (params.id) { const x = await api.one('appointments', { id: params.id }); setA(x); setOrig(x); return; }
    const st = query.get('start') ? new Date(query.get('start')) : (() => { const x = new Date(); x.setDate(x.getDate() + 1); x.setHours(9, 0, 0, 0); return x; })();
    const cl = query.get('client') ? await api.one('clients', { id: query.get('client') }) : null;
    setA({ client_id: cl?.id || '', type: 'Chantier', title: '', start_at: st.toISOString(), end_at: new Date(+st + (s.durations.Chantier || s.duration) * 6e4).toISOString(), mode: 'site', status: 'valide', team_id: profile.team_id || teams[0]?.id || '', address: cl ? [cl.site_address, [cl.site_zip, cl.site_city].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '', contact_name: cl ? clientName(cl) : '', contact_phone: cl?.mobile || cl?.phone || '', recurrence: 'none', personal: false, notes: '', ...(query.get('project') ? { project_id: query.get('project') } : {}), ...(query.get('type') ? { type: query.get('type'), end_at: new Date(+st + (s.durations[query.get('type')] || s.duration) * 6e4).toISOString() } : {}) });
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
      if (params.id) {
        await api.update('appointments', { id: params.id }, row);
        if (row.client_id && orig && ['start_at', 'end_at', 'team_id', 'mode', 'address'].some((k) => (orig[k] || '') !== (row[k] || ''))) toast(t('Rendez-vous modifié, le client est prévenu'));
        navigate(-1);
      }
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
        {(sharedP || []).length > 0 && <Field label={t('Chantier en commun (facultatif)')}><select value={(sharedP || []).some((x) => x.id === a.project_id) ? a.project_id : ''} onChange={(e) => { const sp = sharedP.find((x) => x.id === e.target.value); setA({ ...a, project_id: e.target.value || null, ...(sp && !a.address ? { address: sp.address || '' } : {}), ...(sp && !a.title ? { title: sp.title } : {}) }); }}><option value="">—</option>{sharedP.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></Field>}
        {!a.personal && <Field label={t('Client')}><Picker options={clients.map((c) => [c.id, clientName(c), c.billing_city])} value={a.client_id || ''} onChange={pickClient} required={!(sharedP || []).some((x) => x.id === a.project_id)} /></Field>}
        {!a.personal && <Chips options={APPT_TYPES.map((x) => [x, t(x)])} value={a.type} onChange={(type) => setA({ ...a, type, ...(params.id ? {} : { end_at: new Date(+new Date(a.start_at) + (s.durations[type] || s.duration) * 6e4).toISOString() }) })} red />}
        {!a.personal && !params.id && <p className="small faint" style={{ marginTop: -6 }}>{t('Durée prévue pour « {t} » : {d} (modifiable dans les réglages du planning)', { t: t(a.type), d: fmtDur(s.durations[a.type] || s.duration) })}</p>}
        <Field label={t('Objet')}><input value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} placeholder={t('ex. Changement d’un chauffe-eau')} /></Field>
        <div className="form-grid three">
          <Field label={t('Date')}><input type="date" value={d} onChange={(e) => setTime(e.target.value, h1, h2)} required /></Field>
          <Field label={t('Début')}><input type="time" value={h1} step={900} onChange={(e) => setTime(d, e.target.value, h2)} required /></Field>
          <Field label={t('Fin')}><input type="time" value={h2} step={900} onChange={(e) => setTime(d, h1, e.target.value)} required /></Field>
        </div>
        <div className="small bold" style={{ margin: '4px 0 6px' }}>{t('Lieu du rendez-vous')}</div>
        <Seg options={[['site', t('Sur site')], ['visio', t('En visio (WhatsApp)')]]} value={a.mode} onChange={(mode) => setA({ ...a, mode })} />
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
export const DUR_OPTS = [15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480];
export const fmtDur = (m) => (m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) : '') + (m >= 480 ? ' (' + t('journée') + ')' : ''));
