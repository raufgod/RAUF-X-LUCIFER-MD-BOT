'use strict';
// RAUF × LUCIFER MD BOT - white label ("brand") layer.
//
// One file, data/brand.json, makes the whole bot + website belong to a new owner: name, owner, numbers, links, Telegram token ...
// It is filled from the website admin panel (Admin > Brand) - no code is touched.
//   * no data/brand.json (or empty botName)  -> everything works exactly as before
//   * with it: every outgoing message and every website page is rewritten with the new name / owner / links,
//     settings + environment are taken from it, and pairing can be limited to an allow-list of numbers.
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(process.cwd(), 'data', 'brand.json');
const SELLER = {
  channel: 'https://whatsapp.com/channel/0029VbDZOHWLtOjKFsWcAP0a',
  group: 'https://chat.whatsapp.com/HX2P0t6KxaHHLhctPpCw6x',
  number: '919103902586'
};
const FIELDS = ['botName', 'ownerName', 'ownerNumber', 'pairingNumber', 'customPairingCode', 'prefix', 'telegramToken', 'websiteUrl', 'channelLink', 'groupLink',
  'telegramLink', 'telegramUser', 'whatsappSupport', 'email', 'youtube', 'instagram', 'github', 'adminEmails', 'allowedNumbers', 'announce', 'announceLink'];
const RESTART = ['telegramToken', 'ownerNumber', 'pairingNumber', 'customPairingCode'];

let B = null, ver = 0, rules = null;

const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n || 200);
const digits = (v) => String(v == null ? '' : v).replace(/\D/g, '').replace(/^0+/, '').slice(0, 15);
const url = (v) => { const s = str(v, 300); if (!s) return ''; const u = /^https?:\/\//i.test(s) ? s : 'https://' + s; try { return new URL(u).toString().replace(/\/$/, ''); } catch (_) { return ''; } };
const list = (v) => (Array.isArray(v) ? v : String(v || '').split(/[\s,;\n]+/)).map(digits).filter((x) => x.length >= 8);

function clean(j) {
  j = j && typeof j === 'object' ? j : {};
  const o = {
    botName: str(j.botName, 40), ownerName: str(j.ownerName, 40), ownerNumber: digits(j.ownerNumber), pairingNumber: digits(j.pairingNumber),
    customPairingCode: str(j.customPairingCode, 8).toUpperCase().replace(/[^A-Z0-9]/g, ''), prefix: str(j.prefix, 3) || '.',
    telegramToken: /^\d{6,12}:[\w-]{30,60}$/.test(str(j.telegramToken, 80)) ? str(j.telegramToken, 80) : '',
    websiteUrl: url(j.websiteUrl), channelLink: url(j.channelLink), groupLink: url(j.groupLink), telegramLink: url(j.telegramLink),
    telegramUser: str(j.telegramUser, 40).replace(/^@/, '').replace(/[^\w]/g, ''), whatsappSupport: digits(j.whatsappSupport),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(j.email, 80)) ? str(j.email, 80) : '', youtube: url(j.youtube), instagram: url(j.instagram), github: str(j.github, 40).replace(/[^\w.-]/g, ''),
    adminEmails: (Array.isArray(j.adminEmails) ? j.adminEmails : String(j.adminEmails || '').split(/[\s,;]+/)).map((x) => str(x, 80).toLowerCase()).filter((x) => /^[^\s@]+@[^\s@]+$/.test(x)).slice(0, 10),
    allowedNumbers: list(j.allowedNumbers).slice(0, 5000), announce: str(j.announce, 160), announceLink: str(j.announceLink, 200)
  };
  return o;
}

function load() {
  try { B = clean(JSON.parse(fs.readFileSync(FILE, 'utf8'))); if (!B.botName) B = null; } catch (_) { B = null; }
  // a leftover test brand ("Test Bot") from an earlier build must never rename a real bot: drop it
  if (B && /^test ?(bot|x)$/i.test(B.botName)) { B = null; try { fs.unlinkSync(FILE); console.log('[brand] removed leftover test brand (data/brand.json)'); } catch (_) {} }
  ver++; rules = null; return B;
}
load();

