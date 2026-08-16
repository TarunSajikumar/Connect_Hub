// ============================================================
// Emoji Utility & Smart NLP Suggestion Engine — public/emoji-utils.js
// Live Contextual Emoji Recommendations & Auto-Enhancement
// ============================================================

/**
 * Extensive Contextual Keyword-to-Emoji Knowledge Dictionary
 * Supports exact words, prefixes, phrases, regional keywords, and emotional intents
 */
const EMOJI_DICTIONARY = {
  // Greetings & Welcomes
  'hi': ['👋', '✨'],
  'hello': ['👋', '😃'],
  'hey': ['👋', '🔥'],
  'welcome': ['👋', '🎉', '🌟'],
  'morning': ['🌅', '☀️', '☕'],
  'gm': ['🌅', '☕'],
  'night': ['🌙', '⭐', '😴'],
  'gn': ['🌙', '✨'],
  'bye': ['👋', '💨'],
  'goodbye': ['👋', '✈️'],

  // Music, Lyrics, Songs & Audio (including Malayalam / Indian keywords)
  'song': ['🎵', '🎶', '🎤', '🎧'],
  'songs': ['🎵', '🎶', '🎼'],
  'music': ['🎵', '🎶', '🎧', '🎸'],
  'lyrics': ['📝', '🎵', '✍️', '✨'],
  'lyric': ['📝', '🎵', '✨'],
  'audio': ['🔊', '🎵', '🎙️', '📻'],
  'voice': ['🎙️', '🗣️', '🔊'],
  'sing': ['🎤', '🎶', '✨'],
  'singer': ['🎤', '🌟', '🎶'],
  'ormakal': ['💭', '💫', '🍂', '❤️'],
  'ormakalil': ['💭', '🥀', '✨'],
  'thammil': ['🤫', '💭', '🥀', '💫'],
  'mounam': ['🤫', '💭', '🥀', '💫'],
  'sneham': ['❤️', '💖', '🥰', '🌹'],
  'pranayam': ['❤️', '🌹', '💑', '✨'],
  'paattu': ['🎵', '🎶', '🎤'],
  'gana': ['🎵', '🎶', '📻'],
  'tune': ['🎵', '🎹', '🎶'],
  'beat': ['🥁', '🎧', '🔥'],
  'bass': ['🔊', '🎧', '⚡'],
  'vibe': ['✨', '💫', '🌴', '🔥'],
  'vibes': ['✨', '💫', '🔥'],
  'status': ['📱', '💫', '✨', '🔥'],
  'story': ['📖', '📱', '✨'],

  // Excitement & Trending
  'fire': ['🔥', '💥', '⚡'],
  'hot': ['🔥', '🌶️', '🥵'],
  'lit': ['🔥', '✨', '⚡'],
  'trending': ['🔥', '📈', '🚀'],
  'viral': ['🔥', '💥', '🚀'],
  'hype': ['🔥', '🎉', '🤩'],
  'crazy': ['🤯', '🤪', '🔥'],
  'insane': ['🤯', '💥', '⚡'],
  'cool': ['😎', '❄️', '🤙'],
  'awesome': ['🤩', '✨', '🙌'],
  'amazing': ['🤩', '✨', '💫'],
  'wow': ['😮', '🤯', '✨'],
  'omg': ['😱', '🤯', '💥'],
  'epic': ['🏆', '⚡', '🔥'],

  // Celebrations & Success
  'celebrate': ['🎉', '🥳', '🍾'],
  'party': ['🎉', '🥳', '🎊'],
  'congrats': ['🎉', '👏', '🏆'],
  'congratulations': ['🎉', '💐', '🏆'],
  'win': ['🏆', '🥇', '🎉'],
  'winner': ['🏆', '👑', '🎉'],
  'success': ['✅', '🏆', '📈'],
  'victory': ['✌️', '🏆', '🎉'],
  'cheers': ['🥂', '🍻', '🥳'],
  'birthday': ['🎂', '🎈', '🎉'],
  'anniversary': ['💐', '💍', '🎉'],

  // Call-To-Actions & Links
  'click': ['👇', '🖱️', '👉'],
  'link': ['🔗', '👇', '🌐'],
  'tap': ['👇', '👉', '📲'],
  'check': ['✅', '👀', '👇'],
  'checkout': ['👀', '🛍️', '👇'],
  'watch': ['👀', '📺', '🎬'],
  'see': ['👀', '👁️', '👇'],
  'read': ['📖', '📰', '👇'],
  'here': ['👇', '📍', '👉'],
  'download': ['⬇️', '💾', '📥'],
  'install': ['📲', '⬇️', '⚡'],
  'join': ['🤝', '👥', '🚀'],
  'subscribe': ['🔔', '⭐', '📺'],
  'follow': ['👣', '➕', '✨'],
  'register': ['📝', '📋', '✍️'],
  'signup': ['📝', '🚀', '✨'],

  // Marketing, Sales & Deals
  'sale': ['🛍️', '🏷️', '💸'],
  'discount': ['🏷️', '💰', '✂️'],
  'offer': ['🎁', '🏷️', '✨'],
  'deal': ['🤝', '🏷️', '💰'],
  'free': ['🆓', '🎁', '✨'],
  'promo': ['📢', '🏷️', '🎉'],
  'coupon': ['🎟️', '🏷️', '✂️'],
  'limited': ['⏳', '🚨', '⏰'],
  'hurry': ['🏃‍♂️', '⏰', '⚡'],
  'buy': ['🛒', '💳', '🛍️'],
  'shop': ['🛍️', '🛒', '🏪'],
  'price': ['🏷️', '💵', '💰'],
  'save': ['💰', '💾', '🐷'],
  'exclusive': ['💎', '👑', '🔒'],
  'cheap': ['🏷️', '💸', '🤑'],
  'best': ['⭐', '🥇', '👑'],
  'bonus': ['🎁', '✨', '💰'],

  // New, Update & Announcements
  'new': ['🆕', '✨', '⚡'],
  'update': ['🔄', '📢', '🚀'],
  'alert': ['🚨', '🔔', '⚠️'],
  'important': ['⚠️', '🚨', '📌'],
  'urgent': ['🚨', '⚡', '⏰'],
  'breaking': ['🚨', '💥', '📰'],
  'news': ['📰', '📢', '📺'],
  'announcement': ['📢', '📣', '🔔'],
  'broadcast': ['📢', '📡', '📻'],
  'launch': ['🚀', '✨', '💥'],
  'release': ['🚀', '📦', '🎉'],
  'feature': ['✨', '🌟', '🛠️'],

  // Love, Thanks & Positive Emotion
  'love': ['❤️', '💖', '🥰'],
  'heart': ['❤️', '💖', '💓'],
  'like': ['👍', '❤️', '✨'],
  'thanks': ['🙏', '💖', '💐'],
  'thank': ['🙏', '✨', '💐'],
  'grateful': ['🙏', '💫', '💖'],
  'appreciate': ['🙏', '❤️', '🌟'],
  'happy': ['😊', '😃', '🥳'],
  'smile': ['😊', '😄', '✨'],
  'enjoy': ['🥳', '✨', '🍹'],
  'peace': ['✌️', '🕊️', '🌿'],
  'blessed': ['🙏', '✨', '😇'],
  'good': ['👍', '✅', '✨'],
  'great': ['🙌', '⭐', '🔥'],
  'perfect': ['👌', '💯', '✨'],

  // Humor & Reactions
  'lol': ['😂', '🤣', '😆'],
  'lmao': ['🤣', '💀', '😂'],
  'haha': ['😂', '😄', '😆'],
  'funny': ['😂', '🤡', '🤣'],
  'joke': ['🃏', '😂', '🤡'],
  'meme': ['🐸', '😂', '🖼️'],
  'sad': ['😢', '💔', '🥺'],
  'cry': ['😭', '😢', '🥺'],
  'alone': ['🥀', '💔', '🌧️'],
  'pain': ['💔', '🥀', '🥺'],
  'thinking': ['🤔', '💭', '🧐'],
  'idea': ['💡', '🧠', '✨'],
  'mindblown': ['🤯', '💥', '⚡'],
  'shock': ['😱', '⚡', '👀'],
  'question': ['❓', '🤔', '💬'],

  // Tech, Media & Content
  'video': ['🎬', '🎥', '📹'],
  'reel': ['🎬', '📱', '🎥'],
  'reels': ['🎬', '📱', '🔥'],
  'short': ['🎬', '⚡', '📱'],
  'shorts': ['🎬', '⚡', '📱'],
  'photo': ['📸', '📷', '🖼️'],
  'picture': ['🖼️', '📸', '🎨'],
  'image': ['🖼️', '📸', '🎨'],
  'media': ['🎬', '📁', '📸'],
  'movie': ['🍿', '🎬', '🎥'],
  'game': ['🎮', '🕹️', '👾'],
  'code': ['💻', '👨‍💻', '⚡'],
  'app': ['📱', '💻', '⚡'],
  'bot': ['🤖', '⚡', '⚙️'],
  'ai': ['🤖', '🧠', '✨'],
  'live': ['🔴', '📡', '📺'],
  'stream': ['📺', '📡', '🌊'],
  'camera': ['📷', '📸', '📹'],

  // Business, Work & Finance
  'money': ['💰', '💵', '💸'],
  'dollar': ['💵', '💲', '💰'],
  'cash': ['💵', '💰', '💸'],
  'crypto': ['🪙', '🚀', '💎'],
  'bitcoin': ['🪙', '⚡', '💰'],
  'profit': ['📈', '💰', '💵'],
  'growth': ['📈', '🌱', '🚀'],
  'revenue': ['💰', '📊', '📈'],
  'team': ['👥', '🤝', '💼'],
  'work': ['💼', '💻', '⚡'],
  'job': ['💼', '📄', '👔'],
  'career': ['💼', '🚀', '🌟'],
  'business': ['🏢', '💼', '📈'],
  'meeting': ['📅', '👥', '💼'],
  'report': ['📊', '📋', '📈'],
  'goals': ['🎯', '🏆', '📈'],

  // Time & Scheduling
  'today': ['📅', '⏰', '✨'],
  'now': ['⚡', '⏰', '🚨'],
  'soon': ['⏳', '👀', '⏰'],
  'tonight': ['🌙', '✨', '🎉'],
  'tomorrow': ['🌅', '📅', '⏰'],
  'schedule': ['⏰', '📅', '⏳'],
  'time': ['⏰', '⏳', '⏱️'],
  'reminder': ['🔔', '⏰', '📌'],
  'fast': ['⚡', '🏃‍♂️', '💨'],
  'quick': ['⚡', '⏱️', '🏃‍♂️'],
  'slow': ['🐢', '⏳', '🐌'],

  // Social & Platforms
  'whatsapp': ['💬', '📱', '🟢'],
  'telegram': ['✈️', '📢', '🔵'],
  'instagram': ['📸', '📱', '✨'],
  'youtube': ['📺', '▶️', '🎬'],
  'facebook': ['📘', '👥', '🌐'],
  'twitter': ['🐦', '💬', '🌐'],
  'x': ['✖️', '🐦', '💬'],
  'group': ['👥', '💬', '📢'],
  'channel': ['📢', '📡', '📺'],
  'post': ['📝', '📤', '📱'],
  'message': ['💬', '✉️', '📩'],
  'chat': ['💬', '💭', '🗣️'],

  // Food, Drink & Lifestyle
  'coffee': ['☕', '🤎', '✨'],
  'tea': ['🍵', '🫖', '🌿'],
  'food': ['🍕', '🍔', '😋'],
  'pizza': ['🍕', '🧀', '😋'],
  'burger': ['🍔', '🍟', '😋'],
  'cake': ['🍰', '🎂', '🎉'],
  'beer': ['🍺', '🍻', '🥳'],
  'wine': ['🍷', '🍾', '🥂'],
  'fitness': ['🏋️‍♂️', '💪', '🏃‍♂️'],
  'gym': ['🏋️‍♂️', '💪', '🔥'],
  'travel': ['✈️', '🧳', '🌴'],
  'vacation': ['🏖️', '🌴', '☀️'],
  'beach': ['🏖️', '🌊', '☀️'],
  'sun': ['☀️', '🌞', '✨'],
  'rain': ['🌧️', '☔', '💧'],
  'star': ['⭐', '🌟', '✨'],
  'car': ['🚗', '🏎️', '💨']
};

