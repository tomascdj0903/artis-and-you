# Artesa sur Android (Google Play)

L'application Android est une **Trusted Web Activity** : une coquille native qui affiche le site https://artis-and-you.vercel.app en plein écran, avec l'icône, le nom et les notifications d'une vraie application. Le code reste celui de `web/` : chaque mise en ligne du site met à jour l'app sans repasser par le Play Store.

Rien ici n'engage de frais tant que le compte développeur Google Play (25 € une fois) n'est pas créé.

## 1. Préparer (une seule fois, sur ton PC)

```bash
npm install -g @bubblewrap/cli      # demande Java 17 et le SDK Android : Bubblewrap propose de les installer
cd android
bubblewrap init --manifest https://artis-and-you.vercel.app/manifest.webmanifest   # relit twa-manifest.json, pose quelques questions
```

Bubblewrap crée la clé de signature `android.keystore` (**à sauvegarder** : sans elle, impossible de publier une mise à jour) et affiche son **empreinte SHA-256**.

## 2. Lier l'app au site (sinon la barre d'adresse Chrome reste visible)

1. Copier l'empreinte SHA-256 dans `web/public/.well-known/assetlinks.json` (remplacer `REMPLACER_PAR_EMPREINTE_SHA256`).
2. Après publication sur le Play Store, ajouter aussi l'empreinte de la **clé de signature Google Play** (Play Console › Configuration › Intégrité de l'application), dans le même fichier.
3. Mettre en ligne le site (fusion dans `main`). Vérifier : https://artis-and-you.vercel.app/.well-known/assetlinks.json

## 3. Construire

```bash
bubblewrap build            # produit app-release-bundle.aab (pour le Play Store) et app-release-signed.apk (pour tester)
```

Tester l'APK sur un téléphone : `adb install app-release-signed.apk`.

## 4. Publier

1. Créer le compte sur https://play.google.com/console (25 €, pièce d'identité demandée).
2. Créer l'application « Artesa », importer `app-release-bundle.aab` dans **Production** (ou d'abord **Test interne**).
3. Remplir la fiche avec les textes et visuels du dossier `store/` (voir `store/fiche.md`).
4. Questionnaires obligatoires : sécurité des données (voir `store/securite-donnees.md`), classification du contenu (aucun contenu sensible), public cible (18 ans et plus).
5. Première validation Google : 1 à 7 jours.

## Mises à jour

- **Site** : automatiques, rien à faire.
- **Coquille** (nouvelle icône, nouveau nom, Android plus récent) : augmenter `appVersionCode` et `appVersionName` dans `twa-manifest.json`, `bubblewrap update && bubblewrap build`, importer le nouveau `.aab`.

## iPhone

Pas de TWA sur iOS. Le jour venu : projet Capacitor (`npx cap add ios`) à compiler sur un Mac avec Xcode, compte Apple Developer (99 €/an). Sur iPhone, l'installation du site depuis Safari (« Sur l'écran d'accueil ») offre déjà les notifications push depuis iOS 16.4.
