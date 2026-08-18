import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { httpServer, wss } from '../server.js';

describe('Server REST API Integration Tests', () => {
  let baseUrl;

  before(async () => {
    // If server is not yet listening, wait for listening event
    if (!httpServer.listening) {
      await new Promise((resolve) => httpServer.once('listening', resolve));
    }
    const addr = httpServer.address();
    const port = typeof addr === 'object' && addr !== null ? addr.port : 4000;
    baseUrl = `http://localhost:${port}`;
  });

  after(() => {
    try {
      if (wss && typeof wss.close === 'function') wss.close();
      if (httpServer && typeof httpServer.close === 'function') httpServer.close();
    } catch (e) {}
  });

  test('GET /api/status should return system status envelope', async () => {
    const res = await fetch(`${baseUrl}/api/status`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data);
    assert.ok(json.data.whatsapp);
    assert.ok(json.data.telegram);
    assert.ok(json.data.engine);
  });

  test('GET /api/session/config should return session configuration', async () => {
    const res = await fetch(`${baseUrl}/api/session/config`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.config);
  });

  test('GET /api/history should return target history', async () => {
    const res = await fetch(`${baseUrl}/api/history`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.history);
  });

  test('GET /api/schedule/jobs should return scheduled jobs list', async () => {
    const res = await fetch(`${baseUrl}/api/schedule/jobs`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.jobs));
  });

  test('GET /api/downloader/status should return yt-dlp status', async () => {
    const res = await fetch(`${baseUrl}/api/downloader/status`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(typeof json.available, 'boolean');
  });

  test('POST /api/ai/transcribe-caption should synthesize AI caption', async () => {
    const res = await fetch(`${baseUrl}/api/ai/transcribe-caption`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Feature Announcement',
        transcript: 'We just launched our new updates',
        style: 'smart'
      })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.caption);
    assert.ok(json.headline);
    assert.ok(json.hashtags);
  });

  test('GET /api/nonexistent should return 404 with standard error envelope', async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent-route-12345`);
    assert.equal(res.status, 404);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(json.error.includes('not found'));
  });
});
