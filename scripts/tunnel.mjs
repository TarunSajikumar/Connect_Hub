import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const binary = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
const binPath = path.join(rootDir, binary);

if (!fs.existsSync(binPath)) {
  console.error(`❌ ${binary} not found in ${rootDir}. Run 'winget install Cloudflare.cloudflared' or download cloudflared.`);
  process.exit(1);
}

console.log('='.repeat(60));
console.log('  🌐 STARTING CLOUDFLARE SECURE TUNNEL FOR SOCIAL HUB');
console.log('  📍 Target: http://localhost:4000');
console.log('='.repeat(60));

const proc = spawn(binPath, ['tunnel', '--url', 'http://localhost:4000'], {
  stdio: ['ignore', 'pipe', 'pipe']
});

let tunnelUrl = null;

function processOutput(data) {
  const text = data.toString();
  const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match && !tunnelUrl) {
    tunnelUrl = match[0];
    console.log('\n' + '='.repeat(60));
    console.log('  🚀 YOUR SOCIAL HUB IS LIVE WORLDWIDE:');
    console.log(`  🔗 ${tunnelUrl}`);
    console.log('='.repeat(60));
    console.log('  ✅ Share or open this link on your phone from ANYWHERE');
    console.log('  ✅ 100% Zero-Cookie YouTube & Instagram downloading');
    console.log('  ✅ Uses your local residential IP (never blocked)');
    console.log('='.repeat(60) + '\n');
  }
}

proc.stdout.on('data', processOutput);
proc.stderr.on('data', processOutput);

proc.on('close', code => {
  console.log(`\n[Tunnel] Closed with code ${code}`);
});

process.on('SIGINT', () => {
  proc.kill();
  process.exit(0);
});
