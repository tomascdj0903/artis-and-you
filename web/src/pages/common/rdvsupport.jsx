// Rendez-vous avec Artis & You depuis le service client : Artis & You propose des créneaux, la personne choisit et dit où la joindre
// (ou l'inverse : la personne demande un RDV, l'équipe confirme). Le RDV confirmé va dans l'agenda d'Artis & You,
// dans « Mes RDV » du particulier ou dans le planning du pro (fonction serveur support_rdv_book).
import { useState } from 'react';
import { LuPhone, LuVideo, LuCalendarCheck, LuCircleCheck, LuPlus, LuX } from 'react-icons/lu';
import { FaWhatsapp } from 'react-icons/fa6';
import { api } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { dateLong, hm } from '../../lib/format.js';
import { Sheet, Field, Chips } from '../../ui/index.jsx';

export const RDV_MODES = [['telephone', 'Téléphone', LuPhone], ['whatsapp', 'WhatsApp', FaWhatsapp], ['visio', 'Visio', LuVideo], ['autre', 'Autre', LuCalendarCheck]];
const MODE = Object.fromEntries(RDV_MODES.map(([k, l, I]) => [k, { l, I }]));
const toIso = (local) => (local ? new Date(local).toISOString() : '');
const localNow = (h = 1) => { const d = new Date(Date.now() + h * 36e5); d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const when = (iso) => `${dateLong(iso)} · ${hm(iso)}`;
const contactLabel = (mode) => (mode === 'telephone' || mode === 'whatsapp' ? t('Numéro où vous joindre') : mode === 'visio' ? t('Lien ou e-mail pour la visio') : t('Identifiant ou numéro'));

// Artis & You : proposer un rendez-vous
export function RdvProposeSheet({ open, onClose, onSend }) {
  const [f, setF] = useState({ topic: '', modes: ['telephone', 'whatsapp'], slots: [localNow(24)], free: true, duration: 30 });
  const setSlot = (i, v) => setF({ ...f, slots: f.slots.map((s, j) => (j === i ? v : s)) });
  const ok = f.modes.length && (f.free || f.slots.some(Boolean));
  const send = () => onSend({ type: 'artesa_rdv', status: 'propose', title: t('Proposition de rendez-vous'), sub: f.topic || '', topic: f.topic.trim(), modes: f.modes, slots: f.slots.filter(Boolean).map(toIso), free: f.free, duration: Number(f.duration) });
  return (
    <Sheet open={open} onClose={onClose} title={t('Proposer un rendez-vous')}>
      <Field label={t('Objet (facultatif)')}><input value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} placeholder={t('Ex. : présentation d’Artis & You, aide à la facturation…')} /></Field>
      <Field label={t('Comment ?')} hint={t('la personne choisira parmi ceux-ci')}><Chips multi options={RDV_MODES.map(([k, l]) => [k, t(l)])} value={f.modes} onChange={(v) => setF({ ...f, modes: v })} /></Field>
      <Field label={t('Créneaux proposés')}>
        <div style={{ display: 'grid', gap: 6 }}>{f.slots.map((s, i) => (
          <div key={i} className="row" style={{ gap: 6 }}><input type="datetime-local" value={s} onChange={(e) => setSlot(i, e.target.value)} aria-label={t('Créneau {n}', { n: i + 1 })} />
            {f.slots.length > 1 && <button type="button" className="iconbtn" onClick={() => setF({ ...f, slots: f.slots.filter((_, j) => j !== i) })} aria-label={t('Retirer')}><LuX /></button>}</div>))}
          {f.slots.length < 3 && <button type="button" className="btn ghost sm" onClick={() => setF({ ...f, slots: [...f.slots, ''] })}><LuPlus /> {t('Autre créneau')}</button>}
        </div>
      </Field>
      <label className="check"><input type="checkbox" checked={f.free} onChange={(e) => setF({ ...f, free: e.target.checked })} /><span className="small">{t('La personne peut aussi choisir une autre date et heure')}</span></label>
      <Field label={t('Durée')}><select value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })}>{[15, 30, 45, 60, 90].map((n) => <option key={n} value={n}>{n} min</option>)}</select></Field>
      <button className="btn block mt" disabled={!ok} onClick={send}><LuCalendarCheck /> {t('Envoyer la proposition')}</button>
    </Sheet>
  );
}

// Pro / particulier : demander un rendez-vous à Artis & You
export function RdvRequestSheet({ open, onClose, onSend }) {
  const { profile } = useApp();
  const [f, setF] = useState({ mode: 'telephone', start: localNow(24), contact: profile.phone || '', platform: '', note: '' });
  const ok = f.start && f.contact.trim() && (f.mode !== 'autre' || f.platform.trim());
  const send = () => onSend({ type: 'artesa_rdv', status: 'demande', title: t('Demande de rendez-vous'), sub: t(MODE[f.mode].l) + ' · ' + when(toIso(f.start)), modes: [f.mode], slots: [toIso(f.start)], free: false, duration: 30,
    chosen: { start: toIso(f.start), mode: f.mode, contact: f.contact.trim(), platform: f.platform.trim(), note: f.note.trim() } });
  return (
    <Sheet open={open} onClose={onClose} title={t('Demander un rendez-vous à Artis & You')}>
      <ModeFields f={f} setF={setF} modes={RDV_MODES.map(([k]) => k)} />
      <Field label={t('Quand ?')}><input type="datetime-local" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
      <Field label={t('Message (facultatif)')}><textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder={t('De quoi souhaitez-vous parler ?')} /></Field>
      <button className="btn block mt" disabled={!ok} onClick={send}><LuCalendarCheck /> {t('Envoyer la demande')}</button>
      <p className="small muted mt">{t('L’équipe Artis & You confirme le rendez-vous ou vous propose un autre horaire.')}</p>
    </Sheet>
  );
}

