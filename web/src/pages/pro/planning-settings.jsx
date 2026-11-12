// Planning : réglages (horaires, durées, rappels) et synchronisation avec les agendas externes
import { useEffect, useState } from 'react';
import { api, OFFLINE, SUPABASE_URL } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { Link } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { APPT_TYPES } from '../../lib/docs.js';
import { icsFile, rrule } from '../../lib/ics.js';
import { TopBar, Sec, Sheet, Chips, Seg, SettingToggle, Loader } from '../../ui/index.jsx';

import { planSettings } from './planning.jsx';
import { DUR_OPTS } from './planning-rdv.jsx';

export function PlanningSettings() {
  const { company, setCompany, run, teams } = useApp();
  const [s, setS] = useState(planSettings(company));
  const save = async (patch) => {
    const n = { ...s, ...patch }; setS(n);
    const settings = { ...company.settings, planning: n };
    await run(() => api.update('companies', { id: company.id }, { settings }));
    setCompany({ ...company, settings });
  };
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const [sync, setSync] = useState(false);
  const DAYS = [[1, 'Lun'], [2, 'Mar'], [3, 'Mer'], [4, 'Jeu'], [5, 'Ven'], [6, 'Sam'], [0, 'Dim']];
  return (
    <div className="content narrow">
      <TopBar title={t('Réglages')} sub={t('Planning')} />
      <Sec title={t('Affichage')} />
      <div className="kv">
        <div className="r"><span className="k">{t('Vue par défaut')}</span><select value={s.view} onChange={(e) => save({ view: e.target.value })}><option value="day">{t('Jour')}</option><option value="week">{t('Semaine')}</option><option value="month">{t('Mois')}</option></select></div>
        <div className="r"><span className="k">{t('Heures affichées')}</span><span className="row"><select value={s.hours[0]} onChange={(e) => save({ hours: [+e.target.value, s.hours[1]] })}>{hours.map((h) => <option key={h} value={h}>{h} h</option>)}</select>–<select value={s.hours[1]} onChange={(e) => save({ hours: [s.hours[0], +e.target.value] })}>{hours.slice(1).map((h) => <option key={h} value={h}>{h} h</option>)}<option value={24}>24 h</option></select></span></div>
        <SettingToggle label={t('Afficher le week-end')} hint={t('Samedi et dimanche toujours visibles, même non travaillés')} checked={s.weekend} onChange={(v) => save({ weekend: v })} />
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
        <SettingToggle label={t('Validation manuelle')} hint={s.manual ? t('Vous acceptez ou refusez chaque demande de rendez-vous') : t('Les demandes sur vos créneaux libres sont acceptées automatiquement')} checked={s.manual} onChange={(v) => save({ manual: v })} />
        <div className="r"><span className="k">{t('Rappel au client')}</span><select value={s.reminder} onChange={(e) => save({ reminder: +e.target.value })}>{[0, 2, 24, 48].map((h) => <option key={h} value={h}>{h ? t('{n} h avant', { n: h }) : t('Aucun')}</option>)}</select></div>
        <SettingToggle label={t('Rendez-vous en visio (WhatsApp)')} hint={s.visio ? t('Vos clients peuvent demander une visio WhatsApp') : t('Vos clients ne peuvent demander que des rendez-vous sur place')} checked={s.visio} onChange={(v) => save({ visio: v })} />
      </div>
      <Sec title={t('Types de rendez-vous proposés')} />
      <p className="small muted" style={{ marginTop: -4 }}>{t('Cochez ce que vos clients peuvent réserver en ligne, et la durée de chacun (comme sur Doctolib). Vous pouvez toujours créer tous les types vous-même.')}</p>
      <div className="kv">
        {APPT_TYPES.map((ty) => { const on = s.offered.includes(ty); return (
          <div className="r set-row" key={ty}>
            <label className="row" style={{ gap: 10, flex: 1, cursor: 'pointer' }}><input type="checkbox" role="switch" className="toggle" checked={on} onChange={(e) => { const offered = e.target.checked ? [...s.offered, ty] : s.offered.filter((x) => x !== ty); if (!offered.length) return; save({ offered }); }} /><span className={'k' + (on ? '' : ' faint')}>{t(ty)}</span></label>
            <select value={s.durations[ty] || s.duration} disabled={!on} onChange={(e) => save({ durations: { ...s.durations, [ty]: +e.target.value } })} aria-label={t('Durée')}>{DUR_OPTS.map((m) => <option key={m} value={m}>{fmtDur(m)}</option>)}</select>
          </div>); })}
        <div className="r"><span className="k">{t('Autre rendez-vous')}</span><select value={s.duration} onChange={(e) => save({ duration: +e.target.value })}>{DUR_OPTS.map((m) => <option key={m} value={m}>{fmtDur(m)}</option>)}</select></div>
      </div>
      <Sec title={t('Synchronisation')} />
      <div className="kv">
        <button className="r" style={{ width: '100%', border: 0, background: 'transparent', color: 'inherit' }} onClick={() => setSync(true)}><span className="k">{t('Relier mon agenda')}<small style={{ display: 'block', fontWeight: 400, color: 'var(--text-2)', fontSize: 12.5 }}>{t('Tout le planning dans Google Agenda, Outlook ou l’iPhone, mis à jour automatiquement')}</small></span><span className="v">›</span></button>
        <button className="r" style={{ width: '100%', border: 0, background: 'transparent', color: 'inherit' }} onClick={async () => {
          const ap = await api.select('appointments', { company_id: company.id, status: ['valide', 'a_valider'] });
          icsFile(ap.map((x) => ({ id: x.id, start: x.start_at, end: x.end_at, title: x.title, location: x.address, rrule: rrule(x.recurrence) })), 'planning-artis-and-you.ics');
        }}><span className="k">{t('Exporter mon planning (.ics)')}</span><span className="v">›</span></button>
      </div>
      <AgendaSync open={sync} onClose={() => setSync(false)} />
    </div>
  );
}

