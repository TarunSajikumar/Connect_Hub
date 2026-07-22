import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

export default class InstagramDownloader {
  static extractShortcode(url) {
    const match = url.match(/(?:reel|p|reels|stories)\/([A-Za-z0-9_-]+)/i);
    return match ? match[1] : null;
  }

  static async fetchStream(streamUrl, outputPath) {
    return new Promise((resolve, reject) => {
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
          return InstagramDownloader.fetchStream(res.headers.location, outputPath).then(resolve).catch(reject);
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
            return reject(new Error('Downloaded stream file is empty or invalid'));
          }
          resolve(outputPath);
        });
        fileStream.on('error', (err) => {
          try { fs.unlinkSync(outputPath); } catch (e) {}
          reject(err);
        });
      });
      req.on('error', reject);
      req.setTimeout(35000, () => { req.destroy(); reject(new Error('Media stream download timed out')); });
    });
  }

  static async getDirectVideoCandidates(url) {
    const shortcode = this.extractShortcode(url);
    const cleanUrl = shortcode ? `https://www.instagram.com/reel/${shortcode}/` : url;
    const candidates = [];

    // Candidate 1: SaveIG API
    try {
      console.log('[IG Engine] Querying SaveIG API...');
      const res = await fetch('https://saveig.app/api/ajaxSearch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://saveig.app/en'
        },
        body: new URLSearchParams({ q: cleanUrl, t: 'media', lang: 'en' })
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.data) {
          const mp4Match = json.data.match(/href="(https?:\\?\/\\?[^"]+\.mp4[^"]*)"/i) ||
                           json.data.match(/src="(https?:\\?\/\\?[^"]+\.mp4[^"]*)"/i);
          if (mp4Match && mp4Match[1]) {
            const cleanMp4 = mp4Match[1].replace(/\\\/|\\/g, '/');
            candidates.push({ url: cleanMp4, title: `Instagram_Reel_${shortcode}`, source: 'SaveIG' });
          }
        }
      }
    } catch (e) {
      console.log('[IG Engine] SaveIG query notice:', e.message);
    }

    // Candidate 2: FastDL API
    try {
      console.log('[IG Engine] Querying FastDL API...');
      const body = new URLSearchParams({ q: cleanUrl, vt: 'facebook' }).toString();
      const res = await fetch('https://v3.fastdl.app/api/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Referer': 'https://fastdl.app/'
        },
        body
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.url) {
          const mediaArray = Array.isArray(json.url) ? json.url : [json.url];
          const mp4 = mediaArray.find(m => m.url && (m.type === 'mp4' || m.url.includes('.mp4'))) || mediaArray[0];
          if (mp4 && mp4.url) {
            candidates.push({ url: mp4.url, title: `Instagram_Reel_${shortcode}`, source: 'FastDL' });
          }
        }
      }
    } catch (e) {
      console.log('[IG Engine] FastDL query notice:', e.message);
    }

    // Candidate 3: Publer Media API
    try {
      console.log('[IG Engine] Querying Publer Media API...');
      const res = await fetch('https://publer.io/api/v1/media/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({ url: cleanUrl })
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.payload && json.payload.length > 0) {
          const media = json.payload[0];
          if (media && media.path) {
            candidates.push({ url: media.path, title: `Instagram_Reel_${shortcode}`, source: 'Publer' });
          }
        }
      }
    } catch (e) {
      console.log('[IG Engine] Publer query notice:', e.message);
    }

    // Candidate 4: Snap-Video API
    try {
      console.log('[IG Engine] Querying Snap-Video API...');
      const res = await fetch('https://snap-video3.p.rapidapi.com/download', {
        method: 'POST',
        headers: {
          'x-rapidapi-key': '6c89b60d54mshbd7129398394e6ap1ea9cajsn74a5d4e18244',
          'x-rapidapi-host': 'snap-video3.p.rapidapi.com',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ url: cleanUrl })
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.medias && json.medias.length > 0) {
          const video = json.medias.find(m => m.extension === 'mp4' || m.videoAvailable) || json.medias[0];
          if (video && video.url) {
            candidates.push({ url: video.url, title: json.result?.title || `Instagram_Reel_${shortcode}`, source: 'Snap-Video' });
          }
        }
      }
    } catch (e) {
      console.log('[IG Engine] Snap-Video query notice:', e.message);
    }

    // Candidate 5: Cobalt API
    try {
      console.log('[IG Engine] Querying Cobalt API...');
      const res = await fetch('https://co.wuk.sh/api/json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({ url: cleanUrl })
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.url) {
          candidates.push({ url: json.url, title: `Instagram_Reel_${shortcode}`, source: 'Cobalt' });
        }
      }
    } catch (e) {
      console.log('[IG Engine] Cobalt query notice:', e.message);
    }

    // Candidate 6: Meta Proxies (DDInstagram / KKInstagram / InstaFix)
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

    // Candidate 7: Embed HTML Scraper
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
      throw new Error('Instagram protection active. Please upload your browser cookies.txt in the Downloader panel to download.');
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

    throw new Error('Instagram protection active (HTTP 500/429). Please upload your browser cookies.txt in the Downloader panel below to bypass login protection.');
  }
}
