// Bouton « + » unique, présent sur toutes les pages pro : un toucher déploie un menu d'actions
// qui s'adapte à la page (planning, client, documents…) et se termine toujours par « Demander à l'assistant ».
// Une page peut fournir sa propre action principale avec <Fab primary={…} /> ; sinon le bouton global s'affiche.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { LuPlus, LuX, LuSparkles, LuCalendarPlus, LuFilePen, LuFileText, LuUserPlus, LuUsers, LuMegaphone, LuMessageSquare, LuSearch } from 'react-icons/lu';
import { t } from '../lib/i18n.js';
import { navigate, useLocation as useRoute } from '../lib/router.jsx';
import { TOURS } from './tour.jsx';

// Nombre de pages qui affichent leur propre <Fab> (dans ce cas le bouton global se cache)
let owners = 0; const subs = new Set();
const bump = (n) => { owners += n; subs.forEach((f) => f()); };
const useOwners = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => owners);

function routeActions(path) {
  const m = path.match(/^\/pro\/clients\/([0-9a-f-]{36})/);
  if (m) return [
    { label: t('Nouveau devis pour ce client'), icon: LuFilePen, to: '/pro/documents/nouveau?kind=devis&client=' + m[1] },
    { label: t('Nouveau RDV pour ce client'), icon: LuCalendarPlus, to: '/pro/planning/nouveau?client=' + m[1] },
    { label: t('Nouvelle facture pour ce client'), icon: LuFileText, to: '/pro/documents/nouveau?kind=facture&client=' + m[1] },
  ];
  if (path.startsWith('/pro/planning')) return [
    { label: t('Nouveau rendez-vous'), icon: LuCalendarPlus, to: '/pro/planning/nouveau' },
    { label: t('Nouveau client'), icon: LuUserPlus, to: '/pro/clients/nouveau' },
  ];
  if (path.startsWith('/pro/documents')) return [
    { label: t('Nouveau devis'), icon: LuFilePen, to: '/pro/documents/nouveau?kind=devis' },
    { label: t('Nouvelle facture'), icon: LuFileText, to: '/pro/documents/nouveau?kind=facture' },
  ];
  if (path.startsWith('/pro/clients')) return [
    { label: t('Nouveau client'), icon: LuUserPlus, to: '/pro/clients/nouveau' },
    { label: t('Inviter mes clients sur Artesa'), icon: LuMegaphone, to: '/pro/reseau/inviter-clients' },
  ];
  if (path.startsWith('/pro/reseau')) return [
    { label: t('Ajouter un pro'), icon: LuUsers, to: '/pro/reseau/ajouter' },
    { label: t('Inviter mes clients sur Artesa'), icon: LuMegaphone, to: '/pro/reseau/inviter-clients' },
  ];
  if (path.startsWith('/pro/messages')) return [
    { label: t('Inviter mes clients sur Artesa'), icon: LuMegaphone, to: '/pro/reseau/inviter-clients' },
  ];
  if (path.startsWith('/pro/crm')) return [
    { label: t('Nouveau devis'), icon: LuFilePen, to: '/pro/documents/nouveau?kind=devis' },
  ];
  return [
    { label: t('Nouveau rendez-vous'), icon: LuCalendarPlus, to: '/pro/planning/nouveau' },
    { label: t('Nouveau devis'), icon: LuFilePen, to: '/pro/documents/nouveau?kind=devis' },
    { label: t('Nouveau client'), icon: LuUserPlus, to: '/pro/clients/nouveau' },
  ];
}

export function Fab({ primary, hidden }) {
  const { path } = useRoute();
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState(false);
  useEffect(() => setOpen(false), [path]);
  if (hidden) return null;
  const extra = routeActions(path).filter((a) => !primary || a.label !== primary.label);
  const items = [...(primary ? [primary] : []), ...extra];
  const go = (a) => { setOpen(false); a.onClick ? a.onClick() : navigate(a.to); };
  return (
    <>
      {open && <div className="fabm-veil" onClick={() => setOpen(false)} />}
      <div className={'fabm' + (open ? ' open' : '')}>
        {open && <div className="fabm-list" role="menu">
          {items.map((a) => { const I = a.icon || LuPlus; return <button key={a.label} role="menuitem" onClick={() => go(a)}><span>{a.label}</span><i><I /></i></button>; })}
          <button role="menuitem" className="ai" onClick={() => { setOpen(false); setAsk(true); }}><span>{t('Demander à l’assistant')}</span><i><LuSparkles /></i></button>
        </div>}
        <button className="fab fabm-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? t('Fermer') : t('Actions')}>{open ? <LuX /> : <LuPlus />}</button>
      </div>
      {ask && <Assistant onClose={() => setAsk(false)} />}
    </>
  );
}

// À placer dans une page pour remplacer l'action principale du menu (ex. « Nouvelle conversation »)
export function PageFab(props) {
  useEffect(() => { bump(1); return () => bump(-1); }, []);
  return <Fab {...props} />;
}

// Bouton global (main.jsx) : s'efface quand la page a son propre PageFab
export function GlobalFab() {
  const n = useOwners();
  const { path } = useRoute();
  if (n > 0 || !path.startsWith('/pro') || /\/(nouveau|modifier|rdv\/|messages\/[^/]+$|chat$)/.test(path)) return null;
  return <Fab />;
}

// Assistant, étape 1 : répond aux questions sur l'utilisation d'Artesa à partir des tutoriels de l'app.
// (L'IA branchée sur un serveur viendra remplacer cette recherche, sans changer l'interface.)
const HELP = Object.values(TOURS).flat().filter((s) => s && s.title && s.text);
const nz = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function Assistant({ onClose }) {
  const [q, setQ] = useState('');
  const [msgs, setMsgs] = useState([{ me: false, text: t('Bonjour ! Posez-moi une question sur Artesa : faire signer un devis, déplacer un RDV, inviter un client…') }]);
  const send = () => {
    const words = nz(q).split(/\W+/).filter((w) => w.length > 2);
    if (!words.length) return;
    const ranked = HELP.map((s) => ({ s, n: words.filter((w) => nz(t(s.title) + ' ' + t(s.text)).includes(w)).length })).filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 2);
    const ans = ranked.length ? ranked.map((x) => '• ' + t(x.s.title) + ' : ' + t(x.s.text)).join('\n\n') : t('Je n’ai pas trouvé de réponse. Essayez d’autres mots, ou écrivez-nous depuis Paramètres › Aide et support.');
    setMsgs((m) => [...m, { me: true, text: q }, { me: false, text: ans }]); setQ('');
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet ai-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('Assistant')}>
        <div className="row" style={{ justifyContent: 'space-between' }}><b className="row" style={{ gap: 8 }}><LuSparkles className="red-t" /> {t('Assistant Artesa')}</b><button className="iconbtn" onClick={onClose} aria-label={t('Fermer')}><LuX /></button></div>
        <div className="ai-msgs">{msgs.map((m, i) => <div key={i} className={'ai-msg' + (m.me ? ' me' : '')}>{m.text}</div>)}</div>
        <form className="ai-in" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Votre question…')} autoFocus />
          <button className="btn sm" aria-label={t('Envoyer')}><LuSearch /></button>
        </form>
      </div>
    </div>
  );
}
