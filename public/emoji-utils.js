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

// ============================================================
// ── Text Styling & Unicode Fancy Fonts Engine ───────────────
// ============================================================

const FANCY_FONTS = {
  bold_sans: {
    name: 'Bold Sans (𝗕𝗼𝗹𝗱)',
    map: (str) => convertUnicode(str, 0x1D5D4, 0x1D5EE, 0x1D7EC)
  },
  bold_serif: {
    name: 'Bold Serif (𝐁𝐨𝐥𝐝)',
    map: (str) => convertUnicode(str, 0x1D400, 0x1D41A, 0x1D7CE)
  },
  bold_italic: {
    name: 'Bold Italic (𝑩𝒐𝒍𝒅 𝑰𝒕𝒂𝒍𝒊𝒄)',
    map: (str) => convertUnicode(str, 0x1D468, 0x1D482, null)
  },
  italic: {
    name: 'Italic (𝘐𝘵𝘢𝘭𝘪𝘤)',
    map: (str) => convertUnicode(str, 0x1D608, 0x1D622, null)
  },
  gothic: {
    name: 'Gothic (𝕭𝖔𝖑𝖉 𝕲𝖔𝖙𝖍𝖎𝖈)',
    map: (str) => convertUnicode(str, 0x1D56C, 0x1D586, null)
  },
  cursive: {
    name: 'Script Cursive (𝒞𝓊𝓇𝓈𝒾𝓋ℯ)',
    map: (str) => convertUnicode(str, 0x1D4D0, 0x1D4EA, null)
  },
  bubble: {
    name: 'Bubble Circle (🅑🅤🅑🅑🅛🅔)',
    map: (str) => convertBubble(str)
  },
  boxed: {
    name: 'Boxed Square (🄱🄾🅇🄴🄳)',
    map: (str) => convertBoxed(str)
  },
  spaced: {
    name: 'Wide / Spaced (Ｗｉｄｅ)',
    map: (str) => convertWide(str)
  }
};

function convertUnicode(str, upperBase, lowerBase, numBase) {
  return str.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90 && upperBase) {
      return String.fromCodePoint(upperBase + (code - 65));
    }
    if (code >= 97 && code <= 122 && lowerBase) {
      return String.fromCodePoint(lowerBase + (code - 97));
    }
    if (code >= 48 && code <= 57 && numBase) {
      return String.fromCodePoint(numBase + (code - 48));
    }
    return char;
  }).join('');
}

function convertBubble(str) {
  return str.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCodePoint(0x1F150 + (code - 65)); // 🅐-🅩
    if (code >= 97 && code <= 122) return String.fromCodePoint(0x24D0 + (code - 97)); // ⓐ-ⓩ
    if (code >= 49 && code <= 57) return String.fromCodePoint(0x2460 + (code - 49)); // ①-⑨
    if (code === 48) return '⓪';
    return char;
  }).join('');
}

function convertBoxed(str) {
  return str.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCodePoint(0x1F130 + (code - 65)); // 🄰-🅉
    if (code >= 97 && code <= 122) return String.fromCodePoint(0x1F130 + (code - 97));
    return char;
  }).join('');
}

function convertWide(str) {
  return str.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code >= 33 && code <= 126) return String.fromCharCode(code + 65248);
    if (code === 32) return '　';
    return char;
  }).join('');
}

/**
 * Apply WhatsApp / Telegram markdown format to selected text
 * @param {'bold'|'italic'|'strike'|'monospace'|'quote'|'bullet'} format 
 */
function applyTextFormat(format) {
  const textarea = document.getElementById('caption');
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selected = text.substring(start, end);

  let replacement = '';
  let cursorOffset = 0;

  if (format === 'bold') {
    replacement = selected ? `*${selected}*` : '*bold text*';
    cursorOffset = selected ? replacement.length : 1;
  } else if (format === 'italic') {
    replacement = selected ? `_${selected}_` : '_italic text_';
    cursorOffset = selected ? replacement.length : 1;
  } else if (format === 'strike') {
    replacement = selected ? `~${selected}~` : '~strike text~';
    cursorOffset = selected ? replacement.length : 1;
  } else if (format === 'monospace') {
    replacement = selected ? `\`${selected}\`` : '`code`';
    cursorOffset = selected ? replacement.length : 1;
  } else if (format === 'quote') {
    replacement = selected ? `❝ ${selected} ❞` : '❝ Quote ❞';
    cursorOffset = selected ? replacement.length : 2;
  } else if (format === 'bullet') {
    const target = selected || text;
    const bulleted = target.split(/\r?\n/).map(l => l.startsWith('• ') ? l : `• ${l}`).join('\n');
    if (selected) {
      replacement = bulleted;
    } else {
      textarea.value = bulleted;
      onCaptionInput(textarea);
      return;
    }
  }

  textarea.value = text.substring(0, start) + replacement + text.substring(end);
  const newPos = start + cursorOffset;
  textarea.setSelectionRange(newPos, newPos);
  textarea.focus();
  onCaptionInput(textarea);
}

