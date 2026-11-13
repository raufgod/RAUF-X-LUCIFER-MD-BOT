'use strict';
// RAUF × LUCIFER MD BOT — pairing "card" used by the WhatsApp `.pair` command and the Telegram `/pair` command.
// The original pairing message is kept word-for-word; this only puts a header on top and a
// "pair from our website" footer (with the website link) underneath.
//
// Website link, first one found wins:
//   1. env  PAIR_WEBSITE_URL=https://your-site.example         (add it in the panel variables / .env)
//   2. settings.js  websiteLink
//   3. your ngrok domain (NGROK_DOMAIN / ngrok.txt) when the ngrok tunnel is configured
// If none is set the footer is simply left out, so nothing breaks.
const fs = require('fs');
const path = require('path');

function ngrokCfg() {
  try {
    const l = fs.readFileSync(path.join(__dirname, '..', 'ngrok.txt'), 'utf8').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const kv = (k) => { const m = l.find(x => new RegExp('^' + k + '\\s*=', 'i').test(x)); return m ? m.replace(/^[^=]*=/, '').trim() : null; };
    return { token: kv('NGROK_AUTHTOKEN') || (l[0] && !l[0].includes('=') ? l[0] : null), domain: kv('NGROK_DOMAIN') || (l[1] && !l[1].includes('=') ? l[1] : null) };
  } catch (_) { return {}; }
}

function websiteUrl() {
  let u = String(process.env.SITE_DOMAIN || process.env.PAIR_WEBSITE_URL || '').trim();
  if (!u) { try { u = String(require('../settings').websiteLink || '').trim(); } catch (_) {} }
  if (!u) {
    const cfg = ngrokCfg();
    if (process.env.NGROK_AUTHTOKEN || cfg.token) u = String(process.env.NGROK_DOMAIN || cfg.domain || 'tanning-mankind-trapdoor.ngrok-free.dev').trim();
  }
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try {
    const x = new URL(u);
    if (x.pathname === '/' && !x.search && !x.hash) x.pathname = '/pair';    // plain domain -> the pairing page
    return x.toString();
  } catch (_) { return ''; }
}

function brand() { try { return require('../settings').botName || 'RAUF × LUCIFER MD BOT'; } catch (_) { return 'RAUF × LUCIFER MD BOT'; } }

/** WhatsApp (supports *bold*). `body` is the original message text. */
function wa(body, title = 'Pairing Code') {
  const url = websiteUrl();
  let out = `┏━━━━━━━━━━━━━━━━━━━━\n┃ 👑 *${brand()}*\n┃ 🔐 *${title}*\n┗━━━━━━━━━━━━━━━━━━━━\n\n${body}`;
  if (url) out += `\n\n┏━━━━━━━━━━━━━━━━━━━━\n┃ 🌐 *Pair from our website*\n┃ Open the link, enter your number\n┃ and get your code instantly.\n┃ 👉 ${url}\n┗━━━━━━━━━━━━━━━━━━━━`;
  return out;
}

/** Telegram (plain text, the bot sends without parse_mode). */
function tg(body, title = 'Pairing Code') {
  const url = websiteUrl();
  let out = `┏━━━━━━━━━━━━━━━━━━━━\n┃ 👑 ${brand()}\n┃ 🔐 ${title}\n┗━━━━━━━━━━━━━━━━━━━━\n\n${body}`;
  if (url) out += `\n\n┏━━━━━━━━━━━━━━━━━━━━\n┃ 🌐 Pair from our website\n┃ Open the link, enter your number\n┃ and get your code instantly.\n┃ 👉 ${url}\n┗━━━━━━━━━━━━━━━━━━━━`;
  return out;
}

/** Telegram inline button under the message (undefined when no website is configured). */
function tgButtons() {
  const url = websiteUrl();
  return url ? { reply_markup: { inline_keyboard: [[{ text: '🌐 Open Pairing Website', url }]] } } : {};
}

/** Small tappable link card for the top of a WhatsApp message: tap it = the pairing website opens.
 *  Use as  sock.sendMessage(jid, { text, ...webCard() })  (merge into contextInfo yourself if you already have one). */
let _thumb;
function webCard() {
  const url = websiteUrl(); if (!url) return {};
  if (_thumb === undefined) { try { _thumb = require('fs').readFileSync(require('path').join(__dirname, '..', 'assets', 'web-card.jpg')); } catch (_) { _thumb = null; } }
  return { contextInfo: { externalAdReply: {
    title: `${brand()} · Link your number`, body: 'Tap to open the pairing website', sourceUrl: url, mediaType: 1,
    renderLargerThumbnail: false, showAdAttribution: false, ...(_thumb ? { thumbnail: _thumb } : {})
  } } };
}

module.exports = { wa, tg, tgButtons, websiteUrl, webCard };
