// Message lookup + optional auto-translation for the additional command modules.
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const settings = require('../../../settings.js');

export const LANGUAGES = {
  en: 'English', hi: 'Hindi', ur: 'Urdu', ar: 'Arabic', bn: 'Bengali', es: 'Spanish', fr: 'French',
  de: 'German', pt: 'Portuguese', ru: 'Russian', tr: 'Turkish', id: 'Indonesian', it: 'Italian',
  ja: 'Japanese', ko: 'Korean', zh: 'Chinese', sw: 'Swahili', ta: 'Tamil', te: 'Telugu', mr: 'Marathi'
};

const LANG_FILE = path.join(process.cwd(), 'data', 'userlang.json');
const cache = new Map();
let langs = null;
const loadLangs = () => {
  if (langs) return langs;
  try { langs = JSON.parse(fs.readFileSync(LANG_FILE, 'utf8')); } catch { langs = {}; }
  return langs;
};
export const getUserLang = (jid) => loadLangs()[jid] || 'en';
export const setUserLang = (jid, lang) => {
  loadLangs()[jid] = lang;
  try { fs.mkdirSync(path.dirname(LANG_FILE), { recursive: true }); fs.writeFileSync(LANG_FILE, JSON.stringify(langs, null, 2)); } catch {}
};