/**
 * Convert selected text or entire caption to a fancy font style
 * @param {string} fontKey 
 */
function convertTextToFancyFont(fontKey) {
  const textarea = document.getElementById('caption');
  if (!textarea) return;

  const font = FANCY_FONTS[fontKey];
  if (!font) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selected = text.substring(start, end);

  if (selected) {
    const transformed = font.map(selected);
    textarea.value = text.substring(0, start) + transformed + text.substring(end);
    textarea.setSelectionRange(start + transformed.length, start + transformed.length);
  } else if (text.trim()) {
    textarea.value = font.map(text);
  } else {
    toast('info', '💡 Type some text first to apply fancy fonts!');
  }

  textarea.focus();
  onCaptionInput(textarea);
  toggleFancyFontPicker(false);
  toast('success', `✨ Applied ${font.name.split(' ')[0]} font style!`);
}

/**
 * Toggle fancy fonts popover
 * @param {boolean} [forceState] 
 */
function toggleFancyFontPicker(forceState) {
  const popover = document.getElementById('fancy-fonts-popover');
  const btn = document.getElementById('btn-fancy-font-toggle');
  if (!popover) return;

  const isVisible = popover.style.display !== 'none';
  const nextState = forceState !== undefined ? forceState : !isVisible;

  popover.style.display = nextState ? 'block' : 'none';
  if (btn) btn.classList.toggle('active', nextState);

  if (nextState) {
    renderFancyFontList();
  }
}

/**
 * Render list of fancy fonts with live preview
 */
function renderFancyFontList() {
  const listEl = document.getElementById('fancy-fonts-list');
  const textarea = document.getElementById('caption');
  if (!listEl) return;

  const sampleText = (textarea?.value.trim().slice(0, 24)) || 'Caption Style';

  listEl.innerHTML = Object.entries(FANCY_FONTS).map(([key, font]) => `
    <button type="button" class="fancy-font-item" onclick="convertTextToFancyFont('${key}')">
      <span class="fancy-font-name">${font.name}</span>
      <span class="fancy-font-preview">${font.map(sampleText)}</span>
    </button>
  `).join('');
}

/**
 * Automatically generate matching trending #hashtags
 */
function applyAutoHashtags() {
  const textarea = document.getElementById('caption');
  if (!textarea) return;

  const text = textarea.value.trim();
  if (!text) {
    toast('info', '💡 Write a caption or title first to generate matching hashtags!');
    textarea.focus();
    return;
  }

  const clean = text.toLowerCase();
  const tags = new Set(['#Trending', '#Status', '#Viral']);

  if (clean.includes('song') || clean.includes('ormakal') || clean.includes('music') || clean.includes('thammil') || clean.includes('lyrics') || clean.includes('audio')) {
    tags.add('#Song');
    tags.add('#LyricalStatus');
    tags.add('#MusicVibes');
    tags.add('#MalayalamStatus');
    tags.add('#ReelsAudio');
  }
  if (clean.includes('sale') || clean.includes('discount') || clean.includes('offer') || clean.includes('deal') || clean.includes('shop')) {
    tags.add('#SpecialOffer');
    tags.add('#MegaSale');
    tags.add('#Discount');
    tags.add('#LimitedDeal');
  }
  if (clean.includes('love') || clean.includes('heart') || clean.includes('romance')) {
    tags.add('#LoveStatus');
    tags.add('#Feelings');
    tags.add('#RomanticVibes');
  }
  if (clean.includes('sad') || clean.includes('alone') || clean.includes('broken')) {
    tags.add('#SadStatus');
    tags.add('#Heartbreak');
    tags.add('#Emotional');
  }
  if (clean.includes('news') || clean.includes('alert') || clean.includes('launch') || clean.includes('update')) {
    tags.add('#BreakingNews');
    tags.add('#NewUpdate');
    tags.add('#OfficialAnnouncement');
  }

  tags.add('#InstagramReels');
  tags.add('#WhatsAppStatus');

  const tagString = Array.from(tags).slice(0, 6).join(' ');
  textarea.value = `${text}\n\n${tagString}`;
  onCaptionInput(textarea);
  toast('success', '🏷️ Matching #hashtags generated and added!');
}

