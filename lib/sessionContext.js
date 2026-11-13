'use strict';
// RAUF × LUCIFER MD BOT 💫 — per-session isolation for paired bots (Telegram /pair and .pair).
//
// Every paired WhatsApp number runs the SAME command code as the main bot, but must NOT share
// settings with it (mode, antilink, autoread, bot name, menu image ...). Instead of touching
// hundreds of places that read "./data/xxx.json", this module:
//   1. remembers which session a piece of async work belongs to (AsyncLocalStorage), and
//   2. while inside a session, transparently redirects  data/<file>  ->  data/sessions/<number>/<file>
//      (reads fall back to the main bot's file until the session writes its own copy).
// The main bot runs with NO session context, so nothing changes for it.
const { AsyncLocalStorage } = require('async_hooks');
const fs = require('fs');
const path = require('path');

const als = new AsyncLocalStorage();
const DATA_ROOT = path.resolve(process.cwd(), 'data');
const SESS_ROOT = path.join(DATA_ROOT, 'sessions');
const SHARED = new Set(['baileys_store.json', '_defaults']);   // files/folders that stay common to every session
// A paired bot that has not saved its own copy of a file sees the FACTORY default in data/_defaults/
// (never the main bot's current state — .botoff / .mode private on the main bot must not leak into paired bots).
const DEFAULTS_DIR = path.join(DATA_ROOT, '_defaults');

function current() { return als.getStore() || null; }
function key() { return current()?.key || 'main'; }
function run(ctx, fn) { return als.run(ctx, fn); }
function sessionDir(k = key()) { return path.join(SESS_ROOT, String(k)); }

/** Where a path should really go for the current session (or the same path if no redirect applies). */
function redirect(p) {
  const ctx = als.getStore();
  if (!ctx || typeof p !== 'string' || !p) return p;
  let abs; try { abs = path.resolve(p); } catch { return p; }
  if (abs === DATA_ROOT || !abs.startsWith(DATA_ROOT + path.sep) || abs.startsWith(SESS_ROOT + path.sep)) return p;
  const rel = path.relative(DATA_ROOT, abs);
  if (SHARED.has(rel.split(path.sep)[0])) return p;
  return path.join(SESS_ROOT, ctx.key, rel);
}

function defaultFor(p) {
  try {
    const abs = path.resolve(p);
    if (!abs.startsWith(DATA_ROOT + path.sep)) return null;
    return path.join(DEFAULTS_DIR, path.relative(DATA_ROOT, abs));
  } catch { return null; }
}

// ---- fs shim (installed once, inert outside a session) --------------------------------------
const real = {};
function install() {
  if (fs.__kobSessionShim) return;
  fs.__kobSessionShim = true;

  const exists = p => { try { return real.existsSync(p); } catch { return false; } };
  const ensureParent = t => { try { fs.mkdirSync(path.dirname(t), { recursive: true }); } catch (_) {} };
  const names = ['readFileSync', 'writeFileSync', 'appendFileSync', 'existsSync', 'readdirSync', 'statSync', 'lstatSync',
    'unlinkSync', 'mkdirSync', 'renameSync', 'copyFileSync', 'accessSync', 'rmSync'];
  for (const n of names) real[n] = fs[n].bind(fs);

  // where to READ from: the session's own file, else the factory default, else (missing) the session path itself
  const readSource = (p, t) => {
    if (t === p || exists(t)) return t;
    const d = defaultFor(p);
    return d && exists(d) ? d : t;
  };
  const readLike = n => function (p, ...a) {
    const t = redirect(p);
    return real[n](t === p ? p : readSource(p, t), ...a);
  };
  const writeLike = n => function (p, ...a) {
    const t = redirect(p);
    if (t !== p) ensureParent(t);
    return real[n](t, ...a);
  };
  for (const n of ['readFileSync', 'readdirSync', 'statSync', 'lstatSync', 'accessSync']) fs[n] = readLike(n);
  for (const n of ['writeFileSync', 'appendFileSync', 'unlinkSync', 'rmSync']) fs[n] = writeLike(n);
  fs.existsSync = function (p) { const t = redirect(p); return t !== p ? (exists(t) || exists(defaultFor(p) || '')) : real.existsSync(p); };
  fs.mkdirSync = function (p, ...a) { const t = redirect(p); return real.mkdirSync(t, ...a); };
  fs.renameSync = function (a, b) { const tb = redirect(b); if (tb !== b) ensureParent(tb); return real.renameSync(redirect(a), tb); };
  fs.copyFileSync = function (a, b, ...r) { const tb = redirect(b); if (tb !== b) ensureParent(tb); const ta = redirect(a); return real.copyFileSync(ta === a ? a : readSource(a, ta), tb, ...r); };

  // fs.promises
  const P = fs.promises;
  const realP = {};
  for (const n of ['readFile', 'writeFile', 'appendFile', 'readdir', 'stat', 'unlink', 'mkdir', 'access', 'copyFile', 'rename']) {
    if (typeof P[n] !== 'function') continue;
    realP[n] = P[n].bind(P);
    const isRead = ['readFile', 'readdir', 'stat', 'access'].includes(n);
    P[n] = async function (p, ...a) {
      const t = redirect(p);
      if (t === p) return realP[n](p, ...a);
      if (isRead) return realP[n](readSource(p, t), ...a);
      if (n !== 'mkdir') ensureParent(t);
      return realP[n](t, ...a);
    };
  }
  // callback style readFile / writeFile (some old modules still use them)
  for (const n of ['readFile', 'writeFile', 'appendFile']) {
    const orig = fs[n].bind(fs);
    const isRead = n === 'readFile';
    fs[n] = function (p, ...a) {
      const t = redirect(p);
      if (t === p) return orig(p, ...a);
      if (isRead) return orig(readSource(p, t), ...a);
      ensureParent(t);
      return orig(t, ...a);
    };
  }
}
install();

// ---- per-session settings overrides (bot name, pack name, author, channel link) -------------
const OVERRIDABLE = new Set(['botName', 'packname', 'author', 'channelLink', 'botOwner', 'prefix', 'telegramLink', 'websiteLink']);
function override(prop) {
  const ov = als.getStore()?.overrides;
  return ov && OVERRIDABLE.has(prop) && typeof ov[prop] === 'string' && ov[prop] ? ov[prop] : undefined;
}

// ---- per-session image files (.setbotimage) -------------------------------------------------
/** Absolute path of an asset (e.g. 'rauf-header.jpg'): the session's own copy if it set one, else the main bot's. */
function assetPath(name) {
  const own = path.join(sessionDir(), 'assets', name);
  if (als.getStore() && real.existsSync && real.existsSync(own)) return own;
  return path.join(process.cwd(), 'assets', name);
}
/** Folder .setbotimage writes into: the session's own folder inside a session, else the shared assets. */
function assetWriteDir() {
  return als.getStore() ? path.join(sessionDir(), 'assets') : path.join(process.cwd(), 'assets');
}

/** In-memory cache that never leaks between sessions: byKey(map, () => initial) */
function perSession(map, make) {
  const k = key();
  if (!map.has(k)) map.set(k, make());
  return map.get(k);
}

module.exports = { run, current, key, sessionDir, redirect, override, assetPath, assetWriteDir, perSession, DATA_ROOT, SESS_ROOT };
