// Recadrage d'une image (logo, photo de profil) : glisser pour déplacer, curseur ou molette pour zoomer
import { useEffect, useRef, useState } from 'react';
import { LuZoomIn, LuZoomOut, LuRotateCw } from 'react-icons/lu';
import { t } from '../lib/i18n.js';
import { Sheet } from './index.jsx';

const BOX = 260; // taille de l'aperçu à l'écran

export function CropSheet({ file, round = false, onClose, onDone, size = 512, title }) {
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [bg, setBg] = useState('#FFFFFF');
  const drag = useRef(null);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const i = new Image(); i.onload = () => { setImg(i); setZoom(1); setRot(0); setPos({ x: 0, y: 0 }); }; i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!file) return null;
  // Échelle de base : l'image remplit le cadre (côté le plus court)
  const w = img ? (rot % 180 ? img.height : img.width) : 1, h = img ? (rot % 180 ? img.width : img.height) : 1;
  const base = img ? BOX / Math.min(w, h) : 1;
  const fit = img ? BOX / Math.max(w, h) : 1; // image entière visible (utile pour les logos)
  const minZoom = fit / base;
  const s = base * zoom;
  const clamp = (p, z = zoom) => {
    const sw = w * base * z, sh = h * base * z;
    const mx = Math.max(0, (sw - BOX) / 2), my = Math.max(0, (sh - BOX) / 2);
    return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) };
  };
  const setZ = (z) => { const nz = Math.max(minZoom, Math.min(4, z)); setZoom(nz); setPos((p) => clamp(p, nz)); };
  const down = (e) => { drag.current = { x: e.clientX, y: e.clientY, p: pos }; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const move = (e) => { const d = drag.current; if (!d) return; setPos(clamp({ x: d.p.x + e.clientX - d.x, y: d.p.y + e.clientY - d.y })); };
  const up = () => { drag.current = null; };
  const save = () => {
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const g = c.getContext('2d');
    if (!round || zoom < 1) { g.fillStyle = bg; g.fillRect(0, 0, size, size); }
    const k = size / BOX;
    g.translate(size / 2 + pos.x * k, size / 2 + pos.y * k);
    g.rotate((rot * Math.PI) / 180);
    g.scale(s * k, s * k);
    g.drawImage(img, -img.width / 2, -img.height / 2);
    c.toBlob((b) => onDone(new File([b], (file.name || 'image').replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' })), 'image/png');
  };
  return (
    <Sheet open onClose={onClose} title={title || t('Recadrer l’image')}>
      <div className="crop-wrap">
        <div className={'crop-box' + (round ? ' round' : '')} style={{ width: BOX, height: BOX, background: bg }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          onWheel={(e) => { e.preventDefault(); setZ(zoom * (e.deltaY < 0 ? 1.08 : 0.92)); }}>
          {img && <img src={img.src} alt="" draggable={false} style={{ position: 'absolute', left: '50%', top: '50%', width: img.width * s, height: img.height * s, maxWidth: 'none', transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) rotate(${rot}deg)` }} />}
        </div>
      </div>
      <div className="row" style={{ gap: 10, margin: '12px 0' }}>
        <button type="button" className="iconbtn" onClick={() => setZ(zoom / 1.15)} aria-label={t('Dézoomer')}><LuZoomOut /></button>
        <input type="range" min={minZoom} max={4} step={0.01} value={zoom} onChange={(e) => setZ(+e.target.value)} style={{ flex: 1 }} aria-label={t('Zoom')} />
        <button type="button" className="iconbtn" onClick={() => setZ(zoom * 1.15)} aria-label={t('Zoomer')}><LuZoomIn /></button>
        <button type="button" className="iconbtn" onClick={() => { setRot((r) => (r + 90) % 360); setPos({ x: 0, y: 0 }); }} aria-label={t('Pivoter')}><LuRotateCw /></button>
      </div>
      <div className="row small" style={{ gap: 8, justifyContent: 'space-between' }}>
        <span className="muted">{t('Glissez pour déplacer · molette ou curseur pour zoomer')}</span>
        <span className="row" style={{ gap: 6 }}>{t('Fond')} {['#FFFFFF', '#00123B', '#7F1111', '#F4F1EC'].map((x) => <button type="button" key={x} onClick={() => setBg(x)} aria-label={x} style={{ width: 22, height: 22, borderRadius: 11, background: x, border: bg === x ? '2px solid var(--bordeaux)' : '1px solid var(--line-2)' }} />)}</span>
      </div>
      <div className="btns"><div className="two"><button type="button" className="btn ghost" onClick={() => setZ(minZoom)}>{t('Image entière')}</button><button type="button" className="btn" onClick={save} disabled={!img}>{t('Utiliser cette image')}</button></div></div>
    </Sheet>
  );
}
