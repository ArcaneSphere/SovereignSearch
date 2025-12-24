const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadSCIDBookmarks: () => ipcRenderer.invoke('scid:load'),
  loadNodeBookmarks: () => ipcRenderer.invoke('node:load'),
  selectSCID: (scid) => ipcRenderer.send('scid:select', scid),
  onSCIDSelected: (cb) => ipcRenderer.on('scid:select', (_, scid) => cb(scid))
});
