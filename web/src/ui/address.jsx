// Saisie d'adresse et de ville avec propositions (API Adresse et API Géo de l'État, gratuites, sans clé)
import { useEffect, useRef, useState } from 'react';
import { LuMapPin } from 'react-icons/lu';
import { t } from '../lib/i18n.js';

export const COUNTRIES = ['France', 'Monaco', 'Belgique', 'Suisse', 'Luxembourg', 'Italie', 'Espagne', 'Portugal', 'Allemagne', 'Royaume-Uni', 'Autre'];

function useSuggest(fetcher, q, min = 3) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!q || q.trim().length < min) { setList([]); return; }
    let alive = true;
    const h = setTimeout(async () => {
      try { const r = await fetcher(q.trim()); if (alive) setList(r); } catch { if (alive) setList([]); }
    }, 250);
    return () => { alive = false; clearTimeout(h); };
  }, [q]);
  return [list, setList];
}

function Suggestions({ list, onPick }) {
  if (!list.length) return null;
  return (
    <div className="suggest" role="listbox">
      {list.map((s, i) => <button type="button" key={i} role="option" onMouseDown={(e) => { e.preventDefault(); onPick(s); }}><LuMapPin /><span><b>{s.main}</b>{s.sub && <small>{s.sub}</small>}</span></button>)}
    </div>
  );
}

const fetchAddress = async (q) => {
  const r = await fetch('https://api-adresse.data.gouv.fr/search/?limit=6&q=' + encodeURIComponent(q)).then((x) => x.json());
  return (r.features || []).map((f) => ({ main: f.properties.name, sub: `${f.properties.postcode} ${f.properties.city}`, address: f.properties.type === 'municipality' ? '' : f.properties.name, zip: f.properties.postcode, city: f.properties.city, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] }));
};
export const fetchCities = async (q) => {
  const isZip = /^\d{2,5}$/.test(q);
  const url = 'https://geo.api.gouv.fr/communes?fields=nom,codesPostaux,centre,departement&boost=population&limit=8&' + (isZip ? 'codePostal=' + q : 'nom=' + encodeURIComponent(q));
  const r = await fetch(url).then((x) => x.json());
  return r.map((c) => ({ main: c.nom, sub: `${(c.codesPostaux || [])[0] || ''} · ${c.departement?.nom || ''}`, city: c.nom, zip: (c.codesPostaux || [])[0] || '', lat: c.centre?.coordinates?.[1], lon: c.centre?.coordinates?.[0] }));
};

// Bloc adresse complet : adresse (avec propositions), code postal, ville, pays
export function AddressFields({ value, onChange, required, keys = {} }) {
  const k = { address: 'address', zip: 'zip', city: 'city', country: 'country', ...keys };
  const v = value || {};
  const [focus, setFocus] = useState(null);
  const [addr, setAddr] = useSuggest(fetchAddress, focus === 'a' && (v[k.country] || 'France') === 'France' ? v[k.address] : '');
  const [cities, setCities] = useSuggest(fetchCities, focus === 'c' && (v[k.country] || 'France') === 'France' ? v[k.city] || v[k.zip] : '', 2);
  const set = (patch) => { const p2 = { ...patch }; delete p2.null; delete p2.undefined; onChange({ ...v, ...p2 }); };
  return (
    <div className="form-grid two addr">
      <label className="field full suggest-wrap"><span>{t('Adresse')}</span>
        <input value={v[k.address] || ''} required={required} autoComplete="street-address" onFocus={() => setFocus('a')} onBlur={() => setTimeout(() => setFocus(null), 150)}
          onChange={(e) => set({ [k.address]: e.target.value })} placeholder={t('Numéro et rue')} />
        {focus === 'a' && <Suggestions list={addr} onPick={(s) => { set({ [k.address]: s.address || v[k.address], [k.zip]: s.zip, [k.city]: s.city, [k.country]: 'France' }); setAddr([]); }} />}
      </label>
      <label className="field"><span>{t('Code postal')}</span>
        <input value={v[k.zip] || ''} required={required} inputMode="numeric" autoComplete="postal-code" onFocus={() => setFocus('c')} onBlur={() => setTimeout(() => setFocus(null), 150)} onChange={(e) => set({ [k.zip]: e.target.value })} />
      </label>
      <label className="field suggest-wrap"><span>{t('Ville')}</span>
        <input value={v[k.city] || ''} required={required} autoComplete="address-level2" onFocus={() => setFocus('c')} onBlur={() => setTimeout(() => setFocus(null), 150)} onChange={(e) => set({ [k.city]: e.target.value })} />
        {focus === 'c' && <Suggestions list={cities} onPick={(s) => { set({ [k.city]: s.city, [k.zip]: s.zip || v[k.zip], [k.country]: 'France' }); setCities([]); }} />}
      </label>
      {k.country && <label className="field full"><span>{t('Pays')}</span>
        <select value={v[k.country] || 'France'} onChange={(e) => set({ [k.country]: e.target.value })}>{COUNTRIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}</select>
      </label>}
    </div>
  );
}

// Champ ville seul avec propositions (zone d'intervention, filtres)
export function CityInput({ value, onChange, onPick, placeholder, className = 'input' }) {
  const [focus, setFocus] = useState(false);
  const [list, setList] = useSuggest(fetchCities, focus ? value : '', 2);
  return (
    <div className="suggest-wrap" style={{ position: 'relative' }}>
      <input className={className} value={value || ''} placeholder={placeholder} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} onChange={(e) => onChange(e.target.value)} />
      {focus && <Suggestions list={list} onPick={(s) => { onChange(s.city); onPick?.(s); setList([]); }} />}
    </div>
  );
}

export const distanceKm = (a, b) => {
  if (!a?.lat || !b?.lat) return null;
  const R = 6371, r = (x) => (x * Math.PI) / 180;
  const dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
};
