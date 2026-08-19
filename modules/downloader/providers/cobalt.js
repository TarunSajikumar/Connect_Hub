// ============================================================
// SOCIAL HUB — modules/downloader/providers/cobalt.js
// Provider 4: Cobalt API Provider
// ============================================================

import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { BaseProvider } from './base-provider.js';
import { MediaValidator } from '../media-validator.js';

export class CobaltProvider extends BaseProvider {
  constructor() {
    super({
      name: 'cobalt',
      supportedPlatforms: ['youtube', 'instagram'],
      timeoutMs: 30000
    });
  }

  getEndpoint() {
    const raw = process.env.COBALT_API_URL;
    if (!raw) return null;
    return raw.replace(/\/+$/, '');
  }

  async checkHealth() {
    const endpoint = this.getEndpoint();
    if (!endpoint) {
      return { available: false, reason: 'No COBALT_API_URL configured in environment' };
    }

    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok || res.status === 405) {
        return { available: true };
      }
      return { available: false, reason: `Cobalt endpoint returned HTTP ${res.status}` };
    } catch (e) {
      return { available: false, reason: `Cobalt endpoint unreachable: ${e.message}` };
    }
  }

  static async downloadStream(streamUrl, destPath, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      let u;
      try {
        u = new URL(streamUrl);
      } catch (e) {
        return reject(new Error('Invalid stream URL from Cobalt'));
      }

      const client = u.protocol === 'https:' ? https : http;
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*'
      };

      const req = client.get(streamUrl, { headers }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return CobaltProvider.downloadStream(res.headers.location, destPath, timeoutMs)
            .then(resolve)
            .catch(reject);
        }

        if (res.statusCode !== 200 && res.statusCode !== 206) {
          return reject(new Error(`Cobalt stream download HTTP ${res.statusCode}`));
        }

        const ws = fs.createWriteStream(destPath);
        res.pipe(ws);

        ws.on('finish', () => {
          ws.close(() => resolve(destPath));
        });

        ws.on('error', (err) => {
          try { fs.unlinkSync(destPath); } catch {}
          reject(err);
        });
      });

      req.on('error', reject);
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        try { fs.unlinkSync(destPath); } catch {}
        reject(new Error('Cobalt stream download timed out'));
      });
    });
  }

  async download({ url, jobDir, timestamp, options = {}, signal }) {
    const endpoint = this.getEndpoint();
    if (!endpoint) {
      throw new Error('COBALT_UNAVAILABLE: No COBALT_API_URL configured');
    }

    const postEndpoint = endpoint.endsWith('/api/json') ? endpoint : `${endpoint}/`;
    const isAudioOnly = options.audioOnly || /music\.youtube\.com/i.test(url);

    const body = {
      url,
      videoQuality: isAudioOnly ? 'audio' : '1080',
      youtubeVideoCodec: 'h264',
      downloadMode: isAudioOnly ? 'audio' : 'auto'
    };

    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'SocialHub/2.0'
    };

    if (process.env.COBALT_API_KEY) {
      headers['Authorization'] = `Api-Key ${process.env.COBALT_API_KEY}`;
    }

    const res = await fetch(postEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      throw new Error(`COBALT_FAILED: API returned HTTP ${res.status}`);
    }

    const data = await res.json();
    let streamUrl = null;
    let title = data.filename || 'Cobalt Media';

    if (data.url) {
      streamUrl = data.url;
    } else if (data.status === 'tunnel' || data.status === 'redirect') {
      streamUrl = data.url;
    } else if (data.status === 'picker' && Array.isArray(data.picker) && data.picker.length > 0) {
      streamUrl = data.picker[0].url;
    }

    if (!streamUrl) {
      throw new Error('COBALT_NO_STREAM: Cobalt did not return a valid stream URL');
    }

    const ext = isAudioOnly ? 'mp3' : 'mp4';
    const destPath = path.join(jobDir, `${timestamp}_cobalt.${ext}`);

    await CobaltProvider.downloadStream(streamUrl, destPath, this.timeoutMs);

    const validation = MediaValidator.validate(destPath);
    if (!validation.valid) {
      throw new Error(`COBALT_FILE_INVALID: ${validation.error}`);
    }

    return {
      filePath: destPath,
      title,
      mimeType: validation.mimeType,
      size: validation.size,
      provider: this.name
    };
  }
}
