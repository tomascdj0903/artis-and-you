// Relances clients : à faire, programmées, historique et réglages des scénarios
import { kbd } from '../../lib/a11y.js';
import { useState } from 'react';
import { LuSend, LuMail, LuPause, LuPlay, LuPlus, LuTrash2, LuBellRing, LuChevronRight } from 'react-icons/lu';
import { api } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { navigate, useLocation } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { money, date, dateTime, clientName, iso } from '../../lib/format.js';
import { TopBar, Sec, Sheet, Field, Seg, Chips, SettingToggle, useData, Loader, Empty, Pill } from '../../ui/index.jsx';
import { scenarios, dueReminders, nextReminder, fillTemplate, sendReminder, remaining, DEFAULT_SCENARIOS, TONES, VARS } from '../../lib/relances.js';

const whenLabel = (days, kind) => kind === 'devis' ? t('J+{n} après l’envoi', { n: days }) : days < 0 ? t('{n} jours avant l’échéance', { n: -days }) : days === 0 ? t('Le jour de l’échéance') : t('J+{n} après l’échéance', { n: days });

export function Relances() {
  const { company, setCompany, profile, run, toast } = useApp();
  const { query } = useLocation();
  const [tab, setTab] = useState(query.get('tab') || 'todo');
  const [edit, setEdit] = useState(null); // { r, text, channel }
  const [b, reload] = useData(async () => {
    const [docs, clients] = await Promise.all([api.select('documents', { company_id: company.id }), api.select('clients', { company_id: company.id })]);
    return { docs, cm: Object.fromEntries(clients.map((c) => [c.id, c])) };
  }, []);
  if (!b) return <div className="content"><TopBar title={t('Relances')} /><Loader /></div>;
  const todo = dueReminders(b.docs, company);
  const planned = b.docs.filter((d) => d.number && d.status !== 'annulee' && !d.reminders_paused && ((['facture', 'acompte'].includes(d.kind) && remaining(d) > 0.005) || (d.kind === 'devis' && d.status === 'envoye')))
    .map((d) => ({ d, n: nextReminder(d, company) })).filter((x) => x.n && !todo.some((r) => r.d.id === x.d.id)).sort((a, b2) => a.n.at.localeCompare(b2.n.at));
  const paused = b.docs.filter((d) => d.reminders_paused && d.number);
  const history = b.docs.flatMap((d) => (d.reminders || []).filter((r) => !r.skipped).map((r) => ({ ...r, d }))).sort((a, b2) => b2.at.localeCompare(a.at));
  const late = b.docs.filter((d) => ['facture', 'acompte'].includes(d.kind) && d.number && d.status !== 'annulee' && d.due_date && d.due_date < iso(new Date()) && remaining(d) > 0.005);
  const open = (r, channel) => setEdit({ r, channel, text: fillTemplate(r.step.text, r.d, b.cm[r.d.client_id], company) });
  const send = async () => {
    const { r, text, channel } = edit; const c = b.cm[r.d.client_id];
    await run(() => sendReminder({ ...r, client: c, company, profile, text, channel }), channel === 'app' ? t('Relance envoyée dans la messagerie') : t('Relance envoyée par e-mail'));
    setEdit(null); reload();
  };
  const sendAllApp = async () => {
    const list = todo.filter((r) => b.cm[r.d.client_id]?.user_id);
    await run(async () => { for (const r of list) await sendReminder({ ...r, client: b.cm[r.d.client_id], company, profile, channel: 'app' }); }, t('{n} relances envoyées', { n: list.length }));
    reload();
  };
  const pause = (d, v) => run(() => api.update('documents', { id: d.id }, { reminders_paused: v }), v ? t('Relances suspendues pour ce document') : t('Relances réactivées')).then(reload);
  const appCount = todo.filter((r) => b.cm[r.d.client_id]?.user_id).length;
  return (
    <div className="content" style={{ maxWidth: 1100 }}>
      <TopBar title={t('Relances')} sub={t('Factures impayées et devis sans réponse')} />
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div className="kpi red"><div className="l">{t('À relancer aujourd’hui')}</div><div className="n">{todo.length}</div></div>
        <div className="kpi"><div className="l">{t('Factures en retard')}</div><div className="n">{late.length}</div><div className="small muted">{money(late.reduce((s, d) => s + remaining(d), 0))}</div></div>
        <div className="kpi"><div className="l">{t('Relances envoyées (30 j)')}</div><div className="n">{history.filter((h) => h.at >= new Date(Date.now() - 30 * 864e5).toISOString()).length}</div></div>
      </div>
      <Seg options={[['todo', t('À faire ({n})', { n: todo.length })], ['planned', t('Programmées')], ['history', t('Historique')], ['settings', t('Réglages')]]} value={tab} onChange={setTab} />

      {tab === 'todo' && (todo.length ? <>
        {appCount > 1 && <div className="row" style={{ justifyContent: 'flex-end', margin: '8px 0' }}><button className="btn sm" onClick={sendAllApp}><LuSend /> {t('Tout envoyer par la messagerie ({n})', { n: appCount })}</button></div>}
        <div className="proj-grid">{todo.map((r) => { const c = b.cm[r.d.client_id]; return (
          <div key={r.d.id} className="card proj">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div><b {...kbd} className="click" onClick={() => navigate('/pro/documents/' + r.d.id)}>{r.d.number}</b><div className="small muted">{clientName(c)}</div></div>
              <Pill c={r.kind === 'devis' ? 'navy-o' : r.late > 7 ? 'red' : 'red-o'}>{r.kind === 'devis' ? t('Devis envoyé il y a {n} j', { n: r.late }) : r.late < 0 ? t('Échéance dans {n} j', { n: -r.late }) : t('{n} j de retard', { n: r.late })}</Pill>
            </div>
            <div className="row small" style={{ justifyContent: 'space-between', margin: '8px 0' }}><span><LuBellRing className="red-t" /> {t(r.step.title)}</span><b>{r.kind === 'devis' ? money(r.d.totals?.ttc) : t('{m} restant', { m: money(remaining(r.d)) })}</b></div>
            {(r.d.reminders || []).some((x) => !x.skipped) && <div className="small faint">{t('Déjà relancé {n} fois · dernière le {d}', { n: r.d.reminders.filter((x) => !x.skipped).length, d: date(r.d.reminders.filter((x) => !x.skipped).slice(-1)[0].at) })}</div>}
            <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <button className="btn sm" disabled={!c?.user_id} title={!c?.user_id ? t('Ce client n’a pas de compte Artesa') : ''} onClick={() => open(r, 'app')}><LuSend /> {t('Messagerie')}</button>
              <button className="btn sm ghost" onClick={() => open(r, 'email')}><LuMail /> {t('E-mail')}</button>
              <button className="btn sm ghost" onClick={() => pause(r.d, true)} title={t('Ne plus relancer ce document')}><LuPause /></button>
            </div>
          </div>
        ); })}</div>
      </> : <Empty icon={LuBellRing} text={t('Aucune relance à faire aujourd’hui. 👍')} />)}

      {tab === 'planned' && <>
        {planned.length ? <div className="kv">{planned.map(({ d, n }) => (
          <div className="r" key={d.id}><span className="k"><b {...kbd} className="click" onClick={() => navigate('/pro/documents/' + d.id)}>{d.number}</b> · {clientName(b.cm[d.client_id])}<small style={{ display: 'block' }}>{t(n.step.title)}</small></span><span className="row" style={{ gap: 8 }}><span className="v">{date(n.at)}</span><button className="iconbtn" onClick={() => pause(d, true)} aria-label={t('Suspendre')}><LuPause /></button></span></div>
        ))}</div> : <Empty text={t('Aucune relance programmée.')} />}
        {paused.length > 0 && <><Sec title={t('Relances suspendues')} /><div className="kv">{paused.map((d) => <div className="r" key={d.id}><span className="k">{d.number} · {clientName(b.cm[d.client_id])}</span><button className="btn xs ghost" onClick={() => pause(d, false)}><LuPlay /> {t('Réactiver')}</button></div>)}</div></>}
      </>}

      {tab === 'history' && (history.length ? <div className="kv">{history.slice(0, 100).map((h, i) => (
        <div className="r" key={i}><span className="k"><b {...kbd} className="click" onClick={() => navigate('/pro/documents/' + h.d.id)}>{h.d.number}</b> · {clientName(b.cm[h.d.client_id])}<small style={{ display: 'block' }}>{t(h.title)} · {h.channel === 'app' ? t('Messagerie Artesa') : t('E-mail')}</small></span><span className="v small">{dateTime(h.at)}</span></div>
      ))}</div> : <Empty text={t('Aucune relance envoyée pour l’instant.')} />)}

      {tab === 'settings' && <ScenarioSettings company={company} setCompany={setCompany} run={run} toast={toast} />}

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit ? t(edit.r.step.title) + ' · ' + edit.r.d.number : ''}>
        {edit && <>
          <div className="small muted mb">{t('À')} : {clientName(b.cm[edit.r.d.client_id])} · {edit.channel === 'app' ? t('messagerie Artesa') : (b.cm[edit.r.d.client_id]?.email || t('aucune adresse e-mail'))}</div>
          <Field label={t('Message (modifiable)')}><textarea value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} style={{ minHeight: 220 }} /></Field>
          <div className="btns"><div className="two"><button className="btn ghost" onClick={() => setEdit(null)}>{t('Annuler')}</button><button className="btn" onClick={send}>{edit.channel === 'app' ? <><LuSend /> {t('Envoyer')}</> : <><LuMail /> {t('Ouvrir l’e-mail')}</>}</button></div></div>
        </>}
      </Sheet>
    </div>
  );
}

