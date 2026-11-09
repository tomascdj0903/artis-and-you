// Page d'accueil publique (visiteurs non connectés) : présentation, métiers, villes — pensée pour le référencement
import { useEffect } from 'react';
import { useState } from 'react';
import { LuCheck, LuX, LuHardHat, LuHouse, LuCalendarCheck, LuFilePen, LuMessageSquare, LuShieldCheck } from 'react-icons/lu';
import { Link } from '../../lib/router.jsx';
import { Wordmark } from '../../ui/index.jsx';
import { PLANS } from '../../lib/docs.js';
import { t } from '../../lib/i18n.js';

const TRADES = ['Plombier', 'Électricien', 'Peintre', 'Carreleur', 'Menuisier', 'Maçon', 'Couvreur', 'Chauffagiste', 'Serrurier', 'Paysagiste', 'Climaticien', 'Plaquiste'];
const CITIES = ['Nice', 'Cannes', 'Antibes', 'Monaco', 'Grasse', 'Menton', 'Cagnes-sur-Mer', 'Marseille', 'Toulon', 'Lyon', 'Paris', 'Montpellier'];

export function Landing() {
  useEffect(() => {
    document.title = t('Artesa · Facturation électronique, devis et rendez-vous pour artisans du bâtiment');
  }, []);
  return (
    <div className="lp">
      <header className="lp-top">
        <Link to="/" className="lp-brand" aria-label="Artesa"><Wordmark size={30} /></Link>
        <nav className="lp-nav"><a href="#tarifs" className="hide-mob">{t('Tarifs')}</a><Link to="/connexion">{t('Se connecter')}</Link><Link to="/inscription" className="btn sm">{t('Créer un compte')}</Link></nav>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-txt">
          <h1>{t('Devis, rendez-vous et facturation électronique : tout votre chantier au même endroit.')}</h1>
          <p className="lp-lead">{t('Artesa réunit les artisans et leurs clients : prise de rendez-vous, devis signés en ligne, factures électroniques conformes à la réforme 2026, messages et documents du logement, au même endroit.')}</p>
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

      <section className="lp-two only-desk">
        <div className="lp-col pro">
          <h2>{t('Pour les artisans')}</h2>
          <ul>{PRO_PTS.map((x) => <li key={x}><LuCheck />{t(x)}</li>)}</ul>
          <Link to="/inscription/artisan" className="btn light">{t('Essayer gratuitement')}</Link>
        </div>
        <div className="lp-col cli">
          <h2>{t('Pour les particuliers')}</h2>
          <ul>{CLI_PTS.map((x) => <li key={x}><LuCheck />{t(x)}</li>)}</ul>
          <Link to="/inscription/particulier" className="btn">{t('Créer mon compte gratuit')}</Link>
        </div>
      </section>
      <div className="only-mob"><Audience /></div>

      <Pricing />

      <section className="lp-seo">
        <h2>{t('Des artisans de tous les métiers du bâtiment')}</h2>
        <p className="muted">{TRADES.map(t).join(', ')}.</p>
        <h2>{t('Partout en France')}</h2>
        <p className="muted">{t('Artesa est née à Nice et se développe dans toute la France : {c}…', { c: CITIES.join(', ') })}</p>
      </section>

      <footer className="lp-foot">
        <span>© {new Date().getFullYear()} Artesa</span>
        <nav><Link to="/mentions-legales">{t('Mentions légales')}</Link><Link to="/cgu">{t('CGU')}</Link><Link to="/confidentialite">{t('Confidentialité')}</Link><Link to="/telecharger">{t('Applications')}</Link></nav>
      </footer>
    </div>
  );
}

const PRO_PTS = ['Facturation électronique intégrée, prête pour l’obligation 2026–2027', 'Devis et factures conformes, numérotés automatiquement', 'Signature électronique des devis par vos clients', 'Planning d’équipe et demandes de rendez-vous en ligne', 'Relances automatiques des impayés', 'Factures d’acompte, de situation et avoirs', 'Export comptable et suivi de votre chiffre d’affaires'];
const CLI_PTS = ['Trouvez un artisan vérifié près de chez vous', 'Prenez rendez-vous en ligne, sur site ou en visio', 'Signez vos devis et payez vos factures en ligne', 'Gardez tous les documents de votre logement', 'Échangez avec vos artisans par message'];

