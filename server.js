// ============================================================
// ContentHub — server.js
// Main Express + WebSocket server
// ============================================================

import dns from 'dns';

// DNS Fallback Patch: Fixes ENOTFOUND errors when local ISP DNS blocks/fails to resolve api.telegram.org
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4', '1.0.0.1']);
const origLookup = dns.lookup;
dns.lookup = function(hostname, options, callback) {
  let cb = callback;
  let opts = options;
  if (typeof options === 'function') {
    cb = options;
    opts = {};
  }
  origLookup.call(dns, hostname, opts, (err, address, family) => {
    if (err && (err.code === 'ENOTFOUND' || err.code === 'EREFUSED' || err.code === 'ETIMEDOUT')) {
      dns.resolve4(hostname, (rErr, addrs) => {
        if (!rErr && addrs && addrs.length) {
          if (opts && opts.all) {
            return cb(null, addrs.map(a => ({ address: a, family: 4 })));
          }
          return cb(null, addrs[0], 4);
        }
        return cb(err, address, family);
      });
      return;
    }
    return cb(err, address, family);
  });
};

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import multer from 'multer';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';
import cors from 'cors';
import { spawn, execSync } from 'child_process';

import WhatsAppModule from './modules/whatsapp.js';
import TelegramModule from './modules/telegram.js';
import HistoryManager from './modules/history.js';
import SchedulerModule from './modules/scheduler.js';
import SessionManager from './modules/session_manager.js';
import InstagramDownloader from './modules/instagram_downloader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── App Setup ──────────────────────────────────────────────
const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });
wss.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port 4000 is already in use by another process.`);
  } else {
    console.error('[WSS] Server error:', err.message);
  }
});

// Ensure required directories exist
for (const dir of ['uploads', 'sessions', 'sessions/whatsapp', 'downloads']) {
  const p = path.join(__dirname, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Environment & PATH Recovery (Windows support) ───────────
if (process.platform === 'win32') {
  try {
    const userPath = execSync('reg query HKCU\\Environment /v PATH', { stdio: 'pipe' }).toString();
    const systemPath = execSync('reg query "HKLM\\System\\CurrentControlSet\\Control\\Session Manager\\Environment" /v PATH', { stdio: 'pipe' }).toString();

    const parseRegPath = (output) => {
      const match = output.match(/REG_(?:EXPAND_)?SZ\s+(.*)/i);
      return match ? match[1].trim() : '';
    };

    const parsedUser = parseRegPath(userPath);
    const parsedSystem = parseRegPath(systemPath);

    if (parsedUser || parsedSystem) {
      process.env.PATH = `${parsedUser};${parsedSystem};${process.env.PATH}`;
    }
  } catch (e) {}

  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const packagesDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(packagesDir)) {
      try {
        const dirs = fs.readdirSync(packagesDir);
        for (const dirName of dirs) {
          const fullDir = path.join(packagesDir, dirName);
          if (dirName.toLowerCase().includes('yt-dlp.yt-dlp')) {
            process.env.PATH = `${fullDir};${process.env.PATH}`;
          } else if (dirName.toLowerCase().includes('yt-dlp.ffmpeg')) {
            try {
              const subdirs = fs.readdirSync(fullDir);
              for (const sub of subdirs) {
                const binPath = path.join(fullDir, sub, 'bin');
                if (fs.existsSync(binPath)) {
                  process.env.PATH = `${binPath};${process.env.PATH}`;
                }
              }
            } catch (err) {}
          }
        }
      } catch (err) {}
    }
  }
}

// ─── Cookie Helper for Media Downloader ──────────────────────
function getCookieFilePath() {
  const possiblePaths = [
    path.join(__dirname, 'sessions', 'cookies.txt'),
    path.join(__dirname, 'sessions', 'instagram', 'cookies.txt'),
    path.join(__dirname, 'cookies.txt')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.statSync(p).size > 0) return p;
  }
  return null;
}

// ─── yt-dlp availability check ──────────────────────────────
let ytDlpAvailable = false;
let ytDlpCmd = 'yt-dlp';
try {
  execSync('yt-dlp --version', { stdio: 'pipe' });
  ytDlpAvailable = true;
  console.log('  ✅ yt-dlp   — Media downloader ready');
} catch (e) {
  const localLinuxBin = path.join(__dirname, 'yt-dlp');
  const localWinBin = path.join(__dirname, 'yt-dlp.exe');

  if (fs.existsSync(localLinuxBin)) {
    ytDlpCmd = localLinuxBin;
    ytDlpAvailable = true;
  } else if (fs.existsSync(localWinBin)) {
    ytDlpCmd = localWinBin;
    ytDlpAvailable = true;
  } else {
    const windowsPaths = [
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'yt-dlp.exe'),
      path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Microsoft', 'WinGet', 'Links', 'yt-dlp.exe'),
      'C:\\Windows\\System32\\yt-dlp.exe'
    ];
    for (const p of windowsPaths) {
      if (fs.existsSync(p)) {
        ytDlpCmd = p;
        ytDlpAvailable = true;
        break;
      }
    }
  }

  // Auto-download yt-dlp executable on Linux cloud hosting if missing
  if (!ytDlpAvailable && process.platform === 'linux') {
    try {
      console.log('  📥 [Setup] Downloading yt-dlp binary for Linux hosting…');
      execSync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "${localLinuxBin}" && chmod +x "${localLinuxBin}"`, { stdio: 'ignore' });
      if (fs.existsSync(localLinuxBin)) {
        ytDlpCmd = localLinuxBin;
        ytDlpAvailable = true;
        console.log('  ✅ yt-dlp   — Downloaded & ready for Linux cloud environment');
      }
    } catch (dlErr) {
      console.error('  ⚠️ [Setup] Could not auto-download yt-dlp binary:', dlErr.message);
    }
  }
}

