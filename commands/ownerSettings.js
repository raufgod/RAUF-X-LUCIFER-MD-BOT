'use strict';
// RAUF × LUCIFER MD BOT 💫 — owner customisation commands (owner / sudo only)
//
//  .setownername <name>      owner name shown in .owner, menu, vcard
//  .setbotname <name>        bot name shown in menu/ping   (aliases: .setname, .botname)
//  .setpackname <name>       sticker pack name
//  .setauthor <name>         sticker author
//  .setbotimage              reply to a photo (or send photo with this caption) → new menu/header image
//  .resetbotimage            restore the original menu image
//  (.setpp — bot's WhatsApp profile picture — lives in commands/setpp.js)
const fs = require('fs');
const path = require('path');
const botConfig = require('../lib/botConfig');
const sessionContext = require('../lib/sessionContext');
const { getImageFromMessage, fitJpeg } = require('../lib/imageTools');

const ASSETS = path.join(__dirname, '..', 'assets');
const BACKUP = path.join(ASSETS, 'backup');
const FILES = { header: 'rauf-header.jpg', mini: 'rauf-header-mini.jpg' };

const NAME_CMDS = {
  setownername: ['botOwner', 'Owner name'], setowner: ['botOwner', 'Owner name'], ownername: ['botOwner', 'Owner name'],
  setbotname: ['botName', 'Bot name'], botname: ['botName', 'Bot name'], setname: ['botName', 'Bot name'],
  setpackname: ['packname', 'Sticker pack name'], setauthor: ['author', 'Sticker author'],
  setprefix: ['prefix', 'Command prefix'], prefix: ['prefix', 'Command prefix'],
  settelegram: ['telegramLink', 'Telegram link'], telegram: ['telegramLink', 'Telegram link'],
  setwebsite: ['websiteLink', 'Website link'], website: ['websiteLink', 'Website link']
};
const IMAGE_CMDS = ['setbotimage', 'setmenuimage', 'setheader', 'botimage'];
const RESET_CMDS = ['resetbotimage', 'resetbotimg', 'resetmenuimage'];
const CHANNEL_JID_CMDS = ['setchanneljid', 'channeljid', 'setchannel'];

/** Returns { cmd, arg } for commands handled here, else null. Pass the ORIGINAL-case text. */
function parse(rawText) {
  const m = String(rawText || '').trim().match(/^\.([a-z]+)(?:\s+([\s\S]*))?$/i);
  if (!m) return null;
  const cmd = m[1].toLowerCase();
  if (NAME_CMDS[cmd] || IMAGE_CMDS.includes(cmd) || RESET_CMDS.includes(cmd) || CHANNEL_JID_CMDS.includes(cmd)) return { cmd, arg: (m[2] || '').trim() };
  return null;
}

async function setNameCmd(sock, chatId, message, cmd, arg) {
  const [key, label] = NAME_CMDS[cmd];
  const settings = require('../settings');
  if (!arg) return sock.sendMessage(chatId, { text: `*${label}:* ${settings[key]}\n\nChange it: *.${cmd} <new value>*` }, { quoted: message });
  let r; try { r = botConfig.set(key, arg); } catch (e) { return sock.sendMessage(chatId, { text: `⚠️ ${e.message}` }, { quoted: message }); }
  const { old, next } = r;
  const hint = key === 'prefix' ? `\n\nNow commands start with *${next}* — for example *${next}menu*.\nIf you forget it, *.setprefix .* always works.` : '';
  return sock.sendMessage(chatId, { text: `✅ *${label} updated*\n\n• Old: ${old}\n• New: ${next}\n\nSaved — it stays after restart.${hint}` }, { quoted: message });
}

