// ============================================================
// SOCIAL HUB — server.js
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
import WhatsAppOpenWA from './modules/whatsapp_openwa.js';
import TelegramModule from './modules/telegram.js';
import HistoryManager from './modules/history.js';
import SchedulerModule from './modules/scheduler.js';
import SessionManager from './modules/session_manager.js';
import InstagramDownloader from './modules/instagram_downloader.js';
import AIAudioCaptioner from './modules/ai_audio_captioner.js';

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
for (const dir of ['uploads', 'sessions', 'sessions/whatsapp', 'sessions/openwa', 'downloads']) {
  const p = path.join(__dirname, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  setHeaders: (res, pathUrl) => {
    if (pathUrl.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=300');
    }
  }
}));

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

// ─── FFmpeg availability & detection ─────────────────────────
let ffmpegAvailable = false;
let ffmpegCmd = 'ffmpeg';

const localLinuxFfmpeg = path.join(__dirname, 'ffmpeg');
if (process.platform === 'linux' && fs.existsSync(localLinuxFfmpeg)) {
  try {
    execSync(`chmod +x "${localLinuxFfmpeg}"`, { stdio: 'ignore' });
    ffmpegCmd = localLinuxFfmpeg;
    ffmpegAvailable = true;
    console.log('  ✅ ffmpeg   — Local Linux standalone binary ready');
  } catch (e) {}
}

if (!ffmpegAvailable) {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    ffmpegAvailable = true;
    ffmpegCmd = 'ffmpeg';
    console.log('  ✅ ffmpeg   — System binary ready');
  } catch (e) {
    if (process.platform === 'win32') {
      const localWinFfmpeg = path.join(__dirname, 'ffmpeg.exe');
      if (fs.existsSync(localWinFfmpeg)) {
        ffmpegCmd = localWinFfmpeg;
        ffmpegAvailable = true;
      }
    }
  }
}

// ─── yt-dlp availability & version check ────────────────────────
let ytDlpAvailable = false;
let ytDlpCmd = 'yt-dlp';
let ytDlpVersion = null;

const localLinuxBin = path.join(__dirname, 'yt-dlp');
const localWinBin = path.join(__dirname, 'yt-dlp.exe');

