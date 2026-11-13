'use strict';
// Command prefix (default "."). Owners change it with  .setprefix <symbol>  — one symbol (up to 3 characters).
// Everything inside the bot is written with "." so incoming text is normalised here: "!menu" -> ".menu".
const get = () => { try { const p = String(require('../settings').prefix || '.'); return p || '.'; } catch (_) { return '.'; } };
const valid = (p) => /^[^\sA-Za-z0-9\u0900-\u097F"'`\\]{1,3}$/u.test(String(p || ''));
function normalize(text) {
  const p = get(); const t = String(text || '');
  if (p === '.' || !t) return t;
  if (t.startsWith(p) && t.length > p.length && !/^\s/.test(t.slice(p.length))) return '.' + t.slice(p.length);
  if (t.startsWith('.') && !/^\.(setprefix|prefix)(\s|$)/i.test(t)) return '\u200b' + t;   // the old "." stops working (except to fix the prefix)
  return t;
}
/** Show the current prefix inside the menu text (".menu" -> "!menu"). */
function menu(text) {
  const p = get(); if (p === '.') return text;
  return String(text).replace(/(^|[\s*_(➤•`])\.([a-z][a-z0-9_-]{1,24})(?=[\s*_)`,.:]|$)/gim, (m, a, c) => a + p + c);
}
module.exports = { get, valid, normalize, menu };
