// ============================================================
// SOCIAL HUB — modules/downloader/media-validator.js
// Media Validation Engine
// ============================================================

import fs from 'fs';
import path from 'path';

const MIME_MAP = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.flv': 'video/x-flv',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.opus': 'audio/opus',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

export class MediaValidator {
  /**
   * Validate that a target path is a finished, readable media file.
   *
   * @param {string} filePath - Absolute path to the candidate file
   * @param {object} [options={}] - Validation options
   * @param {boolean} [options.requireAudio=false] - Whether audio is expected
   * @param {number} [options.minSizeBytes=1024] - Minimum acceptable file size
   * @returns {{ valid: boolean, size: number, mimeType: string, extension: string, error?: string }}
   */
  static validate(filePath, options = {}) {
    if (!filePath || typeof filePath !== 'string') {
      return { valid: false, size: 0, mimeType: 'application/octet-stream', extension: '', error: 'File path is empty or invalid' };
    }

    if (!fs.existsSync(filePath)) {
      return { valid: false, size: 0, mimeType: 'application/octet-stream', extension: '', error: 'Output file does not exist on disk' };
    }

    const basename = path.basename(filePath);

    // Reject temporary stream fragments or partial downloads
    if (/\.f\d+\./i.test(basename) || basename.endsWith('.part') || basename.endsWith('.ytdl') || basename.endsWith('.temp')) {
      return { valid: false, size: 0, mimeType: 'application/octet-stream', extension: '', error: 'Target is a temporary download fragment' };
    }

    let stats;
    try {
      stats = fs.statSync(filePath);
    } catch (e) {
      return { valid: false, size: 0, mimeType: 'application/octet-stream', extension: '', error: 'Cannot read file metadata: ' + e.message };
    }

    const minSize = options.minSizeBytes || 512;
    if (stats.size < minSize) {
      return { valid: false, size: stats.size, mimeType: 'application/octet-stream', extension: '', error: `File is empty or corrupted (${stats.size} bytes)` };
    }

    // Determine MIME type
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_MAP[ext] || 'video/mp4';

    return {
      valid: true,
      size: stats.size,
      mimeType,
      extension: ext.replace(/^\./, ''),
      filePath
    };
  }

  /**
   * Scan a directory and find the newest valid media file matching criteria.
   *
   * @param {string} dirPath - Directory to scan
   * @param {object} [filter={}] - Filter criteria (prefix, ext)
   * @returns {string|null} - Absolute path to best matching file or null
   */
  static findLatestValidFile(dirPath, filter = {}) {
    if (!fs.existsSync(dirPath)) return null;

    try {
      const files = fs.readdirSync(dirPath)
        .filter(name => {
          if (filter.prefix && !name.startsWith(filter.prefix)) return false;
          if (/\.f\d+\./i.test(name) || name.endsWith('.part') || name.endsWith('.ytdl') || name.endsWith('.temp')) return false;
          return true;
        })
        .map(name => {
          const full = path.join(dirPath, name);
          try {
            const st = fs.statSync(full);
            return { full, size: st.size, mtimeMs: st.mtimeMs };
          } catch {
            return null;
          }
        })
        .filter(item => item && item.size > 512)
        .sort((a, b) => b.mtimeMs - a.mtimeMs);

      return files.length > 0 ? files[0].full : null;
    } catch {
      return null;
    }
  }
}
