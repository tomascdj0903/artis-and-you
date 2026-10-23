import './styles.css';
import { createRoot } from 'react-dom/client';
import { useEffect } from 'react';
import { LuHouse, LuUsers, LuCalendar, LuFileText, LuChartColumn, LuMessageSquare, LuNetwork, LuBell } from 'react-icons/lu';
import { AppProvider, useApp } from './lib/store.jsx';
import { useLocation, matchRoute, navigate, Link } from './lib/router.jsx';
import { t } from './lib/i18n.js';
import { Loader, Avatar } from './ui/index.jsx';
import { OFFLINE } from './lib/api.js';
import { fullName } from './lib/format.js';

import * as Auth from './pages/auth/index.jsx';
import * as Legal from './pages/common/legal.jsx';
import * as Pro from './pages/pro/index.js';
import * as Cli from './pages/client/index.js';
import * as Common from './pages/common/index.jsx';

const PUBLIC = [
  ['/connexion', Auth.Login], ['/inscription', Auth.SignupChoice], ['/inscription/artisan', Auth.SignupPro], ['/inscription/particulier', Auth.SignupClient],
  ['/mot-de-passe-oublie', Auth.Forgot], ['/nouveau-mot-de-passe', Auth.NewPassword], ['/telecharger', Legal.Download],
  ['/mentions-legales', Legal.Mentions], ['/cgu', Legal.CGU], ['/confidentialite', Legal.Privacy],
];
const PRO = [
  ['/pro', Pro.Home], ['/pro/recherche', Pro.GlobalSearch],
  ['/pro/clients', Pro.Clients], ['/pro/clients/nouveau', Pro.ClientEdit], ['/pro/clients/:id', Pro.ClientCard], ['/pro/clients/:id/modifier', Pro.ClientEdit],
  ['/pro/clients/:id/kpi', Pro.ClientKpi], ['/pro/clients/:id/factures', Pro.ClientInvoices], ['/pro/clients/:id/devis', Pro.ClientQuotes],
  ['/pro/clients/:id/chat', Pro.ClientChat], ['/pro/clients/:id/historique', Pro.ClientHistory], ['/pro/clients/:id/docs', Pro.OtherDocsClient],
  ['/pro/planning', Pro.Planning], ['/pro/planning/nouveau', Pro.ApptEdit], ['/pro/planning/rdv/:id', Pro.ApptDetail], ['/pro/planning/rdv/:id/modifier', Pro.ApptEdit], ['/pro/planning/reglages', Pro.PlanningSettings],
  ['/pro/documents', Pro.DocumentsHome], ['/pro/documents/devis', Pro.QuotesAll], ['/pro/documents/factures', Pro.InvoicesAll],
  ['/pro/documents/nouveau', Pro.DocEdit], ['/pro/documents/:id', Pro.DocDetail], ['/pro/documents/:id/modifier', Pro.DocEdit], ['/pro/documents/:id/pdf', Pro.DocPdf],
  ['/pro/photos', Pro.PhotosClients], ['/pro/photos/:id', Pro.PhotosClient],
  ['/pro/autres-docs', Pro.OtherDocsClients], ['/pro/autres-docs/:id', Pro.OtherDocsClient],
  ['/pro/coffre-fort', Pro.Vault], ['/pro/coffre-fort/:type', Pro.VaultType],
  ['/pro/crm', Pro.CrmHome], ['/pro/crm/statut', Pro.ProjectStatus], ['/pro/crm/kpi', Pro.CompanyKpi], ['/pro/crm/export', Pro.Export],
  ['/pro/crm/bibliotheque', Pro.Library], ['/pro/crm/bibliotheque/:id', Pro.ItemEdit],
  ['/pro/messages', Pro.Messages], ['/pro/messages/:id', Pro.Conversation],
  ['/pro/reseau', Pro.Network], ['/pro/reseau/ajouter', Pro.NetworkAdd], ['/pro/reseau/:id', Pro.ProProfile],
  ['/pro/notifications', Common.Notifications], ['/pro/admin', Common.Admin],
  ['/pro/compte', Pro.Account], ['/pro/compte/profil', Common.MyProfile], ['/pro/compte/abonnement', Pro.Subscription], ['/pro/compte/entreprise', Pro.CompanySettings],
  ['/pro/compte/equipe', Pro.TeamSettings], ['/pro/compte/equipe/:id', Pro.MemberSettings], ['/pro/compte/documents', Pro.DocSettings], ['/pro/compte/pdf', Pro.PdfSettings],
  ['/pro/compte/notifications', Pro.NotifSettings], ['/pro/compte/integrations', Pro.Integrations], ['/pro/compte/donnees', Common.DataPrivacy],
  ['/pro/compte/aide', Common.Help], ['/pro/compte/apparence', Common.Appearance], ['/pro/compte/avis', Pro.Reviews], ['/pro/reglages/profil-public', Pro.Reviews],
];
const CLIENT = [
  ['/client', Cli.Home], ['/client/artisans', Cli.Search], ['/client/artisans/:id', Cli.ArtisanCard], ['/client/artisans/:id/demande', Cli.NewRequest], ['/client/demande-envoyee/:id', Cli.RequestSent],
  ['/client/rdv', Cli.Appointments], ['/client/rdv/:id', Cli.ApptDetail],
  ['/client/messages', Cli.Messages], ['/client/messages/:id', Cli.Conversation],
  ['/client/notifications', Common.Notifications], ['/client/admin', Common.Admin],
  ['/client/documents', Cli.DocumentsHome], ['/client/devis', Cli.Quotes], ['/client/factures', Cli.Invoices],
  ['/client/devis/:id', Cli.DocDetail], ['/client/factures/:id', Cli.DocDetail], ['/client/devis/:id/pdf', Cli.DocPdf], ['/client/factures/:id/pdf', Cli.DocPdf],
  ['/client/factures/:id/payer', Cli.Pay], ['/client/avis/:id', Cli.Review],
  ['/client/chantiers', Cli.Projects], ['/client/chantiers/:id', Cli.ProjectDetail], ['/client/autres-docs', Cli.OtherDocs],
  ['/client/compte', Cli.Account], ['/client/compte/profil', Common.MyProfile], ['/client/compte/logement', Cli.Home2], ['/client/compte/artisans', Cli.MyArtisans],
  ['/client/compte/notifications', Cli.NotifSettings], ['/client/compte/donnees', Common.DataPrivacy], ['/client/compte/aide', Common.Help], ['/client/compte/apparence', Common.Appearance],
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
  const badge = (to) => (to.endsWith('/messages') ? unread.messages : to.endsWith('/notifications') ? unread.notifs : 0);
  const hideTabs = path === '/pro'; // Accueil artisan : pas de barre d'onglets (maquette 02)
  return (
    <div className="app">
      <aside className="side">
        <Link to={tabs[0][0]} className="brand"><img src="/logo.svg" alt="" /><span>ARTIS <b>&amp;</b> YOU</span></Link>
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
      {!hideTabs && (
        <nav className="tabbar" aria-label={t('Navigation')}>
          {tabs.map(([to, I, label, exact]) => <Link key={to} to={to} className={active(to, exact) ? 'on' : ''} aria-label={t(label)}><I />{badge(to) > 0 && <span className="dot">{badge(to)}</span>}</Link>)}
        </nav>
      )}
    </div>
  );
}

