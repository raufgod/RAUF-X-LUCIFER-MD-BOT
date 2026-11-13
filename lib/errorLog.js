'use strict';
// RAUF × LUCIFER MD BOT 💫 — remembers the last errors so the owner can read the REAL cause from WhatsApp.
//   .errors          show the last 10 errors of this bot
//   .errors clear    forget them
const MAX = 60;
const entries = [];
let installed = false;

function text(x) {
  if (x instanceof Error) return x.stack?.split('\n').slice(0, 3).join(' | ') || x.message;
  if (typeof x === 'string') return x;
  try { return JSON.stringify(x); } catch { return String(x); }
}

function install() {
  if (installed) return;
  installed = true;
  const orig = console.error.bind(console);
  console.error = (...args) => {
    try {
      let key = 'main';
      try { key = require('./sessionContext').key(); } catch (_) {}
      entries.push({ t: Date.now(), key, msg: args.map(text).join(' ').replace(/\s+/g, ' ').slice(0, 300) });
      if (entries.length > MAX) entries.shift();
    } catch (_) {}
    orig(...args);
  };
}

function parseCommand(t) {
  const m = String(t || '').trim().toLowerCase().replace(/\s+/g, ' ').match(/^\.errors?(?: (clear))?$/);
  return m ? { clear: !!m[1] } : null;
}

function runCommand({ clear }) {
  let key = 'main';
  try { key = require('./sessionContext').key(); } catch (_) {}
  if (clear) {
    for (let i = entries.length - 1; i >= 0; i--) if (entries[i].key === key) entries.splice(i, 1);
    return '🧹 Error log cleared.';
  }
  const mine = entries.filter(e => e.key === key).slice(-10);
  if (!mine.length) return '✅ No errors recorded since the bot started.';
  const fmt = e => `• ${new Date(e.t).toLocaleTimeString()} — ${e.msg.slice(0, 220)}`;
  return `🛠️ *Last ${mine.length} error(s)*\n\n${mine.map(fmt).join('\n\n')}\n\n_Send this to the developer. Clear: .errors clear_`;
}

module.exports = { install, parseCommand, runCommand };
