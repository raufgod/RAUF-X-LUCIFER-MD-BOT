const { igdl } = require('ruhend-scraper');
const { adeelMedia, downloadBuffer } = require('../lib/mediaFallback');
const processed = new Set();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function uniqueMedia(items) {
  const seen = new Set();
  return (items || []).filter(x => x && typeof x.url === 'string' && /^https?:\/\//i.test(x.url) && !seen.has(x.url) && seen.add(x.url));
}
function looksLikeVideo(buf) { return buf.length > 12 && (buf.toString('ascii', 4, 8) === 'ftyp' || buf.toString('ascii', 0, 4) === '\x1A\x45\xDF\xA3'); }
function looksLikeImage(buf) { return buf.length > 8 && (buf[0] === 0xff && buf[1] === 0xd8 || buf.toString('ascii',0,4) === '\x89PNG' || buf.toString('ascii',0,4) === 'RIFF' && buf.toString('ascii',8,12) === 'WEBP'); }
async function instagramCommand(sock, chatId, message) {
  const id = message.key?.id;
  try {
    if (id && processed.has(id)) return;
    if (id) { processed.add(id); setTimeout(() => processed.delete(id), 300000); }
    const raw = message.message?.conversation || message.message?.extendedTextMessage?.text || message.message?.imageMessage?.caption || message.message?.videoMessage?.caption || '';
    const match = raw.match(/https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/[^\s]+/i);
    if (!match) return sock.sendMessage(chatId, { text: '❌ Please provide a public Instagram post or Reel link.' }, { quoted: message });
    const url = match[0].replace(/[),]+$/, '');
    await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });
    let items = [];
    try { const result = await igdl(url); items = uniqueMedia(result?.data); } catch (e) { console.error('[INSTAGRAM] scraper:', e.message); }
    if (!items.length) {
      try {
        const fallback = await adeelMedia('igdl', url, 'video');
        if (!looksLikeVideo(fallback.buffer) && !looksLikeImage(fallback.buffer)) throw new Error('Provider returned non-media content');
        const video = looksLikeVideo(fallback.buffer);
        await sock.sendMessage(chatId, video ? { video: fallback.buffer, mimetype: 'video/mp4', caption: '📥 Downloaded by RAUF × LUCIFER MD BOT 💫' } : { image: fallback.buffer, caption: '📥 Downloaded by RAUF × LUCIFER MD BOT 💫' }, { quoted: message });
        return;
      } catch (e) { console.error('[INSTAGRAM] fallback:', e.message); return sock.sendMessage(chatId, { text: '❌ Could not download media. The post may be private, expired, or the provider returned an invalid file.' }, { quoted: message }); }
    }
    let sent = 0;
    for (const item of items.slice(0, 5)) {
      try {
        const media = await downloadBuffer(item.url, { timeout: 90000, maxBytes: 100 * 1024 * 1024 });
        const video = item.type === 'video' || looksLikeVideo(media.buffer);
        const image = looksLikeImage(media.buffer);
        if (!video && !image) throw new Error(`URL returned non-media (${media.contentType || 'unknown content type'})`);
        const payload = video
          ? { video: media.buffer, mimetype: 'video/mp4', caption: '📥 Downloaded by RAUF × LUCIFER MD BOT 💫' }
          : { image: media.buffer, caption: '📥 Downloaded by RAUF × LUCIFER MD BOT 💫' };
        await sock.sendMessage(chatId, payload, { quoted: message });
        sent++;
        await sleep(700);
      } catch (e) { console.error(`[INSTAGRAM] media ${sent + 1}:`, e.message); }
    }
    if (!sent) await sock.sendMessage(chatId, { text: '❌ Instagram returned no valid media file. Try a public post/Reel URL.' }, { quoted: message });
  } catch (e) {
    console.error('[INSTAGRAM] command:', e.message);
    await sock.sendMessage(chatId, { text: '❌ Instagram download failed. Check the provider/network logs.' }, { quoted: message });
  }
}
module.exports = instagramCommand;
