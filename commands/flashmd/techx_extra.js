// TechX API commands: anime, AI, Cloudflare AI, currency / crypto, APK, downloader and small tools.
// All 43 unique endpoints of https://techxkamran.onrender.com are reachable through 30 commands (groups use sub-commands).
// Plain Node `fetch` is used (no extra package). Your text / link is sent to that service, see the Privacy Policy.
const BASE = process.env.TECHX_API_BASE || 'https://techxkamran.onrender.com'
const TIMEOUT = 40000, COOLDOWN = 4000, MAXTXT = 3500
let http = (url, opt) => fetch(url, opt)          // replaceable in tests
export const __setHttp = (f) => { http = f }
const last = new Map()

const Q = ['q', 'query', 'search', 'keyword', 'text', 'prompt', 'message', 'title']      // the API takes one of these names for a text input
const U = ['url', 'link', 'q']
const publicHttps = (u) => { try { const x = new URL(u); return x.protocol === 'https:' && !/^(localhost|.*\.(local|internal|localdomain))$/i.test(x.hostname) && !/^[\d.:[\]]+$/.test(x.hostname) && !x.username } catch { return false } }
const clip = (s, n = MAXTXT) => { s = String(s ?? '').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s }

async function call(path, params = {}, names) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) { if (v === undefined || v === '') continue; for (const n of (names && names[k]) || [k]) qs.set(n, String(v)) }
  const url = BASE + path + (qs.size ? '?' + qs : '')
  const o = { headers: { Accept: 'application/json, */*', 'User-Agent': 'RAUF-LUCIFER-MD-BOT/1.0' }, signal: AbortSignal.timeout(TIMEOUT) }
  let r = await http(url, o)
  if (r.status === 404 || r.status === 405) {            // some endpoints only accept POST
    r = await http(BASE + path, { ...o, method: 'POST', headers: { ...o.headers, 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(Object.entries(params).flatMap(([k, v]) => ((names && names[k]) || [k]).map((n) => [n, v])))), signal: AbortSignal.timeout(TIMEOUT) })
  }
  if (!r.ok) throw new Error('HTTP ' + r.status)
  const ct = String(r.headers.get('content-type') || '')
  if (/^(image|audio|video)\//i.test(ct)) { const b = Buffer.from(await r.arrayBuffer()); if (b.length > 40e6) throw new Error('File too large'); return { bin: b, ct } }
  const t = await r.text()
  try { return { json: JSON.parse(t) } } catch { return { text: t } }
}

// ---- turn any answer into WhatsApp text (+ optional media link)
const TITLE = ['title', 'name', 'judul', 'anime', 'text', 'episode', 'ep', 'label', 'code', 'symbol', 'domain', 'subdomain']
const LINK = ['url', 'link', 'href', 'download', 'downloadUrl', 'download_url', 'detail']
const TEXTK = ['answer', 'response', 'result', 'text', 'message', 'output', 'content', 'translatedText', 'translated_text', 'translation', 'reply', 'data']
const scalar = (v) => (v === null || ['string', 'number', 'boolean'].includes(typeof v))
function line(o, i) {
  if (scalar(o)) return `${i + 1}. ${clip(o, 200)}`
  const t = TITLE.map((k) => o[k]).find((v) => scalar(v) && v !== ''), l = LINK.map((k) => o[k]).find((v) => typeof v === 'string' && /^https?:/i.test(v))
  const extra = Object.entries(o).filter(([k, v]) => scalar(v) && v !== '' && !TITLE.includes(k) && !LINK.includes(k) && !/image|thumb|poster|cover|img/i.test(k)).slice(0, 3).map(([k, v]) => `${k}: ${clip(v, 60)}`).join(' | ')
  return `${i + 1}. ${clip(t ?? JSON.stringify(o), 120)}${extra ? '\n   ' + extra : ''}${l ? '\n   ' + l : ''}`
}
function pretty(d, depth = 0) {
  if (d === null || d === undefined) return ''
  if (scalar(d)) return String(d)
  if (Array.isArray(d)) return d.slice(0, 10).map(line).join('\n') + (d.length > 10 ? `\n… +${d.length - 10} more` : '')
  for (const k of TEXTK) { const v = d[k]; if (v !== undefined && v !== null && v !== '' && !(v && typeof v === 'object' && !Array.isArray(v) && depth > 2)) { const x = pretty(v, depth + 1); if (x) return x } }
  return Object.entries(d).filter(([k, v]) => v !== null && v !== '' && !/^(status|success|ok|creator|author|developer|code)$/i.test(k)).slice(0, 14)
    .map(([k, v]) => `*${k}:* ${scalar(v) ? clip(v, 300) : Array.isArray(v) ? `\n${pretty(v.slice(0, 5), depth + 1)}` : clip(JSON.stringify(v), 300)}`).join('\n')
}
function findMedia(d, kinds) {          // first https link in the answer that looks like the wanted media
  const re = { image: /\.(png|jpe?g|webp|gif)(\?|$)/i, video: /\.(mp4|mkv|webm|mov)(\?|$)/i, audio: /\.(mp3|m4a|ogg|wav)(\?|$)/i }
  let found = null
  const walk = (v, key = '') => { if (found || v == null) return; if (typeof v === 'string') { if (publicHttps(v) && kinds.some((k) => re[k].test(v) || (new RegExp(k, 'i').test(key) && /^https:/i.test(v) && !/\.(html?|php)(\?|$)/i.test(v)))) found = { url: v, kind: kinds.find((k) => re[k].test(v)) || kinds[0] }; return } if (typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k) }
  walk(d); return found
}
const dataUri = (s) => { const m = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(String(s || '')); return m ? Buffer.from(m[2], 'base64') : null }

