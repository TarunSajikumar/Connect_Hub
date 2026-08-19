// ============================================================
// SOCIAL HUB — modules/downloader/provider-manager.js
// Central Provider Orchestration, Circuit Breaker & Failover
// ============================================================

import { YtDlpPoProvider } from './providers/ytdlp-po.js';
import { BgutilYtDlpProvider } from './providers/bgutil-ytdlp.js';
import { YtDlpDirectProvider } from './providers/ytdlp-direct.js';
import { CobaltProvider } from './providers/cobalt.js';
import { InstagramYtDlpProvider } from './providers/instagram-ytdlp.js';
import { InstagramFallbackProvider } from './providers/instagram-fallback.js';
import { FileManager } from './file-manager.js';
import { MediaValidator } from './media-validator.js';
import { classifyError, ErrorCodes } from './errors.js';

export class ProviderManager {
  constructor() {
    this.providers = {
      'yt-dlp-po': new YtDlpPoProvider(),
      'bgutil': new BgutilYtDlpProvider(),
      'yt-dlp-direct': new YtDlpDirectProvider(),
      'cobalt': new CobaltProvider(),
      'instagram-ytdlp': new InstagramYtDlpProvider(),
      'instagram-fallback': new InstagramFallbackProvider()
    };

    this.youtubePipeline = ['yt-dlp-po', 'bgutil', 'yt-dlp-direct', 'cobalt'];
    this.instagramPipeline = ['instagram-ytdlp', 'instagram-fallback', 'cobalt'];

    // Purge orphaned files on startup
    FileManager.purgeOrphanedFiles();
  }

  /**
   * Normalize and validate any public media URL
   */
  static normalizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const clean = rawUrl.trim();

