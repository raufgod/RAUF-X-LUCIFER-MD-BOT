'use strict';
// RAUF × LUCIFER MD BOT 💫 — shared image helpers for owner commands (.setpp, .setbotimage ...)
// Works with `sharp` if installed, otherwise `jimp` (v1), otherwise passes through real JPEGs.
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

let sharp = null; try { sharp = require('sharp'); } catch (_) {}
let Jimp = null; try { Jimp = require('jimp').Jimp || require('jimp'); } catch (_) {}

const isJpeg = b => Buffer.isBuffer(b) && b.length > 3 && b[0] === 0xff && b[1] === 0xd8;

// Unwrap ephemeral / view-once / caption wrappers so the real media node is reachable
function unwrap(m) {
  let cur = m || {};
  for (let i = 0; i < 6; i++) {
    const inner = cur.ephemeralMessage?.message || cur.viewOnceMessage?.message || cur.viewOnceMessageV2?.message ||
      cur.viewOnceMessageV2Extension?.message || cur.documentWithCaptionMessage?.message || cur.editedMessage?.message;
    if (!inner) break;
    cur = inner;
  }
  return cur;
}

async function download(node, type) {
  const stream = await downloadContentFromMessage(node, type);
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return Buffer.concat(chunks);
}

/**
 * Image attached to the command message itself (caption) OR in the message it replies to.
 * Returns { buffer, kind } or null.
 */
async function getImageFromMessage(message) {
  const own = unwrap(message?.message);
  const ctx = own.extendedTextMessage?.contextInfo || own.imageMessage?.contextInfo || own.videoMessage?.contextInfo ||
    own.documentMessage?.contextInfo || own.stickerMessage?.contextInfo;
  const quoted = unwrap(ctx?.quotedMessage);

  const candidates = [
    [own.imageMessage, 'image', 'image'],
    [quoted.imageMessage, 'image', 'image'],
    [quoted.stickerMessage, 'sticker', 'sticker'],
    [/^image\//.test(quoted.documentMessage?.mimetype || '') ? quoted.documentMessage : null, 'document', 'image'],
    [/^image\//.test(own.documentMessage?.mimetype || '') ? own.documentMessage : null, 'document', 'image']
  ];
  for (const [node, type, kind] of candidates) {
    if (!node) continue;
    const buffer = await download(node, type);
    if (buffer?.length) return { buffer, kind };
  }
  return null;
}

async function fitJpeg(buf, maxW = 1280) {
  if (sharp) { try { return await sharp(buf).rotate().resize({ width: maxW, withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer(); } catch (_) {} }
  if (Jimp) { try { const img = await Jimp.read(buf); if (img.bitmap.width > maxW) img.resize({ w: maxW }); return await img.getBuffer('image/jpeg', { quality: 90 }); } catch (_) {} }
  if (isJpeg(buf)) return buf;
  throw new Error('Could not convert this image. Please send it as a normal photo (JPG/PNG), not a sticker/WebP.');
}

async function squareJpeg(buf, size = 640) {
  if (sharp) { try { return await sharp(buf).rotate().resize(size, size, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer(); } catch (_) {} }
  if (Jimp) { try { const img = await Jimp.read(buf); img.cover({ w: size, h: size }); return await img.getBuffer('image/jpeg', { quality: 90 }); } catch (_) {} }
  if (isJpeg(buf)) return buf;
  throw new Error('Could not convert this image. Please send it as a normal photo (JPG/PNG), not a sticker/WebP.');
}

/**
 * Small ROUND picture on a transparent square canvas (PNG with alpha) — used for the channel card thumbnail.
 * `diameter` < `canvas` leaves a transparent margin, so WhatsApp shows the circle smaller.
 * Returns null when neither sharp nor jimp can do it.
 */
async function circleThumb(buf, canvas = 128, diameter = 72) {
  if (sharp) {
    try {
      const face = await sharp(buf).rotate().resize(diameter, diameter, { fit: 'cover' }).png().toBuffer();
      const mask = Buffer.from(`<svg width="${diameter}" height="${diameter}"><circle cx="${diameter / 2}" cy="${diameter / 2}" r="${diameter / 2}" fill="#fff"/></svg>`);
      const round = await sharp(face).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
      return await sharp({ create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: round, gravity: 'centre' }]).png().toBuffer();
    } catch (_) {}
  }
  if (Jimp) {
    try {
      const img = await Jimp.read(buf);
      img.cover({ w: diameter, h: diameter });
      img.circle();
      const bg = new Jimp({ width: canvas, height: canvas, color: 0x00000000 });
      bg.composite(img, Math.round((canvas - diameter) / 2), Math.round((canvas - diameter) / 2));
      return await bg.getBuffer('image/png');
    } catch (_) {}
  }
  return null;
}

module.exports = { getImageFromMessage, fitJpeg, squareJpeg, circleThumb, unwrap, isJpeg };