// ─── File Upload (multer) ────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }
});

// ─── WebSocket Broadcasting ──────────────────────────────────
const clients = new Set();
wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'status', data: getStatus() }));
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

// ─── Platform Modules & History & Scheduler & Session ────────
const wa = new WhatsAppModule(broadcast, path.join(__dirname, 'sessions'));
const tg = new TelegramModule(broadcast, path.join(__dirname, 'sessions'));
const historyManager = new HistoryManager(path.join(__dirname, 'sessions'));
const scheduler = new SchedulerModule(broadcast, path.join(__dirname, 'sessions'), wa, tg);
const sessionManager = new SessionManager(path.join(__dirname, 'sessions'));

// Auto-Reconnect Remembered Sessions on Server Boot
(async () => {
  const cfg = sessionManager.getConfig();
  if (cfg.rememberMe !== false) {
    // 1. WhatsApp Auto-Reconnect
    const waCreds = path.join(__dirname, 'sessions', 'whatsapp', 'creds.json');
    if (cfg.whatsapp?.autoConnect !== false && fs.existsSync(waCreds)) {
      try {
        console.log('  🔒 [Remember Me] Auto-reconnecting WhatsApp session…');
        await wa.connect();
      } catch (err) {
        console.error('  ⚠️ WhatsApp auto-reconnect notice:', err.message);
      }
    }
    // 2. Telegram Auto-Reconnect
    if (cfg.telegram?.autoConnect && cfg.telegram?.token) {
      try {
        console.log('  🔒 [Remember Me] Auto-reconnecting Telegram bot…');
        await tg.connect(cfg.telegram.token);
        if (tg.chats && tg.chats.length) {
          historyManager.recordTargets('telegram', tg.chats);
        }
      } catch (err) {
        console.error('  ⚠️ Telegram auto-reconnect notice:', err.message);
      }
    }
  }
})();

function getStatus() {
  return {
    whatsapp: wa.getStatus(),
    telegram: tg.getStatus(),
    rememberMe: sessionManager.getConfig().rememberMe !== false
  };
}

function broadcastStatus() {
  broadcast({ type: 'status', data: getStatus() });
}