/**
 * One-Click AI Auto-Style Presets
 * @param {'smart'|'viral'|'music'|'promo'|'aesthetic'|'whatsapp'|'quotes'} presetName 
 */
function applyAutoStylePreset(presetName) {
  const textarea = document.getElementById('caption');
  if (!textarea) return;

  let text = textarea.value.trim();
  if (!text) {
    text = 'Your Caption Here';
  }

  // Strip existing decorative dividers to prevent double formatting
  text = text.replace(/^[🔥🎵🚨✨❝*#\s─═━⋆⋅☆\n]+/, '')
             .replace(/[🔥🎵🚨✨❞*#\s─═━⋆⋅☆\n]+$/, '')
             .split('\n')[0].trim();

  let formatted = '';

  if (presetName === 'smart') {
    const clean = text.toLowerCase();
    if (clean.includes('song') || clean.includes('music') || clean.includes('ormakal') || clean.includes('lyrics') || clean.includes('melody') || clean.includes('thammil')) {
      presetName = 'music';
    } else if (clean.includes('sale') || clean.includes('discount') || clean.includes('offer') || clean.includes('deal') || clean.includes('alert')) {
      presetName = 'promo';
    } else if (clean.includes('quote') || clean.includes('love') || clean.includes('sad') || clean.includes('life')) {
      presetName = 'quotes';
    } else {
      presetName = 'viral';
    }
  }

  switch (presetName) {
    case 'viral':
      formatted = `🔥 ─── 【 ${text.toUpperCase()} 】 ─── 🔥\n\n✨ Best Quality Status · Watch till end! ✨\n\n👇 Save & Share with Friends ❤️\n#Trending #Viral #Explore #Reels #WhatsAppStatus`;
      break;
    case 'music':
      formatted = `🎵 ─── ⋆⋅☆⋅⋆ ─── 🎵\n\n🎧 *${text}* ✨\n\n💫 Best with Headphones · Feel the Vibe 🍂\n\n#Song #MusicVibes #MalayalamStatus #Lyrical #Trending`;
      break;
    case 'promo':
      formatted = `🚨 *SPECIAL BROADCAST: ${text.toUpperCase()}* 🚨\n\n👉 Exclusive updates live now! ⚡\n\n🔗 Tap the link below to get started 👇\n⏳ Limited Time Offer 🏷️\n\n#SpecialOffer #Update #Alert #Trending`;
      break;
    case 'aesthetic':
      formatted = `✧･ﾟ: *✧･ﾟ:*  ${text}  *:･ﾟ✧*:･ﾟ✧\n\n🌿 Peace & Vibes ✨\n#Aesthetic #Mood #DailyVibes`;
      break;
    case 'whatsapp':
      formatted = `*📢 ${text}*\n\n• ✅ Original High Quality\n• ⚡ Instant Share\n• 💬 Broadcasted to WhatsApp & Telegram\n\n#WhatsAppStatus #DailyUpdate`;
      break;
    case 'quotes':
      formatted = `❝ ${text} ❞\n\n✨ True Feelings · Save & Share ❤️\n#Quotes #Feelings #Vibes #DailyQuotes`;
      break;
    default:
      formatted = `🔥 ${text} ✨\n\n#Trending #Status`;
  }

  textarea.value = formatted;
  onCaptionInput(textarea);
  toast('success', `🪄 Applied "${presetName.toUpperCase()}" auto-style preset with emojis!`);
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
  renderSmartEmojiSuggestions('');
  
  // Close popovers if clicking outside
  document.addEventListener('click', (e) => {
    const emojiPop = document.getElementById('emoji-picker-popover');
    const emojiBtn = document.getElementById('btn-emoji-picker-toggle');
    if (emojiPop && emojiPop.style.display !== 'none') {
      if (!emojiPop.contains(e.target) && !emojiBtn?.contains(e.target)) {
        emojiPop.style.display = 'none';
        if (emojiBtn) emojiBtn.classList.remove('active');
      }
    }

    const fontPop = document.getElementById('fancy-fonts-popover');
    const fontBtn = document.getElementById('btn-fancy-font-toggle');
    if (fontPop && fontPop.style.display !== 'none') {
      if (!fontPop.contains(e.target) && !fontBtn?.contains(e.target)) {
        fontPop.style.display = 'none';
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
  convertTextToFancyFont,
  toggleFancyFontPicker,
  applyAutoHashtags,
  applyAutoStylePreset
};

