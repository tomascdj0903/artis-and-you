// Textes de loi cités dans l'aide, les pages légales et les écrans (bulle « En clair » + lien officiel).
// Liens vérifiés sur Légifrance / EUR-Lex / CNIL le 17/11/2026. Résumés simplifiés : ils ne remplacent pas le texte.
export const LAWS_CHECKED = '17/11/2026';

const LF = (id) => `https://www.legifrance.gouv.fr/codes/article_lc/${id}`;
const LODA = (id) => `https://www.legifrance.gouv.fr/loda/article_lc/${id}`;
const JORF = (id) => `https://www.legifrance.gouv.fr/jorf/id/${id}`;
const TXT = (id) => `https://www.legifrance.gouv.fr/loda/id/${id}`;
const JURI = (id) => `https://www.legifrance.gouv.fr/juri/id/${id}`;
const CNIL = (ch, n) => `https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre${ch}#Article${n}`;
const DSA = (n) => `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32022R2065#art_${n}`;
const P2B = (n) => `https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32019R1150#art_${n}`;
const CONSO = 'Code de la consommation', CIV = 'Code civil', COM = 'Code de commerce', CGI = 'Code général des impôts';

// [id, référence courte, code ou texte, titre, résumé en clair, url, note éventuelle]
const RAW = [
  // ── Information du client, devis ──
  ['conso-L111-1', 'Art. L111-1', CONSO, 'Information avant tout contrat', 'Avant que le client s’engage, le pro doit lui donner de façon claire : ce qu’il vend (caractéristiques essentielles), le prix, le délai d’exécution, son identité et ses coordonnées, les garanties légales et la possibilité de recourir à un médiateur.', LF('LEGIARTI000044142438')],
  ['conso-L111-2', 'Art. L111-2', CONSO, 'Informations complémentaires pour les services', 'Pour une prestation de services, le pro communique aussi ses coordonnées complètes, son activité, son assurance et les autres conditions du contrat.', LF('LEGIARTI000032227350')],
  ['conso-R111-1', 'Art. R111-1', CONSO, 'Détail des informations obligatoires', 'Liste ce que le pro doit indiquer : identité, adresse, téléphone, e-mail, modalités de paiement, d’exécution et de traitement des réclamations.', LF('LEGIARTI000045987238')],
  ['conso-R111-2', 'Art. R111-2', CONSO, 'Statut et forme juridique', 'Pour un service, le pro indique aussi son statut, sa forme juridique, son numéro d’immatriculation et son assurance professionnelle.', LF('LEGIARTI000046074299')],
  ['conso-L112-1', 'Art. L112-1', CONSO, 'Information sur les prix', 'Le prix et les conditions de la prestation doivent être portés à la connaissance du client avant la vente.', LF('LEGIARTI000032227331')],
  ['arrete-2017-01-24', 'Arrêté du 24 janvier 2017', 'Publicité des prix — dépannage et travaux du bâtiment', 'Devis pour dépannage, réparation, entretien', 'Pour un dépannage ou des travaux à domicile, le pro affiche ses taux horaires et frais de déplacement et remet un devis détaillé avant les travaux (obligatoire au-delà de 150 € TTC ou à la demande du client).', TXT('JORFTEXT000033935513')],
  ['env-D541-45-1', 'Art. D541-45-1', 'Code de l’environnement', 'Déchets de chantier sur le devis', 'Le devis de travaux du bâtiment indique la quantité estimée de déchets, les modalités de tri et d’enlèvement, les points de collecte et le coût de leur gestion.', LF('LEGIARTI000042879507')],
  ['artisanat-L132-1', 'Art. L132-1', 'Code de l’artisanat', 'Assurance sur les devis et factures', 'Les artisans indiquent sur leurs devis et factures l’assurance professionnelle obligatoire souscrite, les coordonnées de l’assureur et la couverture géographique.', LF('LEGIARTI000047362294')],
  ['conso-L216-1', 'Art. L216-1', CONSO, 'Délai d’exécution', 'Le pro réalise la prestation à la date ou dans le délai annoncé ; sans date, au plus tard 30 jours après le contrat.', LF('LEGIARTI000044142498')],
  ['conso-L212-1', 'Art. L212-1', CONSO, 'Clauses abusives', 'Une clause qui crée un déséquilibre important au détriment du particulier est réputée non écrite.', LF('LEGIARTI000032890812')],
  ['conso-L121-1', 'Art. L121-1', CONSO, 'Pratiques commerciales déloyales', 'Interdiction des pratiques trompeuses ou agressives qui faussent le choix du consommateur.', LF('LEGIARTI000032227301')],
  ['conso-L121-8', 'Art. L121-8', CONSO, 'Abus de faiblesse', 'Interdit de profiter de la faiblesse ou de l’ignorance d’une personne (ex. personne âgée démarchée chez elle) pour lui faire signer un engagement.', LF('LEGIARTI000032227278')],
  ['conso-L131-1', 'Art. L131-1', CONSO, 'Sanctions du défaut d’information', 'Ne pas donner les informations obligatoires expose à une amende administrative jusqu’à 3 000 € (personne physique) ou 15 000 € (société).', LF('LEGIARTI000044563118')],

  // ── Rétractation, contrats à distance et hors établissement ──
  ['conso-L221-1', 'Art. L221-1', CONSO, 'Contrat à distance et hors établissement', 'Définit le contrat conclu à distance (sans présence physique simultanée, ex. signé en ligne) et le contrat hors établissement (signé chez le client, ou juste après l’y avoir sollicité).', LF('LEGIARTI000044563164')],
  ['conso-L221-5', 'Art. L221-5', CONSO, 'Information avant un contrat à distance ou hors établissement', 'En plus des informations habituelles, le pro informe sur le droit de rétractation (délai, modalités, formulaire type) ou sur son absence.', LF('LEGIARTI000053310511')],
  ['conso-R221-1', 'Art. R221-1', CONSO, 'Formulaire type de rétractation', 'Le formulaire de rétractation à remettre au client est celui reproduit en annexe du Code de la consommation.', LF('LEGIARTI000045418603')],
  ['conso-L221-10', 'Art. L221-10', CONSO, 'Pas de paiement pendant 7 jours (hors établissement)', 'Pour un contrat signé chez le client, le pro ne peut recevoir aucun paiement ni acompte avant 7 jours, sauf exceptions (ex. réparation urgente demandée).', LF('LEGIARTI000032226864')],
  ['conso-L221-18', 'Art. L221-18', CONSO, 'Délai de rétractation de 14 jours', 'Le particulier a 14 jours pour changer d’avis sur un contrat conclu à distance ou chez lui, sans motif et sans frais. Pour un service, le délai court à partir de la signature.', LF('LEGIARTI000032226842')],
  ['conso-L221-20', 'Art. L221-20', CONSO, 'Délai prolongé sans information', 'Si le client n’a pas été informé de son droit de rétractation, le délai est prolongé de 12 mois.', LF('LEGIARTI000044563199')],
  ['conso-L221-21', 'Art. L221-21', CONSO, 'Comment se rétracter (bouton en ligne)', 'Le client se rétracte avec le formulaire ou toute déclaration claire. Pour un contrat conclu via une interface en ligne, une fonction gratuite « se rétracter » doit être proposée, avec accusé de réception (depuis le 19 juin 2026).', LF('LEGIARTI000053310520'), 'Fonction de rétractation en ligne introduite par l’ordonnance n° 2026-2 du 5 janvier 2026.'],
  ['conso-L221-24', 'Art. L221-24', CONSO, 'Remboursement sous 14 jours', 'Après une rétractation, le pro rembourse toutes les sommes versées au plus tard 14 jours après en avoir été informé.', LF('LEGIARTI000032226828')],
  ['conso-L221-25', 'Art. L221-25', CONSO, 'Commencer avant la fin du délai', 'Les travaux ne commencent avant la fin des 14 jours que si le client le demande expressément. S’il se rétracte ensuite, il paie la part déjà réalisée.', LF('LEGIARTI000044563179')],
  ['conso-L221-28', 'Art. L221-28', CONSO, 'Cas sans rétractation', 'Pas de rétractation notamment pour un service entièrement exécuté avec l’accord du client, un bien fait sur mesure, ou des travaux urgents d’entretien ou de réparation demandés par le client à son domicile.', LF('LEGIARTI000044563170')],
  ['ord-2026-2', 'Ordonnance n° 2026-2', 'du 5 janvier 2026', 'Bouton de rétractation en ligne', 'Crée l’obligation d’une fonction de rétractation en ligne, visible et gratuite, pour les contrats conclus via un site ou une application (applicable depuis le 19 juin 2026).', JORF('JORFTEXT000053298845')],
  ['decret-2026-3', 'Décret n° 2026-3', 'du 5 janvier 2026', 'Accusé de réception de la rétractation', 'Précise la mise en œuvre de la fonction de rétractation en ligne, notamment l’accusé de réception sur un support durable.', JORF('JORFTEXT000053298978')],
  ['cjue-mobelkraft', 'CJUE, 21 oct. 2020, C-529/19', 'Cour de justice de l’Union européenne', 'Biens « sur mesure »', 'L’exception à la rétractation pour les biens « sur mesure » ne vise que les biens vraiment personnalisés, pas un produit standard simplement configuré par le client.', 'https://curia.europa.eu/juris/liste.jsf?num=C-529/19'],
  ['conso-L224-59', 'Art. L224-59', CONSO, 'Foires et salons', 'Un contrat signé sur une foire ou un salon n’ouvre pas de délai de rétractation : le pro doit le dire avant la signature.', LF('LEGIARTI000032226591')],
  ['conso-L224-60', 'Art. L224-60', CONSO, 'Encadré « pas de rétractation »', 'Les offres en foire ou salon mentionnent l’absence de rétractation dans un encadré apparent.', LF('LEGIARTI000032226589')],

  // ── Acompte, arrhes, paiement ──
  ['conso-L214-1', 'Art. L214-1', CONSO, 'Arrhes ou acompte ?', 'Sauf mention contraire, une somme versée d’avance est des arrhes : le client peut renoncer en les perdant, le pro en rendant le double. Écrire « acompte » engage définitivement les deux parties.', LF('LEGIARTI000032226990')],
  ['cmf-L112-6', 'Art. L112-6', 'Code monétaire et financier', 'Plafond des paiements en espèces', 'Les paiements en espèces sont plafonnés (1 000 € pour un particulier résidant en France, montant fixé par décret).', LF('LEGIARTI000051752373')],
  ['cmf-D112-3', 'Art. D112-3', 'Code monétaire et financier', 'Montant du plafond espèces', 'Fixe le plafond de paiement en espèces (1 000 € pour un débiteur domicilié en France).', LF('LEGIARTI000036824549')],
  ['conso-L312-1', 'Art. L312-1', CONSO, 'Crédit à la consommation', 'Les règles du crédit à la consommation s’appliquent aux crédits de 200 € à 75 000 €, y compris le paiement échelonné proposé par un pro.', LF('LEGIARTI000034072779')],
  ['loi-71-584', 'Loi n° 71-584 du 16 juillet 1971', 'Retenue de garantie', 'Retenue de garantie de 5 %', 'Le client peut retenir au maximum 5 % du prix pendant un an pour garantir la levée des réserves, sauf si le pro fournit une caution bancaire.', TXT('JORFTEXT000000687670')],
  ['loi-75-1334', 'Loi n° 75-1334 du 31 décembre 1975', 'Sous-traitance', 'Sous-traitance', 'Le sous-traitant doit être accepté par le client et ses conditions de paiement agréées ; il dispose d’une action directe en paiement.', TXT('JORFTEXT000000889241')],

  // ── Factures ──
  ['com-L441-9', 'Art. L441-9', COM, 'Facture entre professionnels', 'Toute prestation entre pros doit être facturée avec les mentions obligatoires (date de paiement, pénalités, indemnité de 40 €…).', LF('LEGIARTI000038414397')],
  ['com-L441-10', 'Art. L441-10', COM, 'Délais de paiement et pénalités', 'Entre pros : paiement à 30 jours par défaut, 60 jours maximum. En cas de retard : pénalités (taux BCE + 10 points) et indemnité forfaitaire de 40 € de frais de recouvrement.', LF('LEGIARTI000038414392')],
  ['com-D441-5', 'Art. D441-5', COM, 'Indemnité de 40 €', 'Fixe à 40 € l’indemnité forfaitaire pour frais de recouvrement due par un client professionnel en retard.', LF('LEGIARTI000043197457')],
  ['com-L441-1', 'Art. L441-1', COM, 'Conditions générales de vente', 'Les CGV entre pros comprennent les conditions de règlement et les éléments du prix ; elles sont le socle de la négociation commerciale.', LF('LEGIARTI000038414469')],
  ['com-L123-22', 'Art. L123-22', COM, 'Conservation 10 ans', 'Les documents comptables et pièces justificatives (dont les factures) sont conservés 10 ans.', LF('LEGIARTI000006219327')],
  ['lpf-L102B', 'Art. L102 B', 'Livre des procédures fiscales', 'Conservation fiscale 6 ans', 'Les documents contrôlables par le fisc sont conservés 6 ans, sous leur forme d’origine (électronique pour une facture électronique).', LF('LEGIARTI000041471233')],
  ['cgi-289', 'Art. 289', CGI, 'Obligation de facturer', 'Fixe qui doit émettre une facture, quand, et les règles de contenu et de transmission, dont la facturation électronique.', LF('LEGIARTI000051214809')],
  ['cgi-289bis', 'Art. 289 bis', CGI, 'Facture électronique', 'Règles de la facturation électronique entre entreprises et de la transmission des données à l’administration.', LF('LEGIARTI000051214831')],
  ['cgi-242nonies', 'Art. 242 nonies A, annexe II', CGI, 'Mentions obligatoires de la facture', 'Liste les mentions de la facture : dates, numéro unique et continu, identité des parties, désignation, quantités, prix HT, taux et montant de TVA, mention d’exonération…', LF('LEGIARTI000050811276')],
  ['cgi-1737', 'Art. 1737', CGI, 'Amendes de facturation', 'Prévoit les amendes en cas de facture absente, fausse ou incomplète.', LF('LEGIARTI000051215468')],
  ['cgi-293B', 'Art. 293 B', CGI, 'Franchise en base de TVA', 'Sous certains plafonds de chiffre d’affaires, l’entreprise ne facture pas de TVA. Mention : « TVA non applicable, art. 293 B du CGI » jusqu’au 31/12/2026.', LF('LEGIARTI000048826700')],
  ['cibs-L233-3', 'Art. L233-3', 'Code des impositions sur les biens et services', 'Franchise en base (à partir de 2027)', 'À partir du 1er janvier 2027, la franchise en base est codifiée ici. Mention : « TVA non applicable, art. L. 233-3 du CIBS ». Artesa change la mention automatiquement selon la date de la facture.', LF('LEGIARTI000054524584'), 'Créé par l’ordonnance n° 2026-671 du 27 juillet 2026, qui a reporté la recodification au 1er janvier 2027.'],
  ['cgi-279-0bis', 'Art. 279-0 bis', CGI, 'TVA à 10 % dans les logements', 'Taux de 10 % pour les travaux d’amélioration, d’aménagement et d’entretien de logements achevés depuis plus de 2 ans.', LF('LEGIARTI000051215062')],
  ['cgi-278-0bisA', 'Art. 278-0 bis A', CGI, 'TVA à 5,5 % rénovation énergétique', 'Taux de 5,5 % pour certains travaux de rénovation énergétique dans les logements de plus de 2 ans.', LF('LEGIARTI000053545596')],
  ['bofip-attestation', 'BOI-TVA-LIQ-30-20-90-30', 'BOFiP', 'Taux réduits et attestation', 'Doctrine fiscale sur les taux réduits dans les logements : conditions, exclusions et justificatifs à conserver.', 'https://bofip.impots.gouv.fr/doctrine/BOI-TVA-LIQ-30-20-90-30'],
  ['cgi-283-2nonies', 'Art. 283, 2 nonies', CGI, 'Autoliquidation en sous-traitance BTP', 'Le sous-traitant du bâtiment facture HT : c’est l’entreprise principale qui déclare la TVA (mention « Autoliquidation »).', LF('LEGIARTI000051214570')],

  // ── Impayés ──
  ['civ-1231-6', 'Art. 1231-6', CIV, 'Intérêts de retard', 'Un retard de paiement donne droit aux intérêts au taux légal à partir de la mise en demeure.', LF('LEGIARTI000036762122')],
  ['civ-1344', 'Art. 1344', CIV, 'Mise en demeure', 'Le débiteur est mis en demeure par une lettre suffisamment claire (ou automatiquement si le contrat le prévoit).', LF('LEGIARTI000036762144')],
  ['civ-1219', 'Art. 1219', CIV, 'Exception d’inexécution', 'Une partie peut suspendre ses travaux si l’autre ne paie pas, à condition que ce manquement soit suffisamment grave.', LF('LEGIARTI000036762108')],
  ['civ-2224', 'Art. 2224', CIV, 'Prescription de 5 ans', 'Délai de droit commun pour agir : 5 ans à partir du moment où l’on connaît les faits.', LF('LEGIARTI000019017112')],
  ['conso-L218-2', 'Art. L218-2', CONSO, 'Prescription de 2 ans contre un particulier', 'Le pro n’a que 2 ans pour réclamer en justice le paiement à un particulier.', LF('LEGIARTI000032226897')],
  ['cass1-2021-05-19', 'Cass. 1re civ., 19 mai 2021', 'n° 20-12.520', 'Point de départ des 2 ans', 'Le délai de 2 ans court dès la fin des travaux, pas à partir de la facture.', JURI('JURITEXT000043565928')],
  ['civ-2240', 'Art. 2240', CIV, 'Reconnaissance de dette', 'Si le client reconnaît sa dette (écrit, paiement partiel), le délai de prescription repart à zéro.', LF('LEGIARTI000019017366')],
  ['civ-2241', 'Art. 2241', CIV, 'Action en justice', 'Une demande en justice, même en référé, interrompt la prescription.', LF('LEGIARTI000019017098')],
  ['conso-L121-21', 'Art. L121-21', CONSO, 'Frais de recouvrement interdits', 'Il est interdit de facturer des frais de recouvrement à un particulier en dehors des cas prévus par la loi.', LF('LEGIARTI000032227234')],
  ['cpc-750-1', 'Art. 750-1', 'Code de procédure civile', 'Tentative de règlement amiable', 'Pour un litige jusqu’à 5 000 €, il faut d’abord tenter une conciliation, une médiation ou une procédure participative avant le tribunal.', LF('LEGIARTI000047539064')],
  ['cpc-1405', 'Art. 1405', 'Code de procédure civile', 'Injonction de payer', 'Procédure simple pour obtenir un titre exécutoire contre un client qui ne paie pas une créance contractuelle d’un montant déterminé.', LF('LEGIARTI000006412552')],
  ['cpce-L125-1', 'Art. L125-1', 'Code des procédures civiles d’exécution', 'Petites créances', 'Procédure simplifiée de recouvrement des petites créances (jusqu’à 5 000 €) par un commissaire de justice, si le débiteur l’accepte.', LF('LEGIARTI000033542260')],
  ['loi-2026-307', 'Loi n° 2026-307 du 23 avril 2026', 'Créances commerciales incontestées', 'Recouvrement des créances entre pros', 'Crée une procédure simplifiée, menée par un commissaire de justice, pour recouvrer les créances commerciales non contestées.', JORF('JORFTEXT000053934457')],
  ['civ-2367', 'Art. 2367', CIV, 'Clause de réserve de propriété', 'Le pro reste propriétaire des fournitures jusqu’au paiement complet, si le contrat le prévoit.', LF('LEGIARTI000020192952')],
  ['civ-2286', 'Art. 2286', CIV, 'Droit de rétention', 'Celui qui détient un bien (ex. un appareil réparé) peut le garder jusqu’au paiement de ce qui est dû pour ce bien.', LF('LEGIARTI000019293165')],
  ['penal-433-13', 'Art. 433-13', 'Code pénal', 'Fausse « officialité »', 'Interdit de se faire passer pour une autorité ou une profession réglementée (ex. courrier de relance imitant un huissier ou un tribunal).', LF('LEGIARTI000006418574')],

  // ── Signature électronique ──
  ['civ-1366', 'Art. 1366', CIV, 'Valeur de l’écrit électronique', 'Un document électronique vaut un écrit papier si l’on peut identifier son auteur et garantir qu’il n’a pas été modifié.', LF('LEGIARTI000032042456')],
  ['civ-1367', 'Art. 1367', CIV, 'Signature électronique', 'La signature électronique doit identifier le signataire et prouver son accord grâce à un procédé fiable.', LF('LEGIARTI000032042457')],
  ['eidas', 'Règlement (UE) n° 910/2014', 'eIDAS', 'Signature électronique en Europe', 'Cadre européen de l’identification électronique et des signatures (simple, avancée, qualifiée).', 'https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32014R0910'],
  ['cpce-L100', 'Art. L100', 'Code des postes et des communications électroniques', 'Lettre recommandée électronique', 'L’envoi recommandé électronique vaut lettre recommandée ; pour un particulier, il doit l’avoir accepté.', LF('LEGIARTI000033207397')],

  // ── Garanties et assurances ──
  ['civ-1792', 'Art. 1792', CIV, 'Garantie décennale', 'Le constructeur répond pendant 10 ans des dommages qui compromettent la solidité de l’ouvrage ou le rendent impropre à sa destination.', LF('LEGIARTI000006443502')],
  ['civ-1792-2', 'Art. 1792-2', CIV, 'Équipements indissociables', 'La décennale couvre aussi les équipements qu’on ne peut retirer sans abîmer l’ouvrage.', LF('LEGIARTI000006443524')],
  ['civ-1792-3', 'Art. 1792-3', CIV, 'Garantie biennale', 'Les autres équipements sont garantis au moins 2 ans après la réception.', LF('LEGIARTI000006443534')],
  ['cass3-2024-03-21', 'Cass. 3e civ., 21 mars 2024', 'n° 22-18.694', 'Équipement ajouté à l’existant', 'Un équipement ajouté à une construction existante (ex. pompe à chaleur, insert) ne relève plus de la décennale s’il n’est pas lui-même un ouvrage : c’est la responsabilité contractuelle classique.', JURI('JURITEXT000049321620')],
  ['cass3-2025-07-10', 'Cass. 3e civ., 10 juillet 2025', 'n° 23-22.242', 'Pompe à chaleur', 'Confirme : une pompe à chaleur posée sur un existant avec de petits travaux n’est pas un ouvrage, donc pas de décennale.', JURI('JURITEXT000051931882')],
  ['assur-L241-1', 'Art. L241-1', 'Code des assurances', 'Assurance décennale obligatoire', 'Toute entreprise dont la décennale peut être engagée doit être assurée avant l’ouverture du chantier.', LF('LEGIARTI000031010281')],
  ['assur-L243-2', 'Art. L243-2', 'Code des assurances', 'Justifier de son assurance', 'Le pro doit pouvoir prouver son assurance décennale et joindre l’attestation à ses devis et factures.', LF('LEGIARTI000031010272')],
  ['conso-L217-3', 'Art. L217-3', CONSO, 'Garantie légale de conformité', 'Le vendeur répond des défauts de conformité d’un bien pendant 2 ans après la livraison.', LF('LEGIARTI000044142579')],
  ['civ-1641', 'Art. 1641', CIV, 'Vices cachés', 'Le vendeur garantit les défauts cachés qui rendent la chose impropre à l’usage.', LF('LEGIARTI000006441924')],
  ['loi-96-603-16', 'Loi n° 96-603, art. 16', 'Qualification professionnelle', 'Métiers réservés aux qualifiés', 'Construction, entretien et réparation des bâtiments, électricité, plomberie… doivent être exercés par une personne qualifiée ou sous son contrôle.', LODA('LEGIARTI000045178291')],

  // ── Médiation ──
  ['conso-L612-1', 'Art. L612-1', CONSO, 'Droit à un médiateur gratuit', 'Tout consommateur peut recourir gratuitement à un médiateur de la consommation ; le pro doit adhérer à un médiateur.', LF('LEGIARTI000032224805')],
  ['conso-L616-1', 'Art. L616-1', CONSO, 'Afficher son médiateur', 'Le pro communique les coordonnées de son médiateur (site, CGV, devis, factures).', LF('LEGIARTI000032224762')],

  // ── Plateforme en ligne (Artesa) ──
  ['conso-L111-7', 'Art. L111-7', CONSO, 'Obligations des plateformes', 'La plateforme qui met en relation pros et particuliers informe clairement sur ses conditions, ses critères de classement et de référencement, toute rémunération qui influence le classement, et la qualité de professionnel des offreurs.', LF('LEGIARTI000049571125')],
  ['conso-D111-7', 'Art. D111-7', CONSO, 'Critères de classement visibles', 'La plateforme indique sur chaque page de résultats le critère de classement utilisé et renvoie vers une rubrique qui l’explique.', LF('LEGIARTI000035733561')],
  ['conso-D111-8', 'Art. D111-8', CONSO, 'Mise en relation avec des pros', 'La plateforme décrit son service, précise si l’offreur est un professionnel, les droits du consommateur et le mode de règlement des litiges.', LF('LEGIARTI000049914996')],
  ['conso-L111-7-2', 'Art. L111-7-2', CONSO, 'Avis en ligne', 'Celui qui publie des avis dit s’ils sont contrôlés et comment, affiche leur date, explique à l’auteur pourquoi un avis est refusé et permet au pro de signaler un avis douteux.', LF('LEGIARTI000049571119')],
  ['conso-D111-17', 'Art. D111-17', CONSO, 'Détail de l’information sur les avis', 'Près des avis : existence d’un contrôle, date de l’avis et de l’expérience, critères de classement ; dans une rubrique : procédure de contrôle, durée de conservation, possibilité de contester.', LF('LEGIARTI000035724934'), 'Version consultée : celle en vigueur depuis 2018 ; à revérifier si le texte a été renuméroté.'],
  ['dsa-11', 'Art. 11', 'Règlement (UE) 2022/2065 (DSA)', 'Point de contact des autorités', 'Le service désigne un point de contact unique pour les autorités.', DSA(11)],
  ['dsa-12', 'Art. 12', 'Règlement (UE) 2022/2065 (DSA)', 'Point de contact des utilisateurs', 'Le service désigne un point de contact pour les utilisateurs, joignable rapidement et pas seulement par un robot.', DSA(12)],
  ['dsa-14', 'Art. 14', 'Règlement (UE) 2022/2065 (DSA)', 'Conditions générales et modération', 'Les CGU expliquent les règles de modération, les outils utilisés et la procédure de réclamation.', DSA(14)],
  ['dsa-16', 'Art. 16', 'Règlement (UE) 2022/2065 (DSA)', 'Signaler un contenu illicite', 'Toute personne peut signaler un contenu illicite par voie électronique ; le service accuse réception et informe de sa décision.', DSA(16)],
  ['dsa-17', 'Art. 17', 'Règlement (UE) 2022/2065 (DSA)', 'Décision motivée', 'Quand un contenu est retiré ou un compte restreint, l’utilisateur reçoit une explication : faits, règle appliquée, voies de recours.', DSA(17)],
  ['dsa-20', 'Art. 20', 'Règlement (UE) 2022/2065 (DSA)', 'Réclamation interne', 'Les décisions de modération peuvent être contestées gratuitement pendant 6 mois (obligation des plateformes ; les très petites entreprises en sont dispensées, Artesa l’applique quand même).', DSA(20)],
  ['p2b-3', 'Art. 3', 'Règlement (UE) 2019/1150 (P2B)', 'Conditions pour les pros', 'Les conditions imposées aux professionnels sont claires, et toute modification leur est notifiée au moins 15 jours à l’avance.', P2B(3)],
  ['p2b-4', 'Art. 4', 'Règlement (UE) 2019/1150 (P2B)', 'Suspension d’un pro', 'Suspendre ou restreindre un pro se fait avec un exposé des motifs ; résilier définitivement exige un préavis de 30 jours, sauf cas graves.', P2B(4)],
  ['p2b-5', 'Art. 5', 'Règlement (UE) 2019/1150 (P2B)', 'Paramètres de classement', 'La plateforme explique aux pros les principaux paramètres de classement et l’effet d’une éventuelle rémunération.', P2B(5)],
  ['p2b-11', 'Art. 11', 'Règlement (UE) 2019/1150 (P2B)', 'Plaintes des pros', 'Un système interne gratuit de traitement des plaintes des pros, avec réponse rapide (obligation dont les petites entreprises sont dispensées, Artesa l’applique).', P2B(11)],
  ['p2b-12', 'Art. 12', 'Règlement (UE) 2019/1150 (P2B)', 'Médiation pour les pros', 'Les conditions désignent des médiateurs pour les litiges avec les pros.', P2B(12)],
  ['lcen-1-1', 'Art. 1-1', 'Loi n° 2004-575 (LCEN)', 'Mentions légales d’un site', 'L’éditeur d’un site affiche son identité, ses coordonnées, son immatriculation, le directeur de la publication et l’hébergeur.', LODA('LEGIARTI000049568614')],
  ['lcen-6', 'Art. 6', 'Loi n° 2004-575 (LCEN)', 'Responsabilité de l’hébergeur', 'L’hébergeur n’est pas responsable des contenus de ses utilisateurs, sauf s’il ne les retire pas promptement après en avoir eu connaissance.', LODA('LEGIARTI000054744218')],

  // ── Données personnelles ──
  ['rgpd-5', 'Art. 5', 'RGPD', 'Minimisation et durée limitée', 'Seules les données nécessaires sont collectées (minimisation) et elles ne sont gardées que le temps utile (limitation de la conservation). C’est pourquoi la copie de votre pièce d’identité est supprimée dès la vérification faite.', CNIL(2, 5)],
  ['rgpd-25', 'Art. 25', 'RGPD', 'Protection dès la conception', 'Le service est conçu pour ne traiter que le strict nécessaire : la pièce d’identité est stockée à part, visible seulement par l’équipe de vérification, puis effacée automatiquement après le contrôle.', CNIL(4, 25)],
  ['cnil-identite', 'Référentiel « gestion des activités commerciales »', 'CNIL', 'Pièce d’identité : le temps de la vérification', 'La CNIL recommande de conserver une pièce d’identité seulement le temps nécessaire pour vérifier l’identité de la personne. Artesa garde uniquement le résultat : vérifiée, à quelle date et par qui.', 'https://www.cnil.fr/sites/cnil/files/atoms/files/referentiel_traitements-donnees-caractere-personnel_gestion-activites-commerciales.pdf'],
  ['rgpd-6', 'Art. 6', 'RGPD', 'Bases légales', 'Une donnée n’est traitée que sur une base légale : contrat, obligation légale, intérêt légitime, consentement…', CNIL(2, 6)],
  ['rgpd-13', 'Art. 13', 'RGPD', 'Information des personnes', 'Les personnes sont informées de qui traite leurs données, pourquoi, sur quelle base, pour combien de temps et de leurs droits.', CNIL(3, 13)],
  ['rgpd-15', 'Art. 15', 'RGPD', 'Droit d’accès', 'Chacun peut obtenir une copie de ses données.', CNIL(3, 15)],
  ['rgpd-17', 'Art. 17', 'RGPD', 'Droit à l’effacement', 'Chacun peut demander la suppression de ses données, sauf obligation légale de les garder (ex. factures).', CNIL(3, 17)],
  ['rgpd-20', 'Art. 20', 'RGPD', 'Portabilité', 'Chacun peut récupérer ses données dans un format réutilisable (export zip d’Artesa).', CNIL(3, 20)],
  ['rgpd-28', 'Art. 28', 'RGPD', 'Sous-traitant', 'Le prestataire qui traite des données pour le compte d’un autre signe un contrat qui fixe ses obligations (sécurité, confidentialité, sous-traitants, fin du contrat).', CNIL(4, 28)],
  ['rgpd-32', 'Art. 32', 'RGPD', 'Sécurité', 'Mesures techniques adaptées : chiffrement, contrôle des accès, sauvegardes, tests.', CNIL(4, 32)],
  ['rgpd-33', 'Art. 33', 'RGPD', 'Violation de données', 'Une fuite de données à risque est notifiée à la CNIL sous 72 heures.', CNIL(4, 33)],
  ['rgpd-46', 'Art. 46', 'RGPD', 'Transferts hors UE', 'Un transfert hors de l’Union européenne exige des garanties (clauses contractuelles types, cadre UE–États-Unis…).', CNIL(5, 46)],
  ['rgpd-77', 'Art. 77', 'RGPD', 'Réclamation à la CNIL', 'Chacun peut porter plainte auprès de la CNIL.', CNIL(8, 77)],
  ['ip-82', 'Art. 82', 'Loi n° 78-17 Informatique et libertés', 'Cookies et traceurs', 'Déposer un traceur exige le consentement, sauf s’il est strictement nécessaire au service demandé (connexion, préférences) : c’est le cas des seuls éléments utilisés par Artesa.', LODA('LEGIARTI000037813978')],

  // ── Voisinage, chantier ──
  ['civ-1253', 'Art. 1253', CIV, 'Troubles du voisinage', 'Celui qui cause un trouble anormal de voisinage (bruit, poussière de chantier) en répond, même sans faute.', LF('LEGIARTI000049312140')],
  ['civ-673', 'Art. 673', CIV, 'Branches et racines', 'On peut exiger que le voisin coupe ses branches qui dépassent ; les racines peuvent être coupées soi-même à la limite. Droit imprescriptible.', LF('LEGIARTI000006430148')],
  ['civ-671', 'Art. 671', CIV, 'Distance des plantations', 'Arbres de plus de 2 m : à 2 m de la limite ; autres plantations : à 50 cm, sauf usages ou règlements locaux.', LF('LEGIARTI000006430133')],
  ['urba-R421-17', 'Art. R421-17', 'Code de l’urbanisme', 'Déclaration préalable de travaux', 'Les travaux sur une construction existante qui modifient son aspect extérieur demandent une déclaration préalable en mairie.', LF('LEGIARTI000034355355')],
  ['urba-R421-14', 'Art. R421-14', 'Code de l’urbanisme', 'Permis de construire', 'Certains travaux sur l’existant (extension importante, changement de destination avec modification de façade…) nécessitent un permis.', LF('LEGIARTI000031764577')],
  ['env-R554-20', 'Art. R554-20', 'Code de l’environnement', 'DT-DICT avant travaux', 'Avant de creuser, on vérifie les réseaux enterrés (déclarations DT-DICT sur le guichet unique).', LF('LEGIARTI000036017437')],
  ['travail-L4412-2', 'Art. L4412-2', 'Code du travail', 'Repérage amiante avant travaux', 'Le donneur d’ordre fait réaliser un repérage de l’amiante avant les travaux dans les bâtiments concernés.', LF('LEGIARTI000033013763')],
  ['travail-D7233-5', 'Art. D7233-5', 'Code du travail', 'Petit bricolage (services à la personne)', 'Le petit bricolage « hommes toutes mains » ouvre droit au crédit d’impôt dans la limite de 2 heures par intervention.', LF('LEGIARTI000033747497')],
  ['cgi-199sexdecies', 'Art. 199 sexdecies', CGI, 'Crédit d’impôt services à la personne', 'Crédit d’impôt de 50 % pour certains services à domicile, dans des plafonds.', LF('LEGIARTI000054251333')],
];

