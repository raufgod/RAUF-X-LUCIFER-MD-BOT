'use strict';
// VOICE AGENT for RAUF × LUCIFER MD BOT.
// A visitor registers on the website (name + WhatsApp number + consent). About a minute later the bot, from its own paired
// number, sends a welcome voice note that explains the bot. If the person answers by text or by voice, the agent understands it
// and answers by voice or text, whichever they use or ask for.
//
//   POST /api/register-call   { name, number, consent:true }     behind the website password lock, like the rest of the site
//   GET  /api/call/admin      queue + counts                     header x-call-admin-secret = CALL_ADMIN_SECRET
//   POST /api/call/optout     { number }                         same header: never message this number
//
// Env (all optional, see docs/voice-agent.md): CALL_DELAY_MIN=1 CALL_DELAY_MAX=1.5 (minutes)  CALL_MAX_PER_HOUR=20  CALL_MAX_PER_DAY=150
//   CALL_QUIET_HOURS=off|21-9  CALL_TZ=Asia/Kolkata  CALL_MAX_ATTEMPTS=3  CALL_RETRY_MIN=2  CALL_ADMIN_SECRET  GROQ_API_KEY  TTS_VOICE  CALL_DRYRUN=1
const crypto = require('crypto');
const store = require('./store'), WA = require('./wa');

const num = (k, d) => { const v = Number(process.env[k]); return Number.isFinite(v) && v >= 0 && process.env[k] !== '' && process.env[k] !== undefined ? v : d; };
const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rate = new Map();                       // ip -> timestamps (registration attempts)
let allReg = [];                              // every accepted registration (global cap: the client IP can be spoofed behind a proxy)
let timer = null, busy = false;

