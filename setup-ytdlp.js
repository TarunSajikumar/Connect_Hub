import fs from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function downloadYtDlp() {
  const isLinux = process.platform === 'linux';
  const isWin = process.platform === 'win32';
  const targetName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
  const targetPath = path.join(__dirname, targetName);

  // If already exists and size > 1MB, skip
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 1000000) {
    console.log(`[setup-ytdlp] ${targetName} already exists and ready.`);
    return;
  }

  const binaryUrl = isWin
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

  console.log(`[setup-ytdlp] Downloading ${targetName} from ${binaryUrl}...`);

  // Try curl first
  try {
    execSync(`curl -L "${binaryUrl}" -o "${targetPath}"`, { stdio: 'inherit' });
    if (!isWin) {
      execSync(`chmod +x "${targetPath}"`, { stdio: 'inherit' });
    }
    console.log(`[setup-ytdlp] Successfully downloaded and set permissions for ${targetName}`);
    return;
  } catch (err) {
    console.log(`[setup-ytdlp] curl failed, using Node https stream...`);
  }

  // Fallback to pure Node https download with redirect following
  function fetchBinary(url, dest, resolve, reject) {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBinary(res.headers.location, dest, resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed with HTTP status ${res.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          if (!isWin) {
            try { fs.chmodSync(dest, 0o755); } catch(e) {}
          }
          resolve();
        });
      });
      file.on('error', reject);
    }).on('error', reject);
  }

  await new Promise((resolve, reject) => {
    fetchBinary(binaryUrl, targetPath, resolve, reject);
  });

  console.log(`[setup-ytdlp] Download complete: ${targetPath}`);
}

downloadYtDlp().catch(err => {
  console.warn('[setup-ytdlp] Setup note:', err.message);
});
