'use strict';
// RAUF × LUCIFER MD BOT 💫 — .autoreply  &  .mentionreply
//
//  .autoreply on|off|dm|group|status
//      Bot replies (AI) to what OTHER people write — in DMs and/or groups.
//      It never replies to messages sent from the bot's own number (fromMe).
//
//  .mentionreply on|off|status
//      Whenever someone @mentions the bot in a group, the bot answers with AI.
//      Works whether .autoreply is ON or OFF. (Old static `.mention` sticker reply is separate.)
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { responseText, SPECS } = require('./kingApiClient');

const FILE = path.join(__dirname, '..', 'data', 'autoreply.json');
const BASE = 'https://eliteprotech-apis.zone.id';
const COOLDOWN_MS = 6000;            // per sender per chat — stops bot-vs-bot loops / spam

const sessionContext = require('./sessionContext');
const states = new Map();            // one state object per session (never shared between paired bots)
const lastReply = new Map();         // `${chat}|${sender}` -> timestamp
const seenIds = new Set();

function load() {
  return sessionContext.perSession(states, () => {
    let st = {};
    try { st = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { st = {}; }
    st.autoreplyDm = !!st.autoreplyDm;
    st.autoreplyGroup = !!st.autoreplyGroup;
    st.mentionreply = !!st.mentionreply;
    return st;
  });
}
function save() {
  try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(load(), null, 2)); }
  catch (e) { console.error('[autoReply] save failed:', e.message); }
}

// ── command parsing ──────────────────────────────────────────────────────────
function parseCommand(text) {
  const m = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ').match(/^\.(autoreply|mentionreply)(?: (.+))?$/);
  return m ? { cmd: m[1], arg: (m[2] || 'status').trim() } : null;
}

const flag = v => (v ? '✅ ON' : '❌ OFF');
function aiChain() { return `🧠 AI: ${LABELS[PROVIDERS[0]]} (primary) → fallback: ${PROVIDERS.slice(1).map(p => LABELS[p]).join(', ')}`; }
function autoStatus(s) { return `🤖 *Auto Reply*\n• DM: ${flag(s.autoreplyDm)}\n• Groups: ${flag(s.autoreplyGroup)}\n${aiChain()}\n\n*.autoreply on* — DM + groups (in groups: only when the bot is @tagged or replied to)\n*.autoreply off* — disable\n*.autoreply dm* — DM only\n*.autoreply group* — groups only`; }
function mentionStatus(s) { return `📣 *Mention Reply*: ${flag(s.mentionreply)}\n\n*.mentionreply on* / *.mentionreply off*\nWhen someone mentions the bot, AI replies (works even if auto reply is off).`; }

function runCommand({ cmd, arg }) {
  const s = load();
  if (cmd === 'autoreply') {
    if (arg === 'on')         { s.autoreplyDm = true;  s.autoreplyGroup = true;  save(); return '✅ *Auto reply ON* — DM + groups.\nBot will not reply to your own messages.'; }
    if (arg === 'off')        { s.autoreplyDm = false; s.autoreplyGroup = false; save(); return '❌ *Auto reply OFF*.'; }
    if (arg === 'dm')         { s.autoreplyDm = true;  s.autoreplyGroup = false; save(); return '✅ *Auto reply ON* — private DMs only.'; }
    if (arg === 'group')      { s.autoreplyDm = false; s.autoreplyGroup = true;  save(); return '✅ *Auto reply ON* — groups only.'; }
    return autoStatus(s);
  }
  if (arg === 'on')  { s.mentionreply = true;  save(); return '✅ *Mention reply ON* — jab bhi koi bot ko mention karega, AI jawab dega.'; }
  if (arg === 'off') { s.mentionreply = false; save(); return '❌ *Mention reply OFF*.'; }
  return mentionStatus(s);
}

// ── helpers ──────────────────────────────────────────────────────────────────
const norm = v => String(v || '').toLowerCase().replace(/:\d+(?=@)/g, '');

function isBotMentioned(sock, message, text) {
  const msg = message.message || {};
  const ctxs = [msg.extendedTextMessage, msg.imageMessage, msg.videoMessage, msg.documentMessage, msg.audioMessage]
    .map(m => m?.contextInfo).filter(Boolean);
  const mentioned = ctxs.flatMap(c => c.mentionedJid || []).map(norm);
  const ids = [sock?.user?.id, sock?.user?.lid, sock?.user?.jid].filter(Boolean).map(norm);
  if (mentioned.some(j => ids.includes(j))) return true;
  const num = ids.map(i => i.split('@')[0]).find(Boolean);
  return !!(num && text && text.includes('@' + num));
}

// A person replied to one of the bot's own messages (swipe-reply) -> counts like a mention in groups
function isReplyToBot(sock, message) {
  const msg = message.message || {};
  const ctx = [msg.extendedTextMessage, msg.imageMessage, msg.videoMessage, msg.documentMessage, msg.audioMessage, msg.stickerMessage]
    .map(m => m?.contextInfo).find(c => c && c.participant);
  if (!ctx) return false;
  const ids = [sock?.user?.id, sock?.user?.lid, sock?.user?.jid].filter(Boolean).map(norm);
  return ids.includes(norm(ctx.participant));
}

