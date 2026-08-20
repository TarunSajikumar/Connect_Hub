// ============================================================
// MEDIA DOWNLOADER — Server Backend (Cookie-Free & Rate-Limit Safe)
// ============================================================

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import instagramDl from '@selxyzz/instagram-dl';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Cookie-free Invidious & Cobalt public API endpoints
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

// ─── Helper: Extract YouTube ID ──────────────────────────────

export function extractYouTubeId(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let clean = rawUrl.trim();
  const mdMatch = clean.match(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/);
  if (mdMatch) clean = mdMatch[2];
  clean = clean.replace(/^[<"']+|[>"']+$/g, '').trim();

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([^&\s?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];

  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match && match[1] && /^[a-zA-Z0-9_-]{11}$/.test(match[1])) {
      return match[1];
    }
  }
  return null;
}

// ─── Helper: Extract Instagram Shortcode ──────────────────────

export function extractInstagramUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let clean = rawUrl.trim();
  const mdMatch = clean.match(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/);
  if (mdMatch) clean = mdMatch[2];
  clean = clean.replace(/^[<"']+|[>"']+$/g, '').trim();

  if (/instagram\.com|instagr\.am/i.test(clean)) {
    const match = clean.match(/\/(p|reel|tv|stories)\/([A-Za-z0-9_-]+)/);
    if (match) {
      return `https://www.instagram.com/${match[1]}/${match[2]}/`;
    }
    return clean;
  }
  return null;
}

// ─── YouTube Extractor Function ───────────────────────────────

export async function fetchYouTubeInfo(videoId, rawUrl) {
  let lastError = null;

  // 1. Invidious progressive extraction (fast, multi-quality)
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

      // Progressive video streams (Video + Audio)
      if (Array.isArray(data.formatStreams)) {
        data.formatStreams.forEach((fmt, idx) => {
          if (fmt.url) {
            formats.push({
              itag: fmt.itag || (18 + idx),
              quality: fmt.qualityLabel || fmt.resolution || '720p HD',
              type: 'video',
              hasVideo: true,
              hasAudio: true,
              container: fmt.container || 'mp4',
              url: fmt.url,
              size: fmt.size || null
            });
          }
        });
      }

      // Audio only streams
      if (Array.isArray(data.adaptiveFormats)) {
        data.adaptiveFormats.forEach((fmt, idx) => {
          if (fmt.type?.includes('audio') && fmt.url) {
            formats.push({
              itag: fmt.itag || (140 + idx),
              quality: fmt.audioQuality || `${Math.round((fmt.bitrate || 128000) / 1000)}kbps Audio`,
              type: 'audio',
              hasVideo: false,
              hasAudio: true,
              container: fmt.container || 'mp3',
              url: fmt.url,
              size: fmt.size || null
            });
          }
        });
      }

      const thumbnail =
        data.videoThumbnails?.find(t => t.quality === 'maxresdefault' || t.quality === 'high')?.url ||
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      return {
        title: data.title || 'YouTube Video',
        thumbnail,
        duration: data.lengthSeconds || 0,
        author: data.author || 'YouTube Channel',
        formats: formats.length > 0 ? formats : [
          {
            itag: 18,
            quality: '720p HD Video',
            type: 'video',
            hasVideo: true,
            hasAudio: true,
            container: 'mp4',
            url: `https://inv.nadeko.net/latest_version?id=${videoId}&itag=18`
          },
          {
            itag: 140,
            quality: '128kbps MP3 Audio',
            type: 'audio',
            hasVideo: false,
            hasAudio: true,
            container: 'mp3',
            url: `https://inv.nadeko.net/latest_version?id=${videoId}&itag=140`
          }
        ]
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
            itag: 22,
            quality: 'Best HD Quality (Video + Audio)',
            type: 'video',
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

  throw new Error('Unable to extract YouTube video. The video may be private, age-restricted, or removed.');
}

// ─── Instagram Extractor Function ─────────────────────────────

export async function fetchInstagramInfo(rawUrl) {
  // 1. Direct Instagram API extraction via @selxyzz/instagram-dl
  try {
    const results = await instagramDl(rawUrl);
    if (Array.isArray(results) && results.length > 0) {
      const mediaList = results.map((item, idx) => {
        const isVideo = item.download_url?.includes('.mp4') || item.type === 'video';
        return {
          type: isVideo ? 'video' : 'image',
          quality: isVideo ? `HD Video / Reel (Part ${idx + 1})` : `High-Res Photo (${idx + 1})`,
          url: item.download_url || item.url,
          thumbnail: item.thumbnail || item.download_url,
          title: `Instagram Media ${idx + 1}`
        };
      });

      return {
        title: 'Instagram Post / Reel',
        author: 'Instagram User',
        thumbnail: mediaList[0].thumbnail || mediaList[0].url,
        media: mediaList
      };
    }
  } catch (e) {}

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

      const mediaList = urls.map((u, i) => ({
        type: u.includes('.mp4') ? 'video' : 'image',
        quality: u.includes('.mp4') ? `HD Reel / Video ${i + 1}` : `Photo ${i + 1}`,
        url: u,
        thumbnail: u,
        title: cobaltRes.data.filename || `Instagram Media ${i + 1}`
      }));

      return {
        title: cobaltRes.data.filename || 'Instagram Media',
        author: 'Instagram',
        thumbnail: mediaList[0].url,
        media: mediaList
      };
    }
  } catch (e) {}

  throw new Error('Unable to extract Instagram media. Please ensure the post or reel is from a public account.');
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
    console.error('YouTube error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to fetch YouTube media' });
  }
});

