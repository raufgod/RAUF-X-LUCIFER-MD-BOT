const settings = require('../settings');
const fs = require('fs');
const path = require('path');

function readMode() {
    try {
        const state = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'messageCount.json'), 'utf8'));
        if (typeof state.isPublic === 'boolean') return state.isPublic ? 'PUBLIC' : 'PRIVATE';
    } catch {}
    return global.public === false ? 'PRIVATE' : 'PUBLIC';
}


// Stylish lettering: a bold SERIF font (thicker) for every command name in the list, and a
// bold ITALIC-SERIF font for the footer — thick and easy to read, with a designer slant.
const boldSerif = (str) => [...String(str)].map((ch) => {
  const c = ch.codePointAt(0);
  if (c >= 65 && c <= 90) return String.fromCodePoint(0x1D400 + c - 65);   // 𝐀-𝐙
  if (c >= 97 && c <= 122) return String.fromCodePoint(0x1D41A + c - 97);  // 𝐚-𝐳
  if (c >= 48 && c <= 57) return String.fromCodePoint(0x1D7CE + c - 48);   // 𝟎-𝟗
  return ch;
}).join('');
const boldItalic = (str) => [...String(str)].map((ch) => {
  const c = ch.codePointAt(0);
  if (c >= 65 && c <= 90) return String.fromCodePoint(0x1D468 + c - 65);   // 𝑴-𝒁 (bold italic)
  if (c >= 97 && c <= 122) return String.fromCodePoint(0x1D482 + c - 97);  // 𝒂-𝒛 (bold italic)
  return ch;
}).join('');
const FOOTER_LOVE = `❥ ${boldItalic('Made with love by RAUF × LUCIFER')} ❥`;
const FOOTER_POWER = `✦ ${boldItalic('Powered by RAUF × LUCIFER MD BOT by RAUF × LUCIFER')} ✦`;

// ── .menu2 : compact "Mini Bot" in a second style of the .menu look, with its own header photo. ──
const MINI_PICKS = {
  'GENERAL': 'help ping alive owner',
  'OWNER & BOT CONTROL': 'boton botoff mode sudo',
  'ADMIN & GROUP': 'kick promote tagall mute',
  'DOWNLOADER': 'play song video tiktok',
  'AI & CHAT': 'chatgpt gemini deepseekai llama',
  'IMAGE & STICKER': 'sticker attp take toimg',
  'TEXTMAKER & LOGO': 'neon glitch fire gold',
  'SEARCH & INFO': 'lyrics google imdb yts',
  'UTILITY & TOOLS': 'tts translate ss url',
  'GAMES': 'ttt hangman trivia',
  'FUN & MEME': 'joke love flirt meme',
  'ANIME': 'animu animuquote loli',
  'WHATSAPP & PROFILE': 'getpp whois block vcard'
};

