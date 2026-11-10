// Signature de l'entreprise : une signature « texte » (nom + police manuscrite, obligatoire) et une signature dessinée (facultative)
import { useEffect, useRef } from 'react';
import { LuEraser, LuPenLine, LuType } from 'react-icons/lu';
import { t } from '../lib/i18n.js';

export const SIG_FONTS = ['Dancing Script', 'Great Vibes', 'Allura', 'Sacramento', 'Caveat', 'Homemade Apple'];

// Les polices manuscrites ne servent qu'ici : on ne les charge qu'à la première signature, pas sur toutes les pages
let sigFonts = null;
export const loadSigFonts = () => sigFonts || (sigFonts = new Promise((res) => {
  const l = document.createElement('link'); l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?' + SIG_FONTS.map((f) => 'family=' + f.replace(/ /g, '+') + (f === 'Caveat' || f === 'Dancing Script' ? ':wght@600' : '')).join('&') + '&display=swap';
  l.onload = res; l.onerror = res; document.head.appendChild(l); setTimeout(res, 4000);
}));

// Transforme le nom écrit dans la police choisie en image PNG (fond transparent)
export async function textSignature(name, font, color = '#2B1F1C') {
  await loadSigFonts();
  try { await document.fonts.load(`64px "${font}"`, name); } catch {}
  const c = document.createElement('canvas'); const x = c.getContext('2d');
  x.font = `64px "${font}"`; const w = Math.ceil(x.measureText(name).width) + 40;
  c.width = Math.max(200, w); c.height = 120;
  x.font = `64px "${font}"`; x.fillStyle = color; x.textBaseline = 'middle'; x.fillText(name, 20, 64);
  return c.toDataURL('image/png');
}

export function DrawPad({ value, onChange }) {
  const ref = useRef(null); const drawing = useRef(false); const dirty = useRef(false);
  useEffect(() => {
    const c = ref.current; const r = c.getBoundingClientRect(); const k = window.devicePixelRatio || 1;
    c.width = r.width * k; c.height = r.height * k; const x = c.getContext('2d'); x.scale(k, k);
    x.lineWidth = 2.4; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#2B1F1C';
    if (value) { const im = new Image(); im.onload = () => x.drawImage(im, 0, 0, r.width, r.height); im.src = value; }
  }, []);
  const pos = (e) => { const r = ref.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const down = (e) => { e.preventDefault(); ref.current.setPointerCapture(e.pointerId); drawing.current = true; const x = ref.current.getContext('2d'); x.beginPath(); x.moveTo(...pos(e)); };
  const move = (e) => { if (!drawing.current) return; const x = ref.current.getContext('2d'); x.lineTo(...pos(e)); x.stroke(); dirty.current = true; };
  const up = () => { if (!drawing.current) return; drawing.current = false; if (dirty.current) onChange(ref.current.toDataURL('image/png')); };
  const clear = () => { const c = ref.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); dirty.current = false; onChange(''); };
  return (
    <div>
      <canvas ref={ref} className="sigpad" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} aria-label={t('Zone de signature')} />
      <div className="row between mt" style={{ marginTop: 6 }}><span className="small faint">{t('Signez avec la souris, le doigt ou un stylet.')}</span><button type="button" className="btn xs ghost" onClick={clear}><LuEraser /> {t('Effacer')}</button></div>
    </div>
  );
}

// p : réglages PDF (sig_name, sig_font, sig_text, sig_drawn, sig_use, signature)
export function SignatureEditor({ p, setP, defaultName }) {
  const name = p.sig_name ?? defaultName ?? '';
  const font = p.sig_font || SIG_FONTS[0];
  const update = async (patch) => {
    const n = { ...p, sig_name: name, sig_font: font, ...patch };
    if ('sig_name' in patch || 'sig_font' in patch || !n.sig_text) n.sig_text = n.sig_name.trim() ? await textSignature(n.sig_name.trim(), n.sig_font) : '';
    if (!n.sig_drawn && n.sig_use === 'drawn') n.sig_use = 'text';
    n.signature = (n.sig_use === 'drawn' && n.sig_drawn) ? n.sig_drawn : n.sig_text;
    setP(n);
  };
  useEffect(() => { loadSigFonts(); if (!p.sig_text && name.trim()) update({}); }, []);
  const use = p.sig_use === 'drawn' && p.sig_drawn ? 'drawn' : 'text';
  return (
    <div className="sig-editor">
      <div className="small bold mb"><LuType /> {t('Signature avec votre nom')} <span className="faint">({t('obligatoire')})</span></div>
      <div className="field"><input value={name} onChange={(e) => update({ sig_name: e.target.value })} placeholder={t('Prénom Nom')} aria-label={t('Prénom Nom')} /></div>
      <div className="sig-fonts">{SIG_FONTS.map((f) => (
        <button key={f} type="button" aria-label={f} aria-pressed={font === f} className={font === f ? 'on' : ''} onClick={() => update({ sig_font: f })} style={{ fontFamily: `"${f}", cursive` }}>{name || t('Prénom Nom')}</button>
      ))}</div>
      <div className="small bold mb" style={{ marginTop: 16 }}><LuPenLine /> {t('Signature manuscrite')} <span className="faint">({t('facultatif')})</span></div>
      <DrawPad value={p.sig_drawn} onChange={(v) => update({ sig_drawn: v })} />
      <div className="small bold mb" style={{ marginTop: 16 }}>{t('Signature affichée sur vos devis et factures')}</div>
      <div className="sig-use">
        <button type="button" aria-label={t('Signature avec votre nom')} aria-pressed={use === 'text'} className={use === 'text' ? 'on' : ''} onClick={() => update({ sig_use: 'text' })}>{p.sig_text ? <img src={p.sig_text} alt="" /> : <span className="faint">{t('Saisissez votre nom')}</span>}</button>
        <button type="button" aria-label={t('Signature manuscrite')} aria-pressed={use === 'drawn'} className={use === 'drawn' ? 'on' : ''} disabled={!p.sig_drawn} onClick={() => update({ sig_use: 'drawn' })}>{p.sig_drawn ? <img src={p.sig_drawn} alt="" /> : <span className="faint">{t('Aucune signature dessinée')}</span>}</button>
      </div>
    </div>
  );
}
