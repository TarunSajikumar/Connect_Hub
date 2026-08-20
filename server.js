// ============================================================
// MEDIA DOWNLOADER — Cookie-Free YouTube & Instagram Engine
// ============================================================

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import instagramDl from '@selxyzz/instagram-dl';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const INVIDIOUS_INSTANCES = [
  process.env.INVIDIOUS_API_URL,
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://vid.puffyan.us',
  'https://yt.artemislena.eu'
].filter(Boolean);

const COBALT_URL = process.env.COBALT_API_URL || 'https://cobalt-api.kwiatekm.pl';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── URL Normalization & Validation ──────────────────────────

export function parseMediaUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let clean = rawUrl.trim();

  // Strip markdown or angle brackets
  const mdMatch = clean.match(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/);
  if (mdMatch) clean = mdMatch[2];
  clean = clean.replace(/^[<"']+|[>"']+$/g, '').trim();

  try {
    const parsed = new URL(clean);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    // YouTube patterns
    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtu.be'
    ) {
      let videoId = null;
      let isShorts = false;
      let isMusic = host === 'music.youtube.com';

      if (host === 'youtu.be') {
        videoId = parsed.pathname.slice(1).split('/')[0].split('?')[0];
      } else if (parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.split('/shorts/')[1].split('/')[0].split('?')[0];
        isShorts = true;
      } else if (parsed.pathname.startsWith('/live/')) {
        videoId = parsed.pathname.split('/live/')[1].split('/')[0].split('?')[0];
      } else if (parsed.pathname.startsWith('/embed/')) {
        videoId = parsed.pathname.split('/embed/')[1].split('/')[0].split('?')[0];
      } else if (parsed.searchParams.has('v')) {
        videoId = parsed.searchParams.get('v');
      }

      if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return {
          platform: 'youtube',
          videoId,
          isShorts,
          isMusic,
          url: `https://www.youtube.com/watch?v=${videoId}`
        };
      }
    }

    // Instagram patterns
    if (host === 'instagram.com' || host === 'instagr.am') {
      const match = parsed.pathname.match(/\/(p|reel|tv|stories)\/([A-Za-z0-9_-]+)/);
      if (match) {
        return {
          platform: 'instagram',
          shortcode: match[2],
          type: match[1],
          url: `https://www.instagram.com/${match[1]}/${match[2]}/`
        };
      }
    }
  } catch (err) {
    return null;
  }

  return null;
}

// ─── YouTube Extractor ────────────────────────────────────────