/**
 * Categorized Emojis for Popover Picker
 */
const CATEGORIZED_EMOJIS = {
  popular: [
    '🔥', '🚀', '💡', '✨', '🎉', '👇', '🎯', '📢', '❤️', '⚡',
    '💯', '🤩', '🌟', '👑', '💥', '📈', '💬', '📱', '🏆', '🎁',
    '🛍️', '🏷️', '💰', '💵', '💸', '👀', '🔗', '✅', '🚨', '⏰'
  ],
  music: [
    '🎵', '🎶', '🎧', '🎤', '🎙️', '🎸', '🎹', '🥁', '🎷', '🎺',
    '📻', '🎼', '🔊', '🔈', '💿', '📀', '🎬', '📱', '✨', '💫',
    '❤️', '🥀', '🍂', '💭', '🕺', '💃', '🌟', '🔥', '💖', '🥰'
  ],
  faces: [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
    '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😛', '😜',
    '🤪', '😎', '🤓', '🧐', '🥳', '😏', '🥺', '😢', '😭', '😱',
    '🤯', '😴', '🤖', '💀', '🤡', '👻', '👽', '🤠', '😇', '🤐'
  ],
  gestures: [
    '👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '👊', '✌️', '🤞',
    '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '🖐️', '✋',
    '👋', '✍️', '🙏', '🦾', '💪', '🤳', '💅', '👀', '👁️', '🧠'
  ],
  marketing: [
    '📢', '📣', '🔔', '🛍️', '🏷️', '💰', '💵', '💸', '💳', '🛒',
    '🎁', '💎', '🚀', '📈', '🎯', '⚡', '⏳', '⏰', '🚨', '🆕',
    '🆓', '👑', '🥇', '💥', '📩', '🔗', '📲', '🌐', '📊', '🎟️'
  ],
  objects: [
    '💡', '💻', '🖥️', '📱', '🎥', '🎬', '📸', '📷', '🎵', '🎶',
    '🎧', '🎙️', '📻', '🎮', '🕹️', '☕', '🍕', '🍔', '🍰', '🚗',
    '✈️', '🚀', '📦', '📄', '📁', '🔑', '🔒', '🛠️', '✏️', '📝'
  ],
  symbols: [
    '✨', '⭐', '🌟', '💫', '💥', '💯', '🔥', '⚡', '🌈', '☀️',
    '🌙', '❤️', '💖', '💔', '💕', '💞', '💓', '💗', '💘', '💝',
    '✅', '☑️', '✔️', '❌', '❎', '➕', '➖', '❓', '❗', '📍'
  ]
};

