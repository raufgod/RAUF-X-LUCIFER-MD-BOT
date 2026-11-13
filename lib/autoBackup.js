'use strict';
// RAUF × LUCIFER MD BOT — automatic backup of USER DATA only (NO restart).
// Every BACKUP_INTERVAL_HOURS (default 3) the bot zips ONLY the user data into:
//   ./backups/auto/backup-0001_<date>_<time>.zip, backup-0002_..., (in sequence)
// What is inside: data/ (settings, warnings, bans, groups, users, per-number settings ...) and the small
// owner map of linked numbers (session.json). NOT inside: bot code, website, node_modules, WhatsApp login keys,
// message store, .env - so a backup is a few KB, not tens of MB.
// To restore: unzip the backup into the bot folder (same paths) and restart.
// Only the newest BACKUP_KEEP (default 100) zips are kept; BACKUP_KEEP=0 keeps everything.
//
// Env (optional):  BACKUP_INTERVAL_HOURS=3   BACKUP_KEEP=100   AUTO_BACKUP=false (turn off)
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'backups', 'auto');
const PREFIX = 'backup-';

// user data only
const MAX_FILE = 1024 * 1024;                                   // a single file bigger than 1 MB is media/cache, not user data
const SKIP_IN_DATA = new Set(['_defaults', 'baileys_store.json']);
const SKIP_FILES = /(\.log$|\.tmp$|\.part$|\.mp[34]$|\.ogg$|\.webp$|\.jpe?g$|\.png$)/i;
const META_ROOTS = [process.env.TELEGRAM_SESSIONS_DIR || 'telegram_sessions', 'multi_sessions'];   // only their small session.json owner files

let running = false;
let timer = null;

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
const stamp = () => {
  const d = new Date(), p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
};

const seqOf = (f) => { const m = /^backup-(\d+)_/.exec(f); return m ? Number(m[1]) : 0; };
function listBackups() {   // newest first (by sequence number)
  try {
    return fs.readdirSync(DIR)
      .filter((f) => /^backup-\d+_.*\.zip$/.test(f))
      .map((f) => ({ f, n: seqOf(f), t: fs.statSync(path.join(DIR, f)).mtimeMs }))
      .sort((a, b) => b.n - a.n);
  } catch (_) { return []; }
}
const nextSeq = () => String((listBackups()[0]?.n || 0) + 1).padStart(4, '0');

function prune(keep) {
  if (!keep) return;
  const all = listBackups();
  for (const b of all.slice(keep)) { try { fs.unlinkSync(path.join(DIR, b.f)); } catch (_) {} }
}

/** Take one backup now. Resolves with the zip path (or null if it failed). Never throws, never restarts. */
function backupNow() {
  if (running) return Promise.resolve(null);
  running = true;
  return new Promise((resolve) => {
    let done = false;
    const finish = (val) => { if (done) return; done = true; running = false; resolve(val); };
    try {
      fs.mkdirSync(DIR, { recursive: true });
      const archiver = require('archiver');
      const finalName = path.join(DIR, `${PREFIX}${nextSeq()}_${stamp()}.zip`);
      const tmpName = finalName + '.part';
      const out = fs.createWriteStream(tmpName);
      const zip = archiver('zip', { zlib: { level: 6 } });   // the data is tiny, so better compression costs nothing
      out.on('close', () => {
        try { fs.renameSync(tmpName, finalName); } catch (e) { console.error('[autoBackup] rename failed:', e.message); return finish(null); }
        prune(process.env.BACKUP_KEEP === '0' ? 0 : num(process.env.BACKUP_KEEP, 100));
        console.log(`💾 Auto backup saved: backups/auto/${path.basename(finalName)} (${(zip.pointer() / 1048576).toFixed(1)} MB)`);
        finish(finalName);
      });
      zip.on('warning', (e) => console.warn('[autoBackup] warning:', e.message));
      zip.on('error', (e) => { console.error('[autoBackup] failed:', e.message); try { fs.unlinkSync(tmpName); } catch (_) {} finish(null); });
      zip.pipe(out);
      add(zip, path.join(ROOT, 'data'), 'data');
      for (const m of META_ROOTS) addMeta(zip, path.resolve(ROOT, m), m.replace(/^\.\//, ''));
      zip.append('RAUF x LUCIFER MD BOT - user data backup\nCreated: ' + new Date().toISOString() + '\nRestore: unzip into the bot folder (same paths) and restart.\nNot included: code, website, WhatsApp login keys, .env\n', { name: 'README.txt' });
      zip.finalize();
    } catch (e) {
      console.error('[autoBackup] failed:', e.message);
      finish(null);
    }
  });
}

function add(zip, abs, rel) {
  let ents = [];
  try { ents = fs.readdirSync(abs, { withFileTypes: true }); } catch (_) { return; }
  for (const e of ents) {
    const r = `${rel}/${e.name}`;
    const p = path.join(abs, e.name);
    if (e.isDirectory()) { if (!(rel === 'data' && SKIP_IN_DATA.has(e.name)) && e.name !== 'assets' && e.name !== 'media') add(zip, p, r); }
    else if (e.isFile() && !SKIP_FILES.test(e.name) && !(rel === 'data' && SKIP_IN_DATA.has(e.name))) {
      try { if (fs.statSync(p).size <= MAX_FILE) zip.file(p, { name: r }); } catch (_) {}
    }
  }
}

// owner map of linked numbers: <root>/[<telegramId>/]<number>/session.json  (never creds/keys)
function addMeta(zip, abs, rel, depth = 0) {
  if (depth > 2) return;
  let ents = [];
  try { ents = fs.readdirSync(abs, { withFileTypes: true }); } catch (_) { return; }
  for (const e of ents) {
    const p = path.join(abs, e.name);
    if (e.isDirectory()) addMeta(zip, p, `${rel}/${e.name}`, depth + 1);
    else if (e.isFile() && e.name === 'session.json') { try { zip.file(p, { name: `${rel}/${e.name}` }); } catch (_) {} }
  }
}

/** Start the schedule. Safe to call once at boot. */
function start() {
  if (String(process.env.AUTO_BACKUP || '').toLowerCase() === 'false') { console.log('💾 Auto backup is OFF (AUTO_BACKUP=false)'); return; }
  if (timer) return;
  const every = num(process.env.BACKUP_INTERVAL_HOURS, 3) * 3600 * 1000;
  // if the newest backup is already fresh (e.g. the bot was just restarted by hand), wait out the rest of the 3 hours
  const last = listBackups()[0];
  const firstIn = last ? Math.max(60 * 1000, every - (Date.now() - last.t)) : 2 * 60 * 1000;
  const loop = () => { backupNow().catch(() => {}); };
  setTimeout(() => { loop(); timer = setInterval(loop, every); if (timer.unref) timer.unref(); }, firstIn).unref?.();
  console.log(`💾 Auto backup ON — every ${every / 3600000}h into backups/auto/ (next in ~${Math.round(firstIn / 60000)} min). No restart.`);
}

module.exports = { start, backupNow, listBackups, DIR };
