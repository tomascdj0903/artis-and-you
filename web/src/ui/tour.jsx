// Tutoriels : visite guidée à la première connexion (aussi pour les comptes existants) et mini-tuto à la première ouverture de chaque rubrique
import { useEffect, useLayoutEffect, useState } from 'react';
import { LuX, LuArrowRight, LuArrowLeft } from 'react-icons/lu';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { t } from '../lib/i18n.js';

// sel : élément mis en valeur (facultatif) ; sur mobile, les éléments du menu latéral ne sont pas visibles → carte centrée
const S = (title, text, sel) => ({ title, text, sel });
export const TOURS = {
  'welcome-pro': [
    S('Bienvenue sur Artesa 👋', 'En 1 minute, voici l’essentiel. Vous pourrez revoir ce tutoriel à tout moment dans Mon compte › Aide.'),
    S('Votre barre de recherche', 'Cherchez un client, un devis, un rendez-vous ou une action (« nouveau devis »). Le micro permet de dicter.', '.searchrow'),
    S('Clients', 'Toutes vos fiches clients, particuliers et professionnels, avec leurs chantiers, devis et factures.', 'a[href="/pro/clients"]'),
    S('Planning', 'Vos rendez-vous et chantiers. Les demandes des particuliers arrivent ici « À valider ».', 'a[href="/pro/planning"]'),
    S('Documents', 'Devis, factures, acomptes, avoirs, relances et votre coffre-fort de documents.', 'a[href="/pro/documents"]'),
    S('CRM', 'Le suivi de vos projets, vos chiffres (KPI), votre bibliothèque de prix et l’export comptable.', 'a[href="/pro/crm"]'),
    S('Messages et réseau', 'Échangez avec vos clients et votre équipe, et travaillez avec d’autres pros sur un même chantier.', 'a[href="/pro/messages"]'),
    S('Notifications', 'La cloche affiche vos dernières notifications : cliquez dessus pour ouvrir la bonne page.', '.notifbell'),
    S('C’est parti !', 'Commencez par compléter votre entreprise et votre logo, puis créez votre premier client.'),
  ],
  'welcome-client': [
    S('Bienvenue sur Artesa 👋', 'Trouvez un artisan, prenez rendez-vous et retrouvez tous vos documents au même endroit.'),
    S('Trouver un artisan', 'Cherchez par métier ou par ville, consultez les avis et demandez un rendez-vous en ligne.', '.searchrow, .search'),
    S('Mes rendez-vous', 'Suivez vos demandes et vos rendez-vous confirmés, déplacez-les ou annulez-les.', 'a[href="/client/rdv"]'),
    S('Messages', 'Discutez directement avec vos artisans, envoyez des photos.', 'a[href="/client/messages"]'),
    S('Documents', 'Vos devis à signer en ligne, vos factures, et le carnet de votre logement.', 'a[href="/client/documents"]'),
    S('C’est parti !', 'Vous pouvez revoir ce tutoriel à tout moment dans Mon compte.'),
  ],
  '/pro/clients': [
    S('Vos clients', 'Ici se trouvent toutes vos fiches : particuliers et professionnels. Chaque devis, facture ou rendez-vous est rattaché à une fiche.'),
    S('Chercher et trier', 'Tapez un nom, une ville ou un numéro. Le bouton filtre trie par type (particulier / pro), ville ou statut (actif, prospect, inactif).', '.searchrow'),
    S('Ajouter un client', 'Le bouton + crée une fiche en 30 secondes : nom, téléphone, adresse du chantier. Le reste peut attendre.', '.fab'),
    S('Dans une fiche', 'Vous y trouvez le solde, les devis et factures, la messagerie, l’historique (RDV, déplacements, paiements), les photos et une note libre. Vous pouvez aussi noter la fiabilité du client.'),
  ],
  '/pro/planning': [
    S('Votre planning', 'Vos rendez-vous par jour, semaine ou mois. Les créneaux « Dispo » sont libres : touchez-en un pour y créer un rendez-vous.', '.cal-head'),
    S('Déplacer un rendez-vous', 'Faites glisser un rendez-vous (par pas de 15 min). Le client reçoit une notification et un message, et le déplacement apparaît dans son historique.'),
    S('À valider / terminé', 'Les demandes des particuliers arrivent en pointillés « À valider ». Un rendez-vous passe automatiquement « Terminé » à son heure de fin.', '.cal-legend'),
    S('Chantiers en commun', 'Si vous partagez des chantiers avec d’autres pros, la liste en haut affiche le planning du chantier : qui vient quel jour (plombier, menuisier…). Votre planning à vous ne montre que vos rendez-vous.'),
    S('Nouveau rendez-vous', 'Le bouton + crée un rendez-vous : client, objet, horaires, équipe, adresse, et éventuellement le chantier en commun.', '.fab'),
  ],
  '/pro/documents': [
    S('Vos documents', 'Devis, factures, photos, autres documents, coffre-fort et relances. Les numéros et mentions légales sont gérés pour vous.'),
    S('Créer en un clic', 'Les boutons « Nouveau devis » et « Nouvelle facture » sont directement dans les tuiles. Toucher le reste de la tuile ouvre la liste.', '.tile-new'),
    S('Relances', 'La tuile Relances liste les factures en retard et les devis sans réponse, avec des messages prêts à envoyer.'),
    S('Derniers documents', 'En bas, vos derniers documents : ouvrez, modifiez ou affichez le PDF directement.'),
  ],
  '/pro/crm': [
    S('Votre CRM', 'Le suivi de votre activité en un coup d’œil.'),
    S('Statut projet', 'Chaque chantier passe par : Devis, À planifier, Chantier, Factures à émettre (travaux finis, facture pas encore envoyée), Encaissements en attente (facture envoyée, pas encore payée), Terminé.'),
    S('KPI', 'Votre chiffre d’affaires, vos taux de signature et ce qu’il reste à encaisser.'),
    S('Ma bibliothèque', 'Enregistrez vos produits et ouvrages pour remplir vos devis plus vite.'),
  ],
  '/pro/messages': [
    S('Messagerie', 'Vos conversations avec les clients, votre équipe et les pros de votre réseau.'),
    S('Messages automatiques', 'Quand vous déplacez un rendez-vous, un message « RDV déplacé » est envoyé au client dans sa conversation.'),
    S('Dicter', 'Le micro permet de dicter un message, pratique sur le chantier.'),
  ],
  '/pro/reseau': [
    S('Mon réseau', 'Les pros avec qui vous travaillez : échangez, partagez des chantiers, organisez-vous.'),
    S('Ajouter un pro', 'Le bouton + cherche un pro sur Artesa et lui envoie une demande. Dès qu’il accepte, vous êtes connectés des deux côtés.', '.plus'),
    S('Demandes reçues', 'Les demandes de connexion apparaissent en haut de cette page et dans vos notifications : Accepter ou Refuser.'),
    S('Projets en commun', 'Depuis la fiche d’un pro, « Inviter sur un chantier » crée un projet en commun. Vous retrouvez ces projets ici et leur planning partagé dans Planning.'),
    S('Notes entre pros', 'Après avoir travaillé ensemble, vous pouvez noter un pro une seule fois depuis sa fiche.'),
  ],
  '/client/rdv': [S('Vos rendez-vous', 'Retrouvez vos demandes en attente et vos rendez-vous confirmés.')],
  '/client/documents': [S('Vos documents', 'Signez vos devis en ligne, payez vos factures et retrouvez vos documents de chantier.')],
  '/client/messages': [S('Messagerie', 'Écrivez à vos artisans, envoyez des photos. Le micro permet de dicter.')],
};

