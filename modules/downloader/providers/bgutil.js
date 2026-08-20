// ============================================================
// SOCIAL HUB — modules/downloader/providers/bgutil.js
// Provider: yt-dlp + BGUTIL PO Token Provider (Proof of Origin)
// ============================================================

import path from 'path';
import { spawn, execSync } from 'child_process';
import { BaseProvider } from './base-provider.js';
import { MediaValidator } from '../media-validator.js';

let cachedYtDlpAvailable = null;
let lastYtDlpCheckTime = 0;

export class BgutilProvider extends BaseProvider {
  constructor() {
    super({
      name: 'bgutil',
      supportedPlatforms: ['youtube'],
      timeoutMs: 40000
    });
  }

  getEndpoint() {
    const raw = process.env.BGUTIL_API_URL || process.env.BGUTIL_URL;
    if (!raw) return null;
    return raw.trim().replace(/\/+$/, '');
  }

  getYtDlpCmd() {
    return process.env.YTDLP_PATH || 'yt-dlp';
  }

  isYtDlpAvailable() {
    const now = Date.now();
    if (cachedYtDlpAvailable !== null && (now - lastYtDlpCheckTime < 60000)) {
      return cachedYtDlpAvailable;
    }
    const cmd = this.getYtDlpCmd();
    try {
      execSync(`"${cmd}" --version`, { stdio: 'ignore', timeout: 3000 });
      cachedYtDlpAvailable = true;
      lastYtDlpCheckTime = now;
      return true;
    } catch {
      cachedYtDlpAvailable = false;
      lastYtDlpCheckTime = now;
      return false;
    }
  }

  async checkHealth() {
    if (!this.isYtDlpAvailable()) {
      return { available: false, reason: 'yt-dlp binary not found in PATH' };
    }

    const endpoint = this.getEndpoint();
    if (!endpoint) {
      return { available: false, reason: 'BGUTIL_API_URL is not configured' };
    }

    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        return { available: true };
      }
      return { available: false, reason: `bgutil endpoint responded with HTTP ${res.status}` };
    } catch (e) {
      return { available: false, reason: `bgutil endpoint unreachable (${e.message})` };
    }
  }

  async fetchBgutilToken() {
    const endpoint = this.getEndpoint();
    if (!endpoint) return null;

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(4000)
    });

    if (!res.ok) throw new Error(`bgutil returned status ${res.status}`);
    const data = await res.json();
    const token = data.token || data.poToken || data.po_token || data.pot;
    const visitorData = data.visitorData || data.visitor_data;

    if (!token) throw new Error('bgutil response contained no valid PO token');

    let arg = `youtube:player_client=web;po_token=web.gvs+${token},web.player+${token}`;
    if (visitorData) {
      arg += `;visitor_data=${visitorData}`;
    }
    return arg;
  }

  async download({ url, jobDir, timestamp, options = {}, signal }) {
    const health = await this.checkHealth();
    if (!health.available) {
      throw new Error(`BGUTIL_UNAVAILABLE: ${health.reason}`);
    }

    const extractorArg = await this.fetchBgutilToken();
    if (!extractorArg) {
      throw new Error('BGUTIL_UNAVAILABLE: bgutil service could not provide token');
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
      '--socket-timeout', '25',
      '--extractor-args', extractorArg,
      '--print', 'title',
      '--print', 'after_move:filepath',
      url
    ];

    if (!isAudioOnly) {
      args.splice(args.indexOf('-f'), 0, '--merge-output-format', 'mp4');
    }

    const proxyUrl = process.env.YTDL_PROXY || process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
    if (proxyUrl) {
      args.push('--proxy', proxyUrl);
    }

    const ytDlpCmd = this.getYtDlpCmd();

    return new Promise((resolve, reject) => {
      const proc = spawn(ytDlpCmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', d => { stdout += d.toString(); });
      proc.stderr.on('data', d => { stderr += d.toString(); });

      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('BGUTIL_TIMEOUT: Download timed out'));
      }, this.timeoutMs);

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          proc.kill('SIGKILL');
          reject(new Error('BGUTIL_ABORTED'));
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
          reject(new Error('BGUTIL_FILE_INVALID: Output file validation failed'));
        } else {
          reject(new Error(`BGUTIL_FAILED: Process exited with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error('BGUTIL_SPAWN_ERROR: ' + err.message));
      });
    });
  }
}
