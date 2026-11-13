'use strict';
// First-contact private DM intro: "WELCOME TO <name of the user who connected this bot>" … "BY RAUF EXCLUSIVE".
const fs = require('fs');
const path = require('path');

const bold = s => String(s).replace(/[A-Za-z0-9]/g, ch => {
  const c = ch.charCodeAt(0);
  if (c >= 65 && c <= 90) return String.fromCodePoint(0x1D400 + c - 65);
  if (c >= 97 && c <= 122) return String.fromCodePoint(0x1D41A + c - 97);
  return String.fromCodePoint(0x1D7CE + c - 48);
});
function ownerName(sock) {
  const u = sock?.user || {};
  const n = String(u.name || u.verifiedName || '').trim();
  if (n) return n;
  const num = String(sock?.__ownerNumber || u.id || '').split(':')[0].split('@')[0].replace(/\D/g, '');
  return num ? '+' + num : 'MY';
}
function caption(sock) {
  const name = ownerName(sock);
  return '╭━━〔 𝐏𝐄𝐑𝐒𝐎𝐍𝐀𝐋 𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐈𝐎𝐍 〕━━╮\n\n' +
    `𝐖𝐄𝐋𝐂𝐎𝐌𝐄 𝐓𝐎 ${bold(name.toUpperCase())}\n\n` +
    require('./greeting').greeting() + `! You are connected with *${name}*. Your message has reached this inbox. Please leave your message or type *.menu* to explore the bot.\n\n` +
    '╰━━〔 𝐁𝐘 𝐑𝐀𝐔𝐅 𝐄𝐗𝐂𝐋𝐔𝐒𝐈𝐕𝐄 〕━━╯';
}
const inflight = new Set();
const sentOnce = require('./sentOnce');
const botKey = (sock) => String(sock?.__sessionKey || sock?.__ownerNumber || 'main');

/** every id this person can show up as (phone JID, @lid, alt fields) -> one person, one intro */
async function personIds(sock, mek) {
  const k = mek.key || {};
  const raw = [k.remoteJid, k.remoteJidAlt, k.participantAlt].filter(Boolean);
  const out = new Set(raw.map(sentOnce.idKey));
  for (const j of raw) {
    if (!String(j).endsWith('@lid')) continue;
    try {
      const pn = await Promise.race([sock.signalRepository?.lidMapping?.getPNForLID?.(j), new Promise((r) => setTimeout(r, 1500))]);
      if (pn) out.add(sentOnce.idKey(pn));
    } catch (_) {}
  }
  return [...out];
}

/** First-contact DM intro for main bot AND paired bots: sent ONCE per (bot, person) — never again after
 *  restarts / updates / reconnects, and never twice if the same person appears as @lid and as phone number. */
async function maybeSend(sock, chatUpdate, mek) {
  const jid = mek?.key?.remoteJid;
  if (chatUpdate?.type !== 'notify' || mek.key.fromMe || !jid || !(jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid'))) return;
  const bot = botKey(sock);
  const lock = bot + '|' + sentOnce.idKey(jid);
  if (inflight.has(lock)) return;                       // same person writing several messages at once
  inflight.add(lock);
  let keys = [];
  try {
    keys = (await personIds(sock, mek)).map((id) => `dm:${bot}:${id}`);
    if (!sentOnce.claimAny(keys)) return;               // already got it once -> never again
    try {
      const text = caption(sock);
      let img = null;
      try { const p = require('./sessionContext').assetPath('rauf-header.jpg'); if (p && fs.existsSync(p)) img = fs.readFileSync(p); } catch (_) {}
      if (!img) { try { img = fs.readFileSync(path.join(process.cwd(), 'assets', 'rauf-header.jpg')); } catch (_) {} }
      if (img) await sock.sendMessage(jid, { image: img, caption: text }); else await sock.sendMessage(jid, { text });
    } catch (e) {
      keys.forEach((k) => sentOnce.release(k));         // not delivered -> allow one more try on their next message
      console.error('[DM INTRO] send failed:', e?.message || e);
    }
  } finally { inflight.delete(lock); }
}
module.exports = { caption, maybeSend, ownerName };
