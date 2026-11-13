'use strict';
// Turns a user's question into a short Hindi answer using the bot's own knowledge + the bot's existing free AI chain (lib/aiChat.js).
// If the AI is busy, it falls back to answering straight from the command list, so the agent never goes silent.
const K = require('./knowledge');
let askFn = null; const setAsk = (f) => { askFn = f; };
const LEAK = /chatgpt|openai|deepseek|gemini|asyntai|talkai|notegpt|zonerai|pollination|eliteprotech|api key|system prompt/i;

function clean(t) {
  let s = String(t || '').replace(/https?:\/\/\S+/g, '').replace(/[*_`#>~]+/g, '').replace(/\p{Extended_Pictographic}/gu, '').replace(/\s*\n+\s*/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length > 500) { const cut = s.slice(0, 500), i = Math.max(cut.lastIndexOf('।'), cut.lastIndexOf('.'), cut.lastIndexOf('?')); s = i > 150 ? cut.slice(0, i + 1) : cut; }
  return s;
}
const DEV = /[\u0900-\u097F]/;
async function answer(text, { name, key, voice } = {}) {
  const q = String(text || '').trim().slice(0, 400); if (!q) return K.fallback('', voice);
  try {
    const ask = askFn || ((k, t, sys) => require('../aiChat').askChain(k, t, sys));
    const out = clean(await ask('callagent:' + (key || 'x'), q, K.chatSystem(q, name, voice)));
    if (out.length >= 5 && !LEAK.test(out) && (voice || !DEV.test(out))) return out;      // text answers must be Roman Hindi / English, never Devanagari
  } catch (e) { console.error('[call-agent] AI busy, using offline answer:', String(e.message || e).slice(0, 80)); }
  return K.fallback(q, voice);
}
module.exports = { answer, clean, setAsk };
