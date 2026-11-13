'use strict';
// RAUF × LUCIFER MD BOT 💫 — group introduction (sent when the bot / owner joins a group)
//
// Fixes over the old inline code in main.js:
//  • Also listens to `groups.upsert` (this is the event WhatsApp fires when the bot itself is
//    added to a NEW group — `group-participants.update` often never contains the bot).
//  • A failing welcome handler can no longer block the intro.
//  • If the bot is removed/leaves, the group is forgotten, so re-joining sends the intro again.
//  • Retries (group metadata isn't always ready the instant the bot is added).
//  • In-flight lock → no duplicate intro when both events fire together.
//  • Tracked per bot session (multi-session / Telegram-paired bots get their own intro).
const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'data', 'owner-intros.json');
const headerPath = () => require('./sessionContext').assetPath('rauf-header.jpg');
const caption = () =>
  '╭━━〔 ♛ 𝐑𝐀𝐔𝐅 × 𝐋𝐔𝐂𝐈𝐅𝐄𝐑 | 𝐓𝐄𝐀𝐌 𝐑𝐀𝐔𝐅 × 𝐋𝐔𝐂𝐈𝐅𝐄𝐑 〕━━╮\n\n⚜️ 𝐀 𝐍𝐄𝐖 𝐏𝐑𝐄𝐒𝐄𝐍𝐂𝐄 𝐉𝐎𝐈𝐍𝐒 𝐓𝐇𝐈𝐒 𝐆𝐑𝐎𝐔𝐏 ⚜️\n\n' +
  require('./greeting').boldGreeting() + ', 𝐄𝐕𝐄𝐑𝐘𝐎𝐍𝐄!\n\nRAUF × LUCIFER MD BOT by RAUF × LUCIFER is now here. Keep the group respectful, and type *.menu* to view the available commands.\n\n' +
  '╰━━〔 𝐑𝐀𝐔𝐅 × 𝐋𝐔𝐂𝐈𝐅𝐄𝐑 𝐌𝐃 𝐁𝐎𝐓 〕━━╯';

const inflight = new Set();

const norm = v => String(v || '').trim().toLowerCase().replace(/:\d+(?=@)/g, '');
const digits = v => { const j = norm(v); return (j.endsWith('@s.whatsapp.net') || j.endsWith('@c.us')) ? j.split('@')[0].replace(/\D/g, '') : ''; };

const sentOnce = require('./sentOnce');
const botKey = sock => String(sock?.__sessionKey || sock?.__ownerNumber || 'main');
const gkey = (sock, gid) => `group:${botKey(sock)}:${gid}`;

function selfIds(sock) {
  return [sock?.user?.id, sock?.user?.lid, sock?.user?.jid].filter(Boolean).map(norm);
}
function idsOf(p) {
  return (typeof p === 'string' ? [p] : [p?.id, p?.jid, p?.lid, p?.phoneNumber]).filter(Boolean).map(norm);
}

async function includesBotOrOwner(sock, participants) {
  const me = selfIds(sock);
  const settings = require('../settings');
  const owner = String(sock?.__ownerNumber || process.env.PAIRING_NUMBER || process.env.OWNER_NUMBER || settings.ownerNumber || '').replace(/\D/g, '');
  let bot = false, ownerJoined = false;
  for (const p of participants || []) {
    const ids = idsOf(p);
    if (ids.some(i => me.includes(i))) { bot = true; break; }
    if (owner && ids.some(i => digits(i) === owner)) { ownerJoined = true; continue; }
    if (owner) {
      for (const jid of ids.filter(i => i.endsWith('@lid'))) {
        try {
          const pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(jid);
          if (digits(pn) === owner) ownerJoined = true;
        } catch {}
      }
    }
  }
  return { bot, ownerJoined };
}

async function sendIntro(sock, gid) {
  if (fs.existsSync(headerPath())) return sock.sendMessage(gid, { image: fs.readFileSync(headerPath()), caption: caption() });
  return sock.sendMessage(gid, { text: caption() });
}

/** Send the intro once for this (bot, group). Safe to call from several events. */
async function maybeSendIntro(sock, gid, reason = '') {
  if (!gid || !String(gid).endsWith('@g.us')) return false;
  const lockKey = botKey(sock) + '|' + gid;
  if (inflight.has(lockKey)) return false;
  inflight.add(lockKey);
  try {
    if (sentOnce.has(gkey(sock, gid))) return false;          // already introduced here once -> never again
    if (!sentOnce.claim(gkey(sock, gid))) return false;        // mark BEFORE sending (restart / double event safe)
    const waits = [1500, 4000, 8000];
    for (let i = 0; i < waits.length; i++) {
      await new Promise(r => setTimeout(r, waits[i]));      // let WhatsApp finish adding us
      try {
        await sendIntro(sock, gid);
        console.log(`[GROUP INTRO] sent to ${gid} (${reason})`);
        return true;
      } catch (e) {
        console.error(`[GROUP INTRO] attempt ${i + 1} failed for ${gid}:`, e?.message || e);
      }
    }
    sentOnce.release(gkey(sock, gid));                         // never delivered -> may try again later
    return false;
  } finally { inflight.delete(lockKey); }
}

/** group-participants.update  (action 'add') */
async function onParticipantsAdd(sock, gid, participants) {
  const { bot, ownerJoined } = await includesBotOrOwner(sock, participants);
  if (bot || ownerJoined) await maybeSendIntro(sock, gid, bot ? 'bot added' : 'owner joined');
}

/** group-participants.update (action 'remove') — the intro is ONCE only: nothing is forgotten when the bot leaves */
async function onParticipantsRemove() {}

/** groups.upsert — fired when the bot is added to a NEW group */
async function onGroupsUpsert(sock, groups) {
  for (const g of groups || []) maybeSendIntro(sock, g?.id, 'groups.upsert').catch(() => {});
}

module.exports = { maybeSendIntro, onParticipantsAdd, onParticipantsRemove, onGroupsUpsert };
