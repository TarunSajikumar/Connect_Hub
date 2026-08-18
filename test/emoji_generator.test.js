import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchEmojisForKeyword,
  generateEmojiTitle,
  getCategoryEmojis
} from '../modules/emoji_generator.js';

describe('Emoji Generator Module Tests', () => {
  test('should return empty array for empty keyword', async () => {
    const res = await fetchEmojisForKeyword('');
    assert.deepEqual(res, []);
  });

  test('should return matching emojis for common mapped keywords', async () => {
    const wa = await fetchEmojisForKeyword('whatsapp');
    assert.ok(wa.length > 0);
    assert.equal(typeof wa[0], 'string');

    const tg = await fetchEmojisForKeyword('telegram');
    assert.ok(tg.length > 0);
    assert.equal(typeof tg[0], 'string');
  });

  test('should generate emoji-enhanced title', async () => {
    const enhanced = await generateEmojiTitle('WhatsApp Broadcast', 1);
    assert.ok(enhanced.includes('WhatsApp Broadcast'));
    assert.ok(enhanced.startsWith('💬') || enhanced.length > 'WhatsApp Broadcast'.length);
  });

  test('should return emojis for standard categories', () => {
    const social = getCategoryEmojis('social', 3);
    assert.equal(social.length, 3);

    const media = getCategoryEmojis('media', 2);
    assert.equal(media.length, 2);
  });
});
