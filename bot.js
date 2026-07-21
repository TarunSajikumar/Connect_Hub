// ============================================================
// Standalone Telegram Welcome & Channel Link Bot
// Run with: node bot.js
// ============================================================

import TelegramBot from 'node-telegram-bot-api';

// Suppress NTBA warning logs
process.env.NTBA_FIX_319 = '1';
process.env.NTBA_FIX_350 = '1';

// ─── CONFIGURATION ───────────────────────────────────────────
// Put your Telegram Bot Token from @BotFather here (or use BOT_TOKEN environment variable)
const BOT_TOKEN = process.env.BOT_TOKEN || '8890620106:AAE874KLV7eYsoAEFeMpZqE9JW9DaBsQLeg';

// Put your Telegram Channel link or @username here
const CHANNEL_LINK = process.env.CHANNEL_LINK || 'https://t.me/personalstry';

// Welcome message when someone types /start to the bot
const START_MESSAGE = `👋 Hello *{name}*!\n\nWelcome! Click the button below to join our official Telegram channel:`;

// Private welcome message sent when someone joins your channel
const WELCOME_DM_MESSAGE = `🎉 *Welcome to {channel}, {name}!*\n\nThank you for joining our channel! We are excited to have you here. Stay tuned for updates!`;
// ─────────────────────────────────────────────────────────────

// Helper to escape Telegram Markdown special characters
function escapeMarkdown(text) {
  if (!text) return '';
  return String(text).replace(/([_*`\[])/g, '\\$1');
}

if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN') {
  console.error('❌ Error: Please set your BOT_TOKEN inside bot.js before running!');
  console.log('Open bot.js and replace "YOUR_TELEGRAM_BOT_TOKEN" with your bot token from @BotFather.');
  process.exit(1);
}

// Format channel link into valid URL
function getChannelUrl(link) {
  if (link.startsWith('http://') || link.startsWith('https://')) return link;
  return `https://t.me/${link.replace('@', '')}`;
}

const channelUrl = getChannelUrl(CHANNEL_LINK);
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🚀 Telegram Bot is running and polling for updates...');

bot.getMe().then((me) => {
  console.log(`✅ Connected successfully as @${me.username} (${me.first_name})`);
  console.log(`📢 Configured Channel Link: ${channelUrl}`);
}).catch((err) => {
  console.error('❌ Failed to connect to Telegram Bot API:', err.message);
});

// 1. Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name = escapeMarkdown(msg.from?.first_name || 'there');

  const text = START_MESSAGE.replace('{name}', name);

  bot.sendMessage(chatId, text, {
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
  }).catch((err) => console.error('Error sending /start response:', err.message));
});

// 2. Handle Chat Join Requests (Auto-approve & send private welcome message)
bot.on('chat_join_request', async (request) => {
  const chatId = request.chat.id;
  const userId = request.from.id;
  const name = escapeMarkdown(request.from.first_name || 'Friend');
  const channelName = escapeMarkdown(request.chat.title || 'our Channel');

  try {
    await bot.approveChatJoinRequest(chatId, userId);
    console.log(`✅ Approved join request for ${name} (ID: ${userId})`);
  } catch (e) {
    console.error('Failed to approve join request:', e.message);
  }

  const msgText = WELCOME_DM_MESSAGE.replace('{channel}', channelName).replace('{name}', name);
  bot.sendMessage(userId, msgText, { parse_mode: 'Markdown' })
    .catch((err) => console.log(`Could not send DM to user ${userId}:`, err.message));
});

// 3. Handle member status updates (when someone joins channel/group)
bot.on('chat_member', (update) => {
  const isNewMember =
    (update.old_chat_member?.status === 'left' || update.old_chat_member?.status === 'kicked') &&
    (update.new_chat_member?.status === 'member' || update.new_chat_member?.status === 'administrator');

  if (isNewMember) {
    const user = update.new_chat_member.user;
    if (user.is_bot) return;

    const name = escapeMarkdown(user.first_name || 'Friend');
    const channelName = escapeMarkdown(update.chat.title || 'our Channel');
    const msgText = WELCOME_DM_MESSAGE.replace('{channel}', channelName).replace('{name}', name);

    bot.sendMessage(user.id, msgText, { parse_mode: 'Markdown' })
      .catch((err) => console.log(`Could not send DM to user ${user.id}:`, err.message));
  }
});

// 4. Handle new chat members in groups
bot.on('new_chat_members', (msg) => {
  const channelName = escapeMarkdown(msg.chat.title || 'our group');
  const members = msg.new_chat_members || [];
  for (const member of members) {
    if (member.is_bot) continue;
    const name = escapeMarkdown(member.first_name || 'Friend');
    const msgText = WELCOME_DM_MESSAGE.replace('{channel}', channelName).replace('{name}', name);

    bot.sendMessage(member.id, msgText, { parse_mode: 'Markdown' })
      .catch(() => {
        // Fallback: send welcome message in group if DM is blocked
        bot.sendMessage(msg.chat.id, `🎉 Welcome to ${channelName}, *${name}*!`, { parse_mode: 'Markdown' }).catch(() => { });
      });
  }
});

// Catch polling errors gracefully
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.code || error.message);
});