async function setImageCmd(sock, chatId, message) {
  const img = await getImageFromMessage(message);
  if (!img) return sock.sendMessage(chatId, { text: '⚠️ Reply to a photo with *.setbotimage* (or send a photo with *.setbotimage* as caption).' }, { quoted: message });

  const header = await fitJpeg(img.buffer, 1280);
  const mini = await fitJpeg(img.buffer, 720);

  const inSession = !!sessionContext.current();               // paired bot: only THIS bot's image changes
  const dir = sessionContext.assetWriteDir();
  fs.mkdirSync(dir, { recursive: true });
  if (!inSession) {
    fs.mkdirSync(BACKUP, { recursive: true });
    for (const f of Object.values(FILES)) {                   // keep the very first originals so .resetbotimage works
      const src = path.join(ASSETS, f), bak = path.join(BACKUP, f);
      if (fs.existsSync(src) && !fs.existsSync(bak)) fs.copyFileSync(src, bak);
    }
  }
  fs.writeFileSync(path.join(dir, FILES.header), header);
  fs.writeFileSync(path.join(dir, FILES.mini), mini);
  return sock.sendMessage(chatId, { image: header, caption: '✅ *Bot image updated.* This is now used in the menu, welcome & intro cards.\nUndo with *.resetbotimage*' }, { quoted: message });
}

async function resetImageCmd(sock, chatId, message) {
  let restored = 0;
  if (sessionContext.current()) {
    for (const f of Object.values(FILES)) {
      const own = path.join(sessionContext.assetWriteDir(), f);
      if (fs.existsSync(own)) { fs.unlinkSync(own); restored++; }
    }
  } else {
    for (const f of Object.values(FILES)) {
      const bak = path.join(BACKUP, f);
      if (fs.existsSync(bak)) { fs.copyFileSync(bak, path.join(ASSETS, f)); restored++; }
    }
  }
  return sock.sendMessage(chatId, { text: restored ? '✅ Original bot image restored.' : 'ℹ️ Nothing to restore — the original image has not been changed.' }, { quoted: message });
}

async function setChannelJidCmd(sock, chatId, message, arg) {
  const cl = require('../lib/channel');
  const reply = text => sock.sendMessage(chatId, { text }, { quoted: message });
  const cur = cl.getChannel();
  const usage = '*.channeljid <channel link>* — bot channel ki ID khud nikal lega\n*.setchanneljid 120363xxxxxxxxxx@newsletter* — ID seedha do';

  if (!arg) {
    return reply(`📢 *Current channel*\n• Name: ${cur.name}\n• Link: ${cur.link}\n• JID: ${cur.jid || 'not resolved yet'}${cur.custom ? '\n• Source: your channel ✅' : '\n• Source: default official channel'}\n\n${usage}`);
  }

  const q = arg.split(/\s+/)[0];
  let saved;
  if (cl.NEWSLETTER_RE.test(q)) {                              // JID given directly (keeps the current link/name)
    saved = cl.saveCustomChannel({ jid: q, name: cur.name, link: cur.link });
  } else if (cl.LINK_RE.test(q)) {                             // link given -> look the JID up on WhatsApp
    const r = await cl.resolveFromLink(sock, q);
    saved = cl.saveCustomChannel(r);
  } else {
    throw new Error('Send a channel link (https://whatsapp.com/channel/...) or a JID like 120363xxxxxxxxxx@newsletter');
  }
  return reply(`✅ *Channel set*\n• Name: ${saved.name}\n• Link: ${saved.link}\n• JID: ${saved.jid}\n\nAb har message "Forwarded from ${saved.name}" + *View channel* ke saath jayega. Restart ke baad bhi yahi rahega.`);
}

async function handle(sock, chatId, message, parsed) {
  const { cmd, arg } = parsed;
  try {
    if (NAME_CMDS[cmd]) return await setNameCmd(sock, chatId, message, cmd, arg);
    if (CHANNEL_JID_CMDS.includes(cmd)) return await setChannelJidCmd(sock, chatId, message, arg);
    if (IMAGE_CMDS.includes(cmd)) return await setImageCmd(sock, chatId, message);
    return await resetImageCmd(sock, chatId, message);
  } catch (e) {
    console.error('[ownerSettings]', cmd, e?.message || e);
    await sock.sendMessage(chatId, { text: `❌ .${cmd} failed: ${String(e?.message || e).slice(0, 200)}` }, { quoted: message }).catch(() => {});
  }
}

module.exports = { parse, handle };
