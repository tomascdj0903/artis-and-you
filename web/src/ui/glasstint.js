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
      for (const a of bar.querySelectorAll(':scope > a')) {
        const r = a.getBoundingClientRect();
        const c = bgAt(r.left + r.width / 2, r.top + r.height / 2, bar);
        const dark = c ? lum(c) < 0.18 : false;
        a.classList.toggle('on-dark', dark); a.classList.toggle('on-light', !dark);
      }
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