function ModeFields({ f, setF, modes }) {
  return (
    <>
      <Field label={t('Comment ?')}><Chips options={RDV_MODES.filter(([k]) => modes.includes(k)).map(([k, l]) => [k, t(l)])} value={f.mode} onChange={(v) => setF({ ...f, mode: v })} /></Field>
      {f.mode === 'autre' && <Field label={t('Quelle plateforme ?')} req><input value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} placeholder={t('Ex. : Messenger, Signal, Skype…')} /></Field>}
      {f.mode === 'visio' && <Field label={t('Plateforme (facultatif)')}><input value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} placeholder={t('Google Meet, Teams, Zoom…')} /></Field>}
      <Field label={contactLabel(f.mode)} req><input type={f.mode === 'telephone' || f.mode === 'whatsapp' ? 'tel' : 'text'} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
    </>
  );
}

// La carte affichée dans la conversation
export function RdvSupportCard({ m, mine, onDone }) {
  const { profile, company, run, toast } = useApp();
  const [open, setOpen] = useState(false);
  const c = m.card, team = !!company?.is_platform;
  const status = c.status;
  const modes = c.modes?.length ? c.modes : RDV_MODES.map(([k]) => k);
  const [f, setF] = useState(() => ({ mode: modes[0], start: c.slots?.[0] || '', other: '', contact: profile.phone || '', platform: '', note: '' }));
  const book = (v) => run(async () => {
    await api.rpc('support_rdv_book', { p_msg: m.id, p_start: v.start, p_mode: v.mode, p_contact: v.contact, p_platform: v.platform || '', p_note: v.note || '' });
    setOpen(false); onDone?.();
  }, t('Rendez-vous confirmé : il est dans votre planning'));
  const start = f.start === 'other' ? toIso(f.other) : f.start;
  const link = c.status === 'confirme' && (team ? '/pro/planning/rdv/' + c.appointment_id : profile.company_id ? (c.pro_appointment_id && '/pro/planning/rdv/' + c.pro_appointment_id) : '/client/rdv/' + c.appointment_id);
  const I = MODE[c.mode || c.chosen?.mode]?.I || LuCalendarCheck;
  return (
    <div className={'req-card platform' + (mine ? ' r' : '')}>
      <div className="row" style={{ gap: 8 }}>{status === 'confirme' ? <LuCircleCheck className="green-t" size={20} /> : <I size={20} />}<b>{status === 'confirme' ? t('Rendez-vous confirmé') : t(c.title)}</b></div>
      {c.topic && <div className="small">{c.topic}</div>}
      {status === 'confirme' ? (
        <div className="small"><b>{when(c.start)}</b> · {t(MODE[c.mode]?.l || '')} · {c.contact}{c.platform ? ' (' + c.platform + ')' : ''}{c.note && <div className="muted">« {c.note} »</div>}</div>
      ) : status === 'demande' ? (
        <div className="small"><b>{when(c.chosen.start)}</b> · {t(MODE[c.chosen.mode]?.l || '')} · {c.chosen.contact}{c.chosen.platform ? ' (' + c.chosen.platform + ')' : ''}{c.chosen.note && <div className="muted">« {c.chosen.note} »</div>}</div>
      ) : (
        <div className="small">{(c.slots || []).map((s) => <div key={s}>• {when(s)}</div>)}{c.free && <div className="muted">{t('ou un autre horaire de votre choix')}</div>}<div className="muted">{modes.map((k) => t(MODE[k]?.l)).join(' · ')} · {c.duration} min</div></div>
      )}
      {status === 'propose' && !team && <button className="btn sm mt" onClick={() => setOpen(true)}>{t('Choisir mon créneau')}</button>}
      {status === 'propose' && team && <span className="small muted">{t('En attente de son choix')}</span>}
      {status === 'demande' && team && <button className="btn sm mt" onClick={() => book(c.chosen)}>{t('Confirmer ce rendez-vous')}</button>}
      {status === 'demande' && !team && <span className="small muted">{t('En attente de confirmation par Artis & You')}</span>}
      {link && <button className="link small bold" onClick={() => navigate(link)}>{team ? t('Voir dans l’agenda') : profile.company_id ? t('Voir dans mon planning') : t('Voir dans Mes RDV')} ›</button>}

      <Sheet open={open} onClose={() => setOpen(false)} title={t('Choisir mon rendez-vous')}>
        <Field label={t('Quand ?')}>
          <div style={{ display: 'grid', gap: 6 }}>
            {(c.slots || []).map((s) => <label key={s} className="check"><input type="radio" name={'slot' + m.id} checked={f.start === s} onChange={() => setF({ ...f, start: s })} /><span>{when(s)}</span></label>)}
            {c.free && <label className="check"><input type="radio" name={'slot' + m.id} checked={f.start === 'other'} onChange={() => setF({ ...f, start: 'other', other: f.other || localNow(24) })} /><span>{t('Un autre horaire')}</span></label>}
            {f.start === 'other' && <input type="datetime-local" value={f.other} onChange={(e) => setF({ ...f, other: e.target.value })} aria-label={t('Autre horaire')} />}
          </div>
        </Field>
        <ModeFields f={f} setF={setF} modes={modes} />
        <Field label={t('Message (facultatif)')}><textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <button className="btn block mt" disabled={!start || !f.contact.trim() || (f.mode === 'autre' && !f.platform.trim())} onClick={() => (start ? book({ ...f, start }) : toast(t('Choisissez un horaire'), true))}><LuCalendarCheck /> {t('Confirmer le rendez-vous')}</button>
      </Sheet>
    </div>
  );
}
