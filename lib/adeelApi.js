// RAUF × LUCIFER MD BOT 💫 — RAUF × LUCIFER MD BOT AI fallback API layer
// This module is intentionally isolated from the bot's core command logic.
// Use it only when a native/local provider is unavailable or fails.
const fetch = require('node-fetch');
const { extractText } = require('./cleanApiResponse');

const BASE = 'https://adeel-xtech-apis.vercel.app/api';
const DEFAULT_TIMEOUT = 20000;

const SPECS = {
  // GET endpoints confirmed by the user's supplied URL list. Optional arguments
  // are encoded once; endpoints that require multipart/body input are excluded.
  ytdl:['ytdl','url'], ytmp3:['ytmp3','url'], ytmp4:['ytmp4','url'],
  teraboxdl:['terabox-dl','url'], twitterdl:['twitterdl','url'],
  igdl:['igdl','url'], fbdl:['fbdl','url'], ttdl:['ttdl','url'],
  tiktokv2:['tiktok-v2','url'], ytmp4v2:['ytmp4v2','url'], spotifydl:['spotifydl','url'],
  pinterestvideo:['pinterest-video','url'], pinterestphoto:['pinterest-photo','url'],
  capcut:['capcut','url'], mediafire:['mediafire','url'], viralvideo:['viral-video'],
  sinhalasub:['sinhalasub'], aptoide:['aptoide','q'],
  web2zip:['web2zip','url'], tweet:['tweet','text'], ssweb:['ssweb','url'],
  getpastebin:['getpastebin','q'], kompasnews:['kompasnews'], detiknews:['detiknews'],
tahukahkamu:['tahukahkamu'], cuaca:['cuaca','q'],
  cekkhodam:['cekkhodam','q'], googlesearch:['googlesearch','q'],
  duckduckgo:['duckduckgo','q'], ytsearch:['ytsearch','q'],
  searchgroups:['searchgroups','q'], randommeme:['randommeme'],
  // AI features intentionally removed from this white-label build.
  translate:['translate','text'],
  qrcodegenerator:['qrcodegenerator','text'], welcomegoodbyeimage:['welcome-goodbye-image','text'],
  qc:['qc','text'], genshinbuild:['genshinbuild','q']
};

const ALIASES = { pinvid:'pinterestvideo', pinphoto:'pinterestphoto', printrest:'pinterestphoto', tiktokv2:'tiktokv2', welcome:'welcomegoodbyeimage' };

function enc(v) { return encodeURIComponent(String(v ?? '')); }
function normalizeName(name) { return ALIASES[String(name || '').toLowerCase()] || String(name || '').toLowerCase(); }
function spec(name) { return SPECS[normalizeName(name)]; }
function looksLikeUrl(v) { return typeof v === 'string' && /^https?:\/\//i.test(v); }

async function resolvePinterestShortUrl(value) {
  const raw = String(value || '').trim();
  if (!/^https?:\/\/(?:pin\.it|www\.pin\.it)\//i.test(raw)) return raw;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(raw, {
      method: 'GET', redirect: 'follow', signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; KING-OF-BOTS/1.0)', accept: 'text/html,*/*' }
    });
    // node-fetch's response.url is the final URL after redirects.
    const finalUrl = response.url || raw;
    if (response.body && typeof response.body.destroy === 'function') response.body.destroy();
    if (!response.ok) throw new Error(`Pinterest short link returned HTTP ${response.status}`);
    if (!/pinterest\.com\//i.test(finalUrl)) throw new Error('Pinterest short link did not resolve to a Pinterest pin URL');
    return finalUrl;
  } finally { clearTimeout(timer); }
}

function collectUrls(value, out = []) {
  if (!value) return out;
  if (typeof value === 'string') {
    if (looksLikeUrl(value)) out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const x of value) collectUrls(x, out);
    return out;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (/url|download|media|audio|video|image|thumbnail|img|link/i.test(k)) collectUrls(v, out);
      else if (typeof v === 'object') collectUrls(v, out);
    }
  }
  return out;
}

async function request(url) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
      let r;
      try {
        r = await fetch(url, {
          headers: { 'user-agent': 'RAUF-LAGACY-MD/1.0', accept: '*/*' },
          signal: controller.signal
        });
      } finally { clearTimeout(timer); }
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (ct.includes('image/') || ct.includes('audio/') || ct.includes('video/')) {
        return { kind: 'binary', buffer: await r.buffer(), contentType: ct };
      }
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      if (data && (data.status === false || data.success === false)) {
        throw new Error(data.message || data.error || 'API returned failure');
      }
      return { kind: 'json', data };
    } catch (e) {
      lastError = e;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 700));
    }
  }
  throw lastError || new Error('Fallback API unavailable');
}

async function call(name, arg) {
  const key = normalizeName(name);
  const s = spec(key);
  if (!s) throw new Error(`Unknown fallback API: ${name}`);
  let value = String(arg ?? '').trim();
  if (['pinterestphoto', 'pinterestvideo'].includes(key)) {
    if (!looksLikeUrl(value) || !/(^https?:\/\/)?(www\.)?(pinterest\.com|pin\.it)\//i.test(value)) {
      throw new Error('Send a valid Pinterest photo/video Pin URL (pin.it short links are supported).');
    }
    value = await resolvePinterestShortUrl(value);
  }
  if (['ytmp3', 'ytmp4', 'ytmp4v2', 'ytdl'].includes(key) && !/(youtube\.com|youtu\.be)\//i.test(value)) {
    throw new Error('Send a valid YouTube video URL.');
  }
  let url = `${BASE}/${s[0]}`;
  if (s[1] && value) url += `?${s[1]}=${enc(value)}`;
  return request(url);
}

