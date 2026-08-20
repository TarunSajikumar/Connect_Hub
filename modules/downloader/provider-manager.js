// ============================================================
// SOCIAL HUB — modules/downloader/provider-manager.js
// Central Provider Orchestration, Circuit Breaker & Failover
// ============================================================

import path from 'path';
import { InvidiousProvider } from './providers/invidious.js';
import { CobaltProvider } from './providers/cobalt.js';
import { InstagramFallbackProvider } from './providers/instagram-fallback.js';
import { FileManager } from './file-manager.js';
import { MediaValidator } from './media-validator.js';
import { classifyError, ErrorCodes } from './errors.js';
import { JobQueue, JobStates } from './job-queue.js';

export class ProviderManager {
  constructor() {
    this.providers = {
      invidious: new InvidiousProvider(),
      'cobalt': new CobaltProvider(),
      'instagram-fallback': new InstagramFallbackProvider()
    };

    this.youtubePipeline = ['invidious', 'cobalt'];
    this.instagramPipeline = ['instagram-fallback', 'cobalt'];

    // Purge orphaned files on startup
    FileManager.purgeOrphanedFiles();

    // Initialize Job Queue
    this.jobQueue = new JobQueue(this);

    // Run startup health check
    this.runStartupHealthChecks();
  }

  async runStartupHealthChecks() {
    const invidious = await this.providers.invidious.checkHealth();
    const cobalt = await this.providers['cobalt'].checkHealth();

    console.log(`[PROVIDER] Invidious ${invidious.available ? 'READY' : 'UNAVAILABLE' + (invidious.reason ? ' (' + invidious.reason + ')' : '')}`);
    console.log(`[PROVIDER] Cobalt ${cobalt.available ? 'READY' : 'UNAVAILABLE' + (cobalt.reason ? ' (' + cobalt.reason + ')' : '')}`);
  }

  /**
   * Normalize and validate any public media URL
   */
  static normalizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const clean = ProviderManager.extractUrl(rawUrl);
    if (!clean) return null;

    let parsed;
    try {
      parsed = new URL(clean);
    } catch {
      return null;
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const isYouTube = host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtu.be';
    const isInstagram = host === 'instagram.com' || host.endsWith('.instagram.com');

    // 1. YouTube normalization
    const ytShorts = isYouTube && parsed.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})(?:\/|$)/i);
    if (ytShorts) return { url: `https://www.youtube.com/watch?v=${ytShorts[1]}`, videoId: ytShorts[1], platform: 'youtube', isShorts: true };

    const ytMusic = host === 'music.youtube.com' && parsed.pathname === '/watch' && parsed.searchParams.get('v')?.match(/^[a-zA-Z0-9_-]{11}$/);
    if (ytMusic) return { url: `https://music.youtube.com/watch?v=${ytMusic[0]}`, videoId: ytMusic[0], platform: 'youtube', isMusic: true };

    const ytShortlink = host === 'youtu.be' && parsed.pathname.match(/^\/([a-zA-Z0-9_-]{11})(?:\/|$)/i);
    if (ytShortlink) return { url: `https://www.youtube.com/watch?v=${ytShortlink[1]}`, videoId: ytShortlink[1], platform: 'youtube', isShorts: false };

    const ytWatchId = isYouTube && parsed.pathname === '/watch' ? parsed.searchParams.get('v') : null;
    const ytWatch = ytWatchId?.match(/^[a-zA-Z0-9_-]{11}$/);
    if (ytWatch) return { url: `https://www.youtube.com/watch?v=${ytWatch[0]}`, videoId: ytWatch[0], platform: 'youtube', isShorts: false };

    const ytEmbedOrLive = isYouTube && parsed.pathname.match(/^\/(?:embed|live)\/([a-zA-Z0-9_-]{11})(?:\/|$)/i);
    if (ytEmbedOrLive) return { url: `https://www.youtube.com/watch?v=${ytEmbedOrLive[1]}`, videoId: ytEmbedOrLive[1], platform: 'youtube', isShorts: false };

    // 2. Instagram normalization
    if (isInstagram && /^\/(?:reel|reels|p|stories|tv)\/([a-zA-Z0-9_-]+)/i.test(parsed.pathname)) {
      return { url: `${parsed.origin}${parsed.pathname}`, platform: 'instagram' };
    }

    if (isInstagram) {
      return { url: clean, platform: 'instagram' };
    }

    if (isYouTube) {
      return { url: clean, platform: 'youtube' };
    }

    return null;
  }

  /**
   * Accept a normal URL as well as the Markdown link format copied from chats.
   * For example, `[short](https://youtube.com/shorts/...)` becomes the URL.
   */
  static extractUrl(rawUrl) {
    const value = rawUrl.trim().replace(/&amp;/gi, '&');
    const markdown = value.match(/^\s*\[[^\]]*\]\(\s*(https?:\/\/[^\s)]+)\s*\)\s*$/i);
    if (markdown) return markdown[1];

    const bareUrl = value.match(/https?:\/\/[^\s<>"']+/i);
    return bareUrl ? bareUrl[0].replace(/[.,;:!?]+$/, '') : null;
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
    let hasAvailableProvider = false;

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

      hasAvailableProvider = true;

      console.log(`[PROVIDER] ${providerName} START`);
      const providerStartTime = Date.now();

      try {
        const downloadOptions = {
          ...job.options,
          audioOnly: job.options.audioOnly || norm.isMusic || false,
          isShorts: Boolean(norm.isShorts),
          videoId: norm.videoId || null
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
    if (!hasAvailableProvider) {
      const finalErr = new Error(
        platform === 'youtube'
          ? 'No anonymous YouTube provider is configured. Add INVIDIOUS_API_URL to the server environment.'
          : 'No public media provider is currently available.'
      );
      finalErr.code = ErrorCodes.PROVIDER_UNAVAILABLE;
      throw finalErr;
    }
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
    const invidiousHealth = await this.providers.invidious.checkHealth();
    const cobaltHealth = await this.providers['cobalt'].checkHealth();
    const igFbHealth = await this.providers['instagram-fallback'].checkHealth();

    return {
      available: true,
      youtube: {
        invidious: {
          configured: Boolean(this.providers.invidious.getEndpoint()),
          healthy: invidiousHealth.available,
          reason: invidiousHealth.reason || null
        },
        cobalt: {
          configured: Boolean(this.providers['cobalt'].getEndpoint()),
          healthy: cobaltHealth.available,
          reason: cobaltHealth.reason || null
        }
      },
      instagram: {
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
