// RAUF × LUCIFER MD BOT 💫 — force remote media to be downloaded by the bot first.
// This prevents WhatsApp from having to fetch third-party CDN URLs itself,
// which is the source of the "Download blocked / region or legal restrictions"
// error shown by WhatsApp for some providers.
const axios = require('axios');

const MAX_BYTES = 150 * 1024 * 1024;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const MEDIA_KEYS = ['image', 'video', 'audio', 'document', 'sticker'];

async function fetchRemote(url) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return null;
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 90000,
    maxContentLength: MAX_BYTES,
    maxBodyLength: MAX_BYTES,
    decompress: true,
    validateStatus: s => s >= 200 && s < 400,
    headers: {
      'User-Agent': UA,
      'Accept': '*/*',
      'Accept-Encoding': 'identity'
    }
  });
  const buffer = Buffer.from(res.data);
  if (!buffer.length) throw new Error('Remote media returned an empty body');
  return buffer;
}

function patch(sock) {
  if (!sock || sock.__raufMediaTransportPatched) return sock;
  const original = sock.sendMessage.bind(sock);

  sock.sendMessage = async (jid, content, options) => {
    if (!content || typeof content !== 'object') return original(jid, content, options);

    const next = { ...content };
    let changed = false;

    for (const key of MEDIA_KEYS) {
      const value = next[key];
      if (!value || typeof value !== 'object' || Buffer.isBuffer(value)) continue;
      if (typeof value.url !== 'string' || !/^https?:\/\//i.test(value.url)) continue;

      try {
        const buffer = await fetchRemote(value.url);
        // Baileys accepts a Buffer directly. Remove the external URL so WA
        // never has to retrieve the third-party host itself.
        next[key] = buffer;
        changed = true;
      } catch (error) {
        console.error(`[MEDIA-TRANSPORT] ${key} download failed:`, error?.message || error);
        // Keep the original URL as a final compatibility fallback.
      }
    }

    return original(jid, changed ? next : content, options);
  };

  sock.__raufMediaTransportPatched = true;
  return sock;
}

module.exports = { patch };
