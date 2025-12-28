const { app, BrowserWindow, BrowserView, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

// ---------------- Bookmarks ----------------
const scidBookmarkFile = path.join(app.getPath("userData"), "scidBookmarks.json");
const nodeBookmarkFile = path.join(app.getPath("userData"), "nodeBookmarks.json");

function loadJSON(file) {
  try {
    if (!fs.existsSync(file)) fs.writeFileSync(file, "[]", "utf8");
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error("Load JSON error:", err);
    return [];
  }
}

function saveJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Save JSON error:", err);
  }
}

// ---------------- Bookmark IPC ----------------
ipcMain.handle("scid:load", () => loadJSON(scidBookmarkFile));
ipcMain.handle("scid:add", (e, { name, scid }) => {
  const list = loadJSON(scidBookmarkFile);
  if (!list.some(i => i.scid === scid)) {
    list.push({ name, scid });
    saveJSON(scidBookmarkFile, list);
  }
  return list;
});
ipcMain.handle("scid:delete", (e, scid) => {
  let list = loadJSON(scidBookmarkFile);
  list = list.filter(i => i.scid !== scid);
  saveJSON(scidBookmarkFile, list);
  return list;
});

ipcMain.handle("node:load", () => loadJSON(nodeBookmarkFile));
ipcMain.handle("node:add", (e, { name, node }) => {
  const list = loadJSON(nodeBookmarkFile);
  if (!list.some(i => i.node === node)) {
    list.push({ name, node });
    saveJSON(nodeBookmarkFile, list);
  }
  return list;
});
ipcMain.handle("node:delete", (e, node) => {
  let list = loadJSON(nodeBookmarkFile);
  list = list.filter(i => i.node !== node);
  saveJSON(nodeBookmarkFile, list);
  return list;
});

// ---------------- Search -----------------
ipcMain.on("scid:select", (event, scid) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("scid:select", scid);
  }
});

// ------ Managers --
ipcMain.handle("browserviews:hide-all", () => {
  if (!mainWindow) return;
  for (const view of browserViews.values()) {
    mainWindow.removeBrowserView(view);
  }
  activeTabId = null;
});


// ---------------- Globals ----------------
let mainWindow = null;
const browserViews = new Map();  // tabId → BrowserView
let activeTabId = null;
const activeScids = new Map();   // scid → tabId
let sidebarCollapsed = false;
let currentModalView = null;     // Modal overlay

// ---------------- Window ----------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 960,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  });

  const indexPath = path.join(__dirname, "index.html");
  mainWindow.loadFile(indexPath).catch(err => console.error(err));

  mainWindow.on("resize", () => updateActiveBrowserViewBounds());
}

// ---------------- BrowserView helpers ----------------
function computeBrowserViewBounds() {
  if (!mainWindow) return { x: 0, y: 0, width: 0, height: 0 };
  const topBarHeight = 80;          
  const sidebarWidth = sidebarCollapsed ? 0 : 260;
  const { width, height } = mainWindow.getContentBounds();
  return { x: sidebarWidth, y: topBarHeight, width: width - sidebarWidth, height: height - topBarHeight };
}

function updateActiveBrowserViewBounds() {
  if (!activeTabId) return;
  const view = browserViews.get(activeTabId);
  if (!view) return;
  const bounds = computeBrowserViewBounds();
  view.setBounds(bounds);
  view.setAutoResize({ width: true, height: true });
}

// ---------------- Modal Overlay Helpers ----------------
function showModalOverlay(modalBounds, bookmarkType, bookmarkValue) {
  if (currentModalView) hideModalOverlay();
  
  currentModalView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, "modal-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  });

  const fragment = `#${JSON.stringify({bookmarkType, bookmarkValue})}`;
  const modalPath = `file://${path.join(__dirname, 'modal.html')}${fragment}`;
  
  currentModalView.webContents.loadURL(modalPath);

  currentModalView.webContents.once('did-finish-load', () => {
    currentModalView.setBounds(modalBounds);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.addBrowserView(currentModalView);
      mainWindow.setTopBrowserView(currentModalView);
    }
  });
}

function hideModalOverlay() {
  if (!currentModalView) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.removeBrowserView(currentModalView);
  }
  currentModalView.webContents.destroy();
  currentModalView = null;
}

