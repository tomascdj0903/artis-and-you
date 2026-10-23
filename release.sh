#!/usr/bin/env bash
# Publier une nouvelle version du logiciel PC / Mac depuis votre ordinateur.
# Usage : ./release.sh 1.0.1
set -e
V="$1"
if [ -z "$V" ]; then echo "Usage : ./release.sh 1.0.1"; exit 1; fi
cd "$(dirname "$0")"
(cd desktop && npm pkg set version="$V")
(cd web && npm pkg set version="$V")
git add -A
git commit -m "Version $V" || true
git tag "v$V"
git push origin main --tags
echo "Version $V envoyée : GitHub construit le .exe et le .dmg (environ 10 min), puis les logiciels installés se mettent à jour tout seuls."
