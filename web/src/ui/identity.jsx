// Vérification d'identité : pièce du dirigeant (pros) et compte certifié (particuliers).
// La copie est envoyée dans un espace privé séparé, vue seulement par l'équipe, puis SUPPRIMÉE dès le contrôle.
// On garde uniquement : vérifiée ou non, la date, qui a vérifié (RGPD art. 5 et 25, référentiel CNIL).
import { useState } from 'react';
import { LuIdCard, LuShieldCheck, LuUpload, LuX, LuCheck, LuTrash2, LuClock } from 'react-icons/lu';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { t } from '../lib/i18n.js';
import { dateTime, rel } from '../lib/format.js';
import { Sheet, Field, useData, Empty, Loader } from './index.jsx';
import { LawRefs } from './lawref.jsx';

export const ID_DOCS = [['cni', 'Carte nationale d’identité'], ['passeport', 'Passeport'], ['titre_sejour', 'Titre de séjour'], ['permis', 'Permis de conduire (format carte)']];
const LAWS = ['rgpd-5', 'rgpd-25', 'cnil-identite', 'rgpd-13'];
const BUCKET = 'identity';

const safeName = (f) => f.name.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-40);

// Supprime la copie puis le note (appelé par la personne qui annule, ou par l'équipe après décision)
async function purge(id, path) {
  if (path) await api.removeFile(path, BUCKET).catch(() => {});
  await api.rpc('identity_file_deleted', { p_id: id }).catch(() => {});
}

export function useIdentity(purpose) {
  const { profile } = useApp();
  return useData(async () => (await api.select('identity_checks', { user_id: profile.id, purpose }, { order: 'created_at.desc', limit: 1 }))[0] || null, [profile?.id, purpose]);
}

// Carte d'état + envoi de la pièce
export function IdentityCard({ purpose = 'client', title }) {
  const { profile, run } = useApp();
  const [last, reload, loading] = useIdentity(purpose);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ doc: 'cni', holder: [profile.first_name, profile.last_name].filter(Boolean).join(' '), file: null, ok: false });
  if (loading && last === null) return <Loader />;
  const st = last?.status;
  const send = () => run(async () => {
    const path = `${profile.id}/${Date.now().toString(36)}-${safeName(f.file)}`;
    await api.upload(path, f.file, BUCKET);
    try { await api.rpc('identity_submit', { p_purpose: purpose, p_doc_type: f.doc, p_path: path, p_holder: f.holder.trim() }); }
    catch (e) { await api.removeFile(path, BUCKET).catch(() => {}); throw e; }
    setOpen(false); setF({ ...f, file: null, ok: false }); reload();
  }, t('Pièce envoyée : elle sera vérifiée sous 48 h ouvrées'));
  const cancel = () => run(async () => { const p = await api.rpc('identity_cancel', { p_id: last.id }); await purge(last.id, p); reload(); }, t('Demande annulée, la copie est supprimée'));
  return (
    <div className="card soft">
      <div className="row" style={{ gap: 8 }}><LuIdCard /><b>{title || (purpose === 'dirigeant' ? t('Identité du dirigeant') : t('Compte certifié'))}</b></div>
      {st === 'verifie' ? <p className="small green-t" style={{ margin: '6px 0 0' }}><LuShieldCheck size={13} /> {t('Identité vérifiée le {d}. La copie de la pièce a été supprimée.', { d: dateTime(last.reviewed_at) })}</p>
        : st === 'en_attente' ? <>
          <p className="small" style={{ margin: '6px 0' }}><LuClock size={13} /> {t('Pièce reçue {r}, vérification en cours (48 h ouvrées). Elle sera supprimée dès le contrôle fait.', { r: rel(last.created_at) })}</p>
          <button className="btn ghost sm" onClick={cancel}><LuX /> {t('Annuler et supprimer la copie')}</button>
        </> : <>
          {st === 'refuse' && <div className="notice small mt">{t('Pièce refusée : {n}', { n: last.note })}</div>}
          <p className="small muted" style={{ margin: '6px 0' }}>{purpose === 'dirigeant'
            ? t('Obligatoire pour valider votre entreprise : elle garantit aux clients que le compte appartient bien au dirigeant inscrit au registre.')
            : t('Facultatif. Les artisans voient un badge « Compte certifié » sur votre fiche : ils savent que vous êtes bien la personne indiquée.')}</p>
          <button className="btn sm" onClick={() => setOpen(true)}><LuUpload /> {t('Envoyer ma pièce d’identité')}</button>
        </>}
      <Sheet open={open} onClose={() => setOpen(false)} title={t('Vérification d’identité')}>
        <Field label={t('Document')}><select value={f.doc} onChange={(e) => setF({ ...f, doc: e.target.value })}>{ID_DOCS.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select></Field>
        <Field label={t('Nom et prénom tels qu’ils figurent sur la pièce')}><input value={f.holder} onChange={(e) => setF({ ...f, holder: e.target.value })} autoComplete="name" /></Field>
        <Field label={t('Photo ou scan (recto, et verso pour une carte)')} hint={t('JPG, PNG ou PDF, 10 Mo max.')}><input type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => setF({ ...f, file: e.target.files?.[0] || null })} /></Field>
        <div className="card soft small" style={{ lineHeight: 1.55 }}>
          <b>{t('Ce que nous faisons de votre pièce')}</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            <li>{t('Elle est rangée dans un espace privé, séparé de vos autres fichiers, visible seulement par l’équipe de vérification.')}</li>
            <li>{t('Nous vérifions que le nom correspond à votre compte{x}, puis nous la supprimons définitivement.', { x: purpose === 'dirigeant' ? t(' et au dirigeant inscrit au registre des entreprises') : '' })}</li>
            <li>{t('Nous gardons seulement : « identité vérifiée », la date et qui a vérifié. Ni copie, ni numéro de la pièce.')}</li>
            <li>{t('Vous pouvez masquer votre numéro de document et votre photo n’est pas utilisée.')}</li>
          </ul>
          <LawRefs ids={LAWS} title={t('Pourquoi nous ne conservons pas la pièce')} />
        </div>
        <label className="check mt"><input type="checkbox" checked={f.ok} onChange={(e) => setF({ ...f, ok: e.target.checked })} /><span className="small">{t('J’envoie ma propre pièce d’identité, en cours de validité.')}</span></label>
        <button className="btn block mt" disabled={!f.file || !f.ok || f.holder.trim().length < 3 || f.file.size > 10485760} onClick={send}><LuUpload /> {t('Envoyer pour vérification')}</button>
      </Sheet>
    </div>
  );
}

