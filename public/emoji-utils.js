// ============================================================
// Emoji Utility & Smart NLP Suggestion Engine — public/emoji-utils.js
// Live Contextual Emoji Recommendations & Auto-Enhancement
// ============================================================

/**
 * Extensive Contextual Keyword-to-Emoji Knowledge Dictionary
 * Supports exact words, prefixes, phrases, and emotional intents
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
  'thinking': ['🤔', '💭', '🧐'],
  'idea': ['💡', '🧠', '✨'],
  'mindblown': ['🤯', '💥', '⚡'],
  'shock': ['😱', '⚡', '👀'],
  'question': ['❓', '🤔', '💬'],

  // Tech, Media & Content
  'video': ['🎬', '🎥', '📹'],
  'reel': ['🎬', '📱', '🎥'],
  'short': ['🎬', '⚡', '📱'],
  'photo': ['📸', '📷', '🖼️'],
  'picture': ['🖼️', '📸', '🎨'],
  'image': ['🖼️', '📸', '🎨'],
  'media': ['🎬', '📁', '📸'],
  'music': ['🎵', '🎶', '🎧'],
  'song': ['🎵', '🎤', '🎶'],
  'audio': ['🔊', '🎵', '🎙️'],
  'voice': ['🎙️', '🗣️', '🔊'],
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
  'car': ['🚗', '🏎️', '💨'],

  // Attention & Numbers
  '1': ['1️⃣', '🥇'],
  '2': ['2️⃣', '🥈'],
  '3': ['3️⃣', '🥉'],
  '100': ['💯', '🔥'],
  'top': ['🔝', '👑', '🥇'],
  'danger': ['⚠️', '🚨', '⛔'],
  'stop': ['🛑', '⛔', '✋'],
  'start': ['🟢', '🚀', '🎬'],
  'finish': ['🏁', '✅', '🏆'],
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
  { emoji: '🚀', label: 'Launch', keyword: 'launch' },
  { emoji: '📢', label: 'Announcement', keyword: 'broadcast' },
  { emoji: '✨', label: 'Exciting', keyword: 'awesome' },
  { emoji: '👇', label: 'Check Below', keyword: 'click' },
  { emoji: '🎯', label: 'Target', keyword: 'goals' },
  { emoji: '🎉', label: 'Celebrate', keyword: 'celebrate' },
  { emoji: '💡', label: 'Idea', keyword: 'idea' },
  { emoji: '❤️', label: 'Love', keyword: 'love' },
  { emoji: '💰', label: 'Deals & Offers', keyword: 'money' },
  { emoji: '⚡', label: 'Instant', keyword: 'fast' },
  { emoji: '✅', label: 'Verified', keyword: 'check' }
];

/**
 * Get Smart Emoji Suggestions for given text
 * Analyzes the words, emotions, and last typed word to provide top relevant emojis
 * @param {string} text 
 * @returns {Array<{emoji: string, label: string, keyword: string}>}
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

  // 1. High Priority: Last word typed (immediate auto-complete suggestion)
  const lastWord = rawWords[rawWords.length - 1];
  if (lastWord) {
    if (EMOJI_DICTIONARY[lastWord]) {
      EMOJI_DICTIONARY[lastWord].forEach(e => addSuggestion(e, lastWord, lastWord));
    } else {
      // Prefix matching for incomplete typing (e.g. "rock" -> rocket)
      for (const [kw, emojis] of Object.entries(EMOJI_DICTIONARY)) {
        if (kw.startsWith(lastWord) && kw !== lastWord && lastWord.length >= 2) {
          emojis.forEach(e => addSuggestion(e, kw, kw));
        }
      }
    }
  }

  // 2. Full Context: Scan all words in the message
  for (let i = rawWords.length - 1; i >= 0; i--) {
    const word = rawWords[i];
    if (EMOJI_DICTIONARY[word]) {
      EMOJI_DICTIONARY[word].forEach(e => addSuggestion(e, word, word));
    }
  }

  // 3. Multi-word phrase matching
  const phraseChecks = [
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

  // 4. Fallback: Pad with trending starters if fewer than 6 suggestions
  if (suggestions.length < 8) {
    for (const starter of DEFAULT_STARTER_SUGGESTIONS) {
      if (!seenEmojis.has(starter.emoji)) {
        addSuggestion(starter.emoji, starter.label, starter.keyword);
        if (suggestions.length >= 10) break;
      }
    }
  }

  return suggestions.slice(0, 12);
}

/**
 * Automatically enhances caption text with natural, relevant emojis
 * @param {string} text 
 * @returns {string} enriched text
 */
