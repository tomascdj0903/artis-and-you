import { useEffect, useState } from 'react';
import { LuMonitor, LuApple, LuDownload, LuArrowLeft, LuRefreshCw, LuSmartphone, LuShare } from 'react-icons/lu';
import { navigate, Link } from '../../lib/router.jsx';
import { Wordmark } from '../../ui/index.jsx';
import { LawRef } from '../../ui/lawref.jsx';
import { t, getLang } from '../../lib/i18n.js';
import { api, GITHUB_REPO, APP_VERSION } from '../../lib/api.js';

// Informations de l'éditeur : à compléter à l'immatriculation de la société (tout ce qui est entre crochets s'affiche en orange)
export const EDITOR = {
  name: 'Artesa',
  form: 'société par actions simplifiée (SAS) au capital de 2 500 €',
  address: '67 ter avenue Georges Clemenceau, 06220 Vallauris, France',
  rcs: '[RCS / SIREN : à compléter]',
  vat: '[n° de TVA intracommunautaire : à compléter]',
  director: 'Clément [nom à compléter], Président',
  email: 'support@artisandyou.fr',
  phone: '[téléphone : à compléter]',
  updated: '20 novembre 2026',
};
const TBD = ({ v }) => (/\[/.test(v) ? <span style={{ color: '#C2410C', fontWeight: 700 }}>{v}</span> : v);
const L = LawRef;

const PAGES = [['/mentions-legales', 'Mentions légales'], ['/cgu', 'CGU'], ['/cgv', 'CGV artisans'], ['/confidentialite', 'Confidentialité'], ['/sous-traitance', 'Sous-traitance RGPD'], ['/signaler', 'Signaler un contenu']];

function Page({ title, children }) {
  return (
    <div className="content narrow legal" style={{ paddingTop: 20, paddingBottom: 60 }}>
      <button className="iconbtn" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/'))} aria-label={t('Retour')}><LuArrowLeft /></button>
      <div className="row" style={{ margin: '10px 0 12px' }}><img src="/logo.svg" alt="" style={{ width: 54 }} /><h1 style={{ fontSize: 28 }}>{title}</h1></div>
      <div className="chips wrap mb" style={{ gap: 6 }}>{PAGES.map(([to, l]) => <Link key={to} to={to} className={'chip' + (location.pathname === to ? ' on' : '')} style={{ padding: '5px 12px', fontSize: 13 }}>{t(l)}</Link>)}</div>
      <p className="small muted">{t('Dernière mise à jour : {d}', { d: EDITOR.updated })}</p>
      {getLang() !== 'fr' && <div className="notice">{t('Ce document est rédigé en français ; seule la version française fait foi.')}</div>}
      <div style={{ lineHeight: 1.7 }}>{children}</div>
      <p className="small faint mt">{t('Touchez une référence de loi pour lire son résumé et ouvrir le texte officiel.')}</p>
    </div>
  );
}

export function Mentions() {
  const e = EDITOR;
  return (
    <Page title={t('Mentions légales')}>
      <h3>Éditeur du site et de l’application</h3>
      <p>{e.name} — <TBD v={e.form} /><br />Siège : <TBD v={e.address} /><br /><TBD v={e.rcs} /> · <TBD v={e.vat} /><br />Directeur de la publication : <TBD v={e.director} /><br />Contact : <a href={'mailto:' + e.email}>{e.email}</a> · <TBD v={e.phone} /></p>
      <p className="small muted">L’immatriculation de la société est en cours (décembre 2026) : les numéros manquants seront ajoutés dès sa création.</p>
      <h3>Rôle d’Artesa</h3>
      <p>Artesa fournit aux professionnels du bâtiment un outil de gestion (demandes, planning, devis, factures, messagerie, documents) et aux particuliers un service gratuit pour trouver un artisan, le contacter et suivre leurs travaux. Artesa <b>n’est pas partie</b> aux contrats conclus entre un artisan et ses clients et ne réalise aucun travaux : l’artisan est seul responsable de ses devis, factures, prix, travaux, assurances (dont la décennale) et qualifications. Détails dans les <Link to="/cgu">CGU</Link>, les <Link to="/cgv">CGV artisans</Link> et la <Link to="/confidentialite">politique de confidentialité</Link>. <L id="conso-L111-7" /></p>
      <h3>Hébergement</h3>
      <p><b>Application web</b> : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — vercel.com.<br /><b>Base de données, fichiers et comptes</b> : Supabase Inc., 970 Toa Payoh North #07-04, Singapour 318992 — supabase.com. Les données sont stockées dans l’Union européenne.</p>
      <h3>Points de contact (règlement sur les services numériques)</h3>
      <p>Autorités, utilisateurs et titulaires de droits peuvent nous écrire à <a href={'mailto:' + e.email}>{e.email}</a>, en français ou en anglais. Pour signaler un contenu illicite : <Link to="/signaler">formulaire de signalement</Link>. <L id="dsa-11" /> <L id="dsa-12" /></p>
      <h3>Propriété intellectuelle</h3>
      <p>La marque, le logo, les textes et l’interface Artesa sont protégés. Toute reproduction sans autorisation est interdite. Les contenus publiés par les artisans (photos, descriptions) restent leur propriété ; ils nous accordent le droit de les afficher sur Artesa le temps de leur inscription.</p>
      <h3>Médiation</h3>
      <p>Pour un litige avec Artesa, un consommateur peut recourir gratuitement au médiateur de la consommation d’Artesa : <b>CM2C</b> (Centre de la Médiation de la Consommation des Conciliateurs de Justice), <a href="https://www.cm2c.net" target="_blank" rel="noreferrer">www.cm2c.net</a> <TBD v="[adhésion après l’immatriculation, adresse à compléter]" />. <L id="conso-L612-1" /> <L id="conso-L616-1" /> Pour un litige avec un artisan, c’est le médiateur de l’artisan, indiqué sur ses devis et factures, qui est compétent.</p>
      <h3>Données personnelles et cookies</h3>
      <p>Voir la <Link to="/confidentialite">politique de confidentialité</Link>. Vous pouvez aussi saisir la CNIL (cnil.fr).</p>
      <h3>Droit applicable</h3>
      <p>Les présentes mentions légales sont soumises au droit français.</p>
      <p className="small muted">Base : <L id="lcen-1-1" /></p>
    </Page>
  );
}

export function CGU() {
  return (
    <Page title={t("Conditions générales d'utilisation")}>
      <h3>1. Qui sommes-nous, que fait Artesa</h3>
      <p>Artesa est une plateforme en ligne qui met en relation des particuliers avec des artisans et entreprises du bâtiment et des services, et qui fournit aux professionnels des outils de gestion (clients, planning, devis, factures, messagerie). Les présentes conditions s’appliquent à tous les utilisateurs. Les conditions de l’abonnement des professionnels figurent dans les <Link to="/cgv">CGV artisans</Link>.</p>
      <div className="card soft"><b>Information essentielle (art. L. 111-7 du Code de la consommation)</b><ul>
        <li>Artesa <b>n’est pas partie</b> aux contrats conclus entre un particulier et un artisan : le devis, les travaux, la facture et les garanties engagent uniquement l’artisan.</li>
        <li>Les professionnels inscrits sont des <b>professionnels</b> au sens du Code de la consommation : vous bénéficiez donc des droits des consommateurs (information, rétractation quand elle s’applique, garanties légales).</li>
        <li>Artesa est <b>gratuit pour les particuliers</b>. Les artisans paient un abonnement mensuel. Artesa ne perçoit <b>aucune commission</b> sur les travaux et <b>aucune rémunération</b> qui influencerait le classement.</li>
        <li>Les artisans sont vérifiés avant d’être visibles : SIRET actif, informations de l’entreprise, <b>pièce d’identité du dirigeant</b> (la copie est supprimée après contrôle), et attestations (Kbis, URSSAF, assurance décennale) contrôlées. La mention RGE est vérifiée sur la liste officielle de l’ADEME. Artesa ne garantit pas la qualité des travaux.</li>
      </ul><L id="conso-L111-7" /> <L id="conso-D111-7" /> <L id="conso-D111-8" /></div>

      <h3>2. Comptes</h3>
      <p>L’inscription est réservée aux personnes majeures. Le compte particulier est gratuit. Chaque utilisateur garde ses identifiants confidentiels ; la double authentification est disponible. Un compte peut être supprimé à tout moment depuis <i>Données et confidentialité</i>.</p>
      <p><b>Validation des professionnels</b> : tant que l’entreprise n’est pas validée par l’équipe Artesa, sa fiche n’apparaît pas dans la recherche et ses devis et factures ne sont pas transmis aux particuliers inscrits. <b>Compte certifié</b> : un particulier peut faire vérifier sa pièce d’identité ; les artisans dont il est client voient alors un badge « Compte certifié ». Dans les deux cas, la copie de la pièce est supprimée dès la vérification faite. <L id="rgpd-5" /> <L id="cnil-identite" /></p>

      <h3>3. Référencement et classement des artisans</h3>
      <p><b>Critères pour être référencé</b> : entreprise immatriculée avec un SIRET actif, fiche entreprise complète (métier, zone d’intervention, assurance déclarée), acceptation des présentes conditions et abonnement actif ou en période d’essai.</p>
      <p><b>Déréférencement</b> : fin d’abonnement, SIRET radié, attestation obligatoire expirée ou refusée, ou manquement grave aux présentes conditions (voir article 7).</p>
      <p><b>Ordre d’affichage des résultats</b> (critères principaux, dans cet ordre) :</p>
      <ol><li>les artisans avec qui vous avez déjà travaillé (« mes artisans ») ;</li><li>la distance entre l’artisan et la ville des travaux, du plus proche au plus éloigné ;</li><li>la correspondance avec le métier ou le nom recherché.</li></ol>
      <p>Aucun artisan ne peut payer pour être mieux classé. Si une mise en avant payante était un jour proposée, elle serait signalée par la mention <b>« Annonce »</b>. <L id="conso-L111-7" /> <L id="conso-D111-7" /> <L id="p2b-5" /></p>

      <h3>4. Avis</h3>
      <p>Seul un client ayant eu un rendez-vous avec l’artisan via Artesa peut publier un avis ; l’avis est donc lié à une prestation réelle. Les avis sont relus par Artesa avant publication (délai habituel : 48 h ouvrées). Ils sont affichés du plus récent au plus ancien, avec leur date. Un avis est refusé s’il est injurieux, diffamatoire, hors sujet, contient des données personnelles ou s’il existe un conflit d’intérêts ; l’auteur est informé du motif du refus. Artesa ne modifie pas le contenu des avis et ne reçoit aucune contrepartie pour les publier ou les supprimer. Un avis reste affiché tant que l’auteur ou l’artisan a un compte, sauf retrait par son auteur. L’artisan peut y répondre publiquement. <L id="conso-L111-7-2" /> <L id="conso-D111-17" /></p>

      <h3>5. Messagerie, photos et contenus</h3>
      <p>Chaque utilisateur est responsable de ce qu’il publie. Sont interdits : contenus illicites, injurieux, discriminatoires, trompeurs, atteintes à la vie privée ou aux droits d’autrui, menaces ou harcèlement, faux avis et fausses demandes, usurpation d’identité, démarchage abusif, contournement de la plateforme pour escroquer, et toute tentative de pirater, copier ou aspirer les données d’Artesa (robots, extraction de fiches). Artesa n’exerce pas de contrôle préalable sur les messages privés mais agit promptement dès qu’un contenu illicite lui est signalé. <L id="lcen-6" /></p>

      <h3>6. Signaler un contenu</h3>
      <p>Tout contenu (fiche artisan, avis, photo, message) peut être signalé avec le bouton <b>Signaler</b> ou depuis la page <Link to="/signaler">Signaler un contenu</Link>. Le signalement indique pourquoi le contenu serait illicite, où il se trouve et, sauf exception, votre nom et votre e-mail. Vous recevez un accusé de réception puis notre décision motivée. <L id="dsa-16" /></p>

      <h3>7. Modération, restriction et suspension</h3>
      <p>En cas de contenu illicite ou contraire aux présentes conditions, Artesa peut retirer ou masquer le contenu, limiter la visibilité d’une fiche, suspendre ou fermer un compte, de façon proportionnée (avertissement d’abord, sauf faute grave : fraude, faux SIRET, fausse attestation d’assurance, menaces). La décision est motivée et notifiée par écrit, avec les faits, la règle appliquée et les voies de recours. Pour un professionnel, la suspension ou la résiliation est notifiée avec ses motifs, au plus tard au moment où elle prend effet ; la résiliation définitive moyennant un préavis de 30 jours, sauf manquement grave ou obligation légale. <L id="dsa-17" /> <L id="p2b-3" /> <L id="p2b-4" /></p>

      <h3>8. Réclamations et recours</h3>
      <p>Toute décision de modération peut être contestée gratuitement pendant 6 mois en écrivant à support@artisandyou.fr ; elle est réexaminée par une personne. Les professionnels disposent du même système interne de traitement des plaintes (réponse sous 15 jours) et peuvent recourir à une médiation. Vous pouvez aussi saisir le juge. <L id="dsa-20" /> <L id="p2b-11" /> <L id="p2b-12" /></p>

      <h3>9. Responsabilité d’Artesa</h3>
      <p>Artesa fournit un service de mise en relation et d’outils : elle répond de la bonne exécution de ce service, mais pas des prestations des artisans, ni des devis, factures et garanties qu’ils émettent. Artesa ne peut être tenue d’un dommage indirect. Rien dans ces conditions ne limite les droits que la loi donne aux consommateurs.</p>

      <h3>10. Modification des conditions</h3>
      <p>Les utilisateurs sont informés de toute modification. Pour les professionnels, toute modification est annoncée au moins <b>15 jours</b> avant son entrée en vigueur ; ils peuvent résilier avant cette date. <L id="p2b-3" /></p>

      <h3>11. Droit applicable</h3>
      <p>Droit français. Un consommateur peut saisir le tribunal de son domicile et recourir à la médiation (voir <Link to="/mentions-legales">Mentions légales</Link>). Entre professionnels, les tribunaux du siège d’Artesa sont compétents.</p>
    </Page>
  );
}

export function CGV() {
  return (
    <Page title={t('Conditions générales de vente — artisans')}>
      <p>Ces conditions s’appliquent à l’abonnement Artesa souscrit par un professionnel (artisan, entreprise). Elles complètent les <Link to="/cgu">CGU</Link>. Elles constituent le socle de la négociation commerciale. <L id="com-L441-1" /></p>
      <h3>1. Offres et prix</h3>
      <p>Les formules et leurs prix sont affichés sur la page Tarifs, en euros <b>hors taxes par mois</b>. La TVA au taux en vigueur s’ajoute s’il y a lieu.</p>
      <h3>2. Essai gratuit</h3>
      <p>30 jours d’essai gratuit, sans carte bancaire. À la fin de l’essai, le compte passe en lecture seule tant qu’aucune formule n’est choisie ; aucune somme n’est prélevée sans accord.</p>
      <h3>3. Durée, renouvellement, résiliation</h3>
      <p>Sans engagement : l’abonnement est mensuel, renouvelé chaque mois, et résiliable à tout moment depuis le compte, avec effet à la fin du mois payé. Après résiliation, les données restent exportables 30 jours ; les factures émises restent conservées 10 ans pour respecter vos obligations comptables.</p>
      <h3>4. Facturation et paiement</h3>
      <p>Facture émise chaque mois, payable à réception. En cas de retard : pénalités au taux d’intérêt de la BCE majoré de 10 points, et indemnité forfaitaire de 40 € pour frais de recouvrement. Pas d’escompte pour paiement anticipé. <L id="com-L441-10" /> <L id="com-D441-5" /></p>
      <h3>5. Obligations de l’artisan</h3>
      <p>L’artisan déclare des informations exactes (SIRET, assurance, qualifications), dispose des assurances obligatoires de son métier et reste seul responsable de ses devis, factures, prestations et de ses obligations légales, fiscales et sociales. Les modèles et rappels proposés par Artesa (mentions obligatoires, rétractation, relances) sont une aide : ils ne remplacent pas un conseil juridique. <L id="assur-L241-1" /></p>
      <h3>6. Données des clients de l’artisan</h3>
      <p>Pour les données de ses propres clients, l’artisan est responsable de traitement et Artesa son sous-traitant, selon l’<Link to="/sous-traitance">annexe de sous-traitance RGPD</Link>, qui fait partie de ce contrat. <L id="rgpd-28" /></p>
      <h3>7. Disponibilité et responsabilité</h3>
      <p>Artesa fait ses meilleurs efforts pour assurer un service disponible et des sauvegardes quotidiennes. Sa responsabilité est limitée au montant payé au cours des 12 derniers mois, sauf faute lourde ou dolosive.</p>
      <h3>8. Classement, suspension, plaintes</h3>
      <p>Les paramètres de classement, les motifs de suspension, le préavis de 15 jours avant toute modification et le système de plaintes sont décrits aux articles 3, 7, 8 et 10 des CGU. <L id="p2b-3" /> <L id="p2b-5" /></p>
    </Page>
  );
}

export function Privacy() {
  return (
    <Page title={t('Politique de confidentialité')}>
      <h3>Responsable du traitement</h3>
      <p>Artesa (coordonnées dans les <Link to="/mentions-legales">mentions légales</Link>), contact : support@artisandyou.fr. Pour les données qu’un artisan enregistre sur ses propres clients (devis, factures, planning), c’est l’artisan qui est responsable et Artesa son sous-traitant. <L id="rgpd-13" /></p>
      <h3>Données, finalités, bases légales et durées</h3>
      <table><thead><tr><th>Pourquoi</th><th>Données</th><th>Base légale</th><th>Durée</th></tr></thead><tbody>
        <tr><td>Créer et gérer votre compte</td><td>Identité, e-mail, téléphone, mot de passe (chiffré), préférences</td><td>Contrat</td><td>Tant que le compte existe, puis suppression sous 30 jours</td></tr>
        <tr><td>Mettre en relation, rendez-vous, messagerie, photos</td><td>Adresse des travaux, messages, photos, fichiers, rendez-vous</td><td>Contrat</td><td>Durée du compte</td></tr>
        <tr><td>Devis, factures, paiements</td><td>Montants, lignes, signature, historique</td><td>Obligation légale (comptabilité)</td><td>10 ans <L id="com-L123-22" /></td></tr>
        <tr><td>Vérifier les artisans</td><td>SIRET, attestations, assurance</td><td>Intérêt légitime (sécurité des clients) et obligation légale <L id="conso-L111-7" /></td><td>Durée du compte</td></tr>
        <tr><td>Vérifier l’identité (dirigeant : obligatoire ; particulier : compte certifié facultatif)</td><td>Copie de la pièce d’identité, nom indiqué</td><td>Intérêt légitime (sécurité des clients et des artisans, lutte contre les faux comptes)</td><td><b>Copie supprimée dès le contrôle</b> (en général sous 48 h ouvrées, ou dès l’annulation). Seuls le résultat, la date et la personne qui a vérifié sont gardés, le temps du compte. <L id="rgpd-5" /> <L id="rgpd-25" /> <L id="cnil-identite" /></td></tr>
        <tr><td>Avis</td><td>Note, texte, prénom, date</td><td>Intérêt légitime</td><td>Durée d’affichage de l’avis</td></tr>
        <tr><td>Sécurité, prévention des fraudes, traces de connexion</td><td>Journaux techniques, adresse IP</td><td>Obligation légale et intérêt légitime</td><td>1 an</td></tr>
        <tr><td>Assistant intelligent (questions posées)</td><td>Texte de la question</td><td>Contrat (fonction demandée)</td><td>Non conservé après la réponse</td></tr>
        <tr><td>Notifications et e-mails de service</td><td>E-mail, abonnement aux notifications</td><td>Contrat ; consentement pour les notifications push</td><td>Jusqu’au retrait</td></tr>
      </tbody></table>
      <p>Aucune donnée n’est vendue. Aucune publicité ciblée. Aucune décision automatisée produisant des effets juridiques. <L id="rgpd-6" /></p>
      <h3>Destinataires et sous-traitants</h3>
      <ul>
        <li>Les artisans que vous contactez, et leurs membres d’équipe autorisés.</li>
        <li>Supabase (base de données, fichiers, comptes) — serveurs dans l’Union européenne.</li>
        <li>Vercel (hébergement de l’application) — États-Unis, encadré par le cadre de protection des données UE–États-Unis et les clauses contractuelles types.</li>
        <li>Resend (envoi des e-mails) — États-Unis, clauses contractuelles types.</li>
        <li>Groq (assistant intelligent : la question seule, sans votre identité) — États-Unis, clauses contractuelles types.</li>
        <li>Services publics français : Base Adresse Nationale (adresses), Annuaire des entreprises (SIRET), découpage administratif.</li>
        <li>OpenStreetMap (fonds de carte, recherche d’adresses) et OSRM (calcul d’itinéraires) : seule la zone ou l’adresse recherchée est transmise.</li>
      </ul>
      <p><L id="rgpd-28" /> <L id="rgpd-46" /></p>
      <h3>Cookies et stockage local</h3>
      <p>Artesa n’utilise <b>aucun cookie publicitaire ni de mesure d’audience</b>. Seuls des éléments strictement nécessaires sont enregistrés sur votre appareil (session de connexion, langue, thème, préférences d’affichage, fonctionnement hors ligne) : ils sont exemptés de consentement. Les polices de caractères sont hébergées par Artesa (aucune donnée envoyée à Google). <L id="ip-82" /></p>
      <h3>Vos droits</h3>
      <p>Accès, rectification, effacement, limitation, opposition, portabilité (export zip depuis <i>Données et confidentialité</i>), retrait du consentement, directives post-mortem. Écrivez à support@artisandyou.fr : réponse sous un mois. Vous pouvez saisir la CNIL (cnil.fr). <L id="rgpd-15" /> <L id="rgpd-17" /> <L id="rgpd-20" /> <L id="rgpd-77" /></p>
      <h3>Sécurité</h3>
      <p>Connexions chiffrées (HTTPS), mots de passe chiffrés, cloisonnement des données par entreprise, double authentification, sauvegardes. En cas de violation de données à risque, la CNIL est prévenue sous 72 h et vous êtes informé si le risque est élevé. <L id="rgpd-32" /> <L id="rgpd-33" /></p>
    </Page>
  );
}

export function DPA() {
  return (
    <Page title={t('Annexe de sous-traitance RGPD')}>
      <p>Cette annexe fait partie des <Link to="/cgv">CGV artisans</Link>. Elle s’applique aux données des clients, prospects et salariés que l’artisan (le « responsable ») enregistre dans Artesa (le « sous-traitant »). <L id="rgpd-28" /></p>
      <h4>1. Objet et durée</h4><p>Héberger et traiter ces données pour fournir les fonctions d’Artesa (fichier clients, planning, devis, factures, relances, messagerie, export comptable), pendant la durée de l’abonnement.</p>
      <h4>2. Instructions</h4><p>Artesa ne traite les données que sur instruction documentée de l’artisan (l’utilisation des fonctions de l’application vaut instruction) et l’informe si une instruction lui paraît illégale.</p>
      <h4>3. Confidentialité</h4><p>Les personnes d’Artesa autorisées à accéder aux données sont tenues à la confidentialité. Aucun accès n’a lieu sans nécessité (support demandé, sécurité).</p>
      <h4>4. Sécurité</h4><p>Chiffrement des échanges, cloisonnement par entreprise (règles d’accès au niveau de la base), droits par rôle dans l’équipe, double authentification, sauvegardes, journalisation. <L id="rgpd-32" /></p>
      <h4>5. Sous-traitants ultérieurs</h4><p>Autorisation générale pour Supabase, Vercel, Resend et Groq (liste et pays dans la <Link to="/confidentialite">politique de confidentialité</Link>). Tout changement est annoncé 30 jours à l’avance ; l’artisan peut s’y opposer en résiliant.</p>
      <h4>6. Assistance</h4><p>Artesa aide l’artisan à répondre aux demandes d’exercice des droits (export, suppression), à assurer la sécurité et à réaliser une analyse d’impact si nécessaire.</p>
      <h4>7. Violation de données</h4><p>Notification à l’artisan dans les meilleurs délais et au plus tard 48 h après en avoir eu connaissance, avec les informations utiles à sa propre notification à la CNIL. <L id="rgpd-33" /></p>
      <h4>8. Fin du contrat</h4><p>Export possible pendant 30 jours, puis suppression, sauf les données que la loi impose de conserver (factures : 10 ans).</p>
      <h4>9. Audit</h4><p>Artesa met à disposition les informations nécessaires pour démontrer le respect de ces obligations et permet des audits raisonnables, annoncés 30 jours à l’avance.</p>
    </Page>
  );
}


// Signalement d'un contenu illicite (règlement UE 2022/2065 « DSA », art. 16) : ouvert à tous, même sans compte
const REASONS = [['illicite', 'Contenu illicite'], ['injure', 'Injure, menace, harcèlement'], ['fraude', 'Arnaque ou fraude'], ['vie_privee', 'Atteinte à la vie privée'], ['droit_auteur', 'Droit d’auteur ou marque'], ['faux_avis', 'Faux avis'], ['autre', 'Autre']];
const TYPES = [['avis', 'Un avis'], ['fiche', 'Une fiche artisan'], ['photo', 'Une photo'], ['message', 'Un message'], ['autre', 'Autre']];
export function Report() {
  const qs = new URLSearchParams(location.search);
  const [f, setF] = useState({ type: qs.get('type') || 'avis', target: qs.get('id') || '', url: qs.get('url') || '', reason: 'illicite', text: '', name: '', email: '', ok: false });
  const [state, setState] = useState('');
  const [err, setErr] = useState('');
  const set = (k, v) => setF({ ...f, [k]: v });
  const send = async () => {
    setErr(''); setState('…');
    try { await api.rpc('report_content', { p_type: f.type, p_target: f.target, p_url: f.url, p_reason: f.reason, p_explanation: f.text.trim(), p_name: f.name.trim(), p_email: f.email.trim(), p_good_faith: f.ok }); setState('ok'); }
    catch (e) { setState(''); setErr(e.message || String(e)); }
  };
  return (
    <Page title={t('Signaler un contenu')}>
      {state === 'ok' ? <div className="card soft"><b>{t('Signalement reçu.')}</b><p className="small" style={{ margin: '6px 0 0' }}>{t('Nous l’examinons rapidement et vous informerons de notre décision motivée. Merci.')}</p></div> : <>
        <p>{t('Un avis, une fiche, une photo ou un message vous paraît illicite ? Dites-nous lequel et pourquoi. Un signalement abusif peut engager votre responsabilité.')} <L id="dsa-16" /></p>
        <label className="field"><span>{t('Ce que vous signalez')}</span><select value={f.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select></label>
        <label className="field"><span>{t('Lien ou emplacement exact du contenu')}</span><input value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" /></label>
        <label className="field"><span>{t('Motif')}</span><select value={f.reason} onChange={(e) => set('reason', e.target.value)}>{REASONS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select></label>
        <label className="field"><span>{t('Pourquoi ce contenu est-il illicite ou contraire aux règles ?')}</span><textarea value={f.text} onChange={(e) => set('text', e.target.value)} rows={5} /></label>
        <div className="two"><label className="field"><span>{t('Votre nom')}</span><input value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" /></label><label className="field"><span>{t('Votre e-mail')}</span><input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" /></label></div>
        <label className="check"><input type="checkbox" checked={f.ok} onChange={(e) => set('ok', e.target.checked)} /><span>{t('Je déclare de bonne foi que les informations de ce signalement sont exactes et complètes.')}</span></label>
        {err && <div className="notice mt">{err}</div>}
        <button className="btn block mt" disabled={!f.ok || f.text.trim().length < 10 || state === '…'} onClick={send}>{t('Envoyer le signalement')}</button>
        <p className="small faint">{t('Vous pouvez aussi écrire à support@artisandyou.fr.')}</p>
      </>}
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
        <Wordmark size={60} style={{ margin: '0 auto' }} />
        <h1 className="center" style={{ fontSize: 28 }}>{t('Installer Artesa')}</h1>
        <div className="seg" style={{ margin: '6px 0 14px' }}>{[['pc', t('Ordinateur')], ['tel', t('Téléphone et tablette')]].map(([v, l]) => <button key={v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>{l}</button>)}</div>
        {tab === 'pc' ? <>
          <p className="center muted">{t('Le logiciel s’ouvre dans sa propre fenêtre, avec son icône, et se met à jour tout seul. Une connexion internet est nécessaire.')}</p>
          <a className={'opt' + (!isMac ? ' red' : '')} href={base + 'Artesa-Setup.exe'}><LuMonitor /><div><b>{t('Télécharger pour Windows')}</b><small>Windows 10 / 11 · .exe</small></div><LuDownload /></a>
          <a className={'opt' + (isMac ? ' red' : '')} href={base + 'Artesa.dmg'}><LuApple /><div><b>{t('Télécharger pour Mac')}</b><small>macOS 11+ · Apple Silicon et Intel · .dmg</small></div><LuDownload /></a>
          <div className="notice"><LuRefreshCw /><span>{t('Mises à jour automatiques : à chaque nouvelle version, le logiciel la télécharge en arrière-plan et l’installe au prochain démarrage.')}</span></div>
          <p className="small faint">{t('Au premier lancement sur Windows, si SmartScreen s’affiche, cliquez sur « Informations complémentaires » puis « Exécuter quand même » (le logiciel n’est pas encore signé). Sur Mac : clic droit sur l’application puis « Ouvrir ».')}</p>
          {canInstall && <button className="opt" onClick={install}><LuMonitor /><div><b>{t('Ou installer la version web')}</b><small>{t('Sans téléchargement, depuis ce navigateur (Chrome, Edge)')}</small></div></button>}
        </> : <>
          <p className="center muted">{t('Ajoutez Artesa sur l’écran d’accueil : l’application s’ouvre en plein écran avec son icône, comme une vraie application, et elle est toujours à jour.')}</p>
          {installed ? <div className="notice">✅ {t('Artesa est installée sur cet appareil.')}</div> : <>
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
