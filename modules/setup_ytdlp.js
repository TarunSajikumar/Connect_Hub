import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export async function ensureLatestYtDlp() {
  if (process.platform !== 'linux') {
    return 'yt-dlp';
  }

  const localBinary = path.resolve('yt-dlp');
  console.log('[Setup] Checking yt-dlp binary for Linux on Render...');

  try {
    // If binary does not exist or needs update, download official latest release
    if (!fs.existsSync(localBinary)) {
      console.log('[Setup] Downloading latest standalone yt-dlp binary from GitHub releases...');
      execSync('curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ./yt-dlp && chmod +x ./yt-dlp', { stdio: 'inherit' });
    } else {
      execSync('chmod +x ./yt-dlp', { stdio: 'inherit' });
    }

    if (fs.existsSync(path.resolve('deno'))) {
      try { execSync('chmod +x ./deno', { stdio: 'ignore' }); } catch {}
    }
    if (fs.existsSync(path.resolve('ffmpeg'))) {
      try { execSync('chmod +x ./ffmpeg', { stdio: 'ignore' }); } catch {}
    }

    const version = execSync('./yt-dlp --version').toString().trim();
    console.log(`✅ [Setup] yt-dlp ready on Linux! Version: ${version}`);
    return localBinary;
  } catch (err) {
    console.warn('[Setup] Local yt-dlp check warning:', err.message);
    return 'yt-dlp';
  }
}

