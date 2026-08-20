// ============================================================
// MEDIA DOWNLOADER — Unit & Integration Test Suite
// ============================================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app, extractYouTubeId, extractInstagramUrl } from '../server.js';

describe('Media Downloader API & Extraction Tests', () => {

  describe('1. URL Parsing & Helpers', () => {
    it('should extract YouTube video ID from standard URLs', () => {
      assert.equal(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    });

    it('should extract YouTube video ID from Shorts URLs', () => {
      assert.equal(extractYouTubeId('https://youtube.com/shorts/oup55hcy9ps?si=123'), 'oup55hcy9ps');
    });

    it('should extract YouTube video ID from youtu.be shortlinks', () => {
      assert.equal(extractYouTubeId('https://youtu.be/jNQXAC9IVRw'), 'jNQXAC9IVRw');
    });

    it('should extract Instagram URL for Reels and Posts', () => {
      assert.equal(
        extractInstagramUrl('https://www.instagram.com/reel/C8mQ9p9p_Xx/?igsh=abc'),
        'https://www.instagram.com/reel/C8mQ9p9p_Xx/'
      );
      assert.equal(
        extractInstagramUrl('https://instagram.com/p/DF12345/'),
        'https://www.instagram.com/p/DF12345/'
      );
    });

    it('should reject invalid or unsupported URLs', () => {
      assert.equal(extractYouTubeId(''), null);
      assert.equal(extractYouTubeId('https://example.com/video'), null);
      assert.equal(extractInstagramUrl('https://example.com/photo'), null);
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

    it('GET /api/health should return ok', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.status, 'ok');
      assert.equal(json.mode, 'cookie-free');
    });

    it('POST /api/youtube should reject empty URL with 400', async () => {
      const res = await fetch(`${baseUrl}/api/youtube`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: '' })
      });
      assert.equal(res.status, 400);
    });

    it('POST /api/instagram should reject empty URL with 400', async () => {
      const res = await fetch(`${baseUrl}/api/instagram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: '' })
      });
      assert.equal(res.status, 400);
    });

    it('GET /api/youtube/download should reject missing URL with 400', async () => {
      const res = await fetch(`${baseUrl}/api/youtube/download`);
      assert.equal(res.status, 400);
    });

    it('GET /api/instagram/download should reject missing URL with 400', async () => {
      const res = await fetch(`${baseUrl}/api/instagram/download`);
      assert.equal(res.status, 400);
    });

    it('POST /api/fetch should route YouTube and Instagram URLs', async () => {
      const res = await fetch(`${baseUrl}/api/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/invalid' })
      });
      assert.equal(res.status, 400);
    });
  });
});
