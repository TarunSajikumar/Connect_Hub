// ============================================================
// MEDIA DOWNLOADER — Frontend Interactive Script
// ============================================================

let currentTab = 'youtube';

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('url-input');
  const pasteBtn = document.getElementById('paste-btn');
  const downloadBtn = document.getElementById('download-btn');
  const downloadBtnText = document.getElementById('download-btn-text');
  const clearBtn = document.getElementById('clear-btn');
  
  const tabYt = document.getElementById('tab-youtube');
  const tabIg = document.getElementById('tab-instagram');
  
  const loadingState = document.getElementById('loading-state');
  const loadingMessage = document.getElementById('loading-message');
  const errorState = document.getElementById('error-state');
  const errorMessage = document.getElementById('error-message');
  const resultCard = document.getElementById('result-card');

  // ─── Tab Switching ─────────────────────────────────────────

  function setTab(tab) {
    currentTab = tab;
    if (tab === 'youtube') {
      tabYt.classList.add('active');
      tabIg.classList.remove('active');
      urlInput.placeholder = 'Paste YouTube link here...';
    } else {
      tabIg.classList.add('active');
      tabYt.classList.remove('active');
      urlInput.placeholder = 'Paste Instagram link here...';
    }
  }

  tabYt.addEventListener('click', () => setTab('youtube'));
  tabIg.addEventListener('click', () => setTab('instagram'));

  // ─── Auto-detect Platform on Input ─────────────────────────

  urlInput.addEventListener('input', (e) => {
    const val = (e.target.value || '').toLowerCase().trim();
    if (val.includes('youtube.com') || val.includes('youtu.be')) {
      setTab('youtube');
    } else if (val.includes('instagram.com') || val.includes('instagr.am')) {
      setTab('instagram');
    }
    clearBtn.style.display = val ? 'flex' : 'none';
    hideError();
  });

  clearBtn.addEventListener('click', () => {
    urlInput.value = '';
    clearBtn.style.display = 'none';
    urlInput.focus();
    resultCard.style.display = 'none';
    hideError();
  });

  // ─── Paste from Clipboard ──────────────────────────────────

  pasteBtn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          urlInput.value = text.trim();
          const lower = text.toLowerCase();
          if (lower.includes('youtube.com') || lower.includes('youtu.be')) setTab('youtube');
          if (lower.includes('instagram.com') || lower.includes('instagr.am')) setTab('instagram');
          clearBtn.style.display = 'flex';
          hideError();
          fetchMedia();
        }
      } else {
        urlInput.focus();
      }
    } catch (e) {
      urlInput.focus();
    }
  });

  // ─── Enter Key & Button Click ──────────────────────────────

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fetchMedia();
    }
  });

  downloadBtn.addEventListener('click', fetchMedia);

  // ─── Fetch Media API ───────────────────────────────────────

  async function fetchMedia() {
    const rawUrl = urlInput.value.trim();
    if (!rawUrl) {
      showError('Please paste a valid YouTube or Instagram link');
      urlInput.focus();
      return;
    }

    hideError();
    resultCard.style.display = 'none';
    showLoading('Fetching media without cookies…');

    try {
      const isInstagram = currentTab === 'instagram' || /instagram\.com|instagr\.am/i.test(rawUrl);
      const endpoint = isInstagram ? '/api/instagram' : '/api/youtube';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rawUrl })
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to fetch media details');
      }

      if (isInstagram) {
        displayInstagramResult(json.data, rawUrl);
      } else {
        displayYouTubeResult(json.data, rawUrl);
      }
    } catch (err) {
      showError(err.message || 'Unable to download media from this link.');
    } finally {
      hideLoading();
    }
  }

  // ─── Display YouTube Result ────────────────────────────────

  function displayYouTubeResult(data, sourceUrl) {
    const resultThumb = document.getElementById('result-thumb');
    const resultBadge = document.getElementById('result-badge');
    const resultTitle = document.getElementById('result-title');
    const resultAuthor = document.getElementById('result-author');
    const resultDuration = document.getElementById('result-duration');
    const formatsGrid = document.getElementById('formats-grid');

    resultThumb.src = data.thumbnail || `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80`;
    resultTitle.textContent = data.title || 'YouTube Video';
    resultAuthor.textContent = data.author || 'YouTube';
    resultDuration.textContent = formatDuration(data.duration);
    resultBadge.textContent = 'HD';

    formatsGrid.innerHTML = '';

    const formats = Array.isArray(data.formats) ? data.formats : [];
    if (formats.length === 0) {
      formatsGrid.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No formats available.</p>`;
    } else {
      formats.forEach((fmt) => {
        const isAudio = fmt.type === 'audio' || fmt.hasAudio && !fmt.hasVideo;
        const icon = isAudio ? '🎵' : '🎬';
        const label = fmt.quality || (isAudio ? 'Audio MP3' : 'Video MP4');
        const ext = fmt.container || (isAudio ? 'mp3' : 'mp4');
        const safeTitle = (data.title || 'youtube-video').slice(0, 40);

        const btn = document.createElement('a');
        btn.className = 'format-btn';
        btn.href = `/api/youtube/download?url=${encodeURIComponent(fmt.url)}&title=${encodeURIComponent(safeTitle)}&itag=${fmt.itag || ''}`;
        btn.setAttribute('download', `${safeTitle}.${ext}`);

        btn.innerHTML = `
          <div class="format-label">
            <span>${icon}</span>
            <span>${label}</span>
          </div>
          <span class="format-ext">${ext}</span>
        `;
        formatsGrid.appendChild(btn);
      });
    }

    resultCard.style.display = 'flex';
  }

  // ─── Display Instagram Result ──────────────────────────────

  function displayInstagramResult(data, sourceUrl) {
    const resultThumb = document.getElementById('result-thumb');
    const resultBadge = document.getElementById('result-badge');
    const resultTitle = document.getElementById('result-title');
    const resultAuthor = document.getElementById('result-author');
    const resultDuration = document.getElementById('result-duration');
    const formatsGrid = document.getElementById('formats-grid');

    resultThumb.src = data.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80';
    resultTitle.textContent = data.title || 'Instagram Media';
    resultAuthor.textContent = data.author || 'Instagram';
    resultDuration.textContent = 'Reel / Post';
    resultBadge.textContent = 'INSTA';

    formatsGrid.innerHTML = '';

    const items = Array.isArray(data.media) ? data.media : (data.formats || []);
    if (items.length === 0) {
      formatsGrid.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No media items found.</p>`;
    } else {
      items.forEach((item, index) => {
        const isVideo = item.type === 'video' || item.url?.includes('.mp4');
        const icon = isVideo ? '🎬' : '🖼️';
        const label = item.quality || (isVideo ? `Download Video ${index + 1}` : `Download Image ${index + 1}`);
        const ext = isVideo ? 'mp4' : 'jpg';
        const safeTitle = `instagram-media-${index + 1}`;

        const btn = document.createElement('a');
        btn.className = 'format-btn';
        btn.href = `/api/instagram/download?url=${encodeURIComponent(item.url)}&title=${encodeURIComponent(safeTitle)}`;
        btn.setAttribute('download', `${safeTitle}.${ext}`);

        btn.innerHTML = `
          <div class="format-label">
            <span>${icon}</span>
            <span>${label}</span>
          </div>
          <span class="format-ext">${ext}</span>
        `;
        formatsGrid.appendChild(btn);
      });
    }

    resultCard.style.display = 'flex';
  }

  // ─── Helpers ───────────────────────────────────────────────

  function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return 'Video';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function showLoading(msg) {
    loadingMessage.textContent = msg || 'Downloading media…';
    loadingState.style.display = 'flex';
    downloadBtn.disabled = true;
    downloadBtnText.textContent = 'Fetching…';
  }

  function hideLoading() {
    loadingState.style.display = 'none';
    downloadBtn.disabled = false;
    downloadBtnText.textContent = 'Download';
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorState.style.display = 'flex';
  }

  function hideError() {
    errorState.style.display = 'none';
  }
});
