// ============================================================
// SOCIAL HUB — modules/downloader/errors.js
// Centralized Error Taxonomy and Classifier
// ============================================================

export const ErrorCodes = {
  YOUTUBE_UNAVAILABLE: 'YOUTUBE_UNAVAILABLE',
  YOUTUBE_ACCESS_RESTRICTED: 'YOUTUBE_ACCESS_RESTRICTED',
  YOUTUBE_PROVIDER_FAILED: 'YOUTUBE_PROVIDER_FAILED',
  INSTAGRAM_UNAVAILABLE: 'INSTAGRAM_UNAVAILABLE',
  INSTAGRAM_PROVIDER_FAILED: 'INSTAGRAM_PROVIDER_FAILED',
  UNSUPPORTED_PLATFORM: 'UNSUPPORTED_PLATFORM',
  INVALID_URL: 'INVALID_URL',
  PROVIDER_TIMEOUT: 'PROVIDER_TIMEOUT',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  MEDIA_FILE_INVALID: 'MEDIA_FILE_INVALID',
  MEDIA_FILE_NOT_FOUND: 'MEDIA_FILE_NOT_FOUND',
  DOWNLOAD_TIMEOUT: 'DOWNLOAD_TIMEOUT',
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  ALL_DOWNLOAD_PROVIDERS_FAILED: 'ALL_DOWNLOAD_PROVIDERS_FAILED'
};

const SafeUserMessages = {
  [ErrorCodes.YOUTUBE_UNAVAILABLE]: 'This YouTube video is unavailable, private, or has been removed.',
  [ErrorCodes.YOUTUBE_ACCESS_RESTRICTED]: 'YouTube requires sign-in or rejects anonymous access for this video. This app will not use browser cookies.',
  [ErrorCodes.YOUTUBE_PROVIDER_FAILED]: 'Unable to retrieve this YouTube media from the available download engines.',
  [ErrorCodes.INSTAGRAM_UNAVAILABLE]: 'This Instagram post/reel is private, unavailable, or has been removed.',
  [ErrorCodes.INSTAGRAM_PROVIDER_FAILED]: 'Unable to retrieve this Instagram media from the available download engines.',
  [ErrorCodes.UNSUPPORTED_PLATFORM]: 'Only publicly accessible YouTube and Instagram URLs are supported.',
  [ErrorCodes.INVALID_URL]: 'The provided link is invalid or incomplete. Please check the URL.',
  [ErrorCodes.PROVIDER_TIMEOUT]: 'The download engine timed out while processing this request.',
  [ErrorCodes.PROVIDER_UNAVAILABLE]: 'The requested download engine is currently offline or unreachable.',
  [ErrorCodes.MEDIA_FILE_INVALID]: 'The retrieved media file was invalid or corrupted. Please try again.',
  [ErrorCodes.MEDIA_FILE_NOT_FOUND]: 'The media file could not be saved to storage. Please try again.',
  [ErrorCodes.DOWNLOAD_TIMEOUT]: 'The download request took too long and timed out. Please try again.',
  [ErrorCodes.DOWNLOAD_FAILED]: 'Unable to retrieve this public media from the available download engines.',
  [ErrorCodes.ALL_DOWNLOAD_PROVIDERS_FAILED]: 'The media could not be retrieved from the available download providers.'
};

/**
 * Classifies any internal provider error or exception into a normalized
 * error code and safe, user-friendly message. Never exposes raw stderr or internal details.
 *
 * @param {Error|string} err - The error or error message
 * @param {'youtube'|'instagram'|string} [platform='unknown'] - Media platform
 * @returns {{ code: string, message: string }}
 */
export function classifyError(err, platform = 'unknown') {
  const msg = (typeof err === 'string' ? err : err?.message || '').toLowerCase();

  // 1. Definitively unavailable / removed / private
  if (/video unavailable|private video|this video has been removed|is not available|deleted|does not exist|post not found|reel not found/i.test(msg)) {
    if (platform === 'instagram' || /instagram/i.test(platform)) {
      return {
        code: ErrorCodes.INSTAGRAM_UNAVAILABLE,
        message: SafeUserMessages[ErrorCodes.INSTAGRAM_UNAVAILABLE]
      };
    }
    return {
      code: ErrorCodes.YOUTUBE_UNAVAILABLE,
      message: SafeUserMessages[ErrorCodes.YOUTUBE_UNAVAILABLE]
    };
  }

  // 2. Region / access restriction
  if (/geo-blocked|not available in your country|age-restricted|members-only|sign in to confirm|login required|http error 403|forbidden/i.test(msg)) {
    return {
      code: ErrorCodes.YOUTUBE_ACCESS_RESTRICTED,
      message: SafeUserMessages[ErrorCodes.YOUTUBE_ACCESS_RESTRICTED]
    };
  }

  // 3. Timeouts
  if (/timed out|timeout|abort/i.test(msg)) {
    return {
      code: ErrorCodes.DOWNLOAD_TIMEOUT,
      message: SafeUserMessages[ErrorCodes.DOWNLOAD_TIMEOUT]
    };
  }

  // 4. File validation failures
  if (/output file could not be located|file not found/i.test(msg)) {
    return {
      code: ErrorCodes.MEDIA_FILE_NOT_FOUND,
      message: SafeUserMessages[ErrorCodes.MEDIA_FILE_NOT_FOUND]
    };
  }
  if (/file is empty|0 bytes|invalid media/i.test(msg)) {
    return {
      code: ErrorCodes.MEDIA_FILE_INVALID,
      message: SafeUserMessages[ErrorCodes.MEDIA_FILE_INVALID]
    };
  }

  // 5. Provider specific failures
  if (platform === 'instagram' || /instagram/i.test(platform)) {
    return {
      code: ErrorCodes.INSTAGRAM_PROVIDER_FAILED,
      message: SafeUserMessages[ErrorCodes.INSTAGRAM_PROVIDER_FAILED]
    };
  }

  if (platform === 'youtube' || /youtube/i.test(platform)) {
    return {
      code: ErrorCodes.YOUTUBE_PROVIDER_FAILED,
      message: SafeUserMessages[ErrorCodes.YOUTUBE_PROVIDER_FAILED]
    };
  }

  return {
    code: ErrorCodes.DOWNLOAD_FAILED,
    message: SafeUserMessages[ErrorCodes.DOWNLOAD_FAILED]
  };
}

export class DownloaderError extends Error {
  constructor(code, customMessage = null) {
    const message = customMessage || SafeUserMessages[code] || 'Download failed';
    super(message);
    this.name = 'DownloaderError';
    this.code = code;
  }
}
