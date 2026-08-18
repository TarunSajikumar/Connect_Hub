import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import HistoryManager from '../modules/history.js';

describe('HistoryManager Module Tests', () => {
  let tmpDir;
  let historyManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hist_test_'));
    historyManager = new HistoryManager(tmpDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {}
  });

  test('should initialize with empty history if file does not exist', () => {
    const all = historyManager.getAllHistory();
    assert.deepEqual(all.whatsapp, []);
    assert.deepEqual(all.telegram, []);
  });

  test('should record and persist WhatsApp targets', () => {
    historyManager.recordTargets('whatsapp', [
      { id: '12345@g.us', name: 'Test Group', type: 'group', memberCount: 15 }
    ]);

    const wa = historyManager.getHistory('whatsapp');
    assert.equal(wa.length, 1);
    assert.equal(wa[0].id, '12345@g.us');
    assert.equal(wa[0].name, 'Test Group');
    assert.equal(wa[0].memberCount, 15);
  });

  test('should deduplicate targets by ID and update member count', () => {
    historyManager.recordTargets('telegram', { id: '-100123', name: 'Channel 1', memberCount: 100 });
    historyManager.recordTargets('telegram', { id: '-100123', name: 'Channel 1 Updated', memberCount: 150 });

    const tg = historyManager.getHistory('telegram');
    assert.equal(tg.length, 1);
    assert.equal(tg[0].name, 'Channel 1 Updated');
    assert.equal(tg[0].memberCount, 150);
  });

  test('should remove a single target', () => {
    historyManager.recordTargets('whatsapp', [
      { id: '1@g.us', name: 'Group 1' },
      { id: '2@g.us', name: 'Group 2' }
    ]);

    historyManager.removeTarget('whatsapp', '1@g.us');
    const wa = historyManager.getHistory('whatsapp');
    assert.equal(wa.length, 1);
    assert.equal(wa[0].id, '2@g.us');
  });

  test('should clear all history for a specific platform', () => {
    historyManager.recordTargets('whatsapp', [{ id: '1@g.us', name: 'Group 1' }]);
    historyManager.recordTargets('telegram', [{ id: '100', name: 'Chat 1' }]);

    historyManager.clearPlatformHistory('whatsapp');
    assert.deepEqual(historyManager.getHistory('whatsapp'), []);
    assert.equal(historyManager.getHistory('telegram').length, 1);
  });
});