/**
 * Default starter emojis shown when textarea is empty
 */
const DEFAULT_STARTER_SUGGESTIONS = [
  { emoji: '🔥', label: 'Trending', keyword: 'fire' },
  { emoji: '🎵', label: 'Music & Song', keyword: 'song' },
  { emoji: '🚀', label: 'Launch', keyword: 'launch' },
  { emoji: '📢', label: 'Announcement', keyword: 'broadcast' },
  { emoji: '✨', label: 'Exciting', keyword: 'awesome' },
  { emoji: '👇', label: 'Check Below', keyword: 'click' },
  { emoji: '🎯', label: 'Target', keyword: 'goals' },
  { emoji: '🎉', label: 'Celebrate', keyword: 'celebrate' },
  { emoji: '💡', label: 'Idea', keyword: 'idea' },
  { emoji: '❤️', label: 'Love', keyword: 'love' },
  { emoji: '💰', label: 'Deals & Offers', keyword: 'money' },
  { emoji: '⚡', label: 'Instant', keyword: 'fast' }
];

// ============================================================
// Unicode Fancy Font Converter Maps
// ============================================================
const FONT_MAPS = {
  bold_sans: {
    upper: '𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭',
    lower: '𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇',
    digits: '𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵'
  },
  bold_serif: {
    upper: '𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙',
    lower: '𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳',
    digits: '𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗'
  },
  italic: {
    upper: '𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡',
    lower: '𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻',
    digits: '0123456789'
  },
  gothic_bold: {
    upper: '𝕬𝕭𝕮𝕯𝕰𝕱𝕲𝕳𝕴𝕵𝕶𝕷𝕸𝕹𝕺𝕻𝕼𝕽𝕾𝕿𝖀𝖁𝖂𝖃𝖄𝖅',
    lower: '𝖆𝖇𝖈𝖉𝖊𝖋𝖌𝖍𝖎𝖏𝖐𝖑𝖒𝖓𝖔𝖕𝖖𝖗𝖘𝖙𝖚𝖛𝖜𝖝𝖞𝖟',
    digits: '0123456789'
  },
  cursive: {
    upper: '𝒜𝒝𝒞𝒟𝐸𝐹𝒢𝐻𝐼𝒥𝒦𝐿𝑀𝒩𝒪𝒫𝒬𝑅𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵',
    lower: '𝒶𝒷𝒸𝒹𝑒𝒻𝑔𝒽𝒾𝒿𝓀𝓁𝓂𝓃𝑜𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏',
    digits: '0123456789'
  },
  bubble: {
    upper: '🅐🅑🅒🅓🅔🅕🅖🅗🅘🅙🅚🅛🅜🅝🅞🅟🅠🅡🅢🅣🅤🅥🅦🅧🅨🅩',
    lower: 'ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ',
    digits: '⓪①②③④⑤⑥⑦⑧⑨'
  },
  boxed: {
    upper: '🄰🄱🄲🄳🄴🄵🄶🄷🄸🄹🄺🄻🄼🄽🄾🄿🅀🅁🅂🅃🅄🅅🅆🅇🅈🅉',
    lower: '🄰🄱🄲🄳🄴🄵🄶🄷🄸🄹🄺🄻🄼🄽🄾🄿🅀🅁🅂🅃🅄🅅🅆🅇🅈🅉',
    digits: '0123456789'
  },
  spaced: {
    upper: 'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ',
    lower: 'ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ',
    digits: '０１２３４５６７８９'
  }
};