async function reply(sock, from, msg, o) {
  const q = { quoted: msg }
  if (o.bin) { const k = /^audio/i.test(o.ct) ? 'audio' : /^video/i.test(o.ct) ? 'video' : 'image'; return sock.sendMessage(from, { [k]: o.bin, ...(k === 'audio' ? { mimetype: o.ct } : { caption: clip(o.caption || '', 900) }) }, q) }
  if (o.mediaUrl) { try { return await sock.sendMessage(from, { [o.kind]: { url: o.mediaUrl }, caption: clip(o.caption || '', 900) }, q) } catch (_) { /* fall back to the link as text */ o.caption = (o.caption ? o.caption + '\n' : '') + o.mediaUrl } }
  return sock.sendMessage(from, { text: clip(o.caption || 'No result.') }, q)
}

// ---- command table
const arg = (t) => String(t || '').trim()
const first = (t) => arg(t).split(/\s+/)[0] || ''
const rest = (t) => arg(t).replace(/^\S+\s*/, '')
const isUrl = (s) => /^https?:\/\/\S+$/i.test(s)
const need = (usage) => ({ usage })
const mk = (name, aliases, description, category, run) => ({ name, aliases, description, category, run })
// sub-command group: .name <sub> [text]
const group = (name, aliases, description, category, subs) => mk(name, aliases, description, category, async ({ text }) => {
  const sub = first(text).toLowerCase(), s = subs[sub]
  if (!s) return { usage: `Use: .${name} ${Object.keys(subs).join(' | ')}` + '\n' + Object.entries(subs).map(([k, v]) => `.${name} ${k}${v.arg ? ' <' + v.arg + '>' : ''}`).join('\n') }
  const a = rest(text)
  if (s.arg === 'url' && !isUrl(a)) return { usage: `Use: .${name} ${sub} <link>` }
  if (s.arg === 'query' && !a) return { usage: `Use: .${name} ${sub} <name>` }
  return { path: s.path, params: s.arg ? { q: a } : {}, names: s.arg === 'url' ? { q: U } : { q: Q }, list: true }
})
const ask = (name, aliases, description, category, path, usage, opts = {}) => mk(name, aliases, description, category, async ({ text }) => {
  const a = arg(text); if (!a) return { usage: `Use: .${name} ${usage}` }
  if (opts.url && !isUrl(a.split(/\s+/)[0])) return { usage: `Use: .${name} ${usage}` }
  return { path, params: { q: opts.url ? first(a) : a }, names: { q: opts.url ? U : Q }, ...opts }
})
const none = (name, aliases, description, category, path) => mk(name, aliases, description, category, async () => ({ path, params: {}, names: {}, list: true }))

