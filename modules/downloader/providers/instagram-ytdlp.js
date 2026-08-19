// ============================================================
// SOCIAL HUB — modules/downloader/providers/instagram-ytdlp.js
// Instagram Provider 1: yt-dlp
// ============================================================

import path from 'path';
import { spawn } from 'child_process';
import { BaseProvider } from './base-provider.js';
import { MediaValidator } from '../media-validator.js';

export class InstagramYtDlpProvider extends BaseProvider {
  constructor() {
    super({
      name: 'instagram-ytdlp',
      supportedPlatforms: ['instagram'],
      timeoutMs: 30000
    });
  }

  async checkHealth() {
    return { available: true };
  }

  async download({ url, jobDir, timestamp, options = {}, signal }) {
    const outputTemplate = path.join(jobDir, `${timestamp}_%(id)s.%(ext)s`);

    const args = [
      '--no-playlist',
      '--force-ipv4',
      '--merge-output-format', 'mp4',
      '-f', 'bestvideo+bestaudio/best[ext=mp4]/best',
      '-o', outputTemplate,
      '--restrict-filenames',
      '--no-warnings',
      '--retries', '1',
      '--fragment-retries', '1',
      '--skip-unavailable-fragments',
      '--no-check-certificates',
      '--socket-timeout', '20',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      '--referer', 'https://www.instagram.com/',
      '--extractor-args', 'instagram:api_example=1',
      '--print', 'title',
      '--print', 'after_move:filepath',
      url
    ];

    const proxyUrl = process.env.YTDL_PROXY || process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
    if (proxyUrl) {
      args.push('--proxy', proxyUrl);
    }

    const ytDlpCmd = process.env.YTDLP_PATH || 'yt-dlp';

    return new Promise((resolve, reject) => {
      const proc = spawn(ytDlpCmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', d => { stdout += d.toString(); });
      proc.stderr.on('data', d => { stderr += d.toString(); });

      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('INSTAGRAM_YTDLP_TIMEOUT: Download timed out'));
      }, this.timeoutMs);

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          proc.kill('SIGKILL');
          reject(new Error('INSTAGRAM_YTDLP_ABORTED'));
        });
      }

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          const title = lines.length > 1 ? lines[0] : '';

          const candidate = MediaValidator.findLatestValidFile(jobDir, { prefix: String(timestamp) });
          if (candidate) {
            const validation = MediaValidator.validate(candidate);
            if (validation.valid) {
              return resolve({
                filePath: candidate,
                title,
                mimeType: validation.mimeType,
                size: validation.size,
                provider: this.name
              });
            }
          }
          reject(new Error('INSTAGRAM_YTDLP_FILE_INVALID: Output file validation failed'));
        } else {
          reject(new Error(`INSTAGRAM_YTDLP_FAILED: Process exited with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error('INSTAGRAM_YTDLP_SPAWN_ERROR: ' + err.message));
      });
    });
  }
}