// On Linux / Render cloud hosting, ALWAYS download and prioritize the official standalone binary
if (process.platform === 'linux') {
  if (!fs.existsSync(localLinuxBin)) {
    try {
      console.log('  📥 [Setup] Downloading latest standalone yt-dlp release for Linux cloud hosting…');
      execSync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "${localLinuxBin}" && chmod +x "${localLinuxBin}"`, { stdio: 'pipe' });
    } catch (e) {
      console.warn('  ⚠️ [Setup] Could not download standalone yt-dlp binary:', e.message);
    }
  }

  if (fs.existsSync(localLinuxBin)) {
    try {
      execSync(`chmod +x "${localLinuxBin}"`, { stdio: 'ignore' });
      ytDlpVersion = execSync(`"${localLinuxBin}" --version`, { stdio: 'pipe' }).toString().trim();
      ytDlpCmd = localLinuxBin;
      ytDlpAvailable = true;
      console.log(`  ✅ yt-dlp   — Official latest Linux binary ready (v${ytDlpVersion})`);
    } catch (e) {}
  }
}

// Fallback to system or Windows binary
if (!ytDlpAvailable) {
  try {
    ytDlpVersion = execSync('yt-dlp --version', { stdio: 'pipe' }).toString().trim();
    ytDlpAvailable = true;
    ytDlpCmd = 'yt-dlp';
    console.log(`  ✅ yt-dlp   — System binary ready (v${ytDlpVersion})`);
  } catch (e) {
    if (fs.existsSync(localWinBin)) {
      ytDlpCmd = localWinBin;
      ytDlpAvailable = true;
      try {
        ytDlpVersion = execSync(`"${localWinBin}" --version`, { stdio: 'pipe' }).toString().trim();
      } catch {}
    } else if (process.platform === 'win32') {
      const windowsPaths = [
        path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'yt-dlp.exe'),
        path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Microsoft', 'WinGet', 'Links', 'yt-dlp.exe'),
        'C:\\Windows\\System32\\yt-dlp.exe'
      ];
      for (const p of windowsPaths) {
        if (fs.existsSync(p)) {
          ytDlpCmd = p;
          ytDlpAvailable = true;
          try {
            ytDlpVersion = execSync(`"${p}" --version`, { stdio: 'pipe' }).toString().trim();
          } catch {}
          break;
        }
      }
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
const sessionManager = new SessionManager(path.join(__dirname, 'sessions'));
const initialCfg = sessionManager.getConfig();

const waOpenWA = new WhatsAppOpenWA(broadcast, path.join(__dirname, 'sessions'), {
  apiUrl: initialCfg.openwa?.url,
  apiKey: initialCfg.openwa?.apiKey,
  sessionName: initialCfg.openwa?.sessionName
});
const waBaileys = new WhatsAppModule(broadcast, path.join(__dirname, 'sessions'));

// Active WhatsApp Engine Dispatcher
function getActiveWa() {
  const currentCfg = sessionManager.getConfig();
  if (currentCfg.whatsappEngine === 'baileys') {
    return waBaileys;
  }
  return waOpenWA;
}

// Unified proxy object for wa
const wa = new Proxy({}, {
  get(target, prop) {
    const active = getActiveWa();
    const val = active[prop];
    if (typeof val === 'function') {
      return val.bind(active);
    }
    return val;
  }
});

const tg = new TelegramModule(broadcast, path.join(__dirname, 'sessions'));
const historyManager = new HistoryManager(path.join(__dirname, 'sessions'));
const scheduler = new SchedulerModule(broadcast, path.join(__dirname, 'sessions'), wa, tg);

// Auto-Reconnect Remembered Sessions on Server Boot
(async () => {
  const cfg = sessionManager.getConfig();
  if (cfg.rememberMe !== false) {
    // 1. WhatsApp Auto-Reconnect
    if (cfg.whatsapp?.autoConnect !== false) {
      try {
        const activeEngine = cfg.whatsappEngine || 'openwa';
        if (activeEngine === 'openwa') {
          console.log('  🔒 [Remember Me] Checking OpenWA WhatsApp gateway session…');
          const health = await waOpenWA.healthCheck();
          if (health.ok) {
            await waOpenWA.connect();
          }
        } else {
          const waCreds = path.join(__dirname, 'sessions', 'whatsapp', 'creds.json');
          if (fs.existsSync(waCreds)) {
            console.log('  🔒 [Remember Me] Auto-reconnecting Baileys WhatsApp session…');
            await waBaileys.connect();
          }
        }
      } catch (err) {
        console.warn('  ⚠️ WhatsApp auto-reconnect notice:', err.message);
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
        console.warn('  ⚠️ Telegram auto-reconnect notice:', err.message);
      }
    }
  }
})();

function getStatus() {
  const cfg = sessionManager.getConfig();
  const activeWa = getActiveWa();
  return {
    whatsapp: activeWa.getStatus(),
    telegram: tg.getStatus(),
    rememberMe: cfg.rememberMe !== false,
    engine: cfg.whatsappEngine || 'openwa',
    openwa: {
      ...cfg.openwa,
      gatewayOnline: waOpenWA.gatewayOnline
    }
  };
}

function broadcastStatus() {
  broadcast({ type: 'status', data: getStatus() });
}

// ─── API: Status & Session Config ────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({ success: true, data: getStatus() });
});

app.get('/api/session/config', (req, res) => {
  res.json({ success: true, config: sessionManager.getConfig() });
});

app.post('/api/session/config', (req, res) => {
  const { rememberMe, engine } = req.body;
  if (typeof rememberMe === 'boolean') {
    sessionManager.setRememberMe(rememberMe);
  }
  if (engine) {
    sessionManager.setWhatsappEngine(engine);
  }
  res.json({ success: true, config: sessionManager.getConfig() });
});

// ─── API: OpenWA Gateway Specifics ───────────────────────────
app.get('/api/openwa/status', async (req, res) => {
  try {
    const health = await waOpenWA.healthCheck();
    res.json({
      success: true,
      health,
      status: waOpenWA.getStatus(),
      config: sessionManager.getConfig().openwa,
      engine: sessionManager.getConfig().whatsappEngine
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/openwa/config', (req, res) => {
  const { url, apiKey, sessionName, engine } = req.body || {};
  if (url || apiKey !== undefined || sessionName) {
    sessionManager.setOpenWaConfig({ url, apiKey, sessionName });
    waOpenWA.updateConfig({ apiUrl: url, apiKey, sessionName });
  }
  if (engine) {
    sessionManager.setWhatsappEngine(engine);
  }
  broadcastStatus();
  res.json({
    success: true,
    config: sessionManager.getConfig().openwa,
    engine: sessionManager.getConfig().whatsappEngine,
    message: 'OpenWA configuration updated successfully'
  });
});

// ─── API: WhatsApp ────────────────────────────────────────────
app.post('/api/connect/whatsapp', async (req, res) => {
  const { rememberMe, engine } = req.body || {};
  if (typeof rememberMe === 'boolean') {
    sessionManager.setRememberMe(rememberMe);
  } else {
    sessionManager.setRememberMe(true);
  }
  if (engine) {
    sessionManager.setWhatsappEngine(engine);
  }
  sessionManager.setWhatsappAutoConnect(true);

  const activeWa = getActiveWa();

  if (activeWa.connected) {
    return res.json({
      success: true,
      message: 'WhatsApp is already connected.',
      connected: true,
      phone: activeWa.phone
    });
  }

  const force = !activeWa.currentQR;
  try {
    const connResult = await activeWa.connect(force);
    res.json({
      success: true,
      message: 'WhatsApp connection initiated — scan QR or pair via code.',
      qr: activeWa.currentQR || null,
      pairingCode: activeWa.pairingCode || null,
      engine: sessionManager.getConfig().whatsappEngine,
      ...connResult
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      engine: sessionManager.getConfig().whatsappEngine
    });
  }
});

app.post('/api/whatsapp/pairing-code', async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ success: false, error: 'Phone number is required' });
  try {
    const activeWa = getActiveWa();
    if (typeof activeWa.requestPairingCode !== 'function') {
      return res.status(400).json({ success: false, error: 'Phone pairing code is available on the OpenWA engine.' });
    }
    const result = await activeWa.requestPairingCode(phoneNumber);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/whatsapp/groups', async (req, res) => {
  try {
    const activeWa = getActiveWa();
    const groups = await activeWa.getGroups();
    historyManager.recordTargets('whatsapp', groups);
    res.json({ success: true, groups });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/whatsapp/channels', async (req, res) => {
  try {
    const activeWa = getActiveWa();
    const channels = await activeWa.getChannels();
    historyManager.recordTargets('whatsapp', channels);
    res.json({ success: true, channels });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/whatsapp/add-channel', async (req, res) => {
  const { input } = req.body;
  if (!input) return res.status(400).json({ success: false, error: 'Channel link or ID required' });
  try {
    const activeWa = getActiveWa();
    const channel = await activeWa.addChannel(input);
    historyManager.recordTargets('whatsapp', [channel]);
    res.json({ success: true, channel });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/whatsapp/remove-channel', async (req, res) => {
  const { jid } = req.body;
  const activeWa = getActiveWa();
  activeWa.removeChannel(jid);
  res.json({ success: true });
});

app.post('/api/disconnect/whatsapp', async (req, res) => {
  try {
    sessionManager.clearWhatsappSession();
    const activeWa = getActiveWa();
    await activeWa.disconnect();
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

app.post('/api/schedule/run-now', async (req, res) => {
  const { jobId } = req.body;
  if (!jobId) return res.status(400).json({ success: false, error: 'Job ID required' });
  try {
    const job = await scheduler.runJobNow(jobId);
    res.json({ success: true, job, message: 'Broadcast triggered for immediate execution' });
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

// ─── API: Safe Health Diagnostic Endpoint ────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV === 'production' || process.env.RENDER ? 'production' : 'development',
    version: '2.0.0',
    ytDlpAvailable: !!ytDlpAvailable,
    ytDlpCmd: ytDlpCmd ? path.basename(ytDlpCmd) : null,
    ytDlpVersion: ytDlpVersion || null,
    ffmpegAvailable: !!ffmpegAvailable,
    ffmpegCmd: ffmpegCmd ? path.basename(ffmpegCmd) : null,
    timestamp: new Date().toISOString()
  });
});

// ─── API: Media Downloader ────────────────────────────────────
app.get('/api/downloader/status', (req, res) => {
  res.json({
    success: true,
    available: ytDlpAvailable
  });
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

  // Clean and normalize input URL
  let cleanUrl = url.trim().replace(/^["']|["']$/g, '');
  
  // Normalize YouTube short and mobile URLs
  const shortsMatch = cleanUrl.match(/(?:youtube\.com|youtu\.be)\/shorts\/([a-zA-Z0-9_-]+)/i);
  if (shortsMatch) {
    cleanUrl = `https://www.youtube.com/watch?v=${shortsMatch[1]}`;
  } else {
    const youtuBeMatch = cleanUrl.match(/youtu\.be\/([a-zA-Z0-9_-]+)/i);
    if (youtuBeMatch && !cleanUrl.includes('/watch')) {
      cleanUrl = `https://www.youtube.com/watch?v=${youtuBeMatch[1]}`;
    } else {
      const watchMatch = cleanUrl.match(/youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]+)/i);
      if (watchMatch) {
        cleanUrl = `https://www.youtube.com/watch?v=${watchMatch[1]}`;
      }
    }
  }

  const isYouTube = /(?:youtube\.com|youtu\.be)/i.test(cleanUrl);
  const isInstagram = /instagram\.com/i.test(cleanUrl);
  if (!isYouTube && !isInstagram) {
    return res.status(400).json({ success: false, error: 'Only Instagram and YouTube URLs are supported' });
  }

  const downloadsDir = path.join(__dirname, 'downloads');
  const timestamp = Date.now();
  // Using timestamp + ID ensures 100% valid ASCII filename across Windows NTFS and Unicode titles
  const outputTemplate = path.join(downloadsDir, `${timestamp}_%(id)s.%(ext)s`);

  const executeYtDlp = (clientProfile = 'android_vr,android,web') => {
    const args = [
      '--no-playlist',
      '--force-ipv4',
      '--merge-output-format', 'mp4',
      '-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best[ext=mp4]/best',
      '-o', outputTemplate,
      '--no-warnings',
      '--retries', '5',
      '--fragment-retries', '5',
      '--skip-unavailable-fragments',
      '--no-check-certificates',
      '--socket-timeout', '30'
    ];

    if (process.platform === 'win32') {
      args.push('--windows-filenames');
    }

    if (ffmpegAvailable && ffmpegCmd) {
      args.push('--ffmpeg-location', path.isAbsolute(ffmpegCmd) ? ffmpegCmd : path.dirname(ffmpegCmd) || ffmpegCmd);
    }

    if (isYouTube) {
      if (clientProfile && clientProfile !== 'default') {
        args.push('--extractor-args', `youtube:player_client=${clientProfile}`);
      }
    }

    if (isInstagram) {
      args.push(
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--referer', 'https://www.instagram.com/',
        '--extractor-args', 'instagram:api_example=1'
      );
    }

    // Print title and filepath to capture metadata cleanly
    args.push('--print', 'title', '--print', 'after_move:filepath', cleanUrl);

    return new Promise((resolve, reject) => {
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
          const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          const videoTitle = lines.length > 1 ? lines[0] : '';
          
          let foundPath = null;
          // Primary: look up final merged file matching timestamp in downloadsDir
          try {
            const matchingFiles = fs.readdirSync(downloadsDir)
              .filter(f => f.startsWith(String(timestamp)) && !/\.f\d+\./i.test(f) && !f.endsWith('.part'))
              .map(f => ({ f, full: path.join(downloadsDir, f), t: fs.statSync(path.join(downloadsDir, f)).mtimeMs }))
              .sort((a, b) => b.t - a.t);
            if (matchingFiles.length > 0) {
              foundPath = matchingFiles[0].full;
            }
          } catch (e) {}

          // Secondary: check paths from stdout (filter out temporary stream fragments)
          if (!foundPath) {
            for (let i = lines.length - 1; i >= 0; i--) {
              if (fs.existsSync(lines[i]) && !/\.f\d+\./i.test(lines[i]) && !lines[i].endsWith('.part')) {
                foundPath = lines[i];
                break;
              }
            }
          }

          if (foundPath && fs.existsSync(foundPath)) {
            resolve({ filePath: foundPath, videoTitle });
          } else {
            reject(new Error('Download completed but output file could not be located'));
          }
        } else {
          const fullErr = (stderr || stdout).replace(/\x1b\[[0-9;]*m/g, '').trim();
          reject(new Error(fullErr || 'Download failed'));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error('Failed to start yt-dlp: ' + err.message));
      });
    });
  };

  const startTime = Date.now();
  console.log('\n' + '='.repeat(50));
  console.log('[DOWNLOAD] Processing media download request:');
  console.log(`  URL:       ${cleanUrl}`);
  console.log(`  Platform:  ${isYouTube ? 'youtube' : 'instagram'}`);
  console.log(`  yt-dlp:    ${ytDlpCmd} (v${ytDlpVersion || 'latest'})`);
  console.log(`  FFmpeg:    ${ffmpegAvailable ? `Available (${ffmpegCmd})` : 'Not available'}`);
  console.log('='.repeat(50));

  try {
    let dlResult;
    if (isYouTube) {
      const ytProfiles = [
        'android_vr,android,web',
        'android_vr,android',
        'web,mweb',
        'tv_embedded,tv',
        'default'
      ];
      let lastErr = null;
      for (const profile of ytProfiles) {
        try {
          console.log(`[DOWNLOAD] Attempting profile: ${profile}...`);
          dlResult = await executeYtDlp(profile);
          if (dlResult && dlResult.filePath) break;
        } catch (attemptErr) {
          lastErr = attemptErr;
          console.warn(`[DOWNLOAD] Profile '${profile}' notice: ${attemptErr.message}`);
        }
      }
      if (!dlResult && lastErr) {
        throw lastErr;
      }
    } else {
      dlResult = await executeYtDlp();
    }

    const { filePath, videoTitle } = dlResult;
    const stat = fs.statSync(filePath);
    const filename = path.basename(filePath);
    const ext = path.extname(filename).toLowerCase();
    const mimeType = ext === '.mp4' ? 'video/mp4'
      : ext === '.webm' ? 'video/webm'
      : ext === '.mkv' ? 'video/x-matroska'
      : ext === '.mp3' ? 'audio/mpeg'
      : ext === '.m4a' ? 'audio/mp4'
      : 'application/octet-stream';

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[DOWNLOAD] Success (${duration}s): ${videoTitle || filename} (${(stat.size / 1024 / 1024).toFixed(2)} MB)\n`);

    // Auto-cleanup after 30 minutes
    setTimeout(() => {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }, 30 * 60 * 1000);

    return res.json({
      success: true,
      filename,
      title: videoTitle || filename,
      size: stat.size,
      mimeType,
      platform: isYouTube ? 'youtube' : 'instagram'
    });

  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.warn(`[DOWNLOAD] Primary engine error (${duration}s): ${err.message}`);

    // Automatic zero-cookie InstagramDownloader fallback engine
    if (isInstagram) {
      try {
        console.log(`[DOWNLOAD] Launching zero-cookie InstagramDownloader engine for: ${cleanUrl}`);
        const result = await InstagramDownloader.downloadReel(cleanUrl, downloadsDir);

        // Auto-cleanup after 30 minutes
        setTimeout(() => {
          try { fs.unlinkSync(result.filePath); } catch (e) {}
        }, 30 * 60 * 1000);

        return res.json({
          success: true,
          filename: result.filename,
          title: result.title || result.filename,
          size: result.size,
          mimeType: result.mimeType,
          platform: 'instagram'
        });
      } catch (fallbackErr) {
        console.error('[DOWNLOAD] Zero-cookie fallback engine error:', fallbackErr.message);
        return res.status(500).json({ success: false, code: 'INSTAGRAM_DOWNLOAD_FAILED', error: fallbackErr.message });
      }
    }

    let cleanErr = (err.message || 'Download failed')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('See https://') && !l.startsWith('Also see'))
      .pop() || 'Download failed';

    if (/bot|sign in to confirm you're not a bot|429|forbidden/i.test(err.message)) {
      console.warn(`[DOWNLOAD] YouTube bot verification / datacenter IP block: ${err.message}`);
      cleanErr = 'Unable to download this YouTube video right now. Please try another video or link.';
    }

    res.status(500).json({
      success: false,
      code: isYouTube ? 'YOUTUBE_DOWNLOAD_UNAVAILABLE' : 'DOWNLOAD_FAILED',
      error: cleanErr
    });
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

// ─── API: AI Audio Caption & Speech-to-Text Synthesizer ────────
app.post('/api/ai/transcribe-caption', async (req, res) => {
  try {
    const { transcript, title, style, language, url, filePath } = req.body;

    let mediaMeta = { title: title || '', transcript: transcript || '', detectedLanguage: language || 'auto' };

    // If a URL or local filePath was provided, analyze it
    if (url) {
      const meta = await AIAudioCaptioner.extractAudioMetadata(url, ytDlpCmd);
      mediaMeta = { ...mediaMeta, ...meta };
    } else if (filePath) {
      const resolved = path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath);
      if (fs.existsSync(resolved)) {
        const meta = await AIAudioCaptioner.extractAudioMetadata(resolved, ytDlpCmd);
        mediaMeta = { ...mediaMeta, ...meta };
      }
    }

    const synthesis = AIAudioCaptioner.generateCaption({
      transcript: transcript || mediaMeta.transcript,
      title: title || mediaMeta.title,
      style: style || 'smart',
      language: language || mediaMeta.detectedLanguage
    });

    res.json({
      success: true,
      caption: synthesis.caption,
      headline: synthesis.headline,
      hashtags: synthesis.hashtags,
      detectedType: synthesis.detectedType,
      audioMeta: mediaMeta
    });
  } catch (err) {
    console.error('[AI Caption] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
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

  try {
    const results = await Promise.all(targets.map(uploadTarget));
    broadcast({ type: 'upload_complete', jobId, results });
  } catch (err) {
    console.error('[Upload Pipeline Error]', err);
    broadcast({ type: 'upload_complete', jobId, error: err.message });
  } finally {
    // Cleanup uploaded temp file safely after all targets settle
    setTimeout(() => {
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (e) {}
    }, 5000);
  }
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

// ─── API 404 & Global JSON Error Handlers ─────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: `API route ${req.method} ${req.originalUrl} not found` });
});

app.use((err, req, res, next) => {
  console.error('[Server Error Handler]', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

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
  console.log('  🚀 SOCIAL HUB is running & accessible across Wi-Fi:');
  console.log('  💻 On this PC:    http://localhost:' + PORT);
  localIps.forEach(ip => {
    console.log(`  📱 On your Phone: http://${ip}:${PORT}`);
  });
  console.log('='.repeat(54));
  console.log('  ✅ WhatsApp  — OpenWA Gateway (Multi-session / QR / Pairing code)');
  console.log('  ✅ Telegram  — Bot token from @BotFather');
  if (ytDlpAvailable) {
    console.log('  ✅ yt-dlp   — Instagram & YouTube downloader');
  } else {
    console.log('  ⚠️  yt-dlp  — Not found (downloader disabled)');
  }
  console.log('='.repeat(54) + '\n');
});

export { app, httpServer, wss };

