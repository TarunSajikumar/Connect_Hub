import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import SchedulerModule from '../modules/scheduler.js';

describe('SchedulerModule Tests', () => {
  let tmpDir;
  let scheduler;
  let broadcastEvents = [];
  const mockBroadcast = (msg) => broadcastEvents.push(msg);
  const mockWa = { sendMedia: async () => ({ success: true }) };
  const mockTg = { sendMedia: async () => ({ success: true }) };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sched_test_'));
    broadcastEvents = [];
    scheduler = new SchedulerModule(mockBroadcast, tmpDir, mockWa, mockTg);
  });

  afterEach(() => {
    if (scheduler.timer) clearInterval(scheduler.timer);
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {}
  });

  test('should schedule a valid future broadcast job', () => {
    const futureTime = new Date(Date.now() + 60000).toISOString();
    const mockFile = { path: path.join(tmpDir, 'test.mp4'), originalname: 'test.mp4', mimetype: 'video/mp4', size: 1024 };
    fs.writeFileSync(mockFile.path, 'dummy content');

    const job = scheduler.scheduleJob({
      file: mockFile,
      caption: 'Test Caption',
      targets: [{ platform: 'telegram', id: '-100' }],
      scheduledTime: futureTime
    });

    assert.ok(job.jobId);
    assert.equal(job.status, 'pending');
    assert.equal(job.caption, 'Test Caption');
    assert.equal(scheduler.getJobs().length, 1);
  });

  test('should reject past or invalid scheduled times', () => {
    const pastTime = new Date(Date.now() - 10000).toISOString();
    const mockFile = { path: 'any.mp4', originalname: 'any.mp4', mimetype: 'video/mp4', size: 100 };

    assert.throws(() => {
      scheduler.scheduleJob({
        file: mockFile,
        caption: 'Past',
        targets: [{ platform: 'whatsapp', id: '1@g.us' }],
        scheduledTime: pastTime
      });
    }, /Scheduled time must be in the future/);
  });

  test('should cancel a pending scheduled job', () => {
    const futureTime = new Date(Date.now() + 120000).toISOString();
    const mockFile = { path: path.join(tmpDir, 'cancel.mp4'), originalname: 'cancel.mp4', mimetype: 'video/mp4', size: 500 };
    fs.writeFileSync(mockFile.path, 'data');

    const job = scheduler.scheduleJob({
      file: mockFile,
      caption: 'To Cancel',
      targets: [{ platform: 'telegram', id: '123' }],
      scheduledTime: futureTime
    });

    const cancelled = scheduler.cancelJob(job.jobId);
    assert.equal(cancelled.status, 'cancelled');
  });
});
