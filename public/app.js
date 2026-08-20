// ============================================================
// MEDIA DOWNLOADER — Interactive Frontend Logic
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('url-input');
  const pasteBtn = document.getElementById('paste-btn');
  const downloadBtn = document.getElementById('download-btn');
  const downloadBtnText = document.getElementById('download-btn-text');
  const clearBtn = document.getElementById('clear-btn');
  
  const badgeYt = document.getElementById('badge-youtube');
  const badgeIg = document.getElementById('badge-instagram');
  
  const loadingState = document.getElementById('loading-state');
  const loadingMessage = document.getElementById('loading-message');
  const errorState = document.getElementById('error-state');
  const errorMessage = document.getElementById('error-message');
  const resultCard = document.getElementById('result-card');

  // ─── Platform Detection & Badge Highlight ──────────────────

  function detectPlatform(val) {
    const text = (val || '').toLowerCase().trim();
    if (text.includes('youtube.com') || text.includes('youtu.be')) {
      badgeYt.classList.add('active');
      badgeIg.classList.remove('active');
    } else if (text.includes('instagram.com') || text.includes('instagr.am')) {
      badgeIg.classList.add('active');
      badgeYt.classList.remove('active');
    } else {
      badgeYt.classList.remove('active');
      badgeIg.classList.remove('active');
    }

    clearBtn.style.display = text ? 'flex' : 'none';
  }

  urlInput.addEventListener('input', (e) => {
    detectPlatform(e.target.value);
    hideError();
  });

  clearBtn.addEventListener('click', () => {
    urlInput.value = '';
    detectPlatform('');
    urlInput.focus();
    resultCard.style.display = 'none';
    hideError();
  });

  // ─── Paste from Clipboard ──────────────────────────────────

  pasteBtn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText) {
          urlInput.value = clipText.trim();
          detectPlatform(clipText);
          hideError();
          fetchMedia();
        }
      } else {
        urlInput.focus();
      }
    } catch (err) {
      urlInput.focus();
    }
  });

  // ─── Enter Key Listener ────────────────────────────────────

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fetchMedia();
    }
  });

  downloadBtn.addEventListener('click', () => {
    fetchMedia();
  });

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
    showLoading('Fetching media information without cookies…');

    try {
      const res = await fetch('/api/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rawUrl })
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to fetch media from this link');
      }

      displayResult(json.data);
    } catch (err) {
      showError(err.message || 'Error processing download. Please verify the link is public.');
    } finally {
      hideLoading();
    }
  }

  // ─── Display Result Card ───────────────────────────────────

  function displayResult(data) {
    const resultThumb = document.getElementById('result-thumb');
    const resultBadge = document.getElementById('result-badge');
    const resultTitle = document.getElementById('result-title');
    const resultAuthor = document.getElementById('result-author');
    const resultPlatformText = document.getElementById('result-platform-text');
    const formatsGrid = document.getElementById('formats-grid');

    resultThumb.src = data.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80';
    resultTitle.textContent = data.title || 'Media';
    resultAuthor.textContent = data.author || (data.platform === 'youtube' ? 'YouTube' : 'Instagram');
    resultPlatformText.textContent = data.platform === 'youtube' ? 'YouTube Media' : 'Instagram Media';
    resultBadge.textContent = data.platform === 'youtube' ? 'HD' : 'REEL';

    formatsGrid.innerHTML = '';

    if (Array.isArray(data.formats) && data.formats.length > 0) {
      data.formats.forEach((fmt, idx) => {
        const btn = document.createElement('a');
        btn.className = 'format-btn';
        
        const ext = fmt.container || (fmt.type === 'audio' ? 'mp3' : 'mp4');
        const filename = (data.title || 'download').slice(0, 50);
        btn.href = `/api/download?url=${encodeURIComponent(fmt.url)}&filename=${encodeURIComponent(filename)}&ext=${ext}`;
        btn.setAttribute('download', `${filename}.${ext}`);

        const isAudio = fmt.type === 'audio';
        const icon = isAudio ? '🎵' : '🎬';

        btn.innerHTML = `
          <div class="format-label">
            <span>${icon}</span>
            <span>${fmt.quality || (isAudio ? 'Audio Only' : `Video Part ${idx + 1}`)}</span>
          </div>
          <span class="format-ext">${ext}</span>
        `;

        formatsGrid.appendChild(btn);
      });
    } else {
      formatsGrid.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No download formats available.</p>`;
    }

    resultCard.style.display = 'flex';
  }

  // ─── Helpers ───────────────────────────────────────────────

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
