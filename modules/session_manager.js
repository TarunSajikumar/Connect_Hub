// ============================================================
// SOCIAL HUB — modules/session_manager.js
// Persistent Session, OpenWA Gateway & Auto-Reconnect Manager
// ============================================================

import path from 'path';
import fs from 'fs';

export default class SessionManager {
  constructor(sessionsDir) {
    this.sessionsDir = sessionsDir;
    this.configFile = path.join(sessionsDir, 'session_config.json');
    this.config = {
      rememberMe: true,
      whatsappEngine: process.env.WHATSAPP_ENGINE || 'openwa', // 'openwa' | 'baileys'
      whatsapp: { autoConnect: true },
      telegram: { autoConnect: false, token: null },
      openwa: {
        url: process.env.OPENWA_API_URL || 'http://localhost:2785/api',
        apiKey: process.env.OPENWA_API_KEY || '',
        sessionName: process.env.OPENWA_SESSION_NAME || 'social-hub'
      }
    };
    this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf8');
        const parsed = JSON.parse(data);
        this.config = {
          ...this.config,
          ...parsed,
          openwa: { ...this.config.openwa, ...(parsed.openwa || {}) },
          whatsapp: { ...this.config.whatsapp, ...(parsed.whatsapp || {}) },
          telegram: { ...this.config.telegram, ...(parsed.telegram || {}) }
        };
        if (typeof this.config.rememberMe !== 'boolean') {
          this.config.rememberMe = true;
        }
      }
    } catch (e) {
      this.saveConfig();
    }
  }

  saveConfig() {
    try {
      if (!fs.existsSync(this.sessionsDir)) {
        fs.mkdirSync(this.sessionsDir, { recursive: true });
      }
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
    } catch (e) {
      console.error('[SessionManager] Save error:', e.message);
    }
  }

  getConfig() {
    return this.config;
  }

  setRememberMe(remember) {
    this.config.rememberMe = remember !== false;
    this.saveConfig();
  }

  setWhatsappEngine(engine) {
    this.config.whatsappEngine = engine === 'baileys' ? 'baileys' : 'openwa';
    this.saveConfig();
  }

  setWhatsappAutoConnect(autoConnect) {
    if (!this.config.whatsapp) this.config.whatsapp = {};
    this.config.whatsapp.autoConnect = !!autoConnect;
    this.saveConfig();
  }

  setTelegramAutoConnect(autoConnect, token = null) {
    if (!this.config.telegram) this.config.telegram = {};
    this.config.telegram.autoConnect = !!autoConnect;
    if (token !== null) {
      this.config.telegram.token = token;
    }
    this.saveConfig();
  }

  setOpenWaConfig({ url, apiKey, sessionName }) {
    if (!this.config.openwa) this.config.openwa = {};
    if (url !== undefined) this.config.openwa.url = url.trim().replace(/\/+$/, '');
    if (apiKey !== undefined) this.config.openwa.apiKey = apiKey.trim();
    if (sessionName !== undefined && sessionName.trim()) {
      // OpenWA session names must be alphanumeric and hyphens
      this.config.openwa.sessionName = sessionName.trim().replace(/[^a-zA-Z0-9-]/g, '-');
    }
    this.saveConfig();
  }

  clearWhatsappSession() {
    if (!this.config.whatsapp) this.config.whatsapp = {};
    this.config.whatsapp.autoConnect = false;
    this.saveConfig();
  }

  clearTelegramSession() {
    if (!this.config.telegram) this.config.telegram = {};
    this.config.telegram.autoConnect = false;
    this.config.telegram.token = null;
    this.saveConfig();
  }
}
