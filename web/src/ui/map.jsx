// Petite carte OpenStreetMap sans dépendance : tuiles 256 px (Web Mercator), déplacement au doigt / à la souris, zoom +/−
import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../lib/i18n.js';

const TILE = 256;
const lon2x = (lon, z) => ((lon + 180) / 360) * TILE * 2 ** z;
const lat2y = (lat, z) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE * 2 ** z; };

// Zoom qui fait tenir tous les points dans la carte
function fitZoom(points, w, h) {
  if (points.length < 2) return 12;
  for (let z = 15; z >= 3; z--) {
    const xs = points.map((p) => lon2x(p.lon, z)), ys = points.map((p) => lat2y(p.lat, z));
    if (Math.max(...xs) - Math.min(...xs) < w - 70 && Math.max(...ys) - Math.min(...ys) < h - 70) return z;
  }
  return 3;
}

export function MapView({ center, markers = [], height = 360, onPick, selected }) {
  const box = useRef(null);
  const [w, setW] = useState(600);
  const pts = markers.filter((m) => m.lat != null && m.lon != null);
  const all = center ? [...pts, center] : pts;
  const initZoom = useMemo(() => fitZoom(all, w, height), [all.map((p) => p.lat + ',' + p.lon).join('|'), w, height]); // eslint-disable-line
  const [z, setZ] = useState(initZoom);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  useEffect(() => { setZ(initZoom); setOff({ x: 0, y: 0 }); }, [initZoom]);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 600)); ro.observe(el); setW(el.clientWidth || 600);
    return () => ro.disconnect();
  }, []);
  if (!all.length) return null;
  // centre : point demandé, sinon milieu des marqueurs
  const cx0 = center ? lon2x(center.lon, z) : (Math.min(...all.map((p) => lon2x(p.lon, z))) + Math.max(...all.map((p) => lon2x(p.lon, z)))) / 2;
  const cy0 = center ? lat2y(center.lat, z) : (Math.min(...all.map((p) => lat2y(p.lat, z))) + Math.max(...all.map((p) => lat2y(p.lat, z)))) / 2;
  const cx = cx0 - off.x, cy = cy0 - off.y;
  const left = cx - w / 2, top = cy - height / 2;
  const n = 2 ** z;
  const tiles = [];
  for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + w) / TILE); tx++) {
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++) {
      if (ty < 0 || ty >= n) continue;
      const wx = ((tx % n) + n) % n;
      tiles.push(<img key={tx + ':' + ty} alt="" draggable={false} src={`https://${'abc'[(tx + ty) % 3]}.tile.openstreetmap.org/${z}/${wx}/${ty}.png`} style={{ left: tx * TILE - left, top: ty * TILE - top }} />);
    }
  }
  // déplacement
  const down = (e) => { drag.current = { x: e.clientX, y: e.clientY, o: off, moved: false }; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const move = (e) => { const d = drag.current; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true; setOff({ x: d.o.x + dx, y: d.o.y + dy }); };
  const up = () => { setTimeout(() => { drag.current = null; }, 0); };
  const zoom = (dz) => { const nz = Math.max(3, Math.min(17, z + dz)); const f = 2 ** (nz - z); setOff({ x: off.x * f, y: off.y * f }); setZ(nz); };
  return (
    <div className="omap" ref={box} style={{ height }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoom(e.deltaY < 0 ? 1 : -1); } }}>
      <div className="omap-tiles">{tiles}</div>
      {center && <span className="omap-home" style={{ left: lon2x(center.lon, z) - left, top: lat2y(center.lat, z) - top }} title={t('Lieu des travaux')} />}
      {pts.map((m) => (
        <button key={m.id} type="button" className={'omap-pin' + (selected === m.id ? ' on' : '') + (m.hi ? ' hi' : '')} style={{ left: lon2x(m.lon, z) - left, top: lat2y(m.lat, z) - top }}
          onClick={(e) => { e.stopPropagation(); if (!drag.current?.moved) onPick?.(m); }} aria-label={m.label} title={m.label}>
          <span>{m.short || ''}</span>
        </button>
      ))}
      <div className="omap-zoom"><button type="button" onClick={() => zoom(1)} aria-label={t('Zoomer')}>+</button><button type="button" onClick={() => zoom(-1)} aria-label={t('Dézoomer')}>−</button></div>
      <a className="omap-attr" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© {t('contributeurs OpenStreetMap')}</a>
    </div>
  );
}
