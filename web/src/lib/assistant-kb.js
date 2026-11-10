// Base de connaissances de l'assistant Artesa.
// Aujourd'hui : l'assistant cherche ici la meilleure réponse (gratuit, hors ligne, instantané).
// Demain, avec l'IA : on n'enverra à l'IA que les 2-3 fiches les plus proches de la question
// (au lieu de toute la documentation), ce qui limite fortement les tokens consommés.
// Chaque fiche : q (question type), k (mots-clés), a (réponse courte), links (boutons qui ouvrent la bonne page), pages (pages où la proposer en premier).

export const KB = [
  // ---------- Devis ----------
  { id: 'devis-creer', q: 'Comment créer un devis ?', k: 'creer faire nouveau devis estimation chiffrage', pages: ['/pro/documents', '/pro'],
    a: 'Touchez « + » puis « Nouveau devis » (ou le bouton dans la tuile Devis). Choisissez le client, ajoutez vos lignes (ou piochez dans votre bibliothèque), puis « Envoyer ». Le numéro et les mentions légales sont ajoutés automatiquement.',
    links: [{ label: 'Nouveau devis', to: '/pro/documents/nouveau?kind=devis' }, { label: 'Mes devis', to: '/pro/documents/devis' }] },
  { id: 'devis-signer', q: 'Comment faire signer un devis (bon pour accord) ?', k: 'signer signature bon pour accord accepter valider devis client electronique', pages: ['/pro/documents'],
    a: 'Envoyez le devis : le client le reçoit dans son espace Artesa et le signe en ligne (nom, signature dessinée facultative, case « Bon pour accord »). La date et une empreinte du devis sont gardées comme preuve, et vous êtes prévenu. S’il n’a pas de compte, le lien de l’e-mail l’invite à en créer un gratuitement. Signature sur papier : ouvrez le devis puis « Marquer comme signé ».',
    links: [{ label: 'Mes devis', to: '/pro/documents/devis' }, { label: 'Inviter mes clients', to: '/pro/reseau/inviter-clients' }] },
  { id: 'devis-facture', q: 'Transformer un devis en facture', k: 'transformer convertir devis facture acompte situation', pages: ['/pro/documents'],
    a: 'Ouvrez le devis signé puis « Créer la facture » (ou une facture d’acompte). Les lignes sont reprises automatiquement.',
    links: [{ label: 'Mes devis', to: '/pro/documents/devis' }] },
  { id: 'devis-reglages', q: 'Changer la numérotation, la TVA ou la validité des devis', k: 'numerotation numero prefixe tva validite acompte mention reglage devis', pages: ['/pro/compte'],
    a: 'Paramètres › Devis : préfixe de numérotation, TVA par défaut, durée de validité, acompte et mention en bas de page.',
    links: [{ label: 'Réglages des devis', to: '/pro/compte/devis' }] },

  // ---------- Factures ----------
  { id: 'facture-creer', q: 'Comment créer une facture ?', k: 'creer faire nouvelle facture facturer', pages: ['/pro/documents', '/pro'],
    a: 'Touchez « + » puis « Nouvelle facture », ou transformez un devis signé. Une facture envoyée est verrouillée (obligation légale) : pour corriger, on crée un avoir.',
    links: [{ label: 'Nouvelle facture', to: '/pro/documents/nouveau?kind=facture' }, { label: 'Mes factures', to: '/pro/documents/factures' }] },
  { id: 'facture-electronique', q: 'La facturation électronique, comment ça marche ?', k: 'facture electronique facturation electronique reforme 2026 2027 ppf pdp obligation', pages: ['/pro/documents'],
    a: 'Artesa émet des factures conformes à la réforme de la facturation électronique (obligation 2026-2027). Vérifiez que les mentions obligatoires de votre entreprise sont remplies (champs marqués d’un astérisque rouge).',
    links: [{ label: 'Mon entreprise', to: '/pro/compte/entreprise' }, { label: 'Réglages des factures', to: '/pro/compte/factures' }] },
  { id: 'facture-paiement', q: 'Enregistrer un paiement reçu', k: 'paiement encaisser regler payee virement cheque especes recu', pages: ['/pro/documents'],
    a: 'Ouvrez la facture puis « Enregistrer un paiement » (montant, date, moyen). La facture passe « Payée » ou « Partiellement payée » toute seule.',
    links: [{ label: 'Mes factures', to: '/pro/documents/factures' }] },
  { id: 'relances', q: 'Relancer une facture impayée ou un devis sans réponse', k: 'relance relancer impaye retard rappel devis sans reponse paye paiement client mauvais payeur', pages: ['/pro/documents'],
    a: 'La tuile Relances liste les factures en retard et les devis sans réponse, avec des messages prêts à envoyer.',
    links: [{ label: 'Relances', to: '/pro/relances' }] },
  { id: 'avoir', q: 'Corriger ou annuler une facture (avoir)', k: 'avoir annuler corriger erreur facture rembourser', pages: ['/pro/documents'],
    a: 'Une facture émise ne se modifie plus. Ouvrez-la et créez un avoir, puis une nouvelle facture corrigée.',
    links: [{ label: 'Mes factures', to: '/pro/documents/factures' }] },
  { id: 'mentions', q: 'Mentions obligatoires sur mes devis et factures', k: 'mention obligatoire legal siren siret tva assurance decennale mediateur penalite', pages: ['/pro/compte'],
    a: 'Les champs obligatoires sont marqués d’un astérisque rouge dans Mon entreprise et dans les réglages Devis / Factures (SIREN, TVA, assurance décennale, médiateur, pénalités, IBAN…).',
    links: [{ label: 'Mon entreprise', to: '/pro/compte/entreprise' }, { label: 'Réglages des factures', to: '/pro/compte/factures' }] },

  // ---------- Planning ----------
  { id: 'rdv-creer', q: 'Ajouter un rendez-vous', k: 'ajouter creer nouveau rdv rendez vous intervention chantier visite planning', pages: ['/pro/planning', '/pro'],
    a: 'Touchez « + » puis « Nouveau rendez-vous », ou touchez un créneau « Libre » / « Dispo » dans le planning.',
    links: [{ label: 'Nouveau rendez-vous', to: '/pro/planning/nouveau' }, { label: 'Planning', to: '/pro/planning' }] },
  { id: 'rdv-deplacer', q: 'Déplacer un rendez-vous', k: 'deplacer decaler modifier changer heure date rdv rendez vous glisser', pages: ['/pro/planning'],
    a: 'Sur ordinateur, faites glisser le rendez-vous. Partout, ouvrez-le puis « Modifier ». Le client reçoit une notification et un message « RDV déplacé », et le déplacement apparaît dans son historique.',
    links: [{ label: 'Planning', to: '/pro/planning' }] },
  { id: 'rdv-valider', q: 'Accepter une demande de rendez-vous', k: 'accepter valider refuser demande rdv a valider pointilles', pages: ['/pro/planning'],
    a: 'Les demandes des particuliers apparaissent « À valider » (en pointillés). Ouvrez-les pour accepter, proposer un autre horaire ou refuser.',
    links: [{ label: 'Planning', to: '/pro/planning' }] },
  { id: 'rdv-termine', q: 'Marquer un rendez-vous comme terminé', k: 'termine fini fin rdv marquer', pages: ['/pro/planning'],
    a: 'C’est automatique : un rendez-vous passe « Terminé » à son heure de fin.',
    links: [{ label: 'Planning', to: '/pro/planning' }] },
  { id: 'rdv-filtres', q: 'Masquer une équipe ou les créneaux libres du planning', k: 'masquer cacher afficher filtre equipe dispo legende visio', pages: ['/pro/planning'],
    a: 'Touchez un élément de la légende en haut du planning (équipe, Dispo, À valider, Validé, Visio) pour l’afficher ou le masquer.',
    links: [{ label: 'Planning', to: '/pro/planning' }] },
  { id: 'rdv-semaine', q: 'Aller à une autre semaine du planning', k: 'semaine choisir date aller mois calendrier', pages: ['/pro/planning'],
    a: 'Touchez « Semaine N ▾ » en haut du planning : un calendrier s’ouvre, touchez la semaine voulue.',
    links: [{ label: 'Planning', to: '/pro/planning' }] },
  { id: 'agenda-sync', q: 'Synchroniser avec Google Agenda ou l’iPhone', k: 'synchroniser google agenda outlook iphone calendrier ics abonnement', pages: ['/pro/planning'],
    a: 'Réglages du planning › « Abonner mon agenda » : copiez le lien une fois dans Google Agenda, Outlook ou le Calendrier de l’iPhone.',
    links: [{ label: 'Réglages du planning', to: '/pro/planning/reglages' }] },
  { id: 'horaires', q: 'Changer mes horaires et jours travaillés', k: 'horaires heures jours travailles ouverture duree reglage planning', pages: ['/pro/planning'],
    a: 'Réglages du planning : heures affichées, jours travaillés, durée des rendez-vous, rappels.',
    links: [{ label: 'Réglages du planning', to: '/pro/planning/reglages' }] },

  // ---------- Chantiers partagés / réseau ----------
  { id: 'reseau-ajouter', q: 'Ajouter un pro à mon réseau', k: 'ajouter pro reseau artisan collegue partenaire demande connexion', pages: ['/pro/reseau'],
    a: 'Mon réseau › « + » : cherchez le pro et envoyez une demande. Dès qu’il accepte, vous êtes connectés des deux côtés.',
    links: [{ label: 'Ajouter un pro', to: '/pro/reseau/ajouter' }, { label: 'Mon réseau', to: '/pro/reseau' }] },
  { id: 'chantier-partage', q: 'Partager un chantier avec d’autres pros', k: 'chantier partage commun projet equipe inviter pro planning commun', pages: ['/pro/reseau', '/pro/planning'],
    a: 'Le pro doit d’abord être dans votre réseau. Ouvrez sa fiche › « Inviter sur un chantier » : il reçoit l’invitation en message privé et doit l’accepter. Le planning du chantier se choisit ensuite en haut du Planning.',
    links: [{ label: 'Mon réseau', to: '/pro/reseau' }, { label: 'Planning', to: '/pro/planning' }] },
  { id: 'notes', q: 'Noter un pro ou un client', k: 'noter note etoile avis evaluer serieux fiabilite', pages: ['/pro/reseau', '/pro/clients'],
    a: 'Un pro se note depuis sa fiche, seulement si vous avez travaillé ensemble. Un client se note depuis sa fiche (« Fiabilité du client »). Une seule note par personne.',
    links: [{ label: 'Mon réseau', to: '/pro/reseau' }, { label: 'Clients', to: '/pro/clients' }] },

  // ---------- Clients ----------
  { id: 'client-creer', q: 'Ajouter un client', k: 'ajouter creer nouveau client fiche particulier professionnel', pages: ['/pro/clients', '/pro'],
    a: 'Clients › « + » : nom, téléphone et adresse du chantier suffisent pour commencer.',
    links: [{ label: 'Nouveau client', to: '/pro/clients/nouveau' }, { label: 'Clients', to: '/pro/clients' }] },
  { id: 'client-inviter', q: 'Inviter mes clients sur Artesa', k: 'inviter client compte espace inscription bouche oreille partager lien', pages: ['/pro/clients', '/pro/reseau'],
    a: 'Mon réseau › « Inviter mes clients » : envoyez le lien par SMS, e-mail ou n’importe quelle app (bouton Partager). C’est gratuit pour eux, et votre conversation s’ouvre à l’inscription.',
    links: [{ label: 'Inviter mes clients', to: '/pro/reseau/inviter-clients' }] },
  { id: 'client-historique', q: 'Voir l’historique d’un client', k: 'historique client passe rdv paiement document suivi', pages: ['/pro/clients'],
    a: 'Ouvrez la fiche du client › tuile Historique : rendez-vous (et déplacements), devis, factures et paiements.',
    links: [{ label: 'Clients', to: '/pro/clients' }] },

  // ---------- Messages / notifications ----------
  { id: 'messages', q: 'Écrire à un client ou à un pro', k: 'message ecrire envoyer discuter conversation chat', pages: ['/pro/messages'],
    a: 'Messages › « + » › Nouvelle conversation, ou depuis la fiche du client (tuile Messages).',
    links: [{ label: 'Messages', to: '/pro/messages' }] },
  { id: 'notifs', q: 'Je ne reçois pas les notifications', k: 'notification push alerte recois pas son telephone activer', pages: [],
    a: 'Paramètres › Notifications : activez « Notifications sur cet appareil » et autorisez-les quand le téléphone le demande. Sur iPhone, l’app doit être ajoutée à l’écran d’accueil (Partager › Sur l’écran d’accueil).',
    links: [{ label: 'Notifications', to: '/pro/compte/notifications' }] },

  // ---------- Compte / abonnement ----------
  { id: 'abonnement', q: 'Abonnement et prix', k: 'abonnement prix tarif formule essai gratuit payer payant', pages: ['/pro/compte'],
    a: 'Paramètres › Abonnement et parrainage : votre formule, les jours d’essai restants et le changement de formule.',
    links: [{ label: 'Abonnement', to: '/pro/compte/abonnement' }] },
  { id: 'parrainage', q: 'Parrainer un artisan', k: 'parrainer parrainage code filleul mois offert', pages: ['/pro/compte', '/pro'],
    a: 'Partagez votre code : votre filleul a 1 mois offert en plus de l’essai, et vous gagnez 15 jours (10 filleuls maximum).',
    links: [{ label: 'Mon parrainage', to: '/pro/compte/abonnement' }] },
  { id: 'equipe', q: 'Ajouter un salarié à mon équipe', k: 'equipe salarie ouvrier employe chef membre code invitation droits', pages: ['/pro/compte'],
    a: 'Paramètres › Mon équipe : créez un code d’invitation (gérant, chef ou ouvrier). Votre salarié le saisit à l’inscription.',
    links: [{ label: 'Mon équipe', to: '/pro/compte/equipe' }] },
  { id: 'logo', q: 'Ajouter mon logo et mes infos d’entreprise', k: 'logo entreprise adresse siret coordonnees profil public', pages: ['/pro/compte'],
    a: 'Paramètres › Mon entreprise : logo, coordonnées, SIRET, assurance, zone d’intervention.',
    links: [{ label: 'Mon entreprise', to: '/pro/compte/entreprise' }] },
  { id: 'coffre', q: 'Ranger mes attestations (Kbis, décennale, URSSAF)', k: 'coffre fort kbis decennale urssaf attestation document obligatoire', pages: ['/pro/documents'],
    a: 'Documents › Coffre-fort : déposez vos attestations. Les documents obligatoires sont marqués d’un astérisque rouge.',
    links: [{ label: 'Coffre-fort', to: '/pro/coffre-fort' }] },
  { id: 'sombre', q: 'Activer le mode sombre ou changer la langue', k: 'mode sombre theme nuit langue anglais portugais apparence', pages: ['/pro/compte'],
    a: 'Paramètres › Langue et apparence.',
    links: [{ label: 'Langue et apparence', to: '/pro/compte/apparence' }] },
  { id: 'logiciel', q: 'Installer Artesa sur PC, Mac ou téléphone', k: 'installer application pc mac windows telephone iphone android telecharger', pages: ['/pro/compte'],
    a: 'Paramètres › Logiciel PC / Mac et application mobile. Sur téléphone : ouvrez le site puis « Ajouter à l’écran d’accueil ».',
    links: [{ label: 'Télécharger', to: '/telecharger' }] },
  { id: 'support', q: 'Contacter le support', k: 'aide support contact probleme bug humain', pages: [],
    a: 'Paramètres › Aide et support : écrivez-nous, nous répondons rapidement.',
    links: [{ label: 'Aide et support', to: '/pro/compte/aide' }] },
];

