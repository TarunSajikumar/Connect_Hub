// ============================================================
// Emoji System Usage Examples
// Copy these examples into your app.js or HTML
// ============================================================

/**
 * EXAMPLE 1: Basic Emoji Enhancement
 * Add this to your HTML and emojis appear automatically
 */

// HTML example:
/*
<div class="section-title" data-emoji="whatsapp">WhatsApp Groups</div>
<div class="section-title" data-emoji="telegram">Telegram Channels</div>
<button data-emoji="download">Download Media</button>
<button data-emoji="upload">Upload Files</button>
<button data-emoji="schedule">Schedule Broadcast</button>
<button data-emoji="analytics">View Analytics</button>
*/

// Result: Emojis automatically appear before text ✅


/**
 * EXAMPLE 2: Enhance App Status Display
 * Add this to your fetchStatus() function
 */

async function enhanceStatusDisplay() {
  // Update connection status with emoji
  const statusEl = document.getElementById('nav-status-text');
  if (statusEl && state.wsReady) {
    statusEl.textContent = EmojiUtils.getEmojiSync('connected') + ' Server connected';
  } else if (statusEl) {
    statusEl.textContent = EmojiUtils.getEmojiSync('offline') + ' Server offline';
  }
}


/**
 * EXAMPLE 3: Enhance Platform Names in UI
 * Display WhatsApp and Telegram with emojis
 */

function displayPlatformWithEmoji(platform) {
  const emoji = {
    whatsapp: '💬',
    telegram: '✈️'
  }[platform] || '🌐';

  return `${emoji} ${platform.charAt(0).toUpperCase() + platform.slice(1)}`;
}

// Usage:
// console.log(displayPlatformWithEmoji('whatsapp')); // "💬 Whatsapp"
// console.log(displayPlatformWithEmoji('telegram')); // "✈️ Telegram"


/**
 * EXAMPLE 4: Enhance File Upload with Emoji
 * Show emoji based on file type
 */

function handleFileWithEmoji(file) {
  const type = file.type.split('/')[0];
  
  const typeEmoji = {
    video: '🎥',
    image: '📷',
    audio: '🎵',
    document: '📄'
  }[type] || '📁';

  const enhanced = `${typeEmoji} ${file.name}`;
  console.log(enhanced);
  
  return enhanced;
}

// Usage:
// handleFileWithEmoji(file); // "🎥 myvideo.mp4"


/**
 * EXAMPLE 5: Enhance Publishing Actions
 * Add emojis when publishing content
 */

async function publishWithEmoji(content, targets) {
  const startEmoji = EmojiUtils.getEmojiSync('broadcast');
  console.log(`${startEmoji} Publishing to ${targets.length} targets...`);

  // Publish process...
  
  const successEmoji = EmojiUtils.getEmojiSync('success');
  console.log(`${successEmoji} Published successfully!`);
}


/**
 * EXAMPLE 6: Enhance History/Timeline
 * Show emoji for each action type
 */

function renderHistoryWithEmoji(historyItems) {
  return historyItems.map(item => {
    const actionEmoji = {
      download: '⬇️',
      upload: '⬆️',
      publish: '📤',
      schedule: '⏰',
      delete: '🗑️'
    }[item.action] || '📋';

    return `${actionEmoji} ${item.action.toUpperCase()}: ${item.filename} (${item.timestamp})`;
  }).join('\n');
}

// Usage:
/*
const history = [
  { action: 'download', filename: 'video.mp4', timestamp: '2:30 PM' },
  { action: 'upload', filename: 'image.jpg', timestamp: '2:45 PM' },
  { action: 'publish', filename: 'video.mp4', timestamp: '3:00 PM' }
];

console.log(renderHistoryWithEmoji(history));
// Output:
// ⬇️ DOWNLOAD: video.mp4 (2:30 PM)
// ⬆️ UPLOAD: image.jpg (2:45 PM)
// 📤 PUBLISH: video.mp4 (3:00 PM)
*/


/**
 * EXAMPLE 7: Toast Notifications with Emoji
 * Enhance notification messages
 */

function showNotificationWithEmoji(type, message) {
  const typeEmoji = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }[type] || '📢';

  const fullMessage = `${typeEmoji} ${message}`;
  
  // Assuming you have a toast notification system
  showToast(fullMessage, type);
}

// Usage:
// showNotificationWithEmoji('success', 'File uploaded successfully');
// showNotificationWithEmoji('error', 'Failed to publish to WhatsApp');
// showNotificationWithEmoji('warning', 'Low storage space');


/**
 * EXAMPLE 8: Enhance Scheduled Jobs Display
 * Show emoji for scheduled action
 */

function renderScheduledJob(job) {
  const actionEmoji = EmojiUtils.getEmojiSync(job.action);
  const platformEmoji = {
    whatsapp: '💬',
    telegram: '✈️'
  }[job.platform] || '🌐';

  return {
    title: `${actionEmoji} ${job.title}`,
    platform: `${platformEmoji} ${job.platform}`,
    scheduled: `⏰ ${job.scheduledTime}`
  };
}


/**
 * EXAMPLE 9: Interactive Command Menu with Emojis
 * Create a fancy command-like interface
 */