const ABBR = [[/^Code de la consommation$/, 'C. conso'], [/^Code civil$/, 'C. civ.'], [/^Code de commerce$/, 'C. com.'], [/^Code général des impôts$/, 'CGI'], [/^Code des impositions.*/, 'CIBS'], [/^Code monétaire.*/, 'CMF'], [/^Code des assurances$/, 'C. assur.'], [/^Code de procédure civile$/, 'CPC'], [/^Code des procédures civiles.*/, 'CPCE'], [/^Code des postes.*/, 'CPCE (postes)'], [/^Code de l’environnement$/, 'C. env.'], [/^Code de l’urbanisme$/, 'C. urb.'], [/^Code du travail$/, 'C. trav.'], [/^Code de l’artisanat$/, 'C. artisanat'], [/^Code pénal$/, 'C. pén.'], [/^Livre des procédures fiscales$/, 'LPF'], [/.*\(DSA\)$/, 'DSA'], [/.*\(P2B\)$/, 'P2B'], [/.*\(LCEN\)$/, 'LCEN'], [/^RGPD$/, 'RGPD'], [/^CNIL$/, 'CNIL'], [/^Loi n° 78-17.*/, 'loi Informatique et libertés']];
const abbr = (code) => { for (const [r, a] of ABBR) if (r.test(code)) return a; return ''; };
export const LAWS = Object.fromEntries(RAW.map(([id, ref, code, title, resume, url, note]) => { const a = abbr(code); return [id, { id, ref: a ? `${ref} ${a}` : ref, short: ref, code, title, resume, url, note }]; }));
export const LAW_IDS = RAW.map((r) => r[0]);
