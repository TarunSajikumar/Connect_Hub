// ============================================================
// Emoji Utility — public/emoji-utils.js
// Client-side emoji generation for UI titles and labels
// ============================================================

/**
 * Emoji mappings for instant UI enhancement
 */
const EMOJI_MAP = {
  // Social platforms
  whatsapp: '💬',
  telegram: '✈️',
  instagram: '📸',
  youtube: '📺',
  
  // Actions
  download: '⬇️',
  upload: '⬆️',
  publish: '📤',
  schedule: '⏰',
  broadcast: '📢',
  sync: '🔄',
  delete: '🗑️',
  edit: '✏️',
  settings: '⚙️',
  analytics: '📊',
  history: '📜',
  
  // Content
  video: '🎥',
  photo: '📷',
  image: '🖼️',
  media: '🎬',
  file: '📁',
  document: '📄',
  
  // Status
  online: '🟢',
  offline: '⛔',
  connected: '✅',
  error: '❌',
  success: '✅',
  pending: '⏳',
  
  // UI
  dashboard: '📊',
  studio: '🎨',
  hub: '🏢',
  quality: '⭐',
  everywhere: '🌍',
};

/**
 * Get emoji for a keyword instantly (from local map)
 * @param {string} keyword 
 * @returns {string} emoji character
 */
function getEmojiSync(keyword) {
  const normalized = keyword.toLowerCase().trim();
  return EMOJI_MAP[normalized] || '';
}

/**
 * Enhance a title with emoji
 * @param {string} title 
 * @param {string} keyword - optional keyword to search for
 * @returns {string} enhanced title
 */
function enhanceTitleWithEmoji(title, keyword = null) {
  if (!title) return title;

  const searchKeyword = keyword || extractMainKeyword(title);
  const emoji = getEmojiSync(searchKeyword);

  return emoji ? `${emoji} ${title}` : title;
}

/**
 * Extract main keyword from title (simple heuristic)
 * @param {string} title 
 * @returns {string}
 */
function extractMainKeyword(title) {
  const words = title.toLowerCase().split(/\s+/);
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through'
  ]);

  for (const word of words) {
    if (word.length > 2 && !stopWords.has(word) && EMOJI_MAP[word]) {
      return word;
    }
  }

  return words[0] || '';
}

/**
 * Get emojis for a category
 * @param {string} category 
 * @param {number} count 
 * @returns {string}
 */
function getEmojisByCategory(category, count = 1) {
  const categories = {
    social: ['💬', '👥', '📢'],
    media: ['🎥', '📷', '📸'],
    download: ['⬇️', '💾', '📥'],
    upload: ['⬆️', '📤', '🔼'],
    schedule: ['⏰', '📅', '⏳'],
    broadcast: ['📢', '📡', '📻'],
    success: ['✅', '🎉', '✨'],
    error: ['❌', '⚠️', '🚨'],
  };

  const emojis = categories[category.toLowerCase()] || [];
  return emojis.slice(0, count).join('');
}

/**
 * Update UI element text to include emoji
 * @param {string|HTMLElement} selector 
 * @param {string} keyword 
 */
function updateElementWithEmoji(selector, keyword) {
  const element = typeof selector === 'string' 
    ? document.querySelector(selector) 
    : selector;

  if (!element) return;

  const currentText = element.textContent || element.innerText;
  const enhanced = enhanceTitleWithEmoji(currentText, keyword);
  
  if (element.textContent !== undefined) {
    element.textContent = enhanced;
  } else {
    element.innerText = enhanced;
  }
}

/**
 * Add emoji to all matching elements by attribute
 * Example: <h1 data-emoji="download">Download Files</h1>
 */
function processEmojiAttributes() {
  const elements = document.querySelectorAll('[data-emoji]');
  elements.forEach(el => {
    const keyword = el.dataset.emoji;
    updateElementWithEmoji(el, keyword);
  });
}

/**
 * Enhance content in a container by finding text nodes
 * @param {HTMLElement} container 
 * @param {Object} keywords - mapping of text to keywords
 */
