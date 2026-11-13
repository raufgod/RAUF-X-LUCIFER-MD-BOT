'use strict';
// RAUF × LUCIFER MD BOT — "send only ONCE" registry for every automatic message
// (DM intro, group intro, ...). One tiny append-only log:  ./state/sent-once.log   (+key / -key lines)
//
//  * lives in ./state/  (NOT in ./data/), so updating the bot with a new zip can never reset it
//  * every claim is written to disk immediately, BEFORE the message is sent -> restarts, crashes
//    and two messages arriving at the same moment can never produce a second copy
//  * old records (data/owner-intros.json, data/dm-intros/*, data/sessions/*/owner-intros.json)
//    are imported once, so people who already got an intro are NOT greeted again
const fs = require('fs');
const path = require('path');

const DIR = path.join(process.cwd(), 'state');
const FILE = path.join(DIR, 'sent-once.log');
let set = null;

function append(line) {
  try { fs.mkdirSync(DIR, { recursive: true }); fs.appendFileSync(FILE, line + '\n'); }
  catch (e) { console.error('[sentOnce] save failed:', e.message); }
}
/** same person => same key, whatever the JID flavour (device suffix, @s.whatsapp.net / @c.us / @lid) */
function idKey(jid) {
  const j = String(jid || '').trim().toLowerCase().replace(/:\d+(?=@)/, '');
  return (j.endsWith('@s.whatsapp.net') || j.endsWith('@c.us')) ? j.split('@')[0].replace(/\D/g, '') : j;
}
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; } }

function migrate() {
  if (set.has('__migrated_v1')) return;
  const add = (k) => { if (!set.has(k)) { set.add(k); append('+' + k); } };
  const data = path.join(process.cwd(), 'data');
  const fromIntro = (j, bot) => {
    if (!j) return;
    for (const g of j.groups || []) add(`group:${bot}:${g}`);
    for (const d of j.dms || []) add(`dm:${bot}:${idKey(d)}`);
    for (const [k, arr] of Object.entries(j.bots || {})) for (const g of arr || []) add(`group:${k}:${g}`);
  };
  fromIntro(readJson(path.join(data, 'owner-intros.json')), 'main');
  try { for (const f of fs.readdirSync(path.join(data, 'dm-intros'))) fromIntro(readJson(path.join(data, 'dm-intros', f)), f.replace(/\.json$/, '')); } catch (_) {}
  try { for (const n of fs.readdirSync(path.join(data, 'sessions'))) fromIntro(readJson(path.join(data, 'sessions', n, 'owner-intros.json')), n); } catch (_) {}
  add('__migrated_v1');
}
function load() {
  if (set) return set;
  set = new Set();
  try {
    for (const line of fs.readFileSync(FILE, 'utf8').split('\n')) {
      if (!line) continue;
      if (line[0] === '+') set.add(line.slice(1)); else if (line[0] === '-') set.delete(line.slice(1));
    }
  } catch (_) {}
  migrate();
  return set;
}

const has = (key) => load().has(key);
/** true only the FIRST time this key is claimed (ever). Marks it immediately. */
function claim(key) { const s = load(); if (s.has(key)) return false; s.add(key); append('+' + key); return true; }
/** true only if NONE of the keys was claimed before; then all of them are marked. */
function claimAny(keys) {
  const s = load(); const first = !keys.some((k) => s.has(k));
  for (const k of keys) if (!s.has(k)) { s.add(k); append('+' + k); }
  return first;
}
function release(key) { const s = load(); if (s.delete(key)) append('-' + key); }
/** forget every key that starts with prefix (used by .resetintro) */
function releasePrefix(prefix) { for (const k of [...load()]) if (k.startsWith(prefix)) release(k); }

module.exports = { has, claim, claimAny, release, releasePrefix, idKey };