function findBestUrl(data) {
  const urls = collectUrls(data, []).filter(u => !/^https?:\/\/i\.ytimg\.com\//i.test(u));
  return urls.find(u => /\.(mp3|m4a|mp4|webm|jpg|jpeg|png|webp)(\?|$)/i.test(u)) || urls[0];
}

function textFrom(data) { return extractText(data) || ''; }

async function send(sock, chatId, message, name, arg) {
  const key = normalizeName(name);
  const isPin = key === 'pinterestphoto' || key === 'pinterestvideo';
  if (isPin && /^https?:\/\/(www\.)?(pinterest\.[a-z.]+|pin\.it)\//i.test(String(arg || '').trim())) {
    try { return await require('./pinFallback').sendPin(sock, chatId, message, String(arg).trim(), '📍 Pinterest'); }   // direct + ffmpeg-fixed
    catch (e) { console.error('[pin] direct download failed, trying API:', e?.message || e); }
  }
  const fixVid = async (b) => { if (!isPin) return b; try { return await require('./pinFallback').normalizeVideo(b); } catch (_) { return b; } };
  const res = await call(key, arg);
  if (res.kind === 'binary') {
    const ct = res.contentType;
    const payload = ct.includes('image/')
      ? { image: res.buffer, caption: `⚡ RAUF × LUCIFER MD BOT 💫\n${key} • RAUF × LUCIFER MD BOT AI` }
      : ct.includes('audio/')
        ? { audio: res.buffer, mimetype: ct, ptt: false }
        : ct.includes('video/')
          ? { video: await fixVid(res.buffer), mimetype: isPin ? 'video/mp4' : ct, caption: `⚡ RAUF × LUCIFER MD BOT 💫\n${key} • RAUF × LUCIFER MD BOT AI` }
          : { document: res.buffer, mimetype: ct || 'application/octet-stream', fileName: `${key}-result.bin` };
    return sock.sendMessage(chatId, payload, { quoted: message });
  }

  const u = findBestUrl(res.data);
  // Some providers return signed CDN URLs without a file extension. Infer the
  // expected media family from the endpoint, then verify the actual response.
  const family = /photo|pinterestphoto|removebg|imgtourl/i.test(key) ? 'image'
    : /video|ytmp4|ytdl|igdl|fbdl|ttdl|tiktokv2|teraboxdl|capcut|mediafire|twitterdl|pinterestvideo/i.test(key) ? 'video'
    : /ytmp3|spotifydl/i.test(key) ? 'audio' : '';
  if (u && family) {
    try {
      const media = await request(u);
      if (media.kind === 'binary') {
        const ct = media.contentType || '';
        if (ct.includes('image/')) return sock.sendMessage(chatId, { image: media.buffer, caption: `⚡ RAUF × LUCIFER MD BOT 💫\n${key}` }, { quoted: message });
        if (ct.includes('audio/')) return sock.sendMessage(chatId, { audio: media.buffer, mimetype: ct, ptt: false }, { quoted: message });
        if (ct.includes('video/')) return sock.sendMessage(chatId, { video: await fixVid(media.buffer), mimetype: isPin ? 'video/mp4' : ct, caption: `⚡ RAUF × LUCIFER MD BOT 💫\n${key}` }, { quoted: message });
      }
    } catch (e) {
      // If the endpoint returns a signed URL with no extension and HEAD/GET
      // verification fails, preserve the URL as diagnostic output below.
    }
    if (family === 'image') return sock.sendMessage(chatId, { image: { url: u }, caption: `⚡ RAUF × LUCIFER MD BOT 💫\n${key}` }, { quoted: message });
    if (family === 'audio') return sock.sendMessage(chatId, { audio: { url: u }, mimetype: 'audio/mpeg', ptt: false }, { quoted: message });
    if (family === 'video') return sock.sendMessage(chatId, { video: { url: u }, caption: `⚡ RAUF × LUCIFER MD BOT 💫\n${key}` }, { quoted: message });
  }
  if (u && /\.(mp3|m4a)(\?|$)/i.test(u)) return sock.sendMessage(chatId, { audio: { url: u }, mimetype: 'audio/mpeg' }, { quoted: message });
  if (u && /\.(mp4|webm|mov)(\?|$)/i.test(u)) return sock.sendMessage(chatId, { video: { url: u }, caption: `⚡ RAUF × LUCIFER MD BOT 💫\n${key} • fallback` }, { quoted: message });
  if (u && /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(u)) return sock.sendMessage(chatId, { image: { url: u }, caption: `⚡ RAUF × LUCIFER MD BOT 💫\n${key} • fallback` }, { quoted: message });
  const answer = textFrom(res.data);
  if (!answer) throw new Error('API returned no readable answer or media URL (raw response suppressed).');
  return sock.sendMessage(chatId, { text: `⚡ RAUF × LUCIFER MD BOT 💫\n\n${answer.slice(0, 6500)}` }, { quoted: message });
}
module.exports = { SPECS, ALIASES, call, send, normalizeName, resolvePinterestShortUrl };
