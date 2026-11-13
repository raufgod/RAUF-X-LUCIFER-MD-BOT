'use strict';
// RAUF × LUCIFER MD BOT — "LuciferX" feature pack (all new, fully offline, no API key needed).
//
//   .lucifer / .about        brand card with the header photo
//   .luciferx / .lx          list of all LuciferX features
//   .rank [@user]            level / XP card        .top      group XP leaderboard
//   .daily                   daily coins + streak   .wallet [@user]   coin balance
//   .slots <bet>             slot machine           .give @user <coins>
//   .richlist                top coin holders
//   .mathquiz                first correct answer wins coins + XP
//   .afk [reason]            auto-reply when you are tagged while away
//   .todo add|done|del|clear personal to-do list
//   .rate <text>             random % rating        .vibe [@user]     vibe check
const fs = require('fs');
const path = require('path');
const card = require('../lib/cardStyle');

const COMMANDS = ['lucifer', 'about', 'luciferx', 'lx', 'rank', 'level', 'top', 'daily', 'wallet', 'balance', 'slots', 'give', 'richlist', 'mathquiz', 'afk', 'todo', 'rate', 'vibe'];

const DATA_FILE = path.join(process.cwd(), 'data', 'luciferx.json');
let DB = null, saveTimer = null;
const quizzes = new Map();           // chatId -> { answer, expires, timer }
const xpCooldown = new Map();        // jid -> last xp time
const slotCooldown = new Map();

function load() {
  if (DB) return DB;
  try { DB = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (_) { DB = {}; }
  DB.users ||= {}; DB.chatXp ||= {};
  return DB;
}
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      const tmp = DATA_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(DB));
      fs.renameSync(tmp, DATA_FILE);
    } catch (e) { console.error('[LuciferX] save failed:', e.message); }
  }, 4000);
  if (saveTimer.unref) saveTimer.unref();
}
function user(jid) {
  const db = load();
  if (!db.users[jid]) db.users[jid] = { xp: 0, msgs: 0, coins: 0, lastDaily: 0, streak: 0, todo: [], afk: null };
  return db.users[jid];
}

const num = (jid = '') => String(jid).split('@')[0].split(':')[0].replace(/\D/g, '');
const settings = () => { try { return require('../settings'); } catch (_) { return {}; } };
const getText = (m) => { const x = m?.message || {}; return (x.conversation || x.extendedTextMessage?.text || x.imageMessage?.caption || x.videoMessage?.caption || '').trim(); };
function senderOf(message) {
  const k = message.key || {};
  return [k.participantAlt, k.remoteJidAlt, k.participant, k.remoteJid].find((v) => typeof v === 'string' && v.endsWith('@s.whatsapp.net')) || k.participant || k.remoteJid || '';
}
function targetOf(message) {
  const ci = message?.message?.extendedTextMessage?.contextInfo || {};
  return (ci.mentionedJid && ci.mentionedJid[0]) || ci.participant || '';
}
const levelOf = (xp) => Math.floor(Math.sqrt(xp / 60));
const xpFor = (lvl) => lvl * lvl * 60;
const bar = (p, n = 10) => '▰'.repeat(Math.round(p * n)) + '▱'.repeat(n - Math.round(p * n));
const fmt = (n) => Number(n).toLocaleString('en-US');
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const dur = (ms) => card.dur(ms / 1000);

const reply = (sock, chatId, message, text, mentions) => sock.sendMessage(chatId, mentions ? { text, mentions } : { text }, { quoted: message });
const panel = (o) => card.panel(o);

function headerImage() {
  try {
    const p = require('../lib/sessionContext').assetPath('rauf-header.jpg');
    if (fs.existsSync(p)) return fs.readFileSync(p);
  } catch (_) {}
  try { return fs.readFileSync(path.join(process.cwd(), 'assets', 'rauf-header.jpg')); } catch (_) { return null; }
}

