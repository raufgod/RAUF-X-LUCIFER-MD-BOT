'use strict';
// Profile of a website-created bot ("Create your own bot"): name, owner, links, prefix, logo.
// Stored in the same per-session override file the owner commands use (data/sessions/<number>/botConfig.json),
// so the running bot, the menu and the .set* commands all see one source of truth.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), dns = require('dns').promises, net = require('net');
const sessionContext = require('./sessionContext');
const prefix = require('./prefix');
const dir = (n) => sessionContext.sessionDir(String(n));
const FILE = (n) => path.join(dir(n), 'botConfig.json');
const EDIT = (n) => path.join(dir(n), 'edit.json');
const KEYS = ['botName', 'botOwner', 'prefix', 'channelLink', 'telegramLink', 'websiteLink', 'logoUrl'];
const txt = (v, max, label) => { const s = String(v ?? '').replace(/[\r\n\t;\u200b]+/g, ' ').replace(/\s+/g, ' ').trim(); if (s.length > max) throw new Error(`${label} is too long (max ${max} characters).`); return s; };
const url = (v, label, re) => { const s = String(v ?? '').trim(); if (!s) return ''; if (s.length > 200 || !/^https:\/\/[^\s"'<>]+$/i.test(s)) throw new Error(`${label} must be a link starting with https://`); if (re && !re.test(s)) throw new Error(`${label} is not valid.`); return s; };
/** Validate a profile coming from the website / commands. Returns only the allowed keys. */
function clean(p = {}) {
  const o = {};
  if ('botName' in p) { o.botName = txt(p.botName, 30, 'Bot name'); if (!o.botName) throw new Error('Bot name cannot be empty.'); }
  if ('botOwner' in p) { o.botOwner = txt(p.botOwner, 30, 'Owner name'); if (!o.botOwner) throw new Error('Owner name cannot be empty.'); }
  if ('prefix' in p) { const x = String(p.prefix || '.').trim() || '.'; if (!prefix.valid(x)) throw new Error('Prefix must be 1 to 3 symbols, for example  .  !  #  /'); o.prefix = x; }
  if ('channelLink' in p) o.channelLink = url(p.channelLink, 'Channel link', /^https:\/\/whatsapp\.com\/channel\/[A-Za-z0-9_-]{10,}$/);
  if ('telegramLink' in p) o.telegramLink = url(p.telegramLink, 'Telegram link', /^https:\/\/(t\.me|telegram\.me)\/[A-Za-z0-9_+\/.-]+$/i);
  if ('websiteLink' in p) o.websiteLink = url(p.websiteLink, 'Website link');
  if ('logoUrl' in p) o.logoUrl = url(p.logoUrl, 'Logo link');
  return o;
}
const read = (n) => { try { return JSON.parse(fs.readFileSync(FILE(n), 'utf8')) || {}; } catch (_) { return {}; } };
// ---- logo: fetched once on the server, checked, and saved as the bot's menu image
// Blocked address ranges (loopback, private, link-local / cloud metadata, CGNAT, multicast, reserved, NAT64, 6to4, ULA ...).
// net.BlockList also matches IPv4-mapped IPv6 addresses (::ffff:127.0.0.1 and ::ffff:7f00:1) against the IPv4 ranges.
const BLOCK = new net.BlockList();
for (const [a, n] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]]) BLOCK.addSubnet(a, n, 'ipv4');
for (const [a, n] of [['::', 128], ['::1', 128], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64], ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8]]) BLOCK.addSubnet(a, n, 'ipv6');
const privateIp = (ip) => { const t = net.isIP(String(ip)); return !t || BLOCK.check(String(ip), t === 6 ? 'ipv6' : 'ipv4'); };   // anything that is not a valid IP is refused too
async function fetchLogo(u) {
  const axios = require('axios'); let cur = u;
  for (let hop = 0; hop < 3; hop++) {
    const h = new URL(cur); if (h.protocol !== 'https:') throw new Error('Logo link must be https.'); if (h.port && h.port !== '443') throw new Error('This logo link is not allowed.'); if (h.username || h.password) throw new Error('This logo link is not allowed.');
    const ips = await dns.lookup(h.hostname.replace(/^\[|\]$/g, ''), { all: true }); if (!ips.length || ips.some((x) => privateIp(x.address))) throw new Error('This logo link is not allowed.');
    const pinned = new (require('https').Agent)({ lookup: (host, opts, cb) => require('dns').lookup(host, opts, (err, addr, fam) => { if (err) return cb(err); const l = Array.isArray(addr) ? addr : [{ address: addr, family: fam }]; if (!l.length || l.some((x) => privateIp(x.address))) return cb(new Error('This logo link is not allowed.')); cb(null, addr, fam); }) });   // re-checked at connect time: stops DNS-rebinding
    const r = await axios.get(cur, { responseType: 'arraybuffer', timeout: 12000, maxRedirects: 0, maxContentLength: 4e6, httpsAgent: pinned, validateStatus: (s) => s < 400 });
    if (r.status >= 300) { cur = new URL(r.headers.location, cur).href; continue; }
    const b = Buffer.from(r.data);
    if (!(b[0] === 0xff && b[1] === 0xd8) && !(b[0] === 0x89 && b[1] === 0x50) && !(b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP')) throw new Error('The logo link is not a JPG, PNG or WEBP image.');
    return b;
  }
  throw new Error('Too many redirects on the logo link.');
}
async function applyLogo(n, logoUrl) {
  const { fitJpeg } = require('./imageTools'); const b = await fetchLogo(logoUrl);
  const a = path.join(dir(n), 'assets'); fs.mkdirSync(a, { recursive: true });
  fs.writeFileSync(path.join(a, 'rauf-header.jpg'), await fitJpeg(b, 1280)); fs.writeFileSync(path.join(a, 'rauf-header-mini.jpg'), await fitJpeg(b, 720));
}
/** Save (merge) a profile for a number; updates the running bot too. Returns the merged profile. */
async function save(number, profile, { liveSession } = {}) {
  const n = String(number).replace(/\D/g, ''); const c = clean(profile); const old = read(n);
  const cfg = { ...old, ...c }; fs.mkdirSync(dir(n), { recursive: true }); fs.writeFileSync(FILE(n), JSON.stringify(cfg, null, 2));
  const ov = liveSession?.sock?.__sessionCtx?.overrides; if (ov) Object.assign(ov, c);          // the running bot changes immediately
  let logo = 'unchanged';
  if (c.logoUrl && c.logoUrl !== old.logoUrl) { try { await applyLogo(n, c.logoUrl); logo = 'updated'; } catch (e) { logo = 'failed: ' + e.message; cfg.logoUrl = old.logoUrl || ''; fs.writeFileSync(FILE(n), JSON.stringify(cfg, null, 2)); } }
  return { profile: cfg, logo };
}
// ---- edit key (shown once to the creator; needed to edit the bot later from the website)
function newKey(n) {
  const k = crypto.randomBytes(9).toString('base64').replace(/[^A-Za-z0-9]/g, 'k').slice(0, 12), salt = crypto.randomBytes(16);
  fs.mkdirSync(dir(n), { recursive: true }); fs.writeFileSync(EDIT(n), JSON.stringify({ salt: salt.toString('hex'), hash: crypto.scryptSync(k, salt, 32).toString('hex') }), { mode: 0o600 }); try { fs.chmodSync(EDIT(n), 0o600); } catch (_) {} return k;
}
function checkKey(n, k) {
  try { const j = JSON.parse(fs.readFileSync(EDIT(n), 'utf8')); const h = crypto.scryptSync(String(k || ''), Buffer.from(j.salt, 'hex'), 32); return crypto.timingSafeEqual(h, Buffer.from(j.hash, 'hex')); } catch (_) { return false; }
}
const hasKey = (n) => { try { return fs.existsSync(EDIT(n)); } catch (_) { return false; } };
/** a number "has an owner" once it has an edit key or any saved bot settings: nobody else may overwrite those from the website */
const hasOwner = (n) => hasKey(n) || Object.keys(read(n)).length > 0;
/** undo a profile + key created in a request that then failed (the creator never received the key) */
function discard(n) { for (const f of [EDIT(n), FILE(n)]) { try { fs.unlinkSync(f); } catch (_) {} } }
module.exports = { clean, read, save, newKey, checkKey, hasKey, hasOwner, discard, KEYS };
