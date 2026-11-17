// Références de loi cliquables : une bulle s'ouvre dans Artesa (résumé en clair + référence exacte),
// avec un lien vers le texte officiel. Légifrance interdit l'affichage de ses pages dans un autre site
// (en-tête X-Frame-Options : SAMEORIGIN), le texte complet s'ouvre donc dans un nouvel onglet.
import { useState } from 'react';
import { LuScale, LuExternalLink, LuInfo } from 'react-icons/lu';
import { Sheet } from './index.jsx';
import { t } from '../lib/i18n.js';
import { LAWS, LAWS_CHECKED } from '../lib/laws.js';

export function LawSheet({ id, onClose }) {
  const l = id && LAWS[id];
  if (!l) return null;
  const host = (() => { try { return new URL(l.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  return (
    <Sheet open onClose={onClose} title={l.ref}>
      <div className="small bold red-t mb">{l.code}</div>
      {l.title && <h3 style={{ fontSize: 18, margin: '0 0 8px' }}>{l.title}</h3>}
      <div className="card soft"><div className="small bold mb">{t('En clair')}</div><p style={{ margin: 0, lineHeight: 1.6 }}>{l.resume}</p></div>
      {l.note && <div className="notice small mt">{l.note}</div>}
      {l.url && (
        <a className="btn block mt" href={l.url} target="_blank" rel="noopener noreferrer">
          <LuExternalLink /> {t('Lire le texte officiel')}{host ? ` (${host})` : ''}
        </a>
      )}
      <p className="small faint mt" style={{ lineHeight: 1.5 }}>
        <LuInfo size={12} /> {t('Le texte officiel s’ouvre dans un nouvel onglet : le site de l’État ne peut pas s’afficher à l’intérieur d’Artesa. Résumé vérifié le {d}, il ne remplace pas l’avis d’un professionnel du droit.', { d: LAWS_CHECKED })}
      </p>
    </Sheet>
  );
}

// Une référence : petite étiquette cliquable (ex. « Code conso L221-18 »)
export function LawRef({ id, children }) {
  const [open, setOpen] = useState(false);
  const l = LAWS[id];
  if (!l) return children || null;
  return (
    <>
      <button type="button" className="chip law" onClick={(e) => { e.stopPropagation(); setOpen(true); }} title={t('Voir le texte de loi')}>
        <LuScale size={13} /> {children || l.ref}
      </button>
      {open && <LawSheet id={id} onClose={() => setOpen(false)} />}
    </>
  );
}

export function LawRefs({ ids = [], title }) {
  const list = ids.filter((x) => LAWS[x]);
  if (!list.length) return null;
  return (
    <div className="mt">
      <div className="small bold mb">{title || t('Textes de loi')}</div>
      <div className="chips wrap" style={{ gap: 6 }}>{list.map((id) => <LawRef key={id} id={id} />)}</div>
    </div>
  );
}

// Petite bulle d'information (« Comment sont classés les résultats ? ») avec ses textes de loi
export function InfoBubble({ label, title, children, laws = [] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="link small" onClick={() => setOpen(true)}><LuInfo size={13} /> {label}</button>
      {open && (
        <Sheet open onClose={() => setOpen(false)} title={title || label}>
          <div style={{ lineHeight: 1.6 }}>{children}</div>
          <LawRefs ids={laws} />
        </Sheet>
      )}
    </>
  );
}
