import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import AIAudioCaptioner from '../modules/ai_audio_captioner.js';

describe('AIAudioCaptioner Module Tests', () => {
  test('should generate smart default caption for general content', () => {
    const result = AIAudioCaptioner.generateCaption({
      title: 'Amazing Tech Guide',
      transcript: 'Here is how to optimize your setup',
      style: 'smart'
    });

    assert.ok(result.caption);
    assert.ok(result.headline);
    assert.ok(result.hashtags);
    assert.match(result.caption, /Amazing Tech Guide/);
  });

  test('should generate lyrical/music caption with music tags when song detected', () => {
    const result = AIAudioCaptioner.generateCaption({
      title: 'Thammil Thammil Ormakal Song',
      transcript: 'Mounam paadum gaanam',
      style: 'lyrical'
    });

    assert.equal(result.detectedType, 'Music & Lyrics');
    assert.match(result.caption, /🎧/);
    assert.match(result.hashtags, /#MalayalamSong|#Lyrics|#MusicVibes/);
  });

  test('should generate viral hook style caption', () => {
    const result = AIAudioCaptioner.generateCaption({
      title: 'Shocking Discovery',
      style: 'viral'
    });

    assert.match(result.caption, /🔥/);
    assert.match(result.caption, /Watch till the very end!/);
  });

  test('should generate speech summary caption with bullet points', () => {
    const result = AIAudioCaptioner.generateCaption({
      title: 'Keynote Address',
      transcript: 'Important business update for all members',
      style: 'speech_summary'
    });

    assert.match(result.caption, /🎙️/);
    assert.match(result.caption, /•/);
  });

  test('should generate aesthetic style caption', () => {
    const result = AIAudioCaptioner.generateCaption({
      title: 'Sunset Moments',
      style: 'aesthetic'
    });

    assert.match(result.caption, /aesthetic/i);
  });
});
