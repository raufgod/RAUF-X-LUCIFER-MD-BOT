'use strict';
// Pinterest photo/video straight from the pin page (no third-party API).
// Videos are ALWAYS converted to a WhatsApp-safe MP4 (H.264 + AAC, yuv420p, faststart) with ffmpeg,
// so the "This video is not available because something is wrong with the video file" error cannot happen.
// HLS (.m3u8) pin videos are downloaded + converted by ffmpeg as well. Photos are re-encoded to JPEG.
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const H = { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' };

const meta = (html, prop) => {
  const a = html.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + prop + '["\'][^>]+content=["\']([^"\']+)', 'i'));
  const b = html.match(new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']' + prop + '["\']', 'i'));
  const v = (a || b || [])[1]; return v ? v.replace(/&amp;/g, '&') : null;
};
const clean = (u) => String(u || '').replace(/\\u002F/gi, '/').replace(/\\\//g, '/').replace(/\\u0026/gi, '&').replace(/&amp;/g, '&');

function ffmpegBin() { try { const p = require('ffmpeg-static'); if (p && fs.existsSync(p)) return p; } catch (_) {} return 'ffmpeg'; }
function run(args, timeout = 180000) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegBin(), args, { timeout, maxBuffer: 1 << 26 }, (err, _o, stderr) => err ? reject(new Error('ffmpeg: ' + String(stderr || err.message).split('\n').slice(-3).join(' ').slice(0, 300))) : resolve());
  });
}
const tmpFile = (ext) => path.join(os.tmpdir(), `pin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
const rm = (...f) => f.forEach((x) => { try { fs.unlinkSync(x); } catch (_) {} });

async function grab(url, max) {
  const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000, maxContentLength: max, headers: { 'User-Agent': UA, Referer: 'https://www.pinterest.com/' }, validateStatus: (s) => s >= 200 && s < 300 });
  return Buffer.from(r.data);
}

/** Convert ANY video (Buffer, or an http(s)/m3u8 URL string) into a WhatsApp-safe MP4 Buffer. */
async function normalizeVideo(input) {
  const out = tmpFile('mp4');
  let inp = null;
  try {
    let src = input;
    if (Buffer.isBuffer(input)) { inp = tmpFile('bin'); fs.writeFileSync(inp, input); src = inp; }
    const pre = /^https?:/i.test(String(src)) ? ['-user_agent', UA, '-headers', 'Referer: https://www.pinterest.com/\r\n'] : [];
    await run(['-y', ...pre, '-i', src,
      '-map', '0:v:0', '-map', '0:a:0?',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out]);
    const buf = fs.readFileSync(out);
    if (buf.length < 1500) throw new Error('converted video is empty');
    return buf;
  } finally { rm(out); if (inp) rm(inp); }
}

/** Convert any image (webp/png/jpg/…) into a normal JPEG so it always opens. Falls back to the original. */
async function normalizeImage(buf) {
  try { const sharp = require('sharp'); return await sharp(buf).rotate().jpeg({ quality: 92 }).toBuffer(); }
  catch (_) {
    try { const o = tmpFile('jpg'), i = tmpFile('img'); fs.writeFileSync(i, buf); await run(['-y', '-i', i, '-frames:v', '1', '-q:v', '2', o]); const r = fs.readFileSync(o); rm(i, o); return r; }
    catch (_2) { return buf; }
  }
}

const isMp4 = (b) => b && b.length > 12 && b.slice(4, 8).toString() === 'ftyp';
const isText = (b) => b && b.length > 0 && /^\s*(#EXTM3U|<)/.test(b.slice(0, 20).toString());

/** All video URLs found on the pin page, best first (direct mp4 before HLS). */
function videoCandidates(html) {
  const mp4 = [], hls = [];
  const push = (u) => { u = clean(u); if (!/^https?:/i.test(u)) return; (/\.m3u8(\?|$)/i.test(u) ? hls : /\.mp4(\?|$)/i.test(u) ? mp4 : []).push(u); };
  const og = meta(html, 'og:video') || meta(html, 'og:video:url') || meta(html, 'og:video:secure_url'); if (og) push(og);
  // video_list: "V_720P":{"url":"https://v1.pinimg.com/....mp4", ...}
  const order = ['V_720P', 'V_EXP7', 'V_EXP6', 'V_EXP5', 'V_480P', 'V_EXP4', 'V_EXP3', 'V_HLSV4', 'V_HLSV3_WEB', 'V_HLSV3_MOBILE'];
  const found = {};
  for (const m of html.matchAll(/"(V_[A-Z0-9_]+)"\s*:\s*\{[^{}]*?"url"\s*:\s*"(https?:[^"]+)"/g)) found[m[1]] = m[2];
  for (const k of order) if (found[k]) push(found[k]);
  for (const k of Object.keys(found)) push(found[k]);
  for (const m of html.matchAll(/"url"\s*:\s*"(https?:[^"]+?\.(?:mp4|m3u8)[^"]*)"/gi)) push(m[1]);
  return [...new Set([...mp4, ...hls])];
}

async function fetchPinMedia(pinUrl) {
  const r = await axios.get(pinUrl, { headers: H, maxRedirects: 8, timeout: 25000, validateStatus: (s) => s < 400 });
  const html = String(r.data || '');

  for (const v of videoCandidates(html).slice(0, 6)) {
    try {
      if (/\.m3u8(\?|$)/i.test(v)) return { type: 'video', buffer: await normalizeVideo(v) };   // HLS: ffmpeg downloads + converts
      const raw = await grab(v, 150e6);
      if (isText(raw)) { try { return { type: 'video', buffer: await normalizeVideo(v) }; } catch (_) { continue; } }   // it was a playlist, not a video
      return { type: 'video', buffer: await normalizeVideo(raw) };
    } catch (e) { console.error('[pin] video candidate failed:', e?.message || e); }
  }

  const base = meta(html, 'og:image') || clean((html.match(/"url"\s*:\s*"(https:\/\/i\.pinimg\.com\/[^"]+)"/i) || [])[1]);
  if (!base) throw new Error('no media found');
  const tries = [base.replace(/\/(?:\d+x\d*|originals)\//, '/originals/'), base.replace(/\/\d+x\d*\//, '/736x/'), base];
  for (const u of [...new Set(tries)]) {
    try { const b = await grab(u, 40e6); if (b.length > 2000 && !isText(b)) return { type: 'image', buffer: await normalizeImage(b) }; } catch (_) {}
  }
  throw new Error('image download failed');
}

/** Download a pin and send it as a normal playable video / photo. */
async function sendPin(sock, chatId, message, pinUrl, caption = '📍 Pinterest') {
  const media = await fetchPinMedia(String(pinUrl).trim());
  const payload = media.type === 'video'
    ? { video: media.buffer, mimetype: 'video/mp4', caption }
    : { image: media.buffer, mimetype: 'image/jpeg', caption };
  return sock.sendMessage(chatId, payload, { quoted: message });
}

module.exports = { fetchPinMedia, sendPin, normalizeVideo, normalizeImage };
