import './styles.css';
import { createRoot } from 'react-dom/client';
import { useEffect, useState, lazy, Suspense } from 'react';
import { GlobalFab } from './ui/fab.jsx';
import { ErrorBoundary } from './ui/errors.jsx';
import { LuHouse, LuUsers, LuCalendar, LuFileText, LuChartColumn, LuMessageSquare, LuNetwork, LuBell } from 'react-icons/lu';
import { AppProvider, useApp } from './lib/store.jsx';
import { Tour, useTours } from './ui/tour.jsx';
import { Landing } from './pages/auth/landing.jsx';
import { useLocation, matchRoute, navigate, Link } from './lib/router.jsx';
import { t, loadLang, getLang } from './lib/i18n.js';
import { Loader, Avatar, Wordmark } from './ui/index.jsx';
import { OFFLINE, api } from './lib/api.js';
import { isLocked, bioEnabled, bioUnlock, lockAfterHidden } from './lib/security.js';
import { fullName } from './lib/format.js';

import * as Auth from './pages/auth/index.jsx';
import * as Legal from './pages/common/legal.jsx';

// L'espace artisan, l'espace particulier et les pages communes (compte, admin…) sont téléchargés séparément,
// à la première visite : un particulier ne charge pas le code des devis, du CRM ou du planning des pros.
const loaders = { pro: () => import('./pages/pro/index.js'), cli: () => import('./pages/client/index.js'), common: () => import('./pages/common/index.jsx') };
const cache = {};
const L = (mod, name) => cache[mod + name] || (cache[mod + name] = lazy(() => loaders[mod]().then((m) => ({ default: m[name] }))));
export const preload = (mod) => loaders[mod]().catch(() => {});

