let gnomonProcess = null;
let telaServerProcess = null;


const { app, BrowserWindow, BrowserView, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const http = require("http"); // -- Gnomon

const { spawn } = require("child_process");

const gnomonConfigFile = path.join(app.getPath("userData"), "gnomonConfig.json");
// -----------Always open http(s) links in standard browser ----------------

app.on("web-contents-created", (_, contents) => {

  // Catch window.open(), target="_blank", etc.
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Catch in-app navigation (href clicks)
  contents.on("will-navigate", (event, url) => {
    if (/^https?:\/\//i.test(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

});


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


// -------------- Save Gnomon node to JSON -------------
function loadGnomonConfig() {
  try {
    if (!fs.existsSync(gnomonConfigFile)) {
      fs.writeFileSync(
        gnomonConfigFile,
        JSON.stringify({ node: "192.168.1.154:10102" }, null, 2),
        "utf8"
      );
    }
    return JSON.parse(fs.readFileSync(gnomonConfigFile, "utf8"));
  } catch (err) {
    console.error("Load Gnomon config error:", err);
    return { node: "192.168.1.154:10102" };
  }
}

function saveGnomonConfig(node) {
  try {
    fs.writeFileSync(
      gnomonConfigFile,
      JSON.stringify({ node }, null, 2),
      "utf8"
    );
  } catch (err) {
    console.error("Save Gnomon config error:", err);
  }
}

let gnomonNodeAddress = loadGnomonConfig().node;


// ---------------- Gnomon ----------------

/* ---- Gnomon status check ---- */
ipcMain.handle("check-gnomon", () => {
  return new Promise((resolve) => {
    const req = http.get(
      "http://127.0.0.1:8099",
      { timeout: 1500 },
      (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 500);
        res.resume();
      }
    );

    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
});


/* ---- Gnomon getInfo ---- */
ipcMain.handle("gnomon:get-info", async () => {
  return new Promise((resolve) => {
    const req = http.get(
      "http://127.0.0.1:8099/api/getinfo",
      { timeout: 1500 },
      (res) => {
        let data = "";

        res.on("data", chunk => data += chunk);
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(null);
          }
        });
      }
    );

    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
});

// -------------------- Gnomon Start/Stop ---------------------------------

ipcMain.handle("gnomon:start", async () => {
  if (gnomonProcess) return { running: true };

  const gnomonPath = path.join(__dirname, "resources", "gnomonindexer");

  gnomonProcess = spawn(gnomonPath, [
    `--daemon-rpc-address=${gnomonNodeAddress}`,
    "--fastsync",
    "--num-parallel-blocks=5",
    "--api-address=127.0.0.1:8099",
    '--search-filter="telaVersion"'
  ]);

  // Send live stdout logs to renderer
  gnomonProcess.stdout.on('data', (data) => {
    const str = data.toString();
    mainWindow.webContents.send('gnomon-log', str);

    // 🔹 Detect new SCID indexed lines (adjust regex to your output)
    const match = str.match(/Indexed SCID:\s+([a-z0-9]+)/i);
    if (match) {
      const scid = match[1];
      mainWindow.webContents.send('gnomon-new-scid', scid);
    }
  });

  // Send live stderr logs to renderer
  gnomonProcess.stderr.on("data", (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("gnomon-log", data.toString());
    }
  });

  // Handle process exit
  gnomonProcess.on("exit", (code) => {
    gnomonProcess = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("gnomon-exit", { code });
    }
  });

   // 🔹 Notify the renderer (start.html) that Gnomon started
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('gnomon-started');
  }

  return { started: true };
});

ipcMain.handle("gnomon:stop", async () => {
  if (!gnomonProcess) return { running: false };

  gnomonProcess.kill("SIGINT");
  gnomonProcess = null;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("gnomon-exit", { code: null });
  }

  return { stopped: true };
});

// ---------- IPC to apply the node address to Gnomon -------------------
ipcMain.handle("gnomon:apply-node", async (event, nodeAddress) => {
  if (!nodeAddress || typeof nodeAddress !== "string") {
    return { ok: false, error: "Invalid node address" };
  }

  gnomonNodeAddress = nodeAddress.trim();
  saveGnomonConfig(gnomonNodeAddress);

  // Optional: restart if running
  if (gnomonProcess) {
    await stopGnomonAndWait();
  }

  return { ok: true, node: gnomonNodeAddress };
});

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
let sidebarCollapsed = true;
let currentModalView = null;     // Modal overlay

// ---------------- Window ----------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 960,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  

  const indexPath = path.join(__dirname, "index.html");
  mainWindow.loadFile(indexPath).catch(console.error);

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

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
      webSecurity: true
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
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
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
app.whenReady().then(() => {
  startTelaServer();
  createWindow();
});


app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
// ---------------- Auto start and stop tela-server ----------------

function startTelaServer() {
  if (telaServerProcess) return;

  console.log("Starting tela-server...");

  const telaPath = path.join(__dirname, "tela-server");

  telaServerProcess = spawn(telaPath, [], {
    stdio: ["ignore", "pipe", "pipe"]
  });

  telaServerProcess.stdout.on("data", (data) => {
    console.log("[tela]", data.toString());
  });

  telaServerProcess.stderr.on("data", (data) => {
    console.error("[tela]", data.toString());
  });

  telaServerProcess.on("exit", (code) => {
    console.log("tela-server exited:", code);
    telaServerProcess = null;
  });
}

function stopTelaServerAndWait() {
  return new Promise((resolve) => {
    if (!telaServerProcess) return resolve();

    console.log("Stopping tela-server...");

    telaServerProcess.once("exit", () => {
      telaServerProcess = null;
      console.log("tela-server stopped.");
      resolve();
    });

    telaServerProcess.kill("SIGINT");

    // Safety fallback
    setTimeout(() => {
      if (telaServerProcess) {
        console.log("Force killing tela-server...");
        telaServerProcess.kill("SIGKILL");
        telaServerProcess = null;
      }
      resolve();
    }, 5000);
  });
}


// ---------------- Gnomon clean shutdown ----------------

function stopGnomonAndWait() {
  return new Promise((resolve) => {
    if (!gnomonProcess) return resolve();

    console.log("Stopping Gnomon and waiting for exit...");

    // Listen for exit
    gnomonProcess.once("exit", () => {
      gnomonProcess = null;
      console.log("Gnomon exited.");
      resolve();
    });

    // Send kill signal
    gnomonProcess.kill("SIGINT");

    // Safety timeout in case Gnomon doesn't exit
    setTimeout(() => {
      if (gnomonProcess) {
        console.log("Gnomon did not exit in time, forcing kill.");
        gnomonProcess.kill("SIGKILL");
        gnomonProcess = null;
      }
      resolve();
    }, 5000); // 5 seconds timeout
  });
}

// Hook into app shutdown
app.on("before-quit", async (e) => {
  if (gnomonProcess || telaServerProcess) {
    e.preventDefault();

    await stopGnomonAndWait();
    await stopTelaServerAndWait();

    app.quit();
  }
});

app.on("window-all-closed", async () => {
  if (process.platform !== "darwin") {
    await stopGnomonAndWait();
    await stopTelaServerAndWait();
    app.quit();
  }
});

// Catch unexpected exits
process.on("SIGINT", async () => {
  await stopGnomonAndWait();
  await stopTelaServerAndWait();
  process.exit();
});

process.on("SIGTERM", async () => {
  await stopGnomonAndWait();
  await stopTelaServerAndWait();
  process.exit();
});

