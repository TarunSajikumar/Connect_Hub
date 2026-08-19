// ============================================================
// SOCIAL HUB — modules/downloader/file-manager.js
// Isolated Job Storage & Auto-Cleanup Manager
// ============================================================

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DOWNLOADS = path.resolve(__dirname, '../../downloads');

export class FileManager {
  static getBaseDownloadsDir() {
    if (!fs.existsSync(ROOT_DOWNLOADS)) {
      fs.mkdirSync(ROOT_DOWNLOADS, { recursive: true });
    }
    return ROOT_DOWNLOADS;
  }

  /**
   * Create an isolated working directory for a specific download job.
   *
   * @returns {{ jobId: string, jobDir: string, timestamp: number, cleanup: () => void }}
   */
  static createJobContext() {
    const timestamp = Date.now();
    const rand = crypto.randomBytes(4).toString('hex');
    const jobId = `job-${timestamp}-${rand}`;
    const baseDir = FileManager.getBaseDownloadsDir();
    const jobDir = path.join(baseDir, jobId);

    fs.mkdirSync(jobDir, { recursive: true });

    return {
      jobId,
      jobDir,
      timestamp,
      cleanup: () => {
        try {
          if (fs.existsSync(jobDir)) {
            fs.rmSync(jobDir, { recursive: true, force: true });
          }
        } catch (e) {
          // Non-blocking cleanup failure
        }
      }
    };
  }

  /**
   * Move a validated job file to the root downloads directory with a clean filename,
   * then schedule auto-deletion after 30 minutes.
   *
   * @param {string} sourcePath - Absolute path inside job directory
   * @param {string} desiredFilename - Final filename to expose
   * @returns {string} - Absolute path to final stored file
   */
  static finalizeFile(sourcePath, desiredFilename) {
    const baseDir = FileManager.getBaseDownloadsDir();
    const cleanName = desiredFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const targetPath = path.join(baseDir, cleanName);

    // If source is already in root or different, copy/move
    if (sourcePath !== targetPath) {
      fs.copyFileSync(sourcePath, targetPath);
      try { fs.unlinkSync(sourcePath); } catch {}
    }

    // Schedule 30-minute auto cleanup
    setTimeout(() => {
      try {
        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
        }
      } catch (e) {}
    }, 30 * 60 * 1000);

    return targetPath;
  }

  /**
   * Safely locate and resolve a downloaded file for the download route.
   * Protects against directory traversal.
   *
   * @param {string} filename - Filename or relative path
   * @returns {string|null} - Resolved absolute path or null if invalid
   */
  static resolveDownloadFile(filename) {
    if (!filename || typeof filename !== 'string') return null;

    const baseDir = FileManager.getBaseDownloadsDir();
    // Normalize and sanitize to prevent traversal
    const safeName = path.basename(filename);
    const candidatePath = path.join(baseDir, safeName);

    if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
      return candidatePath;
    }

    // Check if filename is inside a job subdirectory: job-xxx/media.mp4
    if (filename.includes('/') || filename.includes('\\')) {
      const parts = filename.split(/[/\\]+/).map(p => path.basename(p));
      const subCandidate = path.join(baseDir, ...parts);
      if (fs.existsSync(subCandidate) && fs.statSync(subCandidate).isFile()) {
        // Ensure path is strictly inside baseDir
        const relative = path.relative(baseDir, subCandidate);
        if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
          return subCandidate;
        }
      }
    }

    return null;
  }

  /**
   * Run cleanup on server startup: delete orphaned job directories and files older than 30 mins.
   */
  static purgeOrphanedFiles(maxAgeMs = 30 * 60 * 1000) {
    const baseDir = FileManager.getBaseDownloadsDir();
    const now = Date.now();

    try {
      const entries = fs.readdirSync(baseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === '.gitkeep') continue;
        const fullPath = path.join(baseDir, entry.name);

        try {
          const stats = fs.statSync(fullPath);
          const age = now - stats.mtimeMs;

          if (entry.isDirectory()) {
            if (entry.name.startsWith('job-') || age > maxAgeMs) {
              fs.rmSync(fullPath, { recursive: true, force: true });
            }
          } else if (entry.isFile()) {
            if (age > maxAgeMs || entry.name.endsWith('.part') || entry.name.endsWith('.ytdl')) {
              fs.unlinkSync(fullPath);
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
  }
}
