// Optional free public HTTPS address for the pairing API (so a website made in Google AI Studio can reach the bot).
// Panel variables:  NGROK_AUTHTOKEN=<token from dashboard.ngrok.com>   NGROK_DOMAIN=<your free static domain, e.g. xyz.ngrok-free.app>
// Without NGROK_AUTHTOKEN nothing happens.
const fs = require('fs'), path = require('path');
// The panel has no place for custom variables, so the token can also live in a file next to package.json:
//   ngrok.txt  →  line 1: your ngrok authtoken   (line 2, optional: your free ngrok domain)
function fileCfg() {
  try { const l = fs.readFileSync(path.join(__dirname, '..', 'ngrok.txt'), 'utf8').split(/\r?\n/).map(x => x.trim()).filter(Boolean); const kv = (k) => { const m = l.find(x => new RegExp('^' + k + '\\s*=', 'i').test(x)); return m ? m.replace(/^[^=]*=/, '').trim() : null; };
    return { token: kv('NGROK_AUTHTOKEN') || (l[0] && !l[0].includes('=') ? l[0] : null), domain: kv('NGROK_DOMAIN') || (l[1] && !l[1].includes('=') ? l[1] : null) }; }
  catch (_) { return {}; }
}
async function start(port) {
  const cfg = fileCfg();
  const token = process.env.NGROK_AUTHTOKEN || cfg.token;
  if (!token || !port) return null;
  try {
    const ngrok = require('@ngrok/ngrok');
    const opts = { addr: port, authtoken: token };
    const dom = process.env.NGROK_DOMAIN || cfg.domain || 'tanning-mankind-trapdoor.ngrok-free.dev';
    if (dom) opts.domain = String(dom).replace(/^https?:\/\//, '').replace(/\/$/, '');
    const listener = await ngrok.forward(opts);
    console.log(`🔒 Public HTTPS pairing API: ${listener.url()}   (use this as API_BASE in your website)`);
    return listener;
  } catch (e) {
    console.error('[tunnel] could not start ngrok:', e?.message || e);
    return null;
  }
}
module.exports = { start };
