'use strict';
// RAUF × LUCIFER MD BOT 💫 — whenever someone asks the bot for ITS group link, answer with the official one.
//  commands : .support .supportgroup .botgroup .officialgroup .joingroup .gclink .botgc .group (alone)
//  DM text  : "group link", "bot group link", "gc link", "group ka link" ... (private chats only, short messages)
//  (.link / .invite keep returning the invite link of the CURRENT group — that is an admin tool, unchanged.)
const settings = require('../settings');

const COMMANDS = new Set(['support', 'supportgroup', 'botgroup', 'officialgroup', 'joingroup', 'gclink', 'botgc', 'group']);
const PHRASE = /^(?:(?:bot|official|support)\s+)?(?:group|gc|whatsapp group)\s*(?:link|lnk|url)(?:\s+(?:send|please|plz|pls))?[?.! ]*$/i;

function isCommand(text) {
  const m = String(text || '').trim().toLowerCase().match(/^\.([a-z]+)$/);     // `.group open` etc. are NOT matched
  return !!(m && COMMANDS.has(m[1]));
}
function isNaturalRequest(text) {
  const t = String(text || '').trim();
  return t.length > 0 && t.length <= 45 && !t.startsWith('.') && PHRASE.test(t);
}
function message() {
  return `💫 *${String(settings.botName || 'RAUF × LUCIFER MD BOT').toUpperCase()} — OFFICIAL GROUP*\n${settings.groupLink}\n\n📢 *Official Channel*\n${settings.channelLink}`;
}
async function reply(sock, chatId, quoted) {
  return sock.sendMessage(chatId, { text: message() }, { quoted });
}
module.exports = { isCommand, isNaturalRequest, reply, message };