function cleanNumber(raw) { const n = String(raw || '').replace(/\D/g, '').replace(/^0+/, ''); return /^[1-9]\d{9,14}$/.test(n) ? n : null; }
function cleanName(raw) { return String(raw || '').normalize('NFKC').replace(/<[^>]*>/g, ' ').replace(/[^\p{L}\p{M}\p{N} .'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40); }
function ipLimited(ip, tag = '', max = num('CALL_RATE_PER_IP', 5)) {
  const k = tag + ip, now = Date.now(), a = (rate.get(k) || []).filter(t => now - t < HOUR); a.push(now); rate.set(k, a);
  if (rate.size > 5000) for (const [x, v] of rate) if (!v.some(t => now - t < HOUR)) rate.delete(x);
  return a.length > max;
}
function delayMs() { const lo = num('CALL_DELAY_MIN', 1), hi = Math.max(lo, num('CALL_DELAY_MAX', 1.5)); return Math.round((lo + Math.random() * (hi - lo)) * MIN); }

// Optional quiet hours (default OFF, so a message goes out ~1 minute after registering at any time). Example: CALL_QUIET_HOURS=21-9
function hourIn(tz, t) { try { return Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(new Date(t))); } catch (_) { return new Date(t).getUTCHours(); } }
function allowedAt(t) {
  const m = String(process.env.CALL_QUIET_HOURS || 'off').match(/^(\d{1,2})-(\d{1,2})$/); if (!m) return t;
  const from = +m[1], to = +m[2], tz = process.env.CALL_TZ || 'Asia/Kolkata', quiet = h => (from > to ? (h >= from || h < to) : (h >= from && h < to));
  if (!quiet(hourIn(tz, t))) return t;
  let x = t; for (let i = 0; i < 24 * 12 && quiet(hourIn(tz, x)); i++) x += 5 * MIN;
  return x + Math.floor(Math.random() * 10 * MIN);
}
// What the website shows after registering: the owner number (sender of the voice note) and a ready-made first message.
// Visitors are asked to message that number first, so the chat is started by them and not cold-called by the bot.
function contact(name) { const owner = WA.ownerNumber(); return owner ? { owner, hiText: String(process.env.CALL_HI_TEXT || `Hi, I am ${name}. I just registered on the website and I want to know more about the bot.`).slice(0, 200) } : {}; }
const mask = (n) => n.slice(0, 3) + '******' + n.slice(-2);
const sentSince = (db, ms) => db.jobs.filter(j => j.sentAt && Date.now() - j.sentAt < ms).length;

// ---- scheduler: every 15 s, send what is due. One send at a time, with a pause between people, and hard hourly / daily caps
// so the owner's WhatsApp number is never flooded (a flooded number gets banned).
async function tick() {
  if (busy) return; busy = true;
  try {
    const db = store.load(), now = Date.now();
    for (const j of db.jobs) {
      if (j.status !== 'pending' || j.dueAt > now) continue;
      if (j.needsMsg && !j.contactedAt) continue;                              // tapped Continue, but has not sent the first message to the owner number yet: stay silent
      if (db.dnc.includes(j.number)) { j.status = 'skipped'; j.note = 'do-not-contact'; store.save(); continue; }
      const ok = allowedAt(now); if (ok > now) { j.dueAt = ok; store.save(); continue; }
      if (sentSince(db, HOUR) >= num('CALL_MAX_PER_HOUR', 20) || sentSince(db, DAY) >= num('CALL_MAX_PER_DAY', 150)) { j.dueAt = now + 5 * MIN; store.save(); break; }
      if (!WA.ready()) { j.dueAt = now + 20000; break; }                       // bot is reconnecting: wait, and do not count it as a failed try
      j.status = 'sending'; j.attempts = (j.attempts || 0) + 1; store.flushNow();
      try {
        await WA.sendIntro(j, () => { j.audioSent = true; store.flushNow(); });
        j.status = 'sent'; j.sentAt = Date.now(); delete j.error;
        console.log(`[call-agent] welcome voice note sent -> ${mask(j.number)}`);
        store.save(); await sleep(process.env.CALL_FAST === '1' ? 0 : 8000 + Math.random() * 12000);
      } catch (e) { await failed(j, e); }
    }
    for (const j of db.jobs) if (j.status === 'awaiting' && now - j.createdAt > DAY) { j.status = 'skipped'; j.note = 'never tapped Continue'; }
    for (const j of db.jobs) if (j.status === 'pending' && j.needsMsg && !j.contactedAt && now - j.createdAt > DAY) { j.status = 'skipped'; j.note = 'never sent the first message'; }
    const cut = now - 30 * DAY; db.jobs = db.jobs.filter(j => ['pending', 'sending'].includes(j.status) || (j.sentAt || j.createdAt) > cut);
    store.save();
  } finally { busy = false; }
}
async function failed(j, e) {
  j.error = String(e.code || e.message || e).slice(0, 120);
  if (e.final) { j.status = e.code === 'NOT_ON_WHATSAPP' ? 'no-whatsapp' : 'skipped'; }
  else if (j.attempts < num('CALL_MAX_ATTEMPTS', 3)) { j.status = 'pending'; j.dueAt = Date.now() + num('CALL_RETRY_MIN', 2) * MIN; }
  else if (!j.audioSent) {                                                      // voice keeps failing: still give the information as text
    try { await WA.sendTextOnly(j); j.status = 'sent'; j.sentAt = Date.now(); j.note = 'text only (voice failed)'; } catch (_) { j.status = 'failed'; }
  } else { j.status = 'sent'; j.sentAt = j.sentAt || Date.now(); }
  console.error(`[call-agent] ${mask(j.number)}: ${j.error} -> ${j.status}`);
  store.save();
}
function startScheduler() { if (timer) return; store.load(); timer = setInterval(() => tick().catch(e => console.error('[call-agent]', e.message)), 15000); timer.unref && timer.unref(); }

// ---- registration
function register(body, ip) {
  if (body && body.website) return { code: 200, out: { ok: true } };                         // honeypot: bots fill hidden fields
  const name = cleanName(body && body.name), number = cleanNumber(body && body.number);
  if (name.length < 2) return { code: 400, out: { ok: false, error: 'Please enter your name.' } };
  if (!number) return { code: 400, out: { ok: false, error: 'Enter a valid WhatsApp number with country code.' } };
  if (!(body && body.consent === true)) return { code: 400, out: { ok: false, error: 'Please tick the box to allow the message.' } };
  if (ipLimited(ip)) return { code: 429, out: { ok: false, error: 'Too many tries. Please wait a while.' } };
  const db = store.load(), now = Date.now();
  allReg = allReg.filter(t => now - t < HOUR); if (allReg.length >= num('CALL_MAX_REG_PER_HOUR', 100)) return { code: 503, out: { ok: false, error: 'We are busy right now. Please try again in a few minutes.' } };
  if (db.dnc.includes(number)) return { code: 200, out: { ok: true, scheduled: false } };    // opted out earlier: honour it silently
  const dup = db.jobs.find(j => j.number === number && now - (j.sentAt || j.createdAt) < DAY && !['failed', 'no-whatsapp', 'skipped'].includes(j.status));
  if (dup) { const aw = dup.status === 'awaiting'; return { code: 200, out: { ok: true, already: true, awaiting: aw, ...(aw ? { id: dup.id, minutes: avgMinutes() } : { minutes: Math.max(1, Math.round((dup.dueAt - now) / MIN)) }), sent: dup.status === 'sent' || dup.status === 'opted-out', ...contact(dup.name) } }; }
  if (db.jobs.filter(j => j.status === 'pending').length >= num('CALL_MAX_PENDING', 300)) return { code: 503, out: { ok: false, error: 'We are busy right now. Please try again in a few minutes.' } };
  // The voice note is only scheduled after the visitor taps "Continue" in the popup (-> opens WhatsApp to the owner number).
  // Without an owner number to show there is no such step, so then it is scheduled straight away (old behaviour).
  const ct = contact(name), needsContinue = !!ct.owner;
  const job = { id: crypto.randomBytes(6).toString('hex'), name, number, createdAt: now, dueAt: needsContinue ? now : allowedAt(now + delayMs()), status: needsContinue ? 'awaiting' : 'pending', needsMsg: needsContinue, attempts: 0, consentAt: now };
  db.jobs.push(job); allReg.push(now); store.save();
  console.log(`[call-agent] registered ${mask(number)} -> ${needsContinue ? 'waiting for Continue' : 'voice note in ~' + Math.round((job.dueAt - now) / MIN) + ' min'}`);
  return { code: 200, out: { ok: true, scheduled: true, ...(needsContinue ? { awaiting: true, id: job.id, minutes: avgMinutes() } : { minutes: Math.max(1, Math.round((job.dueAt - now) / MIN)) }), ...ct } };
}

function avgMinutes() { const lo = num('CALL_DELAY_MIN', 1), hi = Math.max(lo, num('CALL_DELAY_MAX', 1.5)); return Math.max(1, Math.round((lo + hi) / 2)); }
// The visitor tapped "Continue": only now the voice note is scheduled (about 1 - 1.5 minutes from now).
function confirm(body, ip) {
  if (ipLimited(ip, 'c:', 20)) return { code: 429, out: { ok: false, error: 'Too many tries. Please wait a while.' } };
  const id = String((body && body.id) || '').replace(/[^a-f0-9]/gi, '').slice(0, 24);
  const db = store.load(), job = id && db.jobs.find(j => j.id === id);
  if (!job) return { code: 404, out: { ok: false, error: 'Registration not found. Please register again.' } };
  const now = Date.now();
  if (job.status === 'awaiting') {
    if (db.dnc.includes(job.number)) return { code: 200, out: { ok: true } };
    job.status = 'pending'; job.confirmedAt = now; job.dueAt = allowedAt(now + delayMs()); store.save();
    console.log(`[call-agent] ${mask(job.number)} tapped Continue -> voice note in ~${Math.round((job.dueAt - now) / MIN)} min`);
  }
  return { code: 200, out: { ok: true, minutes: Math.max(1, Math.round((job.dueAt - now) / MIN)) } };
}

const same = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y); };
const adminOk = (req) => !!process.env.CALL_ADMIN_SECRET && same(req.headers['x-call-admin-secret'], process.env.CALL_ADMIN_SECRET);

