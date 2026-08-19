// ============================================================
// SOCIAL HUB — modules/downloader/providers/ytdlp-po.js
// Provider 1: yt-dlp + PO-Token Provider
// ============================================================

import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { BaseProvider } from './base-provider.js';
import { MediaValidator } from '../media-validator.js';

export class YtDlpPoProvider extends BaseProvider {
  constructor() {
    super({
      name: 'yt-dlp-po',
      supportedPlatforms: ['youtube'],
      timeoutMs: 40000
    });
  }

  getProviderEndpoint() {
    return (
      process.env.POT_PROVIDER_URL ||
      process.env.YT_POT_PROVIDER_URL ||
      process.env.BGUTIL_POT_PROVIDER_URL ||
      null
    );
  }

  async checkHealth() {
    const endpoint = this.getProviderEndpoint();
    if (!endpoint) {
      return { available: false, reason: 'No PO Token provider endpoint configured' };
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
      return { available: false, reason: `PO Token provider responded with HTTP ${res.status}` };
    } catch (e) {
      return { available: false, reason: `PO Token provider unreachable: ${e.message}` };
    }
  }

  async fetchTokens() {
    const endpoint = this.getProviderEndpoint();
    if (!endpoint) return null;

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(4000)
    });

    if (!res.ok) throw new Error(`PO provider status ${res.status}`);
    const data = await res.json();
    const poToken = data.poToken || data.po_token || data.token;
    const visitorData = data.visitorData || data.visitor_data;

    if (!poToken) throw new Error('No poToken returned by provider');

    let extractorArg = `youtube:player_client=web;po_token=web.gvs+${poToken},web.player+${poToken}`;
    if (visitorData) {
      extractorArg += `;visitor_data=${visitorData}`;
    }
    return extractorArg;
  }

  async download({ url, jobDir, timestamp, options = {}, signal }) {
    const extractorArg = await this.fetchTokens();
    if (!extractorArg) {
      throw new Error('YTDLP_PO_UNAVAILABLE: PO Token provider returned no token');
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

    const ytDlpCmd = process.env.YTDLP_PATH || 'yt-dlp';

    return new Promise((resolve, reject) => {
      const proc = spawn(ytDlpCmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', d => { stdout += d.toString(); });
      proc.stderr.on('data', d => { stderr += d.toString(); });

      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('YTDLP_PO_TIMEOUT: Download timed out'));
      }, this.timeoutMs);

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          proc.kill('SIGKILL');
          reject(new Error('YTDLP_PO_ABORTED'));
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
          reject(new Error('YTDLP_PO_FILE_INVALID: Output file validation failed'));
        } else {
          reject(new Error(`YTDLP_PO_FAILED: Process exited with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error('YTDLP_PO_SPAWN_ERROR: ' + err.message));
      });
    });
  }
}