function ScenarioSettings({ company, setCompany, run }) {
  const [s, setS] = useState(scenarios(company));
  const [kind, setKind] = useState('facture');
  const [open, setOpen] = useState(null);
  const save = (x) => { setS(x); return run(async () => { const settings = { ...company.settings, relances: x }; await api.update('companies', { id: company.id }, { settings }); setCompany({ ...company, settings }); }, t('Réglages enregistrés')); };
  const steps = s[kind];
  const setStep = (i, patch) => save({ ...s, [kind]: steps.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const sorted = steps.map((x, i) => [x, i]).sort((a, b) => a[0].days - b[0].days);
  return (
    <>
      <div className="kv" style={{ marginTop: 12 }}>
        <SettingToggle label={t('Envoi automatique')} hint={s.auto ? t('Les relances dues partent seules dans la messagerie des clients qui ont un compte (à l’ouverture de l’application). Les autres restent à envoyer par e-mail.') : t('Vous validez chaque relance avant l’envoi.')} checked={s.auto} onChange={(v) => save({ ...s, auto: v })} />
      </div>
      <Sec title={t('Scénarios')} />
      <Seg options={[['facture', t('Factures impayées')], ['devis', t('Devis sans réponse')]]} value={kind} onChange={(k) => { setKind(k); setOpen(null); }} />
      <div className="steps" style={{ marginTop: 14 }}>
        {sorted.map(([st, i], n) => (
          <div key={st.id} className={'step' + (st.on ? ' done' : '')}>
            <div className="b">{n + 1}</div>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                <div {...kbd} className="click" onClick={() => setOpen(open === st.id ? null : st.id)}><b>{t(st.title)}</b><div className="small muted">{whenLabel(st.days, kind)} · {t(TONES.find((x) => x[0] === st.tone)?.[1] || '')}</div></div>
                <span className="row" style={{ gap: 6 }}><input type="checkbox" role="switch" className="toggle" checked={st.on} onChange={(e) => setStep(i, { on: e.target.checked })} aria-label={t(st.title)} /><button className="iconbtn" onClick={() => setOpen(open === st.id ? null : st.id)} aria-label={t('Modifier')}><LuChevronRight style={{ transform: open === st.id ? 'rotate(90deg)' : '' }} /></button></span>
              </div>
              {open === st.id && <StepEditor st={st} kind={kind} onSave={(p) => { setStep(i, p); setOpen(null); }} onDelete={steps.length > 1 ? () => { save({ ...s, [kind]: steps.filter((_, j) => j !== i) }); setOpen(null); } : null} />}
            </div>
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn sm ghost" onClick={() => { const id = kind[0] + Date.now().toString(36); save({ ...s, [kind]: [...steps, { id, on: true, days: (Math.max(...steps.map((x) => x.days)) || 0) + 7, tone: 'ferme', title: 'Nouvelle relance', text: kind === 'devis' ? DEFAULT_SCENARIOS.devis[0].text : DEFAULT_SCENARIOS.facture[1].text }] }); setOpen(id); }}><LuPlus /> {t('Ajouter une étape')}</button>
        <button className="btn sm ghost" onClick={() => save({ ...s, [kind]: DEFAULT_SCENARIOS[kind] })}>{t('Rétablir le scénario conseillé')}</button>
      </div>
    </>
  );
}

function StepEditor({ st, kind, onSave, onDelete }) {
  const [v, setV] = useState(st);
  const [taRef, setTaRef] = useState(null);
  const insert = (x) => { const el = taRef; if (!el) return setV({ ...v, text: v.text + x }); const a = el.selectionStart, z = el.selectionEnd; setV({ ...v, text: v.text.slice(0, a) + x + v.text.slice(z) }); setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = a + x.length; }, 0); };
  return (
    <div className="card soft" style={{ marginTop: 10 }}>
      <div className="form-grid two">
        <Field label={t('Intitulé')}><input value={t(v.title)} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
        <Field label={kind === 'devis' ? t('Jours après l’envoi') : t('Jours par rapport à l’échéance')} hint={kind === 'devis' ? '' : t('négatif = avant')}><input type="number" value={v.days} min={kind === 'devis' ? 1 : -30} max={120} onChange={(e) => setV({ ...v, days: Number(e.target.value) })} /></Field>
      </div>
      <div className="small bold">{t('Ton')}</div>
      <Chips options={TONES.map(([k, l]) => [k, t(l)])} value={v.tone} onChange={(tone) => setV({ ...v, tone })} />
      <Field label={t('Message')}><textarea ref={setTaRef} value={t(v.text)} onChange={(e) => setV({ ...v, text: e.target.value })} style={{ minHeight: 180 }} /></Field>
      <div className="row small" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}><span className="muted">{t('Insérer :')}</span>{VARS.map((x) => <button type="button" key={x} className="chip" style={{ padding: '3px 9px', fontSize: 12 }} onClick={() => insert(x)}>{x}</button>)}</div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn sm" onClick={() => onSave(v)}>{t('Enregistrer l’étape')}</button>
        {onDelete && <button className="btn sm ghost" onClick={onDelete}><LuTrash2 /> {t('Supprimer')}</button>}
      </div>
    </div>
  );
}
