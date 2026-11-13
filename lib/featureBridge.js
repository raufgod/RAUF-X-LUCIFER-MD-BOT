const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { getContentType } = require('@whiskeysockets/baileys');

const FEATURE_DIR = path.join(__dirname, '..', 'features');
let loaded = false;
let loading = null;
const registry = new Map();

const cleanJid = (jid) => String(jid || '').split(':')[0];
const digits = (jid) => String(jid || '').replace(/\D/g, '');

function bodyOf(message) {
  const mm = message?.message || {};
  const e = mm.extendedTextMessage;
  return String(mm.conversation || e?.text || mm.imageMessage?.caption || mm.videoMessage?.caption || mm.documentMessage?.caption || mm.buttonsResponseMessage?.selectedButtonId || mm.listResponseMessage?.singleSelectReply?.selectedRowId || mm.templateButtonReplyMessage?.selectedId || '').trim();
}

function getQuoted(sock, message) {
  const mm = message?.message || {};
  const ci = mm.extendedTextMessage?.contextInfo || mm.imageMessage?.contextInfo || mm.videoMessage?.contextInfo || mm.documentMessage?.contextInfo;
  const qm = ci?.quotedMessage;
  if (!qm) return null;
  const type = getContentType(qm) || Object.keys(qm)[0];
  const msg = qm[type] || qm;
  const q = {
    key: { remoteJid: message.key.remoteJid, id: ci?.stanzaId, fromMe: false, participant: ci?.participant },
    message: qm, msg, mtype: type,
    id: ci?.stanzaId,
    sender: ci?.participant || message.key.remoteJid,
    from: message.key.remoteJid,
    chat: message.key.remoteJid,
    text: msg?.text || msg?.caption || msg?.conversation || msg?.contentText || msg?.selectedDisplayText || msg?.title || '',
  };
  q.download = () => sock.downloadMediaMessage(q, 'buffer', {});
  q.delete = () => sock.sendMessage(q.from, { delete: q.key });
  return q;
}

function isMediaType(type) { return /image|video|sticker|audio|document/.test(type || ''); }

async function loadFeatures() {
  if (loaded) return registry;
  if (loading) return loading;
  loading = (async () => {
    const files = fs.readdirSync(path.join(FEATURE_DIR, 'Plugins')).filter(f => f.endsWith('.js')).sort();
    for (const file of files) {
      try {
        const mod = await import(pathToFileURL(path.join(FEATURE_DIR, 'Plugins', file)).href);
        const plugin = mod.default;
        if (!plugin || typeof plugin.start !== 'function') continue;
        const names = new Set([plugin.name, ...(Array.isArray(plugin.alias) ? plugin.alias : [])].filter(Boolean).map(x => String(x).toLowerCase()));
        for (const name of names) if (!registry.has(name)) registry.set(name, plugin);
      } catch (e) {
        console.warn(`[RAUF FEATURES] ${file} skipped: ${e.message}`);
      }
    }
    loaded = true;
    console.log(`[RAUF FEATURES] Loaded ${registry.size} command/alias entries from ${files.length} feature modules`);
    return registry;
  })();
  return loading;
}

function makeAtlas(sock) {
  const Atlas = Object.create(sock);
  Atlas.decodeJid = sock.decodeJid || cleanJid;
  Atlas.sendText = (jid, text, quoted, options={}) => sock.sendMessage(jid, { text: String(text), ...options }, quoted ? { quoted } : undefined);
  Atlas.sendFile = async (jid, data, filename='file', caption='', quoted, options={}) => {
    let value = data;
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) value = { url: value };
    if (Buffer.isBuffer(value)) {
      const ext = path.extname(filename).toLowerCase();
      const mime = ext === '.mp3' ? 'audio/mpeg' : ext === '.mp4' ? 'video/mp4' : ['.jpg','.jpeg'].includes(ext) ? 'image/jpeg' : ext === '.png' ? 'image/png' : options.mimetype || 'application/octet-stream';
      const key = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'document';
      return sock.sendMessage(jid, { [key]: value, mimetype: mime, fileName: filename, caption, ...options }, quoted ? { quoted } : undefined);
    }
    const ext = path.extname(filename).toLowerCase();
    const key = ext === '.mp4' ? 'video' : ext === '.mp3' ? 'audio' : /^image\//.test(options.mimetype || '') ? 'image' : 'document';
    return sock.sendMessage(jid, { [key]: value, fileName: filename, caption, ...options }, quoted ? { quoted } : undefined);
  };
  Atlas.downloadMediaMessage = (...args) => sock.downloadMediaMessage(...args);
  Atlas.downloadAndSaveMediaMessage = async (message, filename, attachExtension=true) => {
    const buffer = await sock.downloadMediaMessage(message, 'buffer', {});
    let out = filename;
    if (attachExtension && !path.extname(out)) out += '.bin';
    fs.writeFileSync(out, buffer); return out;
  };
  return Atlas;
}

