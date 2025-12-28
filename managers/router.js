import { managers } from "./index.js";

const root = document.getElementById("managerRoot");
const instances = {};
let active = null;

// Show one manager
export function showManager(id) {
  hideManagers();

  if (!instances[id]) {
    const el = managers[id].create();
    el.classList.add("manager-page");
    root.appendChild(el);
    instances[id] = el;
  }

  instances[id].classList.remove("hidden");
  active = id;

  // Hide BrowserViews
  window.electronAPI?.hideAllBrowserViews?.();
}

// Hide all managers
export function hideManagers() {
  Object.values(instances).forEach(el => {
    el.classList.add("hidden");
  });
  active = null;
}