function App() {
  const { path } = useLocation();
  const { ready, session, profile, isPro } = useApp();
  const logged = !!session && !!profile;

  useEffect(() => {
    if (!ready) return;
    if (session?.recovery && path !== '/nouveau-mot-de-passe') { navigate('/nouveau-mot-de-passe', { replace: true }); return; }
    const isPublic = !!find(PUBLIC, path);
    if (path === '/' || (!logged && !isPublic)) { navigate(logged ? (isPro ? '/pro' : '/client') : '/connexion', { replace: true }); return; }
    if (logged && ['/connexion', '/inscription', '/inscription/particulier'].includes(path)) { navigate(isPro ? '/pro' : '/client', { replace: true }); return; }
    if (logged && profile.kind === 'artisan' && !profile.company_id && path !== '/inscription/artisan') { navigate('/inscription/artisan', { replace: true }); return; }
    if (logged && path.startsWith('/pro') && !isPro) navigate('/client', { replace: true });
    if (logged && path.startsWith('/client') && isPro) navigate('/pro', { replace: true });
  }, [ready, logged, path, isPro]);

  if (!ready) return <Loader />;
  const pub = find(PUBLIC, path);
  if (pub) { const [C, params] = pub; return <C params={params} />; }
  if (!logged) return <Loader />;
  const pro = path.startsWith('/pro'), routes = pro ? PRO : CLIENT;
  const hit = find(routes, path);
  const [C, params] = hit || [Common.NotFound, {}];
  return <Shell tabs={pro ? PRO_TABS : CLI_TABS} path={path}><C params={params} key={path} /></Shell>;
}

createRoot(document.getElementById('root')).render(<AppProvider><App /></AppProvider>);
