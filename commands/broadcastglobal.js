'use strict';
// RAUF × LUCIFER MD BOT — .broadcastglobal <message>
//
// Sends <message> to the DM of EVERY person who has linked (connected) the bot.
// Only the owner numbers from .env (OWNER_NUMBER and OWNER_NUMBER_2, comma separated is fine) may use it.
// Paired users are NOT owners of this command, even though they own their own bot.
//
// The message is sent from this process to every linked number.
const settingsModule = () => { try { return require('../settings'); } catch (_) { return {}; } };

const COMMANDS = ['broadcastglobal'];
const digits = (v) => String(v || '').replace(/\D/g, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Owner numbers from .env (falls back to settings.js, which itself reads the same variables). */
function globalOwners() {
  const out = new Set();
  const addAll = (v) => String(v || '').split(/[\s,;]+/).map(digits).filter(Boolean).forEach((n) => out.add(n));
  addAll(process.env.OWNER_NUMBER);
  addAll(process.env.OWNER_NUMBER_2);
  const S = settingsModule();
  if (!process.env.OWNER_NUMBER) addAll(S.ownerNumber);
  if (!process.env.OWNER_NUMBER_2) addAll(S.ownerNumber2);
  return out;
}

const normJid = (v) => String(v || '').trim().toLowerCase().replace(/:\d+(?=@)/g, '');
function phoneOf(jid) {
  const j = normJid(jid);
  return /@(s\.whatsapp\.net|c\.us)$/.test(j) ? digits(j.split('@')[0]) : '';
}

/** Is the sender one of the .env owner numbers? (sudo / paired-user "owner" status does NOT count) */
async function isGlobalOwner(sock, message) {
  const owners = globalOwners();
  if (!owners.size) return false;
  const k = message?.key || {};
  const cands = [k.participantAlt, k.remoteJidAlt, k.participant, k.remoteJid];
  if (k.fromMe) cands.push(sock?.user?.id);
  for (const c of cands) {
    const ph = phoneOf(c);
    if (ph && owners.has(ph)) return true;
  }
  // new-style @lid ids: ask Baileys for the real phone number behind the LID
  for (const c of cands) {
    const j = normJid(c);
    if (!j.endsWith('@lid')) continue;
    try {
      const pn = await sock?.signalRepository?.lidMapping?.getPNForLID?.(j);
      const ph = phoneOf(pn);
      if (ph && owners.has(ph)) return true;
    } catch (_) {}
  }
  return false;
}

const getText = (m) => {
  const x = m?.message || {};
  return String(x.conversation || x.extendedTextMessage?.text || x.imageMessage?.caption || x.videoMessage?.caption || '').trim();
};

/** Send `text` to every linked number that THIS process runs. Returns { sent, failed }. */
async function deliverLocal(text) {
  const multi = require('../lib/multiSession');
  let sent = 0, failed = 0;
  for (const n of multi.listNumbers()) {
    const sock = multi.getSession(n)?.sock;
    if (!sock || !sock.user) { failed++; continue; }
    try {
      await sock.sendMessage(`${n}@s.whatsapp.net`, { text });
      sent++;
    } catch (e) {
      failed++;
      console.error('[broadcastglobal] send failed for', n, e?.message || e);
    }
    await sleep(1500 + Math.floor(Math.random() * 1500));   // slow and steady: avoids WhatsApp spam limits
  }
  return { sent, failed };
}

async function handleBroadcastGlobal(sock, message) {
  const m = getText(message).match(/^\.broadcastglobal(?:\s+([\s\S]*))?$/i);
  if (!m) return false;
  const chatId = message.key.remoteJid;
  const say = (text) => sock.sendMessage(chatId, { text }, { quoted: message }).catch(() => {});

  if (!(await isGlobalOwner(sock, message))) {
    await say('❌ Only the bot owner can use *.broadcastglobal*.');
    return true;
  }
  const text = (m[1] || '').trim();
  if (!text) {
    await say('📢 *Usage:* .broadcastglobal <message>\n\nThe message is sent to the DM of everyone who has connected this bot.');
    return true;
  }

  try {

    const total = require('../lib/multiSession').listNumbers().length;
    if (!total) { await say('⚠️ No connected users found right now.'); return true; }
    await say(`📢 Broadcast started for *${total}* connected user(s).\nI will send a report here when it is finished.`);
    deliverLocal(text)
      .then((r) => say(`✅ *Broadcast finished*\n\n📨 Delivered: *${r.sent}*\n❌ Failed: *${r.failed}*\n👥 Connected users: *${total}*`))
      .catch((e) => console.error('[broadcastglobal]', e?.message || e));
  } catch (e) {
    console.error('[broadcastglobal]', e);
    await say('❌ Broadcast could not be started. Check the hosting logs.');
  }
  return true;
}

module.exports = { COMMANDS, handleBroadcastGlobal, deliverLocal, isGlobalOwner, globalOwners };
