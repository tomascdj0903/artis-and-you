// Écran affiché quand une page plante, à la place d'une page blanche.
// Une erreur de chargement de fichier (nouvelle version mise en ligne entre-temps) recharge l'app une fois toute seule.
import { Component } from 'react';
import { t } from '../lib/i18n.js';

const isChunk = (e) => /dynamically imported module|Importing a module script failed|Failed to fetch|error loading/i.test(String(e?.message || e));

export class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) {
    console.error('Artesa', error);
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
