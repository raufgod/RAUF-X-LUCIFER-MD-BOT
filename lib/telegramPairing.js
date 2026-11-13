'use strict';
// RAUF × LUCIFER MD BOT 💫 — public Telegram pairing bot
//  • PUBLIC: anyone can use it (set TELEGRAM_RESTRICT_TO_ALLOWED=true to limit to TELEGRAM_ALLOWED_USERS).
//  • UNLIMITED sessions per Telegram account: every /pair <number> creates its own separate session.
//    (optional cap: TELEGRAM_MAX_SESSIONS_PER_USER=5, 0 = unlimited)
//  • Layout on disk:  telegram_sessions/<telegramUserId>/<number>/   (old single-session folders auto-migrate)
require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const P = require('pino');
const {
  default: makeWASocketDefault, makeWASocket: makeWASocketNamed, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, delay
} = require('@whiskeysockets/baileys');
const makeWASocket = makeWASocketDefault || makeWASocketNamed;
const { socketOptions, attachRuntime } = require('./botSession');

const DATA = path.resolve(process.env.TELEGRAM_SESSIONS_DIR || './telegram_sessions');
fs.ensureDirSync(DATA);
const token = process.env.TELEGRAM_BOT_TOKEN || '';
const restrict = String(process.env.TELEGRAM_RESTRICT_TO_ALLOWED || '').toLowerCase() === 'true';
const allow = new Set(String(process.env.TELEGRAM_ALLOWED_USERS || '').split(',').map(s => s.trim()).filter(Boolean));
const MAX_PER_USER = Math.max(0, parseInt(process.env.TELEGRAM_MAX_SESSIONS_PER_USER || '0', 10) || 0);
const isAllowed = id => !restrict || allow.has(String(id));

const sessions = new Map();            // `${tgId}:${number}` -> { sock, connecting, authDir, number, tgId }
let tg;
const skey = (tgId, number) => `${tgId}:${number}`;
const send = (chatId, text, extra) => tg.sendMessage(chatId, (() => { try { return require('./brand').text(String(text)); } catch (_) { return text; } })(), { disable_web_page_preview: true, ...(extra || {}) });
const pairCard = require('./pairCard');

