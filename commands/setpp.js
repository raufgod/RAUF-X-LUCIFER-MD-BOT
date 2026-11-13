'use strict';
// .setpp — change the BOT's WhatsApp profile picture (owner / sudo only; main.js already checks owner).
// Reply to a photo with .setpp, or send a photo with .setpp as caption.
const isOwnerOrSudo = require('../lib/isOwner');
const { getImageFromMessage, squareJpeg } = require('../lib/imageTools');

async function updateOwnPicture(sock, jpeg) {
  // Same raw query WhatsApp Web uses — no dependency on Baileys' own image library.
  try {
    await sock.query({
      tag: 'iq',
      attrs: { to: 's.whatsapp.net', type: 'set', xmlns: 'w:profile:picture' },
      content: [{ tag: 'picture', attrs: { type: 'image' }, content: jpeg }]
    });
  } catch (rawErr) {
    const me = String(sock.user?.id || '').replace(/:\d+(?=@)/, '');
    if (!me || typeof sock.updateProfilePicture !== 'function') throw rawErr;
    await sock.updateProfilePicture(me, jpeg);                  // fallback to the library helper
  }
}

async function setProfilePicture(sock, chatId, msg) {
  try {
    const senderId = msg.key.participant || msg.key.remoteJid;
    if (!msg.key.fromMe && !(await isOwnerOrSudo(senderId, sock, chatId))) {
      return sock.sendMessage(chatId, { text: '❌ This command is only available for the owner!' }, { quoted: msg });
    }
    const img = await getImageFromMessage(msg);
    if (!img) return sock.sendMessage(chatId, { text: '⚠️ Reply to a photo with *.setpp* (or send a photo with *.setpp* as caption).' }, { quoted: msg });

    const jpeg = await squareJpeg(img.buffer, 640);
    await updateOwnPicture(sock, jpeg);
    await sock.sendMessage(chatId, { text: '✅ Bot profile picture updated!' }, { quoted: msg });
  } catch (error) {
    console.error('Error in setpp command:', error);
    await sock.sendMessage(chatId, { text: `❌ Failed to update profile picture: ${String(error?.message || error).slice(0, 200)}` }, { quoted: msg }).catch(() => {});
  }
}

module.exports = setProfilePicture;
