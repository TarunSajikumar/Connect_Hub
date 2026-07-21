// ============================================================
// ContentHub — modules/history.js
// Persistent Target Connection History Manager
// Tracks previously connected/selected WhatsApp & Telegram targets
// ============================================================

import path from 'path';
import fs from 'fs';

export default class HistoryManager {
  constructor(sessionsDir) {
    this.historyFile = path.join(sessionsDir, 'target_history.json');
    this.history = {
      whatsapp: [],
      telegram: []
    };
    this.loadHistory();
  }

  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = fs.readFileSync(this.historyFile, 'utf8');
        const parsed = JSON.parse(data);
        this.history.whatsapp = Array.isArray(parsed.whatsapp) ? parsed.whatsapp : [];
        this.history.telegram = Array.isArray(parsed.telegram) ? parsed.telegram : [];
      }
    } catch (e) {
      this.history = { whatsapp: [], telegram: [] };
    }
  }

  saveHistory() {
    try {
      const dir = path.dirname(this.historyFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.historyFile, JSON.stringify(this.history, null, 2));
    } catch (e) {
      console.error('[HistoryManager] Save error:', e.message);
    }
  }

  // Record an array or single item into history
  recordTargets(platform, targets) {
    if (!this.history[platform]) this.history[platform] = [];
    const list = Array.isArray(targets) ? targets : [targets];
    const now = new Date().toISOString();

    list.forEach(item => {
      if (!item || !item.id) return;
      const existingIdx = this.history[platform].findIndex(h => String(h.id) === String(item.id));
      const entry = {
        id: String(item.id),
        name: item.name || String(item.id),
        type: item.type || 'group',
        memberCount: item.memberCount || 0,
        lastConnected: now
      };

      if (existingIdx >= 0) {
        // Update existing entry while preserving newest member count
        this.history[platform][existingIdx] = {
          ...this.history[platform][existingIdx],
          ...entry,
          memberCount: item.memberCount || this.history[platform][existingIdx].memberCount
        };
      } else {
        // Push new entry
        this.history[platform].push(entry);
      }
    });

    // Sort by lastConnected desc
    this.history[platform].sort((a, b) => new Date(b.lastConnected) - new Date(a.lastConnected));
    this.saveHistory();
  }

  getHistory(platform) {
    return this.history[platform] || [];
  }

  getAllHistory() {
    return this.history;
  }

  removeTarget(platform, id) {
    if (!this.history[platform]) return;
    this.history[platform] = this.history[platform].filter(h => String(h.id) !== String(id));
    this.saveHistory();
  }

  clearPlatformHistory(platform) {
    if (this.history[platform]) {
      this.history[platform] = [];
      this.saveHistory();
    }
  }
}
