// ============================================================
// MEDIA DOWNLOADER — Unit & Integration Tests
// ============================================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app, parseMediaUrl } from '../server.js';

describe('Media Downloader Test Suite', () => {

  describe('1. URL Parsing & Platform Normalization', () => {
    it('should parse standard YouTube watch URLs', () => {
      const parsed = parseMediaUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      assert.equal(parsed.platform, 'youtube');
      assert.equal(parsed.videoId, 'dQw4w9WgXcQ');
      assert.equal(parsed.url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('should parse YouTube Shorts URLs', () => {
      const parsed = parseMediaUrl('https://youtube.com/shorts/oup55hcy9ps?si=123');
      assert.equal(parsed.platform, 'youtube');
      assert.equal(parsed.videoId, 'oup55hcy9ps');
      assert.equal(parsed.isShorts, true);
    });

    it('should parse YouTube Music URLs', () => {
      const parsed = parseMediaUrl('https://music.youtube.com/watch?v=dQw4w9WgXcQ');
      assert.equal(parsed.platform, 'youtube');
      assert.equal(parsed.videoId, 'dQw4w9WgXcQ');
      assert.equal(parsed.isMusic, true);
    });

    it('should parse youtu.be shortlinks', () => {
      const parsed = parseMediaUrl('https://youtu.be/jNQXAC9IVRw');
      assert.equal(parsed.platform, 'youtube');
      assert.equal(parsed.videoId, 'jNQXAC9IVRw');
    });

    it('should parse Instagram Reel and Post URLs', () => {
      const reel = parseMediaUrl('https://www.instagram.com/reel/C8mQ9p9p_Xx/?igsh=abc');
      assert.equal(reel.platform, 'instagram');
      assert.equal(reel.shortcode, 'C8mQ9p9p_Xx');

      const post = parseMediaUrl('https://instagram.com/p/DF12345/');
      assert.equal(post.platform, 'instagram');
      assert.equal(post.shortcode, 'DF12345');
    });

    it('should reject invalid or unsupported URLs', () => {
      assert.equal(parseMediaUrl(''), null);
      assert.equal(parseMediaUrl('not-a-url'), null);
      assert.equal(parseMediaUrl('https://example.com/video'), null);
    });
  });

  describe('2. Server REST Endpoints', () => {
    let server;
    const port = 4055;
    const baseUrl = `http://127.0.0.1:${port}`;

    before(async () => {
      server = app.listen(port);
      await new Promise(r => setTimeout(r, 200));
    });

    after(async () => {
      if (server) {
        if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
      }
      setTimeout(() => process.exit(0), 50).unref();
    });

    it('GET /api/health should return ok and cookie-free mode', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.status, 'ok');
      assert.equal(json.mode, 'cookie-free');
    });

    it('POST /api/fetch should reject empty body with 400', async () => {
      const res = await fetch(`${baseUrl}/api/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: '' })
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
    });

    it('POST /api/fetch should reject unsupported URL with 400', async () => {
      const res = await fetch(`${baseUrl}/api/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/something' })
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
    });

    it('GET /api/download should reject missing url query parameter', async () => {
      const res = await fetch(`${baseUrl}/api/download`);
      assert.equal(res.status, 400);
    });
  });
});
