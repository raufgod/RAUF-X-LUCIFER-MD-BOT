'use strict';
// Voice note -> text, so users can answer the agent by voice. Uses any OpenAI-compatible Whisper endpoint.
// Default: Groq (free tier, fast, good Hindi). Set GROQ_API_KEY (or STT_API_KEY + STT_BASE_URL for another vendor).
async function transcribe(buf, mime) {
  const key = process.env.STT_API_KEY || process.env.GROQ_API_KEY;
  if (!key) { const e = new Error('NO_STT_KEY'); e.code = 'NO_STT_KEY'; throw e; }
  const base = (process.env.STT_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: mime || 'audio/ogg' }), 'voice.ogg');
  fd.append('model', process.env.STT_MODEL || 'whisper-large-v3-turbo');
  fd.append('language', process.env.STT_LANG || 'hi');
  fd.append('response_format', 'json'); fd.append('temperature', '0');
  fd.append('prompt', 'राउफ लूसिफ़र बॉट, डॉट मेन्यू, डॉट प्ले, व्हाट्सऐप, स्टिकर, पेयरिंग कोड');
  const r = await fetch(base + '/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: fd, signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('STT ' + r.status + ' ' + String((j.error && j.error.message) || '').slice(0, 100));
  return String(j.text || '').trim();
}
module.exports = { transcribe };
