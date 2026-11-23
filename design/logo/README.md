# Logo Artis & You : tuile en verre

Source vectorielle du logo (A en deux tubes de verre, acajou et argile, sur une tuile terracotta).

- `logo-tuile-marge.svg` : avec marge transparente, pour le logiciel PC / Mac.
- `logo-tuile-pleine.svg` : tuile pleine, pour le favicon, les petites tailles du .ico et l'avatar du service client.
- `gen.py` : génère les deux SVG (`python3 gen.py sortie.svg [--bleed]`).

Fichiers produits à partir de ces SVG : `desktop/build/icon.png` (1024 px), `desktop/build/icon.ico` (16 à 256 px), `web/public/favicon.svg` et `web/public/favicon-32.png`.
Après un changement, augmenter le `?v=` dans `index.html`, `manifest.webmanifest` et `sw.js`, et le cache `ay-shell-vN` dans `sw.js`.
