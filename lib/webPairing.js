// RAUF × LUCIFER MD BOT — web pairing server.
// A visitor types their number on the website -> this server creates a separate bot session for that number
// (lib/multiSession.js) -> WhatsApp pairing code is returned to the website.
//
//   GET  /                    pairing page (public/pairing.html)
//   GET  /api/health          { ok:true }
//   POST /api/pair            body { number:"919876543210" }  -> { ok, code }  |  { ok, alreadyLinked }
//   GET  /api/status/:number  -> { ok, connected }
//
// Panel env (all optional):  PAIR_PORT (else SERVER_PORT / PORT), PAIR_ALLOWED_ORIGINS (comma list, default *),
//                            PAIR_RATE_PER_IP (default 5 per 10 min), CUSTOM_PAIRING_CODE (8 letters/digits shown to everyone)
const path = require('path');
const express = require('express');
const multi = require('./multiSession');

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = Number(process.env.PAIR_RATE_PER_IP || 5);
const hits = new Map();           // ip -> [timestamps]
const busy = new Set();           // numbers being prepared right now
const connected = new Set();      // numbers that finished linking in this run
let started = false;
const SECRET = String(process.env.PAIR_SHARED_SECRET || '');   // empty = website is fully public (no password for visitors)
function sameSite(req) {   // the bot's own page (same host:port) calling its own API needs no secret
  try { const o = req.headers.origin || req.headers.referer; return !!o && new URL(o).host === req.headers.host; } catch (_) { return false; }
}
function authed(req) { return !SECRET || req.headers['x-pair-secret'] === SECRET || sameSite(req); }
function clientIp(req) { return (SECRET && authed(req) && String(req.headers['x-client-ip'] || '').slice(0, 64)) || req.ip; }

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_IP) { hits.set(ip, list); return true; }
  list.push(now); hits.set(ip, list); return false;
}
setInterval(() => { const now = Date.now(); for (const [ip, l] of hits) { const k = l.filter(t => now - t < WINDOW_MS); k.length ? hits.set(ip, k) : hits.delete(ip); } }, 5 * 60 * 1000).unref();

function cleanNumber(raw) {
  const n = String(raw || '').replace(/\D/g, '').replace(/^0+/, '');
  return /^[1-9]\d{7,14}$/.test(n) ? n : null;
}

const brand = require('./brand');
// Groq key typed on the website: kept in memory until the number is really linked (so nobody can set a key for a number they do not own)
const pendingAiKey = new Map();   // number -> { key, t }
function commitAiKey(number) {
  const p = pendingAiKey.get(number); pendingAiKey.delete(number);
  if (p && Date.now() - p.t < 30 * 60 * 1000) { try { require('./aiSession').setKey(number, p.key); console.log('[web-pairing] Groq key saved for', String(number).slice(0, 2) + '******' + String(number).slice(-2)); } catch (e) { console.error('[web-pairing] key save failed:', e.message); } }
}
setInterval(() => { const n = Date.now(); for (const [k, v] of pendingAiKey) if (n - v.t > 30 * 60 * 1000) pendingAiKey.delete(k); }, 5 * 60 * 1000).unref();

function requestCode(number) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const end = (fn, v) => { if (finished) return; finished = true; clearTimeout(timer); busy.delete(number); fn(v); };
    const timer = setTimeout(() => end(reject, new Error('WhatsApp did not answer in time. Please try again.')), 45 * 1000);
    busy.add(number);
    multi.createPairedSession(`web:${number}`, number, {
      onCode: (code) => end(resolve, code),
      onConnected: () => { connected.add(number); commitAiKey(number); },
      onDisconnected: () => connected.delete(number),
      onError: (e) => end(reject, e)
    }).catch((e) => end(reject, e));
  });
}