function createEmojiMenu() {
  const menu = {
    'download': { emoji: '⬇️', label: 'Download Media', action: () => downloadMedia() },
    'upload': { emoji: '⬆️', label: 'Upload Files', action: () => uploadFiles() },
    'publish': { emoji: '📤', label: 'Publish Now', action: () => publishContent() },
    'schedule': { emoji: '⏰', label: 'Schedule Post', action: () => schedulePost() },
    'analytics': { emoji: '📊', label: 'View Analytics', action: () => showAnalytics() },
    'history': { emoji: '📜', label: 'View History', action: () => showHistory() }
  };

  for (const [key, item] of Object.entries(menu)) {
    const button = document.createElement('button');
    button.textContent = `${item.emoji} ${item.label}`;
    button.onclick = item.action;
    button.className = 'menu-button';
    // Add to your menu container
  }
}


/**
 * EXAMPLE 10: Dynamic Content with Async Emoji
 * For content loaded from server
 */

async function displayContentWithEmoji(content) {
  // For known types, use sync emoji
  if (content.type === 'video') {
    content.icon = EmojiUtils.getEmojiSync('video');
  } else if (content.type === 'photo') {
    content.icon = EmojiUtils.getEmojiSync('photo');
  } else {
    // For dynamic content, fetch async
    content.icon = await EmojiUtils.fetchEmojiCached(content.title);
  }

  // Render content with emoji
  return `${content.icon} ${content.title}`;
}


/**
 * EXAMPLE 11: Form Labels with Emoji
 * Enhanced form with emoji prefixes
 */

function enhanceFormLabels() {
  const formMapping = {
    'download-url': 'download',
    'upload-file': 'upload',
    'publish-to': 'broadcast',
    'schedule-time': 'schedule'
  };

  for (const [elementId, keyword] of Object.entries(formMapping)) {
    const label = document.querySelector(`label[for="${elementId}"]`);
    if (label) {
      EmojiUtils.updateElementWithEmoji(label, keyword);
    }
  }
}


/**
 * EXAMPLE 12: Category Badges
 * Create emoji badges for content categories
 */

function createCategoryBadge(category) {
  const emojis = EmojiUtils.getEmojisByCategory(category, 1);
  const badge = document.createElement('span');
  badge.className = 'category-badge';
  badge.textContent = `${emojis}${category}`;
  return badge;
}

// Usage:
// document.body.appendChild(createCategoryBadge('social'));
// Output: <span class="category-badge">💬social</span>


/**
 * EXAMPLE 13: Initialize Emoji System on App Load
 * Add this to your DOMContentLoaded
 */

function initEmojiSystemInApp() {
  // Process all data-emoji attributes
  EmojiUtils.processEmojiAttributes();

  // Enhance specific elements programmatically
  EmojiUtils.updateElementWithEmoji('#sync-btn', 'sync');
  
  // Listen for dynamic content and enhance it
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length) {
        // Re-process any new elements with data-emoji
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            const emojiElements = node.querySelectorAll?.('[data-emoji]');
            emojiElements?.forEach(el => {
              const keyword = el.dataset.emoji;
              EmojiUtils.updateElementWithEmoji(el, keyword);
            });
          }
        });
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}


/**
 * EXAMPLE 14: Cache Management for Performance
 * Monitor emoji cache usage
 */

function showEmojiStats() {
  const stats = EmojiUtils?.getEmojiStats?.() || { size: 0 };
  console.log(`Emoji cache size: ${stats.size}`);
}

// For backend Node.js:
/*
import { getEmojiCacheStats, clearEmojiCache } from './modules/emoji_generator.js';

// Log cache stats
console.log(getEmojiCacheStats());

// Clear cache periodically
setInterval(() => {
  if (getEmojiCacheStats().size > 100) {
    clearEmojiCache();
    console.log('Emoji cache cleared');
  }
}, 3600000); // Every hour
*/


/**
 * EXAMPLE 15: API Response Enhancement
 * Backend example - enhance API responses with emojis
 */

// In your server.js:
/*
import { generateEmojiTitle } from './modules/emoji_generator.js';

app.post('/api/publish', async (req, res) => {
  const { content, platforms } = req.body;

  // Enhance content with emoji
  const enhancedContent = {
    ...content,
    title: await generateEmojiTitle(content.title),
    icon: EmojiUtils.getEmojiSync(content.type)
  };

  // Publish to platforms
  const results = [];
  for (const platform of platforms) {
    const result = await publishTo(platform, enhancedContent);
    results.push({
      platform,
      emoji: { whatsapp: '💬', telegram: '✈️' }[platform],
      status: result.success ? '✅' : '❌'
    });
  }

  res.json({ results });
});
*/


// ============================================================
// INTEGRATION CHECKLIST
// ============================================================

/*
✅ 1. Add <script src="emoji-utils.js"></script> to HTML head/body
✅ 2. Add data-emoji="keyword" attributes to HTML elements
✅ 3. Call EmojiUtils.processEmojiAttributes() on page load
✅ 4. Use EmojiUtils.getEmojiSync(keyword) for instant emojis
✅ 5. Use EmojiUtils.fetchEmojiCached(keyword) for dynamic content
✅ 6. Import emoji_generator.js in server.js if using backend
✅ 7. Add emoji to notifications, toasts, and alerts
✅ 8. Test with various keywords from EMOJI_GUIDE.md

Supported Keywords:
- Platforms: whatsapp, telegram, instagram, youtube
- Actions: download, upload, publish, schedule, broadcast, sync, delete, edit, settings, analytics
- Content: video, photo, image, media, file, document
- Status: online, offline, connected, error, success, pending
- Categories: social, media, download, upload, schedule, broadcast, success, error
*/
