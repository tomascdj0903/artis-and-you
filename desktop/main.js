// Artis & You — logiciel PC / Mac
// Ouvre la webapp dans sa propre fenêtre et se met à jour tout seul depuis GitHub Releases.
const { app, BrowserWindow, shell, dialog, Menu, ipcMain, session } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const config = require('./config.json');

const APP_URL = process.env.ARTIS_URL || config.url;
const APP_HOST = new URL(APP_URL).host;
let win;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.setAppUserModelId('fr.artisandyou.app');

function createWindow() {
  win = new BrowserWindow({
    width: 1360, height: 880, minWidth: 380, minHeight: 600,
    title: 'Artis & You',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#FFFFFF',
    show: false,
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: true },
  });
  win.once('ready-to-show', () => win.show());
  win.loadURL(APP_URL);

  // Pas d'internet : page d'attente avec « Réessayer »
  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMain) => {
    if (isMain && code !== -3) win.loadFile(path.join(__dirname, 'offline.html'));
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('retry://')) { e.preventDefault(); win.loadURL(APP_URL); return; }
    const u = new URL(url);
    if (u.host !== APP_HOST && !url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); }
  });
  // Liens externes (WhatsApp, e-mail, téléphone, cartes, téléchargements GitHub…) : navigateur / appli du système
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('blob:') || url.startsWith('data:')) return { action: 'allow' };
    try { if (new URL(url).host === APP_HOST) return { action: 'allow' }; } catch {}
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Autorisations utiles à la webapp (position pour « Je suis en route », notifications)
function permissions() {
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['geolocation', 'notifications', 'clipboard-sanitized-write', 'fullscreen'].includes(perm)));
}

function menu() {
  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu', label: 'Artis & You' }] : []),
    { label: 'Fichier', submenu: [{ label: 'Accueil', accelerator: 'CmdOrCtrl+H', click: () => win.loadURL(APP_URL) }, { label: 'Imprimer', accelerator: 'CmdOrCtrl+P', click: () => win.webContents.print() }, { type: 'separator' }, isMac ? { role: 'close', label: 'Fermer' } : { role: 'quit', label: 'Quitter' }] },
    { label: 'Édition', submenu: [{ role: 'undo', label: 'Annuler' }, { role: 'redo', label: 'Rétablir' }, { type: 'separator' }, { role: 'cut', label: 'Couper' }, { role: 'copy', label: 'Copier' }, { role: 'paste', label: 'Coller' }, { role: 'selectAll', label: 'Tout sélectionner' }] },
    { label: 'Affichage', submenu: [{ role: 'reload', label: 'Actualiser' }, { role: 'resetZoom', label: 'Taille normale' }, { role: 'zoomIn', label: 'Zoom avant' }, { role: 'zoomOut', label: 'Zoom arrière' }, { type: 'separator' }, { role: 'togglefullscreen', label: 'Plein écran' }] },
    { label: 'Aide', submenu: [{ label: 'Rechercher une mise à jour', click: () => checkUpdates(true) }, { label: `Version ${app.getVersion()}`, enabled: false }] },
  ]));
}

// ─────────────── Mises à jour automatiques ───────────────
// Windows : téléchargement en arrière-plan puis installation (automatique à la fermeture, ou tout de suite si on accepte).
// Mac : sans signature Apple, l'installation auto n'est pas possible : on propose de télécharger la nouvelle version.
let manual = false;
function setupUpdater() {
  autoUpdater.autoDownload = process.platform !== 'darwin';
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', async (info) => {
    if (process.platform === 'darwin') {
      const r = await dialog.showMessageBox(win, { type: 'info', buttons: ['Télécharger', 'Plus tard'], defaultId: 0, title: 'Mise à jour disponible', message: `La version ${info.version} d'Artis & You est disponible.`, detail: 'Téléchargez-la puis remplacez l’application dans le dossier Applications.' });
      if (r.response === 0) shell.openExternal(config.releasesPage);
    }
  });
  autoUpdater.on('update-not-available', () => { if (manual) dialog.showMessageBox(win, { type: 'info', message: 'Artis & You est à jour.', detail: `Version ${app.getVersion()}` }); manual = false; });
  autoUpdater.on('update-downloaded', async (info) => {
    const r = await dialog.showMessageBox(win, { type: 'info', buttons: ['Redémarrer maintenant', 'Au prochain démarrage'], defaultId: 0, title: 'Mise à jour prête', message: `La version ${info.version} est prête.`, detail: 'Elle s’installera automatiquement à la fermeture du logiciel.' });
    if (r.response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on('error', (e) => { if (manual) dialog.showMessageBox(win, { type: 'warning', message: 'Impossible de vérifier les mises à jour.', detail: String(e?.message || e) }); manual = false; });
  checkUpdates(false);
  setInterval(() => checkUpdates(false), 4 * 60 * 60 * 1000);
}
function checkUpdates(byUser) {
  if (!app.isPackaged) return;
  manual = byUser;
  autoUpdater.checkForUpdates().catch(() => {});
}
ipcMain.handle('app-version', () => app.getVersion());
ipcMain.handle('check-updates', () => checkUpdates(true));

app.whenReady().then(() => {
  permissions();
  menu();
  createWindow();
  setupUpdater();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