const PUBLIC = [
  ['/', Landing], ['/connexion', Auth.Login], ['/inscription', Auth.SignupChoice], ['/inscription/artisan', Auth.SignupPro], ['/inscription/particulier', Auth.SignupClient],
  ['/mot-de-passe-oublie', Auth.Forgot], ['/verification', Auth.Verify], ['/nouveau-mot-de-passe', Auth.NewPassword], ['/telecharger', Legal.Download],
  ['/mentions-legales', Legal.Mentions], ['/cgu', Legal.CGU], ['/confidentialite', Legal.Privacy],
];
const PRO = [
  ['/pro', L('pro', 'Home')], ['/pro/recherche', L('pro', 'GlobalSearch')],
  ['/pro/clients', L('pro', 'Clients')], ['/pro/clients/nouveau', L('pro', 'ClientEdit')], ['/pro/clients/:id', L('pro', 'ClientCard')], ['/pro/clients/:id/modifier', L('pro', 'ClientEdit')],
  ['/pro/clients/:id/kpi', L('pro', 'ClientKpi')], ['/pro/clients/:id/factures', L('pro', 'ClientInvoices')], ['/pro/clients/:id/devis', L('pro', 'ClientQuotes')],
  ['/pro/clients/:id/chat', L('pro', 'ClientChat')], ['/pro/clients/:id/historique', L('pro', 'ClientHistory')], ['/pro/clients/:id/docs', L('pro', 'OtherDocsClient')],
  ['/pro/planning', L('pro', 'Planning')], ['/pro/planning/nouveau', L('pro', 'ApptEdit')], ['/pro/planning/rdv/:id', L('pro', 'ApptDetail')], ['/pro/planning/rdv/:id/modifier', L('pro', 'ApptEdit')], ['/pro/planning/reglages', L('pro', 'PlanningSettings')],
  ['/pro/documents', L('pro', 'DocumentsHome')], ['/pro/documents/devis', L('pro', 'QuotesAll')], ['/pro/documents/factures', L('pro', 'InvoicesAll')],
  ['/pro/documents/nouveau', L('pro', 'DocEdit')], ['/pro/documents/:id', L('pro', 'DocDetail')], ['/pro/documents/:id/modifier', L('pro', 'DocEdit')], ['/pro/documents/:id/pdf', L('pro', 'DocPdf')],
  ['/pro/photos', L('pro', 'PhotosClients')], ['/pro/photos/:id', L('pro', 'PhotosClient')],
  ['/pro/autres-docs', L('pro', 'OtherDocsClients')], ['/pro/autres-docs/:id', L('pro', 'OtherDocsClient')],
  ['/pro/coffre-fort', L('pro', 'Vault')], ['/pro/coffre-fort/:type', L('pro', 'VaultType')],
  ['/pro/crm', L('pro', 'CrmHome')], ['/pro/crm/statut', L('pro', 'ProjectStatus')], ['/pro/crm/kpi', L('pro', 'CompanyKpi')], ['/pro/crm/export', L('pro', 'Export')],
  ['/pro/crm/bibliotheque', L('pro', 'Library')], ['/pro/crm/bibliotheque/:id', L('pro', 'ItemEdit')],
  ['/pro/messages', L('pro', 'Messages')], ['/pro/messages/:id', L('pro', 'Conversation')],
  ['/pro/reseau', L('pro', 'Network')], ['/pro/reseau/ajouter', L('pro', 'NetworkAdd')], ['/pro/reseau/inviter-clients', L('pro', 'InviteClients')], ['/pro/reseau/:id', L('pro', 'ProProfile')],
  ['/pro/notifications', L('common', 'Notifications')], ['/pro/admin', L('common', 'Admin')],
  ['/pro/compte', L('pro', 'Account')], ['/pro/compte/profil', L('common', 'MyProfile')], ['/pro/compte/abonnement', L('pro', 'Subscription')], ['/pro/compte/entreprise', L('pro', 'CompanySettings')],
  ['/pro/compte/equipe', L('pro', 'TeamSettings')], ['/pro/compte/equipe/:id', L('pro', 'MemberSettings')], ['/pro/compte/documents', L('pro', 'InvoiceSettings')], ['/pro/compte/devis', L('pro', 'QuoteSettings')], ['/pro/compte/factures', L('pro', 'InvoiceSettings')], ['/pro/compte/pdf', L('pro', 'PdfSettings')],
  ['/pro/compte/notifications', L('pro', 'NotifSettings')], ['/pro/relances', L('pro', 'Relances')], ['/pro/compte/integrations', L('pro', 'Integrations')], ['/pro/compte/donnees', L('common', 'DataPrivacy')],
  ['/pro/compte/aide', L('common', 'Help')], ['/pro/compte/apparence', L('common', 'Appearance')], ['/pro/compte/avis', L('pro', 'Reviews')], ['/pro/reglages/profil-public', L('pro', 'Reviews')],
];
const CLIENT = [
  ['/client', L('cli', 'Home')], ['/client/artisans', L('cli', 'Search')], ['/client/artisans/:id', L('cli', 'ArtisanCard')], ['/client/artisans/:id/demande', L('cli', 'NewRequest')], ['/client/demande-envoyee/:id', L('cli', 'RequestSent')],
  ['/client/rdv', L('cli', 'Appointments')], ['/client/rdv/:id', L('cli', 'ApptDetail')],
  ['/client/messages', L('cli', 'Messages')], ['/client/messages/:id', L('cli', 'Conversation')],
  ['/client/notifications', L('common', 'Notifications')], ['/client/admin', L('common', 'Admin')],
  ['/client/documents', L('cli', 'DocumentsHome')], ['/client/devis', L('cli', 'Quotes')], ['/client/factures', L('cli', 'Invoices')],
  ['/client/devis/:id', L('cli', 'DocDetail')], ['/client/factures/:id', L('cli', 'DocDetail')], ['/client/devis/:id/pdf', L('cli', 'DocPdf')], ['/client/factures/:id/pdf', L('cli', 'DocPdf')],
  ['/client/factures/:id/payer', L('cli', 'Pay')], ['/client/avis/:id', L('cli', 'Review')],
  ['/client/chantiers', L('cli', 'Projects')], ['/client/chantiers/:id', L('cli', 'ProjectDetail')], ['/client/autres-docs', L('cli', 'OtherDocs')],
  ['/client/compte', L('cli', 'Account')], ['/client/compte/profil', L('common', 'MyProfile')], ['/client/compte/logement', L('cli', 'Home2')], ['/client/compte/artisans', L('cli', 'MyArtisans')],
  ['/client/compte/notifications', L('cli', 'NotifSettings')], ['/client/compte/donnees', L('common', 'DataPrivacy')], ['/client/compte/aide', L('common', 'Help')], ['/client/compte/apparence', L('common', 'Appearance')],
];

function find(routes, path) {
  for (const [p, C] of routes) { const m = matchRoute(p, path); if (m) return [C, m]; }
  return null;
}