// ---------------- Tabs / SCIDs ----------------
ipcMain.handle("tela:start", async (event, { node, scid }) => {
  try {
    // If SCID missing, just create a blank/start tab
    if (!scid) {
      const tabId = `tab-${Date.now()}`;
      const view = new BrowserView({
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          preload: path.join(__dirname, "start-preload.js")
        }
      });
      const startPath = `file://${path.join(__dirname, "start.html")}`;
      await view.webContents.loadURL(startPath);

      browserViews.set(tabId, view);

      // Send initial tab title
      mainWindow?.webContents.send("tela:tab-title", { tabId, title: "Start Page" });

      // Optional: update title if start.html changes <title>
      view.webContents.on("page-title-updated", (e, newTitle) => {
        e.preventDefault();
        mainWindow?.webContents.send("tela:tab-title", { tabId, title: newTitle });
      });

      switchToTab(tabId);
      return { id: tabId };
    }

    // ---------------- SCID tabs ----------------
    console.log("Loading SCID:", scid);
    if (activeScids.has(scid)) {
      const tabId = activeScids.get(scid);
      switchToTab(tabId);
      return { id: tabId };
    }

    const res = await fetch(`http://127.0.0.1:4040/add/${scid}?node=${encodeURIComponent(node)}`);
    if (!res.ok) throw new Error(`Tela registration failed: ${res.status}`);

    const tabId = `tab-${Date.now()}`;
    activeScids.set(scid, tabId);

    const view = new BrowserView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'wallet-preload.js')
      }
    });

    browserViews.set(tabId, view);

    const url = `http://localhost:4040/tela/${scid}/`;
    await view.webContents.loadURL(url);

        setTimeout(() => {
      if (!mainWindow || !browserViews.has(tabId)) return;
      const initialTitle = view.webContents.getTitle();
      mainWindow.webContents.send("tela:tab-title", { tabId, title: initialTitle });
    }, 100);

    // Update tab title from SCID page <title>
    view.webContents.on("page-title-updated", (e, newTitle) => {
      e.preventDefault();
      mainWindow?.webContents.send("tela:tab-title", { tabId, title: newTitle });
    });

    // Initial short title while page loads
    const shortScid = scid.slice(0, 12) + "...";
    mainWindow?.webContents.send("tela:tab-title", { tabId, title: `Tela ${shortScid}` });

    switchToTab(tabId);
    return { id: tabId };
  } catch (err) {
    console.error("Tela start error:", err);
    throw err;
  }
});



function switchToTab(tabId) {
  if (!mainWindow || activeTabId === tabId) return;

  if (activeTabId && browserViews.has(activeTabId)) {
    mainWindow.removeBrowserView(browserViews.get(activeTabId));
  }

  const view = browserViews.get(tabId);
  if (!view) return;

  mainWindow.addBrowserView(view);
  activeTabId = tabId;

  updateActiveBrowserViewBounds();
}

// ---------------- Tab handle ----------------
ipcMain.handle("switch-tab", (event, tabId) => switchToTab(tabId));

ipcMain.handle("tela:close-tab", async (event, { tabId, scid }) => {
  const view = browserViews.get(tabId);
  if (!view) return;

  if (activeTabId === tabId && mainWindow) {
    mainWindow.removeBrowserView(view);
  }

  view.webContents.destroy();
  browserViews.delete(tabId);
  activeScids.delete(scid);

  await fetch(`http://127.0.0.1:4040/remove/${scid}`).catch(() => {});
});

// ---------------- Sidebar toggle ----------------
ipcMain.on("sidebar:toggle", (event, collapsed) => {
  sidebarCollapsed = collapsed;
  updateActiveBrowserViewBounds();
});

// ---------------- Modal IPC ----------------
ipcMain.handle("modal:show", (event, { bounds, bookmarkType, bookmarkValue }) => {
  const modalBounds = bounds || { x: 450, y: 250, width: 500, height: 300 };
  showModalOverlay(modalBounds, bookmarkType, bookmarkValue);
});

ipcMain.handle("modal:close", () => hideModalOverlay());

ipcMain.handle("get-window-size", () => mainWindow ? mainWindow.getContentSize() : [0, 0]);

ipcMain.handle('bookmark-save-from-modal', async (event, { name, type, value }) => {
  if (type === "scid") {
    const list = loadJSON(scidBookmarkFile);
    if (!list.some(i => i.scid === value)) {
      list.push({ name, scid: value });
      saveJSON(scidBookmarkFile, list);
    }
  }
  if (type === "node") {
    const list = loadJSON(nodeBookmarkFile);
    if (!list.some(i => i.node === value)) {
      list.push({ name, node: value });
      saveJSON(nodeBookmarkFile, list);
    }
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("bookmarks-updated");
  }
});

// ---------------- App lifecycle ----------------
app.whenReady().then(createWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