async function sendMiniBoard(sock, chatId, message, menu, ctx) {
  const headerPath = require('../lib/sessionContext').assetPath('rauf-header-mini.jpg');
  const image = fs.existsSync(headerPath) ? fs.readFileSync(headerPath) : fs.readFileSync(require('../lib/sessionContext').assetPath('rauf-header.jpg'));
  const profileName = String(message?.pushName || (message?.key?.fromMe ? sock?.user?.name : '') || '')
    .replace(/[\r\n\t@]+/g, ' ').trim().slice(0, 30);
  const who = profileName ? `@${profileName}` : 'there';
  let botState = 'ON';
  try { botState = require('../lib/botSwitch').isOn() ? 'ON' : 'OFF'; } catch (_) {}
  const up = process.uptime();
  const upText = `${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m`;

  // Same family as .menu (bars, info box, section frames, ➤ rows) in a second look:
  // ▬ bars, ❮ ❯ boxes, ╔═〔 〕═╗ frames and ➜ rows — compact picks per section.
  const lines = [
    '▬▬▬▬▬▬▬',
    '🤖 𝐑𝐀𝐔𝐅 × 𝐋𝐔𝐂𝐈𝐅𝐄𝐑 𝐌𝐃 𝐁𝐎𝐓 • 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓',
    '⚡ BY RAUF × LUCIFER • TEAM RAUF × LUCIFER',
    '▬▬▬▬▬▬▬',
    '',
    `👋 ʜᴇʏ ${who}!`,
    `ɪ'ᴍ *ᴍɪɴɪ ʙᴏᴛ* — ᴛʜᴇ ᴘᴏᴄᴋᴇᴛ ᴠᴇʀsɪᴏɴ ᴏꜰ`,
    `👑 *${ctx.brand} ʙʏ ${ctx.owner}*`,
    'ɪ ᴋᴇᴇᴘ ɪᴛ sʜᴏʀᴛ — ᴛʜᴇ ʙᴇsᴛ ᴘɪᴄᴋs ᴏꜰ ᴇᴠᴇʀʏ sᴇᴄᴛɪᴏɴ.',
    '',
    '▬▬▬❮ 🤖 ᴍɪɴɪ ʙᴏᴛ ɪɴꜰᴏ ❯▬▬▬',
    `➜ 👤 ᴜsᴇʀ: ${who === 'there' ? 'Guest' : who}`,
    `➜ 👑 ᴏᴡɴᴇʀ: ${ctx.owner}`,
    `➜ 📜 ᴄᴏᴍᴍᴀɴᴅs: ${menu.total}`,
    `➜ 🗂️ sᴇᴄᴛɪᴏɴs: ${menu.groups.length}`,
    '➜ 📦 ᴘʀᴇғɪx: .',
    `➜ 🔋 sᴛᴀᴛᴜs: ${botState}`,
    `➜ ⏳ ᴜᴘᴛɪᴍᴇ: ${upText}`,
    '▬▬▬▬▬▬▬'
  ];
  for (const g of menu.groups) {
    const have = new Set(g.items.map(i => i.name));
    let picks = (MINI_PICKS[g.category] || '').split(' ').filter(n => n && have.has(n)).slice(0, 4);
    for (const i of g.items) { if (picks.length >= 3) break; if (!picks.includes(i.name)) picks.push(i.name); }
    lines.push('', `╔═〔 ${g.icon} ${g.category} • ${g.items.length} 〕═╗`, ...picks.flatMap((n, k) => (k ? ['', `➜ .${n}`] : [`➜ .${n}`])), '╚═════════════════╝');
  }
  lines.push('', '▬▬▬▬▬▬▬',
    '📖 ꜰᴜʟʟ ʟɪsᴛ ᴏꜰ ᴀʟʟ ᴄᴏᴍᴍᴀɴᴅs → *.menu*',
    '',
    FOOTER_LOVE,
    FOOTER_POWER);
  await sock.sendMessage(chatId, { image, caption: lines.join('\n') }, { quoted: message });
}

