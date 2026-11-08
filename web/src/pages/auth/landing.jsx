// Page d'accueil publique (visiteurs non connectés) : présentation, métiers, villes — pensée pour le référencement
import { useEffect } from 'react';
import { LuCheck, LuCalendarCheck, LuFilePen, LuMessageSquare, LuShieldCheck } from 'react-icons/lu';
import { Link } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';

const TRADES = ['Plombier', 'Électricien', 'Peintre', 'Carreleur', 'Menuisier', 'Maçon', 'Couvreur', 'Chauffagiste', 'Serrurier', 'Paysagiste', 'Climaticien', 'Plaquiste'];
const CITIES = ['Nice', 'Cannes', 'Antibes', 'Monaco', 'Grasse', 'Menton', 'Cagnes-sur-Mer', 'Marseille', 'Toulon', 'Lyon', 'Paris', 'Montpellier'];

export function Landing() {
  useEffect(() => {
    document.title = t('Artis & You · Devis, factures et rendez-vous pour artisans du bâtiment');
  }, []);
  return (
    <div className="lp">
      <header className="lp-top">
        <Link to="/" className="lp-brand"><img src="/logo.svg" alt="" width="34" height="34" /><span>Artis &amp; You</span></Link>
        <nav className="lp-nav"><Link to="/connexion">{t('Se connecter')}</Link><Link to="/inscription" className="btn sm">{t('Créer un compte')}</Link></nav>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-txt">
          <h1>{t('Le chantier, du premier appel à la dernière facture.')}</h1>
          <p className="lp-lead">{t('Artis & You réunit les artisans et leurs clients : prise de rendez-vous, devis signés en ligne, factures conformes, messages et documents du logement, au même endroit.')}</p>
          <div className="lp-ctas">
            <Link to="/inscription/artisan" className="btn">{t('Je suis artisan')}</Link>
            <Link to="/inscription/particulier" className="btn navy">{t('Je cherche un artisan')}</Link>
          </div>
          <p className="small muted">{t('30 jours d’essai pour les artisans, sans carte bancaire. Gratuit pour les particuliers.')}</p>
        </div>
        {/* Une journée type, telle qu'elle apparaît dans l'application */}
        <div className="lp-feed" aria-hidden="true">
          <div className="lp-ev"><LuCalendarCheck /><div><b>{t('Demande de RDV')}</b><small>{t('Lucie F. · Fuite sous évier · jeudi 14:00')}</small></div><span className="lp-tag">{t('À valider')}</span></div>
          <div className="lp-ev"><LuFilePen /><div><b>{t('Devis DE-2026-0042 signé')}</b><small>{t('Rénovation salle de bain · 4 860,00 € TTC')}</small></div><span className="lp-tag ok">{t('Signé')}</span></div>
          <div className="lp-ev"><LuMessageSquare /><div><b>{t('Message de Tiago B.')}</b><small>{t('« Je vous envoie les photos du chauffe-eau »')}</small></div></div>
          <div className="lp-ev"><LuShieldCheck /><div><b>{t('Facture FA-2026-0107 payée')}</b><small>{t('Virement reçu · 1 290,00 €')}</small></div><span className="lp-tag ok">{t('Payée')}</span></div>
        </div>
      </section>

      <section className="lp-two">
        <div className="lp-col pro">
          <h2>{t('Pour les artisans')}</h2>
          <ul>{['Devis et factures conformes, numérotés automatiquement', 'Signature électronique des devis par vos clients', 'Planning d’équipe et demandes de rendez-vous en ligne', 'Relances automatiques des impayés', 'Factures d’acompte, de situation et avoirs', 'Export comptable et suivi de votre chiffre d’affaires'].map((x) => <li key={x}><LuCheck />{t(x)}</li>)}</ul>
          <Link to="/inscription/artisan" className="btn light">{t('Essayer gratuitement')}</Link>
        </div>
        <div className="lp-col cli">
          <h2>{t('Pour les particuliers')}</h2>
          <ul>{['Trouvez un artisan vérifié près de chez vous', 'Prenez rendez-vous en ligne, sur site ou en visio', 'Signez vos devis et payez vos factures en ligne', 'Gardez tous les documents de votre logement', 'Échangez avec vos artisans par message'].map((x) => <li key={x}><LuCheck />{t(x)}</li>)}</ul>
          <Link to="/inscription/particulier" className="btn">{t('Créer mon compte gratuit')}</Link>
        </div>
      </section>

      <section className="lp-seo">
        <h2>{t('Des artisans de tous les métiers du bâtiment')}</h2>
        <p className="muted">{TRADES.map(t).join(', ')}.</p>
        <h2>{t('Partout en France')}</h2>
        <p className="muted">{t('Artis & You est née à Nice et se développe dans toute la France : {c}…', { c: CITIES.join(', ') })}</p>
      </section>

      <footer className="lp-foot">
        <span>© {new Date().getFullYear()} Artis &amp; You</span>
        <nav><Link to="/mentions-legales">{t('Mentions légales')}</Link><Link to="/cgu">{t('CGU')}</Link><Link to="/confidentialite">{t('Confidentialité')}</Link><Link to="/telecharger">{t('Applications')}</Link></nav>
      </footer>
    </div>
  );
}
