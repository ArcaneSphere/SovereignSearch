import { createSettingsManager } from './settings.js';
import { createGnomonManager } from './gnomon.js';
import { createWebTorrentManager } from './webtorrent.js';

export const managers = {
  settings: {
    create: createSettingsManager
  },
  gnomon: {
    create: createGnomonManager
  },
  webtorrent: {
    create: createWebTorrentManager
  }
};