const PRO_TABS = [
  ['/pro', LuHouse, 'Accueil', true], ['/pro/clients', LuUsers, 'Clients'], ['/pro/planning', LuCalendar, 'Planning'], ['/pro/documents', LuFileText, 'Documents'],
  ['/pro/crm', LuChartColumn, 'CRM'], ['/pro/messages', LuMessageSquare, 'Messages'], ['/pro/reseau', LuNetwork, 'Mon réseau'],
];
const CLI_TABS = [
  ['/client', LuHouse, 'Accueil', true], ['/client/rdv', LuCalendar, 'Mes RDV'], ['/client/messages', LuMessageSquare, 'Messages'],
  ['/client/notifications', LuBell, 'Notifications'], ['/client/documents', LuFileText, 'Documents'],
];
// Pages rattachées à un onglet sans être sous son chemin
const ALIAS = { '/pro/photos': '/pro/documents', '/pro/autres-docs': '/pro/documents', '/pro/coffre-fort': '/pro/documents', '/client/devis': '/client/documents', '/client/factures': '/client/documents', '/client/chantiers': '/client/documents', '/client/autres-docs': '/client/documents', '/client/artisans': '/client', '/client/demande-envoyee': '/client/rdv', '/client/avis': '/client/documents' };

function Shell({ tabs, children, path }) {
  const { profile, company, unread, isPro } = useApp();
  let p = path;
  for (const [a, b] of Object.entries(ALIAS)) if (p.startsWith(a)) p = b;
  if (/^\/pro\/clients\/[^/]+\/(factures|devis)/.test(path)) p = '/pro/documents';
  if (/^\/pro\/documents\/[^/]+/.test(path) && history.state?.from === 'client') p = '/pro/clients';
  const active = (to, exact) => (exact ? p === to : p === to || p.startsWith(to + '/'));
  const badge = (to) => (to.endsWith('/messages') ? unread.messages : to.endsWith('/notifications') ? unread.notifs : to === '/pro/planning' ? unread.rdv || 0 : 0);
  // Dans une conversation, la barre d'onglets laisse la place à la barre de saisie (comme WhatsApp)
  const hideTabs = /^\/(pro|client)\/messages\/[^/]+$|^\/pro\/clients\/[^/]+\/chat$/.test(path);
  // Titre de l'onglet = titre de la page (annoncé par les lecteurs d'écran à chaque changement de page)
  useEffect(() => { const i = setTimeout(() => { const h = document.querySelector('.main h1')?.textContent?.trim(); document.title = (h ? h + ' · ' : '') + 'Artesa'; }, 400); return () => clearTimeout(i); }, [path]);
  const [tour, finishTour] = useTours(path); // Accueil artisan : pas de barre d'onglets (maquette 02)
  return (
    <div className="app">
      <aside className="side">
        <Link to={tabs[0][0]} className="brand"><Wordmark size={30} light /></Link>
        <nav>
          {tabs.map(([to, I, label, exact]) => (
            <Link key={to} to={to} className={active(to, exact) ? 'on' : ''}><I />{t(label)}{badge(to) > 0 && <span className="dot">{badge(to)}</span>}</Link>
          ))}
          {isPro && <Link to="/pro/notifications" className={active('/pro/notifications') ? 'on' : ''}><LuBell />{t('Notifications')}{unread.notifs > 0 && <span className="dot">{unread.notifs}</span>}</Link>}
        </nav>
        <div className="spacer" />
        <Link to={(isPro ? '/pro' : '/client') + '/compte'} className="me">
          <Avatar name={profile?.first_name} last={profile?.last_name} path={profile?.avatar_path} size="sm" />
          <div><b>{fullName(profile) || t('Mon compte')}</b><small>{company?.name || t('Particulier')}</small></div>
        </Link>
      </aside>
      <div className="main">
        {OFFLINE && <div style={{ background: '#FFF1B8', color: '#5C4A00', textAlign: 'center', fontSize: 12, padding: 4 }}>{t('Mode local : les données restent dans ce navigateur.')}</div>}
        {children}
      </div>
      {tour && <Tour id={tour} onDone={finishTour} />}
      <GlobalFab />
      {!hideTabs && (
        <nav className="tabbar" aria-label={t('Navigation')}>
          {tabs.map(([to, I, label, exact]) => <Link key={to} to={to} className={active(to, exact) ? 'on' : ''} aria-label={t(label)}><I /><small aria-hidden="true">{t(label === 'Mon réseau' ? 'Réseau' : label === 'Notifications' ? 'Alertes' : label)}</small>{badge(to) > 0 && <span className="dot">{badge(to)}</span>}</Link>)}
        </nav>
      )}
    </div>
  );
}