function autoEnhanceCaptionText(text) {
  if (!text || !text.trim()) return text;

  let enriched = text;

  // Keyword rules to decorate
  const decorateRules = [
    { regex: /\b(launch|launching|launched)\b/gi, emoji: '🚀' },
    { regex: /\b(fire|hot|trending|viral)\b/gi, emoji: '🔥' },
    { regex: /\b(sale|discount|deal|deals|promo)\b/gi, emoji: '🏷️' },
    { regex: /\b(free)\b/gi, emoji: '🎁' },
    { regex: /\b(alert|urgent|important|warning)\b/gi, emoji: '🚨' },
    { regex: /\b(video|reel|shorts?)\b/gi, emoji: '🎬' },
    { regex: /\b(photo|picture|images?)\b/gi, emoji: '📸' },
    { regex: /\b(music|song|audio)\b/gi, emoji: '🎵' },
    { regex: /\b(winner|win|congrats|congratulations)\b/gi, emoji: '🎉' },
    { regex: /\b(love|heart)\b/gi, emoji: '❤️' },
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
    enriched = enriched.replace(rule.regex, (match) => {
      // Don't duplicate if emoji is already right next to it
      return `${match} ${rule.emoji}`;
    });
  }

  // Clean up any double spaces introduced
  enriched = enriched.replace(/ +/g, ' ').trim();

  // If text has no emoji at start and has excitement, add a leading emoji
  if (!/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu.test(enriched.slice(0, 4))) {
    const mainSuggestions = getSmartEmojiSuggestions(text);
    if (mainSuggestions.length > 0 && mainSuggestions[0].emoji) {
      enriched = `${mainSuggestions[0].emoji} ${enriched}`;
    }
  }

  return enriched;
}

/**
 * Insert emoji into the #caption textarea at current cursor position
 * @param {string} emoji 
 */
function insertEmojiIntoCaption(emoji) {
  const textarea = document.getElementById('caption');
  if (!textarea) return;

  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const text = textarea.value;

  const newText = text.substring(0, start) + emoji + text.substring(end);
  textarea.value = newText;

  // Restore cursor immediately after the inserted emoji
  const newPos = start + emoji.length;
  textarea.setSelectionRange(newPos, newPos);
  textarea.focus();

  // Update char count and refresh suggestions live
  if (typeof onCaptionInput === 'function') {
    onCaptionInput(textarea);
  }
}

/**
 * Handle live input in caption box: updates char count and renders smart emoji pills
 * @param {HTMLTextAreaElement} textarea 
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
 * @param {string} text 
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
 * @param {boolean} [forceState]
 */
function toggleEmojiPicker(forceState) {
  const popover = document.getElementById('emoji-picker-popover');
  const btn = document.getElementById('btn-emoji-picker-toggle');
  if (!popover) return;

  const isVisible = popover.style.display !== 'none';
  const nextState = forceState !== undefined ? forceState : !isVisible;

  popover.style.display = nextState ? 'block' : 'none';
  if (btn) btn.classList.toggle('active', nextState);

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
 * Switch category tab in emoji picker
 * @param {string} category 
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
 * @param {string} query 
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
  // Search dictionary keys
  for (const [kw, emojis] of Object.entries(EMOJI_DICTIONARY)) {
    if (kw.includes(cleanQ)) {
      emojis.forEach(e => matched.add(e));
    }
  }

  // Also include matching emojis from all categories
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
 * @param {string[]} list 
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
  
  // Close emoji picker if clicking outside
  document.addEventListener('click', (e) => {
    const popover = document.getElementById('emoji-picker-popover');
    const toggleBtn = document.getElementById('btn-emoji-picker-toggle');
    if (popover && popover.style.display !== 'none') {
      if (!popover.contains(e.target) && !toggleBtn?.contains(e.target)) {
        popover.style.display = 'none';
        if (toggleBtn) toggleBtn.classList.remove('active');
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
  filterEmojiPicker
};
