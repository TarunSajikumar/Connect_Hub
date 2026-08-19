// ============================================================
// SOCIAL HUB — modules/downloader/provider-manager.js
// Central Provider Orchestration, Circuit Breaker & Failover
// ============================================================

import path from 'path';
import { YtDlpPoProvider } from './providers/ytdlp-po.js';
import { BgutilYtDlpProvider } from './providers/bgutil-ytdlp.js';
import { YtDlpDirectProvider } from './providers/ytdlp-direct.js';
import { CobaltProvider } from './providers/cobalt.js';
import { InstagramYtDlpProvider } from './providers/instagram-ytdlp.js';
import { InstagramFallbackProvider } from './providers/instagram-fallback.js';
import { FileManager } from './file-manager.js';
import { MediaValidator } from './media-validator.js';
import { classifyError, ErrorCodes } from './errors.js';
import { JobQueue, JobStates } from './job-queue.js';

export class ProviderManager {
  constructor() {
    this.providers = {
      'ytdlp-po': new YtDlpPoProvider(),
      'bgutil': new BgutilYtDlpProvider(),
      'ytdlp-direct': new YtDlpDirectProvider(),
      'cobalt': new CobaltProvider(),
      'instagram-ytdlp': new InstagramYtDlpProvider(),
      'instagram-fallback': new InstagramFallbackProvider()
    };

    this.youtubePipeline = ['ytdlp-po', 'bgutil', 'ytdlp-direct', 'cobalt'];
    this.instagramPipeline = ['instagram-ytdlp', 'instagram-fallback', 'cobalt'];

    // Purge orphaned files on startup
    FileManager.purgeOrphanedFiles();

    // Initialize Job Queue
    this.jobQueue = new JobQueue(this);

    // Run startup health check
    this.runStartupHealthChecks();
  }