async function helpCommand(sock, chatId, message) {
    const incomingText = message?.message?.conversation || message?.message?.extendedTextMessage?.text || '';
    const trimmedText = incomingText.trim();
    const isMenu2 = /^\.menu2(?:\s|$)/i.test(trimmedText);
    // Style 2 (Minimal Premium): keep the complete menu, from header through
    // final footer, inside one WhatsApp code block. No command sections are omitted.
    const menuHeader = `┏━━━「 ${settings.botName || 'RAUF × LUCIFER MD BOT AI'}${isMenu2 ? ' • PRO MENU' : ''} 」━━━┓\n┃\n┃  ✧ BOT INFORMATION\n┃  ├─ ◈ Owner : ${settings.botOwner || 'RAUF × LUCIFER'}\n┃  ├─ ◈ Mode : ${readMode()} \n┃  ├─ ◈ Prefix : .\n┃  ├─ ◈ Version : ${settings.version || '3.0.0'}\n┃  └─ ◈ Updates : ${global.ytch || 'Official Updates'}\n┃`;
    const helpMessage = `
${menuHeader}

*Available Commands:*

╔═══════════════════╗
🌐 *General Commands*:
➤ .help
➤ .menu
➤ .ping
➤ .pingcheck
➤ .alive
➤ .aboutbot
➤ .supportinfo
➤ .version
➤ .runtime
➤ .uptime
➤ .health
➤ .serverinfo
➤ .botstats
➤ .groupinfo
➤ .groupdesc
➤ .groupinviteinfo
➤ .groupavatarinfo
➤ .staff
➤ .admins
➤ .jid
➤ .jid2
➤ .id
➤ .myid
➤ .whoami
➤ .messageid
➤ .quotedinfo
➤ .url
➤ .url2
➤ .vv
➤ .ss <link>
➤ .weather <city>
➤ .weather2 <city>
➤ .news
➤ .time
➤ .date
➤ .tts <text>
➤ .trt <text> <lang>
➤ .trt2 <text> <lang>
➤ .translate2 <text> <lang>
➤ .owner
➤ .pair2
╰━━━━━━━━━━━━━━━━━━━╯

╔═══════════════════╗
👮‍♂️ *Admin & Group Commands*:
➤ .ban @user
➤ .kick @user
➤ .kick2 @user
➤ .promote @user
➤ .promote2 @user
➤ .demote @user
➤ .demote2 @user
➤ .mute <minutes>
➤ .mute2 <minutes>
➤ .unmute
➤ .open2
➤ .invite2
➤ .delete
➤ .del
➤ .clear
➤ .warn @user
➤ .warnings @user
➤ .warncount @user
➤ .resetwarn @user
➤ .removewarn @user
➤ .antilink
➤ .antilinkmode <off/delete/allowlist>
➤ .allowlink <domain>
➤ .blocklink <domain>
➤ .linkallowlist <domain>
➤ .linkblocklist <domain>
➤ .linkstats
➤ .antibadword
➤ .badword <add/remove/list> <word>
➤ .antitag <on/off>
➤ .antispam <on/off/status>
➤ .antiflood <2-20/off>
➤ .antimention <limit>
➤ .antimentionmode <on/off/status>
➤ .antisticker <on/off/status>
➤ .antimedia <on/off/status>
➤ .antiforward <on/off/status>
➤ .antibot
➤ .slowmode <seconds>
➤ .setslowmode <seconds>
➤ .lockgroup
➤ .unlockgroup
➤ .groupmode
➤ .groupconfig
➤ .permissions
➤ .admincheck
➤ .groupstats
➤ .groupreport
➤ .membercount
➤ .members
➤ .membercheck @user
➤ .userinfo @user
➤ .adminlist
➤ .exportmembers
➤ .tag <message>
➤ .tagall
➤ .tagall2
➤ .tagadmins2
➤ .tag_admins2
➤ .tagnotadmin
➤ .hidetag <message>
➤ .hidetag2 <message>
➤ .resetlink
➤ .welcome <on/off>
➤ .welcome2 <message>
➤ .goodbye <on/off>
➤ .goodbye2 <message>
➤ .setwelcome <message>
➤ .setgoodbye <message>
➤ .setgdesc <description>
➤ .setgname <new name>
➤ .setgpp (reply to image)
➤ .grouplink
➤ .revokeinvite
➤ .approve @user
➤ .reject @user
➤ .poll <question> | <option 1> | <option 2>
➤ .pollhelp
➤ .pollvotehelp
➤ .setrules <text>
➤ .rules
➤ .securityreport
➤ .modlog
➤ .setmodlog <on/off>
╰━━━━━━━━━━━━━━━━━━━╯

╔═══════════════════╗
🔒 *Owner & Bot Control Commands*:
➤ .mode <public/private>
➤ .clearsession
➤ .antidelete
➤ .cleartmp
➤ .clean-temp
➤ .tempcheck
➤ .update
➤ .settings
➤ .setpp <reply to image>
➤ .setownername <name>
➤ .setbotname <name>
➤ .setbotimage <reply to image>
➤ .channeljid <channel link>
➤ .setchanneljid <id@newsletter or link>
➤ .resetbotimage
➤ .setpackname <name> / .setauthor <name>
➤ .autoreact <on/off>
➤ .autostatus <on/off>
➤ .autostatus react <on/off>
➤ .autotyping <on/off>
➤ .autoread <on/off>
➤ .autoreply <on/off/dm/group>
➤ .mentionreply <on/off>
➤ .cmdreact <on/off>
➤ .online on / .online off
➤ .errors / .errors clear
➤ .truecaller <number> (owner)
➤ .truecaller setid <installationId> (owner)
➤ .anticall set <warn/busy/block>
➤ .anticall msg <warn/busy> <text>
➤ .anticall <on/off/status>
➤ .pmblocker <on/off/status>
➤ .pmblocker setmsg <text>
➤ .setmention <reply to msg>
➤ .mention <on/off>
➤ .disablecmd <name>
➤ .enablecmd <name>
➤ .disabledcmd
➤ .maintenance <on/off/status>
➤ .maintenance-status
➤ .backupconfig
➤ .restoreconfig
➤ .exportstats
➤ .clearstats
➤ .botconfig
➤ .configstatus
➤ .prefix
╰━━━━━━━━━━━━━━━━━━━╯

╔═══════════════════╗
🎨 *Image & Sticker Commands*:
➤ .blur <image>
➤ .simage <reply to sticker>
➤ .sticker <reply to image>
➤ .sticker2 <reply to image>
➤ .s2 <image/sticker>
➤ .crop <reply to image>
➤ .tgsticker <link>
➤ .meme
➤ .take <packname>
➤ .take2 <packname>
➤ .save2
➤ .pinterest2 <query>
➤ .igs <Instagram link>
➤ .igsc <Instagram link>
➤ .emojimix <emoji1>+<emoji2>
╰━━━━━━━━━━━━━━━━━━━╯

╔═══════════════════╗
🖼️ *Pies Commands*:
➤ .pies <country>
➤ .china
➤ .indonesia
➤ .japan
➤ .korea
➤ .hijab
╰━━━━━━━━━━━━━━━━━━━╯

╔═══════════════════╗
🎮 *Game Commands*:
➤ .tictactoe @user
➤ .hangman
➤ .guess <letter>
➤ .trivia
➤ .answer <answer>
➤ .truth
➤ .truth2
➤ .dare
➤ .dare2
➤ .8ball <question>
➤ .8ball2 <question>
➤ .eightball2 <question>
➤ .choose <option 1> | <option 2>
➤ .choose2 <option 1> | <option 2>
➤ .coinflip
➤ .roll <sides>
➤ .lovetest2 @user
╰━━━━━━━━━━━━━━━━━━━╯

╔═══════════════════╗
🎯 *Fun Commands*:
➤ .joke
➤ .quote
➤ .fact
➤ .compliment @user
➤ .compliment2 @user
➤ .insult @user
➤ .flirt
➤ .shayari
➤ .goodnight
➤ .roseday
➤ .character @user
➤ .character2 @user
➤ .aura2 @user
➤ .wasted @user
➤ .ship @user
➤ .ship2 @user
➤ .simp @user
➤ .stupid @user <text>
➤ .roast2 @user
╰━━━━━━━━━━━━━━━━━━━╯

╔═══════════════════╗
🔤 *Textmaker Commands*:
➤ .metallic <text>
➤ .ice <text>
➤ .snow <text>
➤ .impressive <text>
➤ .matrix <text>
➤ .light <text>
➤ .neon <text>
➤ .devil <text>
➤ .purple <text>
➤ .thunder <text>
➤ .leaves <text>
➤ .1917 <text>
➤ .arena <text>
➤ .hacker <text>
➤ .sand <text>
➤ .blackpink <text>
➤ .glitch <text>
➤ .fire <text>
➤ .fancy2 <text>
➤ .readmore2 <text>
➤ .case <upper/lower/title> <text>
➤ .reverse <text>
╰━━━━━━━━━━━━━━━━━━━╯

╔═══════════════════╗
🤖 *AI & Image API Commands*:
➤ .gpt <question>
➤ .deepseek <question>
➤ .asyntai <question>
➤ .talkai <question>
➤ .notegpt <question>
➤ .zonerai <question>
➤ .pollinationai <question>
➤ .mathgpt <question>
➤ .story <topic>
➤ .imagine <prompt>
➤ .imageai <prompt>
➤ .airmore <text>
➤ .airmore list
➤ .voicelist
➤ .insultapi
➤ .lighteffects <text>
➤ .effectclouds <text>
➤ .galaxywallpaper <text>
➤ .cartoonstyle <text>
➤ .writetext <text>
╰━━━━━━━━━━━━━━━━━━━╯

╔═══════════════════╗
📦 *Extra Downloader API Commands*:
➤ .xdl <link>
➤ .aio3 <link>
➤ .spotifydl <link>
➤ .facebookdl <link>
➤ .mediafiredl <link>
╰━━━━━━━━━━━━━━━━━━━╯

╔═══════════════════╗
📥 *Downloader Commands*:
➤ .play <song name>
➤ .play2 <song name>
➤ .song <song name>
➤ .spotify <query>
➤ .instagram <link>
➤ .facebook <link>
➤ .tiktok <link>
➤ .tiktok2 <link>
➤ .ttstalk2 <username>
➤ .video <song name>
➤ .ytmp4 <link>
➤ .ytmp42 <link>
➤ .ytmp32 <link>
╰━━━━━━━━━━━━━━━━━━━╯

╔═══════════════════╗
🧰 *Utility Commands*:
➤ .note add <text>
➤ .note list
➤ .note remove <number>
➤ .note clear
➤ .notes
➤ .noteadd <text>
➤ .notelist
➤ .note-remove <number>
➤ .clearnotes
➤ .calc <expression>
➤ .calcpercent <part> <total>
➤ .qr <text/link>
➤ .shorturl <URL>
➤ .password <length>
➤ .uuid
➤ .base64 <encode/decode> <text>
➤ .jsonformat <JSON>
➤ .spellcheck <text>
➤ .wordcount <text>
➤ .hash <text>
➤ .random <min> <max>
➤ .echo <text>
➤ .remind <10m> <text>
➤ .reminderlist
➤ .cancelreminder <id>
➤ .helpsearch <term>
➤ .commandstats
➤ .privacy
➤ .pinhelp
➤ .cleanlinks
➤ .tempmail2
➤ .inbox2
➤ .runtime2
╰━━━━━━━━━━━━━━━━━━━╯

╔═══════════════════╗
🧩 *MISC Commands*:
➤ .heart
➤ .horny
➤ .circle
➤ .lgbt
➤ .lolice
➤ .its-so-stupid
➤ .namecard
➤ .oogway
➤ .tweet
➤ .ytcomment
➤ .comrade
➤ .gay
➤ .glass
➤ .jail
➤ .passed
➤ .triggered
╰━━━━━━━━━━━━━━━━━━━╯

╔═══════════════════╗
🖼️ *ANIME Commands*:
➤ .nom
➤ .poke
➤ .cry
➤ .kiss
➤ .pat
➤ .hug
➤ .wink
➤ .facepalm
╰━━━━━━━━━━━━━━━━━━━╯



╔═══════════════════╗
🧩 *Extra Commands*:
➤ .acceptcall
➤ .callguard <on/off>
➤ .deletedguard <on/off>
➤ .linkguard <on/off>
➤ .statusguard <on/off>
➤ .apksearch <query>
➤ .autoreaction <on/off>
➤ .readall
➤ .statusauto
➤ .charinfo
➤ .profilepic
➤ .fbfetch <url>
➤ .driveget <url>
➤ .groupdetails
➤ .numbercheck <number>
➤ .taghidden <message>
➤ .instafetch <url>
➤ .jokebox
➤ .kickmember @user
➤ .kickinactive
➤ .memepick
➤ .mediafetch <url>
➤ .ownerinfo
➤ .pingplus
➤ .privatemode
➤ .publicmode
➤ .botname <name>
➤ .tagmembers <message>
➤ .tiktokfetch <url>
➤ .quicktranslate <text>
➤ .sendmediaowner (reply to ordinary media)`;

    // SAHIL-MD inspired menu layout: preserve the same separator/category look,
    // but put each command on its own line and include the full existing command index.
    const headerPath = require('../lib/sessionContext').assetPath('rauf-header.jpg');
    if (!fs.existsSync(headerPath)) throw new Error('Menu header image missing: assets/rauf-header.jpg');

    const sourceLines = helpMessage.split('\n');
    // The menu is generated from the live command registry: every command that is actually wired up
    // (main dispatcher, extra tools, aliases, qadeer set and the additional modules) gets its own number.
    const { buildMenu } = require('../lib/commandRegistry');
    const menu = await buildMenu(sourceLines);
    const brand = settings.botName || 'RAUF × LUCIFER MD BOT';
    const owner = settings.botOwner || 'RAUF × LUCIFER';
    if (isMenu2) return sendMiniBoard(sock, chatId, message, menu, { brand, owner });


    // Who typed .menu: shown with their WhatsApp profile name (not the phone number).
    const rawSender = message?.key?.fromMe
      ? (sock?.user?.id || '')
      : (message?.key?.participant || message?.participant || message?.key?.remoteJid || '');
    const senderNumber = String(rawSender).split('@')[0].split(':')[0];
    const profileName = String(message?.pushName || (message?.key?.fromMe ? sock?.user?.name : '') || '')
      .replace(/[\r\n\t@]+/g, ' ').trim().slice(0, 30);
    const userLabel = profileName ? `@${profileName}` : (senderNumber ? `@${senderNumber}` : 'Guest');

    const fmtUptime = (sec) => {
      const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
      return `${d ? d + 'd ' : ''}${h}h ${m}m`;
    };
    let botState = 'ON';
    try { botState = require('../lib/botSwitch').isOn() ? 'ON' : 'OFF'; } catch (_) {}

    // Classic RAUF × LUCIFER MD BOT menu look (▰ bars, ❰ ❱ info box, ╭━━〔 〕━━╮ sections, ➤ ─ rows),
    // upgraded with greeting, user profile name, date/time (IST), live status, system info,
    // and icons + counts on every section.
    const tz = 'Asia/Kolkata'; // India time (IST) — fixed, independent of the host's clock
    const now = new Date();
    let hour = now.getHours(), dateStr = '', timeStr = '';
    try {
      hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: tz }).format(now)) % 24;
      dateStr = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: tz }).format(now);
      timeStr = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tz }).format(now);
    } catch (_) { dateStr = now.toDateString(); timeStr = now.toLocaleTimeString(); }
    const greeting = hour < 5 ? 'ɢᴏᴏᴅ ɴɪɢʜᴛ 🌙' : hour < 12 ? 'ɢᴏᴏᴅ ᴍᴏʀɴɪɴɢ 🌅' : hour < 17 ? 'ɢᴏᴏᴅ ᴀғᴛᴇʀɴᴏᴏɴ ☀️' : hour < 21 ? 'ɢᴏᴏᴅ ᴇᴠᴇɴɪɴɢ 🌇' : 'ɢᴏᴏᴅ ɴɪɢʜᴛ 🌙';
    const os = require('os');
    const ramUsed = Math.round(process.memoryUsage().rss / 1048576);
    const ramTotal = Math.round(os.totalmem() / 1048576);

    // Original RAUF × LUCIFER MD BOT look (▰ bars, ❰ ❱ info box, ➤ ─ rows) — same style, upgraded with
    // the user's profile name, live status/uptime/date and icons + counts per section.
    // No WhatsApp channel/community link is included anywhere in this menu.
    const PFX = require('../lib/prefix').get();
    const inSess = !!require('../lib/sessionContext').current();
    const linkLines = [settings.telegramLink && `➤ ✈️ ᴛᴇʟᴇɢʀᴀᴍ: ${settings.telegramLink}`, settings.websiteLink && `➤ 🌐 ᴡᴇʙsɪᴛᴇ: ${settings.websiteLink}`, (require('../lib/sessionContext').current()?.overrides?.channelLink) && `➤ 📢 ᴄʜᴀɴɴᴇʟ: ${require('../lib/sessionContext').current().overrides.channelLink}`].filter(Boolean);
    const infoLines = [
      '▰▰▰▰▰▰▰',
      `➤  ${boldSerif(String(settings.botName || 'RAUF × LUCIFER MD BOT').toUpperCase())} 👑⚔️`,
      '▰▰▰▰▰▰▰',
      '',
      `👋 ${greeting}  ${userLabel}`,
      '',
      '▰▰▰❰ 🤖 ʙᴏᴛ ɪɴғᴏ ❱▰▰▰',
      `➤ 👤 ᴜsᴇʀ: ${userLabel}`,
      `➤ 👑 ᴏᴡɴᴇʀ: ${owner}`,
      '➤ 🛠️ ᴅᴇᴠᴇʟᴏᴘᴇʀ: RAUF × LUCIFER',
      `➤ 📜 ᴄᴏᴍᴍᴀɴᴅs: ${menu.total}`,
      `➤ 🗂️ sᴇᴄᴛɪᴏɴs: ${menu.groups.length}`,
      `➤ 📦 ᴘʀᴇғɪx: ${PFX}`,
      `➤ ⚙️ ᴍᴏᴅᴇ: ${readMode()}`,
      `➤ 🔋 sᴛᴀᴛᴜs: ${botState}`,
      `➤ ⏳ ᴜᴘᴛɪᴍᴇ: ${fmtUptime(process.uptime())}`,
      `➤ 📅 ᴅᴀᴛᴇ: ${dateStr} • ${timeStr}`,
      `➤ 🏷️ ᴠᴇʀsɪᴏɴ: ${settings.version || '1.0.0 STABLE ⚡'}`,
      ...linkLines,
      '▰▰▰▰▰▰▰',
    ];

    // Original RAUF × LUCIFER MD BOT .menu style: full list every time, plain rows (no per-row icons,
    // no bold font on command names, no short/teaser view). Only the footer below uses a bold
    // font, as requested — everything else is exactly the old design.
    const listLines = [];
    for (const g of menu.groups) {
      listLines.push('', `▰▰▰❰ ${g.icon} ${g.category} • ${g.items.length} ❱▰▰▰`, ...g.items.map(i => `➤ ── ${PFX}${boldSerif(i.name)}`));
    }
    listLines.push('', '▰▰▰▰▰▰▰', FOOTER_LOVE, FOOTER_POWER);

    // Menu = header photo whose caption holds the whole command list, then the voice note.
    // Safety net: if WhatsApp refuses such a long caption, send the photo with the bot info
    // and deliver the same list as text messages so the menu never fails.
    const fullCaption = [...infoLines, ...listLines].join('\n');
    const headerImage = fs.readFileSync(headerPath);
    try {
      await sock.sendMessage(chatId, { image: headerImage, caption: fullCaption }, { quoted: message });
    } catch (captionError) {
      console.error('[menu] full caption failed, using text fallback:', captionError.message);
      await sock.sendMessage(chatId, { image: headerImage, caption: infoLines.join('\n') }, { quoted: message });
      let buf = '';
      const chunks = [];
      for (const line of listLines) {
        if ((buf + '\n' + line).length > 3500 && buf) { chunks.push(buf); buf = ''; }
        buf += (buf ? '\n' : '') + line;
      }
      if (buf.trim()) chunks.push(buf);
      for (const chunk of chunks) await sock.sendMessage(chatId, { text: chunk }, { quoted: message });
    }

    // Send the supplied audio as a WhatsApp-compatible OGG/Opus voice note.
    // It is converted from the user's MP3 during packaging, so no runtime ffmpeg is required.
    const voicePath = path.join(__dirname, '..', 'assets', 'menu-voice.ogg');
    if (!fs.existsSync(voicePath)) throw new Error('Menu voice audio missing: assets/menu-voice.ogg');
    await sock.sendMessage(chatId, {
        audio: fs.readFileSync(voicePath),
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true
    });
}

module.exports = helpCommand;