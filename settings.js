const settings = {
  packname: 'RAUF × LUCIFER MD BOT',
  author: '亗 𝐑𝐀𝐔𝐅 乂 𝐋𝐔𝐂𝐈𝐅𝐄𝐑 亗',
  botName: "RAUF × LUCIFER MD BOT",
  prefix: ".",
  telegramLink: "https://t.me/Next_DYS",
  youtubeLink: "https://youtube.com/@demoneye_official?si=e11wzia0R29I0weo",
  websiteLink: "",
  botOwner: '亗 𝐑𝐀𝐔𝐅 乂 𝐋𝐔𝐂𝐈𝐅𝐄𝐑 亗', // Your name
  ownerNumber: process.env.OWNER_NUMBER || '919103902586', // Owner 1 - country code + number, digits only
  ownerNumber2: process.env.OWNER_NUMBER_2 || '919475205887', // Owner 2 - full owner access too
  giphyApiKey: 'qnl7ssQChTdPjsKta2Ax2LMaGXz303tq',
  commandMode: "public",
  maxStoreMessages: 20, 
  storeWriteInterval: 30000,
  description: "RAUF × LUCIFER MD BOT — Powerful • Multi Device • Fast | WhatsApp Bot",
  channelLink: "https://whatsapp.com/channel/0029VbDZOHWLtOjKFsWcAP0a",
  groupLink: process.env.GROUP_LINK || "https://chat.whatsapp.com/HX2P0t6KxaHHLhctPpCw6x",
  menuImage: './assets/rauf-header.jpg',
  menuAudio: './assets/menu-voice.ogg',
  menuAudioUrl: '',
  version: 'V25.2 BETA ⚡',
  build: '2026-11-02.1',                 // shown in the startup log and .settings — confirms which zip is really running
  updateZipUrl: "",
};

// White label: data/brand.json (filled in Admin > Brand) replaces the name, owner, links ... of this bot
try { require('./lib/brand').applySettings(settings); } catch (_) {}

// Owner-command overrides (.setownername / .setbotname / .setpackname / .setauthor) survive restarts.
try { require('./lib/botConfig').applyOverrides(settings); } catch (_) {}

// Expose consistent brand/config globals for legacy ESM plugins.
global.botName = settings.botName;
global.botname = settings.botName;
global.tenorApiKey = process.env.TENOR_API_KEY || '';
global.suppL = settings.groupLink || settings.channelLink;
global.channelLink = settings.channelLink;
global.groupLink = settings.groupLink;
global.packname = settings.packname;
global.author = settings.author;
global.botPhotoUrl = './assets/rauf-header.jpg';
global.botImage1 = global.botImage2 = global.botImage3 = global.botImage4 = './assets/rauf-header.jpg';
global.botName = settings.botName;
global.botname = settings.botName;

// Paired bots (Telegram /pair, .pair) can change bot name / pack name / author / channel link for THEIR session only.
// Inside a session the Proxy returns that session's value; the main bot (no session) sees the normal values.
const sessionContext = require('./lib/sessionContext');
module.exports = new Proxy(settings, {
  get(target, prop, receiver) {
    if (typeof prop === 'string') { const o = sessionContext.override(prop); if (o !== undefined) return o; }
    return Reflect.get(target, prop, receiver);
  }
});
