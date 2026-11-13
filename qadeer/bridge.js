const fs = require('fs');
const path = require('path');
const commandsDir = path.join(__dirname, 'commands');
const registry = new Map();
const knownPatterns = {
  'Pinterest.js': 'pinterest', 'ytmp3.js': 'play', 'sticker.js': 's',
  'tag_admins.js': 'tagadmins', 'translate.js': 'trt', 'eightball.js': '8ball'
};
for (const file of fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'))) {
  const stem = file.replace(/\.js$/i, '').toLowerCase();
  registry.set(`${stem}2`, { file, expected: null });
  if (knownPatterns[file]) registry.set(`${knownPatterns[file]}2`, { file, expected: knownPatterns[file] });
  try {
    const mod = require(path.join(commandsDir, file));
    if (mod && typeof mod.execute === 'function' && mod.pattern) {
      registry.set(`${String(mod.pattern).toLowerCase()}2`, { file, expected: String(mod.pattern).toLowerCase() });
    }
  } catch (e) {
    // Keep filename and known pattern aliases registered; dependency errors are reported only if used.
  }
}
// Runtime is implemented natively because RAUF's runtime module is a tracker, not a command handler.
registry.set('runtime2', { native: 'runtime' });
// Keep both common naming forms for the translator, but use the already bundled RAUF × LUCIFER implementation.
registry.set('translate2', { native: 'translate' });
registry.set('trt2', { native: 'translate' });
registry.set('pair2', { native: 'pair' });
registry.set('welcome2', { native: 'welcome' });
registry.set('goodbye2', { native: 'goodbye' });

function textOf(message) {
  const m = message?.message || {};
  return (m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || '').trim();
}
function quotedObject(message) {
  const ci = message?.message?.extendedTextMessage?.contextInfo;
  if (!ci?.quotedMessage) return null;
  return {
    message: ci.quotedMessage,
    sender: ci.participant || '',
    key: { remoteJid: message.key?.remoteJid, participant: ci.participant || '', id: ci.stanzaId || '' }
  };
}
async function handleQadeerCommand(sock, message, context = {}) {
  const raw = textOf(message);
  const match = raw.match(/^\.([a-z0-9_-]+)(?:\s+([\s\S]*))?$/i);
  if (!match) return false;
  const name = match[1].toLowerCase();
  if (!name.endsWith('2')) return false;
  const entry = registry.get(name);
  if (!entry) return false;
  const chatId = message?.key?.remoteJid || '';
  const sender = message?.key?.participant || chatId;
  const isGroup = chatId.endsWith('@g.us');
  const arg = (match[2] || '').trim();
  const args = arg ? arg.split(/\s+/) : [];
  const reply = (text, options = {}) => sock.sendMessage(chatId, { text, ...options }, { quoted: message });
  if (entry.native === 'runtime') {
    const sec = Math.floor(process.uptime());
    const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    await reply(`⏱️ *RAUF × LUCIFER MD BOT Runtime*\n${d}d ${h}h ${m}m ${s}s`); return true;
  }
  if (entry.native === 'translate') {
    const native = require('../commands/translate');
    await native.handleTranslateCommand(sock, chatId, message, arg); return true;
  }
  if (entry.native === 'pair') {
    const native = require('../commands/pair');
    await native(sock, chatId, message, arg); return true;
  }
  if (entry.native === 'privacy') {
    }
  if (entry.native === 'welcome' || entry.native === 'goodbye') {
    if (!isGroup) { await reply('This command can only be used in groups.'); return true; }
    try {
      const isAdmin = require('../lib/isAdmin');
      const status = await isAdmin(sock, chatId, sender);
      if (!status.isSenderAdmin && !message.key?.fromMe) {
        await reply('❌ Only group admins can configure welcome/goodbye messages.'); return true;
      }
      const kind = entry.native;
      const native = kind === 'welcome' ? require('../commands/welcome') : require('../commands/goodbye');
      const synthetic = { ...message, message: { conversation: `.${kind}${arg ? ` ${arg}` : ''}` } };
      await (kind === 'welcome' ? native.welcomeCommand : native.goodbyeCommand)(sock, chatId, synthetic);
    } catch (e) { await reply('❌ Could not update this group setting. Check bot setup and permissions.'); }
    return true;
  }
  try {
    const mod = require(path.join(commandsDir, entry.file));
    if (!mod || typeof mod.execute !== 'function') {
      await reply(`⚠️ .${name}2 is not available in this build.`); return true;
    }
    let groupMetadata = null;
    if (isGroup) {
      try { groupMetadata = await sock.groupMetadata(chatId); } catch {}
    }
    const quoted = quotedObject(message);
    const m = {
      mentionedJid: message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [],
      quoted,
      sender,
      chat: chatId,
      key: message.key,
      message: message.message
    };
    let isAdmins = false, isCreator = false;
    if (groupMetadata) {
      const participant = (groupMetadata.participants || []).find(p => p.id === sender || p.lid === sender);
      isAdmins = participant?.admin === 'admin' || participant?.admin === 'superadmin';
      isCreator = participant?.admin === 'superadmin';
    }
    await mod.execute(sock, message, m, { args, q: arg, reply, from: chatId, isGroup, groupMetadata, sender, isAdmins, isCreator });
    return true;
  } catch (e) {
    console.error(`[RAUF IMPORTED COMMAND] .${name}:`, e?.message || e);
    await reply(`❌ .${name}2 could not run. Check its optional dependency/API or bot permissions.`);
    return true;
  }
}
module.exports = { handleQadeerCommand, importedCommandNames: [...registry.keys()].sort() };
