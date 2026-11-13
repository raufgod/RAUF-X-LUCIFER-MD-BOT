'use strict';
// Your own domain for the website / admin link.
// Set  SITE_DOMAIN=yourdomain.com  in .env (or the panel variables). https:// is added automatically.
// Older names still work: PAIR_WEBSITE_URL, settings.js websiteLink.
function base() {
  let u = String(process.env.SITE_DOMAIN || process.env.PAIR_WEBSITE_URL || '').trim();
  if (!u) { try { u = String(require('../settings').websiteLink || '').trim(); } catch (_) {} }
  if (!u) {                                             // no own domain yet -> the ngrok address (ngrok.txt / NGROK_DOMAIN)
    try {
      const l = require('fs').readFileSync(require('path').join(__dirname, '..', 'ngrok.txt'), 'utf8').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
      const kv = (k) => { const m = l.find((x) => new RegExp('^' + k + '\\s*=', 'i').test(x)); return m ? m.replace(/^[^=]*=/, '').trim() : null; };
      u = process.env.NGROK_DOMAIN || kv('NGROK_DOMAIN') || (l[1] && !l[1].includes('=') ? l[1] : '') || '';
    } catch (_) { u = process.env.NGROK_DOMAIN || ''; }
  }
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { const x = new URL(u); return x.origin + x.pathname.replace(/\/+$/, ''); } catch (_) { return ''; }
}
module.exports = { base };
