// ============================================================
// SOCIAL HUB — test/youtube_downloader.test.js
// Unit & Integration Tests for New Provider Architecture
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { ProviderManager, providerManager } from '../modules/downloader/provider-manager.js';
import { MediaValidator } from '../modules/downloader/media-validator.js';
import { classifyError, ErrorCodes } from '../modules/downloader/errors.js';
import { BaseProvider } from '../modules/downloader/providers/base-provider.js';

describe('Media Downloader — Provider Architecture Tests', () => {

  describe('1. URL Normalization', () => {
    it('should normalize standard YouTube watch URLs', () => {
      const norm = ProviderManager.normalizeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      assert.equal(norm.platform, 'youtube');
      assert.equal(norm.videoId, 'dQw4w9WgXcQ');
      assert.equal(norm.url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('should normalize YouTube Shorts URLs', () => {
      const norm = ProviderManager.normalizeUrl('https://youtube.com/shorts/oup55hcy9ps?si=xyz');
      assert.equal(norm.platform, 'youtube');
      assert.equal(norm.videoId, 'oup55hcy9ps');
      assert.equal(norm.isShorts, true);
      assert.equal(norm.url, 'https://www.youtube.com/watch?v=oup55hcy9ps');
    });

    it('should normalize YouTube Music URLs without losing videoId', () => {
      const norm = ProviderManager.normalizeUrl('https://music.youtube.com/watch?v=dQw4w9WgXcQ&feature=share');
      assert.equal(norm.platform, 'youtube');
      assert.equal(norm.videoId, 'dQw4w9WgXcQ');
      assert.equal(norm.isMusic, true);
    });

    it('should normalize youtu.be shortlinks', () => {
      const norm = ProviderManager.normalizeUrl('https://youtu.be/jNQXAC9IVRw');
      assert.equal(norm.platform, 'youtube');
      assert.equal(norm.videoId, 'jNQXAC9IVRw');
      assert.equal(norm.url, 'https://www.youtube.com/watch?v=jNQXAC9IVRw');
    });

    it('should normalize YouTube live and embed links', () => {
      const embedNorm = ProviderManager.normalizeUrl('https://www.youtube.com/embed/jNQXAC9IVRw');
      assert.equal(embedNorm.videoId, 'jNQXAC9IVRw');

      const liveNorm = ProviderManager.normalizeUrl('https://youtube.com/live/jNQXAC9IVRw');
      assert.equal(liveNorm.videoId, 'jNQXAC9IVRw');
    });

    it('should normalize Instagram Reels and post URLs', () => {
      const reelNorm = ProviderManager.normalizeUrl('https://www.instagram.com/reel/C8mQ9p9p_Xx/?igsh=abc');
      assert.equal(reelNorm.platform, 'instagram');
      assert.equal(reelNorm.url, 'https://www.instagram.com/reel/C8mQ9p9p_Xx/');
    });

    it('should reject invalid or unsupported URLs', () => {
      assert.equal(ProviderManager.normalizeUrl(''), null);
      assert.equal(ProviderManager.normalizeUrl('https://example.com/video'), null);
      assert.equal(ProviderManager.normalizeUrl('not-a-url'), null);
    });
  });

  describe('2. Media Validator', () => {
    const tempDir = path.resolve('downloads');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    it('should validate a healthy media file with correct MIME type', () => {
      const testFile = path.join(tempDir, 'valid_test.mp4');
      fs.writeFileSync(testFile, Buffer.alloc(2048, 1));

      const validation = MediaValidator.validate(testFile);
      assert.equal(validation.valid, true);
      assert.equal(validation.mimeType, 'video/mp4');
      assert.equal(validation.size, 2048);

      fs.unlinkSync(testFile);
    });

    it('should reject 0-byte or corrupted files', () => {
      const emptyFile = path.join(tempDir, 'empty_test.mp4');
      fs.writeFileSync(emptyFile, Buffer.alloc(0));

      const validation = MediaValidator.validate(emptyFile);
      assert.equal(validation.valid, false);

      fs.unlinkSync(emptyFile);
    });

    it('should reject temporary stream fragment files (.part, .ytdl, .fNNN.)', () => {
      const partFile = path.join(tempDir, 'stream.f399.mp4.part');
      fs.writeFileSync(partFile, Buffer.alloc(4096, 1));

      const validation = MediaValidator.validate(partFile);
      assert.equal(validation.valid, false);

      fs.unlinkSync(partFile);
    });

    it('should reject non-existent file paths', () => {
      const validation = MediaValidator.validate('/non/existent/path.mp4');
      assert.equal(validation.valid, false);
    });
  });

  describe('3. Error Classification', () => {
    it('should classify removed or unavailable videos into YOUTUBE_UNAVAILABLE', () => {
      const err = new Error('ERROR: [youtube] xyz: Video unavailable');
      const classified = classifyError(err, 'youtube');
      assert.equal(classified.code, ErrorCodes.YOUTUBE_UNAVAILABLE);
      assert.ok(classified.message.includes('unavailable'));
    });

    it('should classify timeout errors into DOWNLOAD_TIMEOUT', () => {
      const err = new Error('Operation timed out after 35s');
      const classified = classifyError(err, 'youtube');
      assert.equal(classified.code, ErrorCodes.DOWNLOAD_TIMEOUT);
    });

    it('should classify provider failures into normalized code without raw stderr', () => {
      const err = new Error('Execution failed with exit code 1');
      const classified = classifyError(err, 'youtube');
      assert.equal(classified.code, ErrorCodes.YOUTUBE_PROVIDER_FAILED);
      assert.ok(!classified.message.includes('exit code'));
    });
  });

  describe('4. Circuit Breaker & Base Provider', () => {
    it('should open circuit after 3 consecutive failures', () => {
      const provider = new BaseProvider({ name: 'test-prov', supportedPlatforms: ['youtube'] });
      assert.equal(provider.isCircuitOpen(), false);

      provider.recordFailure();
      provider.recordFailure();
      assert.equal(provider.isCircuitOpen(), false);

      provider.recordFailure(); // 3rd failure
      assert.equal(provider.isCircuitOpen(), true);

      provider.recordSuccess(); // Reset on success
      assert.equal(provider.isCircuitOpen(), false);
    });
  });

  describe('5. Provider Manager Status & Diagnostics', () => {
    it('should return structured status envelope from getStatus()', async () => {
      const status = await providerManager.getStatus();
      assert.equal(status.available, true);
      assert.ok(status.youtube);
      assert.ok(status.instagram);
      assert.equal(typeof status.youtube.ytdlpDirect.healthy, 'boolean');
      assert.equal(status.youtube.ytdlpDirect.configured, true);
      assert.equal(typeof status.instagram.ytdlp.healthy, 'boolean');
    });

    it('should return safe structured diagnostic object without raw stderr', async () => {
      const diag = await providerManager.diagnose('https://www.youtube.com/watch?v=invalid_id_999');
      assert.equal(typeof diag.success, 'boolean');
      assert.ok(diag.code);
      assert.ok(diag.durationMs >= 0);
      assert.equal(diag.stderr, undefined); // No raw stderr leakage
    });
  });
});
