import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import SessionManager from '../modules/session_manager.js';

describe('SessionManager Module Tests', () => {
  let tmpDir;
  let sessionManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sess_test_'));
    sessionManager = new SessionManager(tmpDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {}
  });

  test('should initialize with default configuration', () => {
    const config = sessionManager.getConfig();
    assert.equal(config.rememberMe, true);
    assert.equal(typeof config.whatsappEngine, 'string');
    assert.ok(config.openwa);
  });

  test('should update and persist rememberMe setting', () => {
    sessionManager.setRememberMe(false);
    assert.equal(sessionManager.getConfig().rememberMe, false);

    // Verify persistence from file
    const sm2 = new SessionManager(tmpDir);
    assert.equal(sm2.getConfig().rememberMe, false);
  });

  test('should update whatsapp engine selection', () => {
    sessionManager.setWhatsappEngine('baileys');
    assert.equal(sessionManager.getConfig().whatsappEngine, 'baileys');

    sessionManager.setWhatsappEngine('openwa');
    assert.equal(sessionManager.getConfig().whatsappEngine, 'openwa');
  });

  test('should update OpenWA gateway configuration', () => {
    sessionManager.setOpenWaConfig({
      url: 'http://my-gateway:3000/api/',
      apiKey: 'test-key-123',
      sessionName: 'my_session#1'
    });

    const cfg = sessionManager.getConfig().openwa;
    assert.equal(cfg.url, 'http://my-gateway:3000/api');
    assert.equal(cfg.apiKey, 'test-key-123');
    assert.equal(cfg.sessionName, 'my-session-1');
  });

  test('should manage auto-connect flags and clear sessions', () => {
    sessionManager.setTelegramAutoConnect(true, '123:token');
    assert.equal(sessionManager.getConfig().telegram.autoConnect, true);
    assert.equal(sessionManager.getConfig().telegram.token, '123:token');

    sessionManager.clearTelegramSession();
    assert.equal(sessionManager.getConfig().telegram.autoConnect, false);
    assert.equal(sessionManager.getConfig().telegram.token, null);
  });
});
