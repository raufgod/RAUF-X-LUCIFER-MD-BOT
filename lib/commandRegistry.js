'use strict';
// RAUF × LUCIFER MD BOT by RAUF × LUCIFER — single source of truth for every command the bot can run.
// Used by .menu (numbered list) and by main.js (flashmd loader with native priority).
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const read = (p) => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return ''; } };
const NAME = /^[a-z0-9_-]+$/i;

let nativeCache = null;

function parseMainJs() {
  const exact = new Set(), prefix = new Set();
  const src = read('main.js');
  for (const line of src.split('\n')) {
    if (!/^\s*case\s/.test(line) || !line.includes('userMessage')) continue;
    let m;
    const reEq = /userMessage\s*===\s*['"]\.([a-z0-9_-]+)['"]/gi;
    while ((m = reEq.exec(line))) exact.add(m[1].toLowerCase());
    const rePre = /userMessage\.startsWith\(\s*['"]\.([a-z0-9_-]+)/gi;
    while ((m = rePre.exec(line))) { exact.add(m[1].toLowerCase()); prefix.add(m[1].toLowerCase()); }
    const reAlt = /\/\^\\\.\(([^)]*)\)/g;
    while ((m = reAlt.exec(line))) for (const x of m[1].split('|')) if (NAME.test(x)) exact.add(x.toLowerCase());
  }
  return { exact, prefix };
}

function parseExtraTools() {
  const src = read('commands/extra-tools.js');
  const i = src.indexOf('const commands = new Set([');
  const j = src.indexOf(']);', i);
  const out = new Set();
  if (i < 0 || j < 0) return out;
  for (const m of src.slice(i, j).matchAll(/'([a-z0-9_-]+)'/g)) out.add(m[1].toLowerCase());
  return out;
}

function parseV2() {
  const src = read('lib/newMenuV2Bridge.js');
  const out = new Set();
  const fm = src.match(/const fileMap = \{([^}]+)\}/);
  if (fm) for (const m of fm[1].matchAll(/([a-z0-9_]+):'/gi)) out.add(m[1].toLowerCase());
  const am = src.match(/const aliases = \{([^}]+)\}/);
  if (am) for (const m of am[1].matchAll(/([a-z0-9_]+):'/gi)) out.add(m[1].toLowerCase());
  ['song', 'video', 'emojimix'].forEach((n) => out.add(n));
  return out;
}

function parseQadeer() {
  const out = new Set();
  try {
    for (const f of fs.readdirSync(path.join(ROOT, 'qadeer', 'commands'))) {
      if (f.endsWith('.js')) out.add(`${f.replace(/\.js$/i, '').toLowerCase()}2`);
    }
  } catch {}
  const b = read('qadeer/bridge.js');
  for (const m of b.matchAll(/'[^']+\.js':\s*'([a-z0-9_-]+)'/gi)) out.add(`${m[1].toLowerCase()}2`);
  ['runtime2', 'translate2', 'trt2', 'pair2', 'welcome2', 'goodbye2'].forEach((n) => out.add(n));
  return out;
}

function parseGroupPlus() {
  try { return new Set(require('../commands/groupplus').COMMANDS); } catch (_) { return new Set(); }
}

function parseLuciferX() {
  try { return new Set(require('../commands/luciferx').COMMANDS); } catch (_) { return new Set(); }
}

function native() {
  if (nativeCache) return nativeCache;
  const main = parseMainJs();
  const extra = parseExtraTools();
  const v2 = parseV2();
  const qad = parseQadeer();
  const gp = parseGroupPlus();
  const lx = parseLuciferX();
  const all = new Set([...main.exact, ...extra, ...v2, ...qad, ...gp, ...lx]);
  nativeCache = { all, main: main.exact, prefix: main.prefix, extra, v2, qad, gp, lx };
  return nativeCache;
}

const isNative = (name) => native().all.has(String(name).toLowerCase());
const isHandledListed = (name) => {
  const n = String(name).toLowerCase();
  const nat = native();
  if (nat.all.has(n)) return true;
  for (const p of nat.prefix) if (p.length >= 4 && n.startsWith(p)) return true;
  return false;
};

/* ───── Flash-module (ESM) command loader, shared by main.js and .menu ───── */
const EXCLUDED = new Set(['deepseek', 'chatgpt', 'image', 'imagine', 'mathgpt', 'math-el', 'gemini', 'ytmp3', 'menu', 'help', 'sc', 'script', 'repo']);
let flashPromise = null;

async function loadFlashCommands() {
  if (!global.__kobFlashCommandRegistry) global.__kobFlashCommandRegistry = new Map();
  if (flashPromise) return flashPromise;
  flashPromise = (async () => {
    const reg = global.__kobFlashCommandRegistry;
    const dir = path.join(ROOT, 'commands', 'flashmd');
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => f.endsWith('_extra.js')).sort(); } catch {}
    for (const file of files) {
      try {
        const mod = await import(pathToFileURL(path.join(dir, file)).href);
        for (const item of mod.commands || []) {
          if (!item?.name) continue;
          const names = [item.name, ...(Array.isArray(item.aliases) ? item.aliases : [])].map((v) => String(v).toLowerCase());
          if (names.some((n) => EXCLUDED.has(n))) continue;
          item.__file = file;
          // Native commands keep priority: flash modules only fill the gaps.
          for (const n of names) if (!isNative(n)) reg.set(n, item);
        }
      } catch (e) { console.error('[Additional command load]', file, e.message); }
    }
    return reg;
  })();
  return flashPromise;
}

/* ───── Menu builder ───── */
function cleanName(raw) { const m = String(raw).trim().match(/^\.([a-z0-9_-]+)/i); return m ? m[1].toLowerCase() : null; }

// Final menu sections, in the order they are shown.
const SECTIONS = [
  ['GENERAL', '🤖'], ['OWNER & BOT CONTROL', '👑'], ['ADMIN & GROUP', '🛡️'], ['DOWNLOADER', '📥'], ['AI & CHAT', '🧠'],
  ['IMAGE & STICKER', '🖼️'], ['TEXTMAKER & LOGO', '🎨'], ['SEARCH & INFO', '🔎'], ['UTILITY & TOOLS', '🧰'],
  ['GAMES', '🎮'], ['FUN & MEME', '😂'], ['ANIME', '🌸'], ['WHATSAPP & PROFILE', '📱'], ['MISC', '🧩']
];
const list = (s) => s.split(/\s+/).filter(Boolean);
const EXPLICIT = {
  'GENERAL': list('lucifer about luciferx lx pingplus help menu menu2 bot list ping pingcheck alive aboutbot supportinfo version runtime uptime health serverinfo botstats owner info ownerinfo'),
  'OWNER & BOT CONTROL': list('boton botoff mode private public privatemode publicmode botname setname sudo restart eval eval2 exec exec-help structure clearsesi antistatus autoseen autoreacts autoreaction areact statusauto readall acceptcall callguard deletedguard linkguard statusguard sendmediaowner'),
  'ADMIN & GROUP': list('antibot joinmode addmode demoteall groupowner groupcreated listcc kickcc tagrandom unban groupinfo groupdesc groupinviteinfo groupavatarinfo groupdetails infogp infogrupo staff admins listadmin searchgroups topmembers tagmembers taghidden kickmember kickinactive kickoffline anularlink revoke accept status broadcast create language'),
  'DOWNLOADER': list('fb fbdl fb2 fbfetch ig igdl insta instafetch mediafire mf mediafetch mp3 music ytdl ytmp3 ytmp4 ytmp4v2 tiktokv2 tiktok tt ttdl tiktokfetch twitterdl twitter teraboxdl gdrive driveget getpastebin capcut pinvid pinterestvideo pinphoto pinterestphoto printrest viralvideo video-dl alldl posts tgs apk aptoide apksearch spotify sinhalasub tg image-dl'),
  'AI & CHAT': list('chatgpt deepseekai gemini llama vision summarize'),
  'IMAGE & STICKER': list('attp qc quotly emix emomix face-palm itssostupid its-so-stupid simpcard lolice oogway oogway2 namecard tweet ytcomment comrade gay glass jail passed triggered heart horny circle lgbt waste wasted welcomegoodbyeimage stickertelegram telesticker stickersearch toimg best-wallp steal s img2 memepick randommeme'),
  'SEARCH & INFO': list('googlesearch duckduckgo imdb country yts ytsearch lyrics define bible cuaca detiknews kompasnews india malaysia thailand iss charinfo element npm genshinbuild fetch playlist currency exchange'),
  'UTILITY & TOOLS': list('afk todo url url2 tourl vv ss ssweb screenshot time date tts translate trt trt2 translate2 quicktranslate jid jid2 id myid whoami messageid quotedinfo qrcodegenerator web2zip zip math findcmd categories category pair pair2 numbercheck host tomp3 trim weather weather2 news'),
  'GAMES': list('ttt surrender move rank level top daily wallet balance slots give richlist mathquiz'),
  'FUN & MEME': list('rate vibe gn advice flip jokes love lovenight inspire shayri tahukahkamu hack jokebox quotes cekkhodam'),
  'ANIME': list('animu animuquote tonikawa loli'),
  'WHATSAPP & PROFILE': list('archive bizprofile blocklist fullpp fullgpp groupadd lastseen location mydp myonline mystatus onwa pin removedp save star unpin unstar vcard autobio block unblock details getpp profilepic dp mygroups setbio whois')
};
const BY_NAME = new Map();
for (const [sec, names] of Object.entries(EXPLICIT)) for (const n of names) BY_NAME.set(n, sec);

const LEGACY = {
  'GENERAL COMMANDS': 'GENERAL', 'ADMIN & GROUP COMMANDS': 'ADMIN & GROUP', 'OWNER & BOT CONTROL COMMANDS': 'OWNER & BOT CONTROL',
  'IMAGE & STICKER COMMANDS': 'IMAGE & STICKER', 'PIES COMMANDS': 'IMAGE & STICKER', 'GAME COMMANDS': 'GAMES', 'FUN COMMANDS': 'FUN & MEME',
  'TEXTMAKER COMMANDS': 'TEXTMAKER & LOGO', 'AI & IMAGE API COMMANDS': 'AI & CHAT', 'EXTRA DOWNLOADER API COMMANDS': 'DOWNLOADER',
  'DOWNLOADER COMMANDS': 'DOWNLOADER', 'UTILITY COMMANDS': 'UTILITY & TOOLS', 'MISC COMMANDS': 'IMAGE & STICKER', 'ANIME COMMANDS': 'ANIME',
  'EXTRA COMMANDS': 'MISC',
  'AI': 'AI & CHAT', 'CONVERTER': 'UTILITY & TOOLS', 'DOWNLOAD': 'DOWNLOADER', 'FINANCE': 'SEARCH & INFO', 'FLASH PICS': 'IMAGE & STICKER',
  'FUN': 'FUN & MEME', 'GENERAL': 'UTILITY & TOOLS', 'GROUP': 'ADMIN & GROUP', 'LOGO': 'TEXTMAKER & LOGO', 'OWNER': 'OWNER & BOT CONTROL',
  'SEARCH': 'SEARCH & INFO', 'USER': 'WHATSAPP & PROFILE', 'WHATSAPP': 'WHATSAPP & PROFILE'
};
const FIRST = ['help', 'menu', 'ping', 'alive', 'owner', 'boton', 'botoff', 'mode'];

function sectionFor(name, hint) {
  if (BY_NAME.has(name)) return BY_NAME.get(name);
  if (hint && LEGACY[hint]) return LEGACY[hint];
  return 'MISC';
}

async function buildMenu(sourceLines = []) {
  await loadFlashCommands();
  const nat = native();
  const found = new Map(); // name -> legacy hint
  const add = (n, hint) => { if (n && !found.has(n)) found.set(n, hint || ''); };

  // curated list from the original menu (only commands that really exist)
  let cat = 'GENERAL COMMANDS';
  const catRe = /^\S+\s+\*(.+?)\*:/u;
  for (const raw of sourceLines) {
    const line = raw.trim();
    const cm = line.match(catRe);
    if (cm && !line.startsWith('➤')) { cat = cm[1].toUpperCase(); continue; }
    const m = line.match(/^(?:║\s*)?➤\s*(\.\S+)/);
    const n = m && cleanName(m[1]);
    if (n && isHandledListed(n)) add(n, cat);
  }
  // everything else wired up natively, then the additional modules
  for (const n of [...nat.main, ...nat.extra, ...nat.v2, ...nat.qad, ...nat.gp, ...nat.lx, 'boton', 'botoff']) add(n, '');
  for (const item of new Set(global.__kobFlashCommandRegistry.values())) {
    const n = String(item.name).toLowerCase();
    if (global.__kobFlashCommandRegistry.has(n)) add(n, String(item.category || '').toUpperCase());
  }

  const bySection = new Map(SECTIONS.map(([n]) => [n, []]));
  for (const [name, hint] of found) bySection.get(sectionFor(name, hint)).push(name);

  const rank = (n) => { const i = FIRST.indexOf(n); return i < 0 ? 999 : i; };
  const groups = [];
  for (const [title, icon] of SECTIONS) {
    const names = bySection.get(title).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'en', { numeric: true }));
    if (names.length) groups.push({ category: title, icon, items: names.map((name) => ({ name })) });
  }
  return { total: found.size, groups };
}

module.exports = { native, isNative, isHandledListed, loadFlashCommands, buildMenu };
