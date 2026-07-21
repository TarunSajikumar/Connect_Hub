// ============================================================
// ContentHub — modules/telegram.js
// Telegram bot integration — free token from @BotFather
// ============================================================

import TelegramBot from 'node-telegram-bot-api';
import fs, { createReadStream, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

// Suppress the annoying EFATAL polling error logs when polling is off
process.env.NTBA_FIX_319 = '1';
process.env.NTBA_FIX_350 = '1';

export default class TelegramModule {
  constructor(broadcast, sessionsDir) {
    this.broadcast = broadcast;
    this.sessionsDir = sessionsDir || path.join(process.cwd(), 'sessions');
    this.chatsFile = path.join(this.sessionsDir, 'tg_chats.json');
    this.bot = null;
    this.connected = false;
    this.botInfo = null;
    this.chats = [];
    this.token = null;
    this.processingChats = new Set(); // Prevent duplicate processing
    this.loadSavedChats();
  }

  loadSavedChats() {
    try {
      if (fs.existsSync(this.chatsFile)) {
        const data = fs.readFileSync(this.chatsFile, 'utf8');
        this.chats = JSON.parse(data);
        // Deduplicate on load
        this.deduplicateChats();
      }
    } catch (e) {
      this.chats = [];
    }
  }

  deduplicateChats() {
    const uniqueMap = new Map();
    this.chats.forEach(c => {
      if (c && c.id) {
        const id = String(c.id);
        if (!uniqueMap.has(id) || uniqueMap.get(id).memberCount < c.memberCount) {
          uniqueMap.set(id, { ...c, id });
        }
      }
    });
    this.chats = Array.from(uniqueMap.values());
  }

  saveChats() {
    this.deduplicateChats();
    try {
      if (!fs.existsSync(this.sessionsDir)) {
        fs.mkdirSync(this.sessionsDir, { recursive: true });
      }
      fs.writeFileSync(this.chatsFile, JSON.stringify(this.chats, null, 2));
    } catch (e) {
      console.error('[TG] Save chats error:', e.message);
    }
  }

  getStatus() {
    this.deduplicateChats();
    return {
      connected: this.connected,
      username: this.botInfo?.username ? '@' + this.botInfo.username : null,
      name: this.botInfo?.first_name || null,
      chatCount: this.chats.length,
      totalMembers: this.chats.reduce((s, c) => s + (c.memberCount || 0), 0)
    };
  }

  async connect(token) {
    // Clean up any previous bot
    if (this.bot) {
      try { this.bot.stopPolling(); } catch (e) {}
      this.bot = null;
    }

    // Validate token format before even trying
    if (!token || !token.includes(':') || token.length < 20) {
      throw new Error('Invalid token format. It should look like: 123456789:ABCdefGhIJKlmNoPQRsTUVwxYZ');
    }

    const bot = new TelegramBot(token, {
      polling: true,
      onlyFirstMatch: false
    });

    // Test the token by calling getMe()
    let me;
    try {
      me = await bot.getMe();
    } catch (err) {
      const msg = err?.response?.body || err?.message || 'Unknown error';
      if (msg.includes('401') || msg.includes('Unauthorized')) {
        throw new Error('Invalid bot token. Please check and try again.');
      }
      if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.includes('network')) {
        throw new Error('Network error. Check your internet connection.');
      }
      throw new Error('Connection failed: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    }

    this.bot = bot;
    this.botInfo = me;
    this.connected = true;
    this.token = token;

    // Clear existing chats on fresh connect
    this.chats = [];
    this.processingChats = new Set();

    // 1. Listen for /start command in DM to invite users to join Telegram Channel
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const firstName = msg.from?.first_name || 'there';

      // Find first channel with a public @username if available, or default link
      const channelChat = this.chats.find(c => c.username);
      const channelUrl = channelChat
        ? `https://t.me/${channelChat.username.replace('@', '')}`
        : 'https://t.me/your_channel_username';

      const welcomeText = `👋 Hello *${firstName}*!\n\nWelcome to *@${me.username}*!\n\nClick the button below to join our official Telegram Channel:`;

      this.bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '📢 Join Telegram Channel',
                url: channelUrl
              }
            ]
          ]
        }
      }).catch(err => console.error('Error sending Telegram /start response:', err.message));
    });

    // 2. Listen for Chat Join Requests (Auto-approve & send private welcome message)
    this.bot.on('chat_join_request', async (request) => {
      const chatId = request.chat.id;
      const userId = request.from.id;
      const firstName = request.from.first_name || 'Friend';
      const chatTitle = request.chat.title || 'our Channel';

      try {
        // Approve join request automatically
        await this.bot.approveChatJoinRequest(chatId, userId);
      } catch (e) {
        console.error('Failed to approve join request:', e.message);
      }

      // Send private welcome message
      const privateMsg = `🎉 *Welcome to ${chatTitle}, ${firstName}!*\n\nThank you for joining our channel! We are excited to have you here. Stay tuned for exciting updates!`;
      this.bot.sendMessage(userId, privateMsg, { parse_mode: 'Markdown' })
        .catch(err => console.log(`Could not send DM to user ${userId}:`, err.message));
    });

    // 3. Listen for member status changes (when someone joins channel/group)
    this.bot.on('chat_member', (update) => {
      const isNewMember = (update.old_chat_member?.status === 'left' || update.old_chat_member?.status === 'kicked') &&
                          (update.new_chat_member?.status === 'member' || update.new_chat_member?.status === 'administrator');
      
      if (isNewMember) {
        const user = update.new_chat_member.user;
        if (user.is_bot) return;

        const firstName = user.first_name || 'Friend';
        const chatTitle = update.chat.title || 'our Channel';
        const privateMsg = `🎉 *Welcome to ${chatTitle}, ${firstName}!*\n\nThank you for joining our channel! We are excited to have you here. Stay tuned for exciting updates!`;

        this.bot.sendMessage(user.id, privateMsg, { parse_mode: 'Markdown' })
          .catch(err => console.log(`Could not send DM to user ${user.id}:`, err.message));
      }
    });

    // 4. Auto-detect all chats where bot is admin/member
    const autoRegisterChat = async (chat, force = false) => {
      if (!chat || !chat.id || chat.type === 'private') return;
      
      const chatIdStr = String(chat.id);
      
      // Prevent duplicate processing
      if (!force && this.processingChats.has(chatIdStr)) {
        return;
      }
      this.processingChats.add(chatIdStr);

      try {
        // Check if bot is actually admin in this chat
        let botIsAdmin = false;
        let memberCount = 0;
        
        try {
          const botMember = await this.bot.getChatMember(chat.id, this.botInfo.id);
          botIsAdmin = botMember.status === 'administrator' || botMember.status === 'creator';
          
          // Get member count
          try {
            memberCount = await this.bot.getChatMemberCount(chat.id);
          } catch (e) {
            // Some chats don't allow getting member count
          }
        } catch (e) {
          // Bot might not be in the chat or doesn't have permission
          console.log(`[TG] Bot not admin in ${chat.title || chat.username}`);
          this.processingChats.delete(chatIdStr);
          return;
        }

        // Only register if bot is admin
        if (!botIsAdmin) {
          this.processingChats.delete(chatIdStr);
          return;
        }

        const chatInfo = {
          id: chatIdStr,
          name: chat.title || chat.username || chatIdStr,
          type: chat.type,
          memberCount: memberCount || 0,
          username: chat.username ? '@' + chat.username : null,
          description: chat.description || '',
          isAdmin: botIsAdmin
        };

        // Update or add chat
        const existingIdx = this.chats.findIndex(c => String(c.id) === chatIdStr);
        if (existingIdx >= 0) {
          // Update with latest info
          this.chats[existingIdx] = { ...this.chats[existingIdx], ...chatInfo };
        } else {
          this.chats.push(chatInfo);
        }

        this.saveChats();
        this.broadcast({ type: 'tg_chats', chats: this.chats });
        
        // Remove from processing set after completion
        setTimeout(() => {
          this.processingChats.delete(chatIdStr);
        }, 1000);

      } catch (err) {
        console.error(`[TG] Error registering chat ${chat.id}:`, err.message);
        this.processingChats.delete(chatIdStr);
      }
    };

    // Listen for my_chat_member events (bot added/removed from chats)
    this.bot.on('my_chat_member', (update) => {
      if (update.chat) {
        // Only register if bot is now admin
        if (update.new_chat_member?.status === 'administrator' || 
            update.new_chat_member?.status === 'creator') {
          autoRegisterChat(update.chat, true);
        } else if (update.old_chat_member?.status === 'administrator' && 
                   update.new_chat_member?.status !== 'administrator') {
          // Bot was removed as admin, remove from list
          const chatIdStr = String(update.chat.id);
          this.chats = this.chats.filter(c => String(c.id) !== chatIdStr);
          this.saveChats();
          this.broadcast({ type: 'tg_chats', chats: this.chats });
        }
      }
    });

    // Listen for messages to detect chats
    this.bot.on('message', (msg) => {
      if (msg.chat && msg.chat.type !== 'private') {
        // Check if we already have this chat
        const existing = this.chats.find(c => String(c.id) === String(msg.chat.id));
        if (!existing) {
          autoRegisterChat(msg.chat);
        }
      }
    });

    // Listen for channel posts
    this.bot.on('channel_post', (msg) => {
      if (msg.chat) {
        const existing = this.chats.find(c => String(c.id) === String(msg.chat.id));
        if (!existing) {
          autoRegisterChat(msg.chat);
        }
      }
    });

    // Initial scan for all chats where bot is admin
    setTimeout(async () => {
      try {
        console.log('[TG] Scanning for chats where bot is admin...');
        await this.scanAllChats();
      } catch (err) {
        console.error('[TG] Error scanning chats:', err.message);
      }
    }, 3000);

    return {
      username: '@' + me.username,
      name: me.first_name,
      id: me.id
    };
  }

  async scanAllChats() {
    if (!this.bot || !this.connected) return;
    
    try {
      // Refresh status for all existing saved chats safely without getUpdates() polling conflict
      const knownChatIds = this.chats.map(c => c.id);
      for (const chatId of knownChatIds) {
        try {
          const chat = await this.bot.getChat(chatId);
          if (chat && chat.type !== 'private') {
            const botMember = await this.bot.getChatMember(chatId, this.botInfo.id);
            if (botMember.status === 'administrator' || botMember.status === 'creator') {
              await this.addChat(chatId);
            }
          }
        } catch (e) {
          // Skip chats bot no longer has access to
        }
      }
    } catch (err) {
      console.error('[TG] Error in scanAllChats:', err.message);
    }
  }

  /**
   * Add a group or channel by @username or numeric ID like -100XXXXXXXXXX
   * The bot must already be added as admin to that chat.
   */
  async addChat(chatIdentifier) {
    if (!this.bot) throw new Error('Telegram not connected');

    let chat;
    try {
      chat = await this.bot.getChat(chatIdentifier);
    } catch (err) {
      const body = err?.response?.body || err?.message || '';
      if (body.includes('chat not found') || body.includes('400')) {
        throw new Error(
          `Chat not found: "${chatIdentifier}"\n\n` +
          `Make sure:\n` +
          `1. You added the bot (@${this.botInfo?.username}) as admin to the group/channel\n` +
          `2. The @username or ID is correct\n` +
          `   (For channels: use @channelname or the numeric ID like -1001234567890)`
        );
      }
      throw new Error('Error: ' + (typeof body === 'string' ? body : JSON.stringify(body)));
    }

    // Verify bot is admin
    let botIsAdmin = false;
    try {
      const botMember = await this.bot.getChatMember(chat.id, this.botInfo.id);
      botIsAdmin = botMember.status === 'administrator' || botMember.status === 'creator';
    } catch (e) {
      throw new Error(
        `Bot @${this.botInfo?.username} is not an admin of ${chat.title || chat.username || chat.id}.\n` +
        `Please add the bot as admin first and try again.`
      );
    }

    if (!botIsAdmin) {
      throw new Error(
        `Bot @${this.botInfo?.username} is not an admin of ${chat.title || chat.username || chat.id}.\n` +
        `Please add the bot as admin first and try again.`
      );
    }

    let memberCount = 0;
    try {
      memberCount = await this.bot.getChatMemberCount(chat.id);
    } catch (e) { /* ignore — some chats block this */ }

    const chatInfo = {
      id: String(chat.id),
      name: chat.title || chat.username || String(chat.id),
      type: chat.type,
      memberCount: memberCount || 0,
      username: chat.username ? '@' + chat.username : null,
      description: chat.description || '',
      isAdmin: true
    };

    // Remove existing entry if any
    this.chats = this.chats.filter(c => String(c.id) !== String(chatInfo.id));
    this.chats.push(chatInfo);
    this.saveChats();
    this.broadcast({ type: 'tg_chats', chats: this.chats });
    
    return chatInfo;
  }

  removeChat(chatId) {
    this.chats = this.chats.filter(c => String(c.id) !== String(chatId));
    this.saveChats();
    this.broadcast({ type: 'tg_chats', chats: this.chats });
  }

  async getChats() {
    this.deduplicateChats();
    // Refresh member counts
    for (const chat of this.chats) {
      try {
        if (this.bot && this.connected) {
          const count = await this.bot.getChatMemberCount(chat.id);
          chat.memberCount = count;
        }
      } catch (e) {
        // Skip
      }
    }
    this.saveChats();
    return this.chats;
  }

  async getAnalytics() {
    if (!this.connected) return null;
    this.deduplicateChats();
    const updated = await Promise.all(this.chats.map(async chat => {
      try {
        const count = await this.bot.getChatMemberCount(chat.id);
        return { ...chat, memberCount: count };
      } catch (e) { return chat; }
    }));
    this.chats = updated;
    this.saveChats();
    return {
      username: this.botInfo?.username ? '@' + this.botInfo.username : null,
      name: this.botInfo?.first_name,
      chatCount: this.chats.length,
      totalMembers: this.chats.reduce((s, c) => s + (c.memberCount || 0), 0),
      chats: this.chats
    };
  }

  async sendMedia(chatId, filePath, fileName, mimetype, caption) {
    if (!this.bot) throw new Error('Telegram not connected');
    if (!existsSync(filePath)) throw new Error('File not found: ' + filePath);

    const opts = {};
    if (caption) opts.caption = caption;

    try {
      if (mimetype.startsWith('video/')) {
        await this.bot.sendVideo(chatId, createReadStream(filePath), opts, {
          filename: fileName, contentType: mimetype
        });
      } else {
        // ALL files sent as Document = original quality, no compression
        await this.bot.sendDocument(chatId, createReadStream(filePath), opts, {
          filename: fileName, contentType: mimetype
        });
      }
    } catch (err) {
      const body = err?.response?.body || err?.message || '';
      if (body.includes('FILE_TOO_BIG') || body.includes('file too big')) {
        throw new Error('File too large for Telegram (max 50MB via Bot API)');
      }
      if (body.includes('Forbidden') || body.includes('403')) {
        throw new Error(`Bot can't send to "${chatId}" — make sure bot is admin of the chat`);
      }
      throw err;
    }
    return { success: true };
  }

  async sendText(chatId, text) {
    if (!this.bot) throw new Error('Telegram not connected');
    await this.bot.sendMessage(chatId, text);
    return { success: true };
  }

  async disconnect() {
    try { if (this.bot) this.bot.stopPolling(); } catch (e) {}
    this.bot = null;
    this.connected = false;
    this.botInfo = null;
    this.chats = [];
    this.token = null;
    this.processingChats = new Set();
  }
}
