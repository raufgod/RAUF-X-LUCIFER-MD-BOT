'use strict';
// RAUF × LUCIFER MD BOT — "connected" DM, sent to EVERY person who links the bot
// (website pairing, WhatsApp .pair, Telegram /pair, hub/worker mode). Sent once per new link.
//   markPending(authDir)        called when a pairing code is issued  -> "welcome is owed"
//   onOpen(sock, number, dir)   called on every connection 'open'     -> sends the DM only if it is owed
// Old sessions that were linked before this update are never marked, so they are not spammed after a restart.
const fs = require('fs');
const path = require('path');

const FLAG = 'welcome-pending.json';
const settings = () => { try { return require('../settings'); } catch (_) { return {}; } };

function links() {
  const S = settings();
  return {
    telegram: S.telegramLink || 'https://t.me/Next_DYS',
    youtube: S.youtubeLink || 'https://youtube.com/@demoneye_official?si=e11wzia0R29I0weo'
  };
}

/** The two follow links, shown under the connected message (WhatsApp formatting). */
function linksBlock() {
  const L = links();
  return '━━━━━━━━━━━━━━━━━━━━\n' +
    '📲 *Follow our official Telegram channel for updates:*\n' + L.telegram + '\n\n' +
    '▶️ *Also subscribe to our YouTube channel:*\n' + L.youtube;
}

function caption(number) {
  const S = settings();
  const lines = [
    `🤖 *${S.botName || 'RAUF × LUCIFER MD BOT'} CONNECTED!*`,
    '',
    `✅ Your WhatsApp *+${number}* is now linked and online.`,
    `⏰ Time: ${new Date().toLocaleString()}`,
    `📌 Prefix: *${S.prefix || '.'}*  •  Type *${S.prefix || '.'}menu* to see all commands.`,
    ''
  ];
  if (S.channelLink) lines.push(`📢 *Official Channel:*\n${S.channelLink}\n`);
  if (S.groupLink) lines.push(`💫 *Official Group:*\n${S.groupLink}\n`);
  lines.push(linksBlock());
  return lines.join('\n');
}

function headerImage() {
  const S = settings();
  const cands = [path.join(process.cwd(), 'assets', 'rauf-header.jpg')];
  if (S.menuImage) cands.unshift(path.isAbsolute(S.menuImage) ? S.menuImage : path.join(process.cwd(), String(S.menuImage).replace(/^\.\//, '')));
  for (const p of cands) { try { if (fs.existsSync(p)) return fs.readFileSync(p); } catch (_) {} }
  return null;
}

async function sendConnectedDM(sock, number) {
  const jid = `${String(number).replace(/\D/g, '')}@s.whatsapp.net`;
  const text = caption(number);
  const img = headerImage();
  if (img) {
    try { await sock.sendMessage(jid, { image: img, caption: text, mimetype: 'image/jpeg' }); return; }
    catch (e) { console.error('[connectNotice] image failed, sending text:', e.message); }
  }
  await sock.sendMessage(jid, { text });
}

function markPending(authDir) {
  try { fs.mkdirSync(authDir, { recursive: true }); fs.writeFileSync(path.join(authDir, FLAG), String(Date.now())); } catch (_) {}
}

async function onOpen(sock, number, authDir) {
  const f = path.join(authDir, FLAG);
  try { if (!fs.existsSync(f)) return; fs.unlinkSync(f); } catch (_) { return; }
  try {
    await new Promise((r) => setTimeout(r, 3000));          // let the new link settle first
    await sendConnectedDM(sock, number);
  } catch (e) {
    console.error('[connectNotice] DM failed:', e.message);
    markPending(authDir);                                     // try again on the next connection
  }
}

/** true if a welcome is owed for this link (does not consume it) */
function isPending(authDir) { try { return fs.existsSync(path.join(authDir, FLAG)); } catch (_) { return false; } }
/** consume the "welcome owed" flag: returns true exactly once per new link */
function takePending(authDir) {
  const f = path.join(authDir, FLAG);
  try { if (!fs.existsSync(f)) return false; fs.unlinkSync(f); return true; } catch (_) { return false; }
}

module.exports = { markPending, isPending, takePending, onOpen, sendConnectedDM, linksBlock, links };
