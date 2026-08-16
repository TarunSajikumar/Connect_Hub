// ============================================================
// SOCIAL HUB — modules/whatsapp_openwa.js
// OpenWA WhatsApp Gateway Client (rmyndharis/OpenWA Integration)
// Supports: Multi-session, QR & Pairing Code, Groups, Channels, Media Dispatch
// ============================================================

import path from 'path';
import fs from 'fs';

export default class WhatsAppOpenWA {
  constructor(broadcast = () => {}, sessionsDir = path.join(process.cwd(), 'sessions'), options = {}) {
    this.broadcast = broadcast;
    this.sessionsDir = path.join(sessionsDir, 'openwa');
    this.channelsFile = path.join(this.sessionsDir, 'saved_channels.json');
    this.groupsFile = path.join(this.sessionsDir, 'saved_groups.json');
    this.configFile = path.join(this.sessionsDir, 'openwa_config.json');

    // Gateway Configuration
    this.apiUrl = this._normalizeApiUrl(options.apiUrl || process.env.OPENWA_API_URL || 'http://localhost:2785/api');
    this.apiKey = options.apiKey || process.env.OPENWA_API_KEY || '';
    this.sessionName = this._sanitizeSessionName(options.sessionName || process.env.OPENWA_SESSION_NAME || 'social-hub');
    this.engine = options.engine || 'WHATSAPP_WEB_CACHE'; // 'WHATSAPP_WEB_CACHE' or 'BAILEYS'

    // Runtime State
    this.sessionId = null;
    this.connected = false;
    this.connecting = false;
    this.reconnecting = false;
    this.currentQR = null;
    this.pairingCode = null;
    this.phone = null;
    this.pushName = null;
    this.groups = [];
    this.channels = [];
    this.lastError = null;
    this.gatewayOnline = false;

    // Timers
    this.qrPollTimer = null;
    this.statusCheckTimer = null;

    this._ensureDir();
    this.loadSavedData();
  }

  _normalizeApiUrl(url) {
    let clean = (url || 'http://localhost:2785/api').trim().replace(/\/+$/, '');
    if (!clean.endsWith('/api') && !clean.includes('/api/')) {
      clean = `${clean}/api`;
    }
    return clean;
  }

