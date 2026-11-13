'use strict';
// RAUF × LUCIFER MD BOT — Admin panel API (used by the "Admin" section of the website).
// Access: secret link printed in the console on every start (no password).
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const multi = (() => { try { return require('./multiSession'); } catch (_) { return null; } })();
// Optional cluster/worker module (not shipped in this build). Without it the panel simply uses the local sessions.
const CL = () => { try { const c = require('./cluster'); return c && typeof c.listSessions === 'function' ? c : null; } catch (_) { return null; } };

// ---- console ring buffer (last 400 lines, secrets masked)
const LOGS = [];
const mask = (t) => String(t).replace(/(NGROK_AUTHTOKEN\s*=\s*)\S+/gi, '$1***').replace(/\b[0-9A-Za-z]{2}[0-9A-Za-z_]{36,}\b/g, '***');
['log', 'info', 'warn', 'error'].forEach((k) => {
  const orig = console[k].bind(console);
  console[k] = (...a) => { try { LOGS.push(new Date().toISOString().slice(11, 19) + ' ' + (k === 'error' ? '! ' : '') + mask(a.map((x) => (typeof x === 'string' ? x : (x && x.message) || JSON.stringify(x))).join(' ')).slice(0, 400)); if (LOGS.length > 400) LOGS.shift(); } catch (_) {} orig(...a); };
});

// ---- secret link instead of a password
// Every start the bot prints a NEW link in the console:  <your domain>/admin/<random key>
// Opening that link opens the admin panel directly - no password. Anyone who has the link can use the panel, so keep it private.
let KEY = crypto.randomBytes(32);                       // signs the session tokens
// ADMIN_CODE in .env = your own easy code: https://your-domain/<code> opens the panel (also /admin/<code>). Empty = random key on every start.
const CODE_RE = /^[A-Za-z0-9_-]{8,64}$/;
const envCode = String(process.env.ADMIN_CODE || '').trim();
let LINK_KEY = CODE_RE.test(envCode) ? envCode : crypto.randomBytes(24).toString('hex');
const FIXED = CODE_RE.test(envCode);
if (envCode && !FIXED) console.log('[admin] ADMIN_CODE ignored: use 8-64 letters, digits, - or _ (a random link is used instead).');
const eq = (a, b) => { const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest(); return crypto.timingSafeEqual(x, y); };
const sign = (exp) => { const p = String(exp); return p + '.' + crypto.createHmac('sha256', KEY).update(p).digest('hex'); };
const parse = (t) => { const [p, h] = String(t || '').split('.'); if (!p || !h) return null; if (+p < Date.now() || !eq(h, crypto.createHmac('sha256', KEY).update(p).digest('hex'))) return null; return { ok: true }; };
const fails = new Map();

// ---- tiny zip reader (central directory, stored/deflate) — no dependency
function readZip(buf) {
  let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('not a zip');
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); const out = [];
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad zip');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nl).toString('utf8'); p += 46 + nl + xl + cl;
    if (name.endsWith('/')) continue;
    const ln = buf.readUInt16LE(lo + 26), lx = buf.readUInt16LE(lo + 28), ds = lo + 30 + ln + lx, raw = buf.slice(ds, ds + csize);
    out.push({ name, data: method === 0 ? raw : zlib.inflateRawSync(raw) });
  }
  return out;
}
const PROTECT = [/^session\//, /^multi_sessions\//, /^node_modules\//, /^backups\//, /^bin\//, /^ngrok\.txt$/, /^cloudflared\.txt$/, /^\.env/, /^package-lock\.json$/];
const state = { busy: false, msg: 'idle' };
function upgrade(buf) {
  const files = readZip(buf);
  const pk = files.find((f) => /(^|\/)package\.json$/.test(f.name) && f.name.split('/').length <= 2);
  if (!pk || !files.some((f) => /(^|\/)index\.js$/.test(f.name))) throw new Error('This zip does not look like a RAUF × LUCIFER MD BOT bot (package.json / index.js missing).');
  const prefix = pk.name.includes('/') ? pk.name.split('/')[0] + '/' : '';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-'), bk = path.join(ROOT, 'backups', stamp);
  let wrote = 0, oldPkg = ''; try { oldPkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'); } catch (_) {}
  for (const f of files) {
    let rel = f.name.replace(/\\/g, '/'); if (prefix) { if (!rel.startsWith(prefix)) continue; rel = rel.slice(prefix.length); }
    if (!rel || rel.startsWith('/') || rel.split('/').includes('..') || PROTECT.some((r) => r.test(rel))) continue;
    const dest = path.join(ROOT, rel); if (!dest.startsWith(ROOT + path.sep)) continue;
    if (fs.existsSync(dest)) { try { fs.mkdirSync(path.dirname(path.join(bk, rel)), { recursive: true }); fs.copyFileSync(dest, path.join(bk, rel)); } catch (_) {} }
    fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, f.data); wrote++;
  }
  return { wrote, depsChanged: oldPkg !== pk.data.toString('utf8'), backup: 'backups/' + stamp };
}
function finish(depsChanged) {
  const restart = () => { state.msg = 'restarting…'; setTimeout(() => process.exit(0), 1500); };
  if (!depsChanged) return restart();
  state.msg = 'installing packages (can take a few minutes)…';
  const c = cp.spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: ROOT });
  const feed = (d) => String(d).split('\n').filter(Boolean).slice(-3).forEach((l) => console.log('[npm]', l.slice(0, 200)));
  c.stdout.on('data', feed); c.stderr.on('data', feed); c.on('error', () => { state.busy = false; state.msg = 'npm failed - restart manually'; });
  c.on('close', (code) => { console.log('[upgrade] npm install finished with code', code); restart(); });
}

