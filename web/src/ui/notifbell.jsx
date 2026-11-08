// Cloche en haut à droite : bulle avec les dernières notifications (cliquables)
import { useEffect, useRef, useState } from 'react';
import { LuBell, LuCalendar, LuFileText, LuCreditCard, LuMessageSquare, LuInfo } from 'react-icons/lu';
import { api, uid } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { navigate } from '../lib/router.jsx';
import { t } from '../lib/i18n.js';
import { rel } from '../lib/format.js';

const ICON = { rdv: LuCalendar, documents: LuFileText, paiement: LuCreditCard, message: LuMessageSquare, systeme: LuInfo };

export function NotifBell({ base }) {
  const { unread, refreshUnread } = useApp();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(null);
  const box = useRef();
  const load = async () => { try { setList(await api.select('notifications', { user_id: uid() }, { order: 'created_at.desc', limit: 8 })); } catch { setList([]); } };
  useEffect(() => { if (open) load(); }, [open, unread?.notifs]);
  useEffect(() => {
    if (!open) return;
    const f = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', f); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', f); document.removeEventListener('keydown', k); };
  }, [open]);
  const go = async (n) => {
    setOpen(false);
    if (!n.read) { try { await api.update('notifications', { id: n.id }, { read: true }); refreshUnread?.(); } catch {} }
    navigate(n.link || base + '/notifications');
  };
  const readAll = async () => { try { await api.update('notifications', { user_id: uid(), read: false }, { read: true }); refreshUnread?.(); load(); } catch {} };
  return (
    <div className="notifbell" ref={box}>
      <button type="button" className="iconbtn" aria-label={t('Notifications')} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}><LuBell />{unread.notifs > 0 && <span className="dot" />}</button>
      {open && (
        <div className="notifpop" role="dialog" aria-label={t('Notifications')}>
          <div className="row between np-head"><b>{t('Notifications')}</b>{unread.notifs > 0 && <button className="link small red-t" onClick={readAll}>{t('Tout lire')}</button>}</div>
          <div className="np-list">
            {!list ? <div className="np-empty">{t('Chargement…')}</div>
              : !list.length ? <div className="np-empty">{t('Aucune notification pour le moment')}</div>
              : list.map((n) => { const I = ICON[n.category] || LuBell; return (
                <button key={n.id} type="button" className={'np-item' + (n.read ? '' : ' unread')} onClick={() => go(n)}>
                  <span className="np-ic"><I /></span>
                  <span className="grow"><b>{t(n.title)}</b>{n.body && <small>{n.body}</small>}<small className="faint">{rel(n.created_at)}</small></span>
                  {!n.read && <span className="np-dot" aria-label={t('Non lue')} />}
                </button>
              ); })}
          </div>
          <button className="np-all" onClick={() => { setOpen(false); navigate(base + '/notifications'); }}>{t('Voir toutes les notifications')}</button>
        </div>
      )}
    </div>
  );
}
