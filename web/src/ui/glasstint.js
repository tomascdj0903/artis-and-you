// Barre d'onglets en verre (mobile) : chaque onglet passe en clair au-dessus d'un fond foncé
// (tuile terracotta, carte encre…) et en foncé au-dessus d'un fond clair, comme sur iOS.
import { useEffect } from 'react';

const parse = (c) => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };

// Couleur de fond réelle sous un point, en ignorant la barre elle-même et les boutons flottants
function bgAt(x, y, bar) {
  for (const el of document.elementsFromPoint(x, y)) {
    if (bar.contains(el) || el.closest('.fabm, .fabm-veil, [data-glass-skip]')) continue;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a >= 0.5) return c;
    }
  }
  return parse(getComputedStyle(document.body).backgroundColor);
}


// Masque progressif pour un onglet : une grille de points sous l'onglet donne, pour chaque zone, la part de
// « fond foncé ». Le masque (petite image agrandie, donc lissée) révèle la couche blanche là où le fond est foncé
// et la couche foncée ailleurs : une même icône peut être blanche d'un côté et foncée de l'autre, en dégradé.
const COLS = 12, ROWS = 5;
const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
if (cv) { cv.width = COLS; cv.height = ROWS; }
function masks(a, bar) {
  const r = a.getBoundingClientRect(); const ctx = cv.getContext('2d');
  const img = ctx.createImageData(COLS, ROWS); const inv = ctx.createImageData(COLS, ROWS);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const c = bgAt(r.left + (x + 0.5) * r.width / COLS, r.top + (y + 0.5) * r.height / ROWS, bar);
    const L = c ? lum(c) : 1;
    const k = Math.max(0, Math.min(1, (0.32 - L) / 0.22)); // 1 = fond foncé, 0 = fond clair, entre les deux : transition
    const i = (y * COLS + x) * 4;
    img.data[i + 3] = Math.round(k * 255); inv.data[i + 3] = 255 - img.data[i + 3];
  }
  ctx.putImageData(img, 0, 0); const white = cv.toDataURL();
  ctx.putImageData(inv, 0, 0); const ink = cv.toDataURL();
  return { white, ink };
}
function setMask(el, url) {
  if (!el) return;
  const v = url ? `url(${url})` : '';
  el.style.webkitMaskImage = v; el.style.maskImage = v;
}
function paintTab(a, bar) {
  const w = a.querySelector('.tb-white'), k = a.querySelector('.tb-ink');
  if (!w || !k || !cv) return;
  if (a.classList.contains('on')) { setMask(w, null); setMask(k, null); return; } // onglet actif : toujours blanc sur le verre terracotta
  const m = masks(a, bar); setMask(w, m.white); setMask(k, m.ink);
}

export function useGlassTint(ref, deps = []) {
  useEffect(() => {
    const bar = ref.current; if (!bar) return;
    const mq = window.matchMedia('(max-width: 1023px)');
    let raf = 0;
    const run = () => {
      raf = 0;
      if (!mq.matches) return;
      // Plusieurs points sous l'élément : on garde la luminosité moyenne (évite qu'un interstice blanc décide seul)
      const tint = (el, zone, xs = [0.5]) => {
        const r = el.getBoundingClientRect();
        const ls = xs.map((f) => bgAt(r.left + r.width * f, r.top + r.height / 2, zone)).filter(Boolean).map(lum);
        const dark = ls.length ? ls.reduce((a, b) => a + b, 0) / ls.length < 0.18 : false;
        el.classList.toggle('on-dark', dark); el.classList.toggle('on-light', !dark);
      };
      for (const a of bar.querySelectorAll(':scope > a')) { tint(a, bar); paintTab(a, bar); }
      // En-tête flottant des accueils (verre quasi transparent sur mobile)
      for (const h of document.querySelectorAll('.hb-head')) tint(h, h, [0.1, 0.25, 0.4, 0.6, 0.75, 0.9]);
    };
    const ask = () => { if (!raf) raf = requestAnimationFrame(run); };
    ask();
    window.addEventListener('scroll', ask, { passive: true, capture: true });
    window.addEventListener('resize', ask);
    const mo = new MutationObserver(ask);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { window.removeEventListener('scroll', ask, { capture: true }); window.removeEventListener('resize', ask); mo.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, deps);
}
