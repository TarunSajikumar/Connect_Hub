import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('[Build Setup] Checking environment, yt-dlp, and ffmpeg binaries...');

if (process.platform === 'linux') {
  // 1. Download official latest yt-dlp standalone binary
  try {
    console.log('[Build Setup] Downloading official latest yt-dlp binary for Linux...');
    execSync('curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ./yt-dlp', { stdio: 'inherit' });
    execSync('chmod +x ./yt-dlp', { stdio: 'inherit' });
    const ver = execSync('./yt-dlp --version').toString().trim();
    console.log(`✅ [Build Setup] Successfully installed latest yt-dlp (v${ver}) on Linux!`);
  } catch (e) {
    console.error('[Build Setup] Error installing yt-dlp:', e.message);
  }

  // 2. Download standalone static ffmpeg binary for Linux if not present
  try {
    let hasSystemFfmpeg = false;
    try {
      execSync('ffmpeg -version', { stdio: 'ignore' });
      hasSystemFfmpeg = true;
      console.log('✅ [Build Setup] System ffmpeg is already available.');
    } catch {}

    if (!hasSystemFfmpeg && !fs.existsSync('./ffmpeg')) {
      console.log('[Build Setup] Downloading static ffmpeg binary for Linux...');
      execSync('curl -L https://github.com/eugeneware/ffmpeg-static/releases/latest/download/ffmpeg-linux-x64 -o ./ffmpeg', { stdio: 'inherit' });
      execSync('chmod +x ./ffmpeg', { stdio: 'inherit' });
      console.log('✅ [Build Setup] Successfully installed static ffmpeg on Linux!');
    }
  } catch (e) {
    console.warn('[Build Setup] Notice: Could not download static ffmpeg:', e.message);
  }
} else {
  console.log('[Build Setup] Running on', process.platform, '- using local environment binaries');
}

