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
  'Multiservice': [
    O('Heure de main-d’œuvre', 'Main-d’œuvre', 'h', 45, 1), O('Déplacement', 'Frais', 'forfait', 35, 0.5), O('Petits travaux (demi-journée)', 'Main-d’œuvre', 'forfait', 180, 4),
  ],
};
export const starterFor = (trades = []) => {
  const keys = trades.filter((x) => STARTER[x]);
  return (keys.length ? keys : ['Multiservice']).flatMap((k) => STARTER[k].map((i) => ({ ...i, trades: [k] }))).concat(keys.includes('Multiservice') ? [] : STARTER.Multiservice.map((i) => ({ ...i, trades: ['Multiservice'] })));
};
