// ============================================================
// ContentHub — modules/scheduler.js
// Persistent Broadcast Scheduler & Job Execution Engine
// ============================================================

import path from 'path';
import fs from 'fs';

export default class SchedulerModule {
  constructor(broadcast, sessionsDir, waModule, tgModule) {
    this.broadcast = broadcast;
    this.sessionsDir = sessionsDir;
    this.wa = waModule;
    this.tg = tgModule;
    this.jobsFile = path.join(sessionsDir, 'scheduled_jobs.json');
    this.jobs = [];
    this.timer = null;
    this.loadJobs();
    this.startEngine();
  }

  loadJobs() {
    try {
      if (fs.existsSync(this.jobsFile)) {
        const data = fs.readFileSync(this.jobsFile, 'utf8');
        this.jobs = JSON.parse(data);
        if (!Array.isArray(this.jobs)) this.jobs = [];
      }
    } catch (e) {
      this.jobs = [];
    }
  }

  saveJobs() {
    try {
      const dir = path.dirname(this.jobsFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.jobsFile, JSON.stringify(this.jobs, null, 2));
    } catch (e) {
      console.error('[Scheduler] Save error:', e.message);
    }
  }

  startEngine() {
    if (this.timer) clearInterval(this.timer);
    // Check every 5 seconds for due jobs
    this.timer = setInterval(() => this.checkDueJobs(), 5000);
  }

  async checkDueJobs() {
    const now = Date.now();
    const dueJobs = this.jobs.filter(j => j.status === 'pending' && j.scheduledTime <= now);

    for (const job of dueJobs) {
      await this.executeJob(job);
    }
  }

  async executeJob(job) {
    console.log(`[Scheduler] Executing scheduled job: ${job.jobId} (${job.originalName})`);
    job.status = 'publishing';
    this.saveJobs();

    this.broadcast({ type: 'schedule_trigger', jobId: job.jobId, job });

    const results = [];
    for (const target of job.targets) {
      const { platform, id } = target;
      try {
        this.broadcast({ type: 'upload_progress', jobId: job.jobId, platform, id, status: 'uploading' });

        if (platform === 'whatsapp') {
          await this.wa.sendMedia(id, job.filePath, job.originalName, job.mimeType, job.caption);
        } else if (platform === 'telegram') {
          await this.tg.sendMedia(id, job.filePath, job.originalName, job.mimeType, job.caption);
        }

        this.broadcast({ type: 'upload_progress', jobId: job.jobId, platform, id, status: 'done' });
        results.push({ platform, id, success: true });
      } catch (err) {
        console.error(`[Scheduler] Failed for ${platform} ${id}:`, err.message);
        this.broadcast({ type: 'upload_progress', jobId: job.jobId, platform, id, status: 'error', error: err.message });
        results.push({ platform, id, success: false, error: err.message });
      }
    }

    const allFailed = results.length > 0 && results.every(r => !r.success);
    job.status = allFailed ? 'failed' : 'completed';
    job.completedAt = new Date().toISOString();
    job.results = results;
    this.saveJobs();

    this.broadcast({ type: 'schedule_complete', jobId: job.jobId, results });

    // Cleanup temp file after execution
    setTimeout(() => {
      try {
        if (fs.existsSync(job.filePath)) {
          fs.unlinkSync(job.filePath);
        }
      } catch (e) {}
    }, 30000);
  }

  scheduleJob({ file, caption, targets, scheduledTime }) {
    const timeMs = new Date(scheduledTime).getTime();
    if (isNaN(timeMs) || timeMs <= Date.now()) {
      throw new Error('Scheduled time must be in the future');
    }

    const jobId = `sched_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const job = {
      jobId,
      scheduledTime: timeMs,
      filePath: file.path,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      caption: caption || '',
      targets: Array.isArray(targets) ? targets : JSON.parse(targets || '[]'),
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    this.jobs.unshift(job);
    this.saveJobs();

    // Broadcast new scheduled job to client
    this.broadcast({ type: 'schedule_created', job });
    return job;
  }

  getJobs() {
    return this.jobs;
  }

  async runJobNow(jobId) {
    const job = this.jobs.find(j => j.jobId === jobId);
    if (!job) throw new Error('Job not found');
    if (job.status !== 'pending') throw new Error('Only pending jobs can be executed immediately');

    console.log(`[Scheduler] Triggering quick immediate execution for job: ${jobId}`);
    await this.executeJob(job);
    return job;
  }

  cancelJob(jobId) {
    const job = this.jobs.find(j => j.jobId === jobId);
    if (!job) throw new Error('Job not found');
    if (job.status !== 'pending') throw new Error('Only pending jobs can be cancelled');

    job.status = 'cancelled';
    job.cancelledAt = new Date().toISOString();
    this.saveJobs();

    // Delete temp file if exists
    try {
      if (fs.existsSync(job.filePath)) {
        fs.unlinkSync(job.filePath);
      }
    } catch (e) {}

    this.broadcast({ type: 'schedule_cancelled', jobId });
    return job;
  }
}
