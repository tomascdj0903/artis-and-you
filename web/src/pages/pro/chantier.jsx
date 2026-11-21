// Suivi de chantier en photos : l'artisan publie les étapes, le client les valide ou demande une reprise
import { useState } from 'react';
import { LuCamera, LuCheck, LuRotateCcw, LuClock } from 'react-icons/lu';
import { api } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { dateTime, clientName } from '../../lib/format.js';
import { TopBar, Sec, Field, useData, Loader, Empty, Pill, Img, Lightbox, pickFiles } from '../../ui/index.jsx';
import { uploadTo } from '../common/chat.jsx';

export const STEP_STATUS = { envoye: ['yellow', 'À valider par le client'], valide: ['green', 'Validée'], a_revoir: ['red', 'Reprise demandée'] };

export function StepCard({ s, onBig, actions }) {
  const [c, l] = STEP_STATUS[s.status] || STEP_STATUS.envoye;
  return (
    <div className={'card step-card ' + s.status}>
      <div className="row between"><b>{s.title}</b><Pill c={c}>{t(l)}</Pill></div>
      <div className="small faint"><LuClock /> {dateTime(s.created_at)}</div>
      {s.note && <p className="wsb" style={{ margin: '6px 0' }}>{s.note}</p>}
      {(s.photos || []).length > 0 && <div className="photos-grid sm">{s.photos.map((ph) => <Img key={ph} path={ph} onClick={() => onBig(ph)} />)}</div>}
      {s.client_comment && <div className="notice small"><b>{t('Commentaire du client')} :</b> {s.client_comment}</div>}
      {actions}
    </div>
  );
}

export function ProjectSteps({ params }) {
  const { company, run } = useApp();
  const [big, setBig] = useState(null);
  const [b, reload] = useData(async () => {
    const [[p], steps] = await Promise.all([api.select('projects', { id: params.id }), api.select('project_steps', { project_id: params.id }, { order: 'created_at.desc' })]);
    const [c] = p?.client_id ? await api.select('clients', { id: p.client_id }) : [null];
    return { p, c, steps };
  }, [params.id]);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  if (!b) return <div className="content"><TopBar title={t('Suivi de chantier')} /><Loader /></div>;
  if (!b.p) return <div className="content"><TopBar title={t('Suivi de chantier')} /><Empty text={t('Chantier introuvable')} /></div>;
  const send = async () => {
    setBusy(true);
    try {
      await run(async () => {
        const ups = [];
        for (const f of photos) ups.push((await uploadTo(company.id + '/chantier/' + b.p.id, f)).path);
        await api.rpc('add_project_step', { p_project: b.p.id, p_title: title, p_note: note, p_photos: ups });
      }, b.c?.user_id ? t('Étape envoyée au client') : t('Étape enregistrée'));
      setTitle(''); setNote(''); setPhotos([]); reload();
    } catch {} finally { setBusy(false); }
  };
  return (
    <div className="content narrow">
      <TopBar title={t('Suivi de chantier')} sub={[b.p.title, b.c && clientName(b.c)].filter(Boolean).join(' · ')} />
      {!b.c?.user_id && <div className="notice small">{t('Ce client n’a pas encore de compte Artis & You : il verra les étapes dès qu’il en créera un avec son e-mail.')}</div>}
      <Sec title={t('Nouvelle étape')} />
      <Field label={t('Étape')}><input placeholder={t('ex. Dépose de l’ancienne baignoire')} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></Field>
      <Field label={t('Commentaire (facultatif)')}><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Ce qui a été fait, ce qui reste à faire…')} /></Field>
      <div className="photos-grid">
        {photos.map((f, i) => <img key={i} src={URL.createObjectURL(f)} alt="" role="button" tabIndex={0} aria-label={t('Retirer')} onClick={() => setPhotos(photos.filter((_, j) => j !== i))} />)}
        {photos.length < 12 && <button className="ph" style={{ border: '2px dashed var(--bordeaux)', color: 'var(--bordeaux)' }} onClick={async () => { const fs = await pickFiles({ accept: 'image/*', capture: 'environment' }); setPhotos([...photos, ...fs].slice(0, 12)); }} aria-label={t('Ajouter des photos')}><LuCamera size={26} /></button>}
      </div>
      <div className="btns"><button className="btn" disabled={busy || !title.trim()} onClick={send}>{busy ? '…' : t('Envoyer l’étape au client')}</button></div>
      <Sec title={t('Étapes publiées')} meta={String(b.steps.length)} />
      {!b.steps.length ? <Empty icon={LuCamera} text={t('Publiez chaque étape avec des photos : le client suit l’avancement et valide au fur et à mesure.')} /> : b.steps.map((s) => <StepCard key={s.id} s={s} onBig={setBig} />)}
      <div className="btns"><button className="btn ghost" onClick={() => navigate('/pro/clients/' + b.p.client_id)}>{t('Fiche client')}</button></div>
      <Lightbox path={big} onClose={() => setBig(null)} />
    </div>
  );
}

// Côté client : étapes du chantier à valider
export function ClientSteps({ projectId }) {
  const { run } = useApp();
  const [big, setBig] = useState(null);
  const [steps, reload] = useData(() => api.select('project_steps', { project_id: projectId }, { order: 'created_at.desc' }).catch(() => []), [projectId]);
  const [redo, setRedo] = useState(null);
  if (!steps?.length) return null;
  const decide = (s, ok, comment = '') => run(async () => { await api.rpc('decide_project_step', { p_id: s.id, p_ok: ok, p_comment: comment }); setRedo(null); reload(); }, ok ? t('Étape validée') : t('Demande de reprise envoyée'));
  return (
    <>
      <Sec title={t('Étapes en photos')} meta={t('{n} à valider', { n: steps.filter((s) => s.status === 'envoye').length })} />
      {steps.map((s) => <StepCard key={s.id} s={s} onBig={setBig} actions={s.status === 'envoye' && (
        redo?.id === s.id ? <div className="mt"><textarea className="input" placeholder={t('Qu’est-ce qui doit être repris ?')} value={redo.text} onChange={(e) => setRedo({ ...redo, text: e.target.value })} />
          <div className="row mt" style={{ gap: 6 }}><button className="btn ghost sm" onClick={() => setRedo(null)}>{t('Annuler')}</button><button className="btn sm" onClick={() => decide(s, false, redo.text)}>{t('Envoyer')}</button></div></div>
          : <div className="row mt" style={{ gap: 6 }}><button className="btn sm" onClick={() => decide(s, true)}><LuCheck /> {t('Valider l’étape')}</button><button className="btn ghost sm" onClick={() => setRedo({ id: s.id, text: '' })}><LuRotateCcw /> {t('Demander une reprise')}</button></div>
      )} />)}
      <Lightbox path={big} onClose={() => setBig(null)} />
    </>
  );
}
