// Composants d'interface partagés
import { useEffect, useState, useCallback, useRef } from 'react';
import { LuChevronLeft, LuChevronRight, LuSlidersHorizontal, LuSearch, LuBell, LuX, LuCamera, LuInbox } from 'react-icons/lu';
import { navigate, Link } from '../lib/router.jsx';
import { useApp } from '../lib/store.jsx';
import { fileUrls, cachedUrl } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { initials } from '../lib/format.js';

export function useData(fn, deps = []) {
  const [state, set] = useState({ data: null, loading: true, error: null });
  const alive = useRef(true);
  const load = useCallback(async () => {
    try { const d = await fn(); if (alive.current) set({ data: d, loading: false, error: null }); }
    catch (e) { console.error(e); if (alive.current) set({ data: null, loading: false, error: e.message }); }
  }, deps);
  useEffect(() => { alive.current = true; set((s) => ({ ...s, loading: true })); load(); return () => { alive.current = false; }; }, [load]);
  return [state.data, load, state.loading, state.error];
}

export function Avatar({ name = '', last = '', path, ring, size = '', onClick, color }) {
  const [url, setUrl] = useState(path ? cachedUrl(path) : null);
  useEffect(() => { if (path) fileUrls([path]).then((r) => setUrl(r[path])); else setUrl(null); }, [path]);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`avatar ${ring ? 'ring' : ''} ${size}`} onClick={onClick} style={color ? { background: color } : undefined} aria-label={onClick ? t('Mon compte') : undefined}>
      {url ? <img src={url} alt="" /> : initials(name, last)}
    </Tag>
  );
}

export function TopBar({ title, sub, back = true, right, onBack, home }) {
  const { profile, isPro, unread } = useApp();
  const base = isPro ? '/pro' : '/client';
  return (
    <header className={'topbar' + (home ? ' home-top' : '')}>
      <div>
        {back ? <button className="iconbtn" onClick={onBack || (() => (history.length > 1 ? navigate(-1) : navigate(base)))} aria-label={t('Retour')}><LuChevronLeft /></button>
          : <Link to={base} className="logo-btn hide-desk" aria-label="Artis & You"><img src="/logo.svg" alt="" /></Link>}
      </div>
      <div className="title">{title && <h1>{title}</h1>}{sub && <div className="sub">{sub}</div>}</div>
      <div className="right">
        {right}
        <Link to={base + '/notifications'} className="iconbtn hide-mob" aria-label={t('Notifications')}><LuBell />{unread.notifs > 0 && <span className="dot" />}</Link>
        {profile && <Avatar name={profile.first_name} last={profile.last_name} path={profile.avatar_path} ring={!isPro} onClick={() => navigate(base + '/compte')} />}
      </div>
    </header>
  );
}

export function SearchBar({ placeholder, value, onChange, onFilter, filterActive, onSubmit }) {
  return (
    <div className="searchrow">
      <label className="search">
        <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSubmit?.()} aria-label={placeholder} />
        {value ? <button className="link" style={{ color: '#fff' }} onClick={() => onChange('')} aria-label={t('Effacer')}><LuX /></button> : <LuSearch />}
      </label>
      {onFilter && <button className="filterbtn" onClick={onFilter} aria-label={t('Filtrer')}><LuSlidersHorizontal />{filterActive && <span className="dot" />}</button>}
    </div>
  );
}

export function Sec({ title, meta, to, children }) {
  return (
    <div className="sec">
      <h2>{to ? <Link to={to} className="more">{title} <LuChevronRight /></Link> : title}</h2>
      {meta && <span className="meta">{meta}</span>}
      {children}
    </div>
  );
}

