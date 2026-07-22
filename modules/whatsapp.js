// ============================================================
// ContentHub — modules/whatsapp.js
// WhatsApp — QR Code scan (no API key needed)
// Groups: auto-fetched   |   Channels: auto-detected + manual paste
// ============================================================

import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'path';
import fs from 'fs';

const logger = pino({ level: 'silent' });

export default class WhatsAppModule {
  constructor(broadcast, sessionsDir) {
    this.broadcast = broadcast;
    this.sessionsDir = path.join(sessionsDir, 'whatsapp');
    this.channelsFile = path.join(this.sessionsDir, 'saved_channels.json');
    this.groupsFile = path.join(this.sessionsDir, 'saved_groups.json');
    this.sock = null;
    this.connected = false;
    this.connecting = false;
    this.reconnecting = false;
    this.wasEverOpen = false;
    this.phone = null;
    this.groups = [];
    this.channels = [];
    this.processingChannels = new Set();
    this.newsletterCheckDone = false;
    this.loadSavedData();
  }

  loadSavedData() {
    // Load channels
    try {
      if (fs.existsSync(this.channelsFile)) {
        const data = fs.readFileSync(this.channelsFile, 'utf8');
        this.channels = JSON.parse(data);
        // Ensure channels array is valid
        if (!Array.isArray(this.channels)) this.channels = [];
      }
    } catch (e) {
      this.channels = [];
    }

    // Load groups
    try {
      if (fs.existsSync(this.groupsFile)) {
        const data = fs.readFileSync(this.groupsFile, 'utf8');
        this.groups = JSON.parse(data);
        if (!Array.isArray(this.groups)) this.groups = [];
      }
    } catch (e) {
      this.groups = [];
    }
  }

  saveChannels() {
    try {
      if (!fs.existsSync(this.sessionsDir)) {
        fs.mkdirSync(this.sessionsDir, { recursive: true });
      }
      fs.writeFileSync(this.channelsFile, JSON.stringify(this.channels, null, 2));
    } catch (e) {
      console.error('[WA] Save channels error:', e.message);
    }
  }

  saveGroups() {
    try {
      if (!fs.existsSync(this.sessionsDir)) {
        fs.mkdirSync(this.sessionsDir, { recursive: true });
      }
      fs.writeFileSync(this.groupsFile, JSON.stringify(this.groups, null, 2));
    } catch (e) {
      console.error('[WA] Save groups error:', e.message);
    }
  }

  getStatus() {
    return {
      connected: this.connected,
      connecting: this.connecting || this.reconnecting,
      phone: this.phone,
      groupCount: this.groups.length,
      channelCount: this.channels.length,
      totalMembers: this.groups.reduce((s, g) => s + (g.memberCount || 0), 0),
      totalSubscribers: this.channels.reduce((s, c) => s + (c.memberCount || 0), 0)
    };
  }