const FONT_PREVIEW_NAMES = {
  bold_sans: '𝗕𝗼𝗹𝗱 𝗦𝗮𝗻𝘀',
  bold_serif: '𝐁𝐨𝐥𝐝 𝐒𝐞𝐫𝐢𝐟',
  italic: '𝘐𝘵𝘢𝘭𝘪𝘤 𝘚𝘢𝘯𝘴',
  gothic_bold: '𝕲𝖔𝖙𝖍𝖎𝖈 𝕭𝖔𝖑𝖉',
  cursive: '𝒞𝓊𝓇𝓈𝒾𝓋ℯ 𝒮𝒸𝓇𝒾𝓅𝓉',
  bubble: '🅑🅤🅑🅑🅛🅔 🅕🅞🅝🅣',
  boxed: '🄱🄾🅇🄴🄳 🄵🄾🄽🅃',
  spaced: 'Ｓｐａｃｅｄ Ｗｉｄｅ'
};

/**
 * Convert string to fancy unicode font
 */
function toFancyFont(text, fontKey) {
  const map = FONT_MAPS[fontKey];
  if (!map) return text;

  const normalUpper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const normalLower = 'abcdefghijklmnopqrstuvwxyz';
  const normalDigits = '0123456789';

  // Unicode characters can be surrogate pairs (length 2 in JS string), so use Array.from
  const uArr = Array.from(map.upper);
  const lArr = Array.from(map.lower);
  const dArr = Array.from(map.digits);

  return Array.from(text).map(char => {
    const uIdx = normalUpper.indexOf(char);
    if (uIdx !== -1 && uArr[uIdx]) return uArr[uIdx];

    const lIdx = normalLower.indexOf(char);
    if (lIdx !== -1 && lArr[lIdx]) return lArr[lIdx];

    const dIdx = normalDigits.indexOf(char);
    if (dIdx !== -1 && dArr[dIdx]) return dArr[dIdx];

    return char;
  }).join('');
}

/**
 * Get Smart Emoji Suggestions for given text
 */
