// ============================================================
// SOCIAL HUB — modules/downloader/providers/ytdlp-direct.js
// Provider: Direct yt-dlp execution
// ============================================================

import path from 'path';
import { spawn, execSync } from 'child_process';
import { BaseProvider } from './base-provider.js';
import { MediaValidator } from '../media-validator.js';

let cachedYtDlpAvailable = null;
let lastYtDlpCheckTime = 0;

export class YtDlpDirectProvider extends BaseProvider {
  constructor() {
    super({
      name: 'ytdlp',
      supportedPlatforms: ['youtube'],
      timeoutMs: 35000
    });
  }

  getYtDlpCmd() {
    return process.env.YTDLP_PATH || 'yt-dlp';
  }

  async checkHealth() {
    const now = Date.now();
    // Cache positive health check for 60s
    if (cachedYtDlpAvailable !== null && (now - lastYtDlpCheckTime < 60000)) {
      return cachedYtDlpAvailable ? { available: true } : { available: false, reason: 'yt-dlp binary not found in PATH' };
    }

    const cmd = this.getYtDlpCmd();
    try {
      execSync(`"${cmd}" --version`, { stdio: 'ignore', timeout: 3000 });
      cachedYtDlpAvailable = true;
      lastYtDlpCheckTime = now;
      return { available: true };
    } catch (e) {
      cachedYtDlpAvailable = false;
      lastYtDlpCheckTime = now;
      return { available: false, reason: 'yt-dlp binary not found or failed to execute' };
    }
  }

  async download({ url, jobDir, timestamp, options = {}, signal }) {
    const health = await this.checkHealth();
    if (!health.available) {
      throw new Error(`YTDLP_UNAVAILABLE: ${health.reason}`);
    }

    const outputTemplate = path.join(jobDir, `${timestamp}_%(id)s.%(ext)s`);
    const isAudioOnly = options.audioOnly || /music\.youtube\.com/i.test(url);

    const formatSelector = isAudioOnly
      ? 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio/best'
      : 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best[ext=mp4]/best';

    const args = [
      '--no-playlist',
      '--force-ipv4',
      '--geo-bypass',
      '-f', formatSelector,
      '-o', outputTemplate,
      '--restrict-filenames',
      '--no-warnings',
      '--retries', '1',
      '--fragment-retries', '1',
      '--skip-unavailable-fragments',
      '--no-check-certificates',
      '--socket-timeout', '20',
      '--print', 'title',
      '--print', 'after_move:filepath'
    ];

    if (!isAudioOnly) {
      args.push('--merge-output-format', 'mp4');
    }

    const proxyUrl = process.env.YTDL_PROXY || process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
    if (proxyUrl) {
      args.push('--proxy', proxyUrl);
    }

    const isShorts = /shorts/i.test(url);
    if (isShorts) {
      args.push('--extractor-args', 'youtube:player_client=android_vr');
    } else if (isAudioOnly) {
      args.push('--extractor-args', 'youtubemusic:player_client=web,android');
    }

    args.push(url);

    const ytDlpCmd = this.getYtDlpCmd();

    return new Promise((resolve, reject) => {
      const proc = spawn(ytDlpCmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', d => { stdout += d.toString(); });
      proc.stderr.on('data', d => { stderr += d.toString(); });

      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('YTDLP_DIRECT_TIMEOUT: Execution timed out'));
      }, this.timeoutMs);

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          proc.kill('SIGKILL');
          reject(new Error('YTDLP_DIRECT_ABORTED'));
        });
      }

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          const videoTitle = lines.length > 1 ? lines[0] : '';

          const candidate = MediaValidator.findLatestValidFile(jobDir, { prefix: String(timestamp) });
          if (candidate) {
            const validation = MediaValidator.validate(candidate);
            if (validation.valid) {
              return resolve({
                filePath: candidate,
                title: videoTitle,
                mimeType: validation.mimeType,
                size: validation.size,
                provider: this.name
              });
            }
          }
          reject(new Error('YTDLP_DIRECT_FILE_INVALID: Output file validation failed'));
        } else {
          reject(new Error(`YTDLP_DIRECT_FAILED: Process exited with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error('YTDLP_DIRECT_SPAWN_ERROR: ' + err.message));
      });
    });
  }
}
