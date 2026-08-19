import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { spawn } from 'child_process';

// Helper to completely strip any cookie/auth references from child process errors
export function sanitizeError(msg) {
  if (!msg) return '';
  return msg
    .replace(/Use --cookies-from-browser or --cookies for the authentication\.?/gi, '')
    .replace(/See\s+https:\/\/github\.com\/yt-dlp\/yt-dlp\/wiki\/FAQ#how-do-i-pass-cookies-to-yt-dlp[^\s]*/gi, '')
    .replace(/Also see\s+https:\/\/github\.com\/yt-dlp\/yt-dlp\/wiki\/Extractors#exporting-youtube-cookies[^\s]*/gi, '')
    .replace(/--cookies-from-browser/gi, '')
    .replace(/--cookies/gi, '')
    .replace(/cookies\.txt/gi, '')
    .replace(/cookies/gi, 'verification')
    .replace(/cookie/gi, 'token')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Helper for safe JSON fetching
async function safeFetchJson(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    if (!text || text.trim().startsWith('<') || text.includes('<!DOCTYPE') || text.includes('<html')) {
      return { ok: false, status: res.status, error: 'Received HTML instead of JSON' };
    }
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export default class YouTubeDownloader {
  /**
   * Extract clean 11-char YouTube Video ID from any YouTube URL format
   */
  static extractVideoId(url) {
    if (!url) return null;
    const cleanUrl = url.trim();
    
    // 1. YouTube Shorts: youtube.com/shorts/<id>
    const shortsMatch = cleanUrl.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i);
    if (shortsMatch) return shortsMatch[1];

    // 2. YouTube Music: music.youtube.com/watch?v=<id>
    const musicMatch = cleanUrl.match(/music\.youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/i);
    if (musicMatch) return musicMatch[1];

    // 3. Shortlink: youtu.be/<id>
    const shortMatch = cleanUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
    if (shortMatch) return shortMatch[1];

    // 4. Standard Watch: youtube.com/watch?v=<id>
    const watchMatch = cleanUrl.match(/youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/i);
    if (watchMatch) return watchMatch[1];

    // 5. Embed or Live: youtube.com/(embed|live)/<id>
    const embedMatch = cleanUrl.match(/youtube\.com\/(?:embed|live)\/([a-zA-Z0-9_-]{11})/i);
    if (embedMatch) return embedMatch[1];

    return null;
  }

  /**
   * Download a stream directly from a URL to a local destination file
   */
  static async fetchStream(streamUrl, outputPath, retries = 2) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await new Promise((resolve, reject) => {
          let u;
          try {
            u = new URL(streamUrl);
          } catch (e) {
            return reject(new Error('Invalid video stream URL extracted'));
          }

          const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Fetch-Dest': 'video',
            'Sec-Fetch-Mode': 'cors',
            'Referer': `${u.origin}/`
          };

          const client = u.protocol === 'https:' ? https : http;
          const req = client.get(streamUrl, { headers }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              return YouTubeDownloader.fetchStream(res.headers.location, outputPath, retries - attempt)
                .then(resolve)
                .catch(reject);
            }
            if (res.statusCode !== 200 && res.statusCode !== 206) {
              return reject(new Error(`Stream request failed with status ${res.statusCode}`));
            }

            const fileStream = fs.createWriteStream(outputPath);
            res.pipe(fileStream);

            fileStream.on('finish', () => {
              fileStream.close(() => {
                const stat = fs.statSync(outputPath);
                if (stat.size === 0) {
                  fs.unlinkSync(outputPath);
                  reject(new Error('Downloaded stream file was 0 bytes'));
                } else {
                  resolve(outputPath);
                }
              });
            });

            fileStream.on('error', (err) => {
              try { fs.unlinkSync(outputPath); } catch (e) {}
              reject(err);
            });
          });

          req.on('error', reject);
          req.setTimeout(45000, () => {
            req.destroy();
            reject(new Error('Stream download timed out after 45s'));
          });
        });
      } catch (err) {
        lastErr = err;
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (e) {}
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    throw lastErr || new Error('Stream download failed after retries');
  }

  /**
   * Agent 1: Native yt-dlp with multi-profile rotation
   */
  static async downloadWithYtDlp({
    url,
    downloadsDir,
    timestamp,
    ytDlpCmd = 'yt-dlp',
    ffmpegCmd = 'ffmpeg',
    ffmpegAvailable = true,
    denoCmd = null,
    denoAvailable = false,
    clientProfile = 'android_vr',
    poTokenArgs = null
  }) {
    const outputTemplate = path.join(downloadsDir, `${timestamp}_%(id)s.%(ext)s`);
    const args = [
      '--no-playlist',
      '--force-ipv4',
      '--geo-bypass',
      '--merge-output-format', 'mp4',
      '-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/bestaudio/best[ext=mp4]/best',
      '-o', outputTemplate,
      '--restrict-filenames',
      '--no-warnings',
      '--retries', '2',
      '--fragment-retries', '2',
      '--skip-unavailable-fragments',
      '--no-check-certificates',
      '--socket-timeout', '30'
    ];

    const proxyUrl = process.env.YTDL_PROXY || process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
    if (proxyUrl) {
      args.push('--proxy', proxyUrl);
    }

    if (denoAvailable && denoCmd) {
      args.push('--js-runtimes', `deno:${denoCmd}`, '--js-runtimes', 'node');
    } else {
      args.push('--js-runtimes', 'node');
    }

    if (ffmpegAvailable && ffmpegCmd) {
      const ffmpegDir = path.isAbsolute(ffmpegCmd)
        ? path.dirname(ffmpegCmd)
        : (path.dirname(ffmpegCmd) || '.');
      args.push('--ffmpeg-location', ffmpegDir);
    }

    const isMusicUrl = /music\.youtube\.com/i.test(url);
    if (isMusicUrl) {
      args.push('--extractor-args', 'youtubemusic:player_client=web,android');
    }

    if (poTokenArgs) {
      args.push('--extractor-args', poTokenArgs);
    } else if (clientProfile && clientProfile !== 'default') {
      args.push('--extractor-args', `youtube:player_client=${clientProfile}`);
    }

    args.push('--print', 'title', '--print', 'after_move:filepath', url);

    return new Promise((resolve, reject) => {
      const proc = spawn(ytDlpCmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', d => { stdout += d.toString(); });
      proc.stderr.on('data', d => { stderr += d.toString(); });

      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error('yt-dlp download timed out'));
      }, 50 * 1000);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          const videoTitle = lines.length > 1 ? lines[0] : '';
          let foundPath = null;

          for (let i = lines.length - 1; i >= 0; i--) {
            const candidate = lines[i];
            if (
              candidate !== videoTitle &&
              fs.existsSync(candidate) &&
              !/\.f\d+\./i.test(candidate) &&
              !candidate.endsWith('.part')
            ) {
              foundPath = candidate;
              break;
            }
          }

          if (!foundPath) {
            try {
              const matchingFiles = fs.readdirSync(downloadsDir)
                .filter(f =>
                  f.startsWith(String(timestamp)) &&
                  !/\.f\d+\./i.test(f) &&
                  !f.endsWith('.part') &&
                  !f.endsWith('.ytdl')
                )
                .map(f => ({ f, full: path.join(downloadsDir, f), t: fs.statSync(path.join(downloadsDir, f)).mtimeMs }))
                .sort((a, b) => b.t - a.t);
              if (matchingFiles.length > 0) {
                foundPath = matchingFiles[0].full;
              }
            } catch (e) {}
          }

          if (foundPath && fs.existsSync(foundPath)) {
            const fstat = fs.statSync(foundPath);
            if (fstat.size === 0) {
              reject(new Error('Download completed but output file is empty (0 bytes)'));
            } else {
              resolve({ filePath: foundPath, videoTitle, agent: `yt-dlp (${clientProfile})` });
            }
          } else {
            reject(new Error('Download completed but output file could not be located'));
          }
        } else {
          const rawErr = (stderr || stdout).replace(/\x1b\[[0-9;]*m/g, '').trim();
          const cleanErr = sanitizeError(rawErr);
          reject(new Error(cleanErr || 'yt-dlp execution failed'));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error('Failed to start yt-dlp: ' + err.message));
      });
    });
  }

  /**
   * Agent 2: Fetch Proof-of-Origin (PO) Token from bgutil / POT Provider Service
   */
  static async fetchPoToken() {
    const providerUrls = [
      process.env.BGUTIL_POT_PROVIDER_URL,
      process.env.YT_POT_PROVIDER_URL,
      process.env.POT_PROVIDER_URL,
      'http://127.0.0.1:4416/pot',
      'http://localhost:4416/pot'
    ].filter(Boolean);

    for (const pUrl of providerUrls) {
      try {
        const res = await safeFetchJson(pUrl, { signal: AbortSignal.timeout(3000) });
        if (res.ok && res.data) {
          const poToken = res.data.poToken || res.data.po_token || res.data.token;
          const visitorData = res.data.visitorData || res.data.visitor_data;
          if (poToken) {
            let arg = `youtube:player_client=web;po_token=web.gvs+${poToken},web.player+${poToken}`;
            if (visitorData) {
              arg += `;visitor_data=${visitorData}`;
            }
            return arg;
          }
        }
      } catch (e) {}
    }

    if (process.env.YOUTUBE_PO_TOKEN) {
      let arg = `youtube:player_client=web;po_token=web.gvs+${process.env.YOUTUBE_PO_TOKEN},web.player+${process.env.YOUTUBE_PO_TOKEN}`;
      if (process.env.YOUTUBE_VISITOR_DATA) {
        arg += `;visitor_data=${process.env.YOUTUBE_VISITOR_DATA}`;
      }
      return arg;
    }

    return null;
  }

  /**
   * Agent 3: Cobalt Media Downloader Fallback Agent
   * Calls Cobalt API (v10 / v7 format) to resolve direct stream URLs
   */
  static async downloadWithCobalt({ url, downloadsDir, timestamp }) {
    const cobaltInstances = [
      process.env.COBALT_API_URL,
      'https://cobalt-api.kwiatekm.pl',
      'https://cobalt.canine.tools',
      'https://api.cobalt.tools'
    ].filter(Boolean);

    const videoId = YouTubeDownloader.extractVideoId(url) || 'video';
    const outputPath = path.join(downloadsDir, `${timestamp}_${videoId}.mp4`);

    for (const instance of cobaltInstances) {
      try {
        const cleanInstance = instance.replace(/\/+$/, '');
        const endpoint = cleanInstance.endsWith('/api/json') ? cleanInstance : `${cleanInstance}/`;

        const reqBody = {
          url: url,
          videoQuality: '1080',
          youtubeVideoCodec: 'h264',
          audioFormat: 'mp3'
        };

        const headers = {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };

        if (process.env.COBALT_API_KEY) {
          headers['Authorization'] = `Api-Key ${process.env.COBALT_API_KEY}`;
        }

        const res = await safeFetchJson(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(reqBody),
          signal: AbortSignal.timeout(10000)
        });

        if (!res.ok || !res.data) continue;

        const data = res.data;
        let streamUrl = null;
        let title = data.filename || `YouTube_${videoId}`;

        if (data.url) {
          streamUrl = data.url;
        } else if (data.status === 'tunnel' || data.status === 'redirect') {
          streamUrl = data.url;
        } else if (data.status === 'picker' && Array.isArray(data.picker) && data.picker.length > 0) {
          streamUrl = data.picker[0].url;
        }

        if (streamUrl) {
          console.log(`[DOWNLOAD] Cobalt Agent resolved stream from ${instance}. Downloading payload...`);
          await YouTubeDownloader.fetchStream(streamUrl, outputPath);
          if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            return {
              filePath: outputPath,
              videoTitle: title,
              agent: `Cobalt (${new URL(instance).hostname})`
            };
          }
        }
      } catch (err) {
        console.warn(`[DOWNLOAD] Cobalt Agent (${instance}) error:`, err.message);
      }
    }

    throw new Error('Cobalt fallback agent could not retrieve stream');
  }

  /**
   * Main Unified YouTube Pipeline
   * Runs:
   * 1. yt-dlp + Profile Rotation (android_vr, mweb, tv_embedded, web_embedded, android, default)
   * 2. yt-dlp + PO Token Provider / bgutil (if POT service available)
   * 3. Cobalt API Fallback Agent (if bot detection encountered)
   */
  static async download({
    url,
    downloadsDir,
    timestamp = Date.now(),
    ytDlpCmd = 'yt-dlp',
    ffmpegCmd = 'ffmpeg',
    ffmpegAvailable = true,
    denoCmd = null,
    denoAvailable = false
  }) {
    // Pipeline Strategy 1: yt-dlp with optimized client profile rotation
    const ytProfiles = [
      'android_vr',
      'mweb',
      'tv_embedded',
      'web_embedded',
      'android',
      'default'
    ];

    let lastError = null;

    for (const profile of ytProfiles) {
      try {
        console.log(`[DOWNLOAD] Trying Agent: yt-dlp profile '${profile}'...`);
        const result = await YouTubeDownloader.downloadWithYtDlp({
          url,
          downloadsDir,
          timestamp,
          ytDlpCmd,
          ffmpegCmd,
          ffmpegAvailable,
          denoCmd,
          denoAvailable,
          clientProfile: profile
        });
        if (result && result.filePath) {
          return result;
        }
      } catch (err) {
        lastError = err;
        const msg = err.message.substring(0, 160);
        console.warn(`[DOWNLOAD] yt-dlp profile '${profile}' notice: ${msg}`);

        // If video is definitively removed or private on YouTube, stop retrying
        if (/video unavailable|private video|this video has been removed|is not available|deleted|does not exist/i.test(err.message)) {
          throw err;
        }
      }
    }

    // Pipeline Strategy 2: yt-dlp + PO Token Provider (bgutil / BOTGUARD)
    try {
      const poTokenArgs = await YouTubeDownloader.fetchPoToken();
      if (poTokenArgs) {
        console.log(`[DOWNLOAD] Trying Agent: yt-dlp + PO Token Provider (bgutil)...`);
        const potResult = await YouTubeDownloader.downloadWithYtDlp({
          url,
          downloadsDir,
          timestamp,
          ytDlpCmd,
          ffmpegCmd,
          ffmpegAvailable,
          denoCmd,
          denoAvailable,
          poTokenArgs
        });
        if (potResult && potResult.filePath) {
          return potResult;
        }
      }
    } catch (potErr) {
      console.warn(`[DOWNLOAD] PO Token agent notice:`, potErr.message.substring(0, 160));
    }

    // Pipeline Strategy 3: Cobalt API Fallback Agent
    try {
      console.log(`[DOWNLOAD] Trying Agent: Cobalt Fallback Agent...`);
      const cobaltResult = await YouTubeDownloader.downloadWithCobalt({
        url,
        downloadsDir,
        timestamp
      });
      if (cobaltResult && cobaltResult.filePath) {
        return cobaltResult;
      }
    } catch (cobaltErr) {
      console.warn(`[DOWNLOAD] Cobalt agent notice:`, cobaltErr.message.substring(0, 160));
    }

    throw lastError || new Error('All YouTube download agents were exhausted');
  }
}
