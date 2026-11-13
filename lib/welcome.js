'use strict';
const { addWelcome, delWelcome, isWelcomeOn, getWelcome, addGoodbye, delGoodBye, isGoodByeOn, getGoodbye } = require('./index');
const fs = require('fs');
const path = require('path');

const DEFAULT_WELCOME = '👑✨ *WELCOME TO RAUF × LUCIFER MD BOT FAMILY!* ✨👑\n\n🎉 Hey {user}!\n❤️ Welcome to *{group}*!\n📜 {description}\n\n🔥 Enjoy your stay!';
const DEFAULT_GOODBYE = '🥺💔 *GOODBYE & TAKE CARE!*\n\n👋 Bye {user}!\n❤️ Thanks for being part of *{group}*.\n🌹 Wishing you happiness and success!';
const cardPath = () => require('./sessionContext').assetPath('rauf-header.jpg');

function extractText(message) {
  const m = message?.message || {};
  return m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || '';
}
function replaceVars(template, { user, group, description = 'No group description set', count = '' }) {
  return String(template || '')
    .replace(/\{\{?user\}?\}/gi, `@${user}`)
    .replace(/\{\{?group\}?\}/gi, group || 'this group')
    .replace(/\{\{?description\}?\}/gi, description || 'No group description set')
    .replace(/\{\{?count\}?\}/gi, String(count));
}
async function setToggle(kind, chatId, enabled, message) {
  if (kind === 'welcome') {
    const old = await getWelcome(chatId);
    if (enabled) return addWelcome(chatId, true, old || DEFAULT_WELCOME);
    return addWelcome(chatId, false, old || DEFAULT_WELCOME);
  }
  const old = await getGoodbye(chatId);
  if (enabled) return addGoodbye(chatId, true, old || DEFAULT_GOODBYE);
  return addGoodbye(chatId, false, old || DEFAULT_GOODBYE);
}
async function configure(kind, sock, chatId, message) {
  const raw = extractText(message).trim();
  const command = kind === 'welcome' ? '.welcome' : '.goodbye';
  const arg = raw.slice(command.length).trim();
  const isOn = kind === 'welcome' ? isWelcomeOn : isGoodByeOn;
  const get = kind === 'welcome' ? getWelcome : getGoodbye;
  const set = kind === 'welcome' ? addWelcome : addGoodbye;
  if (!arg) {
    const help = `*${kind.toUpperCase()} SETUP*\n\n• .${kind} on — Enable\n• .${kind} set <message> — Save custom message\n• .${kind} off — Disable\n\nVariables: {user}, {group}${kind === 'welcome' ? ', {description}, {count}' : ''}`;
    return sock.sendMessage(chatId, { text: help }, { quoted: message });
  }
  const lower = arg.toLowerCase();
  if (lower === 'on') {
    const old = await get(chatId);
    await set(chatId, true, old || (kind === 'welcome' ? DEFAULT_WELCOME : DEFAULT_GOODBYE));
    return sock.sendMessage(chatId, { text: `✅ ${kind} messages enabled. Your saved custom message is preserved.` }, { quoted: message });
  }
  if (lower === 'off') {
    const old = await get(chatId);
    await set(chatId, false, old || (kind === 'welcome' ? DEFAULT_WELCOME : DEFAULT_GOODBYE));
    return sock.sendMessage(chatId, { text: `🔕 ${kind} messages disabled. Your custom message is saved.` }, { quoted: message });
  }
  if (lower.startsWith('set ')) {
    const custom = arg.slice(4).trim();
    if (!custom) return sock.sendMessage(chatId, { text: `❌ Message missing. Example: .${kind} set Welcome {user} to {group}!` }, { quoted: message });
    await set(chatId, true, custom);
    return sock.sendMessage(chatId, { text: `✅ Custom ${kind} message saved and enabled.` }, { quoted: message });
  }
  return sock.sendMessage(chatId, { text: `❌ Invalid command.\n.${kind} on\n.${kind} set <message>\n.${kind} off` }, { quoted: message });
}
async function sendAnnouncement(sock, groupId, participant, kind) {
  const enabled = kind === 'welcome' ? await isWelcomeOn(groupId) : await isGoodByeOn(groupId);
  if (!enabled) return;
  const template = (kind === 'welcome' ? await getWelcome(groupId) : await getGoodbye(groupId)) || (kind === 'welcome' ? DEFAULT_WELCOME : DEFAULT_GOODBYE);
  const metadata = await sock.groupMetadata(groupId);
  const jid = typeof participant === 'string' ? participant : (participant?.id || participant?.jid || '');
  if (!jid) return;
  const phone = jid.split('@')[0].split(':')[0];
  // Prefer the participant's saved WhatsApp display name; fall back to their number.
  const participantMeta = (metadata.participants || []).find(x => (x.id || x.jid || '').split(':')[0] === jid.split(':')[0]) || {};
  const contact = sock.store?.contacts?.[jid] || sock.store?.contacts?.[jid.split(':')[0]] || {};
  let displayName = participantMeta.notify || participantMeta.name || participantMeta.verifiedName || contact.notify || contact.name || contact.verifiedName || '';
  if (!displayName && typeof sock.getName === 'function') {
    try { displayName = await sock.getName(jid, false); } catch {}
  }
  displayName = String(displayName || phone).replace(/^@+/, '').trim() || phone;
  const caption = replaceVars(template, { user: displayName, group: metadata.subject, description: metadata.desc, count: metadata.participants?.length || 0 });
  const payload = { image: fs.readFileSync(cardPath()), caption, mentions: [jid] };
  try {
    await sock.sendMessage(groupId, payload);
  } catch (imageError) {
    await sock.sendMessage(groupId, { text: caption, mentions: [jid] });
  }
}
async function welcomeCommand(sock, chatId, message) {
  if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: 'This command can only be used in groups.' }, { quoted: message });
  return configure('welcome', sock, chatId, message);
}
async function goodbyeCommand(sock, chatId, message) {
  if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: 'This command can only be used in groups.' }, { quoted: message });
  return configure('goodbye', sock, chatId, message);
}
async function handleJoinEvent(sock, id, participants) {
  for (const p of participants || []) { try { await sendAnnouncement(sock, id, p, 'welcome'); } catch (e) { /* keep group event handler alive */ } }
}
async function handleLeaveEvent(sock, id, participants) {
  for (const p of participants || []) { try { await sendAnnouncement(sock, id, p, 'goodbye'); } catch (e) { /* keep group event handler alive */ } }
}
module.exports = { welcomeCommand, goodbyeCommand, handleJoinEvent, handleLeaveEvent, DEFAULT_WELCOME, DEFAULT_GOODBYE };
