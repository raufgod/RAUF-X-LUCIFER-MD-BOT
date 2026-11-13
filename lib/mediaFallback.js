// RAUF × LUCIFER MD BOT 💫 — media fallback transport
// Primary command providers remain primary. Adeel-XTech is only used when
// the primary provider fails or returns no usable media URL.
const axios = require('axios');
const { call } = require('./adeelApi');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';

function walk(value, out = []) {
  if (value == null) return out;
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const v of value) walk(v, out);
    return out;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (/download[_-]?(link|url)?|audio[_-]?download|video[_-]?download|media[_-]?url|source|direct[_-]?url|url|link/i.test(k)) {
        walk(v, out);
      } else if (v && typeof v === 'object') {
        walk(v, out);
      }
    }
  }
  return out;
}

function pickUrl(data, kind = 'video') {
  const preferredKeys = kind === 'audio'
    ? ['download_link','audio_download','downloadUrl','download_url','audio','url','link']
    : ['download_link','video_download','downloadUrl','download_url','video','url','link'];

  const direct = [];
  const scan = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const key of preferredKeys) {
      const v = value[key];
      if (typeof v === 'string' && /^https?:\/\//i.test(v)) direct.push(v);
      else if (v && typeof v === 'object') scan(v);
    }
    if (Array.isArray(value)) value.forEach(scan);
    else Object.values(value).filter(v => v && typeof v === 'object').forEach(scan);
  };
  scan(data);
  const all = [...direct, ...walk(data)];
  return [...new Set(all)].find(u => !/i\.ytimg\.com|googleusercontent\.com.*thumbnail/i.test(u)) || null;
}

async function downloadBuffer(url, opts = {}) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: opts.timeout || 90000,
    maxContentLength: opts.maxBytes || 150 * 1024 * 1024,
    maxBodyLength: opts.maxBytes || 150 * 1024 * 1024,
    decompress: true,
    validateStatus: s => s >= 200 && s < 400,
    headers: {
      'User-Agent': UA,
      'Accept': '*/*',
      'Accept-Encoding': 'identity',
      ...(opts.headers || {})
    }
  });
  const buffer = Buffer.from(response.data);
  if (!buffer.length) throw new Error('Downloaded media is empty');
  return { buffer, contentType: response.headers?.['content-type'] || '' };
}

async function adeelMedia(apiName, input, kind) {
  const result = await call(apiName, input);
  if (result.kind === 'binary') return result;
  const url = pickUrl(result.data, kind);
  if (!url) throw new Error(`Adeel-XTech ${apiName} returned no media URL`);
  return downloadBuffer(url);
}

module.exports = { adeelMedia, downloadBuffer, pickUrl };