const SYN = { rdv: 'rendez vous', rendezvous: 'rendez vous', facturer: 'facture', signe: 'signer', signature: 'signer', deplace: 'deplacer', decaler: 'deplacer', supprimer: 'annuler', tel: 'telephone', mobile: 'telephone', appli: 'application', app: 'application', paye: 'paiement', payer: 'paiement', pro: 'artisan' };
export const nz = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const words = (x) => nz(x).split(/[^a-z0-9]+/).filter((w) => w.length > 1).map((w) => SYN[w] || w).join(' ').split(' ').map((w) => (w.length > 4 ? w.replace(/(s|x)$/, '') : w));

// Les fiches les plus pertinentes pour une question (et la page en cours en cas d'égalité).
// Un mot rare (« relance ») compte plus qu'un mot fréquent (« client »).
const STOP = ['comment', 'faire', 'est', 'les', 'des', 'une', 'pour', 'mon', 'mes', 'que', 'quoi', 'avec', 'dans', 'sur', 'pas', 'qui', 'je', 'il', 'un', 'le', 'la', 'de', 'du', 'et', 'ou', 'ne'];
let DF = null;
const docWords = (e) => new Set([...words(e.k), ...words(e.q)]);
export function searchKB(q, path = '', n = 3) {
  if (!DF) { DF = {}; KB.forEach((e) => docWords(e).forEach((w) => { DF[w] = (DF[w] || 0) + 1; })); }
  const ws = [...new Set(words(q))].filter((w) => !STOP.includes(w));
  if (!ws.length) return [];
  const idf = (w) => Math.log(1 + KB.length / (DF[w] || 1));
  return KB.map((e) => {
    const kw = words(e.k), qw = words(e.q);
    let sc = 0;
    for (const w of ws) {
      if (qw.includes(w)) sc += 1.5 * idf(w); else if (kw.includes(w)) sc += idf(w);
      else { const p = kw.find((k) => k.length > 3 && w.length > 3 && (k.startsWith(w.slice(0, 5)) || w.startsWith(k.slice(0, 5)))); if (p) sc += 0.6 * idf(p); }
    }
    if (sc && e.pages?.some((p) => path.startsWith(p) && p !== '/pro')) sc += 0.3;
    return { e, sc };
  }).filter((x) => x.sc >= 1.2).sort((a, b) => b.sc - a.sc).slice(0, n).map((x) => x.e);
}
// Questions proposées d'emblée selon la page
export const suggestFor = (path) => {
  const best = KB.filter((e) => e.pages?.some((p) => p !== '/pro' && path.startsWith(p)));
  return (best.length ? best : KB.filter((e) => e.pages?.includes('/pro'))).slice(0, 4);
};
