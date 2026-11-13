// Helper library for the additional (*_extra) command modules — RAUF × LUCIFER MD BOT by RAUF × LUCIFER.
// Public API endpoints are kept hard-coded on purpose.
import fs from 'fs';
import os from 'os';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createRequire } from 'module';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { API_CONFIG, LIMITS, MESSAGES } from './config.js';

const require = createRequire(import.meta.url);
const settings = require('../../../settings.js');

export { API_CONFIG, LIMITS, MESSAGES };

try { for (const d of ['temp', 'data']) fs.mkdirSync(path.join(process.cwd(), d), { recursive: true }); } catch {}

const UA = { 'User-Agent': 'Mozilla/5.0 (KING-OF-BOTS)' };
const ELITE = 'https://eliteprotech-apis.zone.id';
const http = async (url, opts = {}) => (await axios.get(url, { timeout: 30000, headers: UA, ...opts })).data;
const pickText = (d) => {
  if (typeof d === 'string') return d.trim();
  if (!d || typeof d !== 'object') return '';
  for (const k of ['result', 'response', 'answer', 'message', 'text', 'data', 'output', 'reply']) {
    const v = d[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (v && typeof v === 'object') { const r = pickText(v); if (r) return r; }
  }
  return '';
};

/* ───────────── generic helpers ───────────── */
export const delay = (ms) => new Promise((r) => setTimeout(r, ms));
export const sleep = delay;

export const detectPlatform = () => {
  const e = process.env;
  if (e.HOST_PROVIDER) return e.HOST_PROVIDER;
  if (e.DYNO) return 'Heroku';
  if (e.RAILWAY_ENVIRONMENT || e.RAILWAY_STATIC_URL) return 'Railway';
  if (e.RENDER) return 'Render';
  if (e.KOYEB_ENV) return 'Koyeb';
  if (e.GITHUB_ACTIONS || e.GITHUB_WORKFLOW) return 'GitHub Actions';
  if (e.PTERODACTYL_ENVIRONMENT || e.P_SERVER_UUID) return 'Panel (Pterodactyl)';
  return `${os.type()} ${os.release()}`;
};

// Accepts milliseconds (values from Date.now() deltas).
export const formatUptime = (ms) => {
  const s = Math.max(0, Math.floor(Number(ms) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${d}d ${h}h ${m}m ${sec}s`;
};
export const formatBytes = (b) => {
  const n = Number(b) || 0;
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB', 'TB']; let i = -1, v = n;
  do { v /= 1024; i++; } while (v >= 1024 && i < u.length - 1);
  return `${v.toFixed(2)} ${u[i]}`;
};
export const formatDate = (d) => { const x = new Date(d); return isNaN(x) ? 'N/A' : x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); };
export const truncateMessage = (text, max = LIMITS.maxMessageLength) => { const s = String(text ?? ''); return s.length > max ? `${s.slice(0, max - 3)}...` : s; };
export const formatError = (err, prefix = '❌ Error') => `${prefix}\n\n${truncateMessage(err?.message || String(err), 500)}`;
export const formatPhoneNumber = (n) => String(n || '').replace(/\D/g, '');
export const isValidPhoneNumber = (n) => /^\d{7,15}$/.test(formatPhoneNumber(n));
export const formatJid = (n) => `${formatPhoneNumber(n)}@s.whatsapp.net`;
export const normalizeJid = (v) => {
  const raw = typeof v === 'string' ? v : (v?.sender || v?.participant || v?.key?.participant || v?.key?.remoteJid || '');
  const s = String(raw).replace(/:\d+(?=@)/, '');
  return s.includes('@') ? s : formatJid(s);
};
export const getSenderJid = (msg) => normalizeJid(msg?.key?.participant || msg?.participant || msg?.key?.remoteJid || '');
export const protectOwner = (jid) => {
  const num = String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
  const owner = String(process.env.PAIRING_NUMBER || process.env.OWNER_NUMBER || settings.ownerNumber || '').replace(/\D/g, '');
  return !!num && num === owner;
};

if (!(global.ALLOWED_USERS instanceof Set)) {
  global.ALLOWED_USERS = new Set();
  try {
    const f = path.join(process.cwd(), 'data', 'userGroupData.json');
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const j of d.sudo || []) global.ALLOWED_USERS.add(String(j).split('@')[0]);
  } catch {}
}
// Keeps the sudo list in the same store used by the main bot (lib/index.js).
export const saveSudoList = (set) => {
  try {
    const f = path.join(process.cwd(), 'data', 'userGroupData.json');
    let d = {};
    try { d = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
    d.sudo = [...set].map((n) => formatJid(n));
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(d, null, 2));
  } catch (e) { console.error('[saveSudoList]', e.message); }
};

export async function downloadMedia(messageObj, type) {
  const stream = await downloadContentFromMessage(messageObj, type);
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return Buffer.concat(chunks);
}

/* ───────────── fun / random ───────────── */
export const getRandomJoke = async () => {
  const d = await http('https://icanhazdadjoke.com/', { headers: { ...UA, Accept: 'application/json' } });
  return d.joke;
};
export const getRandomAdvice = async () => (await http('https://api.adviceslip.com/advice')).slip.advice;
export const getRandomFact = async () => (await http('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en')).text;
export const getRandomQuote = async () => {
  const d = await http('https://zenquotes.io/api/random');
  const q = Array.isArray(d) ? d[0] : d;
  return { text: q.q, body: q.q, author: q.a };
};
export const getRandomTrivia = async () => {
  const d = await http('https://opentdb.com/api.php?amount=1&type=multiple');
  const r = d.results[0];
  const dec = (s) => cheerio.load(`<p>${s}</p>`)('p').text();
  const options = [...r.incorrect_answers, r.correct_answer].map(dec).sort(() => Math.random() - 0.5);
  return { question: dec(r.question), category: r.category, difficulty: r.difficulty, correct_answer: dec(r.correct_answer), answer: dec(r.correct_answer), options, incorrect_answers: r.incorrect_answers.map(dec) };
};
export const getRandomWallpaper = async () => `https://picsum.photos/1080/1920?random=${Date.now()}`;
export const getLoveEmoji = (p) => (p >= 90 ? '💞' : p >= 70 ? '😍' : p >= 50 ? '💕' : p >= 30 ? '🙂' : '💔');
export const getRandomDevice = () => ['Samsung Galaxy S24', 'iPhone 15 Pro', 'Xiaomi 14', 'OnePlus 12', 'Pixel 8 Pro', 'Oppo Find X7'][Math.floor(Math.random() * 6)];
export const getFakeFiles = () => ['passwords.txt', 'bank_details.pdf', 'photos_backup.zip', 'chat_history.db', 'secret_notes.docx', 'wallet.dat'][Math.floor(Math.random() * 6)];
export const randomIP = async () => Array.from({ length: 4 }, () => Math.floor(Math.random() * 255)).join('.');
export const progressSteps = ['▰▱▱▱▱▱▱▱▱▱ 10%', '▰▰▰▱▱▱▱▱▱▱ 30%', '▰▰▰▰▰▱▱▱▱▱ 50%', '▰▰▰▰▰▰▰▱▱▱ 70%', '▰▰▰▰▰▰▰▰▰▱ 90%', '▰▰▰▰▰▰▰▰▰▰ 100%'];
export const hackMessages = [
  '```Injecting malware...```', '```Connecting to device: {device}```', '```Target IP: {ip}```', '```Bypassing firewall...```',
  '```Extracting {file1}```', '```Extracting {file2}```', '```Encrypting data...```', '```Uploading to server...```',
  '```Covering tracks...```', '```HACK COMPLETE ✅ (just a prank!)```'
];

/* ───────────── lookups ───────────── */
export const exchangeRates = async (base = 'USD') => {
  const d = await http(`https://open.er-api.com/v6/latest/${encodeURIComponent(String(base).toUpperCase())}`);
  if (d.result !== 'success') throw new Error('Invalid currency');
  return { base: d.base_code, rates: d.rates, date: d.time_last_update_utc };
};
export const imdbSearch = async (q) => http('https://www.omdbapi.com/', { params: { t: q, plot: 'full', apikey: '742b2d09' } });
export const defineTerm = async (word) => {
  const d = await http(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  const m = d[0].meanings[0].definitions[0];
  return { word: d[0].word, definition: m.definition, example: m.example || 'N/A' };
};
export const getBibleVerse = async (ref) => {
  const d = await http(`https://bible-api.com/${encodeURIComponent(ref)}`);
  return { reference: d.reference, verses: d.verses || [], text: (d.text || '').trim() };
};
export const translateText = async (text, lang = 'en') => {
  const d = await http('https://translate.googleapis.com/translate_a/single', { params: { client: 'gtx', sl: 'auto', tl: lang, dt: 't', q: text } });
  return (d[0] || []).map((p) => p[0]).join('');
};
export const npmSearch = async (q) => {
  const d = await http('https://registry.npmjs.org/-/v1/search', { params: { text: q, size: 1 } });
  return { results: (d.objects || []).map((o) => ({ name: o.package.name, version: o.package.version, description: o.package.description, publisher: o.package.publisher?.username || 'N/A', license: o.package.license || 'N/A', date: o.package.date, npmLink: o.package.links?.npm, repoLink: o.package.links?.repository || 'N/A', homepage: o.package.links?.homepage || 'N/A' })) };
};
export const getGithubUser = async (u) => {
  try { return await http(`https://api.github.com/users/${encodeURIComponent(u)}`); }
  catch (e) { if (e.response?.status === 404) return { message: 'Not Found' }; throw e; }
};
export const githubRepoInfo = async (owner, repo) => http(`https://api.github.com/repos/${owner}/${repo}`);
export const googleSearch = async (q) => {
  const html = await http('https://html.duckduckgo.com/html/', { params: { q }, responseType: 'text' });
  const $ = cheerio.load(html);
  const out = [];
  $('.result').each((_, el) => {
    const a = $(el).find('.result__a').first();
    let link = a.attr('href') || '';
    const m = link.match(/uddg=([^&]+)/); if (m) link = decodeURIComponent(m[1]);
    if (a.text().trim() && link) out.push({ title: a.text().trim(), link, snippet: $(el).find('.result__snippet').text().trim() });
  });
  return out.slice(0, 8);
};
export const fetchElement = async (q) => {
  const all = await http('https://raw.githubusercontent.com/Bowserinator/Periodic-Table-JSON/master/PeriodicTableJSON.json');
  const s = String(q).trim().toLowerCase();
  const e = all.elements.find((x) => x.name.toLowerCase() === s || x.symbol.toLowerCase() === s || String(x.number) === s);
  if (!e) return { error: true };
  return { name: e.name, symbol: e.symbol, atomic_number: e.number, atomic_mass: e.atomic_mass, phase: e.phase, period: e.period, discovered_by: e.discovered_by, image: e.image?.url || null, summary: e.summary };
};
export const fetchUrlContent = async (url) => axios.get(url, { responseType: 'arraybuffer', timeout: 30000, headers: UA, validateStatus: () => true, maxContentLength: LIMITS.maxFetchSize * 2 });

/* ───────────── AI (EliteProTech public endpoint, same as .gpt) ───────────── */
async function ask(prompt, path_ = '/ai/chatgpt') {
  const d = await http(`${ELITE}${path_}`, { params: { prompt }, timeout: 60000 });
  const out = pickText(d);
  if (!out) throw new Error('Empty AI response');
  return out;
}
export const callGeminiAPI = (p) => ask(p);
export const callLlamaAPI = (p) => ask(p);
export const gpt41Nano = (p) => ask(p);
export const gpt41Mini = (p) => ask(p);
export const gpt41 = (p) => ask(p);
export const gpt4o = (p) => ask(p);
export const gpt4oMini = (p) => ask(p);
export const o4Mini = (p) => ask(p);
export const o3 = (p) => ask(p);
export const claude37 = (p) => ask(p);
export const gemini20 = (p) => ask(p);
export const grok3Mini = (p) => ask(p);
export const qwenQwq32b = (p) => ask(p);
export const llama33 = (p) => ask(p);
export const deepseekR1 = (p) => ask(p, '/ai/deepseekai');
export const deepseekV3 = (p) => ask(p, '/ai/deepseekai');
export const intelQuery = async (q) => ({ summary: await ask(`Give a concise factual summary about: ${q}`) });
export const geminiVision2 = async (base64, query) => {
  const up = await uploadTmp(Buffer.from(base64, 'base64'));
  return ask(`${query}\nImage: ${up}`);
};

/* ───────────── uploads / downloads ───────────── */
export async function uploadTmp(buffer, name = 'file.jpg') {
  const FormData = (await import('form-data')).default;
  const f = new FormData();
  f.append('file', buffer, name);
  const { data } = await axios.post('https://catbox.moe/user/api.php', (() => { f.append('reqtype', 'fileupload'); return f; })(), { headers: f.getHeaders(), timeout: 60000 });
  if (typeof data !== 'string' || !data.startsWith('http')) throw new Error('Upload failed');
  return data.trim();
}
const mediaUrl = (d) => {
  if (!d) return '';
  if (typeof d === 'string') return /^https?:/.test(d) ? d : '';
  for (const k of ['url', 'download', 'video', 'hd', 'sd', 'link', 'result', 'data', 'medias']) {
    const v = d[k];
    if (typeof v === 'string' && /^https?:/.test(v)) return v;
    if (Array.isArray(v) && v[0]) { const r = mediaUrl(v[0]); if (r) return r; }
    if (v && typeof v === 'object') { const r = mediaUrl(v); if (r) return r; }
  }
  return '';
};
const eliteDl = async (type, url) => http(`${ELITE}/download/${type}`, { params: { url }, timeout: 60000 });

export const alldlDownload = async (url) => ({ result: mediaUrl(await eliteDl('aio3', url)) });
export const videoDownload = async (url) => {
  const u = mediaUrl(await eliteDl('aio3', url));
  return { status: !!u, BK9: { high: u, low: u } };
};
export const getTikTokMedia = async (url) => {
  try {
    const d = await http('https://tikwm.com/api/', { params: { url } });
    if (d.code !== 0) return { status: false, message: d.msg || 'Failed' };
    return { status: true, title: d.data.title, video: d.data.hdplay || d.data.play, audio: d.data.music };
  } catch (e) { return { status: false, message: e.message }; }
};
export const getInstaMedia = async (url) => {
  try {
    const u = mediaUrl(await eliteDl('aio3', url));
    return u ? { data: [{ url: u }] } : { error: 'No media found for this link.' };
  } catch (e) { return { error: e.message }; }
};
export const facebookDownload = async (url) => {
  const d = await eliteDl('facebook', url);
  const x = d?.result || d?.data || d || {};
  const hd = x.hd || x.HD || mediaUrl(x) || x.sd;
  if (!hd) throw new Error('No video found');
  return { title: x.title || 'Facebook Video', url, thumbnail: x.thumbnail || x.thumb || 'https://i.imgur.com/0Z8SYwm.png', hd, sd: x.sd || hd };
};
export const mediafireDownload = async (url) => {
  const d = await eliteDl('mediafire', url);
  const x = d?.result || d?.data || d || {};
  return { download: x.download || x.link || x.url || mediaUrl(x), filename: x.filename || x.name || 'file', size: x.size || 'N/A', mimetype: x.mimetype || x.type || '' };
};
export const spotifySearch = async (q) => {
  const s = await http('https://api.siputzx.my.id/api/s/spotify', { params: { query: q } });
  const t = (s.data || s.result || [])[0];
  if (!t) return { status: false };
  const dl = await eliteDl('spotify', t.track_url || t.url || t.link);
  const audio = mediaUrl(dl?.result || dl?.data || dl);
  return { status: !!audio, result: { title: t.title || t.name, artist: t.artist || t.artists, duration: t.duration || 'N/A', popularity: t.popularity || 'N/A', thumbnail: t.thumbnail || t.image, url: t.track_url || t.url || t.link, audio } };
};
export const fetchAllPosts = async (username) => {
  try {
    const d = await http(`https://api.siputzx.my.id/api/igdl/posts`, { params: { username } });
    const items = (d.data || []).map((x) => ({ type: /\.mp4|video/i.test(x.url || '') ? 'video' : 'image', url: x.url })).filter((x) => x.url);
    return { total: items.length, items };
  } catch { return { total: 0, items: [] }; }
};
export const fetchStories = async (username) => {
  try {
    const d = await http(`https://api.siputzx.my.id/api/igdl/stories`, { params: { username } });
    const items = (d.data || []).map((x) => ({ type: /\.mp4|video/i.test(x.url || '') ? 'video' : 'image', url: x.url })).filter((x) => x.url);
    return { total: items.length, items };
  } catch { return { total: 0, items: [] }; }
};
export const apkSearch = async (q) => {
  try {
    const d = await http('https://api.siputzx.my.id/api/apk/aptoide', { params: { query: q } });
    const a = d.data || d.result;
    if (!a) return null;
    const link = a.link || a.download || a.dllink || a.file?.path;
    return { apk: { name: a.name || q }, dlInfo: { dllink: link } };
  } catch { return null; }
};
export const telegramStickerPack = async (url) => {
  const name = String(url).split('/').pop();
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Set TELEGRAM_BOT_TOKEN in .env to use this command');
  const d = await http(`https://api.telegram.org/bot${token}/getStickerSet`, { params: { name } });
  const set = d.result;
  const stickers = [];
  for (const s of set.stickers.slice(0, 20)) {
    const f = await http(`https://api.telegram.org/bot${token}/getFile`, { params: { file_id: s.file_id } });
    stickers.push({ url: `https://api.telegram.org/file/bot${token}/${f.result.file_path}`, emoji: s.emoji, isAnimated: s.is_animated, isVideo: s.is_video });
  }
  return { name: set.name, title: set.title, type: set.sticker_type, stickers };
};
export const emojimix = async (e1, e2) => {
  const url = `https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=${encodeURIComponent(e1)}_${encodeURIComponent(e2)}`;
  const d = await http(url);
  const r = d.results?.[0]?.media_formats?.png_transparent?.url;
  return { data: { status: !!r, result: r } };
};
export const generatePairCode = async (number) => {
  const d = await http('https://eliteprotech-apis.zone.id/pair', { params: { number: formatPhoneNumber(number) } }).catch(() => null);
  return pickText(d) || null;
};
export const generateLogo = async (sock, from, text, msg, name, url, processing) => {
  if (!text) return sock.sendMessage(from, { text: `❌ Please provide a text.\nExample: .${name} ${settings.botName}` }, { quoted: msg });
  await sock.sendMessage(from, { text: processing || '⏳ Creating logo...' }, { quoted: msg });
  const { default: mumaker } = await import('mumaker');
  const r = await mumaker.ephoto(url, text);
  await sock.sendMessage(from, { image: { url: r.image }, caption: `✅ ${name} logo created by ${settings.botName}` }, { quoted: msg });
};

export default { delay };