export function KV({ rows }) {
  return (
    <div className="kv">
      {rows.filter(Boolean).map(([k, v, o = {}], i) => (
        <div className={'r' + (o.total ? ' total' : '')} key={i}>
          <span className="k">{k}</span>
          <span className={'v' + (o.red ? ' red' : '')}>{o.href ? <a href={o.href} target={o.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{v}</a> : (v === '' || v == null ? '—' : v)}</span>
        </div>
      ))}
    </div>
  );
}

export function Table({ cols, rows, onRow, empty }) {
  if (!rows.length) return <Empty text={empty || t('Aucun élément')} />;
  return (
    <div className="table-wrap">
      <table className="t">
        <thead><tr>{cols.map((c, i) => <th key={i} className={c.num ? 'num' : ''} style={c.w ? { width: c.w } : undefined}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i} className={onRow ? 'click' : ''} onClick={onRow ? () => onRow(r) : undefined} tabIndex={onRow ? 0 : undefined} onKeyDown={onRow ? (e) => e.key === 'Enter' && onRow(r) : undefined}>
              {cols.map((c, j) => <td key={j} className={(c.num ? 'num ' : '') + (c.strong ? 'strong' : '')}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const Pill = ({ c = 'grey', children }) => <span className={'pill ' + c}>{children}</span>;
export const StatusPill = ({ s }) => <Pill c={s[0]}>{s[1]}</Pill>;

export function Sheet({ open, onClose, title, right, children }) {
  useEffect(() => {
    if (!open) return;
    const f = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [open]);
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="grab" />
        {title && <div className="row between mb"><h3>{title}</h3>{right || <button className="iconbtn" onClick={onClose} aria-label={t('Fermer')}><LuX /></button>}</div>}
        {children}
      </div>
    </div>
  );
}

export function Modal({ open, onClose, children }) {
  if (!open) return null;
  return <div className="overlay center" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">{children}</div></div>;
}

export const Empty = ({ text, icon: I = LuInbox, children }) => <div className="empty"><I />{text}{children && <div className="mt">{children}</div>}</div>;
export const Loader = () => <div className="loader"><div className="spin" /></div>;

export function Chips({ options, value, onChange, multi, red, scroll }) {
  const on = (v) => (multi ? value.includes(v) : value === v);
  const toggle = (v) => (multi ? onChange(on(v) ? value.filter((x) => x !== v) : [...value, v]) : onChange(v));
  return <div className={'chips' + (scroll ? ' scroll' : '')}>{options.map(([v, l]) => <button key={v} type="button" className={'chip' + (red ? ' red' : '') + (on(v) ? ' on' : '')} onClick={() => toggle(v)}>{l}</button>)}</div>;
}
export function Seg({ options, value, onChange }) {
  return <div className="seg">{options.map(([v, l]) => <button key={v} type="button" className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}</div>;
}

export function Field({ label, hint, children }) {
  return <label className="field"><span>{label} {hint && <span className="hint">{hint}</span>}</span>{children}</label>;
}
export function Toggle({ checked, onChange, label }) {
  return <input type="checkbox" className="toggle" checked={!!checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />;
}

export function pickFiles({ accept = '*/*', multiple = true } = {}) {
  return new Promise((resolve) => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept; i.multiple = multiple;
    i.onchange = () => resolve([...i.files]);
    i.click();
  });
}

export function Img({ path, alt = '', className, onClick }) {
  const [url, setUrl] = useState(cachedUrl(path));
  useEffect(() => { if (path) fileUrls([path]).then((r) => setUrl(r[path])); }, [path]);
  if (!url) return <div className={'ph ' + (className || '')} onClick={onClick}><LuCamera /></div>;
  return <img src={url} alt={alt} className={className} onClick={onClick} loading="lazy" />;
}

export function Lightbox({ path, onClose }) {
  if (!path) return null;
  return <div className="overlay center" onClick={onClose}><Img path={path} className="" /></div>;
}

export async function openFile(path, name) {
  const r = await fileUrls([path]);
  const url = r[path];
  if (!url) return;
  const a = document.createElement('a'); a.href = url; a.download = name || ''; a.target = '_blank'; a.rel = 'noreferrer';
  document.body.appendChild(a); a.click(); a.remove();
}

export function Stars({ n = 0, size }) {
  const full = Math.round(n);
  return <span className="stars" style={size ? { fontSize: size } : undefined} aria-label={`${n}/5`}>{'★'.repeat(full)}{'☆'.repeat(5 - full)}</span>;
}

export function ConfirmBar({ children }) { return <div className="btns">{children}</div>; }