export async function extractYouTube(videoId, rawUrl) {
  let lastError = null;

  // 1. Try Invidious Instances
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const endpoint = `${instance.replace(/\/+$/, '')}/api/v1/videos/${videoId}`;
      const res = await axios.get(endpoint, {
        timeout: 7000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });

      const data = res.data;
      if (!data || !data.title) continue;

      const formats = [];

      // Video + Audio progressive streams
      if (Array.isArray(data.formatStreams)) {
        for (const fmt of data.formatStreams) {
          if (fmt.url) {
            formats.push({
              quality: fmt.qualityLabel || fmt.resolution || 'HD Video',
              type: 'video',
              container: fmt.container || 'mp4',
              url: fmt.url,
              size: fmt.size || null,
              hasAudio: true
            });
          }
        }
      }

      // Audio only streams
      if (Array.isArray(data.adaptiveFormats)) {
        for (const fmt of data.adaptiveFormats) {
          if (fmt.type?.includes('audio') && fmt.url) {
            formats.push({
              quality: fmt.audioQuality || `${Math.round((fmt.bitrate || 128000) / 1000)}kbps Audio`,
              type: 'audio',
              container: fmt.container || 'mp3',
              url: fmt.url,
              size: fmt.size || null,
              hasAudio: true
            });
          }
        }
      }

      // Pick best thumbnail
      const thumbnail =
        data.videoThumbnails?.find(t => t.quality === 'maxresdefault' || t.quality === 'high')?.url ||
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      return {
        platform: 'youtube',
        videoId,
        title: data.title || 'YouTube Video',
        author: data.author || 'YouTube Channel',
        duration: data.lengthSeconds || 0,
        thumbnail,
        formats: formats.length > 0 ? formats : [
          {
            quality: 'HD Video',
            type: 'video',
            container: 'mp4',
            url: `https://inv.nadeko.net/latest_version?id=${videoId}&itag=18`,
            hasAudio: true
          },
          {
            quality: 'Audio MP3',
            type: 'audio',
            container: 'mp3',
            url: `https://inv.nadeko.net/latest_version?id=${videoId}&itag=140`,
            hasAudio: true
          }
        ]
      };
    } catch (err) {
      lastError = err;
    }
  }

  // 2. Try Cobalt Engine
  try {
    const cobaltRes = await axios.post(
      `${COBALT_URL.replace(/\/+$/, '')}/`,
      { url: rawUrl },
      {
        timeout: 8000,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (cobaltRes.data?.url) {
      return {
        platform: 'youtube',
        videoId,
        title: cobaltRes.data.filename?.replace(/\.[^/.]+$/, '') || 'YouTube Media',
        author: 'YouTube',
        duration: 0,
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        formats: [
          {
            quality: 'Best Quality',
            type: 'video',
            container: 'mp4',
            url: cobaltRes.data.url,
            hasAudio: true
          }
        ]
      };
    }
  } catch (err) {
    lastError = err;
  }

  // 3. Fallback: yt-dlp dump-json if installed on host
  try {
    const jsonOutput = await new Promise((resolve, reject) => {
      const proc = spawn('yt-dlp', ['--dump-json', '--no-warnings', rawUrl]);
      let stdout = '';
      proc.stdout.on('data', d => { stdout += d; });
      proc.on('close', code => {
        if (code === 0 && stdout) resolve(JSON.parse(stdout));
        else reject(new Error('yt-dlp failed'));
      });
      proc.on('error', reject);
    });

    if (jsonOutput?.title) {
      return {
        platform: 'youtube',
        videoId,
        title: jsonOutput.title,
        author: jsonOutput.uploader || 'YouTube',
        duration: jsonOutput.duration || 0,
        thumbnail: jsonOutput.thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        formats: [
          {
            quality: 'Best Available',
            type: 'video',
            container: 'mp4',
            url: jsonOutput.url || rawUrl,
            hasAudio: true
          }
        ]
      };
    }
  } catch (e) {}

  throw new Error('Unable to fetch YouTube video details without cookies. The video may be private, age-restricted, or removed.');
}

// ─── Instagram Extractor ──────────────────────────────────────

export async function extractInstagram(rawUrl) {
  // 1. Direct Instagram API extraction
  try {
    const results = await instagramDl(rawUrl);
    if (Array.isArray(results) && results.length > 0) {
      const items = results.map((item, idx) => {
        const isVideo = item.download_url?.includes('.mp4') || item.type === 'video';
        return {
          quality: isVideo ? 'HD Video / Reel' : 'High Quality Photo',
          type: isVideo ? 'video' : 'image',
          container: isVideo ? 'mp4' : 'jpg',
          url: item.download_url || item.url,
          thumbnail: item.thumbnail || item.download_url
        };
      });

      return {
        platform: 'instagram',
        title: 'Instagram Post / Reel',
        author: 'Instagram User',
        thumbnail: items[0].thumbnail || items[0].url,
        formats: items
      };
    }
  } catch (err) {}

  // 2. Cobalt fallback for Instagram
  try {
    const cobaltRes = await axios.post(
      `${COBALT_URL.replace(/\/+$/, '')}/`,
      { url: rawUrl },
      {
        timeout: 8000,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' }
      }
    );

    if (cobaltRes.data?.url || cobaltRes.data?.picker) {
      const urls = cobaltRes.data.picker
        ? cobaltRes.data.picker.map(p => p.url)
        : [cobaltRes.data.url];

      const formats = urls.map((u, i) => ({
        quality: u.includes('.mp4') ? `Video Part ${i + 1}` : `Media Item ${i + 1}`,
        type: u.includes('.mp4') ? 'video' : 'image',
        container: u.includes('.mp4') ? 'mp4' : 'jpg',
        url: u
      }));

      return {
        platform: 'instagram',
        title: cobaltRes.data.filename || 'Instagram Media',
        author: 'Instagram',
        thumbnail: formats[0].url,
        formats
      };
    }
  } catch (err) {}

  throw new Error('Unable to extract Instagram media. Please ensure the post or account is public.');
}

// ─── API Routes ───────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Media Downloader',
    version: '1.0.0',
    mode: 'cookie-free',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/fetch', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Please enter a valid URL' });
    }

    const parsed = parseMediaUrl(url);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported URL. Please paste a valid YouTube or Instagram link.'
      });
    }

    let mediaData = null;
    if (parsed.platform === 'youtube') {
      mediaData = await extractYouTube(parsed.videoId, parsed.url);
    } else if (parsed.platform === 'instagram') {
      mediaData = await extractInstagram(parsed.url);
    }

    res.json({
      success: true,
      data: mediaData
    });
  } catch (err) {
    console.error('[FETCH_ERROR]', err.message);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch media information'
    });
  }
});

// Proxy download stream endpoint for clean file downloads
app.get('/api/download', async (req, res) => {
  try {
    const { url, filename, ext } = req.query;
    if (!url) {
      return res.status(400).send('URL query parameter is required');
    }

    const safeTitle = (filename || 'media')
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .trim()
      .slice(0, 80) || 'media';
    const extension = ext || (url.includes('.mp4') ? 'mp4' : 'jpg');
    const fullFilename = `${safeTitle}.${extension}`;

    const response = await axios({
      method: 'get',
      url,
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fullFilename)}"`);
    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    response.data.pipe(res);
  } catch (err) {
    console.error('[DOWNLOAD_STREAM_ERROR]', err.message);
    res.status(500).send('Failed to stream download file');
  }
});

// Catch-all route to serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

export { app };

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  🚀 MEDIA DOWNLOADER is running`);
    console.log(`  💻 Local URL: http://localhost:${PORT}`);
    console.log(`  🔒 Mode: Cookie-Free / Anonymous Extraction`);
    console.log(`======================================================\n`);
  });
}
