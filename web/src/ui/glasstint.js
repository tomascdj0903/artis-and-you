// Barre d'onglets (et en-tête des accueils) en verre sur mobile : passe en clair au-dessus d'un fond foncé
// (tuile terracotta, carte encre…) et en foncé au-dessus d'un fond clair, comme sur iOS.
// Performance : la détection lit ce qu'il y a sous quelques points seulement, au plus ~7 fois par seconde
// pendant le défilement (et une dernière fois à l'arrêt), avec un cache des couleurs de fond par élément.
import { useEffect } from 'react';

const parse = (c) => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };

let cache = new WeakMap(); // élément -> couleur de fond opaque trouvée (ou null)
function bgOf(el) {
  if (cache.has(el)) return cache.get(el);
  let res = null;
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const c = parse(getComputedStyle(n).backgroundColor);
    if (c && c.a >= 0.5) { res = c; break; }
  }
  cache.set(el, res);
  return res;
}
// Couleur de fond réelle sous un point, en ignorant la zone en verre elle-même et les boutons flottants
function bgAt(x, y, zone) {
  for (const el of document.elementsFromPoint(x, y)) {
    if (zone.contains(el) || el.closest('.fabm, .fabm-veil, .hb-head, .tabbar, [data-glass-skip]')) continue;
    const c = bgOf(el); if (c) return c;
  }
  return parse(getComputedStyle(document.body).backgroundColor);
}
// Luminosité moyenne sous quelques points d'une zone ; écart entre les deux seuils pour éviter le clignotement
function shade(el, xs) {
  const r = el.getBoundingClientRect(); if (!r.width) return;
  let sum = 0, n = 0;
  for (const f of xs) { const c = bgAt(r.left + r.width * f, r.top + r.height / 2, el); if (c) { sum += lum(c); n++; } }
  const avg = n ? sum / n : 1;
  const dark = el.classList.contains('on-dark') ? avg < 0.24 : avg < 0.16;
  if (dark !== el.classList.contains('on-dark')) { el.classList.toggle('on-dark', dark); el.classList.toggle('on-light', !dark); }
}

const BAR_X = [0.07, 0.21, 0.36, 0.5, 0.64, 0.79, 0.93];
const HEAD_X = [0.15, 0.4, 0.65, 0.9];

export function useGlassTint(ref, deps = []) {
  useEffect(() => {
    const bar = ref.current; if (!bar) return;
    const mq = window.matchMedia('(max-width: 1023px)');
    let timer = 0, last = 0, raf = 0;
    const run = () => {
      raf = 0; last = performance.now();
      if (!mq.matches) return;
      shade(bar, BAR_X);
      for (const h of document.querySelectorAll('.glass-tint')) shade(h, HEAD_X);
    };
    // Au plus une détection toutes les 140 ms pendant le défilement, plus une à l'arrêt
    const ask = () => {
      clearTimeout(timer);
      if (performance.now() - last > 140) { if (!raf) raf = requestAnimationFrame(run); }
      timer = setTimeout(() => { if (!raf) raf = requestAnimationFrame(run); }, 160);
    };
    const changed = () => { cache = new WeakMap(); ask(); };
    ask();
    window.addEventListener('scroll', ask, { passive: true, capture: true });
    window.addEventListener('resize', changed);
    const mo = new MutationObserver(changed);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { window.removeEventListener('scroll', ask, { capture: true }); window.removeEventListener('resize', changed); mo.disconnect(); clearTimeout(timer); if (raf) cancelAnimationFrame(raf); };
  }, deps);
}
