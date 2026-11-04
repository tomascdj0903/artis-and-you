# Artis & You

L'application des artisans et de leurs clients : une seule webapp avec deux espaces (artisan et particulier), un logiciel PC / Mac qui se met à jour tout seul, et bientôt les apps Android et iPhone.

## Ce qu'il y a dans ce dépôt

| Dossier | Contenu |
|---|---|
| `web/` | La webapp (React, sans framework lourd). Construite par Vercel à chaque `git push`. |
| `desktop/` | Le logiciel Windows (.exe) et Mac (.dmg) : une fenêtre Artis & You qui ouvre la webapp, avec mises à jour automatiques. |
| `supabase/migrations/` | Le schéma de la base de données en ligne (pour quand on quittera le mode local). |
| `.github/workflows/desktop.yml` | Construit et publie le .exe et le .dmg sur GitHub à chaque nouvelle version. |

## Mode local (actuel)

Tant qu'aucune base Supabase n'est configurée, l'app fonctionne **en mode local** : toutes les données restent dans le navigateur (ou dans le logiciel) de l'appareil. Un bandeau jaune le rappelle. Pensez à faire des sauvegardes : *Paramètres → Données et confidentialité → Sauvegarder*.

Pour passer en ligne plus tard : créer le projet Supabase, exécuter `supabase/migrations/0001_init.sql` puis `0002_admin.sql`, puis ajouter dans Vercel les variables `SUPABASE_URL` et `SUPABASE_KEY` (clé publique) et redéployer.

## Mettre à jour

- **La webapp** : chaque `git push` sur `main` redéploie le site. Le logiciel PC / Mac affiche directement la nouvelle version (il charge le site).
- **Le logiciel lui-même** (icône, fenêtre, menus) : depuis votre ordinateur, lancez `./release.sh 1.0.1` (Mac / Linux) ou `.\release.ps1 1.0.1` (Windows). GitHub construit le .exe et le .dmg en ~10 minutes ; les logiciels installés téléchargent la mise à jour en arrière-plan et l'installent au redémarrage (sur Mac, une fenêtre propose de télécharger la nouvelle version tant que l'app n'est pas signée par Apple).

Liens de téléchargement (toujours la dernière version) :
- Windows : `https://github.com/tomascdj0903/artis-and-you/releases/latest/download/Artis-and-You-Setup.exe`
- Mac : `https://github.com/tomascdj0903/artis-and-you/releases/latest/download/Artis-and-You.dmg`

La page `/telecharger` de la webapp propose ces deux boutons.

## Développer en local

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # produit web/dist
node scripts/i18n.mjs   # régénère les traductions EN / PT / IT
```

Traductions : le texte français sert de clé. Les traductions sont dans `web/src/i18n/_en.txt`, `_pt.txt`, `_it.txt` (numéro|traduction) et `_extra.txt`.

## Administration

Pour devenir administrateur (vérifier les SIRET, relire les avis avant publication), une fois en ligne : exécuter dans l'éditeur SQL de Supabase la ligne indiquée à la fin de `0002_admin.sql`. En mode local, l'administration est accessible à tous depuis *Paramètres → Administration*.
