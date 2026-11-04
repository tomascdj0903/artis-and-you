import { useEffect, useState } from 'react';
import { LuMonitor, LuApple, LuDownload, LuArrowLeft, LuRefreshCw, LuSmartphone, LuShare } from 'react-icons/lu';
import { navigate } from '../../lib/router.jsx';
import { t } from '../../lib/i18n.js';
import { GITHUB_REPO, APP_VERSION } from '../../lib/api.js';

function Page({ title, children }) {
  return (
    <div className="content narrow" style={{ paddingTop: 20, paddingBottom: 60 }}>
      <button className="iconbtn" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/'))} aria-label={t('Retour')}><LuArrowLeft /></button>
      <div className="row" style={{ margin: '10px 0 20px' }}><img src="/logo.svg" alt="" style={{ width: 54 }} /><h1 style={{ fontSize: 28 }}>{title}</h1></div>
      <div className="notice">{t('Texte provisoire, à faire valider par un professionnel du droit avant le lancement.')}</div>
      <div style={{ lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

export function Mentions() {
  return (
    <Page title={t('Mentions légales')}>
      <h3>{t('Éditeur')}</h3>
      <p>Artis &amp; You — [{t('forme juridique, capital, adresse du siège, RCS, SIRET à compléter')}]<br />{t('Directeur de la publication')} : [{t('à compléter')}]<br />{t('Contact')} : support@artisandyou.fr</p>
      <h3>{t('Hébergement')}</h3>
      <p>{t('Application web')} : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, {t('États-Unis')}.<br />{t('Données')} : Supabase ({t('serveurs situés dans l’Union européenne, région Paris')}).</p>
      <h3>{t('Propriété intellectuelle')}</h3>
      <p>{t('La marque, le logo et l’interface Artis & You sont protégés. Toute reproduction sans autorisation est interdite.')}</p>
    </Page>
  );
}

export function CGU() {
  return (
    <Page title={t("Conditions générales d'utilisation")}>
      <h3>1. {t('Objet')}</h3><p>{t('Artis & You met en relation des artisans et des particuliers, et fournit aux artisans des outils de gestion (clients, planning, devis, factures, messagerie).')}</p>
      <h3>2. {t('Comptes')}</h3><p>{t('Le compte particulier est gratuit. Le compte artisan est payant après une période d’essai de 30 jours. L’artisan déclare un SIRET valide, vérifié par Artis & You.')}</p>
      <h3>3. {t('Responsabilités')}</h3><p>{t('L’artisan reste seul responsable de ses devis, factures, prestations et du respect de ses obligations légales et fiscales. Artis & You n’est pas partie aux contrats conclus entre artisans et particuliers.')}</p>
      <h3>4. {t('Avis')}</h3><p>{t('Seuls les clients ayant eu un rendez-vous peuvent publier un avis. Les avis sont relus avant publication et peuvent être refusés s’ils sont injurieux ou hors sujet.')}</p>
      <h3>5. {t('Paiements')}</h3><p>{t('Les paiements des factures sont versés directement à l’artisan. Artis & You ne prélève aucune commission sur ces paiements.')}</p>
      <h3>6. {t('Résiliation')}</h3><p>{t('Chaque utilisateur peut supprimer son compte à tout moment depuis Données et confidentialité.')}</p>
    </Page>
  );
}

export function Privacy() {
  return (
    <Page title={t('Politique de confidentialité')}>
      <h3>{t('Données collectées')}</h3><p>{t('Identité, coordonnées, adresse du logement, messages, photos et documents échangés, rendez-vous, devis et factures.')}</p>
      <h3>{t('Finalités')}</h3><p>{t('Fournir le service, permettre les échanges entre artisans et clients, respecter les obligations comptables (conservation des factures 10 ans).')}</p>
      <h3>{t('Partage')}</h3><p>{t('Vos données ne sont partagées qu’avec les artisans que vous contactez, et avec nos sous-traitants techniques (hébergement). Elles ne sont jamais vendues.')}</p>
      <h3>{t('Vos droits')}</h3><p>{t('Accès, rectification, effacement, portabilité (export zip depuis l’application), opposition. Contact : support@artisandyou.fr. Vous pouvez saisir la CNIL.')}</p>
    </Page>
  );
}

const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = () => /Android/i.test(navigator.userAgent);
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
export function Download() {
  const base = `https://github.com/${GITHUB_REPO}/releases/latest/download/`;
  const mobile = isIOS() || isAndroid();
  const isMac = !mobile && /Mac/i.test(navigator.platform || navigator.userAgent);
  const [tab, setTab] = useState(mobile ? 'tel' : 'pc');
  const [canInstall, setCanInstall] = useState(!!window.__ayInstall);
  const [installed, setInstalled] = useState(standalone());
  useEffect(() => { const f = () => setCanInstall(true); const g = () => setInstalled(true); window.addEventListener('ay-installable', f); window.addEventListener('appinstalled', g); return () => { window.removeEventListener('ay-installable', f); window.removeEventListener('appinstalled', g); }; }, []);
  const install = async () => { const e = window.__ayInstall; if (!e) return; e.prompt(); const r = await e.userChoice.catch(() => null); if (r?.outcome === 'accepted') setInstalled(true); window.__ayInstall = null; setCanInstall(false); };
  const url = location.origin;
  return (
    <div className="auth">
      <div className="auth-box" style={{ maxWidth: 600 }}>
        <button className="iconbtn" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/'))} aria-label={t('Retour')}><LuArrowLeft /></button>
        <img className="auth-logo" src="/logo.svg" alt="Artis & You" style={{ width: 100, height: 100 }} />
        <h1 className="center" style={{ fontSize: 28 }}>{t('Installer Artis & You')}</h1>
        <div className="seg" style={{ margin: '6px 0 14px' }}>{[['pc', t('Ordinateur')], ['tel', t('Téléphone et tablette')]].map(([v, l]) => <button key={v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>{l}</button>)}</div>
        {tab === 'pc' ? <>
          <p className="center muted">{t('Le logiciel s’ouvre dans sa propre fenêtre, avec son icône, et se met à jour tout seul. Une connexion internet est nécessaire.')}</p>
          <a className={'opt' + (!isMac ? ' red' : '')} href={base + 'Artis-and-You-Setup.exe'}><LuMonitor /><div><b>{t('Télécharger pour Windows')}</b><small>Windows 10 / 11 · .exe</small></div><LuDownload /></a>
          <a className={'opt' + (isMac ? ' red' : '')} href={base + 'Artis-and-You.dmg'}><LuApple /><div><b>{t('Télécharger pour Mac')}</b><small>macOS 11+ · Apple Silicon et Intel · .dmg</small></div><LuDownload /></a>
          <div className="notice"><LuRefreshCw /><span>{t('Mises à jour automatiques : à chaque nouvelle version, le logiciel la télécharge en arrière-plan et l’installe au prochain démarrage.')}</span></div>
          <p className="small faint">{t('Au premier lancement sur Windows, si SmartScreen s’affiche, cliquez sur « Informations complémentaires » puis « Exécuter quand même » (le logiciel n’est pas encore signé). Sur Mac : clic droit sur l’application puis « Ouvrir ».')}</p>
          {canInstall && <button className="opt" onClick={install}><LuMonitor /><div><b>{t('Ou installer la version web')}</b><small>{t('Sans téléchargement, depuis ce navigateur (Chrome, Edge)')}</small></div></button>}
        </> : <>
          <p className="center muted">{t('Ajoutez Artis & You sur l’écran d’accueil : l’application s’ouvre en plein écran avec son icône, comme une vraie application, et elle est toujours à jour.')}</p>
          {installed ? <div className="notice">✅ {t('Artis & You est installée sur cet appareil.')}</div> : <>
            <div className={'card' + (isAndroid() ? '' : ' soft')} style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 10 }}><LuSmartphone size={26} className="red-t" /><b style={{ fontSize: 17 }}>Android</b></div>
              {canInstall ? <button className="btn block mt" onClick={install}><LuDownload /> {t('Installer l’application')}</button> : (
                <ol className="small" style={{ paddingLeft: 20, margin: '8px 0 0' }}>
                  <li>{t('Ouvrez {u} dans Chrome', { u: url.replace(/^https?:\/\//, '') })}</li>
                  <li>{t('Touchez le menu ⋮ en haut à droite')}</li>
                  <li>{t('Choisissez « Installer l’application » (ou « Ajouter à l’écran d’accueil »)')}</li>
                </ol>)}
            </div>
            <div className={'card' + (isIOS() ? '' : ' soft')}>
              <div className="row" style={{ gap: 10 }}><LuApple size={26} className="red-t" /><b style={{ fontSize: 17 }}>iPhone et iPad</b></div>
              <ol className="small" style={{ paddingLeft: 20, margin: '8px 0 0' }}>
                <li>{t('Ouvrez {u} dans Safari', { u: url.replace(/^https?:\/\//, '') })}</li>
                <li>{t('Touchez le bouton Partager')} <LuShare style={{ verticalAlign: '-2px' }} /> {t('en bas de l’écran')}</li>
                <li>{t('Choisissez « Sur l’écran d’accueil » puis « Ajouter »')}</li>
              </ol>
            </div>
          </>}
          {!mobile && <div className="notice mt"><LuSmartphone /><span>{t('Sur votre téléphone, ouvrez {u} puis suivez les étapes ci-dessus.', { u: url.replace(/^https?:\/\//, '') })} <button className="link bold" onClick={() => navigator.clipboard?.writeText(url)}>{t('Copier le lien')}</button></span></div>}
          <p className="small faint center mt">{t('Les applications App Store et Google Play arrivent ensuite ; vos données seront les mêmes.')}</p>
        </>}
        <p className="small faint center">{t('Version web')} {APP_VERSION} · <a className="bold" href={`https://github.com/${GITHUB_REPO}/releases`}>{t('Toutes les versions')}</a></p>
      </div>
    </div>
  );
}