function adminData() {
  const db = store.load(), by = {}; db.jobs.forEach(j => { by[j.status] = (by[j.status] || 0) + 1; });
  return { ok: true, whatsappReady: WA.ready(), counts: by, optedOut: db.dnc.length, sentLastHour: sentSince(db, HOUR), sentLast24h: sentSince(db, DAY),
    jobs: db.jobs.slice(-100).map(j => ({ id: j.id, name: j.name, number: mask(j.number), status: j.status, dueAt: j.dueAt, sentAt: j.sentAt, attempts: j.attempts, turns: j.turns || 0, mode: j.mode || 'auto', error: j.error, note: j.note })) };
}
function optout(body) {
  const n = cleanNumber(body && body.number); if (!n) return false;
  const db = store.load(); if (!db.dnc.includes(n)) db.dnc.push(n); db.jobs.forEach(j => { if (j.number === n && ['pending', 'sent'].includes(j.status)) j.status = j.status === 'pending' ? 'skipped' : 'opted-out'; });
  store.save(); return true;
}
// Wrong passwords are rate limited per IP, so the secret cannot be guessed by trying again and again.
function guard(req, res) {
  if (adminOk(req)) return true;
  res.setHeader('Cache-Control', 'no-store'); res.status(ipLimited(req.ip, 'adm:', 10) ? 429 : 401).json({ ok: false }); return false;
}
function attach(app) {
  startScheduler();
  app.post('/api/register-call', (req, res) => { res.setHeader('Cache-Control', 'no-store'); const r = register(req.body, req.ip); res.status(r.code).json(r.out); });
  app.post('/api/register-call/confirm', (req, res) => { res.setHeader('Cache-Control', 'no-store'); const r = confirm(req.body, req.ip); res.status(r.code).json(r.out); });
  app.get('/api/call/admin', (req, res) => { if (guard(req, res)) res.json(adminData()); });
  app.post('/api/call/optout', (req, res) => { if (!guard(req, res)) return; if (!optout(req.body)) return res.status(400).json({ ok: false }); res.json({ ok: true }); });
  // Phone-friendly admin page (open it in the Android browser, type CALL_ADMIN_SECRET). /admin/* is not behind the website lock; the secret protects the data.
  app.get('/admin/call', (_req, res) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex'); res.sendFile(require('path').join(__dirname, 'admin.html')); });
  app.get('/admin/call/data', (req, res) => { if (guard(req, res)) { res.setHeader('Cache-Control', 'no-store'); res.json(adminData()); } });
  app.post('/admin/call/optout', (req, res) => { if (!guard(req, res)) return; if (!optout(req.body)) return res.status(400).json({ ok: false }); res.json({ ok: true }); });
}
module.exports = { attach, register, confirm, tick, setSocket: WA.setSocket, handleIncoming: WA.handleIncoming, _t: { allowedAt, cleanName, cleanNumber } };