function enhanceContainerContent(container, keywords = {}) {
  if (!container) return;

  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  const nodesToUpdate = [];

  while (node = walker.nextNode()) {
    const text = node.textContent.trim();
    if (text.length > 0) {
      nodesToUpdate.push({ node, text });
    }
  }

  nodesToUpdate.forEach(({ node, text }) => {
    const keyword = keywords[text] || extractMainKeyword(text);
    const emoji = getEmojiSync(keyword);
    
    if (emoji && !node.textContent.startsWith(emoji)) {
      node.textContent = `${emoji} ${text}`;
    }
  });
}

/**
 * Create an emoji-enhanced badge
 * @param {string} text 
 * @param {string} keyword 
 * @returns {HTMLElement}
 */
function createEmojiBadge(text, keyword = null) {
  const badge = document.createElement('span');
  const searchKeyword = keyword || extractMainKeyword(text);
  const emoji = getEmojiSync(searchKeyword);

  badge.className = 'emoji-badge';
  badge.innerHTML = emoji ? `<span class="emoji">${emoji}</span> ${text}` : text;
  
  return badge;
}

/**
 * Add CSS for emoji badges if not already present
 */
function initEmojiBadgeStyles() {
  if (document.getElementById('emoji-badge-styles')) return;

  const style = document.createElement('style');
  style.id = 'emoji-badge-styles';
  style.textContent = `
    .emoji-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4em;
      font-family: inherit;
      font-size: inherit;
    }

    .emoji-badge .emoji {
      display: inline-block;
      font-size: 1.2em;
      line-height: 1;
    }

    .emoji-badge-button {
      display: inline-flex;
      align-items: center;
      gap: 0.6em;
      padding: 0.5em 1em;
      border-radius: 6px;
      border: 1px solid #ccc;
      background: #f5f5f5;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .emoji-badge-button:hover {
      background: #e8e8e8;
      border-color: #999;
    }

    .emoji-badge-button .emoji {
      font-size: 1.3em;
    }
  `;

  document.head.appendChild(style);
}

/**
 * Fetch emoji from emojidb.org API (async version)
 * @param {string} keyword 
 * @returns {Promise<string>}
 */
async function fetchEmojiFromDB(keyword) {
  try {
    const url = `https://emojidb.org/${encodeURIComponent(keyword)}-emojis`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error('Failed to fetch');

    const html = await response.text();
    
    // Simple regex to extract emoji characters
    const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
    const emojis = html.match(emojiRegex) || [];
    const uniqueEmojis = [...new Set(emojis)];
    
    // Return first relevant emoji
    return uniqueEmojis.filter(e => !['👎', '🔎'].includes(e))[0] || '';
  } catch (error) {
    console.warn(`Failed to fetch emoji for "${keyword}":`, error);
    return getEmojiSync(keyword);
  }
}

/**
 * Fetch and cache emoji from emojidb.org
 * @param {string} keyword 
 * @returns {Promise<string>}
 */
async function fetchEmojiCached(keyword) {
  const cacheKey = `emoji_${keyword}`;
  const cached = sessionStorage.getItem(cacheKey);
  
  if (cached) return cached;

  const emoji = await fetchEmojiFromDB(keyword);
  if (emoji) {
    sessionStorage.setItem(cacheKey, emoji);
  }
  
  return emoji || getEmojiSync(keyword);
}

/**
 * Initialize emoji system on page load
 */
function initEmojiSystem() {
  initEmojiBadgeStyles();
  processEmojiAttributes();
  
  // Process any async emojis if needed
  const asyncElements = document.querySelectorAll('[data-emoji-async]');
  asyncElements.forEach(async el => {
    const keyword = el.dataset.emojiAsync;
    const emoji = await fetchEmojiCached(keyword);
    updateElementWithEmoji(el, keyword);
  });
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEmojiSystem);
} else {
  initEmojiSystem();
}

// Export functions for use in other scripts
window.EmojiUtils = {
  getEmojiSync,
  enhanceTitleWithEmoji,
  updateElementWithEmoji,
  processEmojiAttributes,
  getEmojisByCategory,
  createEmojiBadge,
  enhanceContainerContent,
  fetchEmojiFromDB,
  fetchEmojiCached,
  initEmojiSystem,
  clearCache: () => sessionStorage.clear(),
};
