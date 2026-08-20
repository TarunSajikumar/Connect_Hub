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

// Configuration endpoints for cookie-free extraction
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

// ─── Helpers: URL Parsing ────────────────────────────────────

export function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  const clean = url.trim().replace(/^[<"']+|[>"']+$/g, '');

  const patterns = [
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/)|youtu\.be\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];

  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

export function extractInstagramShortcode(url) {
  if (!url || typeof url !== 'string') return null;
  const clean = url.trim().replace(/^[<"']+|[>"']+$/g, '');
  const match = clean.match(/(?:instagram\.com|instagr\.am)\/(?:p|reel|tv|stories)\/([A-Za-z0-9_-]+)/);
  return match && match[1] ? match[1] : null;
}

// ─── YouTube Extractor ────────────────────────────────────────

export async function fetchYouTubeInfo(videoId, rawUrl) {
  let lastError = null;

  // 1. Invidious API
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

      // Format streams (Video + Audio combined)
      if (Array.isArray(data.formatStreams)) {
        for (const fmt of data.formatStreams) {
          if (fmt.url) {
            formats.push({
              itag: fmt.itag || 18,
              quality: fmt.qualityLabel || fmt.resolution || '720p Video',
              mimeType: fmt.type || 'video/mp4',
              hasVideo: true,
              hasAudio: true,
              container: fmt.container || 'mp4',
              url: fmt.url,
              size: fmt.size || null
            });
          }
        }
      }

      // Adaptive streams (Audio only)
      if (Array.isArray(data.adaptiveFormats)) {
        for (const fmt of data.adaptiveFormats) {
          if (fmt.type?.includes('audio') && fmt.url) {
            formats.push({
              itag: fmt.itag || 140,
              quality: fmt.audioQuality || `${Math.round((fmt.bitrate || 128000) / 1000)}kbps Audio`,
              mimeType: fmt.type || 'audio/mp4',
              hasVideo: false,
              hasAudio: true,
              container: fmt.container || 'mp3',
              url: fmt.url,
              size: fmt.size || null
            });
          }
        }
      }

      // Default fallback streams if none parsed
      if (formats.length === 0) {
        formats.push(
          {
            itag: 18,
            quality: 'HD Video (MP4)',
            mimeType: 'video/mp4',
            hasVideo: true,
            hasAudio: true,
            container: 'mp4',
            url: `https://inv.nadeko.net/latest_version?id=${videoId}&itag=18`
          },
          {
            itag: 140,
            quality: 'Audio MP3',
            mimeType: 'audio/mp3',
            hasVideo: false,
            hasAudio: true,
            container: 'mp3',
            url: `https://inv.nadeko.net/latest_version?id=${videoId}&itag=140`
          }
        );
      }

      const thumbnail =
        data.videoThumbnails?.find(t => t.quality === 'maxresdefault' || t.quality === 'high')?.url ||
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      return {
        title: data.title,
        thumbnail,
        duration: data.lengthSeconds || 0,
        author: data.author || 'YouTube Channel',
        formats
      };
    } catch (err) {
      lastError = err;
    }
  }

  // 2. Cobalt API Fallback
  try {
    const cobaltRes = await axios.post(
      `${COBALT_URL.replace(/\/+$/, '')}/`,
      { url: rawUrl || `https://www.youtube.com/watch?v=${videoId}` },
      {
        timeout: 8000,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' }
      }
    );

    if (cobaltRes.data?.url) {
      return {
        title: cobaltRes.data.filename?.replace(/\.[^/.]+$/, '') || 'YouTube Media',
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        duration: 0,
        author: 'YouTube',
        formats: [
          {
            itag: 18,
            quality: 'Best Quality (MP4)',
            mimeType: 'video/mp4',
            hasVideo: true,
            hasAudio: true,
            container: 'mp4',
            url: cobaltRes.data.url
          }
        ]
      };
    }
  } catch (err) {
    lastError = err;
  }

  // 3. Local yt-dlp fallback if binary is installed
  try {
    const jsonOutput = await new Promise((resolve, reject) => {
      const proc = spawn('yt-dlp', ['--dump-json', '--no-warnings', `https://www.youtube.com/watch?v=${videoId}`]);
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
        title: jsonOutput.title,
        thumbnail: jsonOutput.thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        duration: jsonOutput.duration || 0,
        author: jsonOutput.uploader || 'YouTube',
        formats: [
          {
            itag: 18,
            quality: 'Best Available (MP4)',
            mimeType: 'video/mp4',
            hasVideo: true,
            hasAudio: true,
            container: 'mp4',
            url: jsonOutput.url || `https://www.youtube.com/watch?v=${videoId}`
          }
        ]
      };
    }
  } catch (e) {}

  throw new Error('Failed to fetch YouTube video information without cookies. The video may be private, age-restricted, or removed.');
}

// ─── Instagram Extractor ──────────────────────────────────────

export async function fetchInstagramInfo(rawUrl) {
  // 1. Direct Instagram API extraction
  try {
    const results = await instagramDl(rawUrl);
    if (Array.isArray(results) && results.length > 0) {
      return results.map((item, index) => {
        const isVideo = item.download_url?.includes('.mp4') || item.type === 'video';
        return {
          type: isVideo ? 'video' : 'image',
          url: item.download_url || item.url,
          thumbnail: item.thumbnail || item.download_url,
          title: `Instagram ${isVideo ? 'Reel / Video' : 'Photo'} ${index + 1}`
        };
      });
    }
  } catch (err) {}

  // 2. Cobalt API Fallback
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

      return urls.map((u, i) => {
        const isVideo = u.includes('.mp4');
        return {
          type: isVideo ? 'video' : 'image',
          url: u,
          thumbnail: u,
          title: cobaltRes.data.filename || `Instagram Media ${i + 1}`
        };
      });
    }
  } catch (err) {}

  throw new Error('Failed to extract Instagram media. Please ensure the post is public.');
}