// ───── Admins + multi-channel force-join gate ─────
//  • TELEGRAM_ADMIN_IDS=111111111,222222222   only these Telegram chat IDs see the "🛠 Admin" button (and skip the gate).
//  • An admin makes the bot an ADMIN of a channel → the bot auto-registers that channel (max 4) and every other user
//    must join ALL registered channels before the "🔗 Pair a Number" button is shown.
//  • Registered channels are stored in data/tg-channels.json. If none are registered yet, TELEGRAM_REQUIRED_CHANNEL (@Next_DYS) is used.
//  • TELEGRAM_FORCE_JOIN=false switches the gate off.
const ADMIN_IDS = new Set(String(process.env.TELEGRAM_ADMIN_IDS || '8964474291,7362543454').split(',').map(x => x.trim()).filter(Boolean));
const storedAdmins = () => { try { const a = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'tg-settings.json'), 'utf8')).admins; return Array.isArray(a) ? a.map(String) : []; } catch (_) { return []; } };
const isAdmin = id => ADMIN_IDS.has(String(id)) || storedAdmins().includes(String(id));
const MAX_CHANNELS = 10;   // 4 or more channels can be added
let botUsername = '';
const FALLBACK_CHANNEL = String(process.env.TELEGRAM_REQUIRED_CHANNEL || '@Next_DYS').trim();
const FALLBACK_URL = process.env.TELEGRAM_CHANNEL_URL || `https://t.me/${FALLBACK_CHANNEL.replace(/^@/, '')}`;
const SETTINGS_FILE = path.join(process.cwd(), 'data', 'tg-settings.json');
const USERS_FILE = path.join(process.cwd(), 'data', 'tg-users.json');
const LOG_FILE = path.join(process.cwd(), 'data', 'tg-activity.json');
const readJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return d; } };
const writeJ = (f, v) => { try { fs.ensureDirSync(path.dirname(f)); fs.writeFileSync(f, JSON.stringify(v)); } catch (e) { console.error('[TG save]', e.message); } };
const gateOn = () => { const st = readJ(SETTINGS_FILE, {}); return typeof st.forceJoin === 'boolean' ? st.forceJoin : String(process.env.TELEGRAM_FORCE_JOIN || 'true').toLowerCase() !== 'false'; };
const IST = d => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const bt = t => { try { return require('./brand').text(String(t)); } catch (_) { return String(t); } };
function trackUser(u) {
  if (!u || u.is_bot) return;
  const all = readJ(USERS_FILE, {}), id = String(u.id);
  if (!all[id]) { all[id] = { name: [u.first_name, u.last_name].filter(Boolean).join(' '), username: u.username || '', first: Date.now() }; writeJ(USERS_FILE, all); logAct(`New user ${all[id].name || id} (${id})`); }
}
function logAct(text) { const l = readJ(LOG_FILE, []); l.push({ t: Date.now(), text }); writeJ(LOG_FILE, l.slice(-100)); }
const bcWait = new Set();
const adminWait = new Set();   // admins who tapped “➕ Add Admin” and must now send the new admin's chat ID
const CHANNELS_FILE = path.join(process.cwd(), 'data', 'tg-channels.json');
const HEADER_VIDEO = path.join(process.cwd(), 'assets', 'telegram-header.mp4');
let gateWarned = new Set();
function loadChannels() {
  try { const a = JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf8')); if (Array.isArray(a) && a.length) return a.slice(0, MAX_CHANNELS); } catch (_) {}
  return [{ id: FALLBACK_CHANNEL, title: FALLBACK_CHANNEL, url: FALLBACK_URL }];
}
function saveChannels(list) {
  try { fs.ensureDirSync(path.dirname(CHANNELS_FILE)); fs.writeFileSync(CHANNELS_FILE, JSON.stringify(list.slice(0, MAX_CHANNELS), null, 2)); } catch (e) { console.error('[TG channels save]', e.message); }
}
function registeredChannels() { try { return JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf8')) || []; } catch (_) { return []; } }
const brandName = () => { try { return require('../settings').botName; } catch (_) { return 'RAUF × LUCIFER MD BOT'; } };
const socialLinks = () => { try { return require('./connectNotice').links(); } catch (_) { return { telegram: FALLBACK_URL, youtube: '' }; } };

/** true = member, false = not a member, null = cannot check (bot not admin of the channel) */
async function isMemberOf(ch, userId) {
  try {
    const m = await tg.getChatMember(ch.id, userId);
    return ['creator', 'administrator', 'member'].includes(m.status) || (m.status === 'restricted' && m.is_member === true);
  } catch (e) {
    const msg = String(e.message || e);
    if (/user not found|PARTICIPANT/i.test(msg)) return false;
    if (!gateWarned.has(ch.id)) { gateWarned.add(ch.id); console.error(`[Telegram gate] ⚠️ cannot check ${ch.id}: ${msg}\n   → add the bot as an ADMIN of that channel.`); }
    return null;
  }
}
/** → { ok, missing:[channels the user has not joined] }  (channels the bot cannot check are skipped so nobody is locked out) */
async function checkChannels(userId) {
  if (!gateOn() || isAdmin(userId)) return { ok: true, missing: [] };
  const missing = [];
  for (const ch of loadChannels()) if ((await isMemberOf(ch, userId)) === false) missing.push(ch);
  return { ok: !missing.length, missing };
}
async function passGate(userId) { return (await checkChannels(userId)).ok; }
function sendGate(chatId, missing) {
  const list = missing && missing.length ? missing : loadChannels();
  const rows = list.map((c, i) => [{ text: `📢 Join ${c.title || 'Channel ' + (i + 1)}`, url: c.url }]);
  rows.push([{ text: '✅ Verify', callback_data: 'verify' }]);
  return send(chatId,
    `🔒 ACCESS LOCKED\n\nTo use ${brandName()} you must join ${list.length > 1 ? 'all our official Telegram channels' : 'our official Telegram channel'} first.\n\n` +
    `1️⃣ Tap every “📢 Join” button below\n2️⃣ Come back here and tap “✅ Verify”\n\nAfter verification the Pair button appears.`,
    { reply_markup: { inline_keyboard: rows } });
}
/** Header = VIDEO (assets/telegram-header.mp4); falls back to the old photo, then plain text. */
async function sendWithHeader(chatId, text, kb) {
  try {
    if (fs.existsSync(HEADER_VIDEO)) return await tg.sendVideo(chatId, fs.createReadStream(HEADER_VIDEO), { caption: text, supports_streaming: true, width: 720, height: 1280, ...kb });
  } catch (e) { console.error('[TG header video]', e.message); }
  try {
    const img = path.join(process.cwd(), 'assets', 'rauf-header.jpg');
    if (fs.existsSync(img)) return await tg.sendPhoto(chatId, fs.createReadStream(img), { caption: text, ...kb });
  } catch (e) { console.error('[TG header photo]', e.message); }
  return send(chatId, text, kb);
}
async function startScreen(chatId, userId) {
  const L = socialLinks();
  const text = `${brandName()} pairing 👑\n⚡ Powerful • Multi Device • Fast\n\n` +
    '/pair 919XXXXXXXXX — link a WhatsApp number (pair as many as you like)\n' +
    '/sessions — list all your sessions\n' +
    '/session 919XXXXXXXXX — status of one session\n' +
    '/deletesession 919XXXXXXXXX — unlink & remove that session\n\n' +
    'Tap “🔗 Pair a Number” to begin.';
  const rows = [[{ text: '🔗 Pair a Number', callback_data: 'pair_help' }]];
  if (isAdmin(userId)) rows.unshift([{ text: '🛠 Admin', callback_data: 'admin' }]);   // ONLY the admin chat IDs see this
  const soc = [{ text: '📢 Telegram Channel', url: L.telegram || FALLBACK_URL }];
  if (L.youtube) soc.push({ text: '▶️ YouTube', url: L.youtube });
  rows.push(soc);
  return sendWithHeader(chatId, text, { reply_markup: { inline_keyboard: rows } });
}
const fmtT = t => new Date(t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
const backRow = [{ text: '⬅️ Control Center', callback_data: 'admin' }];
function adminScreen(screen) {
  const users = readJ(USERS_FILE, {}), uArr = Object.entries(users), today = IST(Date.now());
  const chans = registeredChannels();
  const live = [...sessions.values()].filter(x => x.sock?.user);
  let totalSaved = 0; try { for (const d of fs.readdirSync(DATA)) { const dd = path.join(DATA, d); if (fs.statSync(dd).isDirectory()) totalSaved += fs.readdirSync(dd).filter(n => /^\d{8,15}$/.test(n)).length; } } catch (_) {}
  const kb = rows => ({ reply_markup: { inline_keyboard: rows } });
  if (screen === 'stats') {
    const wk = uArr.filter(([, u]) => Date.now() - u.first < 7 * 864e5).length;
    return { text: `📊 STATISTICS\n\n👥 Users: ${uArr.length}\n🆕 Today: ${uArr.filter(([, u]) => IST(u.first) === today).length}\n📅 Last 7 days: ${wk}\n🔗 Paired numbers: ${totalSaved}\n🟢 Connected now: ${live.length}\n📢 Force-join channels: ${chans.length}/${MAX_CHANNELS}\n⏱ Uptime: ${Math.floor(process.uptime() / 3600)}h ${Math.floor(process.uptime() / 60) % 60}m\n💾 RAM: ${Math.round(process.memoryUsage().rss / 1048576)} MB`, ...kb([backRow]) };
  }
  if (screen === 'live') {
    const lines = live.slice(0, 20).map(x => `🟢 +${x.number} (TG ${x.tgId})`).join('\n') || 'No live sessions right now.';
    return { text: `🟢 LIVE TRAFFIC\n\nConnected: ${live.length}\nSaved sessions: ${totalSaved}\nOffline/reconnecting: ${Math.max(0, totalSaved - live.length)}\n\n${lines}`, ...kb([[{ text: '🔄 Refresh', callback_data: 'adm:live' }], backRow]) };
  }
  if (screen === 'users') {
    const last = uArr.sort((x, y) => y[1].first - x[1].first).slice(0, 15).map(([id, u]) => `• ${u.name || '-'}${u.username ? ' @' + u.username : ''} — ${id}`).join('\n') || 'No users yet.';
    return { text: `👥 USERS (${uArr.length})\n\nLatest 15:\n${last}`, ...kb([backRow]) };
  }
  if (screen === 'sessions') {
    const lines = [...sessions.values()].slice(0, 25).map(x => `${x.sock?.user ? '✅' : '⏳'} +${x.number} — TG ${x.tgId}`).join('\n') || 'No sessions loaded.';
    return { text: `🔗 SESSIONS (${totalSaved} saved)\n\n${lines}`, ...kb([backRow]) };
  }
  if (screen === 'bc') {
    return { text: '📣 BROADCAST\n\nNow send the message you want to broadcast (text, photo, video — anything).\nIt will be copied to every user of this bot.\n\nSend /cancel to abort.', ...kb([backRow]) };
  }
  if (screen === 'channels') {
    const lines = chans.length ? chans.map((c, i) => `${i + 1}. ${c.title || c.id}\n   ${c.url}`).join('\n') : `(none registered — using ${FALLBACK_CHANNEL})`;
    const rows = chans.map((c, i) => [{ text: `🗑 Remove ${c.title || c.id}`, callback_data: 'admin_rm:' + i }]); rows.push(backRow);
    return { text: `📢 FORCE-JOIN CHANNELS (${chans.length}/${MAX_CHANNELS})\n\n${lines}\n\n➕ To add one: make this bot an ADMIN of that channel (an admin must do it). It is registered automatically.`, ...kb(rows) };
  }
  if (screen === 'settings') {
    const wl = (() => { try { return require('./webGate').isOn(); } catch (_) { return false; } })();
    const hasPw = !!process.env.TELEGRAM_PASSWORD_BOT_TOKEN;
    return { text: `⚙️ SETTINGS\n\nForce-join gate: ${gateOn() ? '✅ ON' : '❌ OFF'}\nWebsite lock: ${wl ? '✅ ON' : '❌ OFF'}${hasPw ? '' : '  (set TELEGRAM_PASSWORD_BOT_TOKEN to enable)'}`,
      ...kb([[{ text: gateOn() ? '🔓 Turn force-join OFF' : '🔒 Turn force-join ON', callback_data: 'adm:fj' }],
             [{ text: wl ? '🔓 Turn website lock OFF' : '🔒 Turn website lock ON', callback_data: 'adm:wl' }], backRow]) };
  }
  if (screen === 'admins') {
    const fixed = [...ADMIN_IDS], extra = storedAdmins().filter(x => !ADMIN_IDS.has(x));
    const rows = extra.map(x => [{ text: `🗑 Remove ${x}`, callback_data: 'adm:rmadmin:' + x }]);
    rows.unshift([{ text: '➕ Add Admin', callback_data: 'adm:addadmin' }]); rows.push(backRow);
    return { text: `👮 ADMINS\n\nOwners (from .env, cannot be removed):\n${fixed.map(x => '• ' + x).join('\n') || '—'}\n\nAdded from the bot:\n${extra.map(x => '• ' + x).join('\n') || '(none)'}`, ...kb(rows) };
  }
  if (screen === 'addadmin') {
    return { text: '➕ ADD ADMIN\n\nSend the new admin’s Telegram chat ID (numbers only),\nor forward any message from that person to me.\n\nSend /cancel to abort.', ...kb([[{ text: '⬅️ Admins', callback_data: 'adm:admins' }]]) };
  }
  if (screen === 'log') {
    const l = readJ(LOG_FILE, []).slice(-15).reverse().map(e => `${fmtT(e.t)} — ${e.text}`).join('\n') || 'Nothing logged yet.';
    return { text: `📜 ACTIVITY LOG\n\n${l}`, ...kb([backRow]) };
  }
  // home = CONTROL CENTER
  return {
    text: `👑 CONTROL CENTER\n──────────────\n👥 Users: ${uArr.length}  (+${uArr.filter(([, u]) => IST(u.first) === today).length} today)\n📢 Force-join channels: ${chans.length}\n🟢 Live sessions: ${live.length}\n🔗 Paired numbers: ${totalSaved}\n🔒 Force-join: ${gateOn() ? 'ON' : 'OFF'}\n──────────────\nPick a tool below.`,
    ...kb([
      [{ text: '📊 Statistics', callback_data: 'adm:stats' }, { text: '🟢 Live Traffic', callback_data: 'adm:live' }],
      [{ text: '👥 Users', callback_data: 'adm:users' }, { text: '📣 Broadcast', callback_data: 'adm:bc' }],
      [{ text: '🔗 Sessions', callback_data: 'adm:sessions' }, { text: '📢 Channels', callback_data: 'adm:channels' }],
      [{ text: '➕ Admin in Channel', callback_data: 'adm:addch' }, { text: '👮 Admins', callback_data: 'adm:admins' }],
      [{ text: '⚙️ Settings', callback_data: 'adm:settings' }, { text: '📜 Activity Log', callback_data: 'adm:log' }],
      [{ text: '🏠 Main Menu', callback_data: 'adm:home' }]
    ])
  };
}
async function addChScreen() {
  let me = {}; try { me = await tg.getMe(); botUsername = me.username || botUsername; } catch (_) {}
  const chans = registeredChannels(), lines = [];
  for (const c of chans) {
    let st = '❌ bot is not admin';
    try { const m = await tg.getChatMember(c.id, me.id); if (m.status === 'administrator' || m.status === 'creator') st = m.can_invite_users === false ? '⚠️ admin, but “Invite users” right is missing' : '✅ admin permissions OK'; } catch (_) {}
    lines.push(`${lines.length + 1}. ${c.title || c.id} — ${st}`);
  }
  const link = botUsername ? `https://t.me/${botUsername}?startchannel&admin=post_messages+edit_messages+delete_messages+invite_users` : '';
  const rows = [];
  if (link) rows.push([{ text: '➕ Admin in Channel', url: link }]);
  rows.push([{ text: '🔄 Refresh', callback_data: 'adm:addch' }], backRow);
  return { text: `➕ ADMIN IN CHANNEL (${chans.length}/${MAX_CHANNELS})\n\n1️⃣ Tap “➕ Admin in Channel” below\n2️⃣ Pick your channel and confirm — the bot becomes an admin there\n3️⃣ The channel is added automatically; every user must join it before using the bot\n\n${lines.join('\n') || 'No channels added yet.'}`, reply_markup: { inline_keyboard: rows } };
}
async function adminPanel(chatId, messageId, screen = 'home') {
  const v = screen === 'addch' ? await addChScreen() : adminScreen(screen), text = bt(v.text);
  if (messageId) {
    try { return await tg.editMessageText(text, { chat_id: chatId, message_id: messageId, disable_web_page_preview: true, ...v }); }
    catch (e) { if (/not modified/i.test(String(e.message))) return; }
  }
  return tg.sendMessage(chatId, text, { disable_web_page_preview: true, ...v });
}
async function runBroadcast(chatId, msg) {
  const ids = Object.keys(readJ(USERS_FILE, {}));
  let ok = 0, fail = 0;
  const note = await send(chatId, `📣 Broadcasting to ${ids.length} users…`).catch(() => null);
  for (const uid of ids) {
    try { await tg.copyMessage(uid, chatId, msg.message_id); ok++; } catch (_) { fail++; }
    await delay(60);
  }
  logAct(`Broadcast sent: ${ok} ok, ${fail} failed`);
  await send(chatId, `✅ Broadcast done.\nDelivered: ${ok}\nFailed (blocked/left): ${fail}`).catch(() => {});
}

async function listUserNumbers(tgId) {
  const dir = path.join(DATA, String(tgId));
  try {
    const out = [];
    for (const n of await fs.readdir(dir)) if (/^\d{8,15}$/.test(n) && (await fs.stat(path.join(dir, n))).isDirectory()) out.push(n);
    return out;
  } catch { return []; }
}
async function ownerOfNumber(number) {
  try {
    for (const tgId of await fs.readdir(DATA)) {
      if (await fs.pathExists(path.join(DATA, tgId, number, 'session.json'))) return tgId;
    }
  } catch {}
  return null;
}

// old layout (telegram_sessions/<id>/creds.json) -> telegram_sessions/<id>/<number>/
async function migrateLegacy() {
  try {
    for (const tgId of await fs.readdir(DATA)) {
      const dir = path.join(DATA, tgId);
      if (!(await fs.stat(dir)).isDirectory()) continue;
      const meta = path.join(dir, 'session.json');
      if (!(await fs.pathExists(meta))) continue;
      const m = await fs.readJson(meta).catch(() => null);
      const number = String(m?.number || '').replace(/\D/g, '');
      if (!number) continue;
      const target = path.join(dir, number);
      await fs.ensureDir(target);
      for (const f of await fs.readdir(dir)) {
        if (f === number) continue;
        const src = path.join(dir, f);
        if ((await fs.stat(src)).isDirectory() && /^\d{8,15}$/.test(f)) continue;
        await fs.move(src, path.join(target, f), { overwrite: true });
      }
      console.log(`[Telegram pairing] migrated legacy session ${tgId} -> ${number}`);
    }
  } catch (e) { console.error('[Telegram migrate]', e.message); }
}

async function connectSession(tgId, chatId, number, isReconnect = false) {
  const key = skey(tgId, number);
  let session = sessions.get(key);
  if (session?.connecting) return send(chatId, `⏳ +${number}: pairing is already being prepared. Please wait.`);
  if (session?.sock) { try { session.sock.end(undefined); } catch {} }

  const authDir = path.join(DATA, String(tgId), number);
  fs.ensureDirSync(authDir);
  if (!isReconnect) await require('./pairingReady').cleanUnfinished(authDir, null);      // a new link starts from empty keys
  await fs.writeJson(path.join(authDir, 'session.json'), { telegramUserId: String(tgId), number, chatId }, { spaces: 2 });
  session = { sock: null, connecting: true, authDir, number, tgId: String(tgId) };
  sessions.set(key, session);

  try {
    const { version } = await (typeof fetchLatestBaileysVersion === 'function' ? fetchLatestBaileysVersion() : Promise.resolve({})).catch(() => ({}));
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    // Reconnect of a never-completed pairing = the code expired. Don't spam new codes.
    if (isReconnect && !state.creds.registered) {
      sessions.delete(key);
      try { await fs.remove(authDir); } catch {}
      await send(chatId, `⌛ Pairing code for +${number} expired. Send /pair ${number} to get a new one.`).catch(() => {});
      return false;
    }

    // Full bot runtime (same commands as the main bot, own settings per number) — see lib/botSession.js
    const sock = makeWASocket(socketOptions({ version, state, number }));
    attachRuntime(sock, { number });
    session.sock = sock; session.connecting = false;
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async u => {
      if (u.connection === 'open') {
        session.opened = true;
        const L = socialLinks();
        // only for a NEW link — never again after a restart / update / auto-reconnect
        let owed = false; try { owed = require('./connectNotice').isPending(authDir); } catch (_) {}
        if (owed) await send(chatId, `✅ ${brandName()} connected for +${number}. This is a separate session — you can /pair more numbers.\n\n📲 Follow our official Telegram channel for updates:\n${L.telegram}\n\n▶️ Also subscribe to our YouTube channel:\n${L.youtube}`).catch(() => {});
        try { require('./connectNotice').onOpen(sock, number, authDir); } catch (_) {}
      }
      if (u.connection === 'close') {
        const code = u.lastDisconnect?.error?.output?.statusCode;
        if (sessions.get(key) !== session) return;           // replaced / deleted on purpose
        if (code === DisconnectReason.loggedOut) {
          sessions.delete(key);
          try { await fs.remove(authDir); } catch {}
          await send(chatId, `🔌 +${number} was logged out from WhatsApp, session removed. /pair ${number} to link again.`).catch(() => {});
        } else {
          setTimeout(() => connectSession(tgId, chatId, number, true).catch(e => console.error('[TG reconnect]', e.message)), 5000);
        }
      }
    });

    if (!state.creds.registered) {
      const code = await require('./pairingReady').requestCode(sock, number);   // waits for the handshake first, so the phone gets the notification
      try { require('./connectNotice').markPending(authDir); } catch (_) {}
      await send(chatId, pairCard.tg(`🔐 WhatsApp pairing code for +${number}:\n\n${String(code).match(/.{1,4}/g)?.join('-') || code}\n\nEnter it within 60 seconds: WhatsApp → Settings → Linked Devices → Link a Device → Link with phone number instead.\n\nKeep this code private. It links that WhatsApp account to this bot.`), pairCard.tgButtons());
    }
    return true;
  } catch (e) {
    session.connecting = false; sessions.delete(key);
    await send(chatId, `❌ Pairing failed for +${number}: ${e.message}`).catch(() => {});
    throw e;
  }
}

async function removeSession(tgId, number) {
  const key = skey(tgId, number);
  const s = sessions.get(key);
  sessions.delete(key);                                    // mark as intentional first
  if (s?.sock) { try { await s.sock.logout(); } catch { try { s.sock.end(undefined); } catch {} } }
  try { await fs.remove(path.join(DATA, String(tgId), number)); } catch {}
  try { await fs.remove(require('./sessionContext').sessionDir(number)); } catch {}      // its own settings too
}

// Coloured inline buttons (Bot API 9.4 `style`: primary=blue, success=green, danger=red; older clients just show normal buttons)
function paintOpts(o) {
  try {
    const k = o && o.reply_markup && o.reply_markup.inline_keyboard;
    if (k) for (const row of k) for (const b of row) {
      if (b.style) continue;
      const t = b.text || '';
      b.style = /Remove|OFF|Cancel|Delete|Stop/i.test(t) ? 'danger'
        : (/Pair|Verify|Admin in Channel|Refresh/i.test(t) || /\bON\b/.test(t) || b.callback_data === 'verify') ? 'success' : 'primary';
    }
  } catch (_) {}
  return o;
}
function startTelegramPairing() {
  if (global.__kobTelegramPairing) return global.__kobTelegramPairing;   // the main socket reconnects now and then — start polling only once
  if (!token) { console.log('[Telegram pairing] Disabled: TELEGRAM_BOT_TOKEN is not configured.'); return null; }
  tg = new TelegramBot(token, { polling: { params: { allowed_updates: ['message', 'callback_query', 'my_chat_member'] } } });
  global.__kobTelegramPairing = tg;
  for (const [m, i] of [['sendMessage', 2], ['sendVideo', 2], ['sendPhoto', 2], ['editMessageText', 1]]) {
    const orig = tg[m].bind(tg);
    tg[m] = (...a) => { if (a[i]) paintOpts(a[i]); return orig(...a); };
  }
  tg.getMe().then(me => { botUsername = me.username || ''; }).catch(() => {});
  tg.on('polling_error', e => console.error('[Telegram polling]', e.message));

  const HELP = 'RAUF × LUCIFER MD BOT pairing 👑 (public)\n\n' +
    '/pair 919XXXXXXXXX — link a WhatsApp number (you can pair as many numbers as you like)\n' +
    '/sessions — list all your sessions\n' +
    '/session 919XXXXXXXXX — status of one session\n' +
    '/deletesession 919XXXXXXXXX — unlink & remove that session';

  tg.on('message', async msg => {
    const chatId = msg.chat.id, id = String(msg.from?.id || '');
    const text = String(msg.text || '').trim();
    if (msg.chat.type !== 'private') return;
    if (!isAllowed(id)) { await send(chatId, '⛔ This bot is restricted to approved users.').catch(() => {}); return; }
    trackUser(msg.from);
    if (isAdmin(id) && bcWait.has(id)) {
      if (/^\/cancel/i.test(text)) { bcWait.delete(id); return void send(chatId, '❎ Broadcast cancelled.').catch(() => {}); }
      if (!text.startsWith('/')) { bcWait.delete(id); return void runBroadcast(chatId, msg).catch(e => console.error('[TG broadcast]', e.message)); }
    }
    if (isAdmin(id) && adminWait.has(id)) {
      if (/^\/cancel/i.test(text)) { adminWait.delete(id); return void send(chatId, '❎ Cancelled.').catch(() => {}); }
      const newId = msg.forward_from?.id ? String(msg.forward_from.id) : (/^\d{5,15}$/.test(text.trim()) ? text.trim() : '');
      if (!newId) return void send(chatId, '⚠️ Please send a numeric Telegram chat ID (or forward a message from that person). /cancel to abort.').catch(() => {});
      adminWait.delete(id);
      const st = readJ(SETTINGS_FILE, {}); st.admins = [...new Set([...(st.admins || []).map(String), newId])]; writeJ(SETTINGS_FILE, st);
      logAct(`Admin added: ${newId} (by ${id})`);
      send(newId, '👮 You are now an admin of this bot. Send /admin to open the Control Center.').catch(() => {});
      return void adminPanel(chatId, null, 'admins').catch(() => {});
    }
    if (isAdmin(id) && /^\/admin(@\w+)?$/i.test(text)) return void adminPanel(chatId).catch(e => console.error('[TG admin]', e.message));
    if (!text.startsWith('/')) return;

    const [cmdRaw, ...rest] = text.split(/\s+/);
    const cmd = cmdRaw.toLowerCase().replace(/@\w+$/, '');
    const arg = rest.join('').replace(/\D/g, '');

    if (cmd === '/start') {
      const g = await checkChannels(id);
      if (!g.ok) return void sendGate(chatId, g.missing).catch(() => {});
      return void startScreen(chatId, id).catch(() => {});
    }
    if (cmd === '/help') return void send(chatId, HELP);

    if (cmd === '/sessions' || cmd === '/list') {
      const nums = await listUserNumbers(id);
      if (!nums.length) return void send(chatId, 'You have no sessions yet. Use /pair 919XXXXXXXXX');
      const lines = nums.map(n => `${sessions.get(skey(id, n))?.sock?.user ? '✅' : '⏳'} +${n}`);
      return void send(chatId, `Your sessions (${nums.length}):\n${lines.join('\n')}`);
    }

    if (cmd === '/session' || cmd === '/status') {
      const nums = await listUserNumbers(id);
      const n = arg || (nums.length === 1 ? nums[0] : '');
      if (!n) return void send(chatId, nums.length ? 'Which one? /session 919XXXXXXXXX\n\n' + nums.map(x => '+' + x).join('\n') : 'No sessions yet. Use /pair 919XXXXXXXXX');
      const s = sessions.get(skey(id, n));
      return void send(chatId, s?.sock?.user ? `✅ +${n} connected: ${s.sock.user.id}` : `⏳ +${n}: not connected right now (saved sessions reconnect automatically).`);
    }

    if (cmd === '/deletesession' || cmd === '/logout') {
      const nums = await listUserNumbers(id);
      const n = arg || (nums.length === 1 ? nums[0] : '');
      if (!n) return void send(chatId, nums.length ? 'Which one? /deletesession 919XXXXXXXXX\n\n' + nums.map(x => '+' + x).join('\n') : 'You have no sessions.');
      if (!nums.includes(n)) return void send(chatId, `+${n} is not one of your sessions.`);
      logAct(`Session +${n} deleted by TG ${id}`);
      await removeSession(id, n);
      return void send(chatId, `🗑️ Session +${n} logged out and removed.`);
    }

    if (cmd === '/pair') {
      const g = await checkChannels(id);
      if (!g.ok) return void sendGate(chatId, g.missing).catch(() => {});
      const number = arg;
      if (!number) return void send(chatId, pairCard.tg('Use: /pair 919XXXXXXXXX (country code + number)', 'Pair a Number'), pairCard.tgButtons());
      if (number.length < 8 || number.length > 15) return void send(chatId, 'Enter a valid international phone number including country code.');
      const owner = await ownerOfNumber(number);
      if (owner && owner !== id) return void send(chatId, `⛔ +${number} is already linked by another Telegram account.`);
      const mine = await listUserNumbers(id);
      if (MAX_PER_USER && !mine.includes(number) && mine.length >= MAX_PER_USER) return void send(chatId, `Session limit reached (${MAX_PER_USER}). Delete one with /deletesession <number>.`);
      logAct(`/pair +${number} by TG ${id}`);
      await connectSession(id, chatId, number).catch(() => {});
      return;
    }
  });


  // Bot promoted to ADMIN of a channel by one of the admin chat IDs → register it for the force-join gate.
  tg.on('my_chat_member', async u => {
    try {
      const chat = u.chat, st = u.new_chat_member?.status;
      if (chat.type !== 'channel') return;
      const list = registeredChannels();
      if (st === 'administrator') {
        if (!isAdmin(u.from?.id)) return;                                   // only our admins can add channels
        if (list.some(c => String(c.id) === String(chat.id))) return;
        if (list.length >= MAX_CHANNELS) return void send(u.from.id, `⚠️ Already ${MAX_CHANNELS} channels registered. Remove one in 🛠 Admin first.`).catch(() => {});
        let url = chat.username ? `https://t.me/${chat.username}` : '';
        if (!url) { try { url = await tg.exportChatInviteLink(chat.id); } catch (_) {} }
        if (!url) return void send(u.from.id, `⚠️ Could not get an invite link for “${chat.title}”. Give the bot the “Invite users” right and add it again.`).catch(() => {});
        list.push({ id: chat.id, title: chat.title || String(chat.id), url });
        saveChannels(list); logAct(`Channel added: ${chat.title}`);
        send(u.from.id, `✅ Channel registered for force-join (${list.length}/${MAX_CHANNELS}): ${chat.title}\n${url}`).catch(() => {});
      } else if (['left', 'kicked'].includes(st)) {
        const next = list.filter(c => String(c.id) !== String(chat.id));
        if (next.length !== list.length) saveChannels(next);
      }
    } catch (e) { console.error('[TG my_chat_member]', e.message); }
  });

  tg.on('callback_query', async q => {
    const chatId = q.message?.chat?.id, id = String(q.from?.id || '');
    try {
      if (q.data === 'verify') {
        const g = await checkChannels(q.from.id);
        if (!g.ok) { await tg.answerCallbackQuery(q.id, { text: `❌ You have not joined ${g.missing.length} channel(s) yet. Join all of them, then tap Verify.`, show_alert: true }); return; }
        await tg.answerCallbackQuery(q.id, { text: '✅ Verified!' });
        try { await tg.deleteMessage(chatId, q.message.message_id); } catch (_) {}
        await startScreen(chatId, id);                   // Pair button appears only now
      } else if (q.data === 'pair_help') {
        await tg.answerCallbackQuery(q.id);
        const g = await checkChannels(id);
        if (!g.ok) return void sendGate(chatId, g.missing);
        await send(chatId, pairCard.tg('Send your number like this:\n\n/pair 919XXXXXXXXX\n\n(country code + number, digits only)', 'Pair a Number'), pairCard.tgButtons());
      } else if (q.data === 'admin' || (q.data && q.data.startsWith('adm:')) || (q.data && q.data.startsWith('admin_rm:'))) {
        if (!isAdmin(id)) return void tg.answerCallbackQuery(q.id, { text: '⛔ Admins only', show_alert: true });
        let screen = 'home', note;
        if (q.data.startsWith('admin_rm:')) { const list = registeredChannels(); const [gone] = list.splice(parseInt(q.data.split(':')[1], 10), 1); saveChannels(list); if (gone) logAct(`Channel removed: ${gone.title || gone.id}`); screen = 'channels'; note = '🗑 Channel removed'; }
        else if (q.data === 'adm:fj') { const st = readJ(SETTINGS_FILE, {}); st.forceJoin = !gateOn(); writeJ(SETTINGS_FILE, st); logAct(`Force-join turned ${st.forceJoin ? 'ON' : 'OFF'}`); screen = 'settings'; }
        else if (q.data === 'adm:wl') { const st = readJ(SETTINGS_FILE, {}); st.webLock = !require('./webGate').isOn(); writeJ(SETTINGS_FILE, st); logAct(`Website lock turned ${st.webLock ? 'ON' : 'OFF'}`); screen = 'settings'; }
        else if (q.data.startsWith('adm:rmadmin:')) { const x = q.data.slice(12); const st = readJ(SETTINGS_FILE, {}); st.admins = (st.admins || []).map(String).filter(a => a !== x); writeJ(SETTINGS_FILE, st); logAct(`Admin removed: ${x}`); screen = 'admins'; note = '🗑 Admin removed'; }
        else if (q.data === 'adm:home') { await tg.answerCallbackQuery(q.id); return void startScreen(chatId, id); }
        else if (q.data.startsWith('adm:')) screen = q.data.slice(4);
        if (screen === 'bc') bcWait.add(id); else bcWait.delete(id);
        if (screen === 'addadmin') adminWait.add(id); else adminWait.delete(id);
        await tg.answerCallbackQuery(q.id, note ? { text: note } : {});
        await adminPanel(chatId, q.message.message_id, screen);
      } else { await tg.answerCallbackQuery(q.id); }
    } catch (e) { console.error('[TG callback]', e.message); }
  });

  if (gateOn()) {
    tg.getMe().then(async me => {
      for (const ch of loadChannels()) {
        try { const m = await tg.getChatMember(ch.id, me.id); console.log(['administrator', 'creator'].includes(m.status) ? `[Telegram gate] ✅ force-join active for ${ch.title || ch.id}` : `[Telegram gate] ⚠️ make the bot an ADMIN of ${ch.title || ch.id}`); }
        catch (e) { console.warn(`[Telegram gate] ⚠️ cannot see ${ch.title || ch.id} (${e.message}). Add the bot as an ADMIN of the channel.`); }
      }
    }).catch(() => {});
  }

  console.log(`[Telegram pairing] Polling enabled — ${restrict ? 'restricted to ' + allow.size + ' user(s)' : 'PUBLIC, unlimited sessions per user'}.`);

  // Restore every saved session (staggered so we don't hit WhatsApp all at once).
  (async () => {
    await migrateLegacy();
    try {
      for (const tgId of await fs.readdir(DATA)) {
        for (const number of await listUserNumbers(tgId)) {
          const dir = path.join(DATA, tgId, number);
          if (!(await fs.pathExists(path.join(dir, 'creds.json')))) { await fs.remove(dir).catch(() => {}); continue; }
          const meta = await fs.readJson(path.join(dir, 'session.json')).catch(() => ({}));
          connectSession(tgId, meta.chatId || Number(tgId), number, true).catch(e => console.error('[Telegram restore]', e.message));
          await delay(1500);
        }
      }
    } catch (e) { console.error('[Telegram restore scan]', e.message); }
  })();
  return tg;
}
module.exports = { startTelegramPairing, checkChannels, loadChannels, isAdmin, gateOn };
