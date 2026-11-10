// Bouton « + » unique, présent sur toutes les pages pro : un toucher déploie un menu d'actions
// qui s'adapte à la page (planning, client, documents…) et se termine toujours par « Demander à l'assistant ».
// Une page peut fournir sa propre action principale avec <Fab primary={…} /> ; sinon le bouton global s'affiche.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { LuHistory, LuRotateCcw, LuArrowLeft, LuPlus, LuX, LuSparkles, LuCalendarPlus, LuFilePen, LuFileText, LuUserPlus, LuUsers, LuMegaphone, LuMessageSquare, LuSend } from 'react-icons/lu';
import { t } from '../lib/i18n.js';
import { navigate, useLocation as useRoute } from '../lib/router.jsx';
import { searchKB, suggestFor, nz } from '../lib/assistant-kb.js';
import { runAction } from '../lib/assistant-actions.js';
import { DictateButton } from './dictate.jsx';
import { useApp } from '../lib/store.jsx';
import { api, OFFLINE, uid } from '../lib/api.js';
import { dateShort, hm } from '../lib/format.js';

// Conversation en cours : gardée quand on change de page ou qu'on referme l'assistant, remise à neuf après 2 min sans question.
// Historique : les 30 dernières questions, gardées sur l'appareil, pour les retrouver et les reposer.
const IDLE = 2 * 60 * 1000;
const ck = () => 'ay-ai-chat-' + (uid() || 'x'), hk = () => 'ay-ai-hist-' + (uid() || 'x');
const rd = (st, k) => { try { return JSON.parse(st.getItem(k) || 'null'); } catch { return null; } };
const wr = (st, k, v) => { try { st.setItem(k, JSON.stringify(v)); } catch {} };
export const aiHistory = () => rd(localStorage, hk()) || [];
const pushHistory = (q) => wr(localStorage, hk(), [{ q, at: Date.now() }, ...aiHistory().filter((h) => h.q !== q)].slice(0, 30));

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