// Relier tout l'agenda par abonnement (comme un emploi du temps universitaire) : un lien secret à coller une seule fois
function AgendaSync({ open, onClose }) {
  const { run, toast, confirm } = useApp();
  const [tok, setTok] = useState(null);
  useEffect(() => { if (open && !tok) api.rpc('calendar_token', {}).then(setTok).catch(() => setTok('')); }, [open]);
  if (!open) return null;
  const feed = OFFLINE ? '' : `${SUPABASE_URL}/functions/v1/agenda?token=${tok}`;
  const webcal = feed.replace(/^https:/, 'webcal:');
  const copy = () => { navigator.clipboard?.writeText(feed); toast(t('Lien copié')); };
  return (
    <Sheet open onClose={onClose} title={t('Relier mon agenda')}>
      <p className="small">{t('Votre planning Artesa apparaît dans votre agenda habituel et se met à jour tout seul (toutes les 15 min à quelques heures selon l’application). Les modifications se font dans Artesa.')}</p>
      {OFFLINE ? <div className="notice small">{t('Disponible quand l’application sera en ligne (serveur Supabase). En attendant, utilisez « Exporter mon planning (.ics) ».')}</div> : !tok ? <Loader /> : <>
        <div className="card soft small" style={{ wordBreak: 'break-all', fontFamily: 'ui-monospace, monospace' }}>{feed}</div>
        <div className="row" style={{ gap: 8, margin: '8px 0 14px', flexWrap: 'wrap' }}>
          <button className="btn sm" onClick={copy}>{t('Copier le lien')}</button>
          <a className="btn sm ghost" href={'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(webcal)} target="_blank" rel="noreferrer">Google Agenda ↗</a>
          <a className="btn sm ghost" href={'https://outlook.live.com/calendar/0/addfromweb?url=' + encodeURIComponent(feed) + '&name=Artesa'} target="_blank" rel="noreferrer">Outlook ↗</a>
          <a className="btn sm ghost" href={webcal}>{t('iPhone / Mac')}</a>
        </div>
        <ol className="small" style={{ paddingLeft: 18, margin: 0 }}>
          <li>{t('Google Agenda : « Autres agendas » › + › « À partir de l’URL », collez le lien.')}</li>
          <li>{t('Outlook : « Ajouter un calendrier » › « S’abonner à partir du web ».')}</li>
          <li>{t('iPhone : Réglages › Calendrier › Comptes › Ajouter un compte › Autre › « Ajouter un calendrier avec abonnement ».')}</li>
        </ol>
        <p className="small faint mt">{t('Ce lien est personnel : toute personne qui l’a peut voir votre planning.')} <button className="link bold" onClick={async () => { if (await confirm({ title: t('Créer un nouveau lien ?'), text: t('L’ancien lien cessera de fonctionner : il faudra relier à nouveau vos agendas.'), ok: t('Nouveau lien') })) run(async () => setTok(await api.rpc('calendar_token', { p_reset: true })), t('Nouveau lien créé')); }}>{t('Changer le lien')}</button></p>
      </>}
    </Sheet>
  );
}
