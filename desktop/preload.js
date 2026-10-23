// Petit pont sécurisé entre la page et le logiciel (version, mise à jour)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('artisDesktop', {
  version: () => ipcRenderer.invoke('app-version'),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
});