function start() {
  if (started) return; started = true;
  const port = Number(process.env.PAIR_PORT || process.env.SERVER_PORT || process.env.PORT || 2159);
  if (!port) { console.log('[web-pairing] no port found (set PAIR_PORT in the panel) — website pairing is OFF'); return; }

  const AI_RATE = (ip, max) => require('./aiChat').rate('pv:' + ip, max);
  const app = express();
  app.disable('x-powered-by');
  // How many reverse proxies (ngrok / cloudflared / panel proxy) sit in front of this server. The client address is the one the NEAREST
  // proxy saw; X-Forwarded-For values written by the visitor are ignored, so rate limits cannot be dodged by faking that header.
  // Default 1. Set TRUST_PROXY=0 when the port is exposed directly (no proxy), or a higher number for a longer proxy chain.
  { const tp = String(process.env.TRUST_PROXY === undefined ? '1' : process.env.TRUST_PROXY).trim().toLowerCase(); app.set('trust proxy', /^(0|false|no|off|)$/.test(tp) ? false : (/^\d+$/.test(tp) ? Number(tp) : 1)); }
  // health/ping first: before compression, JSON parsing and CORS work, so the response time shown on the website stays as low as possible
  app.get('/api/health', (req, res) => { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Cache-Control', 'no-store'); res.json({ ok: true, server: Math.max(1, Math.min(50, parseInt(req.query.s, 10) || 1)), t: Date.now(), uptime: Math.round(process.uptime()) }); });
  try { app.use(require('compression')({ threshold: 512 })); } catch (_) { console.log('[web] compression package missing - run npm install for faster pages'); }
  app.use(express.json({ limit: "10kb" }));

  const origins = String(process.env.PAIR_ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
  app.use((req, res, next) => {
    const o = req.headers.origin;
    if (o && (origins.includes('*') || origins.includes(o))) {
      res.setHeader('Access-Control-Allow-Origin', origins.includes('*') ? '*' : o);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning, x-pair-secret, x-client-ip');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });


  // ---- Website lock: password from the Telegram password bot (10 min, single use). Active only when TELEGRAM_PASSWORD_BOT_TOKEN is set.
  require('./webGate').attach(app);
  try { require('./callAgent').attach(app); } catch (e) { console.error('[call-agent] could not start:', e.message); }   // voice agent: registration -> welcome voice note ~2 min later

  // ---- Website live preview ("RAUF × LUCIFER MD BOT OS" phone): text-safe commands only, nothing is sent to WhatsApp
  const PV = require('./previewBot');
  // live command count = the same registry the bot's .menu uses (cached 10 min); the site shows this number
  let cmdCache = null;
  app.get('/api/command-count', async (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=300');
    try {
      if (!cmdCache || Date.now() - cmdCache.t > 600000) { const m = await require('./commandRegistry').buildMenu([]); cmdCache = { t: Date.now(), total: m.total, categories: m.groups.length }; }
      res.json({ ok: true, total: cmdCache.total, categories: cmdCache.categories });
    } catch (e) { res.json({ ok: false }); }
  });

  app.post('/api/preview', async (req, res) => {
    try {
      if (AI_RATE(req.ip, 30)) return res.status(429).json({ ok: false, error: 'Too many messages, wait a minute.' });
      const sid = String(req.body?.sid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'anon';
      const reply = await PV.run(String(req.body?.text || ''), sid, String(req.body?.prefix || '.').slice(0, 3));
      res.json({ ok: true, reply: brand.text(reply || '') });
    } catch (e) { console.error('[web-preview]', e?.message || e); res.status(500).json({ ok: false, error: 'Preview is busy, try again.' }); }
  });

  app.post('/api/pair', async (req, res) => {
    const mk = (n) => { const d = String(n || '').replace(/\D/g, ''); return d.length > 5 ? d.slice(0, 2) + '******' + d.slice(-2) : '***'; };   // phone numbers are masked in logs
    console.log('[web-pairing] request received from website, number =', mk(req.body?.number));
    if (!authed(req)) { console.log('[web-pairing] REJECTED: secret mismatch — BOT_SECRET in AI Studio must be exactly the same as the bot secret'); return res.status(401).json({ ok: false, error: 'Unauthorized' }); }
    const number = cleanNumber(req.body?.number);
    if (!number) return res.status(400).json({ ok: false, error: 'Enter a valid number with country code, e.g. 919876543210' });
    if (!brand.isAllowed(number)) return res.status(403).json({ ok: false, error: 'This number is not allowed to link with this bot.' });
    if (limited(clientIp(req))) return res.status(429).json({ ok: false, error: 'Too many tries. Please wait a few minutes.' });
    if (busy.has(number)) return res.status(409).json({ ok: false, error: 'This number is being prepared. Please wait a moment.' });

    const aiKey = String(req.body?.aiKey || '').trim();
    let aiKeyNote;
    if (aiKey) {
      const chk = await require('./aiSession').checkKey(aiKey);
      if (!chk.ok) return res.status(400).json({ ok: false, error: chk.error });
    }
    const existing = multi.getSession(number);
    if (existing?.sock?.user) {
      if (aiKey) aiKeyNote = 'this number is already linked, so the key was not changed. Send .aikey <key> in WhatsApp to change it.';
      return res.json({ ok: true, alreadyLinked: true, ...(aiKeyNote ? { aiKeyNote } : {}) });
    }
    if (aiKey) pendingAiKey.set(number, { key: aiKey, t: Date.now() });

    let editKey = null, logo, created = false;
    const srv = Math.max(1, Math.min(50, parseInt(req.body?.server, 10) || 1));
    try {
      if (req.body?.profile && typeof req.body.profile === 'object') {            // "Create your own bot": save the profile first
        const BP = require('./botProfile'), AIR = require('./aiChat').rate;
        if (BP.hasOwner(number)) {                                                // this number already has a bot: only its owner (edit key) may change it
          if (AIR('k' + req.ip, 12) || AIR('kn' + number, 20)) return res.status(429).json({ ok: false, error: 'Too many tries. Wait a minute.' });
          if (!BP.checkKey(number, req.body?.key ?? req.body.profile?.key)) return res.status(403).json({ ok: false, error: 'This number already has a bot. Use "Edit bot" with your edit key to change it.' });
        } else created = true;
        const r = await BP.save(number, req.body.profile); logo = r.logo; if (created) editKey = BP.newKey(number);   // a new key is made only for a brand-new bot
      }
    } catch (e) { if (created) { try { require('./botProfile').discard(number); } catch (_) {} } return res.status(400).json({ ok: false, error: String(e?.message || 'Please check the bot details.').slice(0, 160) }); }
    try {
      const code = await requestCode(number);
      if (code && code.alreadyLinked) { if (created) require('./botProfile').discard(number); return res.json({ ok: true, alreadyLinked: true }); }
      console.log('[web-pairing] code created for', mk(number), '| server', srv, editKey ? '| custom bot' : '');
      res.json({ ok: true, code, expiresIn: 60, ...(editKey ? { editKey, logo } : {}) });
    } catch (e) {
      console.error('[web-pairing]', mk(number), e?.message || e);
      if (created) { try { require('./botProfile').discard(number); } catch (_) {} }   // the creator never got the edit key, so do not keep a bot nobody can edit
      res.status(500).json({ ok: false, error: String(e?.message || 'Could not create the code. Please try again.').slice(0, 200) });
    }
  });

  // ---- edit a website-created bot later (needs the edit key shown once when the bot was created)
  app.post('/api/mybot/get', (req, res) => {
    const BP = require('./botProfile'), n = cleanNumber(req.body?.number);
    if (require('./aiChat').rate('k' + req.ip, 12) || (n && require('./aiChat').rate('kn' + n, 20))) return res.status(429).json({ ok: false, error: 'Too many tries. Wait a minute.' });   // per IP and per number
    if (!n || !BP.checkKey(n, req.body?.key)) return res.status(403).json({ ok: false, error: 'Number or edit key is wrong.' });
    res.json({ ok: true, profile: BP.read(n) });
  });
  app.post('/api/mybot/save', async (req, res) => {
    const BP = require('./botProfile'), n = cleanNumber(req.body?.number);
    if (require('./aiChat').rate('k' + req.ip, 12) || (n && require('./aiChat').rate('kn' + n, 20))) return res.status(429).json({ ok: false, error: 'Too many tries. Wait a minute.' });   // per IP and per number
    if (!n || !BP.checkKey(n, req.body?.key)) return res.status(403).json({ ok: false, error: 'Number or edit key is wrong.' });
    try { const r = await BP.save(n, req.body?.profile || {}, { liveSession: multi.getSession(n) }); console.log('[web-pairing] bot profile updated for', String(n).slice(0, 2) + '******' + String(n).slice(-2)); res.json({ ok: true, profile: r.profile, logo: r.logo }); }
    catch (e) { res.status(400).json({ ok: false, error: String(e?.message || 'Could not save.').slice(0, 160) }); }
  });

  app.get('/api/status/:number', async (req, res) => {
    if (!authed(req)) return res.status(401).json({ ok: false });
    if (require('./aiChat').rate('st' + req.ip, 60)) return res.status(429).json({ ok: false });   // stops scanning many numbers
    const number = cleanNumber(req.params.number);
    if (!number) return res.status(400).json({ ok: false });
    const s = multi.getSession(number);
    res.json({ ok: true, connected: !!(s?.sock?.user) || connected.has(number) });
  });

  // ---- Website AI assistant (bot-related answers only, last 20 messages remembered per AI per visitor)
  const AI = require('./aiChat');
  const sidOf = (x) => String(x || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'anon';
  app.post('/api/ai', async (req, res) => {
    try {
      if (AI.rate(req.ip)) return res.status(429).json({ ok: false, error: 'Too many messages, please wait a minute.' });
      const msg = String(req.body?.message || '').trim().slice(0, 500);
      if (!msg) return res.status(400).json({ ok: false, error: 'Write a message first.' });
      const key = `web:${sidOf(req.body?.sid)}`;
      const reply = await AI.askChain(key, msg, AI.supportPrompt(msg));      // provider order is decided in lib/aiChat.js (backend only)
      res.json({ ok: true, reply: brand.text(reply).slice(0, 1500), used: AI.count(key), max: AI.MAX_MSGS });
    } catch (e) { console.error('[web-ai]', e?.message || e); res.status(502).json({ ok: false, error: 'The assistant is busy right now. Please try again in a moment.' }); }
  });
  app.post('/api/ai/clear', (req, res) => { AI.clear(`web:${sidOf(req.body?.sid)}`); res.json({ ok: true }); });

  try { require('./adminPanel').mount(app, express, port); } catch (e) { console.error('[admin] could not start:', e.message); }
  app.use(brand.webMiddleware(path.join(__dirname, '..', 'public')));   // white label: pages with the new name / links (does nothing without data/brand.json)
  app.use(express.static(path.join(__dirname, '..', 'public'), { index: 'index.html', extensions: ['html'], maxAge: '1h', etag: true, setHeaders: (res, f) => { if (/\.(?:html|js|css)$/.test(f)) res.setHeader('Cache-Control', 'no-cache'); else if (/\.(?:png|jpe?g|webp|svg|ico|mp3|mp4|woff2?)$/.test(f)) res.setHeader('Cache-Control', 'public, max-age=604800'); } }));   // /pair -> pair.html, /ai -> ai.html ...

  app.listen(port, '0.0.0.0', () => { 
    require('./tunnel').start(port).catch(() => {});
    require('./cloudflared').start().catch(() => {});
    const dom = require('./siteUrl').base();
    console.log(`🌐 Website: ${dom ? dom + '/' : 'http://<panel-ip>:' + port + '/'}   (listening on port ${port})`);
    if (!dom) console.log('ℹ️  Set SITE_DOMAIN=your-domain.com in .env to show your own domain here and in the bot messages.');
  })
     .on('error', (e) => console.error('[web-pairing] cannot start:', e.message));
}

module.exports = { start };