// Assistant, étape 1 : répond à partir de la base de connaissances (lib/assistant-kb.js), avec des boutons
// qui ouvrent directement la bonne page. Avec l'IA, seules les fiches trouvées ici lui seront envoyées.
function Assistant({ onClose }) {
  const { path } = useRoute();
  const { company, profile } = useApp();
  const hello = () => [{ me: false, text: t('Bonjour ! Posez-moi une question sur Artesa, ou choisissez une suggestion :'), sugg: [{ id: 'x1', q: 'Mes rendez-vous de demain' }, { id: 'x2', q: 'Qui me doit de l’argent ?' }, { id: 'x3', q: 'Ouvrir mon dernier client' }, { id: 'x4', q: 'Que sais-tu faire ?' }, ...suggestFor(path).slice(0, 2)] }];
  const saved = useState(() => { const v = rd(sessionStorage, ck()); return v && Date.now() - v.at < IDLE ? v : null; })[0];
  const [q, setQ] = useState(saved?.q || '');
  const [msgs, setMsgs] = useState(saved?.msgs?.length ? saved.msgs : hello);
  const lastAt = useRef(saved?.at || 0);
  const [hist, setHist] = useState(null); // null = conversation ; [] = liste de l'historique
  useEffect(() => { if (lastAt.current || q) wr(sessionStorage, ck(), { at: lastAt.current || Date.now(), msgs: lastAt.current ? msgs.slice(-30) : [], q }); }, [msgs, q]);
  const reset = () => { try { sessionStorage.removeItem(ck()); } catch {} lastAt.current = 0; setMsgs(hello()); setQ(''); setHist(null); };
  const [busy, setBusy] = useState(false);
  // 1) on cherche les fiches d'aide ; 2) l'IA reformule à partir de ces fiches seulement (peu de tokens) ;
  // 3) si l'IA est indisponible ou hors quota, on affiche la fiche telle quelle.
  const answer = async (text) => {
    const hits = searchKB(text, path);
    const fallback = hits.length
      ? { me: false, text: t(hits[0].a), links: hits[0].links, sugg: hits.slice(1) }
      : { me: false, text: t('Je n’ai pas trouvé de réponse précise. Reformulez avec d’autres mots, ou écrivez au support.'), links: [{ label: 'Aide et support', to: '/pro/compte/aide' }] };
    const history = msgs.filter((m) => m.text).slice(-4);
    lastAt.current = Date.now(); pushHistory(text); setHist(null);
    setMsgs((m) => [...m, { me: true, text }]);
    // 0) Demande sur ses propres données (dernier client, RDV de demain, factures en retard…) : réponse directe, sans IA
    setBusy(true);
    const act = await runAction(text, { company, profile }).catch((e) => { console.warn('assistant', e); return null; });
    setBusy(false);
    if (act) { setMsgs((m) => [...m, { me: false, ...act }]); if (act.go && /^(ouvr|affich|montre|va |vas |aller|emmene|nouveau|nouvelle|cree|creer|fais|fait|prepare|ajoute|ajouter|programme|planifie|cale|ecri|redige)/.test(nz(text).replace(/^(peux.?tu|tu peux|pourrais.?tu|stp|svp|s il te plait|merci de|je veux|je voudrais|j aimerais)\s+/, ''))) setTimeout(() => open(act.go), 1100); return; }
    if (OFFLINE) { setMsgs((m) => [...m, fallback]); return; }
    setBusy(true);
    const r = await api.fn('assistant', { question: text, facts: hits.map((e) => ({ q: e.q, a: e.a })), history: history.map((m) => ({ me: m.me, text: m.text })) }).catch(() => ({}));
    setBusy(false);
    setMsgs((m) => [...m, r.answer ? { me: false, text: r.answer, links: hits[0]?.links || (r.error ? [] : [{ label: 'Aide et support', to: '/pro/compte/aide' }]), sugg: hits.slice(1), ai: !r.error } : fallback]);
  };
  const send = () => { if (q.trim()) { answer(q.trim()); setQ(''); } };
  const open = (to) => { onClose(); navigate(to); };
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet ai-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('Assistant')}>
        <div className="ai-head">
          {hist ? <button className="iconbtn" onClick={() => setHist(null)} aria-label={t('Retour')}><LuArrowLeft /></button> : <LuSparkles className="red-t" />}
          <b>{hist ? t('Historique') : t('Assistant Artesa')}</b>
          {!hist && <button className="iconbtn" onClick={() => setHist(aiHistory())} aria-label={t('Historique')} title={t('Historique')}><LuHistory /></button>}
          {!hist && msgs.length > 1 && <button className="iconbtn" onClick={reset} aria-label={t('Nouvelle conversation')} title={t('Nouvelle conversation')}><LuRotateCcw /></button>}
          <button className="iconbtn" onClick={onClose} aria-label={t('Fermer')}><LuX /></button>
        </div>
        {hist ? (
          <div className="ai-msgs ai-hist">
            {hist.length ? hist.map((h) => <button key={h.at + h.q} onClick={() => answer(h.q)}><span>{h.q}</span><small>{dateShort(new Date(h.at).toISOString())} · {hm(new Date(h.at).toISOString())}</small></button>)
              : <p className="muted small">{t('Vos questions apparaîtront ici.')}</p>}
            {hist.length > 0 && <button className="ai-hist-clear" onClick={() => { wr(localStorage, hk(), []); setHist([]); }}>{t('Effacer l’historique')}</button>}
          </div>
        ) : <div className="ai-msgs">
          {msgs.map((m, i) => (
            <div key={i} className={'ai-msg' + (m.me ? ' me' : '')}>
              {m.text}
              {m.links?.length > 0 && <div className="ai-links">{m.links.map((l) => l.href ? <a key={l.href} className="ai-link" href={l.href} target={l.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{t(l.label)} ›</a> : <button key={l.to + l.label} onClick={() => open(l.to)}>{t(l.label)} ›</button>)}</div>}
              {m.sugg?.length > 0 && <div className="ai-sugg">{m.sugg.map((e) => <button key={e.id} onClick={() => answer(t(e.q))}>{t(e.q)}</button>)}</div>}
            </div>
          ))}
          {busy && <div className="ai-msg ai-typing"><i /><i /><i /></div>}
          <div ref={end} />
        </div>}
        <form className="ai-in" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Votre question…')} autoFocus />
          <DictateButton className="btn sm ghost ai-mic" onText={(v) => { if (v.trim()) { setQ(''); answer(v.trim()); } }} />
          <button className="btn sm" disabled={busy} aria-label={t('Envoyer')}><LuSend /></button>
        </form>
      </div>
    </div>
  );
}
