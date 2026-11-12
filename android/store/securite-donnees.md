# Questionnaire « Sécurité des données » (Play Console)

Réponses à déclarer, d'après ce que l'application fait réellement (voir `supabase/migrations/` et `SECURITY_AUDIT.md`).

| Question | Réponse |
|---|---|
| L'application collecte-t-elle ou partage-t-elle des données utilisateur ? | Oui, collecte. Aucun partage avec des tiers à des fins publicitaires. |
| Données chiffrées en transit ? | Oui (HTTPS/TLS). |
| L'utilisateur peut-il demander la suppression ? | Oui, dans l'application : Paramètres › Supprimer mon compte. |

## Types de données collectées

| Type | Collecté | Obligatoire | Usage |
|---|---|---|---|
| Nom, e-mail, téléphone | Oui | Oui | Fonctionnement de l'app (compte, mise en relation artisan ↔ client) |
| Adresse postale | Oui | Oui (clients : adresse du logement ; artisans : siège) | Rendez-vous, documents |
| Position approximative | Non | — | (la recherche d'artisans se fait par ville saisie) |
| Photos | Oui, si l'utilisateur en ajoute | Non | Photos de chantier, pièces jointes |
| Fichiers et documents | Oui | Non | Devis, factures, justificatifs |
| Messages | Oui | Non | Messagerie de l'application |
| Informations financières | Non (pas de paiement dans l'app ; IBAN de l'artisan affiché sur ses factures) | — | — |
| Identifiants d'appareil | Non | — | — |
| Historique d'achats | Non | — | — |
| Journaux de plantage / diagnostics | Non | — | — |

Les données sont hébergées chez Supabase (Union européenne) et ne sont ni vendues ni partagées avec des régies publicitaires.