export const TECHX = [
  // ---------- anime
  group('samehadaku', ['sameha'], 'Samehadaku anime: latest, detail, download', 'Anime Commands', { latest: { path: '/api/anime/samehadaku/latest' }, detail: { path: '/api/anime/samehadaku/detail', arg: 'url' }, download: { path: '/api/anime/samehadaku/download', arg: 'url' } }),
  group('otakudesu', ['otaku'], 'Otakudesu anime: search, ongoing, detail, download', 'Anime Commands', { search: { path: '/api/anime/otakudesu/search', arg: 'query' }, ongoing: { path: '/api/anime/otakudesu/ongoing' }, detail: { path: '/api/anime/otakudesu/detail', arg: 'url' }, download: { path: '/api/anime/otakudesu/download', arg: 'url' } }),
  group('oploverz', [], 'Oploverz anime: search, ongoing, episode, download', 'Anime Commands', { search: { path: '/api/anime/oploverz-search', arg: 'query' }, ongoing: { path: '/api/anime/oploverz-ongoing' }, episode: { path: '/api/anime/oploverz-episode', arg: 'url' }, download: { path: '/api/anime/oploverz-download', arg: 'url' } }),
  group('auratail', [], 'Auratail anime: search, popular, latest, detail', 'Anime Commands', { search: { path: '/api/anime/auratail-search', arg: 'query' }, popular: { path: '/api/anime/auratail-popular' }, latest: { path: '/api/anime/auratail-latest' }, detail: { path: '/api/anime/auratail-detail', arg: 'url' } }),
  ask('anichin', [], 'Search anime on Anichin', 'Anime Commands', '/api/anime/anichin-search', '<anime name>', { list: true }),
  // ---------- AI
  ask('powerbrainai', ['powerbrain'], 'Chat with PowerBrain AI', 'AI', '/api/ai/powerbrainai', '<question>'),
  ask('muslimai', [], 'Islamic questions with Muslim AI', 'AI', '/api/ai/muslimai', '<question>'),
  ask('gita', ['gitaai'], 'Ask the Bhagavad Gita AI', 'AI', '/api/ai/gita', '<question>'),
  ask('geminilite', [], 'Gemini Lite AI', 'AI', '/api/ai/gemini-lite', '<question>'),
  ask('geminitx', [], 'Gemini AI (TechX)', 'AI', '/api/ai/gemini', '<question>'),
  ask('bibleai', ['bible2'], 'Ask the Bible AI', 'AI', '/api/ai/bibleai', '<question>'),
  ask('bard', ['bardai'], 'Bard AI', 'AI', '/api/ai/bard', '<question>'),
  ask('flux', ['fluxai'], 'Make an image with Flux AI', 'AI', '/api/ai/flux', '<describe the picture>', { media: ['image'] }),
  // ---------- Cloudflare AI
  mk('cftranslate', ['cftrans'], 'Translate text: .cftranslate <language code> <text>', 'AI', async ({ text }) => {
    const l = first(text).toLowerCase(), t = rest(text); if (!/^[a-z]{2,3}(-[a-z]{2,4})?$/.test(l) || !t) return { usage: 'Use: .cftranslate <language code> <text>   e.g. .cftranslate hi Good morning' }
    return { path: '/api/cf/translation', params: { text: t, lang: l }, names: { text: Q, lang: ['to', 'target', 'lang', 'target_lang', 'language'] } } }),
  ask('sentiment', [], 'Sentiment of a text (positive / negative)', 'AI', '/api/cf/sentiment', '<text>'),
  ask('imgclassify', ['classify'], 'Classify an image from a link', 'AI', '/api/cf/image-classification', '<image link>', { url: true, list: true }),
  ask('embedding', [], 'Text embedding (numbers) from Cloudflare AI', 'AI', '/api/cf/embedding', '<text>', { short: true }),
  ask('cfchat', ['cloudchat'], 'Chat with Cloudflare AI', 'AI', '/api/cf/chat', '<message>'),
  // ---------- currency and crypto
  mk('currency', ['fx'], 'Currency: rates, list, convert', 'Finance', async ({ text }) => {
    const s = first(text).toLowerCase(), a = rest(text).split(/\s+/).filter(Boolean)
    if (s === 'rates') return { path: '/api/currency/rates', params: { base: (a[0] || '').toUpperCase() }, names: { base: ['base', 'from', 'currency'] }, list: true }
    if (s === 'list') return { path: '/api/currency/list', params: {}, names: {}, list: true, short: true }
    if (s === 'convert') { const amt = Number(a[0]), f = (a[1] || '').toUpperCase(), t = (a[2] || '').toUpperCase(); if (!(amt > 0) || !/^[A-Z]{3}$/.test(f) || !/^[A-Z]{3}$/.test(t)) return { usage: 'Use: .currency convert <amount> <from> <to>   e.g. .currency convert 100 USD INR' }; return { path: '/api/currency/convert', params: { amount: amt, from: f, to: t }, names: { amount: ['amount', 'amt', 'value'], from: ['from', 'base', 'source'], to: ['to', 'target', 'symbol'] } } }
    return { usage: 'Use: .currency rates [USD] | list | convert <amount> <from> <to>' } }),
  mk('crypto', ['cryptoprice'], 'Crypto price: .crypto btc', 'Finance', async ({ text }) => { const s = first(text).toLowerCase(); if (!/^[a-z0-9-]{2,20}$/.test(s)) return { usage: 'Use: .crypto <symbol>   e.g. .crypto btc' }; return { path: '/api/currency/crypto/' + encodeURIComponent(s), params: {}, names: {} } }),
  // ---------- APK and downloader
  ask('openapk', [], 'Search APKs on OpenAPK', 'Download', '/api/apk/openapk', '<app name>', { list: true }),
  ask('an1', ['an1apk'], 'Search APKs on AN1', 'Download', '/api/apk/an1', '<app name>', { list: true }),
  ask('aiodl', ['aio'], 'Download a video / audio from many sites (all-in-one)', 'Download', '/api/download/aio', '<link>', { url: true, media: ['video', 'audio', 'image'] }),
  // ---------- tools
  ask('subdomains', ['subdomain'], 'Find subdomains of a domain', 'Converter', '/api/tools/subdomains', '<domain.com>', { list: true }),
  none('voices', ['ttsvoices'], 'List of text-to-speech voices', 'Converter', '/api/tools/voices'),
  ask('identifyanime', ['whatanime'], 'Identify an anime from a screenshot link', 'Anime Commands', '/api/tools/identify-anime', '<image link>', { url: true }),
  mk('fakedata', ['fakeid'], 'Random fake test data', 'Converter', async ({ text }) => ({ path: '/api/tools/fake-data', params: { type: first(text) }, names: { type: ['type', 'q', 'locale'] } })),
  ask('binary2text', ['bin2text'], 'Binary (0101…) to text', 'Converter', '/api/tools/binary2text', '<binary>'),
  ask('base642text', ['b64decode'], 'Base64 to text', 'Converter', '/api/tools/base642text', '<base64>'),
  ask('shortlink', ['shorten'], 'Make a short link', 'Converter', '/api/tools/shorturl', '<link>', { url: true })
]

