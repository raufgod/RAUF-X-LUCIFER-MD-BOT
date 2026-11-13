'use strict';
// Cloudflare Tunnel runner - gives the website your own domain on a panel (no ngrok, no open port needed).
// 1. Cloudflare Zero Trust > Networks > Tunnels > Create tunnel, copy the TOKEN (the long text starting with eyJ...).
// 2. Put it in .env:   CLOUDFLARE_TUNNEL_TOKEN=eyJ...      (or in a file cloudflared.txt, first line)
// 3. In the tunnel's "Public hostname" add:  yourdomain.com  ->  HTTP  ->  localhost:<bot port>
// The bot downloads the cloudflared program by itself (Linux) and keeps it running.
const fs = require('fs'), path = require('path'), https = require('https'), os = require('os'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const BIN_DIR = path.join(ROOT, 'bin');
const BIN = path.join(BIN_DIR, process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');

function token() {
  let t = String(process.env.CLOUDFLARE_TUNNEL_TOKEN || '').trim();
  if (!t) { try { t = fs.readFileSync(path.join(ROOT, 'cloudflared.txt'), 'utf8').split(/\r?\n/)[0].trim(); } catch (_) {} }
  t = t.replace(/^.*service install\s+/i, '').replace(/^.*--token\s+/i, '').trim();   // allows pasting the whole command Cloudflare shows
  return t;
}
function assetName() {
  const a = os.arch(), p = process.platform;
  if (p === 'linux') return a === 'arm64' ? 'cloudflared-linux-arm64' : a === 'arm' ? 'cloudflared-linux-arm' : a === 'ia32' ? 'cloudflared-linux-386' : 'cloudflared-linux-amd64';
  if (p === 'win32') return 'cloudflared-windows-amd64.exe';
  if (p === 'darwin') return a === 'arm64' ? 'cloudflared-darwin-arm64.tgz' : 'cloudflared-darwin-amd64.tgz';
  return null;
}
function download(url, dest, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 6) return reject(new Error('too many redirects'));
    https.get(url, { headers: { 'User-Agent': 'rauf-bot' } }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return resolve(download(new URL(r.headers.location, url).toString(), dest, hops + 1)); }
      if (r.statusCode !== 200) { r.resume(); return reject(new Error('HTTP ' + r.statusCode)); }
      const tmp = dest + '.part', f = fs.createWriteStream(tmp);
      r.pipe(f); f.on('finish', () => f.close(() => { fs.renameSync(tmp, dest); resolve(); })); f.on('error', reject);
    }).on('error', reject);
  });
}
async function ensureBinary() {
  if (fs.existsSync(BIN)) return BIN;
  const name = assetName(); if (!name || name.endsWith('.tgz')) throw new Error('unsupported system - install cloudflared yourself');
  fs.mkdirSync(BIN_DIR, { recursive: true });
  console.log('[cloudflare] downloading cloudflared (one time)…');
  await download('https://github.com/cloudflare/cloudflared/releases/latest/download/' + name, BIN);
  fs.chmodSync(BIN, 0o755);
  return BIN;
}

let child = null, stopped = false, tries = 0;
function run(bin, tk) {
  child = cp.spawn(bin, ['tunnel', '--no-autoupdate', 'run', '--token', tk], { stdio: ['ignore', 'pipe', 'pipe'] });
  let up = false;
  const feed = (b) => { const s = String(b); if (!up && /Registered tunnel connection/i.test(s)) { up = true; tries = 0; console.log('☁️  Cloudflare Tunnel connected - your domain is live'); }
    if (/error|failed|unauthorized/i.test(s) && !/Registered/i.test(s)) console.log('[cloudflare] ' + s.replace(tk, '***').trim().slice(0, 200)); };
  child.stdout.on('data', feed); child.stderr.on('data', feed);
  child.on('error', (e) => console.error('[cloudflare] cannot start:', e.message));
  child.on('exit', (code) => { if (stopped) return; tries++; const wait = Math.min(60, 5 * tries); console.log(`[cloudflare] tunnel stopped (code ${code}), restarting in ${wait}s`); setTimeout(() => run(bin, tk), wait * 1000); });
}
async function start() {
  const tk = token(); if (!tk) return false;
  try { const bin = await ensureBinary(); run(bin, tk); return true; }
  catch (e) { console.error('[cloudflare] could not start the tunnel:', e.message); return false; }
}
process.on('exit', () => { stopped = true; try { child && child.kill(); } catch (_) {} });
module.exports = { start, token };
