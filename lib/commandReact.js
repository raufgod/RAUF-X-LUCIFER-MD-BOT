'use strict';
// RAUF × LUCIFER MD BOT 💫 — command reactions
// When someone sends a command the bot reacts to THAT message first (🎵 for music, 🤖 for AI, ...),
// then the command runs and its output follows.
//   .cmdreact on|off|status   (owner only, default ON)
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'cmdreact.json');
const REACT_TIMEOUT_MS = 1500;   // never hold a command back longer than this waiting for WhatsApp

// Ordered: first match wins. [emoji, command names]
const FAMILIES = [
  ['🎵', 'play play2 song song2 music mp3 ytmp3 ytmp3v2 ytaudio spotify spotifydl lyrics playlist soundcloud ringtone shazam tomp3 audio'],
  ['🎨', 'imagine imageai dalle flux draw art'],
  ['🤖', 'gpt chatgpt gemini ai bard bing llama deepseek deepseekai asyntai talkai notegpt zonerai pollinationai mathgpt airmore vision summarize story copilot blackbox intel findout'],
  ['🎬', 'video ytmp4 ytv ytmp4v2 vid movie tiktok tt ttdl tiktokv2 tiktokfetch insta ig igdl igs instafetch fb fbdl fb2 facebook twitter twitterdl x aio3 capcut pinvid'],
  ['🖼️', 'image img pinterest pint pinphoto wallpaper wp'],
  ['🎭', 'sticker s stickercrop stickertelegram attp ttp take emojimix emix toimg tosticker simage wm'],
  ['📥', 'mediafire mf mediafetch gdrive driveget apk terabox teraboxdl download dl mega'],
  ['🗣️', 'tts say voice'],
  ['📢', 'tagall tag hidetag tagnotadmin tagadmin tagrandom everyone'],
  ['🛡️', 'kick add promote demote mute unmute ban unban warn warnings antilink antibadword antitag antibot setgname setgdesc setgpp resetlink link groupinfo admins staff kickall delete del'],
  ['👑', 'owner mode sudo setpp setownername setbotname setname botname setbotimage resetbotimage setpackname setauthor restart update boton botoff private public autoreply mentionreply cmdreact card cardstyle errors error channeljid setchanneljid setchannel eval exec clearsession clearsesi cleartmp antidelete anticall pmblocker autostatus autoread autotyping areact autoreact setmention mention broadcast block unblock leave left'],
  ['🏓', 'ping pingplus pingcheck speed'],
  ['💚', 'alive uptime runtime version health botstats serverinfo aboutbot'],
  ['📜', 'menu menu2 help list bot commands'],
  ['😂', 'joke jokes meme funny quote quotes shayari shayri flirt insult roast compliment truth dare advice pickup fact hack ship love lovenight gn goodnight roseday'],
  ['🎮', 'ttt tictactoe surrender move hangman guess trivia quiz rps dice flip slot'],
  ['🌦️', 'weather cuaca'],
  ['🔎', 'google googlesearch ddg duckduckgo wiki wikipedia ytsearch yts search imdb define dictionary urban'],
  ['🌐', 'translate trt trt2 tr translate2 quicktranslate'],
  ['🧮', 'math calc calculator'],
  ['⏰', 'time date timer'],
  ['📰', 'news detiknews kompasnews'],
  ['📸', 'ss ssweb screenshot'],
  ['🔗', 'url url2 tourl qr qrcodegenerator shorten tinyurl'],
  ['🌸', 'anime animu animuquote loli waifu neko manga tonikawa'],
  ['🐙', 'github git repo npm'],
  ['👤', 'getpp pp dp fullpp mydp whois profile profilepic vcard setbio'],
  ['👁️', 'vv viewonce'],
  ['🟢', 'online'],
  ['⚙️', 'settings']
];
const EMOJI_OF = new Map();
for (const [emoji, names] of FAMILIES) for (const n of names.split(/\s+/)) if (!EMOJI_OF.has(n)) EMOJI_OF.set(n, emoji);
const DEFAULT_EMOJI = '⚡';

