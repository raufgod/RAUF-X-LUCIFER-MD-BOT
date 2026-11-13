'use strict';
// Text -> WhatsApp voice note (ogg/opus). Engine 1: Microsoft Edge neural voice (free, natural Hindi, package "msedge-tts").
// Engine 2 (automatic fallback): Google TTS (package google-tts-api, already in the bot). ffmpeg converts to the opus format WhatsApp wants.
const { spawn } = require('child_process');
const env = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);
let override = null; const setEngine = (fn) => { override = fn; };

const MAX_CHARS = 1500;
// Female neural voices (Microsoft Edge). Override one with TTS_VOICE (Hindi agent) or pass opts.voice.
const VOICES = { hi: 'hi-IN-SwaraNeural', en: 'en-IN-NeerjaNeural', bn: 'bn-IN-TanishaaNeural', ja: 'ja-JP-NanamiNeural', ko: 'ko-KR-SunHiNeural', zh: 'zh-CN-XiaoxiaoNeural', id: 'id-ID-GadisNeural', ur: 'ur-PK-UzmaNeural', ar: 'ar-SA-ZariyahNeural' };
const GOOGLE_LANG = { hi: 'hi', en: 'en', bn: 'bn', ja: 'ja', ko: 'ko', zh: 'zh-TW', id: 'id', ur: 'ur', ar: 'ar' };
function voiceFor(lang) { return (lang === 'hi' && process.env.TTS_VOICE) || VOICES[lang] || VOICES.hi; }
// Reads Hindi-style: ".menu" becomes "डॉट menu", "AI" becomes "ए आई". Other languages only get cleaned.
function speakable(t, lang) {
  let s = String(t || '').replace(/https?:\/\/\S+/g, '');
  if (!lang || lang === 'hi') s = s.replace(/(^|[\s(])\.([a-z][a-z0-9]{1,})/gi, '$1डॉट $2').replace(/\bAI\b/g, 'ए आई').replace(/\bWhatsApp\b/gi, 'व्हाट्सऐप').replace(/\bSTOP\b/g, 'स्टॉप');
  return s.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
}
function collect(stream, ms = 30000) {
  return new Promise((res, rej) => { const b = []; const t = setTimeout(() => rej(new Error('TTS timeout')), ms); stream.on('data', d => b.push(d)); stream.on('end', () => { clearTimeout(t); res(Buffer.concat(b)); }); stream.on('error', e => { clearTimeout(t); rej(e); }); });
}
// msedge-tts >= 2 is an ES module, so it is loaded with import() (works from this CommonJS file). WEBM/Opus is the format its docs show; ffmpeg converts it.
async function edgeAudio(text, lang) {
  const mod = await import('msedge-tts'), lib = mod.MsEdgeTTS ? mod : (mod.default || {});
  const { MsEdgeTTS, OUTPUT_FORMAT } = lib; if (!MsEdgeTTS) throw new Error('msedge-tts is not installed (npm i msedge-tts)');
  const t = new MsEdgeTTS(); await t.setMetadata(voiceFor(lang), OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS || OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  // A slightly slower, calm pace sounds far more human than the default fast read. TTS_RATE (e.g. -8%) / TTS_PITCH (e.g. +2Hz) can be tuned in .env; TTS_RATE=0% turns it off.
  const rate = env('TTS_RATE', '-6%'), pitch = env('TTS_PITCH', ''), prosody = {}; if (rate && rate !== '0%') prosody.rate = rate; if (pitch) prosody.pitch = pitch;
  let b;
  try { const r = t.toStream(text, prosody); b = await collect(r.audioStream || r); } catch (e) { if (!Object.keys(prosody).length) throw e; const r2 = t.toStream(text); b = await collect(r2.audioStream || r2); }
  if (b.length < 500) throw new Error('empty audio'); return b;
}
async function googleMp3(text, lang) {
  const tts = require('google-tts-api');
  const urls = tts.getAllAudioUrls(text, { lang: GOOGLE_LANG[lang] || 'hi', slow: false, host: 'https://translate.google.com', splitPunct: '।,.?!' });
  const parts = []; for (const u of urls) { const r = await fetch(u.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error('google tts ' + r.status); parts.push(Buffer.from(await r.arrayBuffer())); }
  return Buffer.concat(parts);
}
function ffmpegPath() { if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH; try { return require('ffmpeg-static') || 'ffmpeg'; } catch (_) { return 'ffmpeg'; } }
function toOpus(input) {
  return new Promise((res, rej) => {
    const p = spawn(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-vn', '-af', 'highpass=f=70,acompressor=threshold=0.125:ratio=2.5:attack=8:release=120:makeup=1.4,alimiter=limit=0.95', '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '40k', '-application', 'voip', '-f', 'ogg', 'pipe:1']);
    const out = [], err = []; const t = setTimeout(() => { p.kill('SIGKILL'); rej(new Error('ffmpeg timeout')); }, 30000);
    p.stdout.on('data', d => out.push(d)); p.stderr.on('data', d => err.push(d)); p.on('error', e => { clearTimeout(t); rej(e); });
    p.on('close', c => { clearTimeout(t); const b = Buffer.concat(out); c === 0 && b.length > 200 ? res(b) : rej(new Error('ffmpeg failed: ' + Buffer.concat(err).toString().slice(0, 150))); });
    p.stdin.on('error', () => {}); p.stdin.end(input);
  });
}
// opts.lang: 'hi' (default) | en | bn | ja | ko | zh | id | ur | ar     ->  returns an ogg/opus Buffer (WhatsApp voice note)
async function synth(text, opts = {}) {
  const lang = opts.lang || 'hi', t = speakable(text, lang); if (!t) throw new Error('nothing to say');
  if (override) return toOpus(await override(t, lang));
  const want = env('TTS_ENGINE', 'edge'); let raw;
  try { raw = want === 'google' ? await googleMp3(t, lang) : await edgeAudio(t, lang); }
  catch (e) { console.error('[tts]', want, 'failed, trying the other engine:', String(e.message).slice(0, 100)); raw = want === 'google' ? await edgeAudio(t, lang) : await googleMp3(t, lang); }
  return toOpus(raw);
}
module.exports = { synth, toOpus, speakable, setEngine, voiceFor, MAX_CHARS };