async function run(def, ctx) {
  const { sock, from, msg } = ctx
  const who = String(msg?.key?.participant || from), now = Date.now()
  if (now - (last.get(who) || 0) < COOLDOWN) return sock.sendMessage(from, { text: '⏳ Please wait a few seconds before the next request.' }, { quoted: msg })
  const p = await def.run(ctx)
  if (p.usage) return sock.sendMessage(from, { text: p.usage }, { quoted: msg })
  last.set(who, now); if (last.size > 2000) for (const [k, t] of last) if (now - t > 60000) last.delete(k)
  try { await sock.sendPresenceUpdate?.('composing', from) } catch (_) {}
  let r
  try { r = await call(p.path, p.params, p.names) } catch (e) { return sock.sendMessage(from, { text: '⚠️ The service did not answer (' + (e.name === 'TimeoutError' ? 'timeout' : /^HTTP \d{3}$/.test(e.message) ? e.message : 'network') + '). Please try again in a moment.' }, { quoted: msg }) }
  if (r.bin) return reply(sock, from, msg, r)
  const d = r.json !== undefined ? r.json : r.text
  if (typeof d === 'string' && /<!doctype html|<html\b/i.test(d)) return sock.sendMessage(from, { text: '⚠️ The service is busy right now. Please try again later.' }, { quoted: msg })
  if (p.media) {                       // image / video answer
    const uri = typeof d === 'object' ? JSON.stringify(d).match(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/i) : null
    const buf = uri && dataUri(uri[0]); if (buf && buf.length < 12e6) return reply(sock, from, msg, { bin: buf, ct: 'image/png', caption: '' })
    const m = typeof d === 'object' ? findMedia(d, p.media) : null
    if (m) return reply(sock, from, msg, { mediaUrl: m.url, kind: m.kind, caption: clip(typeof d === 'object' ? (d.title || d.caption || '') : '', 300) })
  }
  let out = pretty(d)
  if (p.short && out.length > 900) out = out.slice(0, 900) + '…'
  return reply(sock, from, msg, { caption: out ? clip(out) : 'No result found.' })
}

export const commands = TECHX.map((def) => ({
  name: def.name, aliases: def.aliases, description: def.description, category: def.category,
  execute: (ctx) => run(def, ctx).catch((e) => { console.error('[techx]', def.name, String(e.message || e).slice(0, 100)); return ctx.sock.sendMessage(ctx.from, { text: '⚠️ Something went wrong. Please try again.' }, { quoted: ctx.msg }) })
}))