// Équipe Artesa : contrôle puis suppression immédiate de la copie
const REFUSE = ['Pièce illisible ou incomplète', 'Pièce expirée', 'Le nom ne correspond pas au compte', 'Le nom ne correspond pas au dirigeant inscrit', 'Document non accepté'];
export function AdminIdentities({ list, leftovers = [], reload }) {
  const { run } = useApp();
  const [cur, setCur] = useState(null);
  const open = (r) => run(async () => { const u = await api.signedUrls([r.file_path], BUCKET, 300); setCur({ r, url: u[r.file_path], note: '' }); });
  const decide = (status) => run(async () => {
    const path = await api.rpc('admin_identity_review', { p_id: cur.r.id, p_status: status, p_note: cur.note.trim() });
    await purge(cur.r.id, path); setCur(null); reload();
  }, status === 'verifie' ? t('Identité vérifiée, copie supprimée') : t('Refusée, copie supprimée'));
  return (
    <>
      {leftovers.length > 0 && <div className="notice mb">{t('{n} copie(s) de pièce d’identité déjà traitée(s) restent à supprimer.', { n: leftovers.length })} <button className="link bold" onClick={() => run(async () => { for (const r of leftovers) await purge(r.id, r.file_path); reload(); }, t('Copies supprimées'))}><LuTrash2 size={13} /> {t('Supprimer maintenant')}</button></div>}
      {!list.length ? <Empty text={t('Aucune pièce d’identité en attente')} /> : list.map((r) => (
        <div key={r.id} className="card soft mb row between wrap">
          <div><b>{r.holder_name}</b><div className="small muted">{r.purpose === 'dirigeant' ? t('Dirigeant') + (r.company_name ? ' · ' + r.company_name : '') : t('Particulier')} · {t(ID_DOCS.find((d) => d[0] === r.doc_type)?.[1] || r.doc_type)} · {rel(r.created_at)}</div></div>
          <button className="btn xs" onClick={() => open(r)}>{t('Contrôler')}</button>
        </div>
      ))}
      <Sheet open={!!cur} onClose={() => setCur(null)} title={t('Contrôle d’identité')}>
        {cur && <>
          <p className="small"><b>{t('Nom déclaré')} :</b> {cur.r.holder_name}{cur.r.company_name ? <> · <b>{t('Entreprise')} :</b> {cur.r.company_name} (SIREN {cur.r.siren || '—'})</> : ''}</p>
          {cur.r.purpose === 'dirigeant' && cur.r.siren && <p className="small"><a href={`https://annuaire-entreprises.data.gouv.fr/dirigeants/${cur.r.siren}`} target="_blank" rel="noopener noreferrer">{t('Voir les dirigeants inscrits (Annuaire des entreprises)')}</a></p>}
          {cur.url ? (/\.pdf$/i.test(cur.r.file_path) ? <iframe title="pièce" src={cur.url} style={{ width: '100%', height: 420, border: 0 }} /> : <img src={cur.url} alt="" style={{ width: '100%', borderRadius: 10 }} />) : <p className="small muted">{t('Fichier introuvable.')}</p>}
          <p className="small faint">{t('La copie sera supprimée automatiquement dès votre décision. Ne la téléchargez pas.')}</p>
          <div className="chips wrap mt" style={{ gap: 6 }}>{REFUSE.map((x) => <button key={x} type="button" className="chip" onClick={() => setCur({ ...cur, note: t(x) })}>{t(x)}</button>)}</div>
          <Field label={t('Motif en cas de refus')}><textarea value={cur.note} onChange={(e) => setCur({ ...cur, note: e.target.value })} /></Field>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => decide('verifie')}><LuCheck /> {t('Identité vérifiée')}</button>
            <button className="btn ghost" disabled={!cur.note.trim()} onClick={() => decide('refuse')}><LuX /> {t('Refuser')}</button>
          </div>
        </>}
      </Sheet>
    </>
  );
}
