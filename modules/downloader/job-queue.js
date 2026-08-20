// ============================================================
// SOCIAL HUB — modules/downloader/job-queue.js
// Async Job Queue, State Machine & Worker Watchdog
// ============================================================

import crypto from 'crypto';

export const JobStates = {
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  PROVIDER_FALLBACK: 'PROVIDER_FALLBACK',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED'
};

export class JobQueue {
  constructor(providerManager) {
    this.providerManager = providerManager;
    this.jobs = new Map();
    this.queue = [];
    this.activeWorkers = 0;
    this.maxConcurrent = 3;

    // Watchdog timer: marks stale jobs as FAILED if stuck > 65s
    this.watchdogInterval = setInterval(() => {
      this.runWatchdog();
    }, 10000);
    if (this.watchdogInterval.unref) this.watchdogInterval.unref();
  }

  createJob(url, options = {}) {
    const timestamp = Date.now();
    const rand = crypto.randomBytes(4).toString('hex');
    const jobId = `job-${timestamp}-${rand}`;

    const job = {
      jobId,
      url,
      options,
      status: JobStates.QUEUED,
      currentProvider: null,
      providerHistory: [],
      result: null,
      error: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      startedAt: null,
      completedAt: null
    };

    this.jobs.set(jobId, job);
    this.queue.push(jobId);

    // Schedule auto-purge from memory after 30 minutes
    const purgeTimer = setTimeout(() => {
      this.jobs.delete(jobId);
    }, 30 * 60 * 1000);
    // Retain jobs in a running server, without keeping a one-off CLI/test
    // process alive solely for this deferred cleanup.
    if (purgeTimer.unref) purgeTimer.unref();

    // Trigger worker
    this.processNext();

    return job;
  }

  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  async processNext() {
    if (this.activeWorkers >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const jobId = this.queue.shift();
    const job = this.jobs.get(jobId);
    if (!job || job.status === JobStates.CANCELLED) {
      return this.processNext();
    }

    this.activeWorkers++;
    job.status = JobStates.PROCESSING;
    job.startedAt = Date.now();
    job.updatedAt = Date.now();

    try {
      const result = await this.providerManager.executeJob(job);
      job.status = JobStates.COMPLETED;
      job.result = {
        platform: result.platform,
        title: result.title,
        filename: result.filename,
        size: result.size,
        mimeType: result.mimeType,
        provider: result.provider,
        downloadUrl: `/api/download/file/${encodeURIComponent(result.filename)}`
      };
      job.completedAt = Date.now();
      job.updatedAt = Date.now();
    } catch (err) {
      job.status = JobStates.FAILED;
      job.error = {
        code: err.code || 'DOWNLOAD_FAILED',
        message: err.message || 'Unable to retrieve this media from the available engines'
      };
      job.completedAt = Date.now();
      job.updatedAt = Date.now();
    } finally {
      this.activeWorkers--;
      // Process next in queue
      setImmediate(() => this.processNext());
    }
  }

  runWatchdog() {
    const now = Date.now();
    const maxExecutionTimeMs = 65000;

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === JobStates.PROCESSING || job.status === JobStates.PROVIDER_FALLBACK) {
        if (job.startedAt && (now - job.startedAt) > maxExecutionTimeMs) {
          console.warn(`[WATCHDOG] Marking stale job ${jobId} as FAILED (exceeded ${maxExecutionTimeMs / 1000}s)`);
          job.status = JobStates.FAILED;
          job.error = {
            code: 'DOWNLOAD_TIMEOUT',
            message: 'The download request exceeded the maximum allowed duration and was safely terminated.'
          };
          job.completedAt = now;
          job.updatedAt = now;
        }
      }
    }
  }
}
