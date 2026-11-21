// Écran affiché quand une page plante, à la place d'une page blanche.
// Une erreur de chargement de fichier (nouvelle version mise en ligne entre-temps) recharge l'app une fois toute seule.
import { Component } from 'react';
import { t } from '../lib/i18n.js';

import { api } from '../lib/api.js';

// Suivi des erreurs en production : message + page (sans identifiants ni e-mails), 10 envois max par session, sans doublon
const sent = new Set();
const scrub = (x) => String(x || '').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '<email>').replace(/\b\d{6,}\b/g, '<n>');
const NOISE = /ResizeObserver loop|Script error\.?$|Load failed|NetworkError|Failed to fetch|AbortError|The user aborted|cancelled|annulé/i;
export function reportError(err, extra = '') {
  try {
    if (!err || err.shown || location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;
    const msg = scrub(err.message || err).slice(0, 500);
    if (!msg || NOISE.test(msg) || isChunk(err) || sent.size >= 10 || sent.has(msg)) return;
    sent.add(msg);
    api.rpc('log_client_error', { p_message: msg, p_path: location.pathname, p_stack: scrub((err.stack || '') + (extra ? '\n' + extra : '')).slice(0, 4000), p_agent: navigator.userAgent.slice(0, 300) }).catch(() => {});
  } catch {}
}
export function installErrorTracking() {
  window.addEventListener('error', (ev) => reportError(ev.error || ev.message));
  window.addEventListener('unhandledrejection', (ev) => { if (ev.reason?.shown) { ev.preventDefault(); return; } reportError(ev.reason); });
}

const isChunk = (e) => /dynamically imported module|Importing a module script failed|Failed to fetch|error loading/i.test(String(e?.message || e));

export class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error('Artis & You', error);
    reportError(error, info?.componentStack?.slice(0, 1500));
    if (isChunk(error)) {
      try { if (Date.now() - Number(sessionStorage.getItem('ay-reloaded') || 0) > 30000) { sessionStorage.setItem('ay-reloaded', String(Date.now())); location.reload(); } } catch {}
    }
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <h1>{t('Un problème est survenu')}</h1>
        <p className="muted">{t('Cette page n’a pas pu s’afficher. Vos données ne sont pas perdues.')}</p>
        <div className="row" style={{ gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => location.reload()}>{t('Recharger')}</button>
          {this.props.home && <a className="btn ghost" href={this.props.home}>{t('Retour à l’accueil')}</a>}
        </div>
      </div>
    );
  }
}