const configured = () => !!B;
const get = () => B;
const version = () => ver;

function buildRules() {
  const bn = B.botName, on = B.ownerName || B.botName;
  const R = [
    [/Team RAUF × LUCIFER/g, () => bn + ' Team'],
    [/RAUF × LUCIFER MD BOT/g, () => bn], [/King [Oo]f [Bb]ots/g, () => bn],
    [/\bRAUF\b/g, () => on.toUpperCase()], [/\bRauf\b/g, () => on],
    [new RegExp(SELLER.number, 'g'), () => B.ownerNumber || ''],
    [new RegExp(SELLER.channel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), () => B.channelLink || ''],
    [new RegExp(SELLER.group.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), () => B.groupLink || '']
  ];
  return R;
}
/** rewrite a piece of text for the new brand (returns the same text when no brand is set) */
function text(s) {
  if (!B || typeof s !== 'string' || !s) return s;
  if (!rules) rules = buildRules();
  for (const [re, fn] of rules) s = s.replace(re, fn);
  return s;
}
const TEXT_KEYS = ['text', 'caption', 'footer', 'title', 'body', 'subtitle', 'contentText', 'description'];
/** rewrite the visible texts of an outgoing WhatsApp message */
function rewrite(content) {
  if (!B || !content || typeof content !== 'object') return content;
  let out = null;
  const put = (k, v) => { if (!out) out = { ...content }; out[k] = v; };
  for (const k of TEXT_KEYS) if (typeof content[k] === 'string') { const t = text(content[k]); if (t !== content[k]) put(k, t); }
  const ci = content.contextInfo;
  if (ci && typeof ci === 'object') {
    let c2 = null;
    const ea = ci.externalAdReply;
    if (ea && typeof ea === 'object') { const e2 = { ...ea }; for (const k of ['title', 'body']) if (typeof e2[k] === 'string') e2[k] = text(e2[k]); c2 = { ...ci, externalAdReply: e2 }; }
    const fn = ci.forwardedNewsletterMessageInfo;
    if (fn && typeof fn.newsletterName === 'string') c2 = { ...(c2 || ci), forwardedNewsletterMessageInfo: { ...fn, newsletterName: text(fn.newsletterName) } };
    if (c2) put('contextInfo', c2);
  }
  return out || content;
}

/** environment defaults (a real env var / .env always wins) - call once at the very start */
function applyEnv() {
  if (!B) return;
  const set = (k, v) => { if (v && !process.env[k]) process.env[k] = String(v); };
  set('TELEGRAM_BOT_TOKEN', B.telegramToken);
  set('OWNER_NUMBER', B.ownerNumber);
  set('PAIRING_NUMBER', B.pairingNumber);   // no fallback to the owner number: empty = no owner pairing code
  set('CUSTOM_PAIRING_CODE', B.customPairingCode);
  set('PAIR_WEBSITE_URL', B.websiteUrl);
  set('TOP_TEXT', B.botName + ' 👑');
  set('GROUP_LINK', B.groupLink);
  ensureOwnerFiles();
}
function ensureOwnerFiles() {
  try {
    const nums = [B.ownerNumber, B.pairingNumber].filter(Boolean);
    for (const f of ['owner.json', 'premium.json']) {
      const p = path.resolve(process.cwd(), 'data', f); let arr = [];
      try { arr = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) {}
      arr = (Array.isArray(arr) ? arr : []).map(String).filter((x) => x !== SELLER.number || nums.includes(SELLER.number));
      let ch = false; for (const n of nums) if (!arr.includes(n)) { arr.push(n); ch = true; }
      fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(arr));
    }
  } catch (_) {}
}
/** copy the brand into the shared settings object (also used live after Admin > Brand > Save) */
function applySettings(s) {
  if (!B || !s) return;
  const on = B.ownerName || B.botName;
  s.botName = B.botName; s.packname = B.botName; s.author = on; s.botOwner = on;
  if (B.ownerNumber) s.ownerNumber = B.ownerNumber;
  if (B.prefix) s.prefix = B.prefix;
  s.telegramLink = B.telegramLink; s.websiteLink = B.websiteUrl; s.channelLink = B.channelLink; s.groupLink = B.groupLink;
  s.description = `${B.botName} | WhatsApp Bot`;
  try { global.botName = global.botname = B.botName; } catch (_) {}
}