async function handle(sock, message, prefix='.') {
  const body = bodyOf(message);
  if (!body.startsWith(prefix)) return false;
  const parts = body.slice(prefix.length).trim().split(/\s+/);
  const command = (parts.shift() || '').toLowerCase();
  if (!command) return false;
  const commands = await loadFeatures();
  const plugin = commands.get(command);
  if (!plugin) return false;

  const from = message.key.remoteJid;
  const sender = message.key.participant || from;
  const isGroup = from.endsWith('@g.us');
  const quoted = getQuoted(sock, message);
  const text = parts.join(' ');
  const rawType = getContentType(message.message || {}) || '';
  const m = {
    ...message, key: message.key, from, chat: from, sender, isGroup,
    fromMe: !!message.key.fromMe, pushName: message.pushName || 'Unknown',
    type: rawType, message: message.message, msg: message.message?.[rawType],
    text: body, body, quoted,
    mentions: message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [],
  };
  m.reply = (value, chatId=from, options={}) => Buffer.isBuffer(value) ? Atlas.sendFile(chatId, value, 'file', '', message, options) : Atlas.sendText(chatId, value, message, options);
  m.download = () => sock.downloadMediaMessage(message, 'buffer', {});

  const metadata = isGroup ? await sock.groupMetadata(from).catch(() => ({ participants: [], subject: '' })) : { participants: [], subject: '' };
  const participants = metadata.participants || [];
  const botJid = sock.user?.id || '';
  const botLid = sock.user?.lid || '';
  const groupAdmins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);
  const senderClean = cleanJid(sender);
  const botClean = cleanJid(botJid);
  const ownerNumber = require('../settings').ownerNumber || process.env.OWNER_NUMBER || '';
  const ownerList = [ownerNumber, require('../settings').ownerNumber2, ...(global.owner || [])].filter(Boolean);
  const isCreator = !!message.key.fromMe || ownerList.some(v => digits(v) && digits(v) === digits(sender));
  const isAdmin = groupAdmins.some(a => cleanJid(a) === senderClean);
  const isBotAdmin = groupAdmins.some(a => cleanJid(a) === botClean || cleanJid(a) === cleanJid(botLid));
  const mentionByTag = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const mime = (quoted?.msg?.mimetype || m.msg?.mimetype || ' ');
  const isMedia = isMediaType(rawType) || /image|video|sticker|audio/.test(mime);
  const itsMe = senderClean === botClean;
  const isintegrated = () => false; // no third-party privileged numbers
  const doReact = async emoji => sock.sendMessage(from, { react: { text: emoji, key: message.key } });
  const mods = [];
  let banData = false;
  const ctx = {
    name:'RAUF × LUCIFER', metadata, pushName:m.pushName, participants, body, inputCMD:command,
    args:parts, botNumber:botJid, botLid, isCmd:true, isMedia, ar:parts.map(v=>v.toLowerCase()),
    groupAdmin:groupAdmins, isAdmin, text, itsMe, doReact, modcheck:false, isCreator,
    quoted, isintegrated, groupName:metadata.subject || '', mentionByTag, mime, isBotAdmin,
    prefix, db:null, command:plugin.name, commands, mods, banData,
  };
  const Atlas = makeAtlas(sock);
  await plugin.start(Atlas, m, ctx);
  return true;
}

function getStats(){return {loaded, commands:[...registry.keys()]};}
module.exports={handle,loadFeatures,getStats};
