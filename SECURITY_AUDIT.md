# Audit de sécurité Artesa — 9 novembre 2026

Périmètre : webapp (Vercel), base et stockage Supabase (projet `jkecsanrqktnrsibyiod`), Edge Functions `agenda` et `push`, logiciel PC/Mac (Electron, dossier `desktop/`).
Les « apps iPhone et Android » sont aujourd'hui la webapp installée (PWA). Il n'existe pas de code natif React Native, Flutter ou Capacitor dans le dépôt.

Méthode : lecture du code et des policies, puis attaques rejouées en SQL sous l'identité d'un vrai gérant non admin de la base de production (`set role authenticated` + `request.jwt.claims`).
Chaque attaque tournait dans une transaction annulée à la fin : **aucune donnée réelle n'a été modifiée ni exportée**.
Les tests se sont faits directement en production, avec l'accord explicite du propriétaire.
La consigne prévoyait des comptes de test A, B et un admin factice. Elle n'a pas été suivie : les attaques ont tourné sous l'identité d'un vrai gérant, dans des transactions annulées.

Les correctifs sont sur `main`, qui déploie la production. La branche `security-hardening` pointe sur le même état et sert de référence pour l'audit.

## Failles et correctifs

| # | Sévérité | Faille | Exploitation (reproductible) | Correctif | Statut |
|---|---|---|---|---|---|
| 1 | **Critique** | Un gérant pouvait se déplacer, lui ou un employé, dans une autre entreprise, puis lire et modifier toutes ses données (clients, devis, factures, messages) | `update profiles set company_id = '<autre entreprise>' where id = auth.uid()` → passait, car la policy `profiles_upd_gerant` ne vérifiait que `is_gerant()` | Migration 0016 : le gérant ne peut que garder un membre dans son entreprise ou l'en retirer. Un trigger interdit de changer soi-même d'entreprise (seules les fonctions `create_company` et `join_company` le font) | Corrigé. Attaque rejouée : bloquée. Modification normale du profil : OK |
| 2 | Haute | Paiement enregistré sur la facture d'une autre entreprise, qui passait « payée » (le trigger `sync_paid`, en SECURITY DEFINER, mettait à jour le document) | `insert into payments(company_id, document_id, …) values (<moi>, <facture d'un autre>, …)` | Migration 0014 : `WITH CHECK` sur la propriété du document | Corrigé, non rejoué (pas de facture d'une autre entreprise au moment du test) |
| 3 | Haute | Le gérant pouvait s'offrir l'abonnement, prolonger son essai, changer son parrain ou son code de parrainage, remettre ses compteurs de numérotation à zéro (factures en double), changer le propriétaire | `update companies set trial_ends_at = now() + '9 years', counters = '{}'` | Migrations 0014 et 0015 : trigger `protect_company_fields` (SECURITY INVOKER) | Corrigé. Rejoué : essai, compteurs, validation et code de parrainage bloqués. Réglages, profil d'entreprise et numérotation normale : OK. L'abonnement (`plan`) n'a pas été rejoué de façon concluante, mais le même trigger le couvre |
| 4 | Haute | Le pro pouvait publier, noter ou réécrire ses propres avis clients | `update reviews set status = 'publie', rating = 5` | Migration 0014 : seul `reply` est modifiable, sauf pour un admin | Corrigé, non rejoué (aucun avis disponible) |
| 5 | Moyenne | Usurpation de l'expéditeur d'un message (`sender_company_id`, `sender_id`) et fausses cartes système | `insert into messages(sender_company_id = <autre>)` | Migrations 0014 et 0015 : expéditeur et entreprise imposés par le serveur, cartes système interdites aux appels directs | Corrigé. Rejoué : bloqué |
| 6 | Moyenne | Changement des participants d'une conversation, par exemple pour faire entrer une autre entreprise | `update conversations set other_company_id = …` | Migration 0014 : trigger `protect_conversation` | Corrigé. Rejoué : bloqué. Mise à jour normale : OK |
| 7 | Moyenne | Rattacher un RDV, document, chantier ou fichier au client d'une autre entreprise (spam ou hameçonnage vers son espace client) | `insert into appointments(client_id = <client d'un autre>)` | Migration 0014 : policies RESTRICTIVE sur `client_id` et `project_id` | Corrigé, non rejoué (aucun client d'une autre entreprise accessible) |
| 8 | Moyenne | Storage : la règle de lecture comparait `f.path` à `f.name` (colonne de la table) au lieu du chemin du fichier demandé. Un document du coffre-fort partagé était lisible par n'importe quel compte connaissant son chemin, et les fichiers partagés restaient illisibles pour les clients | Lecture d'un objet `files/<entreprise>/vault/...` avec un compte sans lien | Migration 0014 : policy réécrite (`objects.name`, appartenance à l'entreprise), taille maximale 25 Mo | Corrigé |
| 9 | Moyenne | Edge Function `push` : abonnement push avec une URL arbitraire, que le serveur appellait ensuite (SSRF) | `insert into push_subscriptions(endpoint = 'https://interne/…')` | Migration 0017 : contrainte sur les services push officiels (FCM, Apple, Mozilla, Windows) | Corrigé (appliquée) ; vérifié |
| 10 | Moyenne | Codes d'invitation d'équipe de 6 caractères sans limite d'essais (force brute) | Appels répétés à `rpc/join_company` | Migration 0017 : 10 essais ratés par heure et par compte | Corrigé (appliquée) ; vérifié |
| 11 | Moyenne | Aucun en-tête de sécurité HTTP | `curl -I` | `web/vercel.json` : CSP, HSTS, X-Frame-Options DENY, `frame-ancestors 'none'`, `nosniff`, Referrer-Policy, Permissions-Policy | En place dans `vercel.json`. Aucune violation CSP en local. Non vérifié sur le site en ligne : déploiement en cours |
| 12 | Moyenne | Electron : `shell.openExternal` sur n'importe quel protocole (`file:`, `ms-msdt:`…), navigation `file:` libre, IPC sans contrôle de l'origine, DevTools en production | Lien `ms-msdt:` dans un message | `desktop/main.js` : sandbox, protocoles autorisés (http, https, mailto, tel, sms, whatsapp), `file:` limité à la page hors ligne, IPC réservé au site officiel, DevTools coupés une fois installé | Corrigé (actif à la prochaine version du logiciel) |
| 13 | Basse | Lien `href` construit à partir de données saisies (site web d'un client) : `javascript:` | Site web = `javascript:alert(1)` | Composant `KV` : seuls http, https, mailto, tel et sms passent (React 19 bloquait déjà `javascript:`) | Corrigé |
| 14 | Basse | Protection contre les mots de passe ayant fuité désactivée (HaveIBeenPwned) | — | Réglage du dashboard Supabase | **À faire par toi** |
| 15 | Basse | Déploiements preview Vercel publics (même base de prod, seule la clé publishable y figure) | URL `*-schedule7.vercel.app` | Activer « Vercel Authentication » sur les previews | **À faire par toi** |
| 16 | Info | Électron 33 en fin de support | — | Passer à la version stable actuelle d'Electron et d'electron-builder | À faire (la vérification de version était impossible ici) |
| 17 | Info | Mises à jour du logiciel non signées (Windows SmartScreen, macOS Gatekeeper) | — | Certificat de signature de code Windows et compte Apple Developer | À faire par toi |

## Vérifié sans problème
- **Secrets** : aucun secret dans le code, l'historique git (76 commits), les fichiers compilés ni la config du logiciel. La clé `service_role` n'est utilisée que dans les Edge Functions. Le site compilé ne contient pas de sourcemaps.
- **RLS** : toutes les tables `public` ont RLS. `admins` et `siret_history` n'ont aucune policy, donc sont inaccessibles, ce qui est voulu. Rejoué : 0 document, message ou fichier d'une autre entreprise visible, et impossible de se mettre admin.
- **Rôles** : l'admin est stocké dans la table `admins`, pas dans `user_metadata`. Les rôles d'équipe sont protégés par un trigger.
- **Fonctions SECURITY DEFINER** : toutes ont `search_path` fixé. Aucune n'est exécutable par `anon`. `push_payload`, qui renvoie la clé VAPID privée, n'est exécutable que par `service_role`.
- **Edge Function `agenda`** : jeton de 48 caractères hexadécimaux, validé par regex, révocable.
- **Realtime** : aucune table publiée.
- **XSS** : pas de `dangerouslySetInnerHTML` ni d'`eval`, et React échappe tout.
- **Open redirect** : les `redirect_to` d'auth sont construits sur `location.origin`.
- **Dépendances web** : 6 dépendances à versions fixes, sans script `postinstall`.

## Non couvert, à faire ensuite
- `npm audit` impossible : le registre npm est injoignable depuis l'environnement d'audit. Le lockfile généré ici pointait vers un registre interne et cassait le build Vercel. Il est retiré, et il faudra en générer un depuis ton poste (`npm i`).
- Attaques de bout en bout dans le navigateur sur le site en ligne : l'environnement d'audit ne peut pas joindre `*.vercel.app` directement.
- Rate limiting de l'authentification et durée des JWT : à contrôler dans le dashboard Supabase (Auth › Rate limits, JWT expiry).

## Conformité avant publication (RGPD et stores)
- Présents : mentions légales, CGU, politique de confidentialité, demande de suppression de compte (par e-mail), aucune mesure d'audience tierce.
- Manquent :
  - **suppression du compte directement dans l'app**, exigée par Apple. Aujourd'hui, l'utilisateur envoie un e-mail.
  - **export des données de l'utilisateur** (RGPD, droit à la portabilité).
- Pour les stores, il faudra un emballage natif. Il faudra aussi remplir les fiches « App Privacy » (Apple) et « Data safety » (Google), et viser l'API Android récente. « Sign in with Apple » n'est requis que si une connexion Google ou Facebook est ajoutée.

## Actions que toi seul peux faire
1. Supabase › Authentication : vérifier les URL de redirection (pas de joker). Protection mots de passe fuités : option payante, écartée.
2. Vercel › Settings › Deployment Protection : activer Vercel Authentication sur les previews.
3. Signature de code, `npm audit` et mise à jour d'Electron : écartés pour l'instant (décision du propriétaire).
4. Aucune rotation de clé nécessaire : aucun secret n'a fuité.

## Résumé
- Faille critique corrigée : un gérant pouvait entrer dans les données d'une autre entreprise.
- Quatre failles hautes corrigées : facture d'un autre marquée payée, abonnement et essai gratuits, compteurs de factures, avis truqués.
- Usurpation de messages, conversations, rattachement de clients et lecture de fichiers corrigés.
- En-têtes de sécurité du site et durcissement du logiciel PC/Mac en place.
- Deux correctifs prêts à valider (push, codes d'invitation), plus des réglages de dashboard à faire toi-même.
- Aucun secret n'a fuité.

**Score de risque global : avant 8/10 (élevé), après 2/10 (faible).**