// YouTube direct streaming download
app.get('/api/youtube/download', async (req, res) => {
  try {
    const { url, title, itag } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const safeTitle = (title || 'youtube-media').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'video';
    const isAudio = itag === '140' || url.includes('audio') || url.includes('.mp3');
    const extension = isAudio ? 'mp3' : 'mp4';

    const response = await axios({
      method: 'get',
      url,
      responseType: 'stream',
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    res.header('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.${extension}"`);
    if (response.headers['content-type']) res.header('Content-Type', response.headers['content-type']);
    if (response.headers['content-length']) res.header('Content-Length', response.headers['content-length']);

    response.data.pipe(res);
  } catch (error) {
    console.error('YouTube download error:', error.message);
    res.status(500).json({ error: 'Download failed' });
  }
});

// Instagram fetch info
app.post('/api/instagram', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const cleanUrl = extractInstagramUrl(url);
    if (!cleanUrl) return res.status(400).json({ error: 'Invalid Instagram URL' });

    const data = await fetchInstagramInfo(cleanUrl);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Instagram error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to fetch Instagram media' });
  }
});

// Instagram direct streaming download
app.get('/api/instagram/download', async (req, res) => {
  try {
    const { url, title } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const isVideo = url.includes('.mp4');
    const extension = isVideo ? 'mp4' : 'jpg';
    const safeTitle = (title || 'instagram-media').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'instagram';

    const response = await axios({
      method: 'get',
      url,
      responseType: 'stream',
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    res.header('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.${extension}"`);
    if (response.headers['content-type']) res.header('Content-Type', response.headers['content-type']);
    if (response.headers['content-length']) res.header('Content-Length', response.headers['content-length']);

    response.data.pipe(res);
  } catch (error) {
    console.error('Instagram download error:', error.message);
    res.status(500).json({ error: 'Download failed' });
  }
});

// Universal fetch endpoint
app.post('/api/fetch', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ success: false, error: 'URL is required' });

  if (extractYouTubeId(url)) {
    return app._router.handle({ ...req, url: '/api/youtube' }, res);
  }
  if (extractInstagramUrl(url)) {
    return app._router.handle({ ...req, url: '/api/instagram' }, res);
  }
  return res.status(400).json({ success: false, error: 'Unsupported URL. Please paste a valid YouTube or Instagram link.' });
});

// Universal download proxy
app.get('/api/download', async (req, res) => {
  const { url, filename, ext } = req.query;
  if (!url) return res.status(400).send('URL query parameter is required');

  try {
    const isVideo = ext === 'mp4' || url.includes('.mp4');
    const extension = ext || (isVideo ? 'mp4' : (url.includes('.mp3') ? 'mp3' : 'jpg'));
    const safeName = (filename || 'download').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'media';

    const response = await axios({
      method: 'get',
      url,
      responseType: 'stream',
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeName)}.${extension}"`);
    if (response.headers['content-type']) res.setHeader('Content-Type', response.headers['content-type']);
    if (response.headers['content-length']) res.setHeader('Content-Length', response.headers['content-length']);

    response.data.pipe(res);
  } catch (err) {
    res.status(500).send('Download stream failed');
  }
});

// Catch-all
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
