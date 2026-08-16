import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('[Build Setup] Checking environment and yt-dlp binary...');

if (process.platform === 'linux') {
  try {
    console.log('[Build Setup] Downloading official latest yt-dlp binary for Linux...');
    execSync('curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ./yt-dlp', { stdio: 'inherit' });
    execSync('chmod +x ./yt-dlp', { stdio: 'inherit' });
    const ver = execSync('./yt-dlp --version').toString().trim();
    console.log(`✅ [Build Setup] Successfully installed latest yt-dlp (${ver}) on Linux!`);
  } catch (e) {
    console.error('[Build Setup] Error installing yt-dlp:', e.message);
  }
} else {
  console.log('[Build Setup] Running on', process.platform, '- using local yt-dlp');
}