function LockScreen({ onUnlock }) {
  const { profile } = useApp();
  const [err, setErr] = useState('');
  const go = async () => { setErr(''); try { await bioUnlock(profile.id); onUnlock(); } catch (e) { setErr(e.name === 'NotAllowedError' ? t('Déverrouillage annulé.') : e.message); } };
  useEffect(() => { go(); }, []);
  return (
    <div className="auth" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ display: 'grid', gap: 14, maxWidth: 360, width: '100%', textAlign: 'center' }}>
        <Wordmark size={54} style={{ margin: '0 auto' }} />
        <h1 style={{ fontSize: 22, margin: 0 }}>{t('Bonjour {n}', { n: profile.first_name || '' })}</h1>
        <p className="muted" style={{ margin: 0 }}>{t('Application verrouillée. Utilisez Face ID, Touch ID, votre empreinte ou Windows Hello.')}</p>
        {err && <div className="error" role="alert">{err}</div>}
        <button className="btn" onClick={go}>{t('Déverrouiller')}</button>
        <button className="link bold" onClick={async () => { await api.signOut(); location.href = '/connexion'; }}>{t('Utiliser mon mot de passe')}</button>
      </div>
    </div>
  );
}

function App() {
  const { path } = useLocation();
  const { ready, session, profile, isPro } = useApp();
  const logged = !!session && !!profile;
  // Verrouillage Face ID / empreinte (si activé sur cet appareil)
  const [locked, setLocked] = useState(false);
  useEffect(() => { if (logged) setLocked(isLocked(profile.id)); }, [logged, profile?.id]);
  useEffect(() => {
    if (!logged || !bioEnabled(profile.id)) return;
    const off = lockAfterHidden(profile.id); const f = () => setLocked(true);
    window.addEventListener('ay-lock', f); return () => { off(); window.removeEventListener('ay-lock', f); };
  }, [logged, profile?.id]);

  useEffect(() => {
    if (!ready) return;
    if (session?.recovery && path !== '/nouveau-mot-de-passe') { navigate('/nouveau-mot-de-passe', { replace: true }); return; }
    const isPublic = !!find(PUBLIC, path);
    if ((path === '/' && (logged || navigator.userAgent.includes('Electron'))) || (!logged && !isPublic)) { navigate(logged ? (isPro ? '/pro' : '/client') : '/connexion', { replace: true }); return; }
    if (logged && ['/connexion', '/inscription', '/inscription/particulier'].includes(path)) { navigate(isPro ? '/pro' : '/client', { replace: true }); return; }
    if (logged && profile.kind === 'artisan' && !profile.company_id && path !== '/inscription/artisan') { navigate('/inscription/artisan', { replace: true }); return; }
    if (logged && path.startsWith('/pro') && !isPro) navigate('/client', { replace: true });
    if (logged && path.startsWith('/client') && isPro) navigate('/pro', { replace: true });
  }, [ready, logged, path, isPro]);

  // On commence à télécharger le bon espace dès qu'on sait qui est connecté
  useEffect(() => { if (logged) { preload(isPro ? 'pro' : 'cli'); preload('common'); } }, [logged, isPro]);

  const pub = find(PUBLIC, path);
  // Visiteur non connecté sur une page publique : on l'affiche sans attendre (pas de roue de chargement sur l'accueil pré-rendu)
  if (!ready) { if (pub && !session) { const [C, params] = pub; return <C params={params} />; } return <Loader />; }
  if (pub) { const [C, params] = pub; return <C params={params} />; }
  if (!logged) return <Loader />;
  if (locked) return <LockScreen onUnlock={() => setLocked(false)} />;
  const pro = path.startsWith('/pro'), routes = pro ? PRO : CLIENT;
  const hit = find(routes, path);
  const [C, params] = hit || [L('common', 'NotFound'), {}];
  return <Shell tabs={pro ? PRO_TABS : CLI_TABS} path={path}><ErrorBoundary key={path} home={pro ? '/pro' : '/client'}><Suspense fallback={<Loader />}><C params={params} key={path} /></Suspense></ErrorBoundary></Shell>;
}

// Installation sur téléphone (Android) : service worker minimal + bouton « Installer »
if ('serviceWorker' in navigator && location.protocol === 'https:' && !navigator.userAgent.includes('Electron')) navigator.serviceWorker.register('/sw.js').catch(() => {});
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__ayInstall = e; window.dispatchEvent(new Event('ay-installable')); });

loadLang(getLang()).catch(() => {}).finally(() => createRoot(document.getElementById('root')).render(<ErrorBoundary home="/"><AppProvider><App /></AppProvider></ErrorBoundary>));
