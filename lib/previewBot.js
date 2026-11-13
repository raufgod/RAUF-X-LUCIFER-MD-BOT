'use strict';
// RAUF × LUCIFER MD BOT — website live preview ("RAUF × LUCIFER MD BOT OS" virtual phone).
// Runs ONLY text-safe commands for visitors (no WhatsApp socket is touched, nothing is sent to any number).
// .menu / .help use the real command registry, .gpt/.ai use the same AI chain as the support chat.
const registry = require('./commandRegistry');
const card = require('./cardStyle');
const AI = require('./aiChat');
const started = Date.now();
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const bot = () => String(global.botName || 'RAUF × LUCIFER MD BOT');
const dev = 'RAUF × LUCIFER';

const TRUTH = ['What is the last lie you told?', 'Who was your first crush?', 'What is your most embarrassing moment?', 'What is one habit you want to quit?', 'What is a secret talent you have?', 'What was the last thing you searched on your phone?'];
const DARE = ['Send a voice note singing the first song that comes to mind.', 'Change your WhatsApp status to "I love RAUF × LUCIFER MD BOT" for one hour.', 'Text the last person you chatted with a random emoji story.', 'Do 15 push-ups and send proof.', 'Talk in rhymes for the next 5 messages.'];
const ROAST = ['You are the reason the "mute" button exists.', 'Your WiFi password is probably "password123", and even that is too smart for you.', 'You type "brb" and come back next week.', 'You have the confidence of a man who reads "terms and conditions".'];
const COMPLIMENT = ['You light up every group chat you join.', 'Your replies are always worth the wait.', 'You have great taste — you chose RAUF × LUCIFER MD BOT.', 'Your energy is contagious, in the best way.'];
const BALL = ['Yes, definitely.', 'It is certain.', 'Without a doubt.', 'Ask again later.', 'Cannot predict now.', 'Don\'t count on it.', 'My sources say no.', 'Very doubtful.', 'Most likely.', 'Signs point to yes.'];
const FANCY = {
  bold: (s) => [...s].map((c) => { const k = c.codePointAt(0); return k >= 65 && k <= 90 ? String.fromCodePoint(0x1D5D4 + k - 65) : k >= 97 && k <= 122 ? String.fromCodePoint(0x1D5EE + k - 97) : c; }).join(''),
  mono: (s) => [...s].map((c) => { const k = c.codePointAt(0); return k >= 65 && k <= 90 ? String.fromCodePoint(0x1D670 + k - 65) : k >= 97 && k <= 122 ? String.fromCodePoint(0x1D68A + k - 97) : k >= 48 && k <= 57 ? String.fromCodePoint(0x1D7F6 + k - 48) : c; }).join(''),
  bubble: (s) => [...s].map((c) => { const k = c.codePointAt(0); return k >= 65 && k <= 90 ? String.fromCodePoint(0x24B6 + k - 65) : k >= 97 && k <= 122 ? String.fromCodePoint(0x24D0 + k - 97) : c; }).join('')
};

function calc(expr) {
  const e = String(expr || '').replace(/\s+/g, '').replace(/x/gi, '*').replace(/\^/g, '**');
  if (!e || e.length > 60 || !/^[0-9+\-*/().%*]+$/.test(e)) return null;
  try { const v = Function('"use strict";return (' + e + ')')(); return typeof v === 'number' && isFinite(v) ? String(+v.toFixed(8)) : null; } catch { return null; }
}
const upt = () => { let s = Math.floor((Date.now() - started) / 1000); const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; return `${d}d ${h}h ${Math.floor(s / 60)}m ${s % 60}s`; };

let menuCache = null;
async function menu(px) {
  if (!menuCache || Date.now() - menuCache.t > 600000) { try { menuCache = { t: Date.now(), m: await registry.buildMenu([]) }; } catch { menuCache = { t: Date.now(), m: { total: 0, groups: [] } }; } }
  const { total, groups } = menuCache.m;
  const L = [`➤ *${bot().toUpperCase()}* 👑`, `👑 Owner: ${dev}`, `📦 Prefix: ${px}`, `🧮 Commands: ${total}`, '🟢 Mode: PUBLIC', ''];
  for (const g of groups) L.push(`▰▰▰❰ ${g.icon} ${g.category} ❱▰▰▰`, ...g.items.slice(0, 5).map((i) => `➤ ── ${px}${i.name}`), g.items.length > 5 ? `   …+${g.items.length - 5} more` : '', '');
  L.push(`Try the commands marked as preview-ready: ${px}ping ${px}gpt ${px}8ball ${px}fancy ${px}calc ${px}truth`);
  return L.filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n');
}

const PREVIEW_READY = 'menu help ping alive runtime owner info time date flip dice 8ball choose ship lovetest truth dare roast compliment fancy reverse count upper lower calc gpt ai ask deepseek gemini';

