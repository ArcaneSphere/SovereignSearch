const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Bookmarks
  loadSCIDBookmarks: () => ipcRenderer.invoke("scid:load"),
  addSCIDBookmark: (data) => ipcRenderer.invoke("scid:add", data),
  deleteSCIDBookmark: (scid) => ipcRenderer.invoke("scid:delete", scid),

  loadNodeBookmarks: () => ipcRenderer.invoke("node:load"),
  addNodeBookmark: (data) => ipcRenderer.invoke("node:add", data),
  deleteNodeBookmark: (node) => ipcRenderer.invoke("node:delete", node),

  // Tela
  startTela: (node, scid) => ipcRenderer.invoke("tela:start", { node, scid }),
  closeTelaTab: data => ipcRenderer.invoke("tela:close-tab", data),
  sendSidebarToggle: (collapsed) => ipcRenderer.send("sidebar:toggle", collapsed),
  switchToTab: tabId => ipcRenderer.invoke("switch-tab", tabId),

  // Modal
  modalShow: (options) => ipcRenderer.invoke("modal:show", options),
  modalClose: () => ipcRenderer.invoke("modal:close"),
  getWindowSize: () => ipcRenderer.invoke("get-window-size"),

  // Events
  onTelaTabTitle: (cb) => ipcRenderer.on("tela:tab-title", (event, payload) => cb(payload)),
  onBookmarksUpdated: (cb) => ipcRenderer.on("bookmarks-updated", () => cb()),
  
  selectSCID: (scid) => ipcRenderer.send("scid:select", scid),
  onSCIDSelected: (cb) => ipcRenderer.on("scid:select", (_, scid) => cb(scid)),

  checkGnomon: () => ipcRenderer.invoke("check-gnomon"),
  getGnomonInfo: () => ipcRenderer.invoke("gnomon:get-info"),

  applyGnomonNode: (node) => ipcRenderer.invoke("gnomon:apply-node", node),

  gnomonStart: () => ipcRenderer.invoke("gnomon:start"),
  gnomonStop: () => ipcRenderer.invoke("gnomon:stop"),

  getGnomonLogBuffer: () => ipcRenderer.invoke("gnomon:get-log-buffer"),

  removeGnomonLogListener: (cb) =>
  ipcRenderer.removeListener("gnomon-log", cb),

  removeGnomonExitListener: (cb) =>
  ipcRenderer.removeListener("gnomon-exit", cb),



  onGnomonLog: (callback) => ipcRenderer.on("gnomon-log", (_, log) => callback(log)),
  onGnomonExit: (callback) => ipcRenderer.on("gnomon-exit", (_, data) => callback(data)),

  hideAllBrowserViews: () => ipcRenderer.invoke("browserviews:hide-all")

});
