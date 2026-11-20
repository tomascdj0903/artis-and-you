// Recherche d'artisan avec suggestions pendant la frappe (Notion n° 24) :
// dès 2 lettres, une liste propose les métiers qui correspondent (sans tenir compte des accents : « elagage » → « Élagage »)
// et les entreprises dont le nom ou le métier correspond. Un clic ouvre directement le métier ou la fiche.
import { useEffect, useRef, useState } from 'react';
import { LuHammer, LuSearch, LuChevronRight } from 'react-icons/lu';
import { api } from '../lib/api.js';
import { navigate } from '../lib/router.jsx';
import { t } from '../lib/i18n.js';
import { tradeNorm } from '../lib/docs.js';
import { useTrades } from './trades.jsx';
import { SearchBar } from './index.jsx';

const coName = (c) => c.trade_name || c.name;

export function ArtisanSearch({ value, onChange, onSubmit, placeholder, ...rest }) {
  const cat = useTrades();
  const [open, setOpen] = useState(false);
  const [pros, setPros] = useState([]);
  const [hi, setHi] = useState(-1);
  const box = useRef(null);
  const q = String(value || '').trim();
  const nq = tradeNorm(q);
  // Métiers : d'abord ceux qui commencent par ce qui est tapé (« elag » → Élagage avant Carrelage), puis ceux qui le contiennent
  const score = (x) => { const a = tradeNorm(x), b = tradeNorm(t(x)); return a.startsWith(nq) || b.startsWith(nq) || a.split(' ').some((w) => w.startsWith(nq)) ? 0 : a.includes(nq) || b.includes(nq) ? 1 : 9; };
  const trades = nq.length >= 2 ? (cat.all || []).map((x) => [x, score(x)]).filter(([, n]) => n < 9).sort((x, y) => x[1] - y[1]).slice(0, 4).map(([x]) => x) : [];

  // Entreprises : recherche par nom ou métier, avec un petit délai pour ne pas interroger à chaque lettre
  useEffect(() => {
    if (q.length < 2) { setPros([]); return; }
    let live = true;
    const tm = setTimeout(async () => {
      const byName = await api.rpc('directory_search', { p_query: q, p_trade: '', p_city: '' }).catch(() => []);
      const byTrade = (await Promise.all(trades.slice(0, 2).map((x) => api.rpc('directory_search', { p_query: '', p_trade: x, p_city: '' }).catch(() => [])))).flat();
      const seen = new Set(); const all = [...(byName || []), ...byTrade].filter((c) => c && !seen.has(c.id) && seen.add(c.id));
      if (live) setPros(all.sort((a, b) => b.is_mine - a.is_mine).slice(0, 5));
    }, 220);
    return () => { live = false; clearTimeout(tm); };
  }, [q, trades.slice(0, 2).join('|')]);

  const items = [
    ...trades.map((x) => ({ key: 't:' + x, kind: 'trade', label: t(x), go: () => navigate('/client/artisans?metier=' + encodeURIComponent(x)) })),
    ...pros.map((c) => ({ key: 'p:' + c.id, kind: 'pro', label: coName(c), sub: [(c.trades || []).slice(0, 2).map(t).join(' · '), c.city].filter(Boolean).join(' · '), go: () => navigate('/client/artisans/' + c.id) })),
  ];
  const show = open && q.length >= 2;
  const pick = (it) => { setOpen(false); it.go(); };
  const onKey = (e) => {
    if (!show) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(items.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(-1, h - 1)); }
    else if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'Enter' && hi >= 0 && items[hi]) { e.preventDefault(); e.stopPropagation(); pick(items[hi]); }
  };
  useEffect(() => { setHi(-1); }, [q]);
  useEffect(() => {
    const out = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', out); return () => document.removeEventListener('pointerdown', out);
  }, []);

  return (
    <div className="asg" ref={box} onKeyDownCapture={onKey}>
      <SearchBar {...rest} placeholder={placeholder} value={value} onChange={(v) => { onChange(v); setOpen(true); }} onFocus={() => setOpen(true)} onSubmit={() => { setOpen(false); onSubmit?.(); }} />
      {show && (
        <div className="asg-list" role="listbox" aria-label={t('Suggestions')}>
          {trades.length > 0 && <div className="asg-h">{t('Métiers')}</div>}
          {items.filter((x) => x.kind === 'trade').map((it) => { const i = items.indexOf(it); return (
            <button key={it.key} type="button" role="option" aria-selected={hi === i} className={'asg-it' + (hi === i ? ' on' : '')} onMouseEnter={() => setHi(i)} onClick={() => pick(it)}>
              <span className="asg-ic"><LuHammer /></span><span className="grow"><b>{it.label}</b><small>{t('Voir les artisans')}</small></span><LuChevronRight />
            </button>); })}
          {pros.length > 0 && <div className="asg-h">{t('Artisans')}</div>}
          {items.filter((x) => x.kind === 'pro').map((it) => { const i = items.indexOf(it); return (
            <button key={it.key} type="button" role="option" aria-selected={hi === i} className={'asg-it' + (hi === i ? ' on' : '')} onMouseEnter={() => setHi(i)} onClick={() => pick(it)}>
              <span className="asg-ic av">{it.label.slice(0, 1).toUpperCase()}</span><span className="grow"><b>{it.label}</b>{it.sub && <small>{it.sub}</small>}</span><LuChevronRight />
            </button>); })}
          <button type="button" className="asg-it all" onClick={() => { setOpen(false); onSubmit?.(); }}><span className="asg-ic"><LuSearch /></span><span className="grow"><b>{t('Rechercher « {q} »', { q })}</b></span></button>
        </div>
      )}
    </div>
  );
}
