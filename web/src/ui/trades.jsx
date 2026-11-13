// Liste des métiers : ceux de l'application + ceux proposés par les pros et validés par l'équipe Artesa.
// TradePicker : choix multiple par catégorie, avec « Ajouter mon métier » (anti-doublons, validation par l'équipe).
import { useEffect, useState } from 'react';
import { LuPlus, LuClock } from 'react-icons/lu';
import { api, OFFLINE } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { TRADES, tradeNorm, similarTrades } from '../lib/docs.js';
import { Chips, Sheet, Field } from './index.jsx';

let cache = null, loading = null;
const subs = new Set();
const merge = (rows) => {
  const groups = Object.fromEntries(Object.entries(TRADES).map(([g, l]) => [g, [...l]]));
  const known = new Set(Object.values(groups).flat().map(tradeNorm));
  const pending = [];
  for (const r of rows || []) {
    if (known.has(tradeNorm(r.name))) continue;
    if (r.status === 'valide') { (groups[r.category] = groups[r.category] || []).push(r.name); known.add(tradeNorm(r.name)); }
    else if (r.status === 'en_attente') pending.push(r.name);
  }
  return { groups, all: Object.values(groups).flat(), pending };
};
export function loadTrades(force) {
  if (cache && !force) return Promise.resolve(cache);
  if (!loading || force) {
    loading = (OFFLINE ? api.select('trades', {}) : api.select('trades', {}, { order: 'name.asc' }))
      .catch(() => [])
      .then((rows) => { cache = merge(rows); subs.forEach((f) => f(cache)); loading = null; return cache; });
  }
  return loading;
}
export function useTrades() {
  const [c, setC] = useState(cache || merge([]));
  useEffect(() => { subs.add(setC); loadTrades(); return () => subs.delete(setC); }, []);
  return c;
}

export function TradePicker({ value = [], onChange, canAdd = true }) {
  const cat = useTrades();
  const [add, setAdd] = useState(false);
  // Métiers choisis qui ne sont pas (encore) dans la liste : proposés par ce pro, en attente de validation
  const extra = value.filter((x) => !cat.all.some((y) => tradeNorm(y) === tradeNorm(x)));
  return (
    <>
      {Object.entries(cat.groups).map(([g, list]) => (
        <div key={g}><div className="small bold red-t" style={{ margin: '6px 0' }}>{t(g).toUpperCase()}</div>
          <Chips multi options={list.map((x) => [x, t(x)])} value={value} onChange={onChange} /></div>
      ))}
      {extra.length > 0 && (
        <div><div className="small bold red-t" style={{ margin: '6px 0' }}>{t('Mes métiers ajoutés').toUpperCase()}</div>
          <Chips multi options={extra.map((x) => [x, x])} value={value} onChange={onChange} />
          <p className="small faint"><LuClock size={12} /> {t('En attente de validation par l’équipe Artesa : visible des particuliers et des autres pros après validation.')}</p></div>
      )}
      {canAdd && <button type="button" className="btn ghost sm mt" onClick={() => setAdd(true)}><LuPlus /> {t('Mon métier n’est pas dans la liste')}</button>}
      {add && <AddTrade cat={cat} onClose={() => setAdd(false)} onPick={(name) => { if (!value.includes(name)) onChange([...value, name]); setAdd(false); }} />}
    </>
  );
}

function AddTrade({ cat, onClose, onPick }) {
  const cats = [...Object.keys(cat.groups), 'Autres métiers'].filter((x, i, a) => a.indexOf(x) === i);
  const [v, setV] = useState({ name: '', category: cats[0] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const near = similarTrades(v.name, [...cat.all, ...cat.pending]);
  const exact = near.find((x) => tradeNorm(x) === tradeNorm(v.name));
  const submit = async () => {
    if (busy) return; setErr('');
    if (exact) return onPick(exact);
    setBusy(true);
    try {
      const r = await api.rpc('propose_trade', { p_name: v.name, p_category: v.category });
      await loadTrades(true);
      onPick(r.name);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={t('Ajouter mon métier')}>
      <Field label={t('Catégorie')}><select value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>{cats.map((c) => <option key={c} value={c}>{t(c)}</option>)}</select></Field>
      <Field label={t('Nom du métier')} hint={t('au singulier, ex. « Ferronnerie d’art »')}><input value={v.name} maxLength={60} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus /></Field>
      {near.length > 0 && (
        <div className="notice small">
          <b>{exact ? t('Ce métier existe déjà :') : t('Vouliez-vous dire :')}</b>
          <div className="chips mt">{near.map((x) => <button key={x} type="button" className="chip" onClick={() => onPick(x)}>{t(x)}</button>)}</div>
        </div>
      )}
      <p className="small faint">{t('Votre métier est ajouté à votre fiche tout de suite. L’équipe Artesa le relit (orthographe, doublons) avant de le proposer aux autres pros et aux particuliers.')}</p>
      {err && <div className="error" role="alert">{err}</div>}
      <button type="button" className="btn block mt" disabled={busy || v.name.trim().length < 3} onClick={submit}>{busy ? t('Envoi…') : exact ? t('Choisir « {n} »', { n: t(exact) }) : t('Ajouter « {n} »', { n: v.name.trim() || '…' })}</button>
    </Sheet>
  );
}