function mount(app, express, port) {
  const base = require('./siteUrl').base() || ('http://<panel-ip>:' + (port || ''));
  console.log(FIXED ? '🔑 ADMIN PANEL:  ' + base + '/' + LINK_KEY + '   (your ADMIN_CODE - keep it private)' : '🔑 ADMIN PANEL LINK (new on every start, keep it private):\n   ' + base + '/admin/' + LINK_KEY);
  const sess = (req) => parse((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  const auth = (req, res, next) => { const t = sess(req); if (!t) return res.status(401).json({ ok: false, error: 'This admin link has expired. Open the newest link from the console.' }); next(); };
  const strong = (_q, _r, next) => next();
  const limited = (req, res) => { const f = (fails.get(req.ip) || []).filter((t) => Date.now() - t < 15 * 60e3); fails.set(req.ip, f); if (f.length >= 10) { res.status(429).json({ ok: false, error: 'Too many wrong tries. Try again in 15 minutes.' }); return true; } return false; };
  const bad = (req) => { const f = fails.get(req.ip) || []; f.push(Date.now()); fails.set(req.ip, f); };
  // the admin page itself lives outside /public, so it is never reachable without the secret link
  const keyOk = (req, res) => { if (limited(req, res)) return false; if (!eq(req.params.key, LINK_KEY)) { bad(req); res.status(404).send('Not found'); return false; } res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex'); return true; };
  const ASSET = { 'app.js': ['admin-app.js', 'application/javascript; charset=utf-8'], 'app.css': ['admin.css', 'text/css; charset=utf-8'] };
  app.get('/admin/:key/:file', (req, res) => {
    const a = ASSET[req.params.file]; if (!a || !keyOk(req, res)) return a ? undefined : res.status(404).send('Not found');
    res.type(a[1]); res.send(fs.readFileSync(path.join(__dirname, a[0]), 'utf8'));
  });
  app.get('/admin/:key', (req, res) => {
    if (!keyOk(req, res)) return;
    try { require('./webGate').grant(req, res); } catch (_) {}      // so the page loads even when the website lock is ON
    res.type('html').send(fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf8').replace(/__KEY__/g, LINK_KEY));
  });
  // short link: <domain>/<ADMIN_CODE>. Any other one-word path falls through to the website; random guesses are counted and blocked.
  const PUB = path.join(ROOT, 'public');
  app.get('/:key', (req, res, next) => {
    const k = req.params.key;
    if (FIXED && eq(k, LINK_KEY)) {
      if (limited(req, res)) return; res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex');
      try { require('./webGate').grant(req, res); } catch (_) {}
      return res.type('html').send(fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf8').replace(/__KEY__/g, LINK_KEY));
    }
    if (FIXED && /^[A-Za-z0-9_-]{8,64}$/.test(k) && !fs.existsSync(path.join(PUB, k)) && !fs.existsSync(path.join(PUB, k + '.html'))) bad(req);   // looks like a code guess
    next();
  });
  app.post('/api/admin/enter', (req, res) => {
    if (limited(req, res)) return;
    if (!eq(req.body?.key || '', LINK_KEY)) { bad(req); console.log('[admin] wrong admin link used'); return res.status(401).json({ ok: false, error: 'Wrong or old admin link. Open the newest link from the console.' }); }
    fails.delete(req.ip); console.log('[admin] opened'); res.json({ ok: true, token: sign(Date.now() + 12 * 3600e3) });
  });
  // ---- white label: Admin > Brand
  app.get('/api/admin/brand', auth, (_q, res) => res.json({ ok: true, brand: require('./brand').view() }));
  app.post('/api/admin/brand', auth, async (req, res) => {
    try {
      const B = require('./brand'), r = B.save(req.body || {});
      console.log('[admin] brand saved:', B.get() && B.get().botName);
      res.json({ ok: true, restartNeeded: r.restartNeeded, brand: B.view() });
    } catch (e) { res.status(400).json({ ok: false, error: String(e.message || e).slice(0, 120) }); }
  });
  app.get('/api/admin/workers', auth, (_q, res) => res.json({ ok: true, cluster: false }));
  app.get('/api/admin/overview', auth, async (_q, res) => { try {
    let version = '?'; try { version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version; } catch (_) {}
    let list = []; try { const dir = multi?.DATA_DIR || path.join(ROOT, 'multi_sessions'); list = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d{5,16}$/.test(d.name)).map((d) => ({ number: d.name, active: !!multi?.getSession(d.name), since: fs.statSync(path.join(dir, d.name)).mtime })); } catch (_) {}
    let cmds = 0; try { cmds = fs.readdirSync(path.join(ROOT, 'commands')).filter((f) => f.endsWith('.js')).length; } catch (_) {}
    if (CL()) { try { list = (await CL().listSessions()).map((x) => ({ number: x.number, active: x.active, since: x.since, worker: x.worker })); } catch (_) {} }
    res.json({ ok: true, version, node: process.version, uptime: Math.round(process.uptime()), memMB: Math.round(process.memoryUsage().rss / 1048576), platform: process.platform, commands: cmds, sessions: list, upgrade: state });
  } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e).slice(0, 120) }); } });
  app.post('/api/admin/session/remove', auth, async (req, res) => {
    const n = String(req.body?.number || '').replace(/\D/g, ''); if (n.length < 5) return res.status(400).json({ ok: false, error: 'Bad number' });
    try { if (CL()) await CL().removeNumber(n); else await multi.removeSession(n); console.log('[admin] session removed:', n); res.json({ ok: true }); } catch (e) { res.status(500).json({ ok: false, error: String(e.message || e).slice(0, 100) }); }
  });
  // Console: a small, safe set of panel commands (no shell access)
  app.post('/api/admin/command', auth, async (req, res) => {
    const line = String(req.body?.cmd || '').replace(/^[.\/!]/, '').trim().slice(0, 200); if (!line) return res.status(400).json({ ok: false, error: 'Type a command.' });
    const [c0, ...rest] = line.split(/\s+/), cmd = c0.toLowerCase(), arg = rest.join(' ').trim(), out = [];
    console.log('[admin] > ' + line);
    try {
      const bc = require('./botConfig');
      if (cmd === 'help') out.push('help | status | sessions | prefix <symbol> | botname <name> | owner <name> | telegram <https link> | website <https link> | mode public|private | clearlogs | restart');
      else if (cmd === 'status') { let v = '?'; try { v = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version; } catch (_) {} out.push(`version ${v} | uptime ${Math.round(process.uptime() / 60)} min | memory ${Math.round(process.memoryUsage().rss / 1048576)} MB`); }
      else if (cmd === 'sessions') { const dir = multi?.DATA_DIR || path.join(ROOT, 'multi_sessions'); let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) {} const l = ents.filter((d) => d.isDirectory() && /^\d{5,16}$/.test(d.name)).map((d) => '+' + d.name + (multi?.getSession(d.name) ? ' online' : ' offline')); out.push(l.length ? l.join('\n') : 'No paired sessions.'); }
      else if (cmd === 'prefix' || cmd === 'botname' || cmd === 'owner' || cmd === 'telegram' || cmd === 'website') { const key = { prefix: 'prefix', botname: 'botName', owner: 'botOwner', telegram: 'telegramLink', website: 'websiteLink' }[cmd]; if (!arg) out.push(`${cmd}: ${require('../settings')[key] || '(not set)'}`); else { const r = bc.set(key, arg); out.push(`${cmd}: ${r.old} -> ${r.next}`); } }
      else if (cmd === 'mode') { if (!/^(public|private)$/i.test(arg)) throw new Error('Use: mode public  or  mode private'); const f = path.join(ROOT, 'data', 'messageCount.json'); let j = {}; try { j = JSON.parse(fs.readFileSync(f, 'utf8')) || {}; } catch (_) {} j.isPublic = arg.toLowerCase() === 'public'; fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(j)); out.push('mode: ' + arg.toLowerCase()); }
      else if (cmd === 'clearlogs') { LOGS.length = 0; out.push('logs cleared'); }
      else if (cmd === 'restart') { out.push('restarting…'); setTimeout(() => process.exit(0), 900); }
      else throw new Error('Unknown command. Type help.');
    } catch (e) { return res.status(400).json({ ok: false, error: String(e.message || e).slice(0, 160) }); }
    out.forEach((o) => console.log('[admin] ' + o)); res.json({ ok: true, out });
  });

  // ---- health: which features are configured (yes/no only, never the secrets)
  const has = (k) => !!String(process.env[k] || '').trim();
  app.get('/api/admin/health', auth, (_q, res) => {
    let isPublic = true; try { const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'messageCount.json'), 'utf8')); if (typeof d.isPublic === 'boolean') isPublic = d.isPublic; } catch (_) {}
    let prefix = '.'; try { prefix = require('../settings').prefix || '.'; } catch (_) {}
    res.json({ ok: true, isPublic, prefix, checks: [
      { k: 'Owner pairing number', ok: has('PAIRING_NUMBER'), note: has('PAIRING_NUMBER') ? 'ON - a code is generated for it' : 'OFF - no owner pairing code' },
      { k: 'Telegram bot', ok: has('TELEGRAM_BOT_TOKEN'), note: has('TELEGRAM_BOT_TOKEN') ? 'token set' : 'no token' },
      { k: 'AI voice (Groq)', ok: has('GROQ_API_KEY'), note: has('GROQ_API_KEY') ? 'key set' : 'no key' },
      { k: 'Own domain', ok: !!require('./siteUrl').base(), note: require('./siteUrl').base() || 'not set' },
      { k: 'Cloudflare tunnel', ok: has('CLOUDFLARE_TUNNEL_TOKEN'), note: has('CLOUDFLARE_TUNNEL_TOKEN') ? 'token set' : 'not used' },
      { k: 'Fixed admin code', ok: FIXED, note: FIXED ? 'ON - /' + LINK_KEY.slice(0, 3) + '…' : 'random link on every start' }
    ] });
  });
  app.get('/api/admin/backups', auth, (_q, res) => {
    let l = []; try { l = fs.readdirSync(path.join(ROOT, 'backups'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort().reverse().slice(0, 30); } catch (_) {}
    res.json({ ok: true, backups: l });
  });
  // change the admin code from the panel (written to .env so it stays after restart)
  app.post('/api/admin/code', auth, (req, res) => {
    const c = String(req.body?.code || '').trim();
    if (!CODE_RE.test(c)) return res.status(400).json({ ok: false, error: 'Use 8-64 letters, digits, - or _.' });
    try {
      const f = path.join(ROOT, '.env'); let t = ''; try { t = fs.readFileSync(f, 'utf8'); } catch (_) {}
      t = /^ADMIN_CODE=.*$/m.test(t) ? t.replace(/^ADMIN_CODE=.*$/m, 'ADMIN_CODE=' + c) : t.replace(/\s*$/, '\n') + 'ADMIN_CODE=' + c + '\n';
      fs.writeFileSync(f, t, { mode: 0o600 });
    } catch (e) { return res.status(500).json({ ok: false, error: 'Could not write .env' }); }
    console.log('[admin] admin code changed - restart the bot to use the new code');
    res.json({ ok: true, restartNeeded: true });
  });
  app.get('/api/admin/logs', auth, (_q, res) => res.json({ ok: true, lines: LOGS.slice(-250) }));
  app.post('/api/admin/restart', auth, strong, (_q, res) => { console.log('[admin] restart requested'); res.json({ ok: true }); setTimeout(() => process.exit(0), 900); });
  app.get('/api/admin/upgrade/status', auth, (_q, res) => res.json({ ok: true, ...state }));
  app.post('/api/admin/upgrade', auth, strong, express.raw({ type: () => true, limit: '90mb' }), (req, res) => {
    if (state.busy) return res.status(409).json({ ok: false, error: 'An upgrade is already running.' });
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length < 1000) throw new Error('No zip received.');
      state.busy = true; state.msg = 'applying files…';
      const r = upgrade(req.body); console.log('[admin] upgrade applied:', r.wrote, 'files, backup in', r.backup);
      res.json({ ok: true, files: r.wrote, depsChanged: r.depsChanged, backup: r.backup }); finish(r.depsChanged);
    } catch (e) { state.busy = false; state.msg = 'idle'; res.status(400).json({ ok: false, error: String(e.message || e).slice(0, 150) }); }
  });
}
module.exports = { mount, readZip, upgrade };