// ─── REST API Routes ──────────────────────────────────────────

// YouTube fetch info
app.post('/api/youtube', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const videoId = extractYouTubeId(url);
    if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });

    const data = await fetchYouTubeInfo(videoId, url);
    res.json({ success: true, data });
  } catch (error) {
    console.error('[YOUTUBE_ERROR]', error.message);
    res.status(500).json({ error: error.message || 'Failed to fetch video information' });
  }
});

// YouTube direct streaming download
app.get('/api/youtube/download', async (req, res) => {
  try {
    const { url, itag, mediaUrl, title } = req.query;
    const targetUrl = mediaUrl || url;

    if (!targetUrl) {
      return res.status(400).send('URL is required');
    }

    const safeTitle = (title || 'youtube-media')
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .trim()
      .slice(0, 80) || 'youtube-media';
    const isAudio = itag == '140' || targetUrl.includes('audio') || targetUrl.includes('.mp3');
    const extension = isAudio ? 'mp3' : 'mp4';

    const response = await axios({
      method: 'get',
      url: targetUrl,
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.${extension}"`);
    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    response.data.pipe(res);
  } catch (error) {
    console.error('[YOUTUBE_DOWNLOAD_ERROR]', error.message);
    res.status(500).send('Download failed');
  }
});

// Instagram fetch info
app.post('/api/instagram', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const shortcode = extractInstagramShortcode(url);
    if (!shortcode) return res.status(400).json({ error: 'Invalid Instagram URL' });

    const mediaData = await fetchInstagramInfo(url);
    if (!mediaData || mediaData.length === 0) {
      return res.status(400).json({ error: 'Failed to extract Instagram media' });
    }

    res.json({ success: true, data: mediaData });
  } catch (error) {
    console.error('[INSTAGRAM_ERROR]', error.message);
    res.status(500).json({ error: error.message || 'Failed to fetch Instagram media' });
  }
});

// Instagram direct streaming download
app.get('/api/instagram/download', async (req, res) => {
  try {
    const { url, title } = req.query;
    if (!url) return res.status(400).send('URL is required');

    const safeTitle = (title || 'instagram-media')
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .trim()
      .slice(0, 80) || 'instagram-media';
    const isVideo = url.includes('.mp4');
    const extension = isVideo ? 'mp4' : 'jpg';

    const response = await axios({
      method: 'get',
      url,
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.${extension}"`);
    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    response.data.pipe(res);
  } catch (error) {
    console.error('[INSTAGRAM_DOWNLOAD_ERROR]', error.message);
    res.status(500).send('Download failed');
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Media Downloader',
    version: '1.0.0',
    mode: 'cookie-free',
    timestamp: new Date().toISOString()
  });
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