async function run(text, sid, px = '.') {
  px = px && px.length <= 3 ? px : '.';
  const t = String(text || '').trim().slice(0, 400);
  if (!t) return null;
  if (!t.startsWith(px)) return `(no reply: commands start with ${px} — try ${px}menu)`;
  const m = t.slice(px.length).match(/^(\S+)\s*([\s\S]*)$/);
  if (!m) return null;
  const cmd = m[1].toLowerCase(), arg = m[2].trim();
  switch (cmd) {
    case 'menu': case 'help': case 'list': return menu(px);
    case 'ping': { const ms = 8 + Math.floor(Math.random() * 20); return card.panel({ icon: '🏓', title: 'Pong!', rows: [['⚡', 'Speed', `${ms} ms`], ['📶', 'Status', 'Online · 🟢 Excellent'], ['⏱️', 'Uptime', upt()]] }); }
    case 'alive': return card.panel({ icon: '🤖', title: 'I am alive!', rows: [['🟢', 'Status', 'Online'], ['👑', 'Owner', dev], ['⏱️', 'Uptime', upt()]], note: `Type ${px}menu for the full command list` });
    case 'runtime': case 'uptime': return card.panel({ icon: '⏱️', title: 'Uptime', rows: [['🕐', 'Running for', upt()]] });
    case 'owner': case 'developer': return `👑 Owner: ${dev}\n🛠️ Developer: ${dev} (Team RAUF × LUCIFER)`;
    case 'info': case 'botinfo': return `🤖 *${bot()}*\n🛠️ Developer: ${dev}\n📦 Prefix: ${px}\n🌐 Platform: WhatsApp multi-device`;
    case 'time': case 'date': return `🕒 ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'medium' })} (IST)`;
    case 'flip': return `🪙 ${pick(['Heads', 'Tails'])}`;
    case 'dice': case 'roll': return `🎲 You rolled a ${1 + Math.floor(Math.random() * 6)}`;
    case '8ball': return arg ? `🎱 ${pick(BALL)}` : `⚠️ Use: ${px}8ball <question>`;
    case 'choose': { const o = arg.split(/[|,]/).map((s) => s.trim()).filter(Boolean); return o.length > 1 ? `🤔 I choose: *${pick(o)}*` : `⚠️ Use: ${px}choose pizza | burger`; }
    case 'ship': case 'lovetest': { if (!arg) return `⚠️ Use: ${px}${cmd} name1 & name2`; let h = 0; for (const c of arg.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) % 71; return `💞 *${arg}*\nMatch: *${30 + h}%*`; }
    case 'truth': return `🧠 Truth: ${pick(TRUTH)}`;
    case 'dare': return `🔥 Dare: ${pick(DARE)}`;
    case 'roast': return `🔥 ${pick(ROAST)}`;
    case 'compliment': return `💖 ${pick(COMPLIMENT)}`;
    case 'fancy': return arg ? `${FANCY.bold(arg)}\n${FANCY.mono(arg)}\n${FANCY.bubble(arg)}` : `⚠️ Use: ${px}fancy <text>`;
    case 'reverse': return arg ? [...arg].reverse().join('') : `⚠️ Use: ${px}reverse <text>`;
    case 'count': return arg ? `🔢 ${arg.length} characters, ${arg.split(/\s+/).filter(Boolean).length} words` : `⚠️ Use: ${px}count <text>`;
    case 'upper': return arg ? arg.toUpperCase() : `⚠️ Use: ${px}upper <text>`;
    case 'lower': return arg ? arg.toLowerCase() : `⚠️ Use: ${px}lower <text>`;
    case 'calc': case 'math': { const v = calc(arg); return v === null ? `⚠️ Use: ${px}calc 12*(3+4)` : `🧮 ${arg} = *${v}*`; }
    case 'gpt': case 'ai': case 'ask': case 'chatgpt': case 'deepseek': case 'gemini': {
      if (!arg) return `⚠️ Use: ${px}${cmd} <your question>`;
      try { return String(await AI.askChain(`pv:${sid}`, arg, 'You are the AI of the RAUF × LUCIFER MD BOT WhatsApp bot. Answer in the same language as the user, in under 80 words, plain text, no markdown headings.')).slice(0, 900); }
      catch { return '⚠️ The AI is busy right now, please try again in a moment.'; }
    }
    default: {
      let known = false; try { known = registry.isNative(cmd) || (global.__kobFlashCommandRegistry && global.__kobFlashCommandRegistry.has(cmd)); } catch {}
      return known
        ? `🔒 *${px}${cmd}* is a real command of the bot, but it needs a linked WhatsApp (media, groups or your account), so it is not available in this preview.\n\nLink your number on the *Link WhatsApp* page to use it. Preview-ready: ${PREVIEW_READY.split(' ').slice(0, 14).map((c) => px + c).join(' ')}`
        : `❓ Unknown command *${px}${cmd}*. Send ${px}menu to see everything.`;
    }
  }
}
module.exports = { run, PREVIEW_READY };
