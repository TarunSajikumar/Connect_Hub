// ============================================================
// MEDIA DOWNLOADER — Unit & Integration Tests
// ============================================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app, extractYouTubeId, extractInstagramShortcode } from '../server.js';

describe('Media Downloader Test Suite', () => {

  describe('1. URL Parsing & Platform Normalization', () => {
    it('should parse standard YouTube watch URLs', () => {
      const id = extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      assert.equal(id, 'dQw4w9WgXcQ');
    });

    it('should parse YouTube Shorts URLs', () => {
      const id = extractYouTubeId('https://youtube.com/shorts/oup55hcy9ps?si=123');
      assert.equal(id, 'oup55hcy9ps');
    });

    it('should parse YouTube Music URLs', () => {
      const id = extractYouTubeId('https://music.youtube.com/watch?v=dQw4w9WgXcQ');
      assert.equal(id, 'dQw4w9WgXcQ');
    });

    it('should parse youtu.be shortlinks', () => {
      const id = extractYouTubeId('https://youtu.be/jNQXAC9IVRw');
      assert.equal(id, 'jNQXAC9IVRw');
    });

    it('should parse Instagram Reel and Post URLs', () => {
      const reel = extractInstagramShortcode('https://www.instagram.com/reel/C8mQ9p9p_Xx/?igsh=abc');
      assert.equal(reel, 'C8mQ9p9p_Xx');

      const post = extractInstagramShortcode('https://instagram.com/p/DF12345/');
      assert.equal(post, 'DF12345');
    });

    it('should reject invalid or unsupported URLs', () => {
      assert.equal(extractYouTubeId(''), null);
      assert.equal(extractYouTubeId('not-a-url'), null);
      assert.equal(extractYouTubeId('https://example.com/video'), null);
      assert.equal(extractInstagramShortcode('https://example.com/reel/123'), null);
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

    it('POST /api/youtube should reject empty body with 400', async () => {
      const res = await fetch(`${baseUrl}/api/youtube`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: '' })
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.ok(json.error);
    });

    it('POST /api/youtube should reject unsupported URL with 400', async () => {
      const res = await fetch(`${baseUrl}/api/youtube`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/something' })
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.ok(json.error);
    });

    it('GET /api/youtube/download should reject missing url parameter', async () => {
      const res = await fetch(`${baseUrl}/api/youtube/download`);
      assert.equal(res.status, 400);
    });

    it('POST /api/instagram should reject empty body with 400', async () => {
      const res = await fetch(`${baseUrl}/api/instagram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: '' })
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.ok(json.error);
    });

    it('GET /api/instagram/download should reject missing url parameter', async () => {
      const res = await fetch(`${baseUrl}/api/instagram/download`);
      assert.equal(res.status, 400);
    });
  });
});
