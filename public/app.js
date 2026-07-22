// ============================================================
// ContentHub — public/app.js
// WebSocket client + REST API + Full UI management
// ============================================================

'use strict';

// ── State ──────────────────────────────────────────────────
const state = {
  ws: null,
  wsReady: false,
  platforms: {
    whatsapp: { connected: false, groups: [], channels: [] },
    telegram: { connected: false, chats: [] }
  },
  selectedTargets: [],    // Array of { platform, id, name }
  selectedFile: null,
  uploadJob: null,
  lastAnalytics: null,
  downloader: {
    available: false,
    currentFilename: null,
    currentMimeType: null
  },
  history: {
    whatsapp: [],
    telegram: []
  },
  publishMode: 'now',
  scheduledJobs: []
};

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  connectWebSocket();
  fetchStatus();
  setInterval(fetchStatus, 30000); // Refresh status every 30s
  checkDownloaderStatus();
  initEtherealShadowAnimation();
  initFlipFadeText();
  fetchHistory();
  fetchScheduledJobs();
  fetchSessionConfig();
});

function initEtherealShadowAnimation() {
  const feMatrix = document.getElementById('ethereal-fe-matrix');
  if (!feMatrix) return;
  let val = 0;
  function step() {
    val = (val + 0.3) % 360;
    feMatrix.setAttribute('values', val.toFixed(1));
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function initFlipFadeText() {
  const badge = document.getElementById('flip-fade-badge');
  if (!badge) return;
  const words = ['PUBLISH', 'AUTOMATE', 'DISPATCH', 'BROADCAST', 'DOWNLOAD'];
  let wordIdx = 0;

  function renderWord(word) {
    badge.innerHTML = word.split('').map((char, i) =>
      `<span class="flip-fade-letter initial" style="transition-delay: ${i * 40}ms">${char}</span>`
    ).join('');

    requestAnimationFrame(() => {
      badge.querySelectorAll('.flip-fade-letter').forEach(el => {
        el.classList.remove('initial');
        el.classList.add('animate');
      });
    });
  }

  renderWord(words[0]);

  setInterval(() => {
    const currentLetters = badge.querySelectorAll('.flip-fade-letter');
    currentLetters.forEach((el, i) => {
      setTimeout(() => {
        el.classList.remove('animate');
        el.classList.add('exit');
      }, i * 30);
    });

    setTimeout(() => {
      wordIdx = (wordIdx + 1) % words.length;
      renderWord(words[wordIdx]);
    }, 350);
  }, 2800);
}

// ── WebSocket ──────────────────────────────────────────────
function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${location.host}`;
  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    state.wsReady = true;
    setServerOnline(true);
  };

  state.ws.onclose = () => {
    state.wsReady = false;
    setServerOnline(false);
    // Reconnect after 3s
    setTimeout(connectWebSocket, 3000);
  };

  state.ws.onerror = () => {
    state.wsReady = false;
    setServerOnline(false);
  };

  state.ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleWsMessage(msg);
    } catch (e) { /* ignore malformed */ }
  };
}

function handleWsMessage(msg) {
  switch (msg.type) {
    case 'status':
      applyStatus(msg.data);
      break;
    case 'wa_qr':
      showQR(msg.qr);
      break;
    case 'wa_connected':
      onWaConnected(msg.phone);
      break;
    case 'wa_disconnected':
      onWaDisconnected();
      break;
    case 'wa_groups':
      renderWaGroups(msg.groups);
      break;
    case 'wa_channels':
      renderWaChannels(msg.channels);
      break;
    case 'tg_chats':
      renderTgChats(msg.chats);
      break;
    case 'upload_progress':
      updateUploadProgress(msg);
      break;
    case 'upload_complete':
      onUploadComplete(msg.results);
      break;
    case 'analytics':
      state.lastAnalytics = msg.data;
      renderAnalytics(msg.data);
      break;
    case 'schedule_created':
    case 'schedule_cancelled':
    case 'schedule_trigger':
    case 'schedule_complete':
      fetchScheduledJobs();
      break;
  }
}

// ── Server Status ─────────────────────────────────────────
function setServerOnline(online) {
  const banner = document.getElementById('server-banner');
  const dot = document.querySelector('.conn-dot');
  const text = document.getElementById('nav-status-text');

  if (online) {
    if (banner) banner.classList.add('hidden');
    if (dot) { dot.classList.add('online'); dot.classList.remove('offline'); }
    if (text) text.textContent = 'Server online';
  } else {
    if (banner) {
      banner.classList.remove('hidden');
      const bText = document.getElementById('server-banner-text');
      if (bText) bText.innerHTML = `Connecting to ContentHub server at <strong>${location.host}</strong>…`;
    }
    if (dot) { dot.classList.remove('online'); dot.classList.add('offline'); }
    if (text) text.textContent = 'Reconnecting…';
  }
}

async function fetchStatus() {
  try {
    const res = await api('GET', '/api/status');
    if (res.success) applyStatus(res.data);
    setServerOnline(true);
  } catch (e) {
    setServerOnline(false);
  }
}

function applyStatus(data) {
  if (data.whatsapp) updateWaStatus(data.whatsapp);
  if (data.telegram) updateTgStatus(data.telegram);
}

// ── WhatsApp Status ────────────────────────────────────────
function updateWaStatus(wa) {
  const statusText = document.getElementById('wa-status-text');
  const dot = document.getElementById('wa-dot');
  const card = document.getElementById('wa-card');

  if (wa.connected) {
    statusText.textContent = '+' + wa.phone;
    statusText.classList.add('connected');
    dot.classList.add('on');
    card.classList.add('connected');
    state.platforms.whatsapp.connected = true;
    show('wa-connected');
    hide('wa-disconnected');
    document.getElementById('wa-phone-display').textContent = '+' + wa.phone;
    document.getElementById('wa-group-count').textContent =
      `${wa.groupCount || 0} groups · ${wa.channelCount || 0} channels · ${formatNum((wa.totalMembers||0)+(wa.totalSubscribers||0))} total`;
  } else if (wa.connecting) {
    statusText.textContent = 'Connecting…';
    statusText.classList.remove('connected');
    dot.classList.remove('on');
    card.classList.remove('connected');
    state.platforms.whatsapp.connected = false;
    show('wa-disconnected');
    hide('wa-connected');
  } else {
    statusText.textContent = 'Not Connected';
    statusText.classList.remove('connected');
    dot.classList.remove('on');
    card.classList.remove('connected');
    state.platforms.whatsapp.connected = false;
    show('wa-disconnected');
    hide('wa-connected');
  }
  updateTargetsBadges();
}

async function startWhatsApp() {
  const btn = document.getElementById('wa-connect-btn');
  btn.disabled = true;
  btn.textContent = 'Starting…';
  const waCb = document.getElementById('remember-me-wa');
  const rememberMe = waCb ? waCb.checked : true;
  try {
    const res = await api('POST', '/api/connect/whatsapp', { rememberMe });
    if (res.success) {
      if (res.connected) {
        toast('success', '✅ WhatsApp is already connected!');
      } else if (res.hasCreds) {
        toast('info', '📱 Auto-reconnecting saved session…');
      } else {
        toast('info', '📱 WhatsApp started — QR code will appear below');
        show('wa-qr-container');
      }
    } else {
      toast('error', res.error || 'Failed to start WhatsApp');
    }
  } catch (e) {
    toast('error', 'Cannot reach server. Is it running?');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Show QR Code';
  }
}

function showQR(dataUrl) {
  const img = document.getElementById('wa-qr-img');
  img.src = dataUrl;
  show('wa-qr-container');
  toast('info', '📷 Scan the QR code with WhatsApp on your phone');
}

function onWaConnected(phone) {
  hide('wa-qr-container');
  fetchStatus();
  toast('success', `✅ WhatsApp connected! Phone: +${phone}`);
  refreshWaGroups();
  refreshWaChannels();
}

function onWaDisconnected() {
  fetchStatus();
  state.platforms.whatsapp.groups = [];
  state.platforms.whatsapp.channels = [];
  updateTargetsBadges();
  toast('warning', '⚠️ WhatsApp disconnected');
}

async function refreshWaGroups() {
  const list = document.getElementById('wa-groups-list');
  list.innerHTML = '<div class="loading-groups">Loading groups…</div>';
  try {
    const res = await api('GET', '/api/whatsapp/groups');
    if (res.success) renderWaGroups(res.groups);
  } catch (e) {
    list.innerHTML = '<div class="loading-groups">Error loading groups</div>';
  }
}

function renderWaGroups(groups) {
  state.platforms.whatsapp.groups = groups;
  document.getElementById('wa-group-count').textContent =
    `${groups.length} groups • ${formatNum(groups.reduce((s,g)=>s+(g.memberCount||0),0))} members`;

  const list = document.getElementById('wa-groups-list');
  if (!groups.length) {
    list.innerHTML = '<div class="loading-groups">No groups found. Make sure your account is in some groups.</div>';
    return;
  }
  list.innerHTML = groups.map(g => `
    <div class="group-item${isSelected('whatsapp',g.id)?' selected':''}"
         onclick="toggleTarget('whatsapp','${esc(g.id)}','${esc(g.name)}')">
      <div class="group-check"></div>
      <span class="group-name">${esc(g.name)}</span>
      <span class="group-count">${formatNum(g.memberCount||0)} members</span>
      <span class="group-type type-group">Group</span>
    </div>
  `).join('');
  updateTargetsBadges();
}

// ── WhatsApp Channels ─────────────────────────────────────
async function refreshWaChannels() {
  const list = document.getElementById('wa-channels-list');
  if (list) list.innerHTML = '<div class="loading-groups">Refreshing channels…</div>';
  try {
    const res = await api('GET', '/api/whatsapp/channels');
    if (res.success) renderWaChannels(res.channels);
  } catch (e) {
    if (list) list.innerHTML = '<div class="loading-groups">Error loading channels</div>';
  }
}

async function addWaChannel() {
  const input = document.getElementById('wa-channel-input').value.trim();
  if (!input) return toast('error', 'Paste your WhatsApp channel invite link first');

  const btn = document.querySelector('[onclick="addWaChannel()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }
  try {
    const res = await api('POST', '/api/whatsapp/add-channel', { input });
    if (res.success) {
      document.getElementById('wa-channel-input').value = '';
      const current = state.platforms.whatsapp.channels || [];
      const updated = [...current.filter(c => c.id !== res.channel.id), res.channel];
      renderWaChannels(updated);
      fetchStatus();
      toast('success', `✅ Channel added: ${res.channel.name}`);
    } else {
      toast('error', res.error || 'Could not add channel');
    }
  } catch (e) {
    toast('error', e.message || 'Cannot reach server');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '+ Add'; }
  }
}

async function removeWaChannel(event, jid) {
  event.stopPropagation();
  await api('POST', '/api/whatsapp/remove-channel', { jid });
  state.platforms.whatsapp.channels = (state.platforms.whatsapp.channels || []).filter(c => c.id !== jid);
  state.selectedTargets = state.selectedTargets.filter(t => !(t.platform === 'whatsapp' && t.id === jid));
  renderWaChannels(state.platforms.whatsapp.channels);
}

function renderWaChannels(channels) {
  state.platforms.whatsapp.channels = channels || [];
  const list = document.getElementById('wa-channels-list');
  if (!list) return;

  if (!channels || !channels.length) {
    list.innerHTML = '<div class="loading-groups">No channels found yet. Paste your channel invite link above.</div>';
    return;
  }

  list.innerHTML = channels.map(c => `
    <div class="group-item${isSelected('whatsapp', c.id) ? ' selected' : ''}"
         onclick="toggleTarget('whatsapp','${esc(c.id)}','${esc(c.name)}')">
      <div class="group-check"></div>
      <span class="group-name">📢 ${esc(c.name)}</span>
      <span class="group-count">${formatNum(c.memberCount || 0)} subs</span>
      <span class="group-type type-channel">Channel</span>
      <button class="btn-disconnect" style="padding:.25rem .5rem;font-size:.65rem"
        onclick="removeWaChannel(event,'${esc(c.id)}')">✕</button>
    </div>
  `).join('');
  updateTargetsBadges();
}


function updateTgStatus(tg) {
  const statusText = document.getElementById('tg-status-text');
  const dot = document.getElementById('tg-dot');
  const card = document.getElementById('tg-card');

  if (tg.connected) {
    statusText.textContent = tg.username || 'Connected';
    statusText.classList.add('connected');
    dot.classList.add('on');
    card.classList.add('connected');
    state.platforms.telegram.connected = true;
    show('tg-connected');
    hide('tg-disconnected');
    document.getElementById('tg-bot-display').textContent = tg.name || tg.username;
    document.getElementById('tg-chat-count').textContent = `${tg.chatCount || 0} chats added`;
  } else {
    statusText.textContent = 'Not Connected';
    statusText.classList.remove('connected');
    dot.classList.remove('on');
    card.classList.remove('connected');
    state.platforms.telegram.connected = false;
    show('tg-disconnected');
    hide('tg-connected');
  }
  updateTargetsBadges();
}

async function connectTelegram() {
  const tokenInput = document.getElementById('tg-token-input');
  const token = tokenInput?.value.trim();
  const errEl = document.getElementById('tg-error-msg');
  const btn = document.getElementById('tg-connect-btn');

  if (errEl) errEl.textContent = '';

  if (!token) {
    if (errEl) errEl.textContent = '⚠️ Please paste your bot token from @BotFather above.';
    tokenInput?.focus();
    return;
  }
  if (!token.includes(':') || token.length < 20) {
    if (errEl) errEl.textContent = '⚠️ Token looks wrong. It should contain ":" and be ~50 chars. Copy it exactly from BotFather.';
    return;
  }

  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Connecting…'; }
  try {
    const res = await api('POST', '/api/connect/telegram', { token });
    if (res.success) {
      if (errEl) errEl.textContent = '';
      fetchStatus();
      toast('success', `✅ Telegram connected: ${res.username}`);
    } else {
      const msg = res.error || 'Connection failed';
      if (errEl) errEl.textContent = '❌ ' + msg;
      toast('error', msg);
    }
  } catch (e) {
    const msg = 'Cannot reach server. Is it running?';
    if (errEl) errEl.textContent = '❌ ' + msg;
    toast('error', msg);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> Connect Bot';
    }
  }
}

function toggleTgToken() {
  const input = document.getElementById('tg-token-input');
  const icon = document.getElementById('tg-eye-icon');
  if (!input) return;
  if (input.type === 'text') {
    input.type = 'password';
    icon?.setAttribute('opacity', '0.5');
  } else {
    input.type = 'text';
    icon?.setAttribute('opacity', '1');
  }
}

function copyCode(el) {
  const text = (el.textContent || '').replace('(tap to copy)', '').trim();
  navigator.clipboard?.writeText(text).then(() => {
    const orig = el.textContent;
    el.textContent = '✅ Copied!';
    setTimeout(() => { el.textContent = orig; }, 1500);
  });
}

async function addTelegramChat() {
  const input = document.getElementById('tg-chat-input');
  const chatId = input?.value.trim();
  if (!chatId) return toast('error', 'Enter a @username or numeric chat ID');

  const btn = document.querySelector('[onclick="addTelegramChat()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }
  try {
    const res = await api('POST', '/api/telegram/add-chat', { chatId });
    if (res.success) {
      if (input) input.value = '';
      const current = state.platforms.telegram.chats || [];
      const updated = [...current.filter(c => String(c.id) !== String(res.chat.id)), res.chat];
      renderTgChats(updated);
      fetchStatus();
      toast('success', `✅ Added: ${res.chat.name} (${formatNum(res.chat.memberCount)} members)`);
    } else {
      toast('error', res.error || 'Failed to add chat');
    }
  } catch (e) {
    toast('error', e.message || 'Cannot reach server');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '+ Add'; }
  }
}

function renderTgChats(chats) {
  const uniqueMap = new Map();
  (chats || []).forEach(c => { if (c && c.id) uniqueMap.set(String(c.id), c); });
  const uniqueChats = Array.from(uniqueMap.values());

  state.platforms.telegram.chats = uniqueChats;
  const list = document.getElementById('tg-chats-list');
  const countEl = document.getElementById('tg-chat-count');
  if (countEl) countEl.textContent = `${uniqueChats.length} chats added`;

  if (!list) return;

  if (!uniqueChats.length) {
    list.innerHTML = '<div class="loading-groups">No chats added yet.</div>';
    return;
  }
  list.innerHTML = uniqueChats.map(c => {
    const typeClass = c.type === 'channel' ? 'type-channel' : c.type === 'supergroup' ? 'type-supergroup' : 'type-group';
    const typeLabel = c.type === 'channel' ? 'Channel' : c.type === 'supergroup' ? 'Super Group' : 'Group';
    return `
      <div class="group-item${isSelected('telegram',c.id)?' selected':''}"
           onclick="toggleTarget('telegram','${esc(c.id)}','${esc(c.name)}')">
        <div class="group-check"></div>
        <span class="group-name">${esc(c.name)}</span>
        <span class="group-count">${formatNum(c.memberCount||0)} members</span>
        <span class="group-type ${typeClass}">${typeLabel}</span>
        <button class="btn-disconnect" style="padding:.25rem .5rem;font-size:.65rem"
          onclick="removeTgChat(event,'${esc(c.id)}')">✕</button>
      </div>
    `;
  }).join('');
  updateTargetsBadges();
}

async function removeTgChat(event, chatId) {
  event.stopPropagation();
  await api('POST', '/api/telegram/remove-chat', { chatId });
  state.platforms.telegram.chats = state.platforms.telegram.chats.filter(c => c.id !== chatId);
  state.selectedTargets = state.selectedTargets.filter(t => !(t.platform === 'telegram' && t.id === chatId));
  renderTgChats(state.platforms.telegram.chats);
}

// ── Disconnect ─────────────────────────────────────────────
async function disconnect(platform) {
  if (!confirm(`Disconnect ${platform}? You can reconnect anytime.`)) return;
  try {
    await api('POST', `/api/disconnect/${platform}`);
    fetchStatus();
    toast('info', `${platform} disconnected`);
    state.selectedTargets = state.selectedTargets.filter(t => t.platform !== platform);
    updateTargetsBadges();
  } catch (e) {
    toast('error', 'Disconnect failed');
  }
}

// ── File Upload ────────────────────────────────────────────
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.add('drag-over');
}
function handleDragLeave() {
  document.getElementById('dropzone').classList.remove('drag-over');
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
}
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) setFile(file);
}
function setFile(file) {
  state.selectedFile = file;
  document.getElementById('dropzone-empty').style.display = 'none';
  document.getElementById('dropzone-preview').style.display = 'block';
  document.getElementById('file-name-display').textContent = file.name;
  document.getElementById('file-size-display').textContent = formatBytes(file.size);
  document.getElementById('file-icon').textContent = getFileIcon(file.type);
}
function clearFile(e) {
  if (e && typeof e.stopPropagation === 'function') {
    e.stopPropagation();
  }
  state.selectedFile = null;
  const fileInput = document.getElementById('file-input');
  if (fileInput) fileInput.value = '';
  const empty = document.getElementById('dropzone-empty');
  const preview = document.getElementById('dropzone-preview');
  if (empty) empty.style.display = '';
  if (preview) preview.style.display = 'none';
}

// ── Target Selection ───────────────────────────────────────
function isSelected(platform, id) {
  return state.selectedTargets.some(t => t.platform === platform && String(t.id) === String(id));
}

function toggleTarget(platform, id, name) {
  const idx = state.selectedTargets.findIndex(t => t.platform === platform && String(t.id) === String(id));
  if (idx >= 0) {
    state.selectedTargets.splice(idx, 1);
  } else {
    state.selectedTargets.push({ platform, id, name });
  }
  // Re-render the group item
  const items = document.querySelectorAll('.group-item');
  items.forEach(item => {
    const onclick = item.getAttribute('onclick') || '';
    if (onclick.includes(id)) {
      item.classList.toggle('selected', isSelected(platform, id));
    }
  });
  updateTargetsBadges();
  if (state.lastAnalytics) {
    renderAnalytics(state.lastAnalytics);
  }
}

function updateTargetsBadges() {
  const container = document.getElementById('targets-badges');
  const targets = [...state.selectedTargets];

  if (!targets.length) {
    container.innerHTML = '<span class="no-targets-msg">Connect platforms and select groups first</span>';
    return;
  }

  const html = targets.map(t => {
    const cls = t.platform === 'whatsapp' ? 'badge-wa' : 'badge-tg';
    const platformLabel = t.platform === 'whatsapp' ? 'WhatsApp' : 'Telegram';
    return `<span class="target-badge ${cls}"><strong>${platformLabel}</strong> · ${esc(t.name)}</span>`;
  }).join('');

  container.innerHTML = html;
}

// ── Publish ────────────────────────────────────────────────
async function publishContent() {
  if (!state.selectedFile) return toast('error', 'Select a file first');

  const targets = [...state.selectedTargets];

  if (!targets.length) return toast('error', 'Select at least one group or channel target');

  const caption = document.getElementById('caption').value;

  // Show progress section
  const progressSection = document.getElementById('upload-progress');
  const progressItems = document.getElementById('progress-items');
  progressSection.style.display = 'block';
  progressItems.innerHTML = targets.map(t => {
    const fillClass = `${t.platform}-fill`;
    return `
      <div class="progress-item" id="prog-${t.platform}-${safeid(t.id)}">
        <span class="progress-platform">${platformLabel(t.platform)} — ${esc(t.name)}</span>
        <div class="progress-bar-track">
          <div class="progress-bar-fill ${fillClass}" id="bar-${t.platform}-${safeid(t.id)}"></div>
        </div>
        <span class="progress-status uploading" id="stat-${t.platform}-${safeid(t.id)}">Pending</span>
      </div>
    `;
  }).join('');

  // Animate bars to 30% immediately
  targets.forEach(t => {
    const bar = document.getElementById(`bar-${t.platform}-${safeid(t.id)}`);
    if (bar) setTimeout(() => { bar.style.width = '30%'; }, 100);
  });

  document.getElementById('publish-btn').disabled = true;

  const formData = new FormData();
  formData.append('media', state.selectedFile, state.selectedFile.name);
  formData.append('caption', caption);
  formData.append('targets', JSON.stringify(targets.map(t => ({ platform: t.platform, id: t.id }))));

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!data.success) {
      toast('error', data.error || 'Upload failed to start');
      document.getElementById('publish-btn').disabled = false;
    } else {
      toast('info', '⬆️ Uploading to all selected platforms…');
    }
  } catch (e) {
    toast('error', 'Cannot reach server');
    document.getElementById('publish-btn').disabled = false;
  }
}

function updateUploadProgress(msg) {
  const { platform, id, status, error } = msg;
  const safId = safeid(id);
  const bar = document.getElementById(`bar-${platform}-${safId}`);
  const stat = document.getElementById(`stat-${platform}-${safId}`);
  if (!bar || !stat) return;

  if (status === 'uploading') {
    bar.style.width = '60%';
    stat.textContent = 'Sending…';
    stat.className = 'progress-status uploading';
  } else if (status === 'done') {
    bar.style.width = '100%';
    stat.textContent = '✅ Done';
    stat.className = 'progress-status done';
  } else if (status === 'error') {
    bar.style.width = '100%';
    bar.style.background = '#f87171';
    stat.textContent = '❌ Failed';
    stat.className = 'progress-status error';
    if (error) console.error(`[Upload Error] ${platform}/${id}: ${error}`);
  }
}

function resetUploadForm() {
  state.selectedFile = null;
  const fileInput = document.getElementById('file-input');
  if (fileInput) fileInput.value = '';

  const dropzoneEmpty = document.getElementById('dropzone-empty');
  const dropzonePreview = document.getElementById('dropzone-preview');
  if (dropzoneEmpty) dropzoneEmpty.style.display = '';
  if (dropzonePreview) dropzonePreview.style.display = 'none';

  const captionEl = document.getElementById('caption');
  if (captionEl) captionEl.value = '';

  const charCountEl = document.getElementById('char-count');
  if (charCountEl) charCountEl.textContent = '0';
}

function onUploadComplete(results) {
  document.getElementById('publish-btn').disabled = false;
  const success = results.filter(r => r.success).length;
  const total = results.length;

  if (success === total) {
    toast('success', `🎉 Published to all ${total} targets!`);
  } else {
    toast('warning', `⚠️ ${success}/${total} targets succeeded. Check logs.`);
  }

  // Log failures if any
  results.filter(r => !r.success).forEach(r => {
    console.error(`[FAIL] ${r.platform}/${r.id}: ${r.error}`);
  });

  // Refresh status & analytics automatically
  fetchStatus();

  setTimeout(() => {
    resetUploadForm();
    const progressSection = document.getElementById('upload-progress');
    if (progressSection) progressSection.style.display = 'none';
  }, 3000);
}

// ── Analytics ──────────────────────────────────────────────
async function syncAnalytics() {
  const btn = document.getElementById('sync-btn');
  btn.classList.add('spinning');
  toast('info', '🔄 Syncing analytics…');

  try {
    const res = await api('GET', '/api/analytics');
    if (res.success) {
      state.lastAnalytics = res.analytics;
      renderAnalytics(res.analytics);
      toast('success', '✅ Connected analytics synced!');
    }
  } catch (e) {
    toast('error', 'Analytics sync failed');
  } finally {
    btn.classList.remove('spinning');
  }
}

function renderAnalytics(analytics) {
  const grid = document.getElementById('analytics-grid');
  const cards = [];

  const tgTableContainer = document.getElementById('tg-chats-analytics');
  const waTableContainer = document.getElementById('wa-groups-analytics');

  if (tgTableContainer) hide('tg-chats-analytics');
  if (waTableContainer) hide('wa-groups-analytics');

  if (!analytics) return;

  // 1. TELEGRAM ANALYTICS (Only if Telegram is connected)
  if (analytics.telegram && state.platforms.telegram.connected) {
    const tg = analytics.telegram;
    const connectedTgChats = tg.chats || [];

    if (connectedTgChats.length > 0) {
      const totalMembers = connectedTgChats.reduce((s, c) => s + (c.memberCount || 0), 0);

      cards.push({
        platform: 'Telegram',
        color: '#2AABEE',
        stats: [
          { num: formatNum(totalMembers), label: 'Connected Members' },
          { num: connectedTgChats.length, label: 'Connected Chats' }
        ]
      });

      if (tgTableContainer) {
        show('tg-chats-analytics');
        const listEl = document.getElementById('tg-chats-table');
        if (listEl) {
          listEl.innerHTML = connectedTgChats.map(c => `
            <div class="groups-table-row">
              <span class="groups-table-name">${esc(c.name)}</span>
              <span class="group-type type-${c.type === 'channel' ? 'channel' : 'group'}">${c.type}</span>
              <span class="target-badge badge-tg" style="font-size:.68rem">Connected</span>
              <span class="groups-table-count">${formatNum(c.memberCount||0)} members</span>
            </div>
          `).join('');
        }
      }
    }
  }

  // 2. WHATSAPP ANALYTICS (Only connected / selected targets and added channels)
  if (analytics.whatsapp && state.platforms.whatsapp.connected) {
    const wa = analytics.whatsapp;

    const selectedWaIds = new Set(
      state.selectedTargets
        .filter(t => t.platform === 'whatsapp')
        .map(t => String(t.id))
    );

    const allWaGroups = wa.groups || [];
    const allWaChannels = wa.channels || [];

    // Filter groups to ONLY those selected as active targets
    const connectedGroups = allWaGroups.filter(g => selectedWaIds.has(String(g.id)));
    // Include added WhatsApp channels
    const connectedChannels = allWaChannels;

    const totalConnectedTargets = connectedGroups.length + connectedChannels.length;

    // Calculate total members strictly across connected targets
    const connectedMembers = connectedGroups.reduce((s, g) => s + (g.memberCount || 0), 0) +
                             connectedChannels.reduce((s, c) => s + (c.memberCount || 0), 0);

    if (totalConnectedTargets > 0) {
      cards.push({
        platform: 'WhatsApp',
        color: '#25D366',
        stats: [
          { num: formatNum(connectedMembers), label: 'Connected Target Members' },
          { num: totalConnectedTargets, label: 'Connected Targets' }
        ]
      });

      if (waTableContainer) {
        show('wa-groups-analytics');
        const listEl = document.getElementById('wa-groups-table');
        if (listEl) {
          const rows = [
            ...connectedGroups.map(g => `
              <div class="groups-table-row">
                <span class="groups-table-name">👥 ${esc(g.name)}</span>
                <span class="target-badge badge-wa" style="font-size:.68rem">Selected Target</span>
                <span class="groups-table-count">${formatNum(g.memberCount||0)} members</span>
              </div>
            `),
            ...connectedChannels.map(c => `
              <div class="groups-table-row">
                <span class="groups-table-name">📢 ${esc(c.name)}</span>
                <span class="group-type type-channel">Channel</span>
                <span class="target-badge badge-wa" style="font-size:.68rem">Connected</span>
                <span class="groups-table-count">${formatNum(c.memberCount||0)} subscribers</span>
              </div>
            `)
          ];
          listEl.innerHTML = rows.join('');
        }
      }
    } else if (allWaGroups.length > 0) {
      // WhatsApp connected, but no target groups selected yet
      cards.push({
        platform: 'WhatsApp',
        color: '#25D366',
        stats: [
          { num: '0', label: 'Selected Targets' },
          { num: allWaGroups.length, label: 'Available Groups' }
        ]
      });

      if (waTableContainer) {
        show('wa-groups-analytics');
        const listEl = document.getElementById('wa-groups-table');
        if (listEl) {
          listEl.innerHTML = `
            <div class="loading-groups" style="text-align:center; padding:1.2rem; color:var(--text2)">
              💡 Select groups from the WhatsApp panel on the left to include them in connected target analysis.
            </div>
          `;
        }
      }
    }
  }

  // 3. PLACEHOLDER IF NOTHING CONNECTED OR SELECTED
  if (cards.length === 0) {
    grid.innerHTML = `
      <div class="analytics-placeholder">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <p>Connect platforms and select target groups/channels to view member analysis</p>
      </div>`;
    return;
  }

  grid.innerHTML = cards.map(card =>
    card.stats.map(s => `
      <div class="analytics-card">
        <div class="analytics-card-platform" style="color:${card.color}">${card.platform}</div>
        <span class="analytics-card-num">${s.num}</span>
        <div class="analytics-card-label">${s.label}</div>
      </div>
    `).join('')
  ).join('');
}

// ── Utilities ──────────────────────────────────────────────
async function api(method, url, body) {
  const opts = { method, headers: {} };
  if (body) {
    opts.body = JSON.stringify(body);
    opts.headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, opts);
  return res.json();
}

function show(id) { const el = document.getElementById(id); if (el) el.style.display = ''; }
function hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function safeid(str) {
  return String(str).replace(/[^a-zA-Z0-9]/g, '_');
}

function formatNum(n) {
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n/1_000).toFixed(1) + 'K';
  return String(n);
}

function formatBytes(b) {
  if (b >= 1024*1024*1024) return (b/1024/1024/1024).toFixed(2)+' GB';
  if (b >= 1024*1024) return (b/1024/1024).toFixed(1)+' MB';
  if (b >= 1024) return (b/1024).toFixed(0)+' KB';
  return b+' B';
}

function getFileIcon(mime) {
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.includes('pdf')) return '📄';
  if (mime.includes('zip') || mime.includes('rar')) return '📦';
  return '📁';
}

function platformLabel(p) {
  return { whatsapp:'📱 WhatsApp', telegram:'✈️ Telegram' }[p] || p;
}

let lastToastTime = 0;
let lastToastMsg = '';

function toast(type, message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const now = Date.now();
  if (message === lastToastMsg && (now - lastToastTime) < 1500) {
    return;
  }
  lastToastTime = now;
  lastToastMsg = message;

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
  el.innerHTML = `<span>${icons[type]||''}</span><span>${message}</span>`;
  container.appendChild(el);

  while (container.children.length > 3) {
    container.removeChild(container.firstChild);
  }

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

// ── Media Downloader ───────────────────────────────────────
async function checkDownloaderStatus() {
  try {
    const res = await api('GET', '/api/downloader/status');
    state.downloader.available = res.available;
    if (!res.available) {
      const notice = document.getElementById('ytdlp-missing-notice');
      if (notice) notice.style.display = 'flex';
      const btn = document.getElementById('dl-btn');
      if (btn) btn.disabled = true;
    }
  } catch (e) { /* server offline */ }
}

async function startDownload() {
  const input = document.getElementById('dl-url-input');
  const url = input?.value.trim();
  if (!url) return toast('error', 'Paste a YouTube or Instagram URL first');

  // Reset previous result/error
  hide('dl-result');
  hide('dl-error');
  state.downloader.currentFilename = null;
  state.downloader.currentMimeType = null;
  const useBtn = document.getElementById('dl-use-btn');
  if (useBtn) useBtn.classList.remove('used');

  // Show progress
  const progressEl = document.getElementById('dl-progress');
  const progressFill = document.getElementById('dl-progress-fill');
  const progressText = document.getElementById('dl-progress-text');
  const dlBtn = document.getElementById('dl-btn');
  const btnText = document.getElementById('dl-btn-text');

  if (progressEl) progressEl.style.display = 'block';
  if (dlBtn) dlBtn.disabled = true;
  if (btnText) btnText.textContent = 'Downloading…';

  // Animate the progress bar (indeterminate)
  let pct = 5;
  const pctInterval = setInterval(() => {
    pct = Math.min(pct + (Math.random() * 8), 88);
    if (progressFill) progressFill.style.width = pct + '%';
  }, 600);

  const isYT = /(?:youtube\.com|youtu\.be)/i.test(url);
  const isIG = /instagram\.com/i.test(url);
  if (progressText) {
    progressText.textContent = isYT
      ? '⬇️ Fetching YouTube video at highest quality…'
      : isIG
      ? '⬇️ Fetching Instagram reel/post…'
      : '⬇️ Downloading…';
  }

  try {
    const res = await api('POST', '/api/download', { url });
    clearInterval(pctInterval);

    if (res.success) {
      if (progressFill) progressFill.style.width = '100%';
      if (progressFill) progressFill.style.animation = 'none';
      if (progressFill) progressFill.style.background = 'var(--green)';
      setTimeout(() => {
        if (progressEl) progressEl.style.display = 'none';
        if (progressFill) { progressFill.style.width = '0%'; progressFill.style.animation = ''; progressFill.style.background = ''; }
      }, 600);

      onDownloadComplete(res);
    } else {
      if (progressEl) progressEl.style.display = 'none';
      showDlError(res.error || 'Download failed');
    }
  } catch (e) {
    clearInterval(pctInterval);
    if (progressEl) progressEl.style.display = 'none';
    showDlError(e.message || 'Download failed');
  } finally {
    if (dlBtn) dlBtn.disabled = false;
    if (btnText) btnText.textContent = 'Download';
  }
}

function onDownloadComplete(data) {
  state.downloader.currentFilename = data.filename;
  state.downloader.currentMimeType = data.mimeType;

  const resultEl = document.getElementById('dl-result');
  const iconEl = document.getElementById('dl-result-icon');
  const nameEl = document.getElementById('dl-result-name');
  const metaEl = document.getElementById('dl-result-meta');
  const saveLink = document.getElementById('dl-save-link');

  if (iconEl) iconEl.textContent = data.mimeType?.startsWith('video') ? '🎬'
    : data.mimeType?.startsWith('audio') ? '🎵' : '📁';

  const displayName = data.filename.replace(/^\d+_/, '').replace(/_/g, ' ');
  if (nameEl) nameEl.textContent = displayName;

  const platLabel = data.platform === 'youtube' ? '▶ YouTube' : '◎ Instagram';
  if (metaEl) metaEl.textContent = `${platLabel}  ·  ${formatBytes(data.size)}  ·  Highest quality`;

  if (saveLink) {
    saveLink.href = `/api/download/file/${encodeURIComponent(data.filename)}`;
    saveLink.download = displayName;
  }

  if (resultEl) resultEl.style.display = 'flex';
  toast('success', `✅ Downloaded: ${displayName}`);
}

function showDlError(msg) {
  const errEl = document.getElementById('dl-error');
  if (errEl) {
    errEl.textContent = '❌ ' + msg;
    errEl.style.display = 'block';
  }
  toast('error', msg);
}

async function useDownloadedFile() {
  const filename = state.downloader.currentFilename;
  if (!filename) return toast('error', 'No downloaded file available');

  const useBtn = document.getElementById('dl-use-btn');
  const origHTML = useBtn?.innerHTML || '';
  if (useBtn) { useBtn.disabled = true; useBtn.innerHTML = '⏳ Loading…'; }

  try {
    const res = await fetch(`/api/download/file/${encodeURIComponent(filename)}`);
    if (!res.ok) throw new Error('File not found on server');

    const blob = await res.blob();
    const mimeType = state.downloader.currentMimeType || blob.type || 'video/mp4';
    const displayName = filename.replace(/^\d+_/, '');
    const file = new File([blob], displayName, { type: mimeType });

    // Inject into the Upload Content section
    setFile(file);

    if (useBtn) {
      useBtn.classList.add('used');
      useBtn.innerHTML = '✅ Loaded into Upload';
      setTimeout(() => {
        useBtn.classList.remove('used');
        useBtn.innerHTML = origHTML;
        useBtn.disabled = false;
      }, 3000);
    }

    // Scroll the upload panel into view
    const uploadPanel = document.getElementById('upload-panel');
    if (uploadPanel) uploadPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    toast('success', '✅ File loaded into Upload Content — select targets and publish!');
  } catch (e) {
    if (useBtn) { useBtn.innerHTML = origHTML; useBtn.disabled = false; }
    toast('error', e.message || 'Failed to load file');
  }
}

// ── Connection History ─────────────────────────────────────
async function fetchHistory() {
  try {
    const res = await api('GET', '/api/history');
    if (res.success && res.history) {
      state.history = res.history;
      renderHistory('whatsapp');
      renderHistory('telegram');
    }
  } catch (e) { /* ignore */ }
}

function renderHistory(platform) {
  const container = document.getElementById(`${platform === 'whatsapp' ? 'wa' : 'tg'}-history-list`);
  if (!container) return;

  const items = state.history?.[platform] || [];
  if (!items.length) {
    container.innerHTML = '<div class="loading-groups">No target history recorded yet.</div>';
    return;
  }

  container.innerHTML = items.map(item => {
    const isCurrentlyActive = isSelected(platform, item.id);
    const typeLabel = item.type === 'channel' ? 'Channel' : item.type === 'supergroup' ? 'Super Group' : 'Group';
    const typeClass = item.type === 'channel' ? 'type-channel' : item.type === 'supergroup' ? 'type-supergroup' : 'type-group';

    return `
      <div class="group-item history-item" style="border-color: rgba(255,255,255,0.06)">
        <div class="group-check${isCurrentlyActive ? ' selected' : ''}" style="${isCurrentlyActive ? 'background:var(--purple);border-color:var(--purple);' : ''}"></div>
        <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:1px">
          <span class="group-name">${esc(item.name)}</span>
          <span style="font-size:.68rem; color:var(--text3)">${formatNum(item.memberCount||0)} members</span>
        </div>
        <span class="group-type ${typeClass}">${typeLabel}</span>
        <button class="btn-add" style="padding:.2rem .5rem; font-size:.68rem"
          onclick="reconnectFromHistory(event, '${platform}', '${esc(item.id)}', '${esc(item.name)}')">
          ⚡ ${isCurrentlyActive ? 'Selected' : 'Re-select'}
        </button>
        <button class="btn-disconnect" style="padding:.2rem .4rem; font-size:.65rem"
          onclick="removeFromHistory(event, '${platform}', '${esc(item.id)}')">✕</button>
      </div>
    `;
  }).join('');
}

async function reconnectFromHistory(event, platform, id, name) {
  event.stopPropagation();
  if (platform === 'telegram') {
    try {
      toast('info', `⏳ Re-connecting ${name}…`);
      const res = await api('POST', '/api/telegram/add-chat', { chatId: id });
      if (res.success) {
        toast('success', `✅ Reconnected Telegram chat: ${name}`);
        if (!isSelected('telegram', id)) {
          toggleTarget('telegram', id, name);
        }
        fetchStatus();
        fetchHistory();
      } else {
        toast('error', res.error || 'Failed to reconnect chat');
      }
    } catch (e) {
      toast('error', 'Cannot reach server');
    }
  } else if (platform === 'whatsapp') {
    toggleTarget('whatsapp', id, name);
    toast('success', `⚡ Selected: ${name}`);
    renderHistory('whatsapp');
  }
}

async function removeFromHistory(event, platform, id) {
  event.stopPropagation();
  try {
    const res = await api('POST', '/api/history/remove', { platform, id });
    if (res.success && res.history) {
      state.history = res.history;
      renderHistory(platform);
      toast('info', 'Item removed from history');
    }
  } catch (e) {
    toast('error', 'Failed to remove item');
  }
}

async function clearPlatformHistory(platform) {
  if (!confirm(`Clear all ${platform} connection history?`)) return;
  try {
    const res = await api('POST', '/api/history/clear', { platform });
    if (res.success && res.history) {
      state.history = res.history;
      renderHistory(platform);
      toast('info', `Cleared ${platform} connection history`);
    }
  } catch (e) {
    toast('error', 'Failed to clear history');
  }
}

// ── Schedule & Broadcast Queue ─────────────────────────────
function setPublishMode(mode) {
  state.publishMode = mode;
  const nowBtn = document.getElementById('mode-now-btn');
  const schedBtn = document.getElementById('mode-schedule-btn');
  const pickerWrap = document.getElementById('schedule-picker-wrap');
  const btnText = document.getElementById('publish-btn-text');
  const dtInput = document.getElementById('schedule-datetime');

  if (mode === 'schedule') {
    nowBtn?.classList.remove('active');
    schedBtn?.classList.add('active');
    if (pickerWrap) pickerWrap.style.display = 'flex';
    if (btnText) btnText.textContent = 'Schedule Broadcast for Selected Time';

    if (dtInput && !dtInput.value) {
      const future = new Date(Date.now() + 60 * 60 * 1000);
      future.setMinutes(future.getMinutes() - future.getTimezoneOffset());
      dtInput.value = future.toISOString().slice(0, 16);
    }
  } else {
    schedBtn?.classList.remove('active');
    nowBtn?.classList.add('active');
    if (pickerWrap) pickerWrap.style.display = 'none';
    if (btnText) btnText.textContent = 'Publish Now — Original Quality';
  }
}

function handlePublishOrSchedule() {
  if (state.publishMode === 'schedule') {
    scheduleContent();
  } else {
    publishContent();
  }
}

async function scheduleContent() {
  if (!state.selectedFile) return toast('error', 'Select or drop a file first');
  if (!state.selectedTargets.length) return toast('error', 'Select at least one target group/channel');

  const dtInput = document.getElementById('schedule-datetime');
  const scheduledTimeStr = dtInput?.value;
  if (!scheduledTimeStr) return toast('error', 'Select a date and time to schedule the broadcast');

  const scheduledTime = new Date(scheduledTimeStr).getTime();
  if (isNaN(scheduledTime) || scheduledTime <= Date.now()) {
    return toast('error', 'Scheduled time must be in the future');
  }

  const caption = document.getElementById('caption').value;
  const btn = document.getElementById('publish-btn');
  btn.disabled = true;

  const formData = new FormData();
  formData.append('media', state.selectedFile);
  formData.append('caption', caption);
  formData.append('targets', JSON.stringify(state.selectedTargets));
  formData.append('scheduledTime', new Date(scheduledTime).toISOString());

  try {
    const res = await fetch('/api/schedule', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      toast('success', `⏰ Broadcast scheduled for ${new Date(scheduledTime).toLocaleString()}`);
      clearFile();
      const capInput = document.getElementById('caption');
      if (capInput) capInput.value = '';
      const cc = document.getElementById('char-count');
      if (cc) cc.textContent = '0';
      setPublishMode('now');
      fetchScheduledJobs();
    } else {
      toast('error', data.error || 'Scheduling failed');
    }
  } catch (e) {
    console.error('[Schedule Exception]', e);
    toast('error', e.message || 'Failed to schedule broadcast.');
  } finally {
    btn.disabled = false;
  }
}

async function fetchScheduledJobs() {
  try {
    const res = await api('GET', '/api/schedule/jobs');
    if (res.success && res.jobs) {
      state.scheduledJobs = res.jobs;
      renderScheduledJobs();
    }
  } catch (e) { /* ignore */ }
}

function renderScheduledJobs() {
  const container = document.getElementById('scheduled-jobs-list');
  if (!container) return;

  const pendingJobs = (state.scheduledJobs || []).filter(j => j.status === 'pending');
  if (!pendingJobs.length) {
    container.innerHTML = '<div class="loading-groups">No upcoming broadcasts scheduled</div>';
    return;
  }

  container.innerHTML = pendingJobs.map(job => {
    const timeDate = new Date(job.scheduledTime);
    const formattedTime = timeDate.toLocaleString();
    const isVideo = job.mimeType?.startsWith('video');
    const icon = isVideo ? '🎬' : job.mimeType?.startsWith('image') ? '🖼️' : '📁';

    const targetBadges = (job.targets || []).map(t =>
      `<span class="target-badge ${t.platform === 'whatsapp' ? 'badge-wa' : 'badge-tg'}">${t.platform === 'whatsapp' ? 'WA' : 'TG'} · ${esc(t.name || t.id)}</span>`
    ).join(' ');

    return `
      <div class="scheduled-job-card">
        <div class="sched-job-info">
          <div class="sched-job-icon">${icon}</div>
          <div class="sched-job-details">
            <strong>${esc(job.originalName)}</strong>
            <div class="sched-job-meta">
              <span class="sched-time-badge">⏰ ${formattedTime}</span>
              <span>${formatBytes(job.size || 0)}</span>
              <span>${targetBadges}</span>
            </div>
            ${job.caption ? `<span style="font-size:.75rem; color:var(--text2); font-style:italic">"${esc(job.caption.substring(0, 80))}${job.caption.length > 80 ? '…' : ''}"</span>` : ''}
          </div>
        </div>
        <button class="btn-cancel-job" onclick="cancelScheduledJob('${job.jobId}')">✕ Cancel</button>
      </div>
    `;
  }).join('');
}

async function cancelScheduledJob(jobId) {
  if (!confirm('Cancel this scheduled broadcast?')) return;
  try {
    const res = await api('POST', '/api/schedule/cancel', { jobId });
    if (res.success) {
      toast('info', 'Scheduled broadcast cancelled');
      fetchScheduledJobs();
    } else {
      toast('error', res.error || 'Failed to cancel job');
    }
  } catch (e) {
    toast('error', 'Error cancelling scheduled job');
  }
}

// ── Session Config & Remember Me ───────────────────────────
async function fetchSessionConfig() {
  try {
    const res = await api('GET', '/api/session/config');
    if (res.success && res.config) {
      const isRemember = res.config.rememberMe !== false;
      const waCb = document.getElementById('remember-me-wa');
      const tgCb = document.getElementById('remember-me-tg');
      if (waCb) waCb.checked = isRemember;
      if (tgCb) tgCb.checked = isRemember;

      if (res.config.telegram?.token) {
        const tgInput = document.getElementById('tg-token-input');
        if (tgInput && !tgInput.value) tgInput.value = res.config.telegram.token;
      }
    }
  } catch (e) { /* ignore */ }
}

async function toggleRememberMe(checked) {
  const waCb = document.getElementById('remember-me-wa');
  const tgCb = document.getElementById('remember-me-tg');
  if (waCb) waCb.checked = checked;
  if (tgCb) tgCb.checked = checked;

  try {
    const res = await api('POST', '/api/session/config', { rememberMe: checked });
    if (res.success) {
      toast('info', checked ? '🔒 Sessions remembered across server restarts' : '🔓 Session auto-reconnect disabled');
    }
  } catch (e) { /* ignore */ }
}