// Artisans / particuliers : deux onglets côte à côte, un seul panneau affiché (moins de défilement)
function Audience() {
  const [who, setWho] = useState('pro');
  const pro = who === 'pro';
  return (
    <section className="lp-aud">
      <div className="lp-switch" role="tablist" aria-label={t('Vous êtes')}>
        <button role="tab" aria-selected={pro} className={pro ? 'on' : ''} onClick={() => setWho('pro')}><LuHardHat /><span><b>{t('Artisan')}</b><small>{t('Gérer mon activité')}</small></span></button>
        <button role="tab" aria-selected={!pro} className={!pro ? 'on' : ''} onClick={() => setWho('cli')}><LuHouse /><span><b>{t('Particulier')}</b><small>{t('Trouver un artisan')}</small></span></button>
      </div>
      <div className={'lp-panel ' + (pro ? 'pro' : 'cli')} role="tabpanel">
        <h2>{pro ? t('Tout votre bureau dans la poche') : t('Vos travaux, enfin simples à suivre')}</h2>
        <ul>{(pro ? PRO_PTS : CLI_PTS).map((x) => <li key={x}><LuCheck />{t(x)}</li>)}</ul>
        <Link to={pro ? '/inscription/artisan' : '/inscription/particulier'} className={'btn' + (pro ? ' light' : '')}>{pro ? t('Essayer gratuitement 30 jours') : t('Créer mon compte gratuit')}</Link>
      </div>
    </section>
  );
}

// Comparatif avec des catégories de concurrents (sans les nommer). 1 = oui, 0 = non, 2 = partiel / selon l'offre
const CMP = [
  ['Devis et factures conformes', 1, 1, 0],
  ['Signature électronique des devis', 1, 2, 0],
  ['Factures d’acompte et de situation', 1, 2, 0],
  ['Relances automatiques des impayés', 1, 2, 0],
  ['Planning d’équipe', 1, 2, 0],
  ['Prise de rendez-vous en ligne par vos clients', 1, 0, 1],
  ['Espace client : devis, factures, documents du logement', 1, 0, 0],
  ['Messagerie avec vos clients et votre équipe', 1, 0, 2],
  ['Réseau de pros et chantiers partagés', 1, 0, 0],
  ['Notifications sur téléphone et ordinateur', 1, 2, 1],
  ['Sans commission sur vos chantiers', 1, 1, 0],
  ['Gratuit pour vos clients', 1, 2, 1],
];
const Mark = ({ v }) => (v === 1 ? <span className="cm yes" aria-label={t('Oui')}><LuCheck /></span> : v === 2 ? <span className="cm part" aria-label={t('Selon l’offre')}>~</span> : <span className="cm no" aria-label={t('Non')}><LuX /></span>);

