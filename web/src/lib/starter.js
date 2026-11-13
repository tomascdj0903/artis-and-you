// Bibliothèque de démarrage gratuite : quelques ouvrages et articles courants par métier.
// Prix HT indicatifs (moyennes constatées en France) : chaque artisan les ajuste à ses tarifs.
const A = (name, family, unit, purchase, sale, vat = 20) => ({ kind: 'article', name, family, unit, purchase_price: purchase, coef: purchase ? Math.round((sale / purchase) * 100) / 100 : 1, sale_price: sale, vat_rate: vat });
const O = (name, family, unit, sale, hours, vat = 10) => ({ kind: 'ouvrage', name, family, unit, purchase_price: 0, coef: 1, sale_price: sale, vat_rate: vat, labour_hours: hours });
export const STARTER = {
  'Plomberie et chauffage': [
    A('Chauffe-eau électrique 200 L', 'Chauffe-eau', 'u', 420, 690), A('Mitigeur lavabo', 'Robinetterie', 'u', 45, 89), A('Raccord PER Ø16', 'Raccords', 'u', 3, 6.5),
    O('Remplacement d’un chauffe-eau', 'Chauffe-eau', 'forfait', 380, 4), O('Débouchage canalisation', 'Dépannage', 'forfait', 150, 1.5), O('Recherche de fuite', 'Dépannage', 'forfait', 180, 2), O('Pose d’un WC suspendu', 'Sanitaire', 'u', 450, 5),
  ],
  'Électricité': [
    A('Prise 2P+T', 'Appareillage', 'u', 6, 14), A('Disjoncteur 16 A', 'Tableau', 'u', 9, 22), A('Câble R2V 3G2,5 (m)', 'Câbles', 'm', 1.2, 2.9),
    O('Pose d’une prise', 'Appareillage', 'u', 75, 0.8), O('Remplacement tableau électrique', 'Tableau', 'forfait', 1200, 8), O('Diagnostic dépannage', 'Dépannage', 'forfait', 90, 1), O('Pose d’un point lumineux', 'Éclairage', 'u', 95, 1),
  ],
  'Peinture': [
    A('Peinture acrylique blanc mat 10 L', 'Peintures', 'u', 55, 95), A('Enduit de rebouchage 5 kg', 'Préparation', 'u', 14, 26),
    O('Peinture murs (2 couches)', 'Peinture intérieure', 'm²', 24, 0.35), O('Peinture plafond (2 couches)', 'Peinture intérieure', 'm²', 28, 0.4), O('Préparation des supports', 'Préparation', 'm²', 9, 0.15), O('Ravalement de façade', 'Extérieur', 'm²', 45, 0.5),
  ],
  'Carrelage': [
    A('Colle carrelage C2 25 kg', 'Fournitures', 'u', 18, 32), A('Joint carrelage 5 kg', 'Fournitures', 'u', 12, 22),
    O('Pose carrelage sol', 'Pose', 'm²', 45, 0.8), O('Pose faïence murale', 'Pose', 'm²', 50, 0.9), O('Dépose ancien carrelage', 'Dépose', 'm²', 18, 0.4),
  ],
  'Maçonnerie': [
    A('Ciment 35 kg', 'Matériaux', 'u', 9, 16), A('Parpaing 20x20x50', 'Matériaux', 'u', 1.4, 2.6),
    O('Mur en parpaings', 'Gros œuvre', 'm²', 75, 1.2), O('Dalle béton 12 cm', 'Gros œuvre', 'm²', 85, 1), O('Ouverture mur porteur', 'Gros œuvre', 'forfait', 2500, 16),
  ],
  'Menuiserie': [
    A('Porte intérieure 83 cm', 'Portes', 'u', 120, 220), A('Plinthe MDF (ml)', 'Finitions', 'm', 3, 7),
    O('Pose porte intérieure', 'Portes', 'u', 180, 2.5), O('Pose fenêtre PVC', 'Fenêtres', 'u', 250, 3), O('Pose parquet flottant', 'Sols', 'm²', 28, 0.5),
  ],
  'Charpente': [
    A('Bois de charpente sapin traité (m³)', 'Bois', 'u', 420, 650), A('Connecteurs et équerres (lot)', 'Quincaillerie', 'u', 35, 65),
    O('Traitement de charpente (insecticide, fongicide)', 'Traitement', 'm²', 28, 0.3), O('Remplacement de chevrons', 'Réparation', 'm', 65, 0.8), O('Pose d’une charpente traditionnelle', 'Charpente neuve', 'm²', 120, 1.5), O('Création d’une ouverture de toit (chevêtre)', 'Réparation', 'u', 650, 6),
  ],
  'Couverture (toiture)': [
    A('Tuile terre cuite (u)', 'Tuiles', 'u', 1.1, 2.2), A('Écran sous-toiture (rouleau 75 m²)', 'Étanchéité', 'u', 85, 140),
    O('Réfection de toiture en tuiles', 'Couverture', 'm²', 120, 1.2), O('Remplacement de tuiles cassées', 'Dépannage', 'forfait', 250, 2.5), O('Nettoyage et démoussage de toiture', 'Entretien', 'm²', 18, 0.2), O('Pose de gouttières zinc', 'Zinguerie', 'm', 55, 0.6), O('Pose d’une fenêtre de toit', 'Fenêtres de toit', 'u', 650, 5),
  ],
  'Plâtrerie': [
    A('Plaque de plâtre BA13 (u)', 'Plaques', 'u', 7, 12), A('Rail et montant métallique (lot)', 'Ossature', 'u', 25, 45),
    O('Cloison en plaques de plâtre', 'Cloisons', 'm²', 45, 0.7), O('Doublage de mur isolé', 'Doublage', 'm²', 55, 0.8), O('Faux plafond en plaques de plâtre', 'Plafonds', 'm²', 50, 0.9), O('Bandes et enduit de finition', 'Finitions', 'm²', 12, 0.25),
  ],
  'Serrurerie': [
    A('Cylindre de serrure sécurité', 'Serrures', 'u', 45, 95), A('Serrure 3 points', 'Serrures', 'u', 180, 320),
    O('Ouverture de porte claquée', 'Dépannage', 'forfait', 120, 0.75), O('Remplacement de cylindre', 'Serrures', 'u', 140, 0.75), O('Pose d’une serrure 3 points', 'Serrures', 'u', 420, 2), O('Blindage de porte', 'Sécurité', 'forfait', 1200, 6),
  ],
  'Climatisation': [
    A('Climatiseur mural 2,5 kW (split)', 'Équipements', 'u', 650, 1100), A('Liaison frigorifique (m)', 'Fournitures', 'm', 12, 25),
    O('Pose d’un climatiseur mono-split', 'Installation', 'forfait', 750, 6), O('Mise en service et réglage', 'Installation', 'forfait', 150, 1.5), O('Entretien annuel climatisation', 'Entretien', 'forfait', 140, 1.5), O('Recharge en fluide frigorigène', 'Dépannage', 'forfait', 180, 1.5),
  ],
  'Vitrerie': [
    A('Double vitrage 4/16/4 (m²)', 'Vitrages', 'm²', 55, 110),
    O('Remplacement de vitre simple', 'Dépannage', 'm²', 160, 1), O('Remplacement de double vitrage', 'Vitrages', 'm²', 280, 1.5), O('Pose d’une paroi de douche en verre', 'Salle de bain', 'u', 450, 3), O('Pose de film de protection solaire', 'Films', 'm²', 45, 0.4),
  ],
  'Isolation': [
    A('Laine de verre 100 mm (m²)', 'Isolants', 'm²', 4, 8, 5.5),
    O('Isolation des combles perdus (soufflage)', 'Combles', 'm²', 28, 0.15, 5.5), O('Isolation des rampants sous toiture', 'Combles', 'm²', 65, 0.6, 5.5), O('Isolation des murs par l’intérieur', 'Murs', 'm²', 60, 0.7, 5.5), O('Isolation du plancher bas', 'Planchers', 'm²', 45, 0.4, 5.5), O('Isolation thermique par l’extérieur', 'Murs', 'm²', 150, 1.2, 5.5),
  ],
  'Cuisiniste': [
    A('Meuble bas 60 cm', 'Meubles', 'u', 120, 220), A('Plan de travail stratifié (m)', 'Plans de travail', 'm', 60, 120),
    O('Pose de cuisine équipée', 'Pose', 'm', 220, 3), O('Pose d’un plan de travail', 'Pose', 'm', 90, 1), O('Raccordement électroménager', 'Raccordements', 'u', 80, 1), O('Conception 3D de la cuisine', 'Étude', 'forfait', 150, 2),
  ],
  'Paysage': [
    A('Gazon en rouleau (m²)', 'Végétaux', 'm²', 4, 8), A('Terre végétale (m³)', 'Matériaux', 'u', 35, 60),
    O('Tonte de pelouse', 'Entretien', 'm²', 0.5, 0.01, 20), O('Taille de haie', 'Entretien', 'm', 6, 0.1, 20), O('Création de pelouse (semis)', 'Création', 'm²', 9, 0.1), O('Plantation d’arbuste', 'Plantations', 'u', 45, 0.5), O('Pose de bordures', 'Aménagement', 'm', 35, 0.4),
  ],
  'Piscine': [
    A('Liner 75/100e (m²)', 'Revêtements', 'm²', 25, 55), A('Pompe de filtration 1 CV', 'Équipements', 'u', 320, 520),
    O('Remplacement de liner', 'Rénovation', 'forfait', 3200, 16, 20), O('Mise en route de la piscine', 'Entretien', 'forfait', 180, 2, 20), O('Hivernage de la piscine', 'Entretien', 'forfait', 160, 2, 20), O('Entretien mensuel', 'Entretien', 'forfait', 120, 1.5, 20), O('Remplacement de pompe', 'Dépannage', 'forfait', 220, 2, 20),
  ],
  'Terrassement': [
    A('Gravier 0/31,5 (tonne)', 'Matériaux', 'u', 25, 45),
    O('Terrassement à la pelle mécanique', 'Terrassement', 'm³', 45, 0.2), O('Évacuation des terres', 'Évacuation', 'm³', 35, 0.1), O('Tranchée pour réseaux', 'Réseaux', 'm', 28, 0.3), O('Location mini-pelle avec chauffeur (journée)', 'Location', 'forfait', 550, 8), O('Création d’une allée gravillonnée', 'Aménagement', 'm²', 35, 0.3),
  ],
  'Élagage': [
    O('Élagage d’arbre (moins de 10 m)', 'Élagage', 'u', 350, 3, 20), O('Élagage d’arbre (plus de 10 m)', 'Élagage', 'u', 650, 6, 20), O('Abattage d’arbre', 'Abattage', 'u', 800, 6, 20), O('Dessouchage', 'Abattage', 'u', 250, 2, 20), O('Broyage et évacuation des déchets verts', 'Évacuation', 'm³', 45, 0.3, 20),
  ],
  'Clôture et portail': [
    A('Panneau rigide 2 m (u)', 'Clôtures', 'u', 30, 55), A('Portail aluminium battant 3,5 m', 'Portails', 'u', 1400, 2200),
    O('Pose de clôture panneaux rigides', 'Clôtures', 'm', 45, 0.4), O('Pose de portail battant', 'Portails', 'u', 650, 6), O('Motorisation de portail', 'Automatismes', 'forfait', 850, 4), O('Pose de grillage simple torsion', 'Clôtures', 'm', 18, 0.2),
  ],
  'Mécanique et carrosserie': [
    A('Plaquettes de frein (jeu)', 'Freinage', 'u', 30, 60, 20), A('Huile moteur 5 L', 'Entretien', 'u', 35, 65, 20),
    O('Vidange et filtre à huile', 'Entretien', 'forfait', 90, 0.8, 20), O('Remplacement des plaquettes avant', 'Freinage', 'forfait', 110, 1, 20), O('Diagnostic électronique', 'Diagnostic', 'forfait', 60, 0.5, 20), O('Débosselage sans peinture', 'Carrosserie', 'u', 120, 1.5, 20), O('Peinture d’un élément de carrosserie', 'Carrosserie', 'u', 280, 3, 20),
  ],
  'Dépannage auto': [
    O('Remorquage (jusqu’à 25 km)', 'Remorquage', 'forfait', 150, 1, 20), O('Kilomètre supplémentaire', 'Remorquage', 'u', 2.5, 0, 20), O('Dépannage sur place (batterie, roue)', 'Dépannage', 'forfait', 90, 0.75, 20), O('Majoration nuit et week-end', 'Frais', 'forfait', 60, 0, 20), O('Gardiennage (par jour)', 'Frais', 'u', 15, 0, 20),
  ],
  'Nettoyage': [
    A('Produits d’entretien (lot)', 'Fournitures', 'u', 15, 30, 20),
    O('Ménage régulier', 'Entretien courant', 'h', 30, 1, 20), O('Nettoyage de fin de chantier', 'Chantier', 'm²', 4, 0.05, 20), O('Lavage de vitres', 'Vitres', 'm²', 5, 0.05, 20), O('Nettoyage de bureaux', 'Professionnels', 'm²', 1.5, 0.02, 20), O('Remise en état après déménagement', 'Remise en état', 'forfait', 280, 8, 20),
  ],
  'Déménagement': [
    A('Cartons (lot de 20)', 'Fournitures', 'u', 20, 40, 20),
    O('Déménagement (camion 20 m³ + 2 déménageurs)', 'Déménagement', 'forfait', 900, 16, 20), O('Déménageur supplémentaire', 'Main-d’œuvre', 'h', 35, 1, 20), O('Monte-meubles', 'Matériel', 'forfait', 250, 2, 20), O('Démontage et remontage de meubles', 'Main-d’œuvre', 'h', 40, 1, 20), O('Garde-meubles (par mois)', 'Stockage', 'u', 120, 0, 20),
  ],
  'Informatique': [
    O('Intervention à domicile (1re heure)', 'Dépannage', 'forfait', 60, 1, 20), O('Heure supplémentaire', 'Dépannage', 'h', 45, 1, 20), O('Installation et configuration d’un ordinateur', 'Installation', 'forfait', 90, 1.5, 20), O('Suppression de virus', 'Sécurité', 'forfait', 80, 1.5, 20), O('Installation box et Wi-Fi', 'Réseau', 'forfait', 70, 1, 20), O('Récupération de données', 'Données', 'forfait', 120, 2, 20),
  ],
  'Électroménager': [
    O('Diagnostic à domicile', 'Diagnostic', 'forfait', 60, 0.75, 20), O('Réparation lave-linge', 'Lavage', 'forfait', 110, 1.5, 20), O('Réparation lave-vaisselle', 'Lavage', 'forfait', 110, 1.5, 20), O('Réparation réfrigérateur', 'Froid', 'forfait', 130, 1.5, 20), O('Remplacement de résistance de four', 'Cuisson', 'forfait', 90, 1, 20),
  ],
  'Ramonage': [
    O('Ramonage de conduit de cheminée', 'Ramonage', 'forfait', 70, 1), O('Ramonage de poêle à granulés', 'Ramonage', 'forfait', 90, 1.25), O('Débistrage de conduit', 'Entretien', 'forfait', 250, 3), O('Inspection caméra du conduit', 'Diagnostic', 'forfait', 150, 1), O('Certificat de ramonage', 'Administratif', 'u', 0, 0),
  ],
  'Multiservice': [
    O('Heure de main-d’œuvre', 'Main-d’œuvre', 'h', 45, 1), O('Déplacement', 'Frais', 'forfait', 35, 0.5), O('Petits travaux (demi-journée)', 'Main-d’œuvre', 'forfait', 180, 4),
  ],
};
export const starterFor = (trades = []) => {
  const keys = trades.filter((x) => STARTER[x]);
  return (keys.length ? keys : ['Multiservice']).flatMap((k) => STARTER[k].map((i) => ({ ...i, trades: [k] }))).concat(keys.includes('Multiservice') ? [] : STARTER.Multiservice.map((i) => ({ ...i, trades: ['Multiservice'] })));
};
// Catalogue d'un seul métier (pour parcourir les bibliothèques des autres métiers)
export const starterOf = (trade) => (STARTER[trade] || []).map((i) => ({ ...i, trades: [trade] }));
