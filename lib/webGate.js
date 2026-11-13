'use strict';
// RAUF × LUCIFER MD BOT — website lock.
// Visitors see a password page. They tap "Get your password here" → Telegram password bot (must have joined the
// force-join channels) → bot issues a password valid for 10 MINUTES, usable ONCE, for that Telegram user only.
// Entering it on the site sets a signed cookie (WEB_GATE_SESSION_HOURS, default 12h).
// The lock is active only when TELEGRAM_PASSWORD_BOT_TOKEN is set (so nobody gets locked out by mistake);
// admins can switch it on/off in the Telegram 🛠 Admin → ⚙️ Settings, or with WEB_GATE=false.
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(process.cwd(), 'data', 'web-passwords.json');
const META_FILE = path.join(process.cwd(), 'data', 'web-gate.json');
const SETTINGS_FILE = path.join(process.cwd(), 'data', 'tg-settings.json');
const TTL_MS = 10 * 60 * 1000;
const SESSION_MS = Math.max(1, Number(process.env.WEB_GATE_SESSION_HOURS || 12)) * 3600 * 1000;
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const COOKIE = 'rx_unlock';

const readJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return d; } };
const writeJ = (f, v) => { try { fs.ensureDirSync(path.dirname(f)); fs.writeFileSync(f, JSON.stringify(v)); } catch (e) { console.error('[webGate save]', e.message); } };

function meta() {
  const m = readJ(META_FILE, {});
  if (!m.secret) { m.secret = process.env.WEB_GATE_SECRET || crypto.randomBytes(32).toString('hex'); writeJ(META_FILE, m); }
  return m;
}
const hash = code => crypto.createHash('sha256').update(meta().secret + ':' + code).digest('hex');
const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function isOn() {
  if (!process.env.TELEGRAM_PASSWORD_BOT_TOKEN) return false;
  if (String(process.env.WEB_GATE || '').toLowerCase() === 'false') return false;
  const st = readJ(SETTINGS_FILE, {});
  return typeof st.webLock === 'boolean' ? st.webLock : true;
}
function setBotUsername(u) { const m = meta(); if (m.botUsername !== u) { m.botUsername = u; writeJ(META_FILE, m); } }
function botUrl() {
  const u = String(process.env.TELEGRAM_PASSWORD_BOT_USERNAME || meta().botUsername || '').replace(/^@/, '');
  return u ? `https://t.me/${u}` : '';
}

/** rate limit for the bot: one new password per 20 s per Telegram user */
function canIssue(uid) {
  const d = readJ(DATA_FILE, { codes: {}, last: {} });
  const wait = Math.ceil((Number(d.last?.[uid] || 0) + 20000 - Date.now()) / 1000);
  return wait > 0 ? { ok: false, wait } : { ok: true };
}
/** create a password for this Telegram user (any older unused one of theirs stops working) */
function issue(uid) {
  const d = readJ(DATA_FILE, { codes: {}, last: {} });
  const now = Date.now();
  for (const [h, e] of Object.entries(d.codes)) if (e.exp < now - 3600e3 || e.uid === String(uid)) delete d.codes[h];
  let code = '';
  for (let i = 0; i < 8; i++) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  d.codes[hash(code)] = { uid: String(uid), exp: now + TTL_MS, used: false };
  d.last = d.last || {}; d.last[uid] = now;
  writeJ(DATA_FILE, d);
  return code.slice(0, 4) + '-' + code.slice(4);
}
/** consume a password: returns the Telegram user id, or null (wrong / expired / already used) */
function consume(input) {
  const code = norm(input);
  if (code.length !== 8) return null;
  const d = readJ(DATA_FILE, { codes: {}, last: {} });
  const h = hash(code), e = d.codes[h];
  if (!e || e.used || e.exp < Date.now()) return null;
  e.used = true; writeJ(DATA_FILE, d);
  return e.uid;
}

const sign = v => crypto.createHmac('sha256', meta().secret).update(v).digest('hex').slice(0, 32);
function makeCookie(uid) { const exp = Date.now() + SESSION_MS, v = `${uid}.${exp}`; return `${v}.${sign(v)}`; }
function cookieOk(header) {
  const m = String(header || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='));
  if (!m) return false;
  const val = decodeURIComponent(m.slice(COOKIE.length + 1)), i = val.lastIndexOf('.');
  if (i < 0) return false;
  const body = val.slice(0, i), sig = val.slice(i + 1), exp = Number(body.split('.')[1]);
  try { return exp > Date.now() && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(body))); } catch (_) { return false; }
}

const hits = new Map();
function limited(ip) {
  const now = Date.now(), a = (hits.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  a.push(now); hits.set(ip, a); return a.length > 10;
}

function attach(app) {
  try { require('./linkPreview').attach(app); } catch (e) { console.error('[linkPreview]', e.message); }   // link-preview bots see site name + picture, not the password page
  const page = path.join(__dirname, '..', 'public', 'unlock.html');
  app.get('/api/unlock-info', (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json({ ok: true, locked: isOn(), botUrl: botUrl(), minutes: TTL_MS / 60000 }); });
  app.post('/api/unlock', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (limited(req.ip)) return res.status(429).json({ ok: false, error: 'Too many attempts. Wait a few minutes.' });
    const uid = consume(req.body?.password);
    if (!uid) return res.status(401).json({ ok: false, error: 'Wrong, expired or already used password. Get a new one from the Telegram bot.' });
    res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(makeCookie(uid))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_MS / 1000)}${req.secure ? '; Secure' : ''}`);
    res.json({ ok: true });
  });
  app.get(['/unlock', '/unlock.html'], (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.sendFile(page); });
  app.use((req, res, next) => {
    if (!isOn() || req.method === 'OPTIONS' || cookieOk(req.headers.cookie)) return next();
    const p = req.path;
    if (p === '/assets/og-card.jpg') return next();   // the link-preview picture is public
    if (p === '/api/health' || p.startsWith('/admin/') || p === '/api/admin/enter') return next();   // admin link is protected by its own secret
    res.setHeader('Cache-Control', 'no-store');
    if (p.startsWith('/api/')) return res.status(401).json({ ok: false, locked: true, error: 'Website locked. Get your password from the Telegram bot.' });
    if (/\.[a-z0-9]{2,5}$/i.test(p) && !/\.html$/i.test(p)) return res.status(401).end();
    return res.sendFile(page);
  });
}
// the admin link already proves who the owner is, so it also opens the website lock for that browser
function grant(req, res) {
  try { res.append('Set-Cookie', `${COOKIE}=${encodeURIComponent(makeCookie('admin'))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_MS / 1000)}${req.secure ? '; Secure' : ''}`); } catch (_) {}
}
module.exports = { grant, attach, isOn, issue, canIssue, consume, setBotUsername, botUrl, TTL_MS };
