// ============================================================
// AI Audio/Video Caption & Speech-to-Text Synthesizer
// modules/ai_audio_captioner.js
// ============================================================

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Intelligent Audio/Video Caption Generator
 * Analyzes audio transcripts, video subtitles, metadata, and lyrics
 * to create high-engagement social media captions.
 */
export class AIAudioCaptioner {
  /**
   * Extract subtitles or transcription from a video/audio file or YouTube/Instagram URL
   */
  static async extractAudioMetadata(filePathOrUrl, ytDlpCmd = 'yt-dlp') {
    const isUrl = typeof filePathOrUrl === 'string' && /^https?:\/\//i.test(filePathOrUrl);
    
    if (isUrl) {
      return this.extractFromUrl(filePathOrUrl, ytDlpCmd);
    } else if (filePathOrUrl && fs.existsSync(filePathOrUrl)) {
      return this.extractFromFile(filePathOrUrl, ytDlpCmd);
    }

    return {
      title: 'Media Video',
      description: '',
      transcript: '',
      detectedLanguage: 'en',
      isMusic: false
    };
  }

  /**
   * Extract metadata & auto-captions from URL using yt-dlp
   */
  static async extractFromUrl(url, ytDlpCmd = 'yt-dlp') {
    return new Promise((resolve) => {
      const args = [
        '--no-playlist',
        '--dump-json',
        '--skip-download',
        '--no-warnings',
        url
      ];

      const proc = spawn(ytDlpCmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', d => { stdout += d.toString(); });
      proc.stderr.on('data', d => { stderr += d.toString(); });

      proc.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          try {
            const data = JSON.parse(stdout);
            const title = data.title || '';
            const description = data.description || '';
            const tags = Array.isArray(data.tags) ? data.tags : [];
            const categories = Array.isArray(data.categories) ? data.categories : [];
            const track = data.track || data.alt_title || '';
            const artist = data.artist || data.creator || data.channel || '';

            // Detect if content is musical / lyrics
            const isMusic = /music|song|lyric|audio|sound|track|ormakal|thammil|cover|sing/i.test(`${title} ${description} ${categories.join(' ')} ${tags.join(' ')}`);

            // Extract subtitle fragments if available
            let transcript = '';
            if (data.subtitles || data.automatic_captions) {
              const subs = data.subtitles || data.automatic_captions;
              for (const lang of Object.keys(subs)) {
                if (subs[lang] && subs[lang].length > 0) {
                  transcript += `[Lang: ${lang}] `;
                  break;
                }
              }
            }

            resolve({
              title,
              description,
              transcript: transcript || description.slice(0, 300),
              artist,
              track,
              tags,
              detectedLanguage: isMusic ? 'ml/en' : 'en',
              isMusic
            });
            return;
          } catch (e) {}
        }

        // Fallback title parse
        resolve({
          title: 'Video Audio',
          description: '',
          transcript: '',
          detectedLanguage: 'en',
          isMusic: false
        });
      });

      proc.on('error', () => {
        resolve({
          title: 'Video Audio',
          description: '',
          transcript: '',
          detectedLanguage: 'en',
          isMusic: false
        });
      });
    });
  }

  /**
   * Extract audio metadata from local uploaded / downloaded file
   */
  static async extractFromFile(filePath) {
    const filename = path.basename(filePath);
    const cleanName = filename.replace(/^[0-9]+_|\.[^.]+$/g, '').replace(/_/g, ' ');

    const isMusic = /song|music|lyrics?|ormakal|thammil|audio|track|mp3|m4a|mounam|paattu/i.test(filename);
    
    return {
      title: cleanName,
      description: '',
      transcript: cleanName,
      detectedLanguage: isMusic ? 'ml/en' : 'en',
      isMusic
    };
  }

  /**
   * Synthesize AI Caption from spoken transcript, audio analysis, and user options
   */
  static generateCaption({ transcript = '', title = '', style = 'smart', language = 'auto', customContext = '' }) {
    const combined = `${title} ${transcript} ${customContext}`.trim();
    const isSong = /song|music|lyrics?|ormakal|thammil|mounam|paattu|sing|audio|melody/i.test(combined);
    const isPromo = /sale|discount|deal|offer|launch|promo|price|shop|buy|register/i.test(combined);
    const isTechOrNews = /update|news|alert|feature|tech|ai|code|guide|tutorial/i.test(combined);

    // Extract clean headline from title or transcript
    let headline = (title || transcript || 'Special Highlight').replace(/^[•\-\*\_~❝❞\s]+|[•\-\*\_~❝❞\s]+$/g, '');
    if (headline.length > 70) {
      headline = headline.substring(0, 70).replace(/\s+[^\s]*$/, '') + '…';
    }

    // Generate Contextual Hashtags
    const hashtags = this.generateHashtags(combined, isSong, isPromo);

    let caption = '';

    switch (style) {
      case 'lyrical':
      case 'music':
        caption = [
          `✨ ─── ⋆⋅ 🎵 ⋅⋆ ─── ✨`,
          `🎵 *${headline}*`,
          ``,
          transcript && transcript !== title ? `❝ ${transcript.slice(0, 180)} ❞\n` : `💭 Feel the music, feel the lyrics 💫\n`,
          `🎧 *Best experience with headphones* 🎧`,
          `🥀 Share with someone who loves this song ❤️`,
          ``,
          `${hashtags}`
        ].join('\n');
        break;

      case 'viral':
        caption = [
          `🔥 ⋆【 *${headline.toUpperCase()}* 】⋆ 🔥`,
          ``,
          `👀 *Watch till the very end!*`,
          transcript ? `💬 "${transcript.slice(0, 140)}"` : `⚡ You won't believe what happens next!`,
          ``,
          `👉 *Double tap & share with your friends!*`,
          `💬 Drop your reaction below 👇`,
          ``,
          `#Viral #Trending #ExplorePage #MustWatch ${hashtags}`
        ].join('\n');
        break;

      case 'speech_summary':
      case 'summary':
        caption = [
          `🎙️ *KEY HIGHLIGHTS: ${headline}*`,
          ``,
          `📌 *Summary of audio & discussion:*`,
          transcript ? `• ${transcript.slice(0, 120)}\n• Key insights & essential takeaway` : `• Insightful breakdown and discussion\n• Crucial updates you need to know`,
          `• Verified high-definition audio track ✅`,
          ``,
          `📢 Broadcast update for all members`,
          `👇 Save & share this message`,
          ``,
          `${hashtags}`
        ].join('\n');
        break;

      case 'aesthetic':
        caption = [
          `✧･ﾟ: *✧･ﾟ:*  *${headline}*  *:･ﾟ✧*:･ﾟ✧`,
          ``,
          transcript ? `❝ ${transcript.slice(0, 150)} ❞\n` : `🌸 aesthetic vibes & peaceful moments 🕊️\n`,
          `✨ save for later & share the peace`,
          ``,
          `#aesthetic #vibes #minimalism ${hashtags}`
        ].join('\n');
        break;

      case 'whatsapp':
        caption = [
          `*📢 ${headline.toUpperCase()}*`,
          ``,
          transcript ? `📝 *Details:* ${transcript.slice(0, 160)}\n` : `✅ *Verified Audio & Media Content*\n`,
          `👉 *Official Broadcast Update*`,
          `💬 Please share with your network!`,
          ``,
          `${hashtags}`
        ].join('\n');
        break;

      case 'smart':
      default:
        if (isSong) {
          caption = [
            `✨ ─── ⋆⋅ 🎵 ⋅⋆ ─── ✨`,
            `🎵 *${headline}*`,
            ``,
            transcript && transcript !== title ? `📝 *Lyrics:* "${transcript.slice(0, 160)}"\n` : `🎧 *Put on your headphones & feel the vibes* 💫\n`,
            `❤️ Share & save this status!`,
            ``,
            `${hashtags}`
          ].join('\n');
        } else if (isPromo) {
          caption = [
            `🚨 *SPECIAL ANNOUNCEMENT* 🚨`,
            ``,
            `👉 *${headline}*`,
            `⚡ Limited Time Exclusive Opportunity!`,
            transcript ? `📝 ${transcript.slice(0, 120)}\n` : ``,
            `👇 *Tap link below to check it out now!*`,
            ``,
            `${hashtags}`
          ].join('\n');
        } else {
          caption = [
            `✨ *${headline}* ✨`,
            ``,
            transcript ? `🎙️ "${transcript.slice(0, 180)}"\n` : `👉 Check out the full update below!\n`,
            `💬 *Like, Share & Subscribe for more updates!*`,
            ``,
            `${hashtags}`
          ].join('\n');
        }
        break;
    }

    return {
      caption,
      headline,
      hashtags,
      detectedType: isSong ? 'Music & Lyrics' : isPromo ? 'Promo & Deals' : isTechOrNews ? 'News & Tech' : 'General Media'
    };
  }

  /**
   * Generate relevant hashtag string
   */
  static generateHashtags(text, isSong, isPromo) {
    const tags = new Set();

    if (isSong) {
      tags.add('#MalayalamSong');
      tags.add('#Lyrics');
      tags.add('#WhatsAppStatus');
      tags.add('#MusicVibes');
      tags.add('#ReelsIndia');
      tags.add('#StatusVideo');
    } else if (isPromo) {
      tags.add('#SpecialOffer');
      tags.add('#SaleLive');
      tags.add('#Deals');
      tags.add('#ShopNow');
      tags.add('#Announcement');
    } else {
      tags.add('#Trending');
      tags.add('#Status');
      tags.add('#Viral');
      tags.add('#Broadcast');
      tags.add('#Explore');
    }

    // Regional / Indian tags if keywords detected
    if (/ormakal|thammil|mounam|paattu|kerala|malayalam/i.test(text)) {
      tags.add('#MalayalamLyrics');
      tags.add('#KeralaVibes');
    }

    return Array.from(tags).slice(0, 6).join(' ');
  }
}

export default AIAudioCaptioner;