const sessionContext = require('./sessionContext');
const states = new Map();   // one state per session
function load() {
  return sessionContext.perSession(states, () => {
    let st = {};
    try { st = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { st = {}; }
    if (typeof st.enabled !== 'boolean') st.enabled = true;
    return st;
  });
}
function save() {
  try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(load(), null, 2)); }
  catch (e) { console.error('[cmdreact] save failed:', e.message); }
}

function textOf(message) {
  const m = message?.message || {};
  return (m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || '').trim();
}

/** '.play despacito' -> 'play' ; anything that isn't a command -> null */
function commandName(text) {
  const t = String(text || '').trim().toLowerCase().replace(/\.\s+/g, '.');
  const m = t.match(/^\.([a-z0-9_-]+)(?:\s|$)/);
  return m ? m[1] : null;
}

function emojiFor(name) {
  if (EMOJI_OF.has(name)) return EMOJI_OF.get(name);
  if (/gpt$|^ai[-_]/.test(name)) return '🤖';
  return null;
}

async function isKnownCommand(name) {
  if (EMOJI_OF.has(name)) return true;
  try {
    const reg = require('./commandRegistry');
    if (reg.isHandledListed(name)) return true;
    await reg.loadFlashCommands();
    if (global.__kobFlashCommandRegistry?.has(name)) return true;
  } catch (_) {}
  return false;
}

/**
 * Reacts to a command message BEFORE the command runs.
 * Returns true when a reaction was sent (so the generic .areact random reaction can be skipped).
 */
async function react(sock, message) {
  try {
    if (!load().enabled) return false;
    const key = message?.key;
    if (!key?.id || !key.remoteJid || key.remoteJid === 'status@broadcast' || key.remoteJid.endsWith('@newsletter')) return false;
    if (message.message?.protocolMessage || message.message?.reactionMessage) return false;

    const name = commandName(textOf(message));
    if (!name) return false;
    if (!(await isKnownCommand(name))) return false;

    // The bot must actually act on this command: bot ON, user not banned, private mode only for owner/sudo.
    try { if (!require('./botSwitch').isOn() && !['boton', 'bot'].includes(name)) return false; } catch (_) {}
    const sender = key.participant || key.remoteJid;
    if (!key.fromMe) {
      try { if (require('./isBanned').isBanned(sender) && name !== 'unban') return false; } catch (_) {}
      let isPublic = true;
      try { const d = require('./modeCache').read(); if (typeof d.isPublic === 'boolean') isPublic = d.isPublic; } catch (_) {}
      if (!isPublic) {
        let allowed = false;
        try { allowed = await require('./isOwner')(sender, sock, key.remoteJid); } catch (_) {}
        if (!allowed) return false;
      }
    }

    const emoji = emojiFor(name) || DEFAULT_EMOJI;
    await Promise.race([
      sock.sendMessage(key.remoteJid, { react: { text: emoji, key } }),
      new Promise(r => setTimeout(r, REACT_TIMEOUT_MS))
    ]);
    return true;
  } catch (e) {
    console.error('[cmdreact]', e?.message || e);
    return false;
  }
}

// ── .cmdreact on|off|status ──────────────────────────────────────────────────
function parseCommand(text) {
  const m = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ').match(/^\.cmdreact(?: (on|off|status))?$/);
  return m ? { arg: m[1] || 'status' } : null;
}
function runCommand({ arg }) {
  const s = load();
  if (arg === 'on')  { s.enabled = true;  save(); return '✅ *Command reactions ON* — bot har command par pehle reaction dega (🎵 music, 🤖 AI, 🎬 video ...), phir output.'; }
  if (arg === 'off') { s.enabled = false; save(); return '❌ *Command reactions OFF*.'; }
  return `⚡ *Command reactions*: ${s.enabled ? '✅ ON' : '❌ OFF'}\n\n*.cmdreact on* / *.cmdreact off*\n🎵 music  🤖 AI  🎬 video  🎭 sticker  🛡️ admin  👑 owner  😂 fun  🔎 search  ⚡ baaki sab`;
}

module.exports = { react, parseCommand, runCommand, commandName, emojiFor };
