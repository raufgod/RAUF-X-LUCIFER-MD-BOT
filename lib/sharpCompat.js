'use strict';
// RAUF × LUCIFER MD BOT by RAUF × LUCIFER — "sharp" compatibility layer.
// Uses the real `sharp` when it is installed (optional dependency). On hosts where its native
// libvips build fails, the same small API subset is served through ffmpeg so the bot still starts.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

let realSharp = null;
try { realSharp = require('sharp'); } catch (_) { realSharp = null; }

function ffmpegBin() {
  try { const p = require('ffmpeg-static'); if (p) return p; } catch (_) {}
  return 'ffmpeg';
}

function run(args) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegBin(), ['-y', '-loglevel', 'error', ...args], { timeout: 60000 }, (err, _o, stderr) => {
      if (err) reject(new Error(`ffmpeg failed: ${String(stderr || err.message).slice(0, 200)}`)); else resolve();
    });
  });
}

class FfmpegImage {
  constructor(input) { this.input = input; this.filters = []; this.format = null; this.quality = null; }
  resize(w, h, opts = {}) {
    const inside = opts.fit === 'inside';
    const noEnlarge = opts.withoutEnlargement;
    if (inside) {
      const W = noEnlarge ? `min(${w},iw)` : `${w}`, H = noEnlarge ? `min(${h},ih)` : `${h}`;
      this.filters.push(`scale='min(${W},iw*${H}/ih)':'min(${H},ih*${W}/iw)':force_original_aspect_ratio=decrease`);
    } else this.filters.push(`scale=${w}:${h}`);
    return this;
  }
  jpeg(o = {}) { this.format = 'jpg'; this.quality = o.quality || 80; return this; }
  png() { this.format = 'png'; return this; }
  webp() { this.format = 'webp'; return this; }
  toFormat(f) { this.format = String(f).toLowerCase() === 'jpeg' ? 'jpg' : String(f).toLowerCase(); return this; }
  blur(sigma = 10) { this.filters.push(`gblur=sigma=${Math.max(0.5, Number(sigma) || 10)}`); return this; }
  async _exec(outPath) {
    const tmp = [];
    let inPath = this.input;
    if (Buffer.isBuffer(this.input)) {
      inPath = path.join(os.tmpdir(), `kob_in_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      fs.writeFileSync(inPath, this.input); tmp.push(inPath);
    }
    const args = ['-i', inPath, '-frames:v', '1'];
    if (this.filters.length) args.push('-vf', this.filters.join(','));
    if (this.format === 'jpg') args.push('-q:v', String(Math.max(2, Math.round((100 - this.quality) / 4) + 2)));
    args.push(outPath);
    try { await run(args); } finally { for (const f of tmp) try { fs.unlinkSync(f); } catch (_) {} }
  }
  async toFile(outPath) { await this._exec(outPath); return { size: fs.statSync(outPath).size }; }
  async toBuffer() {
    const ext = this.format || 'png';
    const out = path.join(os.tmpdir(), `kob_out_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
    try { await this._exec(out); return fs.readFileSync(out); } finally { try { fs.unlinkSync(out); } catch (_) {} }
  }
}

function sharp(input, options) { return realSharp ? realSharp(input, options) : new FfmpegImage(input); }
sharp.isNative = !!realSharp;
module.exports = sharp;
