# Publier une nouvelle version du logiciel PC / Mac depuis Windows.
# Usage (PowerShell) : .\release.ps1 1.0.1
param([Parameter(Mandatory=$true)][string]$V)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Push-Location desktop; npm pkg set version=$V; Pop-Location
Push-Location web; npm pkg set version=$V; Pop-Location
git add -A
git commit -m "Version $V"
git push origin main
Write-Host "Version $V envoyée : GitHub construit le .exe et le .dmg (environ 10 min), puis les logiciels installés se mettent à jour tout seuls."
