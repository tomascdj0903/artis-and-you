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
  '/pro/clients': [S('Vos clients', 'Ajoutez un client avec le bouton +. Le filtre permet de trier par type, ville ou statut.', '.fab'), S('La fiche client', 'Ouvrez un client pour voir ses chantiers, devis, factures, photos et notes.')],
  '/pro/planning': [S('Votre planning', 'Glissez un rendez-vous pour le déplacer (le client est prévenu). Les demandes à valider sont en pointillés.'), S('Réglages', 'Jours, horaires, types de rendez-vous proposés et lien avec votre agenda Google ou Outlook.')],
  '/pro/documents': [S('Vos documents', 'Créez un devis ou une facture en quelques clics. Les numéros et mentions légales sont gérés pour vous.'), S('Relances', 'La tuile Relances liste les factures en retard et les devis sans réponse, avec des messages prêts à envoyer.')],
  '/pro/crm': [S('Votre CRM', 'Statut projet : où en est chaque chantier. KPI : votre chiffre d’affaires et vos taux de signature.'), S('Ma bibliothèque', 'Enregistrez vos produits et ouvrages pour remplir vos devis plus vite.')],
  '/pro/messages': [S('Messagerie', 'Vos conversations avec les clients, votre équipe et d’autres pros. Le micro permet de dicter un message.')],
  '/pro/reseau': [S('Mon réseau', 'Ajoutez les pros avec qui vous travaillez pour partager des chantiers et échanger facilement.')],
  '/client/rdv': [S('Vos rendez-vous', 'Retrouvez vos demandes en attente et vos rendez-vous confirmés.')],
  '/client/documents': [S('Vos documents', 'Signez vos devis en ligne, payez vos factures et retrouvez vos documents de chantier.')],
  '/client/messages': [S('Messagerie', 'Écrivez à vos artisans, envoyez des photos. Le micro permet de dicter.')],
};

const done = (profile) => profile?.privacy?.tours || [];

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
    const privacy = { ...(profile.privacy || {}), tours: [...new Set([...done(profile), k])] };
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