  async connect() {
    if (this.connected && this.sock) return;
    if (this.connecting || this.reconnecting) return;

    this.connecting = true;
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }

    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners();
        this.sock.end(undefined);
      } catch (e) {}
      this.sock = null;
    }

    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.sessionsDir);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: ['ContentHub', 'Chrome', '3.0'],
        markOnlineOnConnect: false,
        syncFullHistory: true
      });

      this.sock = sock;
      sock.ev.on('creds.update', async (creds) => {
        try {
          await saveCreds(creds);
        } catch (e) {
          console.error('[WA] Save creds error:', e.message);
        }
      });

      // ── Auto-detect Channels from chat sync ─────────────────
      sock.ev.on('chats.set', ({ chats }) => {
        // Look for newsletter chats
        const newsletters = chats.filter(c => c.id && c.id.endsWith('@newsletter'));
        if (newsletters.length > 0) {
          console.log(`[WA] Auto-detected ${newsletters.length} channel(s) from sync`);
          for (const chat of newsletters) {
            this.addChannelFromChat(chat);
          }
        }
      });

      // Listen for new chats (including newsletters)
      sock.ev.on('chats.upsert', (chats) => {
        const newsletters = chats.filter(c => c.id && c.id.endsWith('@newsletter'));
        if (newsletters.length > 0) {
          console.log(`[WA] Detected ${newsletters.length} new channel(s)`);
          for (const chat of newsletters) {
            this.addChannelFromChat(chat);
          }
        }
      });

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const qrDataUrl = await QRCode.toDataURL(qr, {
              width: 300, margin: 2,
              color: { dark: '#000000', light: '#FFFFFF' }
            });
            this.broadcast({ type: 'wa_qr', qr: qrDataUrl });
          } catch (e) {
            console.error('[WA] QR error:', e.message);
          }
        }

        if (connection === 'close') {
          this.connected = false;
          this.connecting = false;
          this.phone = null;

          const statusCode = lastDisconnect?.error?.output?.statusCode;
          console.log(`[WA] Connection closed. Status: ${statusCode || 'unknown'}, Error: ${lastDisconnect?.error?.message || 'closed'}`);

          this.broadcast({ type: 'wa_disconnected', reason: 'closed' });

          const credsExists = fs.existsSync(path.join(this.sessionsDir, 'creds.json'));
          const shouldReconnect = credsExists && (
            statusCode === DisconnectReason.restartRequired ||
            statusCode === DisconnectReason.connectionClosed ||
            statusCode === DisconnectReason.connectionLost ||
            statusCode === DisconnectReason.timedOut ||
            statusCode === 515 ||
            !statusCode ||
            this.wasEverOpen
          );

          if (shouldReconnect && !this.reconnecting) {
            this.reconnecting = true;
            const delay = (statusCode === DisconnectReason.restartRequired || statusCode === 515) ? 1500 : 4000;
            console.log(`[WA] Session preserved on disk. Reconnecting in ${delay}ms…`);
            setTimeout(() => {
              this.reconnecting = false;
              this.connect();
            }, delay);
          }
        }

        if (connection === 'open') {
          this.connected = true;
          this.connecting = false;
          this.reconnecting = false;
          this.wasEverOpen = true;

          const user = sock.user;
          this.phone = user?.id ? user.id.split(':')[0].split('@')[0] : 'Unknown';
          this.newsletterCheckDone = false;
          console.log(`[WA] Connected successfully to WhatsApp (+${this.phone})`);
          this.broadcast({ type: 'wa_connected', phone: this.phone });
          
          // Load groups and channels after connection
          setTimeout(async () => {
            await this.loadGroups();
            await this.discoverChannels();
          }, 3000);
        }
      });
    } catch (err) {
      this.connecting = false;
      this.connected = false;
      console.error('[WA] Connection error:', err.message);
    }
  }

  addChannelFromChat(chat) {
    if (!chat || !chat.id) return;
    
    const channelId = chat.id;
    if (this.processingChannels.has(channelId)) return;
    this.processingChannels.add(channelId);

    const existingIdx = this.channels.findIndex(c => c.id === channelId);
    
    // Extract name from various possible fields
    const name = chat.name || chat.subject || chat.title || 'Unnamed Channel';
    const memberCount = chat.subscribers || chat.subscriberCount || chat.metadata?.subscriberCount || 0;
    const description = chat.description || chat.desc || chat.metadata?.description || '';

    const channelInfo = {
      id: channelId,
      name: name,
      type: 'channel',
      memberCount: memberCount,
      description: description,
      inviteCode: chat.inviteCode || null,
      created: chat.creationTime || chat.created || null,
      lastUpdated: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      // Update existing with new info
      this.channels[existingIdx] = { ...this.channels[existingIdx], ...channelInfo };
    } else {
      this.channels.push(channelInfo);
    }

    this.saveChannels();
    this.broadcast({ type: 'wa_channels', channels: this.channels });
    
    setTimeout(() => {
      this.processingChannels.delete(channelId);
    }, 1000);
  }

  // ── Groups ─────────────────────────────────────────────────
  async loadGroups() {
    if (!this.sock || !this.connected) return;
    try {
      const groupsObj = await this.sock.groupFetchAllParticipating();
      const groups = Object.values(groupsObj).map(g => ({
        id: g.id,
        name: g.subject || 'Unnamed Group',
        type: 'group',
        memberCount: Array.isArray(g.participants) ? g.participants.length : 0,
        description: g.desc || '',
        isAdmin: g.owner ? true : false,
        created: g.creation || null
      }));
      
      // Sort by member count
      groups.sort((a, b) => b.memberCount - a.memberCount);
      this.groups = groups;
      this.saveGroups();
      this.broadcast({ type: 'wa_groups', groups: this.groups });
      return this.groups;
    } catch (err) {
      console.error('[WA] Load groups error:', err.message);
      return [];
    }
  }

  async getGroups() {
    if (!this.connected) return [];
    if (this.groups.length === 0) await this.loadGroups();
    return this.groups;
  }

  // ── Channels (Newsletters) ─────────────────────────────────
  async discoverChannels() {
    if (!this.sock || !this.connected) return;
    if (this.newsletterCheckDone) return;
    this.newsletterCheckDone = true;
    
    try {
      // Method 1: Try to get newsletters from the sock's newsletter store
      // Baileys stores newsletter info in the auth state
      if (this.sock.authState && this.sock.authState.creds) {
        const creds = this.sock.authState.creds;
        if (creds.newsletters) {
          const newsletters = Object.values(creds.newsletters);
          if (newsletters.length > 0) {
            console.log(`[WA] Found ${newsletters.length} newsletters in auth state`);
            for (const newsletter of newsletters) {
              const channelId = newsletter.id || newsletter.jid;
              if (channelId) {
                const channelInfo = {
                  id: channelId,
                  name: newsletter.name || newsletter.subject || 'Channel',
                  type: 'channel',
                  memberCount: newsletter.subscribers || 0,
                  description: newsletter.description || '',
                  inviteCode: newsletter.inviteCode || null,
                  created: newsletter.created || null
                };
                this.addChannelFromMetadata(channelInfo);
              }
            }
          }
        }
      }
      
      // Method 2: Try using newsletterMetadata with proper error handling
      if (typeof this.sock.newsletterMetadata === 'function') {
        try {
          // Try with a valid invite code or JID if we have one from saved channels
          if (this.channels.length > 0) {
            for (const channel of this.channels) {
              try {
                if (channel.inviteCode) {
                  const metadata = await this.sock.newsletterMetadata('invite', channel.inviteCode);
                  if (metadata && metadata.id) {
                    this.addChannelFromMetadata(metadata);
                  }
                } else if (channel.id) {
                  const metadata = await this.sock.newsletterMetadata('jid', channel.id);
                  if (metadata && metadata.id) {
                    this.addChannelFromMetadata(metadata);
                  }
                }
              } catch (e) {
                // Skip individual errors
              }
            }
          }
        } catch (e) {
          // Silent fail - newsletter API might not be available
          console.log('[WA] Newsletter metadata API not available or limited');
        }
      }
      
      // Method 3: Check if we have any saved channels and broadcast them
      if (this.channels.length > 0) {
        console.log(`[WA] Broadcasting ${this.channels.length} saved channels`);
        this.broadcast({ type: 'wa_channels', channels: this.channels });
      } else {
        // No channels found - broadcast empty array
        this.broadcast({ type: 'wa_channels', channels: [] });
      }
      
    } catch (err) {
      console.error('[WA] Discover channels error:', err.message);
      // Broadcast current channels even if discovery fails
      this.broadcast({ type: 'wa_channels', channels: this.channels });
    }
  }

  addChannelFromMetadata(metadata) {
    if (!metadata) return;
    
    const channelId = metadata.id || metadata.jid;
    if (!channelId) return;
    
    if (this.processingChannels.has(channelId)) return;
    this.processingChannels.add(channelId);

    const existingIdx = this.channels.findIndex(c => c.id === channelId);
    const channelInfo = {
      id: channelId,
      name: metadata.name || metadata.subject || 'Channel',
      type: 'channel',
      memberCount: metadata.subscribers || metadata.subscriberCount || 0,
      description: metadata.description || '',
      inviteCode: metadata.inviteCode || null,
      created: metadata.created || metadata.creationTime || null,
      lastUpdated: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      this.channels[existingIdx] = { ...this.channels[existingIdx], ...channelInfo };
    } else {
      this.channels.push(channelInfo);
    }

    this.saveChannels();
    this.broadcast({ type: 'wa_channels', channels: this.channels });
    
    setTimeout(() => {
      this.processingChannels.delete(channelId);
    }, 1000);
  }

  /**
   * Add a channel by pasting its WhatsApp invite link.
   * Resolves actual newsletter JID (numeric@newsletter) via Baileys metadata.
   */
  async addChannel(input) {
    if (!this.sock || !this.connected) throw new Error('WhatsApp not connected. Reconnect first.');

    input = (input || '').trim();
    let inviteCode = null;
    let rawJid = null;

    // Clean up link if user copied full URL with parameters
    const urlMatch = input.match(/channel\/([A-Za-z0-9_-]+)/);
    if (urlMatch) {
      inviteCode = urlMatch[1];
    } else if (input.endsWith('@newsletter')) {
      rawJid = input;
    } else if (/^[A-Za-z0-9_-]{8,}$/.test(input)) {
      inviteCode = input;
    } else {
      throw new Error(
        'Invalid link format. Please paste your full WhatsApp channel invite link:\n' +
        'e.g. https://whatsapp.com/channel/0029Va...'
      );
    }

    let metadata = null;
    let realJid = null;

    try {
      // Try to resolve using invite code
      if (inviteCode && typeof this.sock.newsletterMetadata === 'function') {
        try {
          metadata = await this.sock.newsletterMetadata('invite', inviteCode);
          realJid = metadata?.id;
        } catch (e) {
          console.log('[WA] Could not resolve by invite, trying as JID...');
        }
      }
      
      // Try raw JID
      if (!realJid && rawJid && typeof this.sock.newsletterMetadata === 'function') {
        try {
          metadata = await this.sock.newsletterMetadata('jid', rawJid);
          realJid = metadata?.id || rawJid;
        } catch (e) {
          console.log('[WA] Could not resolve by JID');
        }
      }

      // Fallback: use invite code as JID
      if (!realJid && inviteCode) {
        realJid = inviteCode + '@newsletter';
      }
      
      if (!realJid) {
        throw new Error('Could not resolve WhatsApp channel. Please check the link.');
      }
    } catch (e) {
      throw new Error(`Failed to resolve channel: ${e.message}`);
    }

    const channelName = metadata?.name || metadata?.thread_metadata?.name?.text || 
                        metadata?.subject || ('Channel ' + realJid.split('@')[0].substring(0, 10) + '…');
    const memberCount = parseInt(metadata?.subscribers || metadata?.thread_metadata?.subscribers_count || 0, 10);

    const channelInfo = {
      id: realJid,
      name: channelName,
      type: 'channel',
      memberCount: memberCount || 0,
      description: metadata?.description || metadata?.thread_metadata?.description?.text || '',
      inviteCode: inviteCode || null,
      created: metadata?.creationTime || null,
      lastUpdated: new Date().toISOString()
    };

    const existingIdx = this.channels.findIndex(c => c.id === realJid);
    if (existingIdx >= 0) {
      this.channels[existingIdx] = { ...this.channels[existingIdx], ...channelInfo };
    } else {
      this.channels.push(channelInfo);
    }

    this.saveChannels();
    this.broadcast({ type: 'wa_channels', channels: this.channels });
    return channelInfo;
  }

  removeChannel(jid) {
    this.channels = this.channels.filter(c => c.id !== jid);
    this.saveChannels();
    this.broadcast({ type: 'wa_channels', channels: this.channels });
  }

  async getChannels() {
    if (this.connected && !this.newsletterCheckDone) {
      await this.discoverChannels();
    }
    return this.channels;
  }

  async getAnalytics() {
    if (!this.connected) return null;
    await this.loadGroups();
    await this.discoverChannels();
    return {
      phone: this.phone,
      groupCount: this.groups.length,
      channelCount: this.channels.length,
      totalMembers: this.groups.reduce((s, g) => s + (g.memberCount || 0), 0),
      totalSubscribers: this.channels.reduce((s, c) => s + (c.memberCount || 0), 0),
      groups: this.groups,
      channels: this.channels
    };
  }

  async sendMedia(jid, filePath, fileName, mimetype, caption = '') {
    if (!this.connected || !this.sock) throw new Error('WhatsApp not connected');
    if (!fs.existsSync(filePath)) throw new Error('File not found: ' + filePath);

    let content;
    const isChannel = jid.endsWith('@newsletter');

    // Read file as buffer
    const buffer = fs.readFileSync(filePath);

    if (mimetype.startsWith('image/')) {
      content = { image: buffer, caption };
    } else if (mimetype.startsWith('video/')) {
      content = { video: buffer, caption, mimetype };
    } else {
      content = { document: buffer, fileName, mimetype, caption };
    }

    try {
      await this.sock.sendMessage(jid, content);
      return { success: true };
    } catch (err) {
      throw new Error(`WhatsApp upload failed: ${err.message}`);
    }
  }

  async sendText(jid, text) {
    if (!this.connected || !this.sock) throw new Error('WhatsApp not connected');
    try {
      await this.sock.sendMessage(jid, { text });
      return { success: true };
    } catch (err) {
      throw new Error(`WhatsApp send failed: ${err.message}`);
    }
  }

  async disconnect() {
    try { if (this.sock) await this.sock.logout(); } catch (e) {}
    this.sock = null;
    this.connected = false;
    this.phone = null;
    this.groups = [];
    this.channels = [];
    this.processingChannels = new Set();
    this.newsletterCheckDone = false;
    try {
      if (fs.existsSync(this.sessionsDir)) {
        const files = fs.readdirSync(this.sessionsDir);
        for (const f of files) {
          if (f !== 'saved_channels.json' && f !== 'saved_groups.json') {
            fs.rmSync(path.join(this.sessionsDir, f), { recursive: true, force: true });
          }
        }
      }
    } catch (e) {}
  }
}
