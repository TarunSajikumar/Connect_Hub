// ============================================================
// Emoji Generator — modules/emoji_generator.js
// Fetches relevant emojis from emojidb.org based on keywords
// ============================================================

/**
 * Common emoji mappings for quick lookup (cache)
 */
const emojiCache = new Map();

/**
 * Predefined emoji suggestions for common keywords
 * Used as fallback when API calls are unavailable
 */
const emojiMappings = {
  // Social & Communication
  'whatsapp': '💬',
  'telegram': '✈️',
  'message': '💭',
  'chat': '💬',
  'channel': '📺',
  'group': '👥',
  'broadcast': '📢',
  'publish': '📤',
  'download': '⬇️',
  'upload': '⬆️',
  
  // Media
  'video': '🎥',
  'photo': '📷',
  'image': '🖼️',
  'media': '🎬',
  'file': '📁',
  'document': '📄',
  'youtube': '📺',
  'instagram': '📸',
  '4k': '🎬',
  'hd': '🎬',
  
  // Actions
  'schedule': '⏰',
  'automate': '🤖',
  'sync': '🔄',
  'analytics': '📊',
  'history': '📜',
  'save': '💾',
  'delete': '🗑️',
  'edit': '✏️',
  'settings': '⚙️',
  
  // Status
  'online': '🟢',
  'offline': '⛔',
  'connected': '✅',
  'error': '❌',
  'pending': '⏳',
  'success': '✅',
  
  // General
  'hub': '🏢',
  'studio': '🎨',
  'broadcast': '📡',
  'quality': '⭐',
  'original': '🎯',
  'everywhere': '🌍',
  'content': '📝',
  'dashboard': '📊',
};

/**
 * Fetch emoji from emojidb.org API
 * Falls back to local mapping if not found
 * 
 * @param {string} keyword - The keyword to search for emojis
 * @param {number} limit - Number of emojis to return (default: 3)
 * @returns {Promise<string[]>} - Array of emoji characters
 */
export async function fetchEmojisForKeyword(keyword, limit = 3) {
  if (!keyword || keyword.trim() === '') {
    return [];
  }

  const normalizedKeyword = keyword.toLowerCase().trim();

  // Check cache first
  if (emojiCache.has(normalizedKeyword)) {
    return emojiCache.get(normalizedKeyword).slice(0, limit);
  }

  // Try to fetch from API
  try {
    const emojis = await fetchFromEmojiDB(normalizedKeyword, limit);
    if (emojis.length > 0) {
      emojiCache.set(normalizedKeyword, emojis);
      return emojis;
    }
  } catch (error) {
    console.warn(`Failed to fetch emojis for "${keyword}":`, error);
  }

  // Fallback to local mappings
  const localEmojis = getFallbackEmojis(normalizedKeyword, limit);
  if (localEmojis.length > 0) {
    emojiCache.set(normalizedKeyword, localEmojis);
    return localEmojis;
  }

  return [];
}

/**
 * Fetch emojis directly from emojidb.org
 * Attempts to parse emoji data from the search page
 * 
 * @param {string} keyword - The search keyword
 * @param {number} limit - Number of emojis to fetch
 * @returns {Promise<string[]>}
 */
async function fetchFromEmojiDB(keyword, limit) {
  const url = `https://emojidb.org/${encodeURIComponent(keyword)}-emojis`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const emojis = extractEmojisFromHTML(html, limit);
    return emojis;
  } catch (error) {
    throw error;
  }
}

/**
 * Extract emoji characters from emojidb.org HTML response
 * Uses regex to find emoji characters in the page
 * 
 * @param {string} html - HTML content from emojidb.org
 * @param {number} limit - Maximum number of emojis to extract
 * @returns {string[]} - Array of unique emoji characters
 */
function extractEmojisFromHTML(html, limit) {
  // Regex pattern to match emoji characters (including multi-codepoint emojis)
  const emojiPattern = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  
  const matches = html.match(emojiPattern) || [];
  const uniqueEmojis = [...new Set(matches)];
  
  // Filter out common non-relevant characters and return top results
  return uniqueEmojis
    .filter(e => !['👎', '🔎', '📂', '📁', '🔔'].includes(e))
    .slice(0, limit);
}