function isAllowed(number) {
  const l = B && B.allowedNumbers;
  if (!l || !l.length) return true;
  const n = digits(number);
  return l.includes(n) || n === B.ownerNumber || n === B.pairingNumber;
}
function adminEmails() { return B ? B.adminEmails : null; }

/** window.SITE for the website contact page */
function siteConfig() {
  const b = B || {};
  return { email: b.email || '', email2: '', telegram: b.telegramUser || '', github: b.github || '', channel: b.channelLink || '', whatsapp: b.whatsappSupport || b.ownerNumber || '',
    instagram: b.instagram || '', youtube: b.youtube || '', hours: '', announce: b.announce || '', announceLink: b.announceLink || '' };
}

/** admin panel view: the token is never sent back, only whether one is set */
function view() {
  const b = B ? { ...B } : clean({});
  const hasToken = !!b.telegramToken; delete b.telegramToken;
  return { ...b, telegramTokenSet: hasToken, telegramTokenTail: hasToken ? '…' + B.telegramToken.slice(-4) : '', configured: !!B };
}
function save(patch) {
  const cur = B || clean({});
  const merged = { ...cur };
  for (const k of FIELDS) if (patch && k in patch) merged[k] = patch[k];
  if (!patch || !str(patch.telegramToken)) merged.telegramToken = cur.telegramToken || '';        // empty field = keep the saved token
  if (patch && patch.clearTelegramToken) merged.telegramToken = '';
  const nb = clean(merged);
  if (!nb.botName) throw new Error('Bot name is required.');
  const restart = RESTART.some((k) => String(nb[k] || '') !== String((B || {})[k] || ''));
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE + '.tmp', JSON.stringify(nb, null, 2)); fs.renameSync(FILE + '.tmp', FILE);
  load(); ensureOwnerFiles();
  try { applySettings(require('../settings')); } catch (_) {}
  return { restartNeeded: restart };
}
function reload() { load(); try { applySettings(require('../settings')); } catch (_) {} }
/** brand without secrets, for sharing with worker panels */
function shareable() { return B ? JSON.stringify({ ...B, telegramToken: '' }, null, 2) : null; }

/* ---------- website: serve public/ files with the brand applied ---------- */
const cache = new Map();
function webMiddleware(publicDir) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json' };
  return (req, res, next) => {
    if (!B || (req.method !== 'GET' && req.method !== 'HEAD')) return next();
    let p; try { p = decodeURIComponent(req.path); } catch (_) { return next(); }
    if (p === '/site-config.js') {
      res.setHeader('Content-Type', types['.js']); res.setHeader('Cache-Control', 'no-cache');
      return res.send('window.SITE = ' + JSON.stringify(siteConfig()) + ';\n');
    }
    if (p.endsWith('/')) p += 'index.html';
    let ext = path.extname(p);
    if (!ext) { p += '.html'; ext = '.html'; }
    if (!types[ext] || p.includes('..') || /\/(sw)\.js$/.test(p)) return next();
    const file = path.join(publicDir, p);
    if (!file.startsWith(publicDir + path.sep)) return next();
    let st; try { st = fs.statSync(file); } catch (_) { return next(); }
    if (!st.isFile()) return next();
    const key = file + '|' + st.mtimeMs + '|' + ver;
    let body = cache.get(key);
    if (body === undefined) {
      if (cache.size > 80) cache.clear();
      body = text(fs.readFileSync(file, 'utf8')); cache.set(key, body);
    }
    res.setHeader('Content-Type', types[ext]); res.setHeader('Cache-Control', ext === '.html' ? 'no-cache' : 'public, max-age=300');
    res.send(body);
  };
}

module.exports = { configured, get, version, text, rewrite, applyEnv, applySettings, isAllowed, adminEmails, siteConfig, view, save, reload, shareable, webMiddleware, FILE, FIELDS };
