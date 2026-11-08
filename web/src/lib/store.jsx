// État global : session, profil, entreprise, langue, thème, notifications, fenêtres.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, onAuth, getSession, uid } from './api.js';
import { subscribePush } from './push.js';
import { setLang as setI18nLang, getLang, t, loadLang } from './i18n.js';
import { navigate } from './router.jsx';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [session, setSession] = useState(getSession());
  const [profile, setProfile] = useState(null);
  const [company, setCompany] = useState(null);
  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [ready, setReady] = useState(false);
  const [lang, setLangState] = useState(getLang());
  const [theme, setThemeState] = useState(() => { try { return localStorage.getItem('ay-theme') || 'light'; } catch { return 'light'; } });
  const [toastMsg, setToast] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [unread, setUnread] = useState({ notifs: 0, messages: 0 });
  const toastTimer = useRef();
  const showToastRef = useRef(() => {});
  const showToast = (m) => showToastRef.current(m);

  useEffect(() => onAuth(setSession), []);

  const load = useCallback(async () => {
    if (!getSession()?.user?.id && !getSession()?.access_token) { setProfile(null); setCompany(null); setReady(true); return; }
    try {
      let p = await api.one('profiles', { id: uid() });
      if (!p) { setProfile(null); setReady(true); return; }
      try { p.is_admin = !!(await api.rpc('is_admin')); } catch { p.is_admin = false; }
      setProfile(p);
      let localLang = null; try { localLang = localStorage.getItem('ay-lang'); } catch {}
      if (!localLang && p.lang && p.lang !== getLang()) { await loadLang(p.lang); setI18nLang(p.lang); setLangState(p.lang); }
      if (p.theme && p.theme !== theme) applyTheme(p.theme);
      if (p.company_id) {
        const [c, ts, ms] = await Promise.all([api.one('companies', { id: p.company_id }), api.select('teams', { company_id: p.company_id }, { order: 'created_at.asc' }), api.select('profiles', { company_id: p.company_id })]);
        setCompany(c); setTeams(ts); setMembers(ms);
      } else { setCompany(null); setTeams([]); setMembers([]); }
    } catch (e) { console.error(e); }
    setReady(true);
  }, []);
  useEffect(() => { setReady(false); load(); }, [session?.user?.id, session?.access_token]);

  // Compteurs non lus + nouvelles notifications en direct (bandeau dans l'app et notification de l'appareil)
  const seen = useRef(null);
  const refreshUnread = useCallback(async () => {
    if (!uid()) return;
    try {
      const pro = profile?.company_id;
      const [ns, convs, reads, pend] = await Promise.all([
        api.select('notifications', { user_id: uid(), read: false }, { columns: 'id,title,body,link,category,created_at', order: 'created_at.desc', limit: 50 }),
        api.select('conversations', {}, { columns: 'id,last_at', order: 'last_at.desc', limit: 200 }),
        api.select('conversation_reads', { user_id: uid() }),
        pro ? api.select('appointments', { company_id: pro, status: 'a_valider' }, { columns: 'id' }) : Promise.resolve([]),
      ]);
      const rm = Object.fromEntries(reads.map((r) => [r.conversation_id, r.last_read_at]));
      const msg = convs.filter((c) => c.last_message !== '' && (!rm[c.id] || rm[c.id] < c.last_at)).length;
      setUnread({ notifs: ns.length, messages: msg, reads: rm, rdv: pend.length });
      if (seen.current) {
        const fresh = ns.filter((n) => !seen.current.has(n.id));
        if (fresh.length) {
          const prefs = profile?.notif_prefs || {};
          const h = new Date().getHours();
          const quiet = prefs.dnd && (h >= 21 || h < 8);
          const n0 = fresh[0];
          if (!quiet) {
            showToast(fresh.length > 1 ? t('{n} nouvelles notifications', { n: fresh.length }) : '🔔 ' + t(n0.title) + (n0.body ? ' · ' + n0.body : ''));
            if (prefs.push !== false && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
              try { const sys = new Notification(t(n0.title), { body: n0.body || '', icon: '/icon-192.png', tag: n0.id }); sys.onclick = () => { window.focus(); if (n0.link) navigate(n0.link); sys.close(); }; } catch {}
            }
          }
        }
      }
      seen.current = new Set(ns.map((n) => n.id));
    } catch {}
  }, [profile?.id, profile?.company_id, profile?.notif_prefs]);
  useEffect(() => { if (profile) subscribePush(); }, [profile?.id]);
  useEffect(() => { if (!profile) return; seen.current = null; refreshUnread(); const i = setInterval(refreshUnread, 10000); return () => clearInterval(i); }, [profile?.id, refreshUnread]);

  function applyTheme(th) {
    setThemeState(th);
    try { localStorage.setItem('ay-theme', th); } catch {}
    if (th === 'dark') document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme;
  }
  async function setTheme(th) { applyTheme(th); if (profile) { await api.update('profiles', { id: profile.id }, { theme: th }); setProfile({ ...profile, theme: th }); } }
  async function setLang(l) { await loadLang(l); setI18nLang(l); setLangState(l); if (profile) { await api.update('profiles', { id: profile.id }, { lang: l }); setProfile({ ...profile, lang: l }); } }

  showToastRef.current = (m) => toast(m);
  const toast = useCallback((msg, err = false) => {
    clearTimeout(toastTimer.current); setToast({ msg, err });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  // Fenêtres génériques
  const confirm = (opts) => new Promise((resolve) => setDialog({ type: 'confirm', ...opts, resolve }));
  const wip = (what) => setDialog({ type: 'wip', what });
  const run = async (fn, okMsg) => {
    try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
    catch (e) { toast(e.message || t('Une erreur est survenue'), true); throw e; }
  };

  const can = (perm) => {
    if (!profile) return false;
    if (profile.member_role === 'gerant') return true;
    return !!profile.permissions?.[perm];
  };

  const value = { session, profile, setProfile, company, setCompany, teams, setTeams, members, setMembers, ready, reload: load, lang, setLang, theme, setTheme,
    toast, confirm, wip, run, can, unread, refreshUnread, isPro: profile?.kind === 'artisan' && !!profile?.company_id };
  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && <div className={'toast' + (toastMsg.err ? ' err' : '')} role="status">{toastMsg.msg}</div>}
      {dialog && <Dialog d={dialog} close={() => setDialog(null)} />}
    </Ctx.Provider>
  );
}

function Dialog({ d, close }) {
  const done = (v) => { d.resolve?.(v); close(); };
  if (d.type === 'wip') return (
    <div className="overlay center" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="big-ico" style={{ background: 'var(--navy)' }}>🛠️</div>
        <h3>{t('En cours de création')}</h3>
        <p className="muted">{d.what ? t('{x} arrive très bientôt dans Artis & You.', { x: d.what }) : t('Cette fonctionnalité arrive très bientôt dans Artis & You.')}</p>
        <button className="btn block mt" onClick={close}>{t('Compris')}</button>
      </div>
    </div>
  );
  return (
    <div className="overlay center" onClick={() => done(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{d.title}</h3>
        {d.text && <p className="muted">{d.text}</p>}
        <div className="btns" style={{ gridTemplateColumns: '1fr 1fr', display: 'grid' }}>
          <button className="btn ghost" onClick={() => done(false)}>{d.cancel || t('Annuler')}</button>
          <button className={'btn' + (d.danger ? '' : ' navy')} onClick={() => done(true)}>{d.ok || t('Confirmer')}</button>
        </div>
      </div>
    </div>
  );
}
