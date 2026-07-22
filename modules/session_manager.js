// ============================================================
// ContentHub — modules/session_manager.js
// Persistent Session & Auto-Reconnect Manager
// ============================================================

import path from 'path';
import fs from 'fs';

export default class SessionManager {
  constructor(sessionsDir) {
    this.sessionsDir = sessionsDir;
    this.configFile = path.join(sessionsDir, 'session_config.json');
    this.config = {
      rememberMe: true,
      whatsapp: { autoConnect: true },
      telegram: { autoConnect: false, token: null }
    };
    this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf8');
        const parsed = JSON.parse(data);
        this.config = { ...this.config, ...parsed };
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
