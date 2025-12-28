export function createWebTorrentManager() {
  const el = document.createElement('div');
  el.innerHTML = `
    <h2>WebTorrent Manager</h2>
    <input placeholder="Magnet link">
    <button>Add</button>
    <div id="torrentList"></div>
  `;
  return el;
}