// ─── API: Status & Session Config ────────────────────────────
app.get('/api/status', (req, res) => {
  const cfg = sessionManager.getConfig();
  const waCreds = path.join(__dirname, 'sessions', 'whatsapp', 'creds.json');
  if (fs.existsSync(waCreds) && cfg.rememberMe !== false && cfg.whatsapp?.autoConnect !== false && !wa.connected && !wa.connecting && !wa.reconnecting) {
    wa.connect().catch(err => console.error('[WA] Status trigger auto-connect error:', err.message));
  }
  res.json({ success: true, data: getStatus() });
});

app.get('/api/session/config', (req, res) => {
  res.json({ success: true, config: sessionManager.getConfig() });
});

app.post('/api/session/config', (req, res) => {
  const { rememberMe } = req.body;
  if (typeof rememberMe === 'boolean') {
    sessionManager.setRememberMe(rememberMe);
  }
  res.json({ success: true, config: sessionManager.getConfig() });
});

// ─── API: WhatsApp ────────────────────────────────────────────
app.post('/api/connect/whatsapp', async (req, res) => {
  const { rememberMe } = req.body || {};
  if (typeof rememberMe === 'boolean') {
    sessionManager.setRememberMe(rememberMe);
  } else {
    sessionManager.setRememberMe(true);
  }
  sessionManager.setWhatsappAutoConnect(true);

  if (wa.connected) {
    return res.json({ success: true, message: 'WhatsApp is already connected.', connected: true });
  }

  const force = !wa.currentQR;
  try {
    await wa.connect(force);
    const hasCreds = fs.existsSync(path.join(__dirname, 'sessions', 'whatsapp', 'creds.json'));
    res.json({
      success: true,
      message: hasCreds ? 'Reconnecting saved session…' : 'WhatsApp started — scan the QR code.',
      hasCreds,
      qr: wa.currentQR || null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/whatsapp/groups', async (req, res) => {
  try {
    const groups = await wa.getGroups();
    historyManager.recordTargets('whatsapp', groups);
    res.json({ success: true, groups });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/whatsapp/channels', async (req, res) => {
  try {
    const channels = await wa.getChannels();
    historyManager.recordTargets('whatsapp', channels);
    res.json({ success: true, channels });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/whatsapp/add-channel', async (req, res) => {
  const { input } = req.body;
  if (!input) return res.status(400).json({ success: false, error: 'Channel link required' });
  try {
    const channel = await wa.addChannel(input);
    historyManager.recordTargets('whatsapp', [channel]);
    res.json({ success: true, channel });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/whatsapp/remove-channel', async (req, res) => {
  const { jid } = req.body;
  wa.removeChannel(jid);
  res.json({ success: true });
});

app.post('/api/disconnect/whatsapp', async (req, res) => {
  try {
    sessionManager.clearWhatsappSession();
    await wa.disconnect();
    broadcastStatus();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── API: Telegram ────────────────────────────────────────────
app.post('/api/connect/telegram', async (req, res) => {
  const { token, rememberMe } = req.body;
  if (!token) return res.status(400).json({ success: false, error: 'Bot token required' });
  if (typeof rememberMe === 'boolean') {
    sessionManager.setRememberMe(rememberMe);
  }
  try {
    const result = await tg.connect(token);
    sessionManager.setTelegramAutoConnect(true, token);
    if (tg.chats && tg.chats.length) {
      historyManager.recordTargets('telegram', tg.chats);
    }
    broadcastStatus();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Invalid bot token: ' + err.message });
  }
});

app.post('/api/telegram/add-chat', async (req, res) => {
  const { chatId } = req.body;
  if (!chatId) return res.status(400).json({ success: false, error: 'Chat ID required' });
  try {
    const chatInfo = await tg.addChat(chatId);
    historyManager.recordTargets('telegram', [chatInfo]);
    broadcastStatus();
    res.json({ success: true, chat: chatInfo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/telegram/remove-chat', async (req, res) => {
  const { chatId } = req.body;
  tg.removeChat(chatId);
  broadcastStatus();
  res.json({ success: true });
});

app.post('/api/disconnect/telegram', async (req, res) => {
  try {
    sessionManager.clearTelegramSession();
    await tg.disconnect();
    broadcastStatus();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── API: Target Connection History ───────────────────────────
app.get('/api/history', (req, res) => {
  res.json({
    success: true,
    history: historyManager.getAllHistory()
  });
});

app.post('/api/history/remove', (req, res) => {
  const { platform, id } = req.body;
  if (platform && id) {
    historyManager.removeTarget(platform, id);
  }
  res.json({ success: true, history: historyManager.getAllHistory() });
});

app.post('/api/history/clear', (req, res) => {
  const { platform } = req.body;
  if (platform) {
    historyManager.clearPlatformHistory(platform);
  }
  res.json({ success: true, history: historyManager.getAllHistory() });
});

// ─── API: Scheduler ───────────────────────────────────────────
app.get('/api/schedule/jobs', (req, res) => {
  res.json({ success: true, jobs: scheduler.getJobs() });
});

app.post('/api/schedule', upload.single('media'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ success: false, error: 'No file provided' });

  const caption = req.body.caption || '';
  const scheduledTime = req.body.scheduledTime;
  let targets;
  try {
    targets = JSON.parse(req.body.targets || '[]');
  } catch (e) {
    return res.status(400).json({ success: false, error: 'Invalid targets format' });
  }

  if (!targets.length) {
    return res.status(400).json({ success: false, error: 'No upload targets selected' });
  }
  if (!scheduledTime) {
    return res.status(400).json({ success: false, error: 'Scheduled time is required' });
  }

  try {
    const job = scheduler.scheduleJob({ file, caption, targets, scheduledTime });
    res.json({ success: true, job, message: 'Broadcast scheduled successfully' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/schedule/cancel', (req, res) => {
  const { jobId } = req.body;
  if (!jobId) return res.status(400).json({ success: false, error: 'Job ID required' });
  try {
    const job = scheduler.cancelJob(jobId);
    res.json({ success: true, job, message: 'Scheduled job cancelled' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── API: Analytics ───────────────────────────────────────────
app.get('/api/analytics', async (req, res) => {
  try {
    const [waData, tgData] = await Promise.allSettled([
      wa.getAnalytics(),
      tg.getAnalytics()
    ]);
    res.json({
      success: true,
      analytics: {
        whatsapp: waData.status === 'fulfilled' ? waData.value : null,
        telegram: tgData.status === 'fulfilled' ? tgData.value : null
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── API: Media Downloader ────────────────────────────────────
app.get('/api/downloader/status', (req, res) => {
  const cookiePath = getCookieFilePath();
  res.json({
    success: true,
    available: ytDlpAvailable,
    hasCookies: !!cookiePath,
    cookieFileName: cookiePath ? path.basename(cookiePath) : null
  });
});

app.get('/api/downloader/cookies', (req, res) => {
  const cookiePath = getCookieFilePath();
  res.json({
    success: true,
    hasCookies: !!cookiePath,
    cookieFileName: cookiePath ? path.basename(cookiePath) : null
  });
});

app.post('/api/downloader/cookies', upload.single('cookieFile'), (req, res) => {
  try {
    const targetPath = path.join(__dirname, 'sessions', 'cookies.txt');
    if (req.file) {
      fs.copyFileSync(req.file.path, targetPath);
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.json({ success: true, message: 'Cookies file uploaded successfully' });
    } else if (req.body && req.body.cookiesText) {
      fs.writeFileSync(targetPath, req.body.cookiesText.trim(), 'utf8');
      return res.json({ success: true, message: 'Cookies text saved successfully' });
    }
    return res.status(400).json({ success: false, error: 'No cookie file or text provided' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/downloader/cookies', (req, res) => {
  const cookiePath = getCookieFilePath();
  if (cookiePath) {
    try { fs.unlinkSync(cookiePath); } catch (e) {}
  }
  res.json({ success: true, message: 'Cookies removed successfully' });
});

app.post('/api/download', async (req, res) => {
  if (!ytDlpAvailable) {
    return res.status(503).json({
      success: false,
      error: 'yt-dlp engine is initializing on the server. Please try again in a few seconds.'
    });
  }

  const { url } = req.body;
  if (!url || !url.trim()) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  // Validate URL is Instagram or YouTube
  const cleanUrl = url.trim();
  const isYouTube = /(?:youtube\.com|youtu\.be)/i.test(cleanUrl);
  const isInstagram = /instagram\.com/i.test(cleanUrl);
  if (!isYouTube && !isInstagram) {
    return res.status(400).json({ success: false, error: 'Only Instagram and YouTube URLs are supported' });
  }

  const downloadsDir = path.join(__dirname, 'downloads');
  const timestamp = Date.now();
  const outputTemplate = path.join(downloadsDir, `${timestamp}_%(title).80B.%(ext)s`);

  // Build robust yt-dlp execution args
  const args = [
    '--no-playlist',
    '-f', 'b[ext=mp4]/best[ext=mp4]/bestvideo+bestaudio/best',
    '-o', outputTemplate,
    '--no-warnings',
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    '--add-header', 'Accept-Language: en-US,en;q=0.9',
    '--referer', isInstagram ? 'https://www.instagram.com/' : 'https://www.youtube.com/'
  ];

  if (isInstagram) {
    args.push('--extractor-args', 'instagram:api_example=1');
  }

  const cookiePath = getCookieFilePath();
  if (cookiePath) {
    args.push('--cookies', cookiePath);
    console.log(`[Download] Using cookie file: ${cookiePath}`);
  }

  args.push('--print', 'after_move:filepath', cleanUrl);

  console.log(`[Download] Starting: ${cleanUrl}`);

  try {
    const filePath = await new Promise((resolve, reject) => {
      const proc = spawn(ytDlpCmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', d => { stdout += d.toString(); });
      proc.stderr.on('data', d => { stderr += d.toString(); });

      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error('Download timed out after 5 minutes'));
      }, 5 * 60 * 1000);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          const fp = stdout.trim().split('\n').pop().trim();
          if (fp && fs.existsSync(fp)) {
            resolve(fp);
          } else {
            // Fallback: find file matching timestamp prefix
            try {
              const files = fs.readdirSync(downloadsDir)
                .filter(f => f.startsWith(String(timestamp)))
                .map(f => ({ f, t: fs.statSync(path.join(downloadsDir, f)).mtimeMs }))
                .sort((a, b) => b.t - a.t);
              if (files.length) {
                resolve(path.join(downloadsDir, files[0].f));
              } else {
                reject(new Error('Download completed but file not found'));
              }
            } catch (fe) {
              reject(new Error('Download completed but could not locate file'));
            }
          }
        } else {
          const fullErr = stderr.replace(/\x1b\[[0-9;]*m/g, '').trim();
          if (/HTTP Error 429|Too Many Requests|empty media response|login-in|login required/i.test(fullErr)) {
            const advice = isInstagram
              ? '[Instagram] Rate limit or login protection detected (HTTP Error 429). Upload an Instagram cookies.txt file under Downloader Settings or try again shortly.'
              : 'Platform rate limit encountered (HTTP Error 429). Upload a cookies.txt file or try again shortly.';
            reject(new Error(advice));
          } else {
            const lastLine = fullErr.split('\n').pop() || 'Download failed';
            reject(new Error(lastLine));
          }
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error('Failed to start yt-dlp: ' + err.message));
      });
    });

    const stat = fs.statSync(filePath);
    const filename = path.basename(filePath);
    const ext = path.extname(filename).toLowerCase();
    const mimeType = ext === '.mp4' ? 'video/mp4'
      : ext === '.webm' ? 'video/webm'
      : ext === '.mkv' ? 'video/x-matroska'
      : ext === '.mp3' ? 'audio/mpeg'
      : ext === '.m4a' ? 'audio/mp4'
      : 'application/octet-stream';

    console.log(`[Download] Done: ${filename} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);

    // Auto-cleanup after 30 minutes
    setTimeout(() => {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }, 30 * 60 * 1000);

    res.json({
      success: true,
      filename,
      size: stat.size,
      mimeType,
      platform: isYouTube ? 'youtube' : 'instagram'
    });

  } catch (err) {
    console.warn(`[Download] Primary yt-dlp attempt notice: ${err.message}`);

    // Automatic zero-cookie InstagramDownloader fallback engine
    if (isInstagram) {
      try {
        console.log(`[Download] Launching zero-cookie InstagramDownloader engine for: ${cleanUrl}`);
        const result = await InstagramDownloader.downloadReel(cleanUrl, downloadsDir);

        // Auto-cleanup after 30 minutes
        setTimeout(() => {
          try { fs.unlinkSync(result.filePath); } catch (e) {}
        }, 30 * 60 * 1000);

        return res.json({
          success: true,
          filename: result.filename,
          size: result.size,
          mimeType: result.mimeType,
          platform: 'instagram'
        });
      } catch (fallbackErr) {
        console.error('[Download] Zero-cookie fallback engine error:', fallbackErr.message);
        return res.status(500).json({ success: false, error: fallbackErr.message });
      }
    }

    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve downloaded files (for browser fetch / use-in-upload)
app.get('/api/download/file/:filename', (req, res) => {
  const filename = path.basename(req.params.filename); // sanitize path traversal
  const filePath = path.join(__dirname, 'downloads', filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'File not found' });
  }
  res.sendFile(filePath);
});

// ─── API: Upload ──────────────────────────────────────────────
app.post('/api/upload', upload.single('media'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ success: false, error: 'No file provided' });

  const caption = req.body.caption || '';
  let targets;
  try {
    targets = JSON.parse(req.body.targets || '[]');
  } catch (e) {
    return res.status(400).json({ success: false, error: 'Invalid targets format' });
  }

  if (!targets.length) {
    return res.status(400).json({ success: false, error: 'No upload targets selected' });
  }

  const jobId = Date.now().toString();

  // Acknowledge immediately, process async
  res.json({ success: true, jobId, message: 'Upload started' });

  const uploadTarget = async (target) => {
    const { platform, id } = target;
    try {
      broadcast({ type: 'upload_progress', jobId, platform, id, status: 'uploading' });

      if (platform === 'whatsapp') {
        await wa.sendMedia(id, file.path, file.originalname, file.mimetype, caption);
      } else if (platform === 'telegram') {
        await tg.sendMedia(id, file.path, file.originalname, file.mimetype, caption);
      }

      broadcast({ type: 'upload_progress', jobId, platform, id, status: 'done' });
      return { platform, id, success: true };
    } catch (err) {
      broadcast({ type: 'upload_progress', jobId, platform, id, status: 'error', error: err.message });
      return { platform, id, success: false, error: err.message };
    }
  };

  const results = await Promise.all(targets.map(uploadTarget));
  broadcast({ type: 'upload_complete', jobId, results });

  // Cleanup uploaded temp file after 10s
  setTimeout(() => {
    try { fs.unlinkSync(file.path); } catch (e) {}
  }, 10000);
});

// ─── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use by another process.`);
    console.error(`  To fix, close existing terminal processes or run: npx kill-port ${PORT}\n`);
  } else {
    console.error('Server error:', err);
  }
});

httpServer.listen(PORT, '0.0.0.0', () => {
  const localIps = getLocalIpAddresses();
  console.log('\n' + '='.repeat(54));
  console.log('  🚀 ContentHub is running & accessible across Wi-Fi:');
  console.log('  💻 On this PC:    http://localhost:' + PORT);
  localIps.forEach(ip => {
    console.log(`  📱 On your Phone: http://${ip}:${PORT}`);
  });
  console.log('='.repeat(54));
  console.log('  ✅ WhatsApp  — QR Code scan (no API key)');
  console.log('  ✅ Telegram  — Bot token from @BotFather');
  if (ytDlpAvailable) {
    console.log('  ✅ yt-dlp   — Instagram & YouTube downloader');
  } else {
    console.log('  ⚠️  yt-dlp  — Not found (downloader disabled)');
  }
  console.log('='.repeat(54) + '\n');
});
