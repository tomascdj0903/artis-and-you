// Rafraîchissement périodique qui ménage la batterie et les données :
// à l'écran, toutes les `ms` ; en arrière-plan, toutes les `hiddenMs` (0 = en pause) ; au retour à l'écran, tout de suite.
export function poll(fn, ms, hiddenMs = 0) {
  let last = Date.now();
  const tick = () => {
    const every = document.hidden ? hiddenMs : ms;
    if (!every || Date.now() - last < every - 50) return;
    last = Date.now(); fn();
  };
  const i = setInterval(tick, Math.min(ms, hiddenMs || ms));
  const vis = () => { if (!document.hidden) { last = Date.now(); fn(); } };
  document.addEventListener('visibilitychange', vis);
  return () => { clearInterval(i); document.removeEventListener('visibilitychange', vis); };
}
