import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

// Helper for safe JSON fetching without syntax error crashes on HTML 403/500 pages
async function safeFetchJson(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    if (!text || text.trim().startsWith('<') || text.includes('<!DOCTYPE') || text.includes('<html')) {
      return { ok: false, error: 'Received HTML instead of JSON' };
    }
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export default class InstagramDownloader {
  static extractShortcode(url) {
    const match = url.match(/(?:reel|p|reels|stories)\/([A-Za-z0-9_-]+)/i);
    return match ? match[1] : null;
  }

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

          const isIgHost = /(?:cdninstagram|fbcdn|instagram\.com|facebook\.com)/i.test(u.hostname);
          const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Fetch-Dest': 'video',
            'Sec-Fetch-Mode': 'cors'
          };

          if (isIgHost) {
            headers['Referer'] = 'https://www.instagram.com/';
            headers['Origin'] = 'https://www.instagram.com';
          } else {
            headers['Referer'] = `${u.origin}/`;
          }

          const client = u.protocol === 'https:' ? https : http;
          const req = client.get(streamUrl, { headers }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              return InstagramDownloader.fetchStream(res.headers.location, outputPath, retries - attempt).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200 && res.statusCode !== 206) {
              return reject(new Error(`Stream request failed with status ${res.statusCode}`));
            }
            const fileStream = fs.createWriteStream(outputPath);
            res.pipe(fileStream);
            fileStream.on('finish', () => {
              fileStream.close();
              const stat = fs.statSync(outputPath);
              if (stat.size < 2000) {
                try { fs.unlinkSync(outputPath); } catch(e) {}
                return reject(new Error('Downloaded stream file is empty or invalid (<2KB)'));
              }
              resolve(outputPath);
            });
            fileStream.on('error', (err) => {
              try { fs.unlinkSync(outputPath); } catch (e) {}
              reject(err);
            });
          });
          req.on('error', reject);
          req.setTimeout(45000, () => { req.destroy(); reject(new Error('Media stream download timed out')); });
        });
      } catch (err) {
        lastErr = err;
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
    throw lastErr || new Error('Stream fetch failed after retries');
  }

  static async getDirectVideoCandidates(url) {
    const shortcode = this.extractShortcode(url);
    const cleanUrl = shortcode ? `https://www.instagram.com/reel/${shortcode}/` : url;
    const candidates = [];

    // Candidate 0: @selxyzz/instagram-dl package
    try {
      console.log('[IG Engine] Querying @selxyzz/instagram-dl engine...');
      const igDl = await import('@selxyzz/instagram-dl');
      const dlFn = igDl.default || igDl.instagramDl || igDl;
      if (typeof dlFn === 'function') {
        const res = await dlFn(cleanUrl);
        if (res && Array.isArray(res) && res.length > 0) {
          const video = res.find(item => item.downloadUrl && (item.downloadUrl.includes('.mp4') || item.type === 'video')) || res[0];
          if (video && video.downloadUrl) {
            candidates.push({ url: video.downloadUrl, title: `Instagram_Reel_${shortcode}`, source: 'instagram-dl-pkg' });
          }
        } else if (res && res.downloadUrl) {
          candidates.push({ url: res.downloadUrl, title: `Instagram_Reel_${shortcode}`, source: 'instagram-dl-pkg' });
        }
      }
    } catch (e) {
      console.log('[IG Engine] @selxyzz/instagram-dl query notice:', e.message);
    }

    // Candidate 1: Cobalt Multi-Instance API Rotation
    const cobaltHosts = [
      'https://co.wuk.sh/api/json',
      'https://api.cobalt.tools/',
      'https://cobalt.stream/api/json'
    ];
    for (const host of cobaltHosts) {
      try {
        console.log(`[IG Engine] Querying Cobalt API (${new URL(host).hostname})...`);
        const { ok, data } = await safeFetchJson(host, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: JSON.stringify({ url: cleanUrl })
        });
        if (ok && data && data.url) {
          candidates.push({ url: data.url, title: `Instagram_Reel_${shortcode}`, source: `Cobalt (${new URL(host).hostname})` });
          break;
        }
      } catch (e) {
        console.log(`[IG Engine] Cobalt (${host}) query notice:`, e.message);
      }
    }

    // Candidate 2: Instagram Direct GraphQL API (Zero Cookie with App-ID header)
    if (shortcode) {
      try {
        console.log('[IG Engine] Querying Instagram Direct GraphQL API...');
        const gqlUrl = `https://www.instagram.com/graphql/query/?doc_id=17991233892455700&variables=${encodeURIComponent(JSON.stringify({ shortcode }))}`;
        const { ok, data } = await safeFetchJson(gqlUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'X-IG-App-ID': '936619743392459',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Fetch-Mode': 'cors'
          }
        });
        if (ok && data && data.data && data.data.xdt_shortcode_media) {
          const media = data.data.xdt_shortcode_media;
          if (media.video_url) {
            candidates.push({ url: media.video_url, title: media.title || `Instagram_Reel_${shortcode}`, source: 'IG Direct GraphQL' });
          }
        }
      } catch (e) {
        console.log('[IG Engine] IG Direct GraphQL notice:', e.message);
      }
    }

    // Candidate 3: SaveIG API
    try {
      console.log('[IG Engine] Querying SaveIG API...');
      const { ok, data } = await safeFetchJson('https://saveig.app/api/ajaxSearch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://saveig.app/en'
        },
        body: new URLSearchParams({ q: cleanUrl, t: 'media', lang: 'en' })
      });
      if (ok && data && data.data) {
        const mp4Match = data.data.match(/href="(https?:\\?\/\\?[^"]+\.mp4[^"]*)"/i) ||
                         data.data.match(/src="(https?:\\?\/\\?[^"]+\.mp4[^"]*)"/i);
        if (mp4Match && mp4Match[1]) {
          const cleanMp4 = mp4Match[1].replace(/\\\/|\\/g, '/');
          candidates.push({ url: cleanMp4, title: `Instagram_Reel_${shortcode}`, source: 'SaveIG' });
        }
      }
    } catch (e) {
      console.log('[IG Engine] SaveIG query notice:', e.message);
    }

    // Candidate 4: FastDL API
    try {
      console.log('[IG Engine] Querying FastDL API...');
      const body = new URLSearchParams({ q: cleanUrl, vt: 'facebook' }).toString();
      const { ok, data } = await safeFetchJson('https://v3.fastdl.app/api/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Referer': 'https://fastdl.app/'
        },
        body
      });
      if (ok && data && data.url) {
        const mediaArray = Array.isArray(data.url) ? data.url : [data.url];
        const mp4 = mediaArray.find(m => m.url && (m.type === 'mp4' || m.url.includes('.mp4'))) || mediaArray[0];
        if (mp4 && mp4.url) {
          candidates.push({ url: mp4.url, title: `Instagram_Reel_${shortcode}`, source: 'FastDL' });
        }
      }
    } catch (e) {
      console.log('[IG Engine] FastDL query notice:', e.message);
    }

    // Candidate 5: Publer Media API
    try {
      console.log('[IG Engine] Querying Publer Media API...');
      const { ok, data } = await safeFetchJson('https://publer.io/api/v1/media/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({ url: cleanUrl })
      });
      if (ok && data && data.payload && data.payload.length > 0) {
        const media = data.payload[0];
        if (media && media.path) {
          candidates.push({ url: media.path, title: `Instagram_Reel_${shortcode}`, source: 'Publer' });
        }
      }
    } catch (e) {
      console.log('[IG Engine] Publer query notice:', e.message);
    }

    // Candidate 6: Snap-Video API (RapidAPI)
    try {
      console.log('[IG Engine] Querying Snap-Video API...');
      const { ok, data } = await safeFetchJson('https://snap-video3.p.rapidapi.com/download', {
        method: 'POST',
        headers: {
          'x-rapidapi-key': '6c89b60d54mshbd7129398394e6ap1ea9cajsn74a5d4e18244',
          'x-rapidapi-host': 'snap-video3.p.rapidapi.com',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ url: cleanUrl })
      });
      if (ok && data && data.medias && data.medias.length > 0) {
        const video = data.medias.find(m => m.extension === 'mp4' || m.videoAvailable) || data.medias[0];
        if (video && video.url) {
          candidates.push({ url: video.url, title: data.result?.title || `Instagram_Reel_${shortcode}`, source: 'Snap-Video' });
        }
      }
    } catch (e) {
      console.log('[IG Engine] Snap-Video query notice:', e.message);
    }

    // Candidate 7: Meta Proxies (DDInstagram / KKInstagram / InstaFix)
    if (shortcode) {
      const metaProxies = [
        { name: 'DDInstagram', url: `https://ddinstagram.com/reel/${shortcode}/` },
        { name: 'KKInstagram', url: `https://kkinstagram.com/reel/${shortcode}/` },
        { name: 'InstaFix', url: `https://instafix.app/p/${shortcode}` }
      ];

      for (const proxy of metaProxies) {
        try {
          const res = await fetch(proxy.url, {
            headers: {
              'User-Agent': 'facebookexternalhit/1.1; (+http://www.facebook.com/externalhit_uatext.php)'
            }
          });
          if (res.ok) {
            const html = await res.text();
            const videoMatch = html.match(/<meta\s+property="og:video"\s+content="([^"]+)"/i) ||
                               html.match(/<meta\s+property="og:video:secure_url"\s+content="([^"]+)"/i) ||
                               html.match(/<meta\s+name="twitter:player:stream"\s+content="([^"]+)"/i);
            if (videoMatch && videoMatch[1]) {
              candidates.push({ url: videoMatch[1], title: `Instagram_Reel_${shortcode}`, source: proxy.name });
            }
          }
        } catch (e) {}
      }
    }

    // Candidate 8: Embed HTML Scraper
    if (shortcode) {
      try {
        const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
        const res = await fetch(embedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });
        if (res.ok) {
          const html = await res.text();
          const videoUrlMatches = [...html.matchAll(/video_url["']:\s*["']([^"'\\]+(?:\\.[^"'\\]*)*)["']/g)];
          if (videoUrlMatches.length) {
            const vUrl = videoUrlMatches[0][1].replace(/\\u0026/g, '&').replace(/\\/g, '');
            candidates.push({ url: vUrl, title: `Instagram_Reel_${shortcode}`, source: 'Embed JSON' });
          }
          const mp4Matches = [...html.matchAll(/(https?:\\\/\\\/[^"'\s]+\.mp4[^"'\s]*)/g)];
          if (mp4Matches.length) {
            const cleanMp4 = mp4Matches[0][1].replace(/\\\/|\\/g, '/');
            candidates.push({ url: cleanMp4, title: `Instagram_Reel_${shortcode}`, source: 'Embed MP4' });
          }
        }
      } catch(e) {}
    }

    return candidates;
  }

  static async downloadReel(url, downloadsDir) {
    const candidates = await this.getDirectVideoCandidates(url);

    if (!candidates || candidates.length === 0) {
      throw new Error('Unable to extract Instagram video stream. Please check your network connection or Instagram link format.');
    }

    let lastError = null;
    for (const candidate of candidates) {
      try {
        console.log(`[IG Engine] Downloading video stream via [${candidate.source}]...`);
        const timestamp = Date.now();
        const safeTitle = (candidate.title || 'Instagram_Video').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
        const filename = `${timestamp}_${safeTitle}.mp4`;
        const outputPath = path.join(downloadsDir, filename);

        await this.fetchStream(candidate.url, outputPath);

        const stat = fs.statSync(outputPath);
        if (stat.size > 2000) {
          console.log(`[IG Engine] ✅ Direct extraction download succeeded via [${candidate.source}] (${(stat.size / 1024 / 1024).toFixed(2)} MB)!`);
          return {
            filename,
            filePath: outputPath,
            size: stat.size,
            mimeType: 'video/mp4'
          };
        }
      } catch (err) {
        console.warn(`[IG Engine] Strategy [${candidate.source}] stream download error: ${err.message}. Trying next candidate...`);
        lastError = err;
      }
    }

    throw new Error('Instagram protection or network rate limit active (HTTP 500/429). The direct extraction candidates failed to fetch video bytes.');
  }
}

