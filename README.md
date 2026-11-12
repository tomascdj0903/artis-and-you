# Artesa (dépôt `artis-and-you`)

L'application des artisans du bâtiment et de leurs clients : devis, factures, planning, messagerie, réseau de pros côté artisan ; recherche d'artisan, rendez-vous, signature de devis et suivi des travaux côté particulier.

Site : https://artis-and-you.vercel.app

## Ce qu'il y a dans ce dépôt

| Dossier | Contenu |
|---|---|
| `web/` | La webapp (React 19, esbuild, sans framework). Une seule application avec deux espaces : `/pro` et `/client`. Installable sur téléphone (PWA). |
| `desktop/` | Le logiciel Windows (.exe) et Mac (.dmg) : une fenêtre Electron qui charge le site, avec mises à jour automatiques. |
| `supabase/migrations/` | Le schéma de la base, les règles d'accès (RLS) et les fonctions SQL, dans l'ordre d'application. |
| `supabase/functions/` | Les Edge Functions : `assistant` (IA), `push` (notifications), `agenda` (flux calendrier), `mail` (e-mails via Resend). |
| `.github/workflows/` | `web.yml` : build et tests à chaque envoi. `desktop.yml` : construction et publication du .exe et du .dmg. `backup.yml` : sauvegarde hebdomadaire chiffrée de la base (inactive sans les secrets `SUPABASE_DB_URL` et `BACKUP_PASSPHRASE`, voir l'en-tête du fichier). |
| `android/` | Emballage Android (Trusted Web Activity) et fiche Play Store : voir `android/README.md`. Aucun coût tant que le compte Google Play n'est pas créé. |
| `SECURITY_AUDIT.md` | L'audit de sécurité du 9 novembre 2026 et l'état des correctifs. |

Il n'y a pas encore d'application native iPhone ou Android : sur téléphone, c'est la webapp installée.

## Architecture

- **Hébergement** : Vercel construit `web/` à chaque envoi sur `main` (production). Les autres branches ont une adresse d'aperçu protégée.
- **Données** : Supabase (Postgres, authentification, stockage privé `files`). Toute la sécurité repose sur les règles RLS et les fonctions SQL : le navigateur n'a que la clé publique.
- **Variables Vercel** : `SUPABASE_URL` et `SUPABASE_KEY` (clé publique « publishable »). Sans elles, l'app démarre en **mode démo** : données fictives gardées dans le navigateur, bandeau jaune. C'est ce mode qu'utilisent les tests.
- **Secrets** : uniquement dans Supabase › Edge Functions › Secrets. Aucun secret dans le dépôt ni dans Vercel.
  - `GROQ_API_KEY` : l'assistant (IA).
  - `RESEND_API_KEY` et `MAIL_FROM` (ex. `Artesa <notifications@votre-domaine.fr>`, expéditeur vérifié chez Resend) : e-mails envoyés par Artesa (relances). Tant qu'ils sont absents, les relances par e-mail s'ouvrent dans l'application mail de l'artisan.
- **Tâches planifiées** (pg_cron, migration 0024) : rappel des rendez-vous du lendemain à 18 h, relances automatiques à 8 h (entreprises ayant activé « automatique » dans Paramètres › Relances). Les scénarios par défaut sont dupliqués dans `web/src/lib/relances.js` et `0024_taches_planifiees.sql` : modifier les deux.
- **En-têtes de sécurité** (CSP, HSTS…) : `web/vercel.json`.

### Organisation du code web

| Chemin | Rôle |
|---|---|
| `src/main.jsx` | Routes et coque de l'app. Les espaces artisan, particulier et les pages communes sont chargés séparément. |
| `src/pages/pro`, `src/pages/client`, `src/pages/common`, `src/pages/auth` | Les écrans. |
| `src/ui/` | Composants partagés (barre de recherche, bouton « + » et assistant, messages vocaux, signature…). |
| `src/lib/api.js` | Accès à Supabase. `src/lib/mock.js` : le même contrat pour le mode démo. |
| `src/lib/assistant-*.js` | L'assistant : actions sur les données de l'utilisateur, fiches d'aide pro et particulier. |
| `src/lib/facturx.js` | Factur-X : XML CII (profil BASIC, EN 16931) et métadonnées PDF/A-3 embarqués dans le PDF des factures finalisées. La transmission à une plateforme agréée (PDP) n'est pas encore branchée. |
| `src/i18n/` | Traductions. Le texte français sert de clé. |

## Développer

```bash
cd web
npm install
npm run dev               # http://localhost:5173 (mode démo sans variables Supabase)
npm run build             # produit web/dist
node scripts/i18n.mjs     # régénère les traductions EN / PT / IT
node tests/e2e.mjs        # tests des parcours principaux (après le build ; demande Playwright)
```

Traductions : ajouter une ligne `français|anglais|portugais|italien` dans `web/src/i18n/_extra.txt`, puis lancer `node scripts/i18n.mjs`.

## Mettre en ligne

- **Webapp** : travailler sur une branche, vérifier l'aperçu Vercel et les tests GitHub, puis fusionner dans `main`. Le logiciel PC / Mac affiche aussitôt la nouvelle version (il charge le site).
- **Base de données** : ajouter un fichier numéroté dans `supabase/migrations/`, le relire, puis l'appliquer sur le projet Supabase. Une migration ne se modifie plus une fois appliquée : on en écrit une nouvelle.
- **Edge Functions** : se déploient séparément du site (tableau de bord ou CLI Supabase).
- **Logiciel PC / Mac** (icône, fenêtre, menus) : `./release.sh 1.2.2` (Mac / Linux) ou `.\release.ps1 1.2.2` (Windows). GitHub construit le .exe et le .dmg en dix minutes environ ; les logiciels installés se mettent à jour au redémarrage. Les installeurs ne sont pas signés (avertissement Windows SmartScreen et macOS Gatekeeper).

Téléchargements (toujours la dernière version) :
- Windows : `https://github.com/tomascdj0903/artis-and-you/releases/latest/download/Artesa-Setup.exe`
- Mac : `https://github.com/tomascdj0903/artis-and-you/releases/latest/download/Artesa.dmg`

## Administration

Les administrateurs (validation des SIRET, relecture des avis) sont les comptes inscrits dans la table `admins`, qui n'est modifiable que depuis l'éditeur SQL de Supabase. La ligne à exécuter est à la fin de `supabase/migrations/0002_admin.sql`.