function getSmartEmojiSuggestions(text) {
  if (!text || !text.trim()) {
    return DEFAULT_STARTER_SUGGESTIONS;
  }

  const cleanText = text.toLowerCase();
  const rawWords = cleanText.split(/[\s,.;:!?\n\r"'/()\[\]{}]+/).filter(w => w.length > 0);
  
  if (!rawWords.length) {
    return DEFAULT_STARTER_SUGGESTIONS;
  }

  const suggestions = [];
  const seenEmojis = new Set();

  const addSuggestion = (emoji, label, keyword) => {
    if (!seenEmojis.has(emoji)) {
      seenEmojis.add(emoji);
      suggestions.push({ emoji, label: label || keyword, keyword });
    }
  };

  // 1. High Priority: Last word typed
  const lastWord = rawWords[rawWords.length - 1];
  if (lastWord) {
    if (EMOJI_DICTIONARY[lastWord]) {
      EMOJI_DICTIONARY[lastWord].forEach(e => addSuggestion(e, lastWord, lastWord));
    } else {
      for (const [kw, emojis] of Object.entries(EMOJI_DICTIONARY)) {
        if (kw.startsWith(lastWord) && kw !== lastWord && lastWord.length >= 2) {
          emojis.forEach(e => addSuggestion(e, kw, kw));
        }
      }
    }
  }

  // 2. Full Context: Scan all words in message
  for (let i = rawWords.length - 1; i >= 0; i--) {
    const word = rawWords[i];
    if (EMOJI_DICTIONARY[word]) {
      EMOJI_DICTIONARY[word].forEach(e => addSuggestion(e, word, word));
    }
  }

  // 3. Multi-word phrase matching
  const phraseChecks = [
    { phrase: 'tammil thammil', emoji: '🎵', label: 'Song' },
    { phrase: 'ormakal', emoji: '💭', label: 'Memories' },
    { phrase: 'check out', emoji: '👀', label: 'checkout' },
    { phrase: 'link below', emoji: '👇', label: 'link' },
    { phrase: 'click here', emoji: '👇', label: 'click' },
    { phrase: 'watch now', emoji: '🎬', label: 'watch' },
    { phrase: 'limited time', emoji: '⏳', label: 'limited' },
    { phrase: 'sign up', emoji: '📝', label: 'signup' },
    { phrase: 'special offer', emoji: '🎁', label: 'offer' },
    { phrase: 'breaking news', emoji: '🚨', label: 'breaking' },
    { phrase: 'good morning', emoji: '🌅', label: 'morning' },
    { phrase: 'good night', emoji: '🌙', label: 'night' },
    { phrase: 'happy birthday', emoji: '🎂', label: 'birthday' }
  ];

  for (const item of phraseChecks) {
    if (cleanText.includes(item.phrase)) {
      addSuggestion(item.emoji, item.label, item.phrase);
    }
  }

  // 4. Fallback: Pad with trending starters if fewer than 8 suggestions
  if (suggestions.length < 8) {
    for (const starter of DEFAULT_STARTER_SUGGESTIONS) {
      if (!seenEmojis.has(starter.emoji)) {
        addSuggestion(starter.emoji, starter.label, starter.keyword);
        if (suggestions.length >= 12) break;
      }
    }
  }

  return suggestions.slice(0, 12);
}

/**
 * Automatically enhances caption text with natural, relevant emojis
 */
function autoEnhanceCaptionText(text) {
  if (!text || !text.trim()) return text;

  let enriched = text;

  const decorateRules = [
    { regex: /\b(song|songs|music|lyrics?|ormakal|thammil)\b/gi, emoji: '🎵' },
    { regex: /\b(launch|launching|launched)\b/gi, emoji: '🚀' },
    { regex: /\b(fire|hot|trending|viral)\b/gi, emoji: '🔥' },
    { regex: /\b(sale|discount|deal|deals|promo)\b/gi, emoji: '🏷️' },
    { regex: /\b(free)\b/gi, emoji: '🎁' },
    { regex: /\b(alert|urgent|important|warning)\b/gi, emoji: '🚨' },
    { regex: /\b(video|reel|shorts?)\b/gi, emoji: '🎬' },
    { regex: /\b(photo|picture|images?)\b/gi, emoji: '📸' },
    { regex: /\b(winner|win|congrats|congratulations)\b/gi, emoji: '🎉' },
    { regex: /\b(love|heart|sneham)\b/gi, emoji: '❤️' },
    { regex: /\b(click|link|tap|below)\b/gi, emoji: '👇' },
    { regex: /\b(check|checkout)\b/gi, emoji: '👀' },
    { regex: /\b(today|now)\b/gi, emoji: '⚡' },
    { regex: /\b(money|cash|profit)\b/gi, emoji: '💰' },
    { regex: /\b(exclusive|vip|special)\b/gi, emoji: '💎' },
    { regex: /\b(happy|smile)\b/gi, emoji: '😊' },
    { regex: /\b(thanks|thank you)\b/gi, emoji: '🙏' },
    { regex: /\b(idea|tips?)\b/gi, emoji: '💡' }
  ];

  for (const rule of decorateRules) {
    enriched = enriched.replace(rule.regex, (match) => `${match} ${rule.emoji}`);
  }

  enriched = enriched.replace(/ +/g, ' ').trim();

  // If text has no emoji at start, add a leading contextual emoji
  if (!/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu.test(enriched.slice(0, 4))) {
    const mainSuggestions = getSmartEmojiSuggestions(text);
    if (mainSuggestions.length > 0 && mainSuggestions[0].emoji) {
      enriched = `${mainSuggestions[0].emoji} ${enriched}`;
    }
  }

  return enriched;
}

/**
 * Generate Smart Hashtags based on text keywords
 */
function generateAutoHashtags(text) {
  if (!text) return '#Trending #Viral #Status';

  const clean = text.toLowerCase();
  const tags = new Set();

  if (/song|music|lyrics?|ormakal|thammil|mounam|paattu|sing/i.test(clean)) {
    tags.add('#MalayalamSong');
    tags.add('#Lyrics');
    tags.add('#WhatsAppStatus');
    tags.add('#MusicVibes');
    tags.add('#ReelsIndia');
  }

  if (/sale|discount|deal|offer|shop|buy|price|promo/i.test(clean)) {
    tags.add('#SpecialOffer');
    tags.add('#Discount');
    tags.add('#SaleLive');
    tags.add('#ShopNow');
  }

  if (/viral|trending|hot|lit|fire|explore/i.test(clean)) {
    tags.add('#Viral');
    tags.add('#Trending');
    tags.add('#ExplorePage');
    tags.add('#ForYou');
  }

  if (/love|romance|sneham|pranayam|heart/i.test(clean)) {
    tags.add('#LoveStatus');
    tags.add('#RomanticVibes');
    tags.add('#Feelings');
  }

  if (/news|update|announcement|alert|important/i.test(clean)) {
    tags.add('#Announcement');
    tags.add('#Update');
    tags.add('#ImportantNews');
  }

  // Default fallback tags
  tags.add('#TrendingNow');
  tags.add('#Status');

  return Array.from(tags).slice(0, 5).join(' ');
}

/**
 * Apply auto-style preset templates to the caption
 */
function applyAutoStylePreset(presetType) {
  const textarea = document.getElementById('caption');
  if (!textarea) return;

  const raw = textarea.value.trim();
  if (!raw) {
    if (typeof toast === 'function') toast('info', '💡 Type a title or message first, then pick a style!');
    textarea.focus();
    return;
  }

  // Clean title
  const cleanTitle = raw.replace(/^[•\-\*\_~❝❞\s]+|[•\-\*\_~❝❞\s]+$/g, '');
  let formatted = '';

  const isMusic = /song|music|ormakal|thammil|lyric|mounam|paattu|sing/i.test(raw);
  const isPromo = /sale|discount|offer|deal|launch|promo|buy|shop|price|free/i.test(raw);

  switch (presetType) {
    case 'smart':
      if (isMusic) {
        formatted = `✨ ─── ⋆⋅☆⋅⋆ ─── ✨\n🎵 *${cleanTitle}*\n🎧 Use Headphones for Best Experience\n💫 Share & Save for Later\n\n${generateAutoHashtags(cleanTitle)}`;
      } else if (isPromo) {
        formatted = `🚨 *SPECIAL ANNOUNCEMENT* 🚨\n\n👉 *${cleanTitle}*\n⚡ Limited Time Opportunity!\n👇 Click link below to grab now\n\n${generateAutoHashtags(cleanTitle)}`;
      } else {
        formatted = `✨ *${cleanTitle}* ✨\n\n👉 Check out the full update below!\n💬 Like, Share & Subscribe\n\n${generateAutoHashtags(cleanTitle)}`;
      }
      break;

    case 'viral':
      formatted = `🔥 ⋆【 ${toFancyFont(cleanTitle, 'bold_sans')} 】⋆ 🔥\n\n👀 Watch till the end & double tap!\n💬 Drop your thoughts below 👇\n\n#Viral #Trending #ExplorePage #FYP`;
      break;

    case 'music':
      formatted = `✨ ─── ⋆⋅☆⋅⋆ ─── ✨\n🎵 *${cleanTitle}*\n🎧 Wear Headphones 🎧\n🥀 Feel the music & lyrics\n\n${generateAutoHashtags(cleanTitle)}`;
      break;

    case 'promo':
      formatted = `🚨 *LIMITED TIME OFFER* 🚨\n\n👉 *${cleanTitle}*\n🏷️ Best Deal of the Season\n⚡ Act fast before it ends!\n👇 Tap the link below to get yours\n\n#SpecialOffer #SaleLive #ShopNow`;
      break;

    case 'aesthetic':
      formatted = `✧･ﾟ: *✧･ﾟ:*  ${toFancyFont(cleanTitle, 'cursive')}  *:･ﾟ✧*:･ﾟ✧\n\n🌸 aesthetic vibes only\n🕊️ save and share with someone special\n\n#aesthetic #vibes #minimal`;
      break;

    case 'whatsapp':
      formatted = `*${cleanTitle}*\n\n✅ Verified High Quality\n📢 Broadcast to all members\n👉 More updates coming soon!`;
      break;

    case 'quotes':
      formatted = `❝ ${cleanTitle} ❞\n\n💫 Keep moving forward ✨\n\n#DailyQuote #Inspiration #Status`;
      break;

    default:
      formatted = autoEnhanceCaptionText(raw);
  }

  textarea.value = formatted;
  onCaptionInput(textarea);
  textarea.focus();

  if (typeof toast === 'function') {
    toast('success', `🪄 Applied "${presetType}" auto-style preset!`);
  }
}

/**
 * Apply basic formatting (*bold*, _italic_, ~strike~, `code`, quotes, bullets)
 */
function applyTextFormat(format) {
  const textarea = document.getElementById('caption');
  if (!textarea) return;

  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const val = textarea.value;

  const selected = val.substring(start, end);
  const target = selected || val || 'Text';

  let replacement = '';
  switch (format) {
    case 'bold':
      replacement = `*${target}*`;
      break;
    case 'italic':
      replacement = `_${target}_`;
      break;
    case 'strike':
      replacement = `~${target}~`;
      break;
    case 'monospace':
      replacement = `\`${target}\``;
      break;
    case 'quote':
      replacement = `❝ ${target} ❞`;
      break;
    case 'bullet':
      replacement = target.split('\n').map(l => l.startsWith('• ') ? l : `• ${l}`).join('\n');
      break;
    default:
      replacement = target;
  }

  if (selected) {
    textarea.value = val.substring(0, start) + replacement + val.substring(end);
    textarea.setSelectionRange(start, start + replacement.length);
  } else {
    textarea.value = replacement;
  }

  onCaptionInput(textarea);
  textarea.focus();
}

/**
 * Append generated hashtags to caption
 */
function applyAutoHashtags() {
  const textarea = document.getElementById('caption');
  if (!textarea) return;

  const current = textarea.value.trim();
  const tags = generateAutoHashtags(current);

  if (current.includes(tags.split(' ')[0])) {
    if (typeof toast === 'function') toast('info', 'Hashtags already present');
    return;
  }

  textarea.value = current ? `${current}\n\n${tags}` : tags;
  onCaptionInput(textarea);
  textarea.focus();

  if (typeof toast === 'function') toast('success', '🏷️ Added smart trending hashtags!');
}

/**
 * Insert emoji into the #caption textarea at current cursor position
 */
function insertEmojiIntoCaption(emoji) {
  const textarea = document.getElementById('caption');
  if (!textarea) return;

  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const text = textarea.value;

  const newText = text.substring(0, start) + emoji + text.substring(end);
  textarea.value = newText;

  const newPos = start + emoji.length;
  textarea.setSelectionRange(newPos, newPos);
  textarea.focus();

  onCaptionInput(textarea);
}

/**
 * Handle live input in caption box
 */
function onCaptionInput(textarea) {
  const countEl = document.getElementById('char-count');
  if (countEl) {
    countEl.textContent = textarea.value.length;
  }

  renderSmartEmojiSuggestions(textarea.value);
}

/**
 * Render smart emoji pills in the UI
 */
function renderSmartEmojiSuggestions(text) {
  const container = document.getElementById('emoji-pills-container');
  const labelEl = document.getElementById('emoji-suggest-label');
  if (!container) return;

  const suggestions = getSmartEmojiSuggestions(text);
  
  if (labelEl) {
    labelEl.textContent = text && text.trim() ? 'Matched emojis for your text:' : 'Popular broadcast emojis:';
  }

  container.innerHTML = suggestions.map(s => `
    <button type="button" class="emoji-pill-btn" onclick="insertEmojiIntoCaption('${s.emoji}')" title="Insert ${s.emoji} (${s.label})">
      <span class="emoji-pill-symbol">${s.emoji}</span>
      <span class="emoji-pill-text">${s.label}</span>
    </button>
  `).join('');
}

/**
 * Action: Automatically enhance caption with emojis
 */
function autoEnhanceCaptionEmojis() {
  const textarea = document.getElementById('caption');
  if (!textarea) return;

  const current = textarea.value;
  if (!current.trim()) {
    if (typeof toast === 'function') {
      toast('info', '💡 Type a caption first, then click ✨ Auto-Emoji to enhance it!');
    }
    textarea.focus();
    return;
  }

  const enhanced = autoEnhanceCaptionText(current);
  textarea.value = enhanced;
  onCaptionInput(textarea);

  if (typeof toast === 'function') {
    toast('success', '✨ Caption enriched with smart emojis!');
  }
}

/**
 * Toggle the categorized emoji picker popover
 */
function toggleEmojiPicker(forceState) {
  const popover = document.getElementById('emoji-picker-popover');
  const btn = document.getElementById('btn-emoji-picker-toggle');
  if (!popover) return;

  const isVisible = popover.style.display !== 'none';
  const nextState = forceState !== undefined ? forceState : !isVisible;

  popover.style.display = nextState ? 'block' : 'none';
  if (btn) btn.classList.toggle('active', nextState);

  // Close fonts popover if open
  if (nextState) toggleFancyFontPicker(false);

  if (nextState) {
    switchEmojiCategory('popular');
    const search = document.getElementById('emoji-search-input');
    if (search) {
      search.value = '';
      search.focus();
    }
  }
}

/**
 * Toggle Fancy Font Popover
 */
function toggleFancyFontPicker(forceState) {
  const popover = document.getElementById('fancy-fonts-popover');
  const btn = document.getElementById('btn-fancy-font-toggle');
  if (!popover) return;

  const isVisible = popover.style.display !== 'none';
  const nextState = forceState !== undefined ? forceState : !isVisible;

  popover.style.display = nextState ? 'block' : 'none';
  if (btn) btn.classList.toggle('active', nextState);

  // Close emoji popover if open
  if (nextState) toggleEmojiPicker(false);

  if (nextState) {
    renderFancyFontPreviews();
  }
}

/**
 * Render Fancy Font Previews in Popover
 */
function renderFancyFontPreviews() {
  const listEl = document.getElementById('fancy-fonts-list');
  const textarea = document.getElementById('caption');
  if (!listEl) return;

  const text = textarea?.value.trim() || 'Connect Hub Studio';
  const sample = text.length > 35 ? text.substring(0, 35) + '…' : text;

  listEl.innerHTML = Object.entries(FONT_PREVIEW_NAMES).map(([key, name]) => {
    const preview = toFancyFont(sample, key);
    return `
      <div class="fancy-font-item" onclick="applyFancyFont('${key}')">
        <span class="fancy-font-name">${name}</span>
        <span class="fancy-font-preview">${preview}</span>
      </div>
    `;
  }).join('');
}

/**
 * Apply selected fancy font style to textarea selection or entire text
 */
function applyFancyFont(fontKey) {
  const textarea = document.getElementById('caption');
  if (!textarea) return;

  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const val = textarea.value;

  const selected = val.substring(start, end);
  const target = selected || val;

  if (!target.trim()) {
    if (typeof toast === 'function') toast('info', 'Type some text first');
    return;
  }

  const converted = toFancyFont(target, fontKey);

  if (selected) {
    textarea.value = val.substring(0, start) + converted + val.substring(end);
    textarea.setSelectionRange(start, start + converted.length);
  } else {
    textarea.value = converted;
  }

  onCaptionInput(textarea);
  toggleFancyFontPicker(false);
  textarea.focus();

  if (typeof toast === 'function') toast('success', `✨ Applied ${FONT_PREVIEW_NAMES[fontKey]}!`);
}

/**
 * Switch category tab in emoji picker
 */
function switchEmojiCategory(category) {
  const grid = document.getElementById('emoji-picker-grid');
  const tabs = document.querySelectorAll('.emoji-cat-tab');
  if (!grid) return;

  tabs.forEach(t => t.classList.toggle('active', t.dataset.cat === category));

  const list = CATEGORIZED_EMOJIS[category] || CATEGORIZED_EMOJIS.popular;
  renderEmojiGrid(list);
}

/**
 * Filter emoji picker grid with search term
 */
function filterEmojiPicker(query) {
  const cleanQ = query.toLowerCase().trim();
  const grid = document.getElementById('emoji-picker-grid');
  if (!grid) return;

  if (!cleanQ) {
    const activeTab = document.querySelector('.emoji-cat-tab.active');
    const cat = activeTab?.dataset.cat || 'popular';
    return renderEmojiGrid(CATEGORIZED_EMOJIS[cat] || CATEGORIZED_EMOJIS.popular);
  }

  const matched = new Set();
  for (const [kw, emojis] of Object.entries(EMOJI_DICTIONARY)) {
    if (kw.includes(cleanQ)) {
      emojis.forEach(e => matched.add(e));
    }
  }

  Object.values(CATEGORIZED_EMOJIS).flat().forEach(e => {
    if (e.includes(cleanQ)) matched.add(e);
  });

  const list = Array.from(matched);
  if (list.length > 0) {
    renderEmojiGrid(list);
  } else {
    grid.innerHTML = '<div class="emoji-picker-empty">No matching emojis found</div>';
  }
}

/**
 * Render grid of clickable emoji buttons
 */
function renderEmojiGrid(list) {
  const grid = document.getElementById('emoji-picker-grid');
  if (!grid) return;

  grid.innerHTML = list.map(e => `
    <button type="button" class="emoji-grid-btn" onclick="insertEmojiIntoCaption('${e}')" title="${e}">
      ${e}
    </button>
  `).join('');
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
  renderSmartEmojiSuggestions('');
  
  // Close popovers if clicking outside
  document.addEventListener('click', (e) => {
    const emojiPopover = document.getElementById('emoji-picker-popover');
    const emojiBtn = document.getElementById('btn-emoji-picker-toggle');
    if (emojiPopover && emojiPopover.style.display !== 'none') {
      if (!emojiPopover.contains(e.target) && !emojiBtn?.contains(e.target)) {
        emojiPopover.style.display = 'none';
        if (emojiBtn) emojiBtn.classList.remove('active');
      }
    }

    const fontPopover = document.getElementById('fancy-fonts-popover');
    const fontBtn = document.getElementById('btn-fancy-font-toggle');
    if (fontPopover && fontPopover.style.display !== 'none') {
      if (!fontPopover.contains(e.target) && !fontBtn?.contains(e.target)) {
        fontPopover.style.display = 'none';
        if (fontBtn) fontBtn.classList.remove('active');
      }
    }
  });
});

// Export globally
window.EmojiEngine = {
  getSmartEmojiSuggestions,
  autoEnhanceCaptionText,
  insertEmojiIntoCaption,
  onCaptionInput,
  renderSmartEmojiSuggestions,
  autoEnhanceCaptionEmojis,
  toggleEmojiPicker,
  switchEmojiCategory,
  filterEmojiPicker,
  applyTextFormat,
  applyAutoStylePreset,
  applyAutoHashtags,
  toggleFancyFontPicker,
  applyFancyFont
};
