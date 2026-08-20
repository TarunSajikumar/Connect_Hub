// ============================================================
// Invidious Provider — anonymous public YouTube media proxy
// ============================================================

import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import { BaseProvider } from './base-provider.js';
import { MediaValidator } from '../media-validator.js';

export class InvidiousProvider extends BaseProvider {
  constructor() {
    super({ name: 'invidious', supportedPlatforms: ['youtube'], timeoutMs: 35000 });
  }

  getEndpoint() {
    const endpoint = process.env.INVIDIOUS_API_URL;
    return endpoint ? endpoint.replace(/\/+$/, '') : null;
  }

  async checkHealth() {
    if (!this.getEndpoint()) {
      return { available: false, reason: 'INVIDIOUS_API_URL is not configured' };
    }
    return { available: true };
  }

  static downloadStream(streamUrl, destination, timeoutMs) {
    return new Promise((resolve, reject) => {
      let stream;
      try {
        stream = new URL(streamUrl);
      } catch {
        reject(new Error('INVIDIOUS_INVALID_STREAM: Provider returned an invalid media URL'));
        return;
      }

      const client = stream.protocol === 'https:' ? https : http;
      const request = client.get(stream, {
        headers: {
          // Deliberately no Cookie header. This provider must remain anonymous.
          'Accept': '*/*',
          'User-Agent': 'SocialHub/2.0'
        }
      }, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          InvidiousProvider.downloadStream(new URL(response.headers.location, stream).toString(), destination, timeoutMs)
            .then(resolve, reject);
          return;
        }
        if (response.statusCode !== 200 && response.statusCode !== 206) {
          reject(new Error(`INVIDIOUS_STREAM_FAILED: Media stream returned HTTP ${response.statusCode}`));
          return;
        }

        const output = fs.createWriteStream(destination);
        response.pipe(output);
        output.on('finish', () => output.close(() => resolve(destination)));
        output.on('error', (error) => {
          try { fs.unlinkSync(destination); } catch {}
          reject(error);
        });
      });

      request.on('error', reject);
      request.setTimeout(timeoutMs, () => {
        request.destroy();
        try { fs.unlinkSync(destination); } catch {}
        reject(new Error('INVIDIOUS_STREAM_TIMEOUT: Media stream timed out'));
      });
    });
  }

  async download({ jobDir, timestamp, options = {} }) {
    const endpoint = this.getEndpoint();
    const videoId = options.videoId;
    if (!endpoint || !videoId) {
      throw new Error('INVIDIOUS_UNAVAILABLE: Anonymous YouTube provider is not configured');
    }

    const response = await fetch(`${endpoint}/api/v1/videos/${encodeURIComponent(videoId)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      throw new Error(`INVIDIOUS_METADATA_FAILED: Provider returned HTTP ${response.status}`);
    }

    const video = await response.json();
    const streams = Array.isArray(video.formatStreams) ? video.formatStreams : [];
    const mp4Streams = streams.filter((stream) => stream?.url && /mp4/i.test(stream.container || stream.type || ''));
    const candidates = mp4Streams.length ? mp4Streams : streams.filter((stream) => stream?.url);
    if (!candidates.length) {
      throw new Error('INVIDIOUS_NO_STREAM: No progressive public media stream is available');
    }

    const best = candidates.sort((a, b) => {
      const pixels = (stream) => Number.parseInt(String(stream.resolution || '').match(/\d+/)?.[0] || '0', 10);
      return pixels(b) - pixels(a) || Number(b.bitrate || 0) - Number(a.bitrate || 0);
    })[0];
    const extension = /webm/i.test(best.container || best.type || '') ? 'webm' : 'mp4';
    const filePath = path.join(jobDir, `${timestamp}_invidious.${extension}`);

    await InvidiousProvider.downloadStream(best.url, filePath, this.timeoutMs);
    const validation = MediaValidator.validate(filePath);
    if (!validation.valid) {
      throw new Error(`INVIDIOUS_FILE_INVALID: ${validation.error}`);
    }

    return {
      filePath,
      title: video.title || 'YouTube video',
      mimeType: validation.mimeType,
      size: validation.size,
      provider: this.name
    };
  }
}
