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
      const client = streamUrl.startsWith('https') ? https : http;
      const req = client.get(streamUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': '*/*'
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return InstagramDownloader.fetchStream(res.headers.location, outputPath).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Stream request failed with status ${res.statusCode}`));
        }
        const fileStream = fs.createWriteStream(outputPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(outputPath);
        });
        fileStream.on('error', (err) => {
          try { fs.unlinkSync(outputPath); } catch (e) {}
          reject(err);
        });
      });
      req.on('error', reject);
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('Media stream download timed out')); });
    });
  }

  static async getDirectVideoUrl(url) {
    const shortcode = this.extractShortcode(url);
    const cleanUrl = shortcode ? `https://www.instagram.com/reel/${shortcode}/` : url;

    // Strategy 1: Snap-Video API endpoint
    try {
      console.log('[IG Engine] Trying Snap-Video extraction strategy...');
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
            console.log('[IG Engine] ✅ Direct extraction succeeded via Snap-Video!');
            return { url: video.url, title: json.result?.title || `Instagram_Reel_${shortcode}` };
          }
        }
      }
    } catch (e) {
      console.log('[IG Engine] Snap-Video strategy notice:', e.message);
    }

    // Strategy 2: FastDL Conversion API
    try {
      console.log('[IG Engine] Trying FastDL API strategy...');
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
            console.log('[IG Engine] ✅ Direct extraction succeeded via FastDL API!');
            return { url: mp4.url, title: `Instagram_Reel_${shortcode}` };
          }
        }
      }
    } catch (e) {
      console.log('[IG Engine] FastDL strategy notice:', e.message);
    }

    // Strategy 3: DDInstagram / InstaFix metadata scraper
    if (shortcode) {
      const metaProxies = [
        `https://ddinstagram.com/reel/${shortcode}/`,
        `https://kkinstagram.com/reel/${shortcode}/`,
        `https://instafix.app/p/${shortcode}`
      ];

      for (const proxyUrl of metaProxies) {
        try {
          console.log(`[IG Engine] Trying Meta Proxy: ${proxyUrl}...`);
          const res = await fetch(proxyUrl, {
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
              console.log('[IG Engine] ✅ Direct extraction succeeded via Meta Proxy!');
              return { url: videoMatch[1], title: `Instagram_Reel_${shortcode}` };
            }
          }
        } catch (e) {}
      }
    }

    // Strategy 4: Embed HTML scraper
    if (shortcode) {
      try {
        console.log('[IG Engine] Trying Embed HTML scraper...');
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
            console.log('[IG Engine] ✅ Embed HTML scraper succeeded!');
            return { url: vUrl, title: `Instagram_Reel_${shortcode}` };
          }
          const mp4Matches = [...html.matchAll(/(https?:\\\/\\\/[^"'\s]+\.mp4[^"'\s]*)/g)];
          if (mp4Matches.length) {
            const cleanMp4 = mp4Matches[0][1].replace(/\\\/|\\/g, '/');
            console.log('[IG Engine] ✅ Embed MP4 scraper succeeded!');
            return { url: cleanMp4, title: `Instagram_Reel_${shortcode}` };
          }
        }
      } catch(e) {}
    }

    throw new Error('Unable to download Instagram video automatically. Please check if the link is valid and public.');
  }

  static async downloadReel(url, downloadsDir) {
    const { url: directUrl, title } = await this.getDirectVideoUrl(url);
    const timestamp = Date.now();
    const safeTitle = (title || 'Instagram_Video').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
    const filename = `${timestamp}_${safeTitle}.mp4`;
    const outputPath = path.join(downloadsDir, filename);

    console.log(`[IG Engine] Downloading direct video stream to: ${filename}`);
    await this.fetchStream(directUrl, outputPath);

    const stat = fs.statSync(outputPath);
    return {
      filename,
      filePath: outputPath,
      size: stat.size,
      mimeType: 'video/mp4'
    };
  }
}
