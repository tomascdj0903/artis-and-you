import { useEffect, useRef, useState } from 'react';
import { LuPlus, LuArrowRight, LuVideo, LuCircleCheck, LuMapPin, LuFileText, LuImage, LuPaperclip, LuHardHat, LuCalendarCheck } from 'react-icons/lu';
import { api, uid } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { t } from '../../lib/i18n.js';
import { hm, dateMed, fullName, clientName } from '../../lib/format.js';
import { Img, Sheet, pickFiles, openFile, Loader, Lightbox } from '../../ui/index.jsx';

export async function uploadTo(prefix, file) {
  const safe = file.name.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-60);
  const path = `${prefix}/${Date.now().toString(36)}-${safe}`;
  await api.upload(path, file);
  return { path, name: file.name, mime: file.type, size: file.size };
}
export const myPrefix = (profile) => (profile.company_id ? profile.company_id : 'u/' + profile.id);

export function Chat({ convId, projects = [], banner }) {
  const { profile, company, refreshUnread, toast } = useApp();
  const [msgs, setMsgs] = useState(null);
  const [conv, setConv] = useState(null);
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const [doneSheet, setDoneSheet] = useState(false);
  const [big, setBig] = useState(null);
  const endRef = useRef();
  const lastCount = useRef(0);

  const load = async () => {
    const [c, m] = await Promise.all([api.one('conversations', { id: convId }), api.select('messages', { conversation_id: convId }, { order: 'created_at.asc', limit: 500 })]);
    setConv(c); setMsgs(m);
    if (m.length !== lastCount.current) { lastCount.current = m.length; setTimeout(() => endRef.current?.scrollIntoView({ block: 'end' }), 30); }
  };
  useEffect(() => {
    load();
    api.upsert('conversation_reads', { conversation_id: convId, user_id: uid(), last_read_at: new Date().toISOString() }).then(refreshUnread).catch(() => {});
    const i = setInterval(load, 4000);
    return () => { clearInterval(i); api.upsert('conversation_reads', { conversation_id: convId, user_id: uid(), last_read_at: new Date().toISOString() }).then(refreshUnread).catch(() => {}); };
  }, [convId]);

  const senderName = fullName(profile) || company?.name || '';
  const post = async (row) => {
    await api.insert('messages', { conversation_id: convId, sender_id: uid(), sender_name: senderName, sender_company_id: profile.company_id || null, ...row });
    await load();
  };
  const send = async (e) => {
    e?.preventDefault();
    const b = text.trim(); if (!b) return;
    setText('');
    try { await post({ body: b }); } catch (x) { toast(x.message, true); setText(b); }
  };
  const attach = async (accept) => {
    setMenu(false);
    const files = await pickFiles({ accept, multiple: true });
    if (!files.length) return;
    try {
      const atts = [];
      for (const f of files) { if (f.size > 20e6) { toast(t('Fichier trop lourd (20 Mo max).'), true); continue; } atts.push(await uploadTo(myPrefix(profile) + '/chat/' + convId, f)); }
      if (atts.length) await post({ attachments: atts });
    } catch (x) { toast(x.message, true); }
  };
  const markDone = async (p) => {
    setDoneSheet(false);
    const at = new Date().toISOString();
    await api.update('projects', { id: p.id }, { finished_at: at });
    const appts = await api.select('appointments', { project_id: p.id, status: 'valide' });
    for (const a of appts) await api.update('appointments', { id: a.id }, { status: 'termine' });
    await post({ card: { type: 'done', title: t('Chantier terminé') + ' · ' + p.title, sub: t('Marqué par {n} à {h}', { n: profile.first_name, h: hm(at) }) } });
    toast(t('Statut projet mis à jour'));
  };

  if (!msgs) return <Loader />;
  let lastDay = '', lastSender = '';
  return (
    <>
      {banner}
      <div className="chat">
        {msgs.length === 0 && <div className="day">{t('Démarrez la conversation')}</div>}
        {msgs.map((m) => {
          const day = m.created_at.slice(0, 10);
          const mine = m.sender_id === uid();
          const showDay = day !== lastDay; lastDay = day;
          const showWho = !mine && (showDay || lastSender !== m.sender_id); lastSender = m.sender_id;
          const photos = (m.attachments || []).filter((a) => (a.mime || '').startsWith('image/'));
          const files = (m.attachments || []).filter((a) => !(a.mime || '').startsWith('image/'));
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {showDay && <div className="day">{dateMed(day)}</div>}
              {showWho && <div className="who">{m.sender_name}</div>}
              {m.card && (
                <div className={'sys' + (m.card.type === 'done' ? ' ok' : '')}>
                  {m.card.type === 'done' ? <LuCircleCheck className="green-t" size={26} /> : m.card.type === 'rdv' ? <LuVideo size={24} /> : <LuCalendarCheck size={24} />}
                  <div><b className={m.card.type === 'done' ? 'green-t' : ''}>{m.card.title}</b><span className="small muted">{m.card.sub}</span></div>
                </div>
              )}
              {photos.length > 0 && <div className={'photos' + (mine ? ' r' : '')}>{photos.map((p) => <Img key={p.path} path={p.path} onClick={() => setBig(p.path)} />)}</div>}
              {files.map((f) => <button key={f.path} className={'file' + (mine ? ' r' : '')} onClick={() => openFile(f.path, f.name)}><span className="pill red">PDF</span>{f.name}</button>)}
              {m.body && <div className={'bubble ' + (mine ? 'out' : 'in')}>{m.body}</div>}
              <div className={'when' + (mine ? ' r' : '')}>{hm(m.created_at)}</div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form className="composer" onSubmit={send}>
        <button type="button" className="att" onClick={() => setMenu(true)} aria-label={t('Joindre')}><LuPlus /></button>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Écrire un message…')} aria-label={t('Message')} />
        <button className="send" aria-label={t('Envoyer')}><LuArrowRight /></button>
      </form>
      <Sheet open={menu} onClose={() => setMenu(false)} title={t('Joindre')}>
        <button className="opt" onClick={() => attach('image/*')}><LuImage /><div><b>{t('Photos')}</b></div></button>
        <button className="opt" onClick={() => attach('application/pdf,image/*,.doc,.docx,.xls,.xlsx,.dwg')}><LuPaperclip /><div><b>{t('Fichier (PDF, plan…)')}</b></div></button>
        {conv?.kind === 'team' && <button className="opt" onClick={() => { setMenu(false); setDoneSheet(true); }}><LuHardHat /><div><b>{t('Chantier terminé')}</b><small>{t('Met à jour le statut projet')}</small></div></button>}
      </Sheet>
      <Sheet open={doneSheet} onClose={() => setDoneSheet(false)} title={t('Quel chantier est terminé ?')}>
        <div className="list">{projects.filter((p) => !p.finished_at).map((p) => <button key={p.id} className="li click" onClick={() => markDone(p)}><div className="grow"><div className="t1">{p.title}</div><div className="t2">{p.address}</div></div></button>)}</div>
        {!projects.filter((p) => !p.finished_at).length && <p className="muted">{t('Aucun chantier en cours.')}</p>}
      </Sheet>
      <Lightbox path={big} onClose={() => setBig(null)} />
    </>
  );
}

// Nom et sous-titre d'une conversation selon le point de vue
export function convMeta(c, { mine, clients, teams, companies, members }) {
  if (c.kind === 'client') {
    if (!mine) { const co = companies[c.company_id]; return { name: co?.trade_name || co?.name || t('Artisan'), sub: (co?.trades || [])[0] || '', tag: t('Artisan'), initials: co?.name }; }
    const cl = clients[c.client_id]; return { name: clientName(cl), sub: [t('Client'), cl?.site_city || cl?.billing_city].filter(Boolean).join(' · '), tag: t('Client'), initials: clientName(cl) };
  }
  if (c.kind === 'team') { const tm = teams[c.team_id]; const ms = (members || []).filter((m) => m.team_id === c.team_id).map((m) => m.first_name); return { name: tm?.name || t('Équipe'), sub: t('Équipe') + (ms.length ? ' · ' + ms.join(', ') + ' ' + t('et vous') : ''), tag: t('Équipe'), color: tm?.color, initials: tm?.name }; }
  if (c.kind === 'pro') { const oid = c.company_id === mine ? c.other_company_id : c.company_id; const co = companies[oid]; return { name: co?.trade_name || co?.name || t('Artisan'), sub: t('Artisan') + ' · ' + (co?.name || ''), tag: (co?.trades || [])[0] || t('Artisan'), initials: co?.name, otherId: oid }; }
  return { name: 'Artis & You', sub: t('Support'), tag: t('Support') };
}