/**
 * Get fallback emojis from local mapping
 * Searches for keyword matches and returns relevant emojis
 * 
 * @param {string} keyword - The search keyword
 * @param {number} limit - Number of emojis to return
 * @returns {string[]}
 */
function getFallbackEmojis(keyword, limit) {
  // Direct match
  if (emojiMappings[keyword]) {
    return [emojiMappings[keyword]];
  }

  // Partial match
  const matches = [];
  for (const [key, emoji] of Object.entries(emojiMappings)) {
    if (keyword.includes(key) || key.includes(keyword)) {
      matches.push(emoji);
      if (matches.length >= limit) break;
    }
  }

  return matches.length > 0 ? matches : [];
}

/**
 * Generate emoji-enhanced title from text
 * Fetches emoji and prepends to the title
 * 
 * @param {string} text - The text/title to enhance
 * @param {number} emojiCount - Number of emojis to add (default: 1)
 * @returns {Promise<string>} - Enhanced title with emojis
 */
export async function generateEmojiTitle(text, emojiCount = 1) {
  if (!text || text.trim() === '') {
    return text;
  }

  // Try to extract meaningful keywords from the text
  const keywords = extractKeywords(text);
  
  if (keywords.length === 0) {
    return text;
  }

  // Fetch emojis for the primary keyword
  const emojis = await fetchEmojisForKeyword(keywords[0], emojiCount);
  
  if (emojis.length === 0) {
    return text;
  }

  return `${emojis.join('')} ${text}`;
}

/**
 * Extract meaningful keywords from text
 * Removes common stop words and extracts main terms
 * 
 * @param {string} text - The text to extract keywords from
 * @returns {string[]} - Array of keywords
 */
function extractKeywords(text) {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during'
  ]);

  const words = text.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 3); // Get top 3 keywords

  return words;
}

/**
 * Get emoji for a specific category/topic
 * 
 * @param {string} category - Category name (e.g., 'social', 'media', 'action')
 * @param {number} count - Number of emojis (default: 1)
 * @returns {string[]} - Array of emoji characters
 */
export function getCategoryEmojis(category, count = 1) {
  const categories = {
    social: ['💬', '👥', '📢', '🌐', '✈️'],
    media: ['🎥', '📷', '📸', '🎬', '📺'],
    download: ['⬇️', '💾', '📥', '🔽', '📦'],
    upload: ['⬆️', '📤', '🔼', '📁', '📦'],
    schedule: ['⏰', '📅', '⏳', '🕐', '📆'],
    broadcast: ['📢', '📡', '📻', '🔊', '📣'],
    success: ['✅', '🎉', '✨', '🌟', '⭐'],
    error: ['❌', '⚠️', '🚨', '⛔', '💥'],
  };

  const emojis = categories[category.toLowerCase()] || [];
  return emojis.slice(0, count);
}

/**
 * Batch fetch emojis for multiple keywords
 * 
 * @param {string[]} keywords - Array of keywords
 * @param {number} eachLimit - Emojis per keyword
 * @returns {Promise<Object>} - Object mapping keywords to emoji arrays
 */
export async function batchFetchEmojis(keywords, eachLimit = 1) {
  const results = {};

  for (const keyword of keywords) {
    results[keyword] = await fetchEmojisForKeyword(keyword, eachLimit);
  }

  return results;
}

/**
 * Clear emoji cache
 * Call this if you want to refresh emoji data from the API
 */
export function clearEmojiCache() {
  emojiCache.clear();
}

/**
 * Get emoji cache stats
 * Returns information about cached emojis
 * 
 * @returns {Object} - Cache statistics
 */
export function getEmojiCacheStats() {
  return {
    size: emojiCache.size,
    entries: Array.from(emojiCache.entries()).map(([keyword, emojis]) => ({
      keyword,
      emojis: emojis.join(''),
      count: emojis.length
    }))
  };
}