    // 1. YouTube normalization
    const ytShorts = clean.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i);
    if (ytShorts) return { url: `https://www.youtube.com/watch?v=${ytShorts[1]}`, videoId: ytShorts[1], platform: 'youtube', isShorts: true };

    const ytMusic = clean.match(/music\.youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/i);
    if (ytMusic) return { url: `https://music.youtube.com/watch?v=${ytMusic[1]}`, videoId: ytMusic[1], platform: 'youtube', isMusic: true };

    const ytShortlink = clean.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
    if (ytShortlink) return { url: `https://www.youtube.com/watch?v=${ytShortlink[1]}`, videoId: ytShortlink[1], platform: 'youtube', isShorts: false };

    const ytWatch = clean.match(/youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/i);
    if (ytWatch) return { url: `https://www.youtube.com/watch?v=${ytWatch[1]}`, videoId: ytWatch[1], platform: 'youtube', isShorts: false };

    const ytEmbedOrLive = clean.match(/youtube\.com\/(?:embed|live)\/([a-zA-Z0-9_-]{11})/i);
    if (ytEmbedOrLive) return { url: `https://www.youtube.com/watch?v=${ytEmbedOrLive[1]}`, videoId: ytEmbedOrLive[1], platform: 'youtube', isShorts: false };

    // 2. Instagram normalization
    if (/instagram\.com\/(?:reel|reels|p|stories|tv)\/([a-zA-Z0-9_-]+)/i.test(clean)) {
      return { url: clean.split('?')[0], platform: 'instagram' };
    }

    if (/instagram\.com/i.test(clean)) {
      return { url: clean, platform: 'instagram' };
    }

    if (/youtube\.com|youtu\.be/i.test(clean)) {
      return { url: clean, platform: 'youtube' };
    }

    return null;
  }

  /**
   * Main download orchestrator.
   * Executes providers sequentially with failover, isolated job directories,
   * timeouts, and output verification.
   *
   * @param {string} rawUrl - Target URL
   * @param {object} [options={}] - Download options
   * @returns {Promise<{ success: boolean, platform: string, title: string, filename: string, size: number, mimeType: string, filePath: string }>}
   */
  async download(rawUrl, options = {}) {
    const norm = ProviderManager.normalizeUrl(rawUrl);
    if (!norm) {
      const err = new Error('Unsupported or invalid media URL');
      err.code = ErrorCodes.UNSUPPORTED_PLATFORM;
      throw err;
    }

    const { platform, url } = norm;
    const pipelineNames = platform === 'youtube' ? this.youtubePipeline : this.instagramPipeline;
    const jobCtx = FileManager.createJobContext();
    const startTime = Date.now();

    console.log(`[DOWNLOAD] job=${jobCtx.jobId} platform=${platform} url=${url} status=started`);

    let lastError = null;

    for (const providerName of pipelineNames) {
      const provider = this.providers[providerName];
      if (!provider) continue;

      // Circuit breaker check
      if (provider.isCircuitOpen()) {
        console.log(`[DOWNLOAD] job=${jobCtx.jobId} provider=${providerName} status=skipped reason=circuit_open`);
        continue;
      }

      // Health / Availability check
      const health = await provider.checkHealth();
      if (!health.available) {
        console.log(`[DOWNLOAD] job=${jobCtx.jobId} provider=${providerName} status=skipped reason=unavailable detail="${health.reason || ''}"`);
        continue;
      }

      console.log(`[DOWNLOAD] job=${jobCtx.jobId} provider=${providerName} status=executing`);
      const providerStartTime = Date.now();

      try {
        const downloadOptions = {
          ...options,
          audioOnly: options.audioOnly || norm.isMusic || false
        };

        const result = await provider.download({
          url,
          jobDir: jobCtx.jobDir,
          timestamp: jobCtx.timestamp,
          options: downloadOptions
        });

        if (result && result.filePath) {
          const validation = MediaValidator.validate(result.filePath);
          if (validation.valid) {
            provider.recordSuccess();
            const durationMs = Date.now() - providerStartTime;
            console.log(`[DOWNLOAD] job=${jobCtx.jobId} provider=${providerName} status=success duration=${durationMs}ms size=${validation.size}`);

            const ext = validation.extension || 'mp4';
            const cleanBase = path.basename(result.filePath, path.extname(result.filePath)).replace(/^\d+_/, '');
            const finalName = `${jobCtx.timestamp}_${cleanBase}.${ext}`;
            const finalStoredPath = FileManager.finalizeFile(result.filePath, finalName);

            // Clean up temporary job directory
            jobCtx.cleanup();

            return {
              success: true,
              platform,
              title: result.title || finalName,
              filename: finalName,
              size: validation.size,
              mimeType: validation.mimeType,
              filePath: finalStoredPath,
              provider: providerName
            };
          }
        }

        throw new Error('Provider returned unlocatable or empty output file');
      } catch (provErr) {
        provider.recordFailure();
        lastError = provErr;
        const durationMs = Date.now() - providerStartTime;
        const classified = classifyError(provErr, platform);
        console.log(`[DOWNLOAD] job=${jobCtx.jobId} provider=${providerName} status=failed code=${classified.code} duration=${durationMs}ms`);

        // If content is definitively removed / private on platform, do not waste time retrying other engines
        if (classified.code === ErrorCodes.YOUTUBE_UNAVAILABLE || classified.code === ErrorCodes.INSTAGRAM_UNAVAILABLE) {
          jobCtx.cleanup();
          const fatalErr = new Error(classified.message);
          fatalErr.code = classified.code;
          throw fatalErr;
        }
      }
    }

    // All providers exhausted
    jobCtx.cleanup();
    const totalDuration = Date.now() - startTime;
    const finalClassified = classifyError(lastError, platform);
    console.log(`[DOWNLOAD] job=${jobCtx.jobId} platform=${platform} status=exhausted finalCode=${finalClassified.code} totalDuration=${totalDuration}ms`);

    const finalErr = new Error(finalClassified.message);
    finalErr.code = finalClassified.code;
    throw finalErr;
  }

  /**
   * Return structured provider health status for GET /api/downloader/status
   */
  async getStatus() {
    const providerStatuses = [];

    for (const [name, provider] of Object.entries(this.providers)) {
      const health = await provider.checkHealth();
      providerStatuses.push({
        name,
        available: health.available,
        circuitOpen: provider.isCircuitOpen(),
        totalSuccess: provider.totalSuccess,
        totalFailures: provider.totalFailures,
        supportedPlatforms: provider.supportedPlatforms
      });
    }

    return {
      available: true,
      platforms: {
        youtube: true,
        instagram: true
      },
      providers: providerStatuses
    };
  }

  /**
   * Safe structured diagnostic endpoint for POST /api/downloader/diagnose
   * (Zero raw child process stderr leakage).
   */
  async diagnose(rawUrl) {
    const startTime = Date.now();
    const norm = ProviderManager.normalizeUrl(rawUrl);
    if (!norm) {
      return {
        success: false,
        code: ErrorCodes.INVALID_URL,
        message: 'Invalid URL format',
        durationMs: Date.now() - startTime
      };
    }

    try {
      const result = await this.download(rawUrl);
      return {
        success: true,
        platform: norm.platform,
        title: result.title,
        size: result.size,
        mimeType: result.mimeType,
        provider: result.provider,
        durationMs: Date.now() - startTime
      };
    } catch (err) {
      const classified = classifyError(err, norm.platform);
      return {
        success: false,
        code: classified.code,
        message: classified.message,
        durationMs: Date.now() - startTime
      };
    }
  }
}

// Global Singleton Instance
export const providerManager = new ProviderManager();
