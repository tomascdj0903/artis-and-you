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
      // Toute la barre change d'un coup selon le fond dominant derrière elle (comme sur iOS), avec un écart
      // entre les deux seuils pour qu'elle ne clignote pas quand le fond est à la limite
      const r = bar.getBoundingClientRect(); const ls = [];
      for (let i = 0; i < 14; i++) for (const fy of [0.3, 0.7]) { const c = bgAt(r.left + r.width * (i + 0.5) / 14, r.top + r.height * fy, bar); if (c) ls.push(lum(c)); }
      const avg = ls.length ? ls.reduce((x, y) => x + y, 0) / ls.length : 1;
      const wasDark = bar.classList.contains('on-dark');
      const dark = wasDark ? avg < 0.24 : avg < 0.16;
      bar.classList.toggle('on-dark', dark);
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
