// ============================================================
// MEDIA DOWNLOADER — Interactive Client Script
// ============================================================

let currentTab = 'youtube';

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('urlInput');
  const pasteBtn = document.getElementById('pasteBtn');
  const fetchBtn = document.getElementById('fetchBtn');
  const fetchBtnText = document.getElementById('fetchBtnText');
  const clearBtn = document.getElementById('clear-btn');

  const tabYt = document.getElementById('tab-youtube');
  const tabIg = document.getElementById('tab-instagram');

  const loadingDiv = document.getElementById('loading');
  const loadingMsg = document.getElementById('loading-msg');
  const errorDiv = document.getElementById('error');
  const errorMsg = document.getElementById('errorMessage');
  const resultDiv = document.getElementById('result');

  // ─── Tab Switching ───────────────────────────────────────────

  function setTab(tab) {
    currentTab = tab;
    if (tab === 'youtube') {
      tabYt.classList.add('active');
      tabIg.classList.remove('active');
      urlInput.placeholder = 'Paste YouTube video or shorts link here...';
    } else {
      tabIg.classList.add('active');
      tabYt.classList.remove('active');
      urlInput.placeholder = 'Paste Instagram reel or post link here...';
    }
  }

  tabYt.addEventListener('click', () => setTab('youtube'));
  tabIg.addEventListener('click', () => setTab('instagram'));

  // ─── Auto-Detect Platform on Input ───────────────────────────

  function detectAndSwitchTab(val) {
    const text = (val || '').toLowerCase().trim();
    if (text.includes('youtube.com') || text.includes('youtu.be')) {
      setTab('youtube');
    } else if (text.includes('instagram.com') || text.includes('instagr.am')) {
      setTab('instagram');
    }
    clearBtn.style.display = text ? 'flex' : 'none';
  }

  urlInput.addEventListener('input', (e) => {
    detectAndSwitchTab(e.target.value);
    hideError();
  });

  clearBtn.addEventListener('click', () => {
    urlInput.value = '';
    detectAndSwitchTab('');
    urlInput.focus();
    resultDiv.style.display = 'none';
    hideError();
  });

  // ─── Paste from Clipboard ────────────────────────────────────

  pasteBtn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          urlInput.value = text.trim();
          detectAndSwitchTab(text);
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

  // ─── Enter Key & Download Button ─────────────────────────────

  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fetchMedia();
    }
  });

  fetchBtn.addEventListener('click', fetchMedia);

  // ─── Fetch Media API ─────────────────────────────────────────

  async function fetchMedia() {
    const url = urlInput.value.trim();
    if (!url) {
      showError('Please paste a valid YouTube or Instagram link');
      urlInput.focus();
      return;
    }

    hideError();
    resultDiv.style.display = 'none';
    showLoading(`Fetching ${currentTab === 'youtube' ? 'YouTube' : 'Instagram'} media without cookies…`);

    try {
      const endpoint = currentTab === 'youtube' ? '/api/youtube' : '/api/instagram';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Failed to fetch media from this link');
      }

      displayResults(json.data);
    } catch (err) {
      showError(err.message || 'An error occurred while extracting media. Ensure link is public.');
    } finally {
      hideLoading();
    }
  }

  // ─── Display Results ─────────────────────────────────────────

  function displayResults(data) {
    const mediaThumbnail = document.getElementById('mediaThumbnail');
    const mediaBadge = document.getElementById('mediaBadge');
    const mediaTitle = document.getElementById('mediaTitle');
    const mediaAuthor = document.getElementById('mediaAuthor');
    const mediaDuration = document.getElementById('mediaDuration');
    const downloadOptions = document.getElementById('downloadOptions');

    downloadOptions.innerHTML = '';

    if (currentTab === 'youtube') {
      mediaThumbnail.src = data.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80';
      mediaTitle.textContent = data.title || 'YouTube Video';
      mediaAuthor.textContent = data.author || 'YouTube';
      mediaDuration.textContent = formatDuration(data.duration);
      mediaBadge.textContent = 'HD';

      if (Array.isArray(data.formats) && data.formats.length > 0) {
        data.formats.forEach((format) => {
          const btn = document.createElement('a');
          btn.className = 'format-btn';

          const isAudio = !format.hasVideo || format.itag == 140;
          const icon = isAudio ? '🎵' : '🎬';
          const ext = format.container || (isAudio ? 'mp3' : 'mp4');
          const titleSafe = (data.title || 'video').slice(0, 50);

          const downloadUrl = `/api/youtube/download?mediaUrl=${encodeURIComponent(format.url)}&itag=${format.itag || ''}&title=${encodeURIComponent(titleSafe)}`;
          btn.href = downloadUrl;
          btn.setAttribute('download', `${titleSafe}.${ext}`);

          btn.innerHTML = `
            <div class="format-label">
              <span>${icon}</span>
              <span>${format.quality || (isAudio ? 'Audio Only' : 'Video')}</span>
            </div>
            <span class="format-ext">${ext}</span>
          `;

          downloadOptions.appendChild(btn);
        });
      }
    } else {
      // Instagram results
      const items = Array.isArray(data) ? data : [data];
      const firstItem = items[0] || {};

      mediaThumbnail.src = firstItem.thumbnail || firstItem.url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80';
      mediaTitle.textContent = firstItem.title || 'Instagram Media';
      mediaAuthor.textContent = 'Instagram Post';
      mediaDuration.textContent = `${items.length} item${items.length > 1 ? 's' : ''}`;
      mediaBadge.textContent = 'REEL';

      items.forEach((item, index) => {
        const btn = document.createElement('a');
        btn.className = 'format-btn';

        const isVideo = item.type === 'video' || (item.url && item.url.includes('.mp4'));
        const icon = isVideo ? '🎬' : '🖼️';
        const ext = isVideo ? 'mp4' : 'jpg';
        const label = isVideo ? `Download Video / Reel ${index + 1}` : `Download Photo ${index + 1}`;
        const titleSafe = `instagram-media-${index + 1}`;

        const downloadUrl = `/api/instagram/download?url=${encodeURIComponent(item.url)}&title=${encodeURIComponent(titleSafe)}`;
        btn.href = downloadUrl;
        btn.setAttribute('download', `${titleSafe}.${ext}`);

        btn.innerHTML = `
          <div class="format-label">
            <span>${icon}</span>
            <span>${label}</span>
          </div>
          <span class="format-ext">${ext}</span>
        `;

        downloadOptions.appendChild(btn);
      });
    }

    resultDiv.style.display = 'flex';
  }

  // ─── Helpers ─────────────────────────────────────────────────

  function formatDuration(seconds) {
    if (!seconds) return 'Video / Audio';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function showLoading(msg) {
    loadingMsg.textContent = msg || 'Fetching media…';
    loadingDiv.style.display = 'flex';
    fetchBtn.disabled = true;
    fetchBtnText.textContent = 'Fetching…';
  }

  function hideLoading() {
    loadingDiv.style.display = 'none';
    fetchBtn.disabled = false;
    fetchBtnText.textContent = 'Download';
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorDiv.style.display = 'flex';
  }

  function hideError() {
    errorDiv.style.display = 'none';
  }
});