function Pricing() {
  const [who, setWho] = useState('pro');
  const [plan, setPlan] = useState('equipe');
  const fmt = (n) => n.toLocaleString('fr-FR');
  const p = PLANS.find((x) => x.id === plan);
  return (
    <section className="lp-price" id="tarifs">
      <div className="lp-price-head">
        <h2>{t('Des tarifs simples, sans engagement')}</h2>
        <p className="muted only-desk">{t('30 jours d’essai gratuit pour toutes les formules, sans carte bancaire. Toujours gratuit pour les particuliers.')}</p>
        <div className="lp-switch sm only-mob" role="tablist" aria-label={t('Tarifs pour')}>
          <button role="tab" aria-selected={who === 'pro'} className={who === 'pro' ? 'on' : ''} onClick={() => setWho('pro')}>{t('Professionnels')}</button>
          <button role="tab" aria-selected={who === 'cli'} className={who === 'cli' ? 'on' : ''} onClick={() => setWho('cli')}>{t('Particuliers')}</button>
        </div>
      </div>
      <div className="lp-plans only-desk">
        {PLANS.map((x) => (
          <article key={x.id} className={'lp-plan' + (x.id === 'equipe' ? ' best' : '')}>
            <h3>{t(x.name)}</h3>
            <p className="lp-plan-desc">{t(x.desc)}</p>
            <div className="lp-amount"><b>{fmt(x.price)} €</b><span>{t('HT / mois')}</span></div>
            <p className="lp-plan-note">{t('sans engagement, résiliable à tout moment')}</p>
            <ul>{x.features.map((f) => <li key={f}><LuCheck />{t(f)}</li>)}</ul>
            <Link to="/inscription/artisan" className={'btn' + (x.id === 'equipe' ? '' : ' ghost')}>{t('Essayer 30 jours gratuits')}</Link>
          </article>
        ))}
        <article className="lp-plan free">
          <h3>{t('Particulier')}</h3>
          <p className="lp-plan-desc">{t('Pour vos travaux à la maison')}</p>
          <div className="lp-amount"><b>{t('Gratuit')}</b></div>
          <p className="lp-plan-note">{t('pour toujours')}</p>
          <ul>{CLI_PTS.slice(0, 4).map((f) => <li key={f}><LuCheck />{t(f)}</li>)}</ul>
          <Link to="/inscription/particulier" className="btn navy">{t('Créer mon compte')}</Link>
        </article>
      </div>
      <div className="only-mob">
      {who === 'pro' ? (
        <>
          <div className="lp-plan-tabs" role="tablist" aria-label={t('Formule')}>
            {PLANS.map((x) => <button key={x.id} role="tab" aria-selected={plan === x.id} className={plan === x.id ? 'on' : ''} onClick={() => setPlan(x.id)}><b>{t(x.name)}</b><small>{fmt(x.price)} €</small></button>)}
          </div>
          <article className="lp-plan one" role="tabpanel">
            <div className="lp-plan-l">
              <h3>{t(p.name)}</h3>
              <p className="lp-plan-desc">{t(p.desc)}</p>
              <div className="lp-amount"><b>{fmt(p.price)} €</b><span>{t('HT / mois')}</span></div>
              <p className="lp-plan-note">{t('30 jours d’essai gratuit, sans carte bancaire · sans engagement')}</p>
              <Link to="/inscription/artisan" className="btn">{t('Essayer {p} gratuitement', { p: t(p.name) })}</Link>
            </div>
            <ul>{p.features.map((f) => <li key={f}><LuCheck />{t(f)}</li>)}</ul>
          </article>
        </>
      ) : (
        <article className="lp-plan one free" role="tabpanel">
          <div className="lp-plan-l">
            <h3>{t('Particulier')}</h3>
            <p className="lp-plan-desc">{t('Pour vos travaux à la maison')}</p>
            <div className="lp-amount"><b>{t('Gratuit')}</b><span>{t('pour toujours')}</span></div>
            <p className="lp-plan-note">{t('Aucune carte bancaire, aucun abonnement.')}</p>
            <Link to="/inscription/particulier" className="btn navy">{t('Créer mon compte gratuit')}</Link>
          </div>
          <ul>{CLI_PTS.map((f) => <li key={f}><LuCheck />{t(f)}</li>)}</ul>
        </article>
      )}
      </div>

      <div className="lp-cmp">
        <h2>{t('Pourquoi Artesa ?')}</h2>
        <div className="lp-cmp-wrap">
          <table>
            <thead><tr><th />{['Artesa', 'Logiciel de devis classique', 'Plateforme de mise en relation'].map((h, i) => <th key={h} className={i === 0 ? 'us' : ''}>{t(h)}</th>)}</tr></thead>
            <tbody>{CMP.map(([l, ...v]) => <tr key={l}><td>{t(l)}</td>{v.map((x, i) => <td key={i} className={i === 0 ? 'us' : ''}><Mark v={x} /></td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className="small muted">{t('~ : selon l’offre ou en option payante. Comparaison indicative avec les catégories de solutions courantes sur le marché français, novembre 2026.')}</p>
      </div>
    </section>
  );
}