// Le suffixe de version fait réapparaître les tutos quand leur contenu est enrichi
const V = '#2';
const done = (profile) => (profile?.privacy?.tours || []).filter((k) => k.endsWith(V)).map((k) => k.slice(0, -V.length));

export function useTours(path) {
  const { profile, setProfile, isPro } = useApp();
  const [key, setKey] = useState(null);
  useEffect(() => {
    if (!profile) return;
    const d = done(profile);
    const welcome = isPro ? 'welcome-pro' : 'welcome-client';
    if (!d.includes(welcome)) { if (path === (isPro ? '/pro' : '/client')) setKey(welcome); return; }
    const sec = Object.keys(TOURS).find((k) => k.startsWith('/') && (path === k || path.startsWith(k + '/')) && path.split('/').length <= 3);
    setKey(sec && !d.includes(sec) ? sec : null);
  }, [path, profile?.id]);
  const finish = async () => {
    const k = key; setKey(null);
    const privacy = { ...(profile.privacy || {}), tours: [...new Set([...done(profile), k].map((x) => x + V))] };
    setProfile({ ...profile, privacy });
    try { await api.update('profiles', { id: profile.id }, { privacy }); } catch {}
  };
  return [key, finish];
}

export async function resetTours(profile, setProfile) {
  const privacy = { ...(profile.privacy || {}), tours: [] };
  setProfile({ ...profile, privacy });
  await api.update('profiles', { id: profile.id }, { privacy });
}

export function Tour({ id, onDone }) {
  const steps = TOURS[id] || [];
  const [i, setI] = useState(0);
  const [box, setBox] = useState(null);
  const s = steps[i];
  useLayoutEffect(() => {
    if (!s?.sel) { setBox(null); return; }
    const el = [...document.querySelectorAll(s.sel)].find((e) => e.getClientRects().length && e.getBoundingClientRect().width > 0);
    if (!el) { setBox(null); return; }
    el.scrollIntoView({ block: 'nearest' });
    const r = el.getBoundingClientRect(); setBox({ x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 });
  }, [i, id]);
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onDone(); if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft' && i) setI(i - 1); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); });
  if (!s) return null;
  const next = () => (i < steps.length - 1 ? setI(i + 1) : onDone());
  const below = box && box.y + box.h + 220 < window.innerHeight;
  const cardStyle = box && window.innerWidth > 700
    ? { left: Math.min(Math.max(16, box.x), window.innerWidth - 376), top: below ? box.y + box.h + 12 : Math.max(16, box.y - 212) }
    : {};
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-t">
      {box ? <div className="tour-spot" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} /> : <div className="tour-dim" />}
      <div className={'tour-card' + (box && window.innerWidth > 700 ? ' at' : '')} style={cardStyle}>
        <button className="tour-x" onClick={onDone} aria-label={t('Passer le tutoriel')}><LuX /></button>
        <div className="small faint">{t('Étape {a} sur {b}', { a: i + 1, b: steps.length })}</div>
        <h3 id="tour-t">{t(s.title)}</h3>
        <p>{t(s.text)}</p>
        <div className="row between">
          {i > 0 ? <button className="btn ghost sm" onClick={() => setI(i - 1)}><LuArrowLeft /> {t('Précédent')}</button> : <button className="link small" onClick={onDone}>{t('Passer')}</button>}
          <button className="btn sm" onClick={next} autoFocus>{i < steps.length - 1 ? <>{t('Suivant')} <LuArrowRight /></> : t('Terminer')}</button>
        </div>
      </div>
    </div>
  );
}