// ── AI providers: PRIMARY first, then every other chat AI in the bot as fallback ─────────
// (all go through the same EliteProTech API host used by .gpt / .asyntai / .talkai / ... commands)
const PROVIDERS = ['gpt', 'asyntai', 'talkai', 'notegpt', 'zonerai', 'pollinationai', 'deepseek', 'mathgpt'];
const LABELS = { gpt: 'ChatGPT', asyntai: 'Asyntai', talkai: 'TalkAI', notegpt: 'NoteGPT', zonerai: 'ZonerAI', pollinationai: 'Pollination', deepseek: 'DeepSeek', mathgpt: 'MathGPT' };
const FAIL_COOLDOWN_MS = 60 * 1000;      // a provider that just failed is skipped for a minute
const TOTAL_BUDGET_MS = 45 * 1000;       // never keep the chat waiting longer than this
const failedAt = new Map();

function buildPrompt(text, name) {
  return 'You are RAUF × LUCIFER MD BOT, a friendly, witty WhatsApp assistant made by RAUF × LUCIFER (Team RAUF × LUCIFER). ' +
    'Reply in 1-4 short lines, in English. ' +
    'No headings, no markdown tables.\n' +
    `User${name ? ' (' + name + ')' : ''}: ${text}`;
}

async function callProvider(id, prompt, timeout) {
  const spec = SPECS[id];
  if (!spec) throw new Error('unknown provider');
  const r = await axios.get(BASE + spec.path, {
    params: { ...(spec.fixed || {}), [spec.input || 'prompt']: prompt },
    timeout, validateStatus: () => true,
    headers: { Accept: 'application/json, text/plain, */*', 'User-Agent': 'KING-OF-BOTS-AI/1.0' }
  });
  if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status}`);
  if (r.data && typeof r.data === 'object' && (r.data.success === false || r.data.status === 'error')) throw new Error(r.data.message || r.data.error || 'provider error');
  const out = responseText(r.data);
  if (!out || /^<!doctype html|^<html\b/i.test(String(out).trim())) throw new Error('empty/unreadable reply');
  return String(out).trim().slice(0, 1800);
}

async function askAI(text, name) {
  const prompt = buildPrompt(text, name);
  const started = Date.now();
  const now = () => Date.now();
  // Skip providers that failed in the last minute — unless that would leave nothing to try.
  let order = PROVIDERS.filter(id => now() - (failedAt.get(id) || 0) > FAIL_COOLDOWN_MS);
  if (!order.length) order = PROVIDERS.slice();
  const errors = [];
  for (const id of order) {
    const left = TOTAL_BUDGET_MS - (now() - started);
    if (left < 3000) break;
    try {
      const out = await callProvider(id, prompt, Math.min(id === PROVIDERS[0] ? 20000 : 15000, left));
      failedAt.delete(id);
      if (id !== PROVIDERS[0]) console.log(`[autoReply] answered by fallback ${LABELS[id]}`);
      return out;
    } catch (e) {
      failedAt.set(id, now());
      errors.push(`${LABELS[id] || id}: ${String(e?.message || e).slice(0, 60)}`);
    }
  }
  throw new Error('all AI providers failed — ' + errors.join(' | '));
}

/**
 * Called for every incoming NON-command message.
 * Returns true if it produced a mention-reply (so the caller can skip the old static mention handler).
 */
async function handleIncoming(sock, message, { isGroup, text, allowed = true }) {
  try {
    const s = load();
    if (!s.autoreplyDm && !s.autoreplyGroup && !s.mentionreply) return false;
    if (!allowed) return false;                               // bot in PRIVATE mode & sender not owner
    if (message.key?.fromMe) return false;                    // ← never reply to my own messages
    const chatId = message.key?.remoteJid;
    if (!chatId || chatId === 'status@broadcast' || chatId.endsWith('@newsletter') || chatId.endsWith('@broadcast')) return false;
    const id = message.key?.id;
    if (typeof id === 'string' && id.startsWith('BAE5')) return false;   // other bots
    if (!text || !text.trim()) return false;
    if (message.message?.protocolMessage || message.message?.reactionMessage) return false;

    const mentioned = isGroup && isBotMentioned(sock, message, text);
    const wantMention = mentioned && s.mentionreply;
    // GROUPS: auto reply answers ONLY when the bot is @mentioned or someone replies to the bot's message. DMs: every message.
    const wantAuto = isGroup ? (s.autoreplyGroup && (mentioned || isReplyToBot(sock, message))) : s.autoreplyDm;
    if (!wantMention && !wantAuto) return false;

    if (id) { if (seenIds.has(id)) return wantMention; seenIds.add(id); if (seenIds.size > 1000) seenIds.delete(seenIds.values().next().value); }
    const sender = message.key.participant || chatId;
    const ck = `${chatId}|${sender}`;
    if (Date.now() - (lastReply.get(ck) || 0) < COOLDOWN_MS) return wantMention;
    lastReply.set(ck, Date.now());

    const clean = text.replace(/@\d{5,}/g, '').trim() || text;
    try { await sock.sendPresenceUpdate('composing', chatId); } catch {}
    const answer = await askAI(clean, message.pushName);
    try { await sock.sendPresenceUpdate('paused', chatId); } catch {}
    await sock.sendMessage(chatId, { text: answer, mentions: isGroup ? [sender] : [] }, { quoted: message });
    return wantMention;
  } catch (e) {
    console.error('[autoReply]', e?.message || e);
    return false;
  }
}

module.exports = { parseCommand, runCommand, handleIncoming, load };
