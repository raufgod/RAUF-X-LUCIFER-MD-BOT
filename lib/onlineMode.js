'use strict';
// RAUF × LUCIFER MD BOT 💫 — .online on / .online off  (owner / sudo only)
//
//  OFF (default): the bot never marks the account online. You only appear online when YOU open
//                 WhatsApp yourself; the rest of the time you show offline.
//  ON           : the account shows ONLINE all the time, whether you open WhatsApp or not.
//
// (A plain `.online` — without on/off — is still the old "who is online in this group" command.)
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'onlineMode.json');
const PING_MS = 15 * 1000;                 // WhatsApp drops "available" after a short idle → refresh
const timers = new Map();                  // socket -> interval

let state = null;
function load() {
  if (state) return state;
  try { state = JSON.parse(fs.readFileSync(FILE, 'utf8')) || {}; } catch { state = {}; }
  return state;
}
function save() {
  try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(state, null, 2)); }
  catch (e) { console.error('[onlineMode] save failed:', e.message); }
}

// 'main' = the primary bot session, otherwise the paired number (Telegram sessions)
const keyOf = sock => String(sock?.__ownerNumber || 'main');
function isEnabled(key = 'main') { return load()[key] === true; }       // default OFF

function stop(sock) {
  const t = timers.get(sock);
  if (t) { clearInterval(t); timers.delete(sock); }
}
const closed = sock => !!(sock?.ws && (sock.ws.isClosed || sock.ws.isClosing));

async function ping(sock, type) {
  try { await sock.sendPresenceUpdate(type); } catch (_) {}
}

/** Make the socket match the saved setting (ON → keep it online, OFF → release it). */
async function apply(sock, release = false) {
  stop(sock);
  if (isEnabled(keyOf(sock))) {
    await ping(sock, 'available');
    const t = setInterval(() => {
      if (closed(sock)) return stop(sock);                 // socket was replaced after a reconnect
      ping(sock, 'available');
    }, PING_MS);
    t.unref?.();
    timers.set(sock, t);
  } else if (release) {
    await ping(sock, 'unavailable');       // only when the owner just switched it OFF; on a normal connect we send nothing
  }
}

/** Call when a socket connects (connection === 'open'). */
function register(sock) { return apply(sock); }

async function setEnabled(sock, value) {
  load()[keyOf(sock)] = !!value;
  save();
  await apply(sock, true);
  return !!value;
}

function parseCommand(text) {
  const m = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ').match(/^\.online ?(on|off|status)$/);
  return m ? m[1] : null;
}

async function runCommand(sock, arg) {
  if (arg === 'on') {
    await setEnabled(sock, true);
    return '🟢 *Online mode ON*\nAb aap WhatsApp par hamesha *online* dikhenge, chahe aap app kholo ya na kholo.\n\nBand karne ke liye: *.online off*';
  }
  if (arg === 'off') {
    await setEnabled(sock, false);
    return '⚪ *Online mode OFF*\nAb aap sirf tab online dikhenge jab aap khud WhatsApp kholenge, baaki time offline.\n\nChalu karne ke liye: *.online on*';
  }
  return `${isEnabled(keyOf(sock)) ? '🟢' : '⚪'} *Online mode:* ${isEnabled(keyOf(sock)) ? 'ON (always online)' : 'OFF (online only while you have WhatsApp open)'}\n\n*.online on* / *.online off*\n(*.online* alone = shows who is online in the group)`;
}

module.exports = { isEnabled, register, apply, setEnabled, parseCommand, runCommand };