  _sanitizeSessionName(name) {
    return (name || 'social-hub').trim().replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 50) || 'social-hub';
  }

  _ensureDir() {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  loadSavedData() {
    try {
      if (fs.existsSync(this.configFile)) {
        const cfg = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        this.sessionId = cfg.sessionId || null;
        this.phone = cfg.phone || null;
        this.pushName = cfg.pushName || null;
        if (cfg.apiUrl) this.apiUrl = this._normalizeApiUrl(cfg.apiUrl);
        if (cfg.apiKey) this.apiKey = cfg.apiKey;
        if (cfg.sessionName) this.sessionName = this._sanitizeSessionName(cfg.sessionName);
      }
    } catch (e) {
      console.warn('[OpenWA] Error loading config:', e.message);
    }

    try {
      if (fs.existsSync(this.channelsFile)) {
        const data = JSON.parse(fs.readFileSync(this.channelsFile, 'utf8'));
        this.channels = Array.isArray(data) ? data : [];
      }
    } catch (e) {
      this.channels = [];
    }

    try {
      if (fs.existsSync(this.groupsFile)) {
        const data = JSON.parse(fs.readFileSync(this.groupsFile, 'utf8'));
        this.groups = Array.isArray(data) ? data : [];
      }
    } catch (e) {
      this.groups = [];
    }
  }

  saveConfig() {
    try {
      this._ensureDir();
      fs.writeFileSync(this.configFile, JSON.stringify({
        sessionId: this.sessionId,
        phone: this.phone,
        pushName: this.pushName,
        apiUrl: this.apiUrl,
        apiKey: this.apiKey,
        sessionName: this.sessionName,
        lastUpdated: new Date().toISOString()
      }, null, 2));
    } catch (e) {
      console.error('[OpenWA] Save config error:', e.message);
    }
  }

  saveChannels() {
    try {
      this._ensureDir();
      fs.writeFileSync(this.channelsFile, JSON.stringify(this.channels, null, 2));
    } catch (e) {}
  }

  saveGroups() {
    try {
      this._ensureDir();
      fs.writeFileSync(this.groupsFile, JSON.stringify(this.groups, null, 2));
    } catch (e) {}
  }

  updateConfig({ apiUrl, apiKey, sessionName }) {
    if (apiUrl) this.apiUrl = this._normalizeApiUrl(apiUrl);
    if (apiKey !== undefined) this.apiKey = apiKey.trim();
    if (sessionName) this.sessionName = this._sanitizeSessionName(sessionName);
    this.saveConfig();
  }

  getStatus() {
    return {
      connected: this.connected,
      connecting: this.connecting || this.reconnecting,
      phone: this.phone,
      pushName: this.pushName,
      groupCount: this.groups.length,
      channelCount: this.channels.length,
      totalMembers: this.groups.reduce((s, g) => s + (g.memberCount || 0), 0),
      totalSubscribers: this.channels.reduce((s, c) => s + (c.memberCount || 0), 0),
      engine: 'openwa',
      gatewayOnline: this.gatewayOnline,
      apiUrl: this.apiUrl,
      sessionId: this.sessionId,
      sessionName: this.sessionName,
      pairingCode: this.pairingCode
    };
  }

  /**
   * Universal HTTP Request Helper for OpenWA Gateway
   */
  async _request(method, endpoint, body = null, timeoutMs = 25000) {
    const url = `${this.apiUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const options = {
        method,
        headers,
        signal: controller.signal
      };

      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
      }

      const res = await fetch(url, options);
      clearTimeout(timeout);

      const contentType = res.headers.get('content-type') || '';
      let data = null;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        try { data = JSON.parse(text); } catch { data = text; }
      }

      if (!res.ok) {
        const errorMsg = (data && (data.message || data.error)) || `HTTP Error ${res.status}: ${res.statusText}`;
        const err = new Error(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg);
        err.status = res.status;
        err.data = data;
        throw err;
      }

      this.gatewayOnline = true;
      return data;
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error(`OpenWA Gateway request timed out (${timeoutMs}ms) for ${method} ${endpoint}`);
      }
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.message?.includes('fetch failed')) {
        this.gatewayOnline = false;
        throw new Error(`OpenWA Gateway is offline or unreachable at ${this.apiUrl}. Please verify the OpenWA server is running.`);
      }
      throw err;
    }
  }

  /**
   * Check OpenWA Gateway Health
   */
  async healthCheck() {
    try {
      // Try /health or /sessions
      const health = await this._request('GET', '/health', null, 5000).catch(async () => {
        return await this._request('GET', '/sessions', null, 5000);
      });
      this.gatewayOnline = true;
      return { ok: true, data: health };
    } catch (err) {
      this.gatewayOnline = false;
      return { ok: false, error: err.message };
    }
  }

  /**
   * Find or Create OpenWA Session
   */
  async _ensureSession() {
    // 1. List existing sessions
    let sessions = [];
    try {
      const res = await this._request('GET', '/sessions');
      sessions = Array.isArray(res) ? res : (res.data || []);
    } catch (e) {
      // Could not list sessions
      throw e;
    }

    // Check if session with name exists
    const match = sessions.find(s => s.name === this.sessionName || s.id === this.sessionId);
    if (match) {
      this.sessionId = match.id;
      this.phone = match.phone || this.phone;
      this.pushName = match.pushName || this.pushName;
      this.saveConfig();
      return match;
    }

    // 2. Create new session
    console.log(`[OpenWA] Creating new WhatsApp session '${this.sessionName}' on gateway…`);
    const newSession = await this._request('POST', '/sessions', {
      name: this.sessionName,
      config: {
        autoRejectCalls: false,
        maxReconnectAttempts: 10,
        reconnectBaseDelay: 3000
      }
    });

    this.sessionId = newSession.id || newSession.sessionId;
    this.phone = newSession.phone || null;
    this.saveConfig();
    return newSession;
  }

  /**
   * Connect to WhatsApp via OpenWA
   */
  async connect(force = false) {
    if (this.connected && !force) {
      return { success: true, connected: true, phone: this.phone };
    }

    if (this.connecting && !force) {
      return { success: true, connecting: true, qr: this.currentQR };
    }

    this.connecting = true;
    this.lastError = null;
    this.currentQR = null;
    this.pairingCode = null;
    this.broadcast({ type: 'status', data: this.getStatus() });

    try {
      // 1. Ensure OpenWA session exists
      const session = await this._ensureSession();
      const status = session.status?.toLowerCase();

      // If already connected/ready on OpenWA
      if (status === 'connected' || status === 'ready' || status === 'authenticated') {
        this.connected = true;
        this.connecting = false;
        this.phone = session.phone || this.phone;
        this.pushName = session.pushName || this.pushName;
        this.saveConfig();

        // Refresh groups & channels in background
        this.getGroups().catch(() => {});
        this.getChannels().catch(() => {});

        this.broadcast({ type: 'wa_connected', phone: this.phone, name: this.pushName });
        this.broadcast({ type: 'status', data: this.getStatus() });
        return { success: true, connected: true, phone: this.phone };
      }

      // 2. Start session if not started
      if (status === 'disconnected' || status === 'stopped' || force) {
        try {
          console.log(`[OpenWA] Starting session ${this.sessionId}…`);
          await this._request('POST', `/sessions/${this.sessionId}/start`);
        } catch (startErr) {
          // Ignore if already started
          if (!startErr.message?.includes('already started')) {
            console.warn('[OpenWA] Start notice:', startErr.message);
          }
        }
      }

      // 3. Start Polling for QR Code and Connection State
      this._startQRAndStatusPolling();

      return {
        success: true,
        message: 'OpenWA session started. Scan the QR code or link with phone pairing code.',
        sessionId: this.sessionId
      };

    } catch (err) {
      this.connecting = false;
      this.lastError = err.message;
      this.broadcast({ type: 'status', data: this.getStatus() });
      console.error('[OpenWA] Connect error:', err.message);
      throw err;
    }
  }

  /**
   * QR & Status Polling Engine
   */
  _startQRAndStatusPolling() {
    if (this.qrPollTimer) clearInterval(this.qrPollTimer);

    let attempts = 0;
    const maxAttempts = 60; // Poll for 2 minutes (2s intervals)

    this.qrPollTimer = setInterval(async () => {
      attempts++;

      if (attempts > maxAttempts || !this.connecting) {
        clearInterval(this.qrPollTimer);
        this.qrPollTimer = null;
        if (!this.connected) {
          this.connecting = false;
          this.broadcast({ type: 'status', data: this.getStatus() });
        }
        return;
      }

      try {
        // 1. Check session status
        const sess = await this._request('GET', `/sessions/${this.sessionId}`);
        const st = (sess.status || '').toLowerCase();

        if (st === 'connected' || st === 'ready' || st === 'authenticated') {
          clearInterval(this.qrPollTimer);
          this.qrPollTimer = null;
          this.connected = true;
          this.connecting = false;
          this.currentQR = null;
          this.phone = sess.phone || this.phone;
          this.pushName = sess.pushName || this.pushName;
          this.saveConfig();

          console.log(`[OpenWA] WhatsApp Connected! Phone: +${this.phone || 'linked'}`);

          // Fetch targets
          await this.getGroups().catch(() => {});
          await this.getChannels().catch(() => {});

          this.broadcast({ type: 'wa_connected', phone: this.phone, name: this.pushName });
          this.broadcast({ type: 'status', data: this.getStatus() });
          return;
        }

        // 2. Poll QR Code
        try {
          const qrRes = await this._request('GET', `/sessions/${this.sessionId}/qr`, null, 4000);
          if (qrRes && qrRes.qrCode) {
            let qrData = qrRes.qrCode;
            // If raw base64 without data URI prefix, add it
            if (!qrData.startsWith('data:')) {
              qrData = `data:image/png;base64,${qrData}`;
            }

            if (qrData !== this.currentQR) {
              this.currentQR = qrData;
              this.broadcast({ type: 'wa_qr', qr: this.currentQR });
            }
          }
        } catch (qrErr) {
          // QR might not be ready yet
        }

      } catch (err) {
        console.warn(`[OpenWA] Polling warning (${attempts}):`, err.message);
      }
    }, 2000);
  }

  /**
   * Request Phone Number Pairing Code (OpenWA 8-digit linking feature)
   */
  async requestPairingCode(phoneNumber) {
    if (!phoneNumber) throw new Error('Phone number is required for pairing code');
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');

    await this.connect();

    try {
      const res = await this._request('POST', `/sessions/${this.sessionId}/pairing-code`, {
        phoneNumber: cleanNumber
      });

      const code = res.code || res.pairingCode || res;
      this.pairingCode = String(code);
      this.broadcast({ type: 'wa_pairing_code', code: this.pairingCode });
      return { success: true, code: this.pairingCode };
    } catch (err) {
      console.error('[OpenWA] Pairing code error:', err.message);
      throw err;
    }
  }

  /**
   * Disconnect & Stop WhatsApp Session
   */
  async disconnect() {
    if (this.qrPollTimer) {
      clearInterval(this.qrPollTimer);
      this.qrPollTimer = null;
    }

    if (this.sessionId) {
      try {
        console.log(`[OpenWA] Stopping session ${this.sessionId}…`);
        await this._request('POST', `/sessions/${this.sessionId}/stop`).catch(() => {});
      } catch (e) {}
    }

    this.connected = false;
    this.connecting = false;
    this.reconnecting = false;
    this.currentQR = null;
    this.pairingCode = null;
    this.saveConfig();

    this.broadcast({ type: 'wa_disconnected' });
    this.broadcast({ type: 'status', data: this.getStatus() });
    return { success: true };
  }

  /**
   * Log out completely from WhatsApp (unlinks device)
   */
  async logout() {
    if (this.sessionId) {
      try {
        await this._request('POST', `/sessions/${this.sessionId}/logout`).catch(() => {});
      } catch (e) {}
    }
    return this.disconnect();
  }

  /**
   * Fetch All WhatsApp Groups from OpenWA
   */
  async getGroups() {
    if (!this.sessionId) return this.groups;

    try {
      const groupsData = await this._request('GET', `/sessions/${this.sessionId}/groups`);
      const rawGroups = Array.isArray(groupsData) ? groupsData : (groupsData.data || []);

      this.groups = rawGroups.map(g => ({
        id: g.id || g.groupId || g.jid,
        name: g.name || g.subject || 'Unnamed Group',
        memberCount: g.participantCount || g.memberCount || (g.participants ? g.participants.length : 0) || 0,
        linkedParentJID: g.linkedParentJID || null,
        description: g.description || ''
      })).filter(g => g.id && g.id.includes('@'));

      this.saveGroups();
      return this.groups;
    } catch (err) {
      console.warn('[OpenWA] getGroups warning:', err.message);
      return this.groups;
    }
  }

  /**
   * Fetch Subscribed WhatsApp Channels (Newsletters) from OpenWA
   */
  async getChannels() {
    if (!this.sessionId) return this.channels;

    try {
      const channelsData = await this._request('GET', `/sessions/${this.sessionId}/channels`);
      const rawChannels = Array.isArray(channelsData) ? channelsData : (channelsData.data || []);

      const fetchedChannels = rawChannels.map(c => ({
        id: c.id || c.channelId || c.jid,
        name: c.name || 'Unnamed Channel',
        memberCount: c.subscriberCount || c.memberCount || 0,
        description: c.description || '',
        verified: !!c.verified,
        role: c.role || 'SUBSCRIBER'
      })).filter(c => c.id && c.id.includes('@'));

      // Merge with manually added channels
      const map = new Map();
      this.channels.forEach(c => map.set(c.id, c));
      fetchedChannels.forEach(c => map.set(c.id, { ...(map.get(c.id) || {}), ...c }));

      this.channels = Array.from(map.values());
      this.saveChannels();
      return this.channels;
    } catch (err) {
      console.warn('[OpenWA] getChannels warning:', err.message);
      return this.channels;
    }
  }

  /**
   * Add / Track a Channel by link or ID
   */
  async addChannel(input) {
    if (!input || !input.trim()) throw new Error('Channel link or ID is required');
    const cleanInput = input.trim();

    // Create entry
    const jid = cleanInput.includes('@') ? cleanInput : `${cleanInput.replace(/^https?:\/\/whatsapp\.com\/channel\//i, '')}@newsletter`;
    const channelName = cleanInput.includes('/') ? `Channel (${cleanInput.split('/').pop().slice(0, 10)})` : cleanInput;

    const channel = {
      id: jid,
      name: channelName,
      memberCount: 0,
      description: 'Manually added channel'
    };

    // Remove existing if any, then prepend
    this.channels = this.channels.filter(c => c.id !== jid);
    this.channels.unshift(channel);
    this.saveChannels();

    return channel;
  }

  /**
   * Remove Channel
   */
  removeChannel(jid) {
    this.channels = this.channels.filter(c => c.id !== jid);
    this.saveChannels();
    return true;
  }

  /**
   * Send Text Message
   */
  async sendText(chatId, text) {
    if (!this.sessionId) throw new Error('WhatsApp session is not active');
    if (!chatId || !text) throw new Error('chatId and text are required');

    return await this._request('POST', `/sessions/${this.sessionId}/messages/send-text`, {
      chatId: this._formatChatId(chatId),
      text
    });
  }

  /**
   * Send Media Message (Images, Videos, Audio, Documents)
   */
  async sendMedia(targetJid, filePath, originalName, mimeType, caption = '') {
    if (!this.sessionId) throw new Error('WhatsApp session is not active');
    if (!fs.existsSync(filePath)) throw new Error(`Media file not found at path: ${filePath}`);

    const chatId = this._formatChatId(targetJid);
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString('base64');
    const detectedMime = mimeType || this._detectMime(filePath);
    const filename = originalName || path.basename(filePath);

    const payload = {
      chatId,
      base64,
      mimetype: detectedMime,
      filename,
      caption: caption || ''
    };

    console.log(`[OpenWA] Sending media (${detectedMime}, ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB) to ${chatId}…`);

    // Route by media type to official OpenWA endpoints
    if (detectedMime.startsWith('image/')) {
      return await this._request('POST', `/sessions/${this.sessionId}/messages/send-image`, payload, 60000);
    } else if (detectedMime.startsWith('video/')) {
      return await this._request('POST', `/sessions/${this.sessionId}/messages/send-video`, payload, 120000);
    } else if (detectedMime.startsWith('audio/')) {
      return await this._request('POST', `/sessions/${this.sessionId}/messages/send-audio`, {
        chatId,
        base64,
        mimetype: detectedMime
      }, 60000);
    } else {
      return await this._request('POST', `/sessions/${this.sessionId}/messages/send-document`, payload, 90000);
    }
  }

  _detectMime(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.mkv': 'video/x-matroska',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.ogg': 'audio/ogg',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip'
    };
    return map[ext] || 'application/octet-stream';
  }

  _formatChatId(id) {
    let clean = id.trim();
    if (clean.includes('@')) return clean;
    if (clean.includes('-')) return `${clean}@g.us`;
    return `${clean}@c.us`;
  }

  /**
   * Analytics
   */
  async getAnalytics() {
    return {
      connected: this.connected,
      engine: 'OpenWA Gateway',
      apiUrl: this.apiUrl,
      sessionName: this.sessionName,
      groupCount: this.groups.length,
      channelCount: this.channels.length,
      totalMembers: this.groups.reduce((s, g) => s + (g.memberCount || 0), 0),
      totalSubscribers: this.channels.reduce((s, c) => s + (c.memberCount || 0), 0),
      groups: this.groups,
      channels: this.channels
    };
  }
}
