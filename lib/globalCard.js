// RAUF × LUCIFER MD BOT 💫 — outgoing message look (no card, no toggle):
//   • top   : "Forwarded many times · Search on web"  +  green line = Meta AI link
//   • bottom: "View channel" button
//   • "AI ✦" label next to the time
// Wraps sock.sendMessage so every outgoing message gets it automatically. Edit CONFIG below.
const channelLib = require('./channel');

// The AI-label fork (@itsliaaa/baileys, installed under the @whiskeysockets/baileys name) supports { ai: true } natively.
let HAS_AI_FLAG = false;
try { HAS_AI_FLAG = /itsliaaa/i.test(require('@whiskeysockets/baileys/package.json').name || ''); } catch (_) {}

const CONFIG = {
  // Green line on top = the "forwarded from" channel name (tap = opens the channel). Change with env TOP_TEXT.
  get topText() { try { return process.env.TOP_TEXT || (String(require('../settings').botName || 'RAUF × LUCIFER MD BOT') + ' 👑'); } catch (_) { return 'RAUF × LUCIFER MD BOT 👑'; } },
  aiLabel: process.env.AI_LABEL !== '0'   // "AI" tag next to the time (set AI_LABEL=0 in the panel to turn off)
};

const SKIP_KEYS = ['react', 'delete', 'edit', 'poll', 'pin', 'forward', 'sticker', 'disappearingMessagesInChat', 'groupInviteMessage', 'listMessage', 'buttonsMessage', 'templateMessage', 'interactiveMessage', 'location', 'contacts', 'buttons', 'templateButtons', 'sections', 'interactiveButtons', 'album', 'viewOnce'];
const SEND_KEYS = ['text', 'image', 'video', 'audio', 'document'];

// The channel JID is looked up from WhatsApp once (invite code -> jid), max once a minute, never holding a message > 4 s.
let resolving = null, lastTry = 0;
async function ensureChannel(sock) {
  if (channelLib.getChannel().jid || resolving || Date.now() - lastTry < 60 * 1000) return resolving;
  lastTry = Date.now();
  resolving = Promise.race([
    channelLib.resolveOfficialChannel(sock),
    new Promise(r => setTimeout(r, 4000))
  ]).catch(() => {}).finally(() => { resolving = null; });
  return resolving;
}

// kept only so older callers do not break (the .card / .cardstyle commands no longer exist)
function parseCommand() { return null; }
function runCommand() { return ''; }

// Technical error text must never reach users (API names, HTTP codes, stack traces). Details go to the console.
const FRIENDLY = '⚠️ Something went wrong. Please try again in a moment.';
const TECH = /(HTTP\s?\d{3}|status code|ECONN\w*|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|providers? (?:failed|returned)|api returned|API error|axios|eliteprotech|apis-keith|adeel|zone\.id|vercel\.app|Unexpected token|is not defined|Cannot read|\bat \S+ \(.*\.js|stack:|raw response|no readable answer|Request failed|fetch failed)/i;
function scrub(content) {
  try {
    if (!content || typeof content.text !== 'string') return content;
    const t = content.text;
    if (t.length < 300 && !/^\s*\*[^*\n]{1,40} AI\*/.test(t) && /^\s*(❌|⚠️|🚫|error|failed)|\b(error|failed|failure)\b/i.test(t) && TECH.test(t)) {
      console.error('[hidden-from-user]', t.replace(/\s+/g, ' ').slice(0, 300));
      return { ...content, text: FRIENDLY };
    }
  } catch (_) {}
  return content;
}
function patch(sock) {
  if (!sock || sock.__raufGlobalCardPatched) return sock;
  const original = sock.sendMessage.bind(sock);

  sock.sendMessage = async (jid, content, options = {}) => {
    content = scrub(content);
    try { content = require('./brand').rewrite(content); } catch (_) {}      // white label: new name / owner / links
    try {
      if (!content || typeof content !== 'object' || options?.noCard) return await original(jid, content, options);
      if (String(jid).endsWith('@newsletter') || String(jid) === 'status@broadcast') return await original(jid, content, options);
      if (SKIP_KEYS.some(k => k in content) || !SEND_KEYS.some(k => k in content)) return await original(jid, content, options);

      await ensureChannel(sock);
      const ch = channelLib.getChannel();
      const isPrivate = /@(s\.whatsapp\.net|lid)$/.test(String(jid));
      const next = ch.jid
        ? { ...content, contextInfo: {
            ...(content.contextInfo || {}),
            isForwarded: true,
            forwardingScore: 999,
            forwardedNewsletterMessageInfo: { newsletterJid: ch.jid, newsletterName: CONFIG.topText, serverMessageId: 143 }
          } }
        : { ...content };

      const opts = { ...options };
      // AI label — works in private (1-to-1) chats only (WhatsApp limitation, same in every fork)
      if (CONFIG.aiLabel && isPrivate) {
        if (HAS_AI_FLAG) next.ai = true;
        else opts.additionalNodes = [...(options.additionalNodes || []), { tag: 'bot', attrs: { biz_bot: '1' } }];
      }
      return await original(jid, next, opts);
    } catch (err) {
      console.error('[GLOBAL-CARD] falling back to plain send:', err?.message || err);
      return original(jid, content, options);
    }
  };

  sock.__raufGlobalCardPatched = true;
  return sock;
}

module.exports = { patch, CONFIG, parseCommand, runCommand };
