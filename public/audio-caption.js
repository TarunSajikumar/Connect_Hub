// ============================================================
// AI Audio / Video Speech-to-Text & Smart Caption Studio
// public/audio-caption.js
// ============================================================

class AudioCaptionEngine {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.audioContext = null;
    this.currentTranscript = '';
    this.selectedStyle = 'smart';
    this.activeMediaFile = null;
    this.activeMediaUrl = null;
    this.initSpeechRecognition();
  }

  /**
   * Initialize Web Speech API for real-time microphone / audio capture
   */
  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        const text = (final || interim).trim();
        if (text) {
          this.updateStudioTranscript(text);
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('[SpeechRecognition] error:', event.error);
        this.setListeningState(false);
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          this.setListeningState(false);
        }
      };
    }
  }

  /**
   * Toggle Speech-to-Text Microphone Recording
   */
  toggleVoiceRecording() {
    if (!this.recognition) {
      if (typeof toast === 'function') {
        toast('warning', 'Speech recognition is not supported in this browser. Please use Chrome/Edge or generate from video audio.');
      }
      return;
    }

    if (this.isListening) {
      this.recognition.stop();
      this.setListeningState(false);
      if (typeof toast === 'function') toast('info', 'Mic stopped. Generating caption...');
      this.generateCaptionFromCurrentData();
    } else {
      try {
        const langSelect = document.getElementById('audio-lang-select');
        if (langSelect && langSelect.value && langSelect.value !== 'auto') {
          this.recognition.lang = langSelect.value;
        }
        this.recognition.start();
        this.setListeningState(true);
        if (typeof toast === 'function') toast('success', '🎙️ Listening... Speak clearly or play audio');
      } catch (e) {
        console.warn('Recognition start error:', e.message);
        this.setListeningState(false);
      }
    }
  }

  /**
   * Update visual listening state
   */
  setListeningState(listening) {
    this.isListening = listening;
    const btn = document.getElementById('btn-studio-mic');
    const wave = document.getElementById('studio-audio-wave');
    const statusText = document.getElementById('studio-status-text');

    if (btn) {
      btn.classList.toggle('recording', listening);
      btn.innerHTML = listening ? '🛑 Stop Listening' : '🎙️ Speak / Record Audio';
    }
    if (wave) {
      wave.classList.toggle('active', listening);
    }
    if (statusText) {
      statusText.textContent = listening ? '🎙️ Listening to speech in real time...' : 'Ready to analyze audio & speech';
    }
  }

  /**
   * Update transcript input field inside Studio Modal
   */
  updateStudioTranscript(text) {
    this.currentTranscript = text;
    const input = document.getElementById('studio-transcript-input');
    if (input) {
      input.value = text;
    }
  }

  /**
   * Open the Audio Caption Studio Modal
   */
  openStudio(context = {}) {
    const modal = document.getElementById('audio-caption-modal');
    if (!modal) return;

    modal.style.display = 'flex';

    // Populate context from current state
    const textarea = document.getElementById('caption');
    const existingText = textarea?.value || '';

    // If media file or last downloaded video is present
    const transcriptInput = document.getElementById('studio-transcript-input');
    const previewBox = document.getElementById('studio-output-caption');

    if (context.title) {
      if (transcriptInput) transcriptInput.value = context.title;
      this.currentTranscript = context.title;
    } else if (existingText && transcriptInput && !transcriptInput.value) {
      transcriptInput.value = existingText;
      this.currentTranscript = existingText;
    }

    // Auto-generate initial preview
    this.generateCaptionFromCurrentData();
  }

  /**
   * Close the Audio Caption Studio Modal
   */
  closeStudio() {
    if (this.isListening && this.recognition) {
      this.recognition.stop();
      this.setListeningState(false);
    }
    const modal = document.getElementById('audio-caption-modal');
    if (modal) modal.style.display = 'none';
  }

  /**
   * Select Caption Style preset in studio
   */
  selectStyle(styleName) {
    this.selectedStyle = styleName;
    document.querySelectorAll('.studio-style-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.style === styleName);
    });
    this.generateCaptionFromCurrentData();
  }

  /**
   * Trigger AI Caption generation from current studio data or server
   */
  async generateCaptionFromCurrentData() {
    const transcriptInput = document.getElementById('studio-transcript-input');
    const outputBox = document.getElementById('studio-output-caption');
    const statusText = document.getElementById('studio-status-text');
    const generateBtn = document.getElementById('btn-studio-generate');

    const transcript = transcriptInput ? transcriptInput.value.trim() : this.currentTranscript;
    const lang = document.getElementById('audio-lang-select')?.value || 'auto';

    if (generateBtn) generateBtn.disabled = true;
    if (statusText) statusText.textContent = '✨ AI is analyzing speech & generating caption...';

    try {
      // Call backend AI caption generator endpoint
      const res = await fetch('/api/ai/transcribe-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          title: transcript,
          style: this.selectedStyle,
          language: lang,
          url: window.lastDownloadedVideoUrl || null,
          filePath: window.lastDownloadedFilePath || null
        })
      });

      const data = await res.json();

      if (data.success && data.caption) {
        if (outputBox) {
          outputBox.value = data.caption;
        }
        if (statusText) {
          statusText.textContent = `✅ Generated ${data.detectedType || 'smart'} caption successfully!`;
        }
      } else {
        throw new Error(data.error || 'Could not generate caption');
      }
    } catch (err) {
      console.warn('AI Caption server call failed, using client-side synthesizer:', err.message);
      // Fallback: Client-side synthesis
      const synthesized = this.synthesizeClientCaption(transcript, this.selectedStyle);
      if (outputBox) outputBox.value = synthesized;
      if (statusText) statusText.textContent = '✅ Caption generated with client engine!';
    } finally {
      if (generateBtn) generateBtn.disabled = false;
    }
  }

  /**
   * Client-Side Fallback Synthesizer
   */
  synthesizeClientCaption(text, style) {
    const raw = text || 'Special Highlight';
    const isSong = /song|music|ormakal|thammil|lyric|audio|sound|mounam|paattu/i.test(raw);
    const tags = isSong ? '#MalayalamSong #Lyrics #MusicVibes #WhatsAppStatus #Reels' : '#Viral #Trending #ExplorePage #Update';

    if (style === 'lyrical' || (style === 'smart' && isSong)) {
      return `✨ ─── ⋆⋅ 🎵 ⋅⋆ ─── ✨\n🎵 *${raw}*\n\n❝ Feel the music & lyrics 💫 ❞\n\n🎧 *Best experience with headphones* 🎧\n🥀 Share & save this status ❤️\n\n${tags}`;
    } else if (style === 'viral') {
      return `🔥 ⋆【 *${raw.toUpperCase()}* 】⋆ 🔥\n\n👀 *Watch till the very end!*\n⚡ Drop your reaction in the comments 👇\n\n${tags}`;
    } else if (style === 'speech_summary') {
      return `🎙️ *AUDIO HIGHLIGHTS: ${raw}*\n\n• Key insight & essential summary\n• High-quality sound & verified track ✅\n\n📢 Broadcast update\n\n${tags}`;
    } else if (style === 'aesthetic') {
      return `✧･ﾟ: *✧･ﾟ:*  *${raw}*  *:･ﾟ✧*:･ﾟ✧\n\n🌸 aesthetic moments & soft peace 🕊️\n\n#aesthetic #vibes #minimalism ${tags}`;
    } else {
      return `✨ *${raw}* ✨\n\n👉 Full details and update in the audio clip!\n💬 Like, Share & Subscribe 👇\n\n${tags}`;
    }
  }

  /**
   * Apply the generated caption from Studio directly to the main textarea
   */
  applyToCaption() {
    const outputBox = document.getElementById('studio-output-caption');
    const textarea = document.getElementById('caption');
    if (!outputBox || !textarea) return;

    const caption = outputBox.value.trim();
    if (!caption) {
      if (typeof toast === 'function') toast('warning', 'Please generate or write a caption first');
      return;
    }

    textarea.value = caption;
    if (window.EmojiEngine && typeof window.EmojiEngine.onCaptionInput === 'function') {
      window.EmojiEngine.onCaptionInput(textarea);
    }

    this.closeStudio();

    if (typeof toast === 'function') {
      toast('success', '🎉 Audio caption applied to broadcast message!');
    }
  }

  /**
   * Copy generated caption to clipboard
   */
  copyStudioCaption() {
    const outputBox = document.getElementById('studio-output-caption');
    if (!outputBox || !outputBox.value) return;

    navigator.clipboard.writeText(outputBox.value).then(() => {
      if (typeof toast === 'function') toast('success', '📋 Copied caption to clipboard!');
    }).catch(() => {
      outputBox.select();
      document.execCommand('copy');
      if (typeof toast === 'function') toast('success', '📋 Copied caption!');
    });
  }
}

// Global instance
window.AudioCaption = new AudioCaptionEngine();