export async function translate(text, lang = 'en') {
  const input = String(text ?? '');
  if (!input || !lang || lang === 'en') return input;
  const key = `${lang}:${input}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const { data } = await axios.get('https://translate.googleapis.com/translate_a/single', {
      params: { client: 'gtx', sl: 'auto', tl: lang, dt: 't', q: input }, timeout: 15000
    });
    const out = (data?.[0] || []).map(p => p?.[0] || '').join('') || input;
    if (cache.size > 500) cache.clear();
    cache.set(key, out);
    return out;
  } catch { return input; }
}
export const translateAIResponse = async (jid, text) => translate(text, getUserLang(jid));

const BOT = settings.botName;
const FOOT = `\n\n⚡ Powered by ${BOT}`;
const humanize = (k) => String(k).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').trim();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Hand-written messages (placeholders in {braces} are filled by the command modules).
const TABLE = {
  antilink: { success: '✅ Anti-link {option} → {action}', usage: 'ℹ️ Usage: .antilink on/off/delete/remove/warn' },
  add: { success: '✅ Added {number} to the group.', noNumber: '❌ Please provide a number to add.' },
  approve: { success: '✅ Join request(s) approved.', noRequests: 'ℹ️ No pending join requests.' },
  reject: { success: '✅ Join request(s) rejected.', noRequests: 'ℹ️ No pending join requests.' },
  req: { list: '📋 *Pending requests*\n\n{list}', noRequests: 'ℹ️ No pending join requests.' },
  rename: { success: '✅ Group name changed to: {name}', noName: '❌ Please provide a new group name.' },
  desc: { success: '✅ Group description updated:\n{desc}', noDesc: '❌ Please provide a description.' },
  kick: { success: '✅ @{user} was removed.', noTarget: '❌ Mention or reply to the user to remove.' },
  promote: { success: '✅ @{user} is now an admin.', noTarget: '❌ Mention or reply to the user to promote.' },
  demote: { success: '✅ @{user} is no longer an admin.', noTarget: '❌ Mention or reply to the user to demote.' },
  lock: { success: '🔒 Group locked. Only admins can edit group info.' },
  unlock: { success: '🔓 Group unlocked. Everyone can edit group info.' },
  invite: { success: '🔗 Group invite link:\nhttps://chat.whatsapp.com/{code}' },
  revoke: { success: '♻️ Invite link reset:\nhttps://chat.whatsapp.com/{code}' },
  disap: { help: 'ℹ️ Usage: .disap 24h | 7d | 90d | off', success24: '✅ Disappearing messages set to 24 hours.', success7: '✅ Disappearing messages set to 7 days.', success90: '✅ Disappearing messages set to 90 days.' },
  group: { groupOnly: '❌ This command only works in groups.' },
  leave: { error: '❌ Could not leave the group.' },
  kickall: { warning: '⚠️ This removes all non-admin members. Use with care.' },
  tagall: { defaultText: '📢 Attention everyone!', header: '📢 *TAG ALL*\n\n{text}\n', noParticipants: '❌ No participants found.', error: '❌ Tag all failed.' },
  hidetag: { default: '📢', noMessage: '❌ Please provide a message.' },
  broadcast: { start: '📡 Broadcasting...', message: '📢 *BROADCAST*\n\n{message}', noMessage: '❌ Please provide a message.', error: '❌ Broadcast failed.' },
  info: { result: '👥 *GROUP INFO*\n\n📛 Name: {groupName}\n🆔 ID: {groupId}\n👑 Owner: {ownerNumber}\n👤 Members: {totalMembers}\n🛡️ Admins ({adminCount}):\n{adminList}', error: '❌ Could not fetch group info.' },
  sudo: { added: '✅ {number} added as sudo.', removed: '✅ {number} removed from sudo.', invalid: '❌ Invalid number.', listEmpty: 'ℹ️ No sudo users.', listHeader: '👑 *SUDO USERS*', noReply: '❌ Reply to a user or provide a number.' },
  language: { available: '🌐 *Available languages*', current: 'Current language:', example: 'Example: .lang hi', notSupported: '❌ Language not supported.', response: '✅ Language changed.', success: '✅ Language changed.', supported: 'Supported:', usage: 'ℹ️ Usage: .lang <code>' },
  pair: { error: '❌ Could not generate a pairing code.', generating: '⏳ Generating pairing code for {number}...', invalid: '❌ Invalid phone number.', noNumber: '❌ Please provide a phone number with country code.', success: '✅ Pairing code for {number}:', timeout: '❌ Pairing timed out.' },
  online: { checking: '⏳ Checking online members...', error: '❌ Could not check online members.', header: '🟢 *ONLINE MEMBERS* {text}', noMembers: 'ℹ️ No online members found.', onlineLabel: 'Online', powered: FOOT.trim() },
  host: { error: '❌ Could not read hosting info: {error}', info: '🖥️ *HOST INFO*\n\nPlatform: {platform}' },
  lyrics: { error: `❌ Could not fetch lyrics.${FOOT}`, noQuery: `❌ Please provide a song name.${FOOT}`, notFound: '❌ Lyrics not found.', result: '🎵 *{title}*' },
  math: { error: '❌ Invalid expression.', invalidFormat: '❌ Invalid format. Example: .math 5+5', invalidOperation: '❌ Invalid operation.', result: '🧮 Result: {result}' },
  npm: { error: '❌ NPM search failed.', noQuery: '❌ Please provide a package name.', notFound: '❌ Package not found: {query}', result: '📦 {name}' },
  weather: { error: '❌ Could not fetch the weather.', noText: '❌ Please provide a city name.', result: '🌤️ Weather for {name}' },
  google: { error: '❌ Search failed.', header: '🔎 *Google results for:* {query}\n', item: '\n{title}', noQuery: '❌ Please provide a search query.', noResults: '❌ No results found.' },
  yts: { error: '❌ YouTube search failed.', footer: '⚡ Powered by {botName}', header: '▶️ *YouTube results for:* {query}\n', item: '\n{num}. {title}', noText: '❌ Please provide a search query.' },
  github: { error: '❌ GitHub lookup failed.', info: '🐙 *{name}*', noUsername: '❌ Please provide a GitHub username.', notFound: '❌ GitHub user not found.' },
  element: { error: '❌ Could not fetch element info.', info: '⚛️ *{name}*', noQuery: '❌ Please provide an element name or symbol.', notFound: '❌ Element not found.' },
  vision: { error: '❌ Image analysis failed: {error}', noImage: '❌ Reply to an image.', noQuery: '❌ Please add a question about the image.', success: '👁️ {result}' },
  story: { caption: '📸 Story by @{username}', error: '❌ Could not fetch stories for @{username}.', noStories: '❌ No stories found for @{username}.', noUsername: '❌ Please provide a username.', unknown: '❌ Unknown media type: {url}' },
  twitter: { caption: '🐦 Twitter video ({quality})', fetching: '⏳ Fetching video...', invalidUrl: '❌ Invalid Twitter/X link.', noUrl: '❌ Please provide a Twitter/X link.', noVideo: '❌ No video found.' },
  zip: { caption: '🗜️ Zipped successfully.', creating: '⏳ Creating zip...', error: '❌ Zip failed: {error}', powered: FOOT.trim(), success: '✅ Zip created.', tooLarge: '❌ File too large ({size}).' },
  url: { error: '❌ Upload failed.', noMedia: '❌ Reply to an image, video or audio file.', powered: FOOT.trim(), success: '✅ Uploaded:\n{url}', tooLarge: '❌ File is too large.' },
  save: { error: '❌ Could not save this status.', image: '✅ Image saved.', noOwner: '❌ Owner only command.', noReply: '❌ Reply to a status.', success: '✅ Saved.', unsupported: '❌ Unsupported media.', video: '✅ Video saved.' },
  playlist: { duration: '⏱️', fetching: '⏳ Fetching playlist...', header: '🎶 *PLAYLIST*', more: '...and {remaining} more', noQuery: '❌ Please provide a playlist link.', noResults: '❌ Playlist is empty.', playlistTitle: '📜 Title:', powered: FOOT.trim(), total: '🔢 Total:', usage: 'ℹ️ Usage: .playlist <youtube playlist link>' },
  play: { channel: '📺 Channel:', downloading: '⬇️ Downloading...', duration: '⏱️ Duration:', error: '❌ Could not play this song.', failed: '❌ Download failed.', noQuery: '❌ Please provide a song name.', notFound: '❌ Song not found.', powered: FOOT.trim(), processing: '⏳ Processing...', quality: '🎚️ Quality:', searching: '🔎 Searching...', sending: '📤 Sending...', sendingOriginal: '📤 Sending original file...', title: '🎵 Title:', uploaded: '📅 Uploaded:', views: '👁️ Views:' },
  song: { channel: '📺 Channel:', downloading: '⬇️ Downloading...', duration: '⏱️ Duration:', error: '❌ Could not fetch this song.', failed: '❌ Download failed.', noQuery: '❌ Please provide a song name.', notFound: '❌ Song not found.', powered: FOOT.trim(), searching: '🔎 Searching...', title: '🎵 Title:' },
  ytmp3: { caption: '🎵 Here is your audio.', error: '❌ Could not convert to MP3.', noLink: '❌ Please provide a YouTube link.', noResults: '❌ No results.', noText: '❌ Please provide a link or name.' },
  ytmp4: { caption: '🎬 Here is your video.', error: '❌ Could not download the video.', noLink: '❌ Please provide a YouTube link.', noResults: '❌ No results.', noText: '❌ Please provide a link or name.' },
  imagine: { caption: '🎨 Generated by AI', error: '❌ Image generation failed.', generating: '🎨 Generating image...', noPrompt: '❌ Please describe the image.' },
  imageDl: { caption: '🖼️ Here is your image.', error: '❌ Could not fetch the image.', noImage: '❌ No image found.', noUrl: '❌ Please provide a link.', success: '✅ Image downloaded.' },
  logo: { processing: '⏳ Creating your logo...' },
  attp: { error: '❌ Could not create sticker.', noText: '❌ Please provide text.' },
  stickersearch: { error: '❌ Sticker search failed.', noText: '❌ Please provide a search term.' },
  llama: { error: '❌ AI request failed.', noQuestion: '❌ Please ask a question.', noResponse: '❌ No response from AI.' },
  gemini: { error: '❌ AI request failed.', noQuestion: '❌ Please ask a question.' },
  deepseek: { error: '❌ AI request failed.', gathering: '🧠 Thinking...', noQuery: '❌ Please ask a question.' },
  gpt: { error: '❌ AI request failed.', noPrompt: '❌ Please provide a prompt.' },
  create: { error: '❌ Could not create the group.', usage: 'ℹ️ Usage: .create <group name>', welcome: '👋 Welcome to the group!' },
  trivia: { error: '❌ Could not fetch trivia.' },
  jokes: { error: '❌ Could not fetch a joke.' },
  advice: { error: '❌ Could not fetch advice.' },
  inspire: { error: '❌ Could not fetch a quote.' },
  wallpaper: { caption: '🖼️ Random wallpaper', error: '❌ Could not fetch a wallpaper.' },
  country: { fetching: '🌍 Fetching info for', noCountry: '❌ Please provide a country name.', notFound: '❌ Country not found.', no: 'No', yes: 'Yes', powered: FOOT.trim() },
  category: { aliases: 'Aliases:', error: '❌ Could not load category.', notFound: '❌ Category not found.', provideName: '❌ Please provide a category name.' },
  categories: { error: '❌ Could not load categories.', general: 'General', header: '📂 *CATEGORIES*', use: 'Use .category <name>', user: 'User', whatsapp: 'WhatsApp' },
  findcmd: { access: 'Access:', aliases: 'Aliases:', category: 'Category:', description: 'Description:', example: 'Example:', fileLocation: 'File:', header: '🔍 *COMMAND INFO*', name: 'Name:', noCommand: '❌ Please provide a command name.', notFound: '❌ Command not found.', ownerOnly: 'Owner only' },
  help: { aliases: 'Aliases:', date: 'Date:', error: '❌ Could not load help.', greeting: 'Hello', noCommands: 'No commands.', noDescription: 'No description.', owner: 'Owner:', powered: FOOT.trim(), prefix: 'Prefix:', time: 'Time:', timezone: 'Timezone:', usage: 'Usage:' },
  user: {
    autobioAlreadyOff: 'ℹ️ Auto-bio is already off.', autobioAlreadyOn: 'ℹ️ Auto-bio is already on.', autobioDisabled: '✅ Auto-bio disabled.', autobioEnabled: '✅ Auto-bio enabled.', autobioUsage: 'ℹ️ Usage: .autobio on/off',
    blockError: '❌ Could not block this user.', blockNoTarget: '❌ Reply to or mention a user to block.', blockProtected: '❌ This user is protected.', blockSuccess: '✅ Blocked @{jid}.',
    getppCaption: '🖼️ Profile picture', getppDefaultImage: '❌ No profile picture found.', mygroupsError: '❌ Could not list groups.', mygroupsHeader: '👥 *MY GROUPS*', mygroupsItem: '• {subject}',
    restartMessage: '♻️ Restarting bot...', setbioError: '❌ Could not set bio.', setbioNoText: '❌ Please provide bio text.', setbioSuccess: '✅ Bio updated.',
    unblockError: '❌ Could not unblock this user.', unblockNoTarget: '❌ Reply to or mention a user to unblock.', unblockProtected: '❌ This user is protected.', unblockSuccess: '✅ Unblocked @{jid}.',
    whoisAbout: '📝 About:', whoisDefaultImage: '❌ No profile picture.', whoisFooter: FOOT.trim(), whoisName: '👤 Name:', whoisSetAt: '🕒 Set at:', whoisSetOn: '📅 Set on:'
  },
  structure: { analysisHeader: '📊 *PROJECT ANALYSIS*', analyzing: '⏳ Analyzing...', cmdDefault: 'Show summary', cmdDetails: 'Show details', cmdFiles: 'List files', cmdSize: 'Show sizes', cmdTree: 'Show tree', cmdTreeAlias: 'Alias of tree', continued: '(continued)', detailsHeader: '📋 *DETAILS*', error: '❌ Analysis failed.', filesHeader: '📄 *FILES*', helpTitle: '📂 *STRUCTURE HELP*', largestFiles: 'Largest files', largestFolders: 'Largest folders', node: 'Node:', platform: 'Platform:', powered: FOOT.trim(), sizeHeader: '📦 *SIZES*', tips: '💡 Tips', topExtensions: 'Top extensions', totalFiles: 'Total files:', totalFolders: 'Total folders:', totalSize: 'Total size:', treeHeader: '🌳 *TREE*' }
};

// WhatsApp privacy / profile commands: nested keys like t(from, 'whatsapp', 'mydp.success').
const WA = {
  fullpp: { success: '✅ Full profile picture set ({choice}).' },
  privacy: { info: '🔐 *PRIVACY SETTINGS* — {name}' },
  pin: { success: '📌 Chat pin: {choice}' }, unpin: { success: '📌 Chat unpin: {choice}' },
  star: { success: '⭐ Star: {choice}' }, unstar: { success: '⭐ Unstar: {choice}' },
  mydp: { help: 'ℹ️ Profile photo privacy options: {options}', success: '✅ Profile photo privacy: {choice}' },
  mystatus: { help: 'ℹ️ About privacy options: {options}', success: '✅ About privacy: {choice}' },
  groupadd: { help: 'ℹ️ Group add privacy options: {options}', success: '✅ Group add privacy: {choice}' },
  lastseen: { help: 'ℹ️ Last seen privacy options: {options}', success: '✅ Last seen privacy: {choice}' },
  myonline: { help: 'ℹ️ Online privacy options: {options}', success: '✅ Online privacy: {choice}' },
  onwa: { exists: '✅ {number} is on WhatsApp.', notExists: '❌ {number} is not on WhatsApp.' },
  removedp: { success: '✅ Profile picture removed.' }, archive: { success: '📦 Archive: {choice}' },
  bizprofile: { result: '💼 *BUSINESS PROFILE*\n\n{description}\n{part}\n{list}\n{url}' },
  details: { result: '📋 *DETAILS*\n\n{description}\n{part}\n{list}\n{url}' },
  blocklist: { result: '🚫 *BLOCK LIST*\n\n{description}\n{part}\n{list}\n{url}' },
  location: { result: '📍 *LOCATION*\n\n{description}\n{part}\n{list}\n{url}' }
};

function fallback(cat, key) {
  const k = String(key);
  const label = humanize(k);
  if (k === 'error' || /Error$/.test(k)) return '❌ Something went wrong. Please try again.';
  if (/^no[A-Z]/.test(k)) return `❌ Please provide ${humanize(k.slice(2)).toLowerCase()}.`;
  if (/^(notFound|notExists)$/.test(k)) return '❌ Nothing found.';
  if (k === 'success' || /Success$/.test(k)) return '✅ Done.';
  if (/^(usage|help)$/.test(k)) return `ℹ️ Usage: .${cat} <input>`;
  if (/^(processing|generating|fetching|searching|downloading|sending|gathering|analyzing|creating|checking)$/.test(k)) return `⏳ ${cap(label)}...`;
  if (k === 'powered' || k === 'footer') return FOOT.trim();
  if (k === 'caption') return `✅ Here you go!${FOOT}`;
  if (k === 'header') return `*${cat.toUpperCase()}*`;
  return `${cap(label)}:`;
}

function lookup(cat, key) {
  let hit = TABLE[cat]?.[key];
  if (hit !== undefined) return hit;
  if (cat === 'whatsapp') {
    const [a, b] = String(key).split('.');
    hit = WA[a]?.[b];
    if (hit !== undefined) return hit;
  }
  if (String(cat).includes('.')) {
    const [a, b] = String(cat).split('.');
    hit = WA[a]?.[b] ?? TABLE[a]?.[b];
    if (hit !== undefined) return hit;
  }
  return fallback(cat, String(key).split('.').pop());
}

export async function t(jid, cat, key) {
  const base = lookup(cat, key);
  const lang = getUserLang(jid);
  return lang === 'en' ? base : translate(base, lang);
}
