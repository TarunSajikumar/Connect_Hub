// ============================================================
// SOCIAL HUB — modules/downloader/providers/instagram-fallback.js
// Instagram Provider 2: Direct Multi-Engine Fallback
// ============================================================

import path from 'path';
import { BaseProvider } from './base-provider.js';
import { MediaValidator } from '../media-validator.js';
import InstagramDownloader from '../../instagram_downloader.js';

export class InstagramFallbackProvider extends BaseProvider {
  constructor() {
    super({
      name: 'instagram-fallback',
      supportedPlatforms: ['instagram'],
      timeoutMs: 35000
    });
  }

  async checkHealth() {
    return { available: true };
  }

  async download({ url, jobDir, timestamp, options = {}, signal }) {
    try {
      const result = await InstagramDownloader.downloadReel(url, jobDir);
      if (!result || !result.filePath) {
        throw new Error('INSTAGRAM_FALLBACK_EMPTY: No file returned');
      }

      const validation = MediaValidator.validate(result.filePath);
      if (!validation.valid) {
        throw new Error(`INSTAGRAM_FALLBACK_FILE_INVALID: ${validation.error}`);
      }

      return {
        filePath: result.filePath,
        title: result.title || result.filename,
        mimeType: validation.mimeType,
        size: validation.size,
        provider: this.name
      };
    } catch (err) {
      throw new Error(`INSTAGRAM_FALLBACK_FAILED: ${err.message}`);
    }
  }
}