/* ───────────── passive tracking: XP, AFK, quiz answers ───────────── */
async function trackIncoming(sock, message) {
  try {
    if (!message?.message || message.key?.fromMe) return;
    const chatId = message.key.remoteJid || '';
    if (!chatId || chatId === 'status@broadcast' || chatId.endsWith('@newsletter')) return;
    const text = getText(message);
    const sender = senderOf(message);
    if (!sender) return;
    const isGroup = chatId.endsWith('@g.us');
    const u = user(sender);

    // 1) back from AFK
    if (u.afk && !/^\.afk(\s|$)/i.test(text)) {
      const away = dur(Date.now() - u.afk.since);
      u.afk = null; save();
      await reply(sock, chatId, message, panel({ icon: '👋', title: 'Welcome back', body: `@${num(sender)} is no longer AFK (away ${away}).` }), [sender]);
    }

    // 2) someone tagged / replied to an AFK user
    if (isGroup) {
      const ci = message.message.extendedTextMessage?.contextInfo || {};
      const hit = new Set([...(ci.mentionedJid || []), ci.participant].filter(Boolean));
      for (const jid of hit) {
        const t = load().users[jid];
        if (t && t.afk && jid !== sender) {
          await reply(sock, chatId, message, panel({ icon: '💤', title: 'AFK', body: `@${num(jid)} is away${t.afk.reason ? `: *${t.afk.reason}*` : ''}\n⏱️ ${dur(Date.now() - t.afk.since)} ago` }), [jid]);
        }
      }
    }

    // 3) quiz answer
    const q = quizzes.get(chatId);
    if (q && Date.now() < q.expires && /^-?\d+$/.test(text) && Number(text) === q.answer) {
      clearTimeout(q.timer); quizzes.delete(chatId);
      u.coins += q.reward; u.xp += 30; save();
      await reply(sock, chatId, message, panel({ icon: '🏆', title: 'Correct!', body: `@${num(sender)} answered *${q.answer}* first!\n+${q.reward} 🪙 coins · +30 XP` }), [sender]);
      return;
    }

    // 4) XP for normal chat (30 s cooldown per user, commands do not count)
    if (text && !text.startsWith('.') && !(text.startsWith('/'))) {
      u.msgs++;
      const last = xpCooldown.get(sender) || 0;
      if (Date.now() - last > 30000) {
        xpCooldown.set(sender, Date.now());
        const before = levelOf(u.xp);
        const gain = 12 + Math.floor(Math.random() * 14);
        u.xp += gain;
        if (isGroup) { const c = (load().chatXp[chatId] ||= {}); c[sender] = (c[sender] || 0) + gain; }
        const after = levelOf(u.xp);
        if (after > before && isGroup) {
          await reply(sock, chatId, message, panel({ icon: '🆙', title: 'Level up', body: `@${num(sender)} reached *Level ${after}* 🎉` }), [sender]);
        }
      }
      save();
    }
  } catch (e) { console.error('[LuciferX] track:', e.message); }
}

