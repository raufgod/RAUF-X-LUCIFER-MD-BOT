'use strict';
// RAUF × LUCIFER MD BOT — one shared "card" look for the small replies (ping, alive, joke, fact, weather ...).
// Same style as the .pair card:
//
//   ┏━━━━━━━━━━━━━━━━━━━━
//   ┃ 🏓 *PING*
//   ┃ _RAUF × LUCIFER MD BOT_
//   ┣━━━━━━━━━━━━━━━━━━━━
//   ┃ ⚡ *Speed* » 148 ms
//   ┗━━━━━━━━━━━━━━━━━━━━
//   _👑 RAUF × LUCIFER MD BOT · by RAUF_
//
// panel({ icon, title, rows: [[icon,label,value],...], body, note })
//   rows  -> neat label » value lines inside the box
//   body  -> free text (a joke, a quote ...) shown under the box
//   note  -> optional small italic line under everything
const LINE = '━━━━━━━━━━━━━━━━━━━━';

function brand() { try { return require('../settings').botName || 'RAUF × LUCIFER MD BOT'; } catch (_) { return 'RAUF × LUCIFER MD BOT'; } }
function author() { try { return require('../settings').author || 'RAUF × LUCIFER'; } catch (_) { return 'RAUF × LUCIFER'; } }

function panel({ icon = '✨', title = '', rows = [], body = '', note = '' } = {}) {
  const out = [`┏${LINE}`, `┃ ${icon} *${String(title).toUpperCase()}*`, `┃ _${brand()}_`];
  if (rows.length) {
    out.push(`┣${LINE}`);
    for (const r of rows) out.push(r.length === 1 ? `┃ ${r[0]}` : `┃ ${r[0]} *${r[1]}* » ${r[2]}`);
  }
  out.push(`┗${LINE}`);
  let text = out.join('\n');
  if (body) text += `\n\n${String(body).trim()}`;
  if (note) text += `\n\n_${note}_`;
  text += `\n\n_👑 ${brand()} · by ${author()}_`;
  return text;
}

/** A failed / usage message in the same look. */
function problem(message, title = 'Oops') {
  return panel({ icon: '⚠️', title, body: message });
}

/** Seconds -> "1d 2h 3m 4s". */
function dur(sec) {
  sec = Math.max(0, Math.floor(sec));
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return [d && d + 'd', (d || h) && h + 'h', (d || h || m) && m + 'm', s + 's'].filter(Boolean).join(' ');
}

module.exports = { panel, problem, dur, brand };
