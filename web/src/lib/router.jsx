import { useEffect, useState, createElement } from 'react';
const subs = new Set();
export function navigate(to, { replace = false } = {}) {
  if (to === -1) { history.back(); return; }
  if (replace) history.replaceState(null, '', to); else history.pushState(null, '', to);
  window.scrollTo(0, 0);
  subs.forEach((f) => f());
}
window.addEventListener('popstate', () => subs.forEach((f) => f()));
export function useLocation() {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set((x) => x + 1); subs.add(f); return () => subs.delete(f); }, []);
  return { path: location.pathname, query: new URLSearchParams(location.search) };
}
export function matchRoute(pattern, path) {
  const a = pattern.split('/').filter(Boolean), b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}
export function Link({ to, children, ...rest }) {
  return createElement('a', { href: to, ...rest, onClick: (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault(); rest.onClick?.(e); navigate(to);
  } }, children);
}