/* ───────────── commands ───────────── */
async function handleLuciferX(sock, message, ctx = {}) {
  const chatId = message?.key?.remoteJid || '';
  const raw = getText(message);
  const m = raw.match(/^\.([a-z0-9_-]+)(?:\s+([\s\S]*))?$/i);
  if (!m) return false;
  const cmd = m[1].toLowerCase();
  if (!COMMANDS.includes(cmd)) return false;
  const arg = (m[2] || '').trim();
  const sender = senderOf(message);
  const isGroup = chatId.endsWith('@g.us');
  const me = user(sender);
  const S = settings();
  const NAME = S.botName || 'RAUF × LUCIFER MD BOT';

  try {
    switch (cmd) {
      case 'lucifer':
      case 'about': {
        const caption = [
          `┏━━━━━━━━━━━━━━━━━━━━`,
          `┃ 👑 *${NAME}*`,
          `┃ ⚡ Powerful • Multi Device • Fast`,
          `┣━━━━━━━━━━━━━━━━━━━━`,
          `┃ 🛠️ *Main Owner & Developer*`,
          `┃ 💜 RAUF × LUCIFER`,
          `┃ 📌 Prefix » ${S.prefix || '.'}`,
          `┃ 🧬 Version » ${S.version || '1.0.0'}`,
          `┗━━━━━━━━━━━━━━━━━━━━`,
          S.channelLink ? `\n📢 Channel: ${S.channelLink}` : '',
          S.groupLink ? `👥 Group: ${S.groupLink}` : '',
          `\nType *.luciferx* to see the new features.`
        ].filter((x) => x !== '').join('\n');
        const img = headerImage();
        if (img) await sock.sendMessage(chatId, { image: img, caption }, { quoted: message });
        else await reply(sock, chatId, message, caption);
        return true;
      }

      case 'luciferx':
      case 'lx': {
        const p = S.prefix || '.';
        const body = [
          `🆙 *Levels & XP*\n${p}rank · ${p}top`,
          `🪙 *Economy*\n${p}daily · ${p}wallet · ${p}slots <bet> · ${p}give @user <coins> · ${p}richlist`,
          `🧮 *Quiz*\n${p}mathquiz — first correct answer wins`,
          `💤 *AFK*\n${p}afk <reason> — auto-reply when you are tagged`,
          `📝 *To-do*\n${p}todo add <text> · ${p}todo · ${p}todo done <n> · ${p}todo del <n> · ${p}todo clear`,
          `🎲 *Fun*\n${p}rate <anything> · ${p}vibe [@user]`,
          `ℹ️ *Brand card*\n${p}lucifer`
        ].join('\n\n');
        await reply(sock, chatId, message, panel({ icon: '⚡', title: 'LuciferX features', body }));
        return true;
      }

      case 'rank':
      case 'level': {
        const t = targetOf(message) || sender;
        const u = t === sender ? me : user(t);
        const lvl = levelOf(u.xp), cur = xpFor(lvl), nxt = xpFor(lvl + 1);
        const prog = (u.xp - cur) / (nxt - cur);
        let pos = '—';
        if (isGroup) {
          const all = Object.entries(load().chatXp[chatId] || {}).sort((a, b) => b[1] - a[1]);
          const i = all.findIndex(([j]) => j === t); if (i >= 0) pos = `#${i + 1}`;
        }
        await reply(sock, chatId, message, panel({
          icon: '🆙', title: 'Rank card',
          rows: [['👤', 'User', `@${num(t)}`], ['⭐', 'Level', lvl], ['✨', 'XP', `${fmt(u.xp)} / ${fmt(nxt)}`], ['💬', 'Messages', fmt(u.msgs)], ['🏅', 'Group rank', pos]],
          body: `${bar(prog)} ${Math.round(prog * 100)}%`
        }), [t]);
        return true;
      }

      case 'top': {
        if (!isGroup) { await reply(sock, chatId, message, card.problem('This command works in groups only.')); return true; }
        const all = Object.entries(load().chatXp[chatId] || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
        if (!all.length) { await reply(sock, chatId, message, card.problem('No XP yet — start chatting!', 'Empty')); return true; }
        const medals = ['🥇', '🥈', '🥉'];
        const body = all.map(([j, xp], i) => `${medals[i] || `*${i + 1}.*`} @${num(j)} — Lv ${levelOf(xp)} · ${fmt(xp)} XP`).join('\n');
        await reply(sock, chatId, message, panel({ icon: '🏆', title: 'Group leaderboard', body }), all.map(([j]) => j));
        return true;
      }

      case 'daily': {
        const now = Date.now(), gap = now - me.lastDaily;
        if (gap < 86400000) {
          await reply(sock, chatId, message, card.problem(`Already claimed. Come back in *${dur(86400000 - gap)}*.`, 'Daily reward'));
          return true;
        }
        me.streak = gap < 172800000 ? Math.min(me.streak + 1, 30) : 1;
        const reward = 500 + (me.streak - 1) * 100;
        me.coins += reward; me.lastDaily = now; save();
        await reply(sock, chatId, message, panel({ icon: '🎁', title: 'Daily reward', rows: [['🪙', 'Reward', `+${fmt(reward)}`], ['🔥', 'Streak', `${me.streak} day(s)`], ['👛', 'Wallet', fmt(me.coins)]] }));
        return true;
      }

      case 'wallet':
      case 'balance': {
        const t = targetOf(message) || sender;
        const u = t === sender ? me : user(t);
        await reply(sock, chatId, message, panel({ icon: '👛', title: 'Wallet', rows: [['👤', 'User', `@${num(t)}`], ['🪙', 'Coins', fmt(u.coins)], ['🔥', 'Streak', `${u.streak} day(s)`]] }), [t]);
        return true;
      }

      case 'slots': {
        const bet = parseInt(arg, 10);
        if (!bet || bet < 10) { await reply(sock, chatId, message, card.problem('Usage: *.slots <bet>*  (minimum 10 coins)', 'Slots')); return true; }
        if (bet > 5000) { await reply(sock, chatId, message, card.problem('Maximum bet is 5,000 coins.', 'Slots')); return true; }
        if (bet > me.coins) { await reply(sock, chatId, message, card.problem(`Not enough coins. You have ${fmt(me.coins)} 🪙 — try *.daily*.`, 'Slots')); return true; }
        if (Date.now() - (slotCooldown.get(sender) || 0) < 4000) { await reply(sock, chatId, message, card.problem('Slow down — wait a few seconds.', 'Slots')); return true; }
        slotCooldown.set(sender, Date.now());
        const sym = ['🍒', '🍋', '🍇', '🔔', '💎', '7️⃣'];
        const r = [pick(sym), pick(sym), pick(sym)];
        let mult = 0, label = 'No luck';
        if (r[0] === r[1] && r[1] === r[2]) { mult = r[0] === '7️⃣' ? 10 : 5; label = r[0] === '7️⃣' ? 'JACKPOT' : 'Triple!'; }
        else if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) { mult = 1.5; label = 'Pair'; }
        const win = Math.floor(bet * mult) - bet;
        me.coins += win; save();
        await reply(sock, chatId, message, panel({ icon: '🎰', title: 'Slots', body: `┃ ${r.join(' │ ')} ┃\n\n*${label}* — ${win >= 0 ? `+${fmt(win)}` : fmt(win)} 🪙\n👛 Wallet: ${fmt(me.coins)}` }));
        return true;
      }

      case 'give': {
        const t = targetOf(message);
        const amt = parseInt(arg.split(/\s+/).pop(), 10);
        if (!t || !amt || amt < 1) { await reply(sock, chatId, message, card.problem('Usage: *.give @user <coins>* (or reply to them).', 'Give')); return true; }
        if (num(t) === num(sender)) { await reply(sock, chatId, message, card.problem('You cannot give coins to yourself.', 'Give')); return true; }
        if (amt > me.coins) { await reply(sock, chatId, message, card.problem(`You only have ${fmt(me.coins)} 🪙.`, 'Give')); return true; }
        me.coins -= amt; user(t).coins += amt; save();
        await reply(sock, chatId, message, panel({ icon: '💸', title: 'Transfer', body: `@${num(sender)} → @${num(t)}\n*${fmt(amt)}* 🪙` }), [sender, t]);
        return true;
      }

      case 'richlist': {
        const all = Object.entries(load().users).filter(([, u]) => u.coins > 0).sort((a, b) => b[1].coins - a[1].coins).slice(0, 10);
        if (!all.length) { await reply(sock, chatId, message, card.problem('Nobody has coins yet — try *.daily*.', 'Empty')); return true; }
        const medals = ['🥇', '🥈', '🥉'];
        await reply(sock, chatId, message, panel({ icon: '💰', title: 'Rich list', body: all.map(([j, u], i) => `${medals[i] || `*${i + 1}.*`} @${num(j)} — ${fmt(u.coins)} 🪙`).join('\n') }), all.map(([j]) => j));
        return true;
      }

      case 'mathquiz': {
        const old = quizzes.get(chatId);
        if (old && Date.now() < old.expires) { await reply(sock, chatId, message, card.problem(`A quiz is already running:\n*${old.question}*`, 'Math quiz')); return true; }
        const a = 5 + Math.floor(Math.random() * 45), b = 2 + Math.floor(Math.random() * 18);
        const op = pick(['+', '-', '×']);
        const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
        const question = `${a} ${op} ${b} = ?`;
        const reward = 100 + Math.floor(Math.random() * 101);
        const q = { answer, question, reward, expires: Date.now() + 30000 };
        q.timer = setTimeout(async () => {
          if (quizzes.get(chatId) === q) {
            quizzes.delete(chatId);
            try { await sock.sendMessage(chatId, { text: panel({ icon: '⌛', title: 'Time is up', body: `Nobody got it. Answer: *${answer}*` }) }); } catch (_) {}
          }
        }, 30000);
        if (q.timer.unref) q.timer.unref();
        quizzes.set(chatId, q);
        await reply(sock, chatId, message, panel({ icon: '🧮', title: 'Math quiz', body: `*${question}*\n\n⏱️ 30 seconds · 🪙 ${reward} coins\nSend only the number!` }));
        return true;
      }

      case 'afk': {
        me.afk = { reason: arg.slice(0, 100), since: Date.now() }; save();
        await reply(sock, chatId, message, panel({ icon: '💤', title: 'AFK on', body: `@${num(sender)} is now AFK${arg ? `: *${arg.slice(0, 100)}*` : ''}.\nI will tell people who tag you.` }), [sender]);
        return true;
      }

      case 'todo': {
        const [sub, ...restA] = arg.split(/\s+/); const rest = restA.join(' ').trim(); const s = (sub || '').toLowerCase();
        const list = () => me.todo.length ? me.todo.map((t, i) => `${t.done ? '✅' : '⬜'} *${i + 1}.* ${t.text}`).join('\n') : '_Your list is empty. Add: .todo add <text>_';
        if (s === 'add') {
          if (!rest) { await reply(sock, chatId, message, card.problem('Usage: *.todo add <text>*', 'To-do')); return true; }
          if (me.todo.length >= 30) { await reply(sock, chatId, message, card.problem('List is full (30 items). Use *.todo del <n>*.', 'To-do')); return true; }
          me.todo.push({ text: rest.slice(0, 120), done: false }); save();
        } else if (s === 'done' || s === 'del') {
          const i = parseInt(rest, 10) - 1;
          if (!me.todo[i]) { await reply(sock, chatId, message, card.problem(`Item number not found. Usage: *.todo ${s} <n>*`, 'To-do')); return true; }
          if (s === 'done') me.todo[i].done = !me.todo[i].done; else me.todo.splice(i, 1);
          save();
        } else if (s === 'clear') { me.todo = []; save(); }
        await reply(sock, chatId, message, panel({ icon: '📝', title: 'My to-do', body: list() }));
        return true;
      }

      case 'rate': {
        if (!arg) { await reply(sock, chatId, message, card.problem('Usage: *.rate <anything>*', 'Rate')); return true; }
        // same text always gives the same score (stable hash), so it feels "real"
        let h = 7; for (const c of arg.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) % 101;
        await reply(sock, chatId, message, panel({ icon: '⭐', title: 'Rating', body: `*${arg.slice(0, 60)}*\n${bar(h / 100)} *${h}%*` }));
        return true;
      }

      case 'vibe': {
        const t = targetOf(message) || sender;
        const vibes = ['Chill 😎', 'Savage 🔥', 'Royal 👑', 'Mysterious 🌙', 'Lucifer mode 😈', 'Legend ⚡', 'Calm 🌊', 'Dangerous 🗡️', 'Pure gold ✨'];
        let h = 0; const key = num(t) + new Date().toDateString(); for (const c of key) h = (h * 33 + c.charCodeAt(0)) >>> 0;
        await reply(sock, chatId, message, panel({ icon: '🔮', title: 'Vibe check', body: `@${num(t)} today's vibe:\n*${vibes[h % vibes.length]}*\n⚡ Energy: ${50 + (h % 51)}%` }), [t]);
        return true;
      }
    }
  } catch (e) {
    console.error('[LuciferX]', cmd, e);
    try { await reply(sock, chatId, message, card.problem('Something went wrong. Please try again.')); } catch (_) {}
    return true;
  }
  return false;
}

module.exports = { COMMANDS, handleLuciferX, trackIncoming };
