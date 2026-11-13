'use strict';
// RAUF × LUCIFER MD BOT 💫 — persistent runtime overrides for settings.js (changed with owner commands).
// Saved in data/botConfig.json and re-applied by settings.js on every start.
const fs = require('fs');
const path = require('path');
const sessionContext = require('./sessionContext');

const FILE = path.join(__dirname, '..', 'data', 'botConfig.json');
const KEYS = ['botName', 'botOwner', 'packname', 'author', 'channelLink', 'prefix', 'telegramLink', 'websiteLink'];
const cleanFor = (key, value) => (['prefix', 'telegramLink', 'websiteLink'].includes(key) ? require('./botProfile').clean({ [key]: value })[key] : clean(value));

function read() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')) || {}; } catch (_) { return {}; } }

function clean(value) {
  const v = String(value ?? '').replace(/[\r\n\t;]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!v) throw new Error('Name cannot be empty.');
  if (v.length > 40) throw new Error('Name is too long (max 40 characters).');
  return v;
}

function applyGlobals(settings) {
  global.botName = settings.botName; global.botname = settings.botName;
  global.packname = settings.packname; global.author = settings.author;
}

/** Called once from settings.js */
function applyOverrides(settings) {
  const cfg = read();
  for (const k of KEYS) if (typeof cfg[k] === 'string' && cfg[k].trim()) settings[k] = cfg[k];
  return settings;
}

/** Change one value now (all commands read `settings` live) and keep it after restart. */
const SESSION_KEYS = ['botName', 'botOwner', 'packname', 'author', 'channelLink', 'prefix', 'telegramLink', 'websiteLink'];   // what a paired bot's owner may change
const ownFile = () => path.join(sessionContext.sessionDir(), 'botConfig.json');
function saveSessionValue(ctx, key, value) {
  ctx.overrides = ctx.overrides || {};
  ctx.overrides[key] = value;
  let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(ownFile(), 'utf8')) || {}; } catch (_) {}
  cfg[key] = value;
  fs.mkdirSync(path.dirname(ownFile()), { recursive: true });
  fs.writeFileSync(ownFile(), JSON.stringify(cfg, null, 2));
}
/** Load a session's own overrides (called when a paired session starts). */
function loadSessionOverrides(key) {
  try { return JSON.parse(fs.readFileSync(path.join(sessionContext.sessionDir(key), 'botConfig.json'), 'utf8')) || {}; } catch (_) { return {}; }
}

function set(key, value) {
  if (!KEYS.includes(key)) throw new Error('Unknown setting: ' + key);
  const ctx = sessionContext.current();
  if (ctx) {
    if (!SESSION_KEYS.includes(key)) throw new Error('This setting is fixed on paired bots (owner name stays RAUF × LUCIFER).');
    const old = require('../settings')[key];
    const next = cleanFor(key, value);
    saveSessionValue(ctx, key, next);
    return { old, next };
  }
  const settings = require('../settings');
  const old = settings[key];
  const next = cleanFor(key, value);
  settings[key] = next;
  applyGlobals(settings);
  const cfg = read(); cfg[key] = next;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
  return { old, next };
}

/** Store a validated WhatsApp channel/group link (used by .channeljid). */
function setLink(key, url) {
  if (key !== 'channelLink') throw new Error('Unknown link setting: ' + key);
  if (!/^https:\/\/whatsapp\.com\/channel\/[A-Za-z0-9_-]{10,}$/.test(String(url))) throw new Error('Invalid channel link.');
  const ctx = sessionContext.current();
  if (ctx) { saveSessionValue(ctx, key, url); return url; }
  const settings = require('../settings');
  settings.channelLink = url;
  global.channelLink = url;
  global.suppL = settings.groupLink || url;
  const cfg = read(); cfg[key] = url;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
  return url;
}

module.exports = { set, setLink, read, applyOverrides, loadSessionOverrides, KEYS, SESSION_KEYS };
