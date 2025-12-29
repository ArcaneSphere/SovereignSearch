
import { showManager, hideManagers } from "./managers/router.js";

// renderer.js
document.addEventListener("DOMContentLoaded", () => {
  // ---------- DOM references ----------
  const nodeInput = document.getElementById("nodeInput");
  const scidInput = document.getElementById("scidInput");

  const saveNodeBtn = document.getElementById("saveNodeBookmarkButton");
  const saveSCIDBtn = document.getElementById("saveSCIDBookmarkButton");
  const loadTelaBtn = document.getElementById("loadTelaButton");

  const applyNodeBtn = document.getElementById("applyNodeButton");

  const newTabBtn = document.getElementById("newTabBtn");
  const tabsContainer = document.getElementById("tabsContainer");

  const sidebar = document.getElementById("sidebar");
  const sidebarNodeList = document.getElementById("sidebarNodeList");
  const sidebarSCIDList = document.getElementById("sidebarSCIDList");
  const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");

  const api = window.electronAPI;

  document.querySelectorAll("[data-manager]").forEach(btn => {
  btn.addEventListener("click", () => {
    const managerId = btn.dataset.manager;

    // Show manager UI (renderer only)
    showManager(managerId);
  });
});

  // ---------- SCID selection from search / picker ----------
  api.onSCIDSelected((scid) => {
    scidInput.value = scid;
    scidInput.focus();
    scidInput.select();
  });

  // ---------- State ----------
  let tabs = []; // { id, scid, node, serverId, title }
  let activeTabId = null;

  // ---------- Handle Tab Titles ----------
  api.onTelaTabTitle(({ tabId, title }) => {
    const tab = tabs.find(t => t.serverId === tabId);
    if (!tab) return;
    tab.title = title;
    renderTabs();
  });

  // ---------- Bookmark Helpers ----------
  async function renderNodeBookmarks() {
    const list = await api.loadNodeBookmarks();
    sidebarNodeList.innerHTML = "";
    list.forEach(b => {
      const div = document.createElement("div");
      div.className = "bookmark-item";
      div.innerHTML = `<span>${b.name}</span><button class="bookmark-delete">❌</button>`;

      div.querySelector("span").onclick = () => {
        nodeInput.value = b.node;
      };

      div.querySelector(".bookmark-delete").onclick = async (e) => {
        e.stopPropagation();
        await api.deleteNodeBookmark(b.node);
        renderNodeBookmarks();
      };

      sidebarNodeList.appendChild(div);
    });
  }

  async function renderSCIDBookmarks() {
    const list = await api.loadSCIDBookmarks();
    sidebarSCIDList.innerHTML = "";
    list.forEach(b => {
      const div = document.createElement("div");
      div.className = "bookmark-item";
      div.innerHTML = `<span>${b.name}</span><button class="bookmark-delete">❌</button>`;

      div.querySelector("span").onclick = () => {
        scidInput.value = b.scid;
      };

      div.querySelector(".bookmark-delete").onclick = async (e) => {
        e.stopPropagation();
        await api.deleteSCIDBookmark(b.scid);
        renderSCIDBookmarks();
      };

      sidebarSCIDList.appendChild(div);
    });
  }

  // ---------- Bookmark Modal ----------
  async function openBookmarkModal(type, value) {
    const [winWidth, winHeight] = await api.getWindowSize();
    const modalWidth = 400;
    const modalHeight = 200;
    const x = Math.max(20, (winWidth - modalWidth) / 2);
    const y = Math.max(100, (winHeight - modalHeight) / 2 + 80);

    await api.modalShow({
      bounds: { x, y, width: modalWidth, height: modalHeight },
      bookmarkType: type,
      bookmarkValue: value
    });

    // Give modal time to save + close
    setTimeout(async () => {
      await renderNodeBookmarks();
      await renderSCIDBookmarks();
    }, 200);
  }

  // ---------- Tabs ----------
  function renderTabs() {
    tabsContainer.innerHTML = "";
    tabs.forEach(tab => {
      const el = document.createElement("div");
      el.className = "tab" + (tab.id === activeTabId ? " active" : "");
      el.dataset.tabId = tab.id;
      el.innerHTML = `
        <span class="tab-title">${tab.title || "blank"}</span>
        <button class="close">✕</button>
      `;

      el.onclick = (e) => {
        if (!e.target.classList.contains("close")) activateTab(tab.id);
      };

      el.querySelector(".close").onclick = (e) => {
        e.stopPropagation();
        closeTab(tab.id);
      };

      tabsContainer.appendChild(el);
    });
  }

  async function activateTab(id) {
    activeTabId = id;
    renderTabs();
    hideManagers();
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;

    const viewId = tab.serverId || tab.id; // SCID tab uses serverId, blank uses tab id
    window.electronAPI.switchToTab(viewId);
  }

  async function closeTab(id) {
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;

    if (tab.serverId) {
      await api.closeTelaTab({ tabId: tab.serverId, scid: tab.scid });
    }

    tabs = tabs.filter(t => t.id !== id);

    if (activeTabId === id) {
      if (tabs.length) activateTab(tabs[tabs.length - 1].id);
      else createBlankTab();
    } else renderTabs();
  }

  async function createBlankTab() {
    const id = crypto.randomUUID();
    const tab = {
      id,
      scid: null,
      node: null,
      serverId: null,
      title: "Start Page"
    };

    tabs.push(tab);
    activeTabId = id;
    renderTabs();
    hideManagers();

    const { id: serverId } = await api.startTela(null, null);
    tab.serverId = serverId;

    window.electronAPI.switchToTab(serverId);
    return tab;
  }


  async function createTabWithSCID(node, scid) {
    const id = crypto.randomUUID();
    const tab = { id, scid, node, serverId: null, title: scid };
    tabs.push(tab);
    activateTab(id);

    try {
      const { id: serverId } = await api.startTela(node, scid);
      tab.serverId = serverId;
    } catch (err) {
      console.error("Failed to start Tela:", err);
      alert("Failed to start SCID server");
      tabs = tabs.filter(t => t.id !== id);
      if (!tabs.length) createBlankTab();
      else activateTab(tabs[0].id);
    }
  }

  // ---------- Event Handlers ----------
  saveNodeBtn.onclick = async () => {
    const value = nodeInput.value.trim();
    if (!value) return alert("Enter Node");
    await openBookmarkModal("node", value);
  };

  saveSCIDBtn.onclick = async () => {
    const value = scidInput.value.trim();
    if (!value) return alert("Enter SCID");
    await openBookmarkModal("scid", value);
  };

  loadTelaBtn.onclick = async () => {
    const node = nodeInput.value.trim();
    const scid = scidInput.value.trim();
    if (!node || !scid) return alert("Enter Node + SCID");

    const current = tabs.find(t => t.id === activeTabId);
    if (current && current.serverId) {
      await api.closeTelaTab({ tabId: current.serverId, scid: current.scid });
      current.serverId = null;
      current.scid = null;
    }

    if (current && !current.serverId && !current.scid) {
      current.scid = scid;
      current.node = node;
      current.title = scid;
      renderTabs();

      try {
        const { id: serverId } = await api.startTela(node, scid);
        current.serverId = serverId;
      } catch (err) {
        console.error(err);
        current.scid = null;
        current.node = null;
        current.title = "Start Page";
        renderTabs();
      }
    } else {
      await createTabWithSCID(node, scid);
    }
  };
  // -------------------------------------------------------
  applyNodeBtn.onclick = async () => {
  const node = nodeInput.value.trim();
  if (!node) {
    alert("Enter a node address");
    return;
  }

  const res = await window.electronAPI.applyGnomonNode(node);

  if (!res.ok) {
    alert(res.error || "Failed to apply node");
    return;
  }

  alert(`Gnomon node set to ${res.node}`);
  };

  // ------------------------------------------------------

  newTabBtn.onclick = () => createBlankTab();

  sidebarToggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    api.sendSidebarToggle(sidebar.classList.contains("collapsed"));
  });

  api.onBookmarksUpdated(async () => {
    await renderNodeBookmarks();
    await renderSCIDBookmarks();
  });

  // ---------- Init ----------
  createBlankTab();
  renderNodeBookmarks();
  renderSCIDBookmarks();
});