  async runStartupHealthChecks() {
    const ytDirect = await this.providers['ytdlp-direct'].checkHealth();
    const ytPo = await this.providers['ytdlp-po'].checkHealth();
    const bgutil = await this.providers['bgutil'].checkHealth();
    const cobalt = await this.providers['cobalt'].checkHealth();

    console.log(`[PROVIDER] yt-dlp direct ${ytDirect.available ? 'READY' : 'UNAVAILABLE'}`);
    console.log(`[PROVIDER] yt-dlp PO ${ytPo.available ? 'READY' : 'UNAVAILABLE' + (ytPo.reason ? ' (' + ytPo.reason + ')' : '')}`);
    console.log(`[PROVIDER] bgutil ${bgutil.available ? 'READY' : 'UNAVAILABLE' + (bgutil.reason ? ' (' + bgutil.reason + ')' : '')}`);
    console.log(`[PROVIDER] Cobalt ${cobalt.available ? 'READY' : 'UNAVAILABLE' + (cobalt.reason ? ' (' + cobalt.reason + ')' : '')}`);
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
   * Execute an async job across the sequential provider pipeline
   */
  async executeJob(job) {
    const norm = ProviderManager.normalizeUrl(job.url);
    if (!norm) {
      const err = new Error('Unsupported or invalid media URL');
      err.code = ErrorCodes.UNSUPPORTED_PLATFORM;
      throw err;
    }

    const { platform, url } = norm;
    const pipelineNames = platform === 'youtube' ? this.youtubePipeline : this.instagramPipeline;
    const jobCtx = FileManager.createJobContext();

    console.log(`[DOWNLOAD] job=${job.jobId} platform=${platform} url=${url}`);

    let lastError = null;

    for (const providerName of pipelineNames) {
      const provider = this.providers[providerName];
      if (!provider) continue;

      job.currentProvider = providerName;
      job.updatedAt = Date.now();

      // Circuit breaker check
      if (provider.isCircuitOpen()) {
        console.log(`[PROVIDER] ${providerName} SKIPPED (circuit open)`);
        job.providerHistory.push({ provider: providerName, status: 'skipped', reason: 'circuit_open' });
        continue;
      }

      // Health / Availability check
      const health = await provider.checkHealth();
      if (!health.available) {
        console.log(`[PROVIDER] ${providerName} UNAVAILABLE (${health.reason || 'offline'})`);
        job.providerHistory.push({ provider: providerName, status: 'unavailable', reason: health.reason });
        continue;
      }

      console.log(`[PROVIDER] ${providerName} START`);
      const providerStartTime = Date.now();

      try {
        const downloadOptions = {
          ...job.options,
          audioOnly: job.options.audioOnly || norm.isMusic || false
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
            console.log(`[PROVIDER] ${providerName} SUCCESS (${durationMs}ms, ${validation.size} bytes)`);

            const ext = validation.extension || 'mp4';
            const cleanBase = path.basename(result.filePath, path.extname(result.filePath)).replace(/^\d+_/, '');
            const finalName = `${jobCtx.timestamp}_${cleanBase}.${ext}`;
            const finalStoredPath = FileManager.finalizeFile(result.filePath, finalName);

            // Clean up temporary job directory
            jobCtx.cleanup();

            job.providerHistory.push({ provider: providerName, status: 'success', durationMs });

            return {
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
        console.log(`[PROVIDER] ${providerName} FAILED code=${classified.code} (${durationMs}ms)`);

        job.providerHistory.push({ provider: providerName, status: 'failed', code: classified.code, durationMs });

        // If content is definitively removed / private on platform, do not waste time retrying other engines
        if (classified.code === ErrorCodes.YOUTUBE_UNAVAILABLE || classified.code === ErrorCodes.INSTAGRAM_UNAVAILABLE) {
          jobCtx.cleanup();
          const fatalErr = new Error(classified.message);
          fatalErr.code = classified.code;
          throw fatalErr;
        }

        job.status = JobStates.PROVIDER_FALLBACK;
        job.updatedAt = Date.now();
      }
    }

    // All providers exhausted
    jobCtx.cleanup();
    const finalClassified = classifyError(lastError, platform);
    console.log(`[DOWNLOAD] job=${job.jobId} platform=${platform} ALL_PROVIDERS_FAILED finalCode=${finalClassified.code}`);

    const finalErr = new Error(finalClassified.message);
    finalErr.code = finalClassified.code;
    throw finalErr;
  }

  /**
   * Synchronous / Direct wrapper for backward-compatibility or scripts
   */
  async download(rawUrl, options = {}) {
    const job = this.jobQueue.createJob(rawUrl, options);
    
    // Poll job completion in memory
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const current = this.jobQueue.getJob(job.jobId);
        if (!current) {
          clearInterval(checkInterval);
          return reject(new Error('Job not found'));
        }
        if (current.status === JobStates.COMPLETED && current.result) {
          clearInterval(checkInterval);
          return resolve({
            success: true,
            ...current.result
          });
        }
        if (current.status === JobStates.FAILED) {
          clearInterval(checkInterval);
          const err = new Error(current.error?.message || 'Download failed');
          err.code = current.error?.code || 'DOWNLOAD_FAILED';
          return reject(err);
        }
      }, 500);
    });
  }

  /**
   * Return structured provider health status for GET /api/downloader/status
   */
  async getStatus() {
    const ytPoHealth = await this.providers['ytdlp-po'].checkHealth();
    const bgutilHealth = await this.providers['bgutil'].checkHealth();
    const ytDirectHealth = await this.providers['ytdlp-direct'].checkHealth();
    const cobaltHealth = await this.providers['cobalt'].checkHealth();
    const igYtHealth = await this.providers['instagram-ytdlp'].checkHealth();
    const igFbHealth = await this.providers['instagram-fallback'].checkHealth();

    return {
      available: true,
      youtube: {
        ytdlpPo: {
          configured: Boolean(this.providers['ytdlp-po'].getProviderEndpoint()),
          healthy: ytPoHealth.available,
          reason: ytPoHealth.reason || null
        },
        bgutil: {
          configured: Boolean(this.providers['bgutil'].getEndpoint()),
          healthy: bgutilHealth.available,
          reason: bgutilHealth.reason || null
        },
        ytdlpDirect: {
          configured: true,
          healthy: ytDirectHealth.available
        },
        cobalt: {
          configured: Boolean(this.providers['cobalt'].getEndpoint()),
          healthy: cobaltHealth.available,
          reason: cobaltHealth.reason || null
        }
      },
      instagram: {
        ytdlp: {
          configured: true,
          healthy: igYtHealth.available
        },
        fallback: {
          configured: true,
          healthy: igFbHealth.available
        },
        cobalt: {
          configured: Boolean(this.providers['cobalt'].getEndpoint()),
          healthy: cobaltHealth.available
        }
      },
      activeWorkers: this.jobQueue.activeWorkers,
      queueLength: this.jobQueue.queue.length
    };
  }

  /**
   * Safe structured diagnostic endpoint for POST /api/downloader/diagnose
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
