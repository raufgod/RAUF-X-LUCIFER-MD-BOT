// 🧹 Fix for ENOSPC / temp overflow in hosted panels
const fs = require('fs');
const path = require('path');

// Redirect temp storage away from system /tmp
const customTemp = path.join(process.cwd(), 'temp');
if (!fs.existsSync(customTemp)) fs.mkdirSync(customTemp, { recursive: true });
process.env.TMPDIR = customTemp;
process.env.TEMP = customTemp;
process.env.TMP = customTemp;

// Auto-cleaner every 3 hours
setInterval(() => {
    fs.readdir(customTemp, (err, files) => {
        if (err) return;
        for (const file of files) {
            const filePath = path.join(customTemp, file);
            fs.stat(filePath, (err, stats) => {
                if (!err && Date.now() - stats.mtimeMs > 3 * 60 * 60 * 1000) {
                    fs.unlink(filePath, () => { });
                }
            });
        }
    });
    console.log('🧹 Temp folder auto-cleaned');
}, 3 * 60 * 60 * 1000);

const settings = require('./settings');
require('./config.js');
const isBanned = (...a) => require('./lib/isBanned').isBanned(...a);
const yts = require('yt-search');
const fetch = require('node-fetch');
const ytdl = require('ytdl-core');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const { isSudo } = require('./lib/index');
const isOwnerOrSudo = (...a) => require('./lib/isOwner')(...a);
const { isAutotypingEnabled, handleAutotypingForCommand } = require('./commands/autotyping');
const autotypingCommand = (...a) => require('./commands/autotyping').autotypingCommand(...a);
const handleAutotypingForMessage = (...a) => require('./commands/autotyping').handleAutotypingForMessage(...a);
const showTypingAfterCommand = (...a) => require('./commands/autotyping').showTypingAfterCommand(...a);
const { isAutoreadEnabled } = require('./commands/autoread');
const autoreadCommand = (...a) => require('./commands/autoread').autoreadCommand(...a);
const handleAutoread = (...a) => require('./commands/autoread').handleAutoread(...a);

// Command imports
const tagAllCommand = (...a) => require('./commands/tagall')(...a);
const helpCommand = (...a) => require('./commands/help')(...a);
const banCommand = (...a) => require('./commands/ban')(...a);
const promoteCommand = (...a) => require('./commands/promote').promoteCommand(...a);
const demoteCommand = (...a) => require('./commands/demote').demoteCommand(...a);
const muteCommand = (...a) => require('./commands/mute')(...a);
const unmuteCommand = (...a) => require('./commands/unmute')(...a);
const stickerCommand = (...a) => require('./commands/sticker')(...a);
const isAdmin = (...a) => require('./lib/isAdmin')(...a);
const warnCommand = (...a) => require('./commands/warn')(...a);
const warningsCommand = (...a) => require('./commands/warnings')(...a);
const ttsCommand = (...a) => require('./commands/tts')(...a);
const tictactoeCommand = (...a) => require('./commands/tictactoe').tictactoeCommand(...a);
const handleTicTacToeMove = (...a) => require('./commands/tictactoe').handleTicTacToeMove(...a);
const incrementMessageCount = (...a) => require('./commands/topmembers').incrementMessageCount(...a);
const topMembers = (...a) => require('./commands/topmembers').topMembers(...a);
const ownerCommand = require('./commands/owner');
const deleteCommand = (...a) => require('./commands/delete')(...a);
const { handleLinkDetection } = require('./commands/antilink');
const handleAntilinkCommand = (...a) => require('./commands/antilink').handleAntilinkCommand(...a);
const handleAntitagCommand = (...a) => require('./commands/antitag').handleAntitagCommand(...a);
const handleTagDetection = (...a) => require('./commands/antitag').handleTagDetection(...a);
const { Antilink } = require('./lib/antilink');
const handleMentionDetection = (...a) => require('./commands/mention').handleMentionDetection(...a);
const mentionToggleCommand = (...a) => require('./commands/mention').mentionToggleCommand(...a);
const setMentionCommand = (...a) => require('./commands/mention').setMentionCommand(...a);
const memeCommand = (...a) => require('./commands/meme')(...a);
const tagCommand = (...a) => require('./commands/tag')(...a);
const tagNotAdminCommand = (...a) => require('./commands/tagnotadmin')(...a);
const hideTagCommand = (...a) => require('./commands/hidetag')(...a);
const jokeCommand = (...a) => require('./commands/joke')(...a);
const quoteCommand = (...a) => require('./commands/quote')(...a);
const factCommand = (...a) => require('./commands/fact')(...a);
const weatherCommand = (...a) => require('./commands/weather')(...a);
const newsCommand = (...a) => require('./commands/news')(...a);
const kickCommand = (...a) => require('./commands/kick')(...a);
const simageCommand = (...a) => require('./commands/simage')(...a);
const attpCommand = (...a) => require('./commands/attp')(...a);
const startHangman = (...a) => require('./commands/hangman').startHangman(...a);
const guessLetter = (...a) => require('./commands/hangman').guessLetter(...a);
const startTrivia = (...a) => require('./commands/trivia').startTrivia(...a);
const answerTrivia = (...a) => require('./commands/trivia').answerTrivia(...a);
const complimentCommand = (...a) => require('./commands/compliment').complimentCommand(...a);
const insultCommand = (...a) => require('./commands/insult').insultCommand(...a);
const eightBallCommand = (...a) => require('./commands/eightball').eightBallCommand(...a);
const lyricsCommand = (...a) => require('./commands/lyrics').lyricsCommand(...a);
const dareCommand = (...a) => require('./commands/dare').dareCommand(...a);
const truthCommand = (...a) => require('./commands/truth').truthCommand(...a);
const clearCommand = (...a) => require('./commands/clear').clearCommand(...a);
const pingCommand = (...a) => require('./commands/ping')(...a);
const aliveCommand = (...a) => require('./commands/alive')(...a);
const blurCommand = (...a) => require('./commands/img-blur')(...a);
const welcomeCommand = (...a) => require('./commands/welcome').welcomeCommand(...a);
const handleJoinEvent = (...a) => require('./commands/welcome').handleJoinEvent(...a);
const goodbyeCommand = (...a) => require('./commands/goodbye').goodbyeCommand(...a);
const handleLeaveEvent = (...a) => require('./commands/goodbye').handleLeaveEvent(...a);
const { handleAntiBadwordCommand } = require('./lib/antibadword');
const handleBadwordDetection = (...a) => require('./lib/antibadword').handleBadwordDetection(...a);
const antibadwordCommand = (...a) => require('./commands/antibadword')(...a);
const takeCommand = (...a) => require('./commands/take')(...a);
const flirtCommand = (...a) => require('./commands/flirt').flirtCommand(...a);
const characterCommand = (...a) => require('./commands/character')(...a);
const wastedCommand = (...a) => require('./commands/wasted')(...a);
const shipCommand = (...a) => require('./commands/ship')(...a);
const groupInfoCommand = (...a) => require('./commands/groupinfo')(...a);
const resetlinkCommand = (...a) => require('./commands/resetlink')(...a);
const staffCommand = (...a) => require('./commands/staff')(...a);
const unbanCommand = (...a) => require('./commands/unban')(...a);
const emojimixCommand = (...a) => require('./commands/emojimix')(...a);
const handlePromotionEvent = (...a) => require('./commands/promote').handlePromotionEvent(...a);
const handleDemotionEvent = (...a) => require('./commands/demote').handleDemotionEvent(...a);
const viewOnceCommand = (...a) => require('./commands/viewonce')(...a);
const clearSessionCommand = (...a) => require('./commands/clearsession')(...a);
const autoStatusCommand = (...a) => require('./commands/autostatus').autoStatusCommand(...a);
const handleStatusUpdate = (...a) => require('./commands/autostatus').handleStatusUpdate(...a);
const simpCommand = (...a) => require('./commands/simp').simpCommand(...a);
const stupidCommand = (...a) => require('./commands/stupid').stupidCommand(...a);
const stickerTelegramCommand = (...a) => require('./commands/stickertelegram')(...a);
const textmakerCommand = (...a) => require('./commands/textmaker')(...a);
const { handleAntideleteCommand, handleMessageRevocation, storeMessage } = require('./commands/antidelete');
const clearTmpCommand = (...a) => require('./commands/cleartmp')(...a);
const setProfilePicture = (...a) => require('./commands/setpp')(...a);
const setGroupDescription = (...a) => require('./commands/groupmanage').setGroupDescription(...a);
const setGroupName = (...a) => require('./commands/groupmanage').setGroupName(...a);
const setGroupPhoto = (...a) => require('./commands/groupmanage').setGroupPhoto(...a);
const instagramCommand = (...a) => require('./commands/instagram')(...a);
const facebookCommand = (...a) => require('./commands/facebook')(...a);
const spotifyCommand = (...a) => require('./commands/spotify')(...a);
const playCommand = (...a) => require('./commands/play')(...a);
const tiktokCommand = (...a) => require('./commands/tiktok')(...a);
const songCommand = (...a) => require('./commands/song')(...a);
const urlCommand = (...a) => require('./commands/url')(...a);
const handleTranslateCommand = (...a) => require('./commands/translate').handleTranslateCommand(...a);
const handleSsCommand = (...a) => require('./commands/ss').handleSsCommand(...a);
const addCommandReaction = (...a) => require('./lib/reactions').addCommandReaction(...a);
const handleAreactCommand = (...a) => require('./lib/reactions').handleAreactCommand(...a);
const goodnightCommand = (...a) => require('./commands/goodnight').goodnightCommand(...a);
const shayariCommand = (...a) => require('./commands/shayari').shayariCommand(...a);
const rosedayCommand = (...a) => require('./commands/roseday').rosedayCommand(...a);
const videoCommand = (...a) => require('./commands/video')(...a);
const sudoCommand = (...a) => require('./commands/sudo')(...a);
const miscCommand = (...a) => require('./commands/misc').miscCommand(...a);
const handleHeart = (...a) => require('./commands/misc').handleHeart(...a);
const animeCommand = (...a) => require('./commands/anime').animeCommand(...a);
const piesCommand = (...a) => require('./commands/pies').piesCommand(...a);
const piesAlias = (...a) => require('./commands/pies').piesAlias(...a);
const stickercropCommand = (...a) => require('./commands/stickercrop')(...a);
const updateCommand = (...a) => require('./commands/update')(...a);
const igsCommand = (...a) => require('./commands/igs').igsCommand(...a);
const { anticallCommand, readState: readAnticallState } = require('./commands/anticall');
const { pmblockerCommand, readState: readPmBlockerState } = require('./commands/pmblocker');
const settingsCommand = (...a) => require('./commands/settings')(...a);

// Global settings
global.packname = settings.packname;
global.author = settings.author;
global.channelLink = settings.channelLink;
global.ytch = settings.botName;

// Add this near the top of main.js with other global configurations
const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        
    }
};


// Dedicated Elite API handlers (each command owns its endpoint contract).
const gptCommand = require('./commands/gpt');
const geminiCommand = require('./commands/gemini');
const asyntaiCommand = require('./commands/asyntai');
const talkaiCommand = require('./commands/talkai');
const notegptCommand = require('./commands/notegpt');
const storyCommand = require('./commands/story');
const imagineCommand = require('./commands/imagine');
const zoneraiCommand = require('./commands/zonerai');
const pollinationaiCommand = require('./commands/pollinationai');
const mathgptCommand = require('./commands/mathgpt');
const deepseekCommand = require('./commands/deepseek');
const airmoreCommand = require('./commands/airmore');
const insultApiCommand = require('./commands/insultapi');
const lighteffectsCommand = require('./commands/lighteffects');
const effectcloudsCommand = require('./commands/effectclouds');
const galaxywallpaperCommand = require('./commands/galaxywallpaper');
const cartoonstyleCommand = require('./commands/cartoonstyle');
const writetextCommand = require('./commands/writetext');
const imageaiCommand = require('./commands/imageai');
const xdownloadCommand = require('./commands/xdownload');
const aio3downloadCommand = require('./commands/aio3download');
const spotifydlCommand = require('./commands/spotifydl');
const facebookdlCommand = require('./commands/facebookdl');
const mediafiredlCommand = require('./commands/mediafiredl');

const { send: adeelSend } = require('./lib/adeelApi');
const featureBridge = require('./lib/featureBridge');
const extraTools = require('./commands/extra-tools');
const qadeerBridge = require('./qadeer/bridge');

// Silent drops are easy to miss (the reaction still appears). Say why in the console, at most once a minute per reason.
const __dropSeen = new Map();
function dropNote(reason) {
    const now = Date.now();
    if (now - (__dropSeen.get(reason) || 0) < 60000) return;
    __dropSeen.set(reason, now);
    console.log('[command skipped] ' + reason);
}

async function handleMessages(sock, messageUpdate, printLog) {
    try {
        const { messages, type } = messageUpdate || {};
        // WhatsApp/Baileys can emit the owner's own sent messages as `append`
        // (not only `notify`). Process append only for fromMe messages so that
        // commands sent from the linked phone, including .menu, still execute.
        const message = Array.isArray(messages) ? messages[0] : null;
        if (!message?.message) return;
        if (type !== 'notify' && !(type === 'append' && message.key?.fromMe)) return;

        // Prevent the same message being executed twice if Baileys emits it
        // through both event paths.
        if (!global.__raufProcessedMessageIds) global.__raufProcessedMessageIds = new Set();
        const messageId = message.key?.id ? `${sock.__sessionKey || 'main'}:${message.key.id}` : null;
        if (messageId && global.__raufProcessedMessageIds.has(messageId)) return;
        if (messageId) {
            global.__raufProcessedMessageIds.add(messageId);
            if (global.__raufProcessedMessageIds.size > 2000) {
                const oldest = global.__raufProcessedMessageIds.values().next().value;
                global.__raufProcessedMessageIds.delete(oldest);
            }
        }

        if (!message?.message) return;

        // Auto-read and reactions run in the background so the command itself is never delayed by them.
        (async () => {
            try {
                await handleAutoread(sock, message);
                let cmdReacted = false;
                if (message.key?.remoteJid !== 'status@broadcast' && !message.message?.protocolMessage) {
                    cmdReacted = await require('./lib/commandReact').react(sock, message);
                }
                if (!cmdReacted && !message.key?.fromMe && message.key?.remoteJid !== 'status@broadcast' && !message.message?.protocolMessage) {
                    await addCommandReaction(sock, message);
                }
            } catch (_) {}
        })();

        // Store message for RAUF × LUCIFER MD BOT antidelete handlers.
        if (message.message) {
            storeMessage(sock, message);
        }

        // Handle message revocation in the active command handlers.
        if (message.message?.protocolMessage?.type === 0) {
            // Single handler only: antidelete_plus used the same config file and sent a 2nd report.
            await handleMessageRevocation(sock, message);
            return;
        }

        const chatId = message.key.remoteJid;
        const senderId = [message.key.participantAlt, message.key.remoteJidAlt, message.key.participant, message.key.remoteJid].find(v => typeof v === 'string' && v.endsWith('@s.whatsapp.net')) || message.key.participant || message.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        // Additional group safety rules (slowmode/anti-spam/media/link controls).
        extraTools.handleIncoming(sock, message).catch(() => {});      // moderation runs beside the command, it must not delay it
        // LuciferX passive features: XP / levels, AFK replies, quiz answers.
        require('./commands/luciferx').trackIncoming(sock, message).catch(() => {});
        const senderIsSudo = await isSudo(senderId);
        // `fromMe` is authoritative: commands sent from the paired WhatsApp account are owner-originated
        // in private chats and groups even when the remote JID is a group or a LID/PN alternate.
        const senderIsOwnerOrSudo = !!message.key?.fromMe || await isOwnerOrSudo(senderId, sock, chatId);

        // Handle button responses
        if (message.message?.buttonsResponseMessage) {
            const buttonId = message.message.buttonsResponseMessage.selectedButtonId;
            const chatId = message.key.remoteJid;

            if (buttonId === 'channel') {
                await sock.sendMessage(chatId, {
                    text: `📢 *OFFICIAL CHANNEL — RAUF × LUCIFER MD BOT 👑*\nFollow the RAUF × LUCIFER MD BOT 👑 channel on WhatsApp\n${settings.channelLink}\n\n💫 *OFFICIAL GROUP*\n${settings.groupLink}`
                }, { quoted: message });
                return;
            } else if (buttonId === 'owner') {
                const ownerCommand = require('./commands/owner');
                await ownerCommand(sock, chatId);
                return;
            } else if (buttonId === 'support') {
                await sock.sendMessage(chatId, {
                    text: settings.groupLink ? `💫 *RAUF × LUCIFER MD BOT OFFICIAL GROUP*\n${settings.groupLink}` : '💫 Official group invite link has not been configured yet.'
                }, { quoted: message });
                return;
            }
        }

        const userMessage = require('./lib/prefix').normalize((
            message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            message.message?.buttonsResponseMessage?.selectedButtonId?.trim() ||
            ''
        ).toLowerCase().replace(/\.\s+/g, '.').trim());

        // Preserve raw message for commands like .tag that need original casing
        const rawText = require('./lib/prefix').normalize(message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            '');

        // Only log command usage
        if (userMessage.startsWith('.')) {
            console.log(`📝 Command used in ${isGroup ? 'group' : 'private'}: ${userMessage}`);
        }
        // Read bot mode once; don't early-return so moderation can still run in private mode
        let isPublic = true;
        try {
            const data = require('./lib/modeCache').read();   // cached: no file read + JSON parse on every message
            if (typeof data.isPublic === 'boolean') isPublic = data.isPublic;
        } catch (error) {
            console.error('Error checking access mode:', error);
            // default isPublic=true on error
        }
        const isOwnerOrSudoCheck = senderIsOwnerOrSudo;

        // ── Global bot switch: .boton / .botoff (owner only). While OFF the bot ignores everything,
        // including the owner's other commands, until the owner sends .boton again.
        {
            const botSwitch = require('./lib/botSwitch');
            const switchAction = botSwitch.parse(userMessage);
            if (switchAction) {
                const isRealOwner = !!message.key?.fromMe || (senderIsOwnerOrSudo && !senderIsSudo);
                if (!isRealOwner) {
                    if (botSwitch.isOn()) await sock.sendMessage(chatId, { text: '❌ Only the owner can use this command.' }, { quoted: message });
                    return;
                }
                const turnOn = switchAction === 'on';
                if (botSwitch.isOn() === turnOn) {
                    await sock.sendMessage(chatId, { text: turnOn ? '✅ Bot is already *ON*.' : '🔴 Bot is already *OFF*. Send *.boton* to turn it on.' }, { quoted: message });
                } else {
                    botSwitch.setOn(turnOn);
                    await sock.sendMessage(chatId, { text: turnOn ? '🟢 *RAUF × LUCIFER MD BOT is now ON.* All commands are active again.' : '🔴 *RAUF × LUCIFER MD BOT is now OFF.* No command will work until you send *.boton*.' }, { quoted: message });
                }
                return;
            }
            if (!botSwitch.isOn()) { dropNote('bot switch is OFF (send .boton from the owner number)'); return; }
        }

        // ── Official group link: .support / .botgroup / .joingroup ... (anyone)
        {
            const ol = require('./lib/officialLinks');
            if (ol.isCommand(userMessage)) {
                await ol.reply(sock, chatId, message);
                return;
            }
        }

        // ── .online on|off|status (owner/sudo only) — always-online switch, see lib/onlineMode.js
        {
            const onlineMode = require('./lib/onlineMode');
            const om = onlineMode.parseCommand(userMessage);
            if (om) {
                if (!senderIsOwnerOrSudo) {
                    await sock.sendMessage(chatId, { text: '❌ Only the owner can use this command.' }, { quoted: message });
                    return;
                }
                await sock.sendMessage(chatId, { text: await onlineMode.runCommand(sock, om) }, { quoted: message });
                return;
            }
        }

        // ── .card on|off and .errors (owner/sudo only) — troubleshooting helpers
        {
            const gc = require('./lib/globalCard');
            const el = require('./lib/errorLog');
            const cardArg = gc.parseCommand(userMessage);
            const errArg = cardArg ? null : el.parseCommand(userMessage);
            if (cardArg || errArg) {
                if (!senderIsOwnerOrSudo) {
                    await sock.sendMessage(chatId, { text: '❌ Only the owner can use this command.' }, { quoted: message });
                    return;
                }
                await sock.sendMessage(chatId, { text: cardArg ? gc.runCommand(cardArg) : el.runCommand(errArg) }, { quoted: message });
                return;
            }
        }

        // ── .cmdreact on|off (owner/sudo only) — see lib/commandReact.js
        {
            const cr = require('./lib/commandReact');
            const crCmd = cr.parseCommand(userMessage);
            if (crCmd) {
                if (!senderIsOwnerOrSudo) {
                    await sock.sendMessage(chatId, { text: '❌ Only the owner can use this command.' }, { quoted: message });
                    return;
                }
                await sock.sendMessage(chatId, { text: cr.runCommand(crCmd) }, { quoted: message });
                return;
            }
        }

        // ── .autoreply / .mentionreply (owner/sudo only) — see lib/autoReply.js
        {
            const autoReply = require('./lib/autoReply');
            const ar = autoReply.parseCommand(userMessage);
            if (ar) {
                if (!senderIsOwnerOrSudo) {
                    await sock.sendMessage(chatId, { text: '❌ Only the owner can use this command.' }, { quoted: message });
                    return;
                }
                await sock.sendMessage(chatId, { text: autoReply.runCommand(ar) }, { quoted: message });
                return;
            }
        }

        // ── .aikey <groq key> | status | remove (owner/sudo only) — key used for voice messages to AI, see lib/aiSession.js
        {
            const aiSession = require('./lib/aiSession');
            const ak = aiSession.parseCommand(rawText);
            if (ak) {
                if (!senderIsOwnerOrSudo) {
                    await sock.sendMessage(chatId, { text: '❌ Only the owner can use this command.' }, { quoted: message });
                    return;
                }
                await sock.sendMessage(chatId, { text: await aiSession.runCommand(sock, message, ak) }, { quoted: message });
                return;
            }
        }

        // ── Owner customisation: .setownername / .setbotname / .setpackname / .setauthor / .setbotimage / .resetbotimage
        {
            const ownerSettings = require('./commands/ownerSettings');
            const os = ownerSettings.parse(rawText);
            if (os) {
                if (!senderIsOwnerOrSudo) {
                    await sock.sendMessage(chatId, { text: '❌ This command is only available for the owner or sudo!' }, { quoted: message });
                    return;
                }
                await ownerSettings.handle(sock, chatId, message, os);
                return;
            }
        }

        // ── Anti-Bot: if enabled for this group, remove messages that look like another
        // bot's command menu (heuristic, rule-based — see lib/antibot.js for the scoring).
        if (isGroup && !message.key.fromMe) {
            try {
                const antibot = require('./lib/antibot');
                if (antibot.isEnabled(chatId) && antibot.looksLikeBotMenu(rawText)) {
                    const adminStatus = await isAdmin(sock, chatId, [message.key.participantAlt, message.key.remoteJidAlt, message.key.participant, senderId]);
                    if (adminStatus.isBotAdmin) {
                        await sock.sendMessage(chatId, { delete: message.key });
                        return;
                    }
                }
            } catch (e) { console.error('[antibot]', e.message); }
        }
        // Check if user is banned (skip ban check for unban command)
        if (isBanned(senderId) && !userMessage.startsWith('.unban')) {
            dropNote('sender is banned (owner: .unban)');
            // Only respond occasionally to avoid spam
            if (Math.random() < 0.1) {
                await sock.sendMessage(chatId, {
                    text: '❌ You are banned from using the bot. Contact an admin to get unbanned.',
                    ...channelInfo
                });
            }
            return;
        }

        // First check if it's a game move
        if (/^[1-9]$/.test(userMessage) || userMessage.toLowerCase() === 'surrender') {
            await handleTicTacToeMove(sock, chatId, senderId, userMessage);
            return;
        }

        /*  // Basic message response in private chat
          if (!isGroup && (userMessage === 'hi' || userMessage === 'hello' || userMessage === 'bot' || userMessage === 'hlo' || userMessage === 'hey' || userMessage === 'bro')) {
              await sock.sendMessage(chatId, {
                  text: 'Hi, How can I help you?\nYou can use .menu for more info and commands.',
                  ...channelInfo
              });
              return;
          } */

        if (!message.key.fromMe) incrementMessageCount(chatId, senderId);

        // Check for bad words and antilink FIRST, before ANY other processing
        // Always run moderation in groups, regardless of mode
        if (isGroup) {
            if (userMessage) {
                await handleBadwordDetection(sock, chatId, message, userMessage, senderId);
            }
            // Antilink checks message text internally, so run it even if userMessage is empty
            await Antilink(message, sock);
        }

        // PM blocker: block non-owner DMs when enabled (do not ban)
        if (!isGroup && !message.key.fromMe && !senderIsSudo) {
            try {
                const pmState = readPmBlockerState();
                if (pmState.enabled) {
                    // Inform user, delay, then block without banning globally
                    await sock.sendMessage(chatId, { text: pmState.message || 'Private messages are blocked. Please contact the owner in groups only.' });
                    await new Promise(r => setTimeout(r, 1500));
                    try { await sock.updateBlockStatus(chatId, 'block'); } catch (e) { }
                    return;
                }
            } catch (e) { }
        }

        // Then check for command prefix
        if (!userMessage.startsWith('.')) {
            if (/^\u200b\./.test(userMessage)) dropNote('command ignored: the command prefix is "' + require('./lib/prefix').get() + '" (use that, or owner: .setprefix .)');
            // Show typing indicator if autotyping is enabled
            await handleAutotypingForMessage(sock, chatId, userMessage);

            // "group link" typed in a private chat -> official group link
            if (!isGroup && !message.key?.fromMe && require('./lib/officialLinks').isNaturalRequest(rawText)) {
                await require('./lib/officialLinks').reply(sock, chatId, message);
                return;
            }

            // Reply to any AI answer (text or voice) -> that AI continues the chat, no command needed (lib/aiSession.js)
            if (isPublic || isOwnerOrSudoCheck) {
                try { if (await require('./lib/aiSession').handleReply(sock, message, { rawText })) return; }
                catch (e) { console.error('[ai-session]', e?.message || e); }
            }

            // AI auto-reply / mention-reply (never answers the bot's own messages)
            let aiMentionHandled = false;
            try {
                aiMentionHandled = await require('./lib/autoReply').handleIncoming(sock, message, {
                    isGroup, text: rawText, allowed: isPublic || isOwnerOrSudoCheck
                });
            } catch (e) { console.error('[autoReply hook]', e?.message || e); }

            if (isGroup) {
                // Always run moderation features (antitag) regardless of mode
                await handleTagDetection(sock, chatId, message, senderId);
                if (!aiMentionHandled) await handleMentionDetection(sock, chatId, message);

            }
            return;
        }
        // In private mode, only owner/sudo can run commands
        if (!isPublic && !isOwnerOrSudoCheck) {
            dropNote('mode is PRIVATE and the sender is not an owner/sudo (owner: send .public)');
            return;
        }

        // List of admin commands
        const adminCommands = ['.mute', '.unmute', '.ban', '.unban', '.promote', '.demote', '.kick', '.tagall', '.tagnotadmin', '.hidetag', '.antilink', '.antitag', '.setgdesc', '.setgname', '.setgpp'];
        const isAdminCommand = adminCommands.some(cmd => userMessage.startsWith(cmd));

        // List of owner commands
        const ownerCommands = ['.setprefix', '.prefix', '.settelegram', '.setwebsite', '.mode', '.autostatus', '.antidelete', '.cleartmp', '.setpp', '.setownername', '.setbotname', '.setbotimage', '.clearsession', '.areact', '.autoreact', '.autotyping', '.autoread', '.pmblocker', '.leave', '.left'];
        const isOwnerCommand = ownerCommands.some(cmd => userMessage === cmd || userMessage.startsWith(cmd + ' '));

        let isSenderAdmin = false;
        let isBotAdmin = false;

        // Check admin status only for admin commands in groups
        if (isGroup && isAdminCommand) {
            const adminStatus = await isAdmin(sock, chatId, [message.key.participantAlt, message.key.remoteJidAlt, message.key.participant, senderId]);
            isSenderAdmin = adminStatus.isSenderAdmin;
            isBotAdmin = adminStatus.isBotAdmin;

            if (!isBotAdmin) {
                await sock.sendMessage(chatId, { text: 'Please make the bot an admin to use admin commands.', ...channelInfo }, { quoted: message });
                return;
            }

            if (
                userMessage.startsWith('.mute') ||
                userMessage === '.unmute' ||
                userMessage.startsWith('.ban') ||
                userMessage.startsWith('.unban') ||
                userMessage.startsWith('.promote') ||
                userMessage.startsWith('.demote')
            ) {
                if (!isSenderAdmin && !message.key.fromMe) {
                    await sock.sendMessage(chatId, {
                        text: 'Sorry, only group admins can use this command.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
            }
        }

        // Check owner status for owner commands
        if (isOwnerCommand) {
            if (!senderIsOwnerOrSudo) {
                await sock.sendMessage(chatId, { text: '❌ This command is only available for the owner or sudo!' }, { quoted: message });
                return;
            }
        }

        // Additional command modules (commands/flashmd) are loaded once into the same dispatcher.
        // Native commands keep priority; these modules only fill commands that are not handled natively.
        await require('./lib/commandRegistry').loadFlashCommands();
        const flashMatch = userMessage.match(/^\.([a-z0-9_-]+)(?:\s+([\s\S]*))?$/i);
        if (flashMatch && !['help'].includes(flashMatch[1].toLowerCase())) {
            const flashItem = global.__kobFlashCommandRegistry.get(flashMatch[1].toLowerCase());
            if (flashItem && typeof flashItem.execute === 'function') {
                const flashName = String(flashItem.name || '').toLowerCase();
                const flashOwnerOnly = flashItem.ownerOnly || ['eval', 'eval2', 'exec', 'exec-help', 'sudo'].includes(flashName);
                const flashPrivileged = senderIsOwnerOrSudo || !!message.key?.fromMe;
                if (flashOwnerOnly && !flashPrivileged) {
                    await sock.sendMessage(chatId, { text: '❌ This command is only available for the owner or sudo!' }, { quoted: message });
                    return;
                }
                if (flashItem.groupOnly && !isGroup) {
                    await sock.sendMessage(chatId, { text: '❌ This command only works in groups.' }, { quoted: message });
                    return;
                }
                if (flashItem.adminOnly && !(isSenderAdmin || flashPrivileged)) {
                    await sock.sendMessage(chatId, { text: '❌ Only group admins can use this command.' }, { quoted: message });
                    return;
                }
                try {
                    const flashCommandsMap = new Map();
                    for (const [n, item] of global.__kobFlashCommandRegistry) flashCommandsMap.set(n, item);
                    await flashItem.execute({
                        sock, from: chatId, msg: message, text: flashMatch[2] || '',
                        commands: flashCommandsMap, auteurMessage: senderId,
                        nomAuteurMessage: message.pushName || senderId, isGroup, senderId,
                        prefix: '.', args: (flashMatch[2] || '').trim().split(/\s+/).filter(Boolean)
                    });
                    return;
                } catch (flashExecError) {
                    console.error('[Additional command]', flashMatch[1], flashExecError.message);
                    await sock.sendMessage(chatId, { text: `❌ ${flashMatch[1]} command failed: ${String(flashExecError.message || 'API unavailable').slice(0,180)}` }, { quoted: message });
                    return;
                }
            }
        }

        // Command handlers - Execute commands immediately without waiting for typing indicator
        // We'll show typing indicator after command execution if needed
        let commandExecuted = false;

        // Additional aliases are handled by the shared command router.
        if (/^\.[a-z0-9_-]+(?:\s|$)/i.test(userMessage)) {
            try {
                const { runV2 } = require('./lib/newMenuV2Bridge');
                const handledV2 = await runV2({
                    sock, chatId, message, senderIsOwner: senderIsOwnerOrSudo || message.key.fromMe,
                    senderIsAdmin: isSenderAdmin || senderIsOwnerOrSudo || message.key.fromMe,
                    isGroup, userId: senderId
                });
                if (handledV2) return;
            } catch (v2Error) {
                console.error('[Command alias]', v2Error);
                await sock.sendMessage(chatId, { text: 'Command failed. Check hosting logs and required API configuration.' }, { quoted: message });
                return;
            }
        }

        switch (true) {
            case await qadeerBridge.handleQadeerCommand(sock, message, { isOwner: senderIsOwnerOrSudo, isSudo: senderIsSudo }): {
                commandExecuted = true;
                break;
            }
            case await extraTools.handleExtraCommand(sock, message, { isOwner: senderIsOwnerOrSudo, isSudo: senderIsSudo }): {
                commandExecuted = true;
                break;
            }
            case await require('./commands/groupplus').handleGroupPlus(sock, message, { isOwner: senderIsOwnerOrSudo, isSudo: senderIsSudo }): {
                commandExecuted = true;
                break;
            }
            case await require('./commands/broadcastglobal').handleBroadcastGlobal(sock, message): {
                commandExecuted = true;
                break;
            }
            case await require('./commands/luciferx').handleLuciferX(sock, message, { isOwner: senderIsOwnerOrSudo, isSudo: senderIsSudo }): {
                commandExecuted = true;
                break;
            }
            case /^\.(gpt|chatgpt|gemini|asyntai|talkai|notegpt|story|imagine|zonerai|pollinationai|mathgpt|deepseek|deepseekai|airmore|voicelist|insultapi|lighteffects|effectclouds|galaxywallpaper|cartoonstyle|writetext|imageai|xdl|aio3|spotifydl|facebookdl|mediafiredl)(?:\s|$)/i.test(userMessage): {
                const [rawCommand, ...rest] = userMessage.trim().split(/\s+/);
                const cmd = rawCommand.slice(1).toLowerCase();
                const input = rest.join(' ');
                const routes = {
                  gpt:gptCommand, chatgpt:gptCommand, gemini:geminiCommand, asyntai:asyntaiCommand, talkai:talkaiCommand, notegpt:notegptCommand,
                  story:storyCommand, imagine:imagineCommand, zonerai:zoneraiCommand,
                  pollinationai:pollinationaiCommand, mathgpt:mathgptCommand,
                  deepseek:deepseekCommand, deepseekai:deepseekCommand,
                  airmore:airmoreCommand, voicelist: (sock, chatId, message) => airmoreCommand(sock, chatId, message, 'list'),
                  insultapi:insultApiCommand, lighteffects:lighteffectsCommand, effectclouds:effectcloudsCommand,
                  galaxywallpaper:galaxywallpaperCommand, cartoonstyle:cartoonstyleCommand,
                  writetext:writetextCommand, imageai:imageaiCommand, xdl:xdownloadCommand,
                  aio3:aio3downloadCommand, spotifydl:spotifydlCommand, facebookdl:facebookdlCommand,
                  mediafiredl:mediafiredlCommand
                };
                try { await routes[cmd](sock, chatId, message, input); }
                catch (e) {
                  console.error(`[KING API] ${cmd}:`, e?.message || e);
                  await sock.sendMessage(chatId, { text: `❌ ${cmd} API request failed: ${String(e?.message || 'Provider unavailable').slice(0,220)}\nPlease check the input and try again.` }, { quoted: message });
                }
                commandExecuted = true;
                break;
            }
            case /^\.(ytdl|ytmp3|ytmp4|teraboxdl|twitterdl|igdl|fbdl|ttdl|tiktokv2|ytmp4v2|spotifydl|pinterestvideo|pinvid|viralvideo|pinterestphoto|pinphoto|printrest|capcut|mediafire|sinhalasub|aptoide|tweet|ssweb|getpastebin|googlesearch|duckduckgo|ytsearch|searchgroups|randommeme|web2zip|translate|qrcodegenerator|welcomegoodbyeimage|welcome|qc|genshinbuild|cuaca|cekkhodam|kompasnews|detiknews|tahukahkamu)(?:\s|$)/i.test(userMessage): {
                const parts = userMessage.trim().split(/\s+/);
                const name = parts[0].slice(1).toLowerCase();
                const aliases = {pinvid:'pinterestvideo',pinphoto:'pinterestphoto',printrest:'pinterestphoto',welcome:'welcomegoodbyeimage',terabox:'teraboxdl'};
                const apiName = aliases[name] || name;
                const arg = parts.slice(1).join(' ').trim();
                try {
                    // Route YouTube commands to their dedicated multi-provider pipelines.
                    // The generic Adeel API route was intercepting .ytmp4/.ytmp3 first,
                    // so a provider HTTP 402 could prevent the native fallback chain.
                    if (apiName === 'ytmp3') {
                        await songCommand(sock, chatId, message);
                    } else if (apiName === 'ytmp4') {
                        await videoCommand(sock, chatId, message);
                    } else {
                        await adeelSend(sock, chatId, message, apiName, arg);
                    }
                } catch (e) {
                    console.error(`[RAUF API] ${apiName}:`, e.message);
                    if (apiName === 'ytmp3') {
                        try {
                            // Use the bot's existing YouTube audio pipeline if the supplied fallback endpoint fails.
                            await songCommand(sock, chatId, message);
                        } catch (fallbackError) {
                            console.error('[YTMP3 fallback]', fallbackError?.message || fallbackError);
                            await sock.sendMessage(chatId, { text: '❌ YouTube MP3 download failed on both the API and built-in fallback. Check the link and try again later.' }, { quoted: message });
                        }
                    } else {
                        const detail = String(e?.message || 'Unknown error').slice(0, 350);
                        await sock.sendMessage(chatId,{text: `❌ ${apiName} failed: ${String(e?.message || 'API unavailable').slice(0, 180)}\n\nCheck the link or try again later.`},{quoted:message});
                    }
                }
                commandExecuted = true;
                break;
            }
            case userMessage === '.simage': {
                const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                if (quotedMessage?.stickerMessage) {
                    await simageCommand(sock, quotedMessage, chatId);
                } else {
                    await sock.sendMessage(chatId, { text: 'Please reply to a sticker with the .simage command to convert it.', ...channelInfo }, { quoted: message });
                }
                commandExecuted = true;
                break;
            }
            case userMessage.startsWith('.kick'):
                const mentionedJidListKick = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await kickCommand(sock, chatId, senderId, mentionedJidListKick, message);
                break;
            case userMessage.startsWith('.mute'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const muteArg = parts[1];
                    const muteDuration = muteArg !== undefined ? parseInt(muteArg, 10) : undefined;
                    if (muteArg !== undefined && (isNaN(muteDuration) || muteDuration <= 0)) {
                        await sock.sendMessage(chatId, { text: 'Please provide a valid number of minutes or use .mute with no number to mute immediately.', ...channelInfo }, { quoted: message });
                    } else {
                        await muteCommand(sock, chatId, senderId, message, muteDuration);
                    }
                }
                break;
            case userMessage === '.unmute':
                await unmuteCommand(sock, chatId, senderId);
                break;
            case userMessage.startsWith('.ban'):
                if (!isGroup) {
                    if (!message.key.fromMe && !senderIsSudo) {
                        await sock.sendMessage(chatId, { text: 'Only owner/sudo can use .ban in private chat.' }, { quoted: message });
                        break;
                    }
                }
                await banCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.unban'):
                if (!isGroup) {
                    if (!message.key.fromMe && !senderIsSudo) {
                        await sock.sendMessage(chatId, { text: 'Only owner/sudo can use .unban in private chat.' }, { quoted: message });
                        break;
                    }
                }
                await unbanCommand(sock, chatId, message);
                break;
            case userMessage === '.resetintro': {
                if (!senderIsOwnerOrSudo && !message.key.fromMe) {
                    await sock.sendMessage(chatId, { text: '❌ Owner only command.' }, { quoted: message });
                    break;
                }
                try {
                    const introPath = path.join(process.cwd(), 'data', 'owner-intros.json');
                    let state = { groups: [] };
                    try { state = JSON.parse(fs.readFileSync(introPath, 'utf8')); } catch (e) {}
                    if (!Array.isArray(state.groups)) state.groups = [];
                    const before = state.groups.length;
                    state.groups = state.groups.filter(g => g !== chatId);
                    if (state.bots && typeof state.bots === 'object') for (const k of Object.keys(state.bots)) state.bots[k] = (state.bots[k] || []).filter(g => g !== chatId);
                    fs.writeFileSync(introPath, JSON.stringify(state, null, 2));
                    try { require('./lib/sentOnce').release(`group:${sock.__sessionKey || sock.__ownerNumber || 'main'}:${chatId}`); } catch (_) {}
                    await sock.sendMessage(chatId, { text: true ? '✅ Intro reset for this group — it will be sent again the next time the bot or owner joins.' : 'ℹ️ No intro record was stored for this group yet.' }, { quoted: message });
                } catch (e) {
                    await sock.sendMessage(chatId, { text: `❌ Could not reset: ${e.message}` }, { quoted: message });
                }
                commandExecuted = true;
                break;
            }
            case userMessage === '.help' || userMessage === '.menu' || userMessage === '.menu2' || userMessage === '.bot' || userMessage === '.list':
                await helpCommand(sock, chatId, message, global.channelLink);
                commandExecuted = true;
                break;
            case userMessage === '.sticker' || userMessage === '.s':
                await stickerCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.warnings'):
                const mentionedJidListWarnings = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await warningsCommand(sock, chatId, mentionedJidListWarnings);
                break;
            case userMessage.startsWith('.warn'):
                const mentionedJidListWarn = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await warnCommand(sock, chatId, senderId, mentionedJidListWarn, message);
                break;
            case userMessage.startsWith('.tts'):
                const text = userMessage.slice(4).trim();
                await ttsCommand(sock, chatId, text, message);
                break;
            case userMessage.startsWith('.delete') || userMessage.startsWith('.del'):
                await deleteCommand(sock, chatId, message, senderId);
                break;
            case userMessage.startsWith('.attp'):
                await attpCommand(sock, chatId, message);
                break;

            case userMessage === '.settings':
                await settingsCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.mode'):
                // Check if sender is the owner
                if (!senderIsOwnerOrSudo) {
                    await sock.sendMessage(chatId, { text: 'Only bot owner can use this command!', ...channelInfo }, { quoted: message });
                    return;
                }
                // Read current data first
                let data;
                try {
                    data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
                } catch (error) {
                    console.error('Error reading access mode:', error);
                    await sock.sendMessage(chatId, { text: 'Failed to read bot mode status', ...channelInfo });
                    return;
                }

                const action = userMessage.split(' ')[1]?.toLowerCase();
                // If no argument provided, show current status
                if (!action) {
                    const currentMode = data.isPublic ? 'public' : 'private';
                    await sock.sendMessage(chatId, {
                        text: `Current bot mode: *${currentMode}*\n\nUsage: .mode public/private\n\nExample:\n.mode public - Allow everyone to use bot\n.mode private - Restrict to owner only`,
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }

                if (action !== 'public' && action !== 'private') {
                    await sock.sendMessage(chatId, {
                        text: 'Usage: .mode public/private\n\nExample:\n.mode public - Allow everyone to use bot\n.mode private - Restrict to owner only',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }

                try {
                    // Update access mode
                    data.isPublic = action === 'public';

                    // Save updated data
                    fs.writeFileSync('./data/messageCount.json', JSON.stringify(data, null, 2));

                    await sock.sendMessage(chatId, { text: `Bot is now in *${action}* mode`, ...channelInfo });
                } catch (error) {
                    console.error('Error updating access mode:', error);
                    await sock.sendMessage(chatId, { text: 'Failed to update bot access mode', ...channelInfo });
                }
                break;
            case userMessage === '.truecaller' || userMessage.startsWith('.truecaller '):
                if (!senderIsOwnerOrSudo) {
                    await sock.sendMessage(chatId, { text: 'Only owner/sudo can use .truecaller.' }, { quoted: message });
                    break;
                }
                await require('./commands/truecaller').truecallerCommand(sock, chatId, message, rawText.split(/\s+/).slice(1).join(' '));
                break;
            case userMessage.startsWith('.anticall'):
                if (!senderIsOwnerOrSudo) {
                    await sock.sendMessage(chatId, { text: 'Only owner/sudo can use anticall.' }, { quoted: message });
                    break;
                }
                {
                    const args = rawText.split(/\s+/).slice(1).join(' ');   // raw text so a custom message keeps its capital letters
                    await anticallCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.pmblocker'):
                {
                    const args = userMessage.split(' ').slice(1).join(' ');
                    await pmblockerCommand(sock, chatId, message, args);
                }
                commandExecuted = true;
                break;
            case userMessage === '.owner':
                await ownerCommand(sock, chatId);
                break;
            case userMessage === '.tagall':
                await tagAllCommand(sock, chatId, senderId, message);
                break;
            case userMessage === '.tagnotadmin':
                await tagNotAdminCommand(sock, chatId, senderId, message);
                break;
            case userMessage.startsWith('.hidetag'):
                {
                    const messageText = rawText.slice(8).trim();
                    const replyMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
                    await hideTagCommand(sock, chatId, senderId, messageText, replyMessage, message);
                }
                break;
            case userMessage.startsWith('.tag'):
                const messageText = rawText.slice(4).trim();  // use rawText here, not userMessage
                const replyMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
                await tagCommand(sock, chatId, senderId, messageText, replyMessage, message);
                break;
            case userMessage.startsWith('.antilink'):
                if (!isGroup) {
                    await sock.sendMessage(chatId, {
                        text: 'This command can only be used in groups.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, {
                        text: 'Please make the bot an admin first.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                await handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                break;
            case userMessage.startsWith('.antitag'):
                if (!isGroup) {
                    await sock.sendMessage(chatId, {
                        text: 'This command can only be used in groups.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, {
                        text: 'Please make the bot an admin first.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                await handleAntitagCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                break;
            case userMessage === '.meme':
                await memeCommand(sock, chatId, message);
                break;
            case userMessage === '.joke':
                await jokeCommand(sock, chatId, message);
                break;
            case userMessage === '.quote':
                await quoteCommand(sock, chatId, message);
                break;
            case userMessage === '.fact':
                await factCommand(sock, chatId, message, message);
                break;
            case userMessage.startsWith('.weather'):
                const city = userMessage.slice(9).trim();
                if (city) {
                    await weatherCommand(sock, chatId, message, city);
                } else {
                    await sock.sendMessage(chatId, { text: 'Please specify a city, e.g., .weather London', ...channelInfo }, { quoted: message });
                }
                break;
            case userMessage === '.news':
                await newsCommand(sock, chatId);
                break;
            case userMessage.startsWith('.ttt') || userMessage.startsWith('.tictactoe'):
                const tttText = userMessage.split(' ').slice(1).join(' ');
                await tictactoeCommand(sock, chatId, senderId, tttText);
                break;
            case userMessage.startsWith('.move'):
                const position = parseInt(userMessage.split(' ')[1]);
                if (isNaN(position)) {
                    await sock.sendMessage(chatId, { text: 'Please provide a valid position number for Tic-Tac-Toe move.', ...channelInfo }, { quoted: message });
                } else {
                    await handleTicTacToeMove(sock, chatId, senderId, String(position));
                }
                break;
            case userMessage === '.topmembers':
                topMembers(sock, chatId, isGroup);
                break;
            case userMessage.startsWith('.hangman'):
                startHangman(sock, chatId);
                break;
            case userMessage.startsWith('.guess'):
                const guessedLetter = userMessage.split(' ')[1];
                if (guessedLetter) {
                    guessLetter(sock, chatId, guessedLetter);
                } else {
                    sock.sendMessage(chatId, { text: 'Please guess a letter using .guess <letter>', ...channelInfo }, { quoted: message });
                }
                break;
            case userMessage.startsWith('.trivia'):
                startTrivia(sock, chatId);
                break;
            case userMessage.startsWith('.answer'):
                const answer = userMessage.split(' ').slice(1).join(' ');
                if (answer) {
                    answerTrivia(sock, chatId, answer);
                } else {
                    sock.sendMessage(chatId, { text: 'Please provide an answer using .answer <answer>', ...channelInfo }, { quoted: message });
                }
                break;
            case userMessage.startsWith('.compliment'):
                await complimentCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.insult'):
                await insultCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.8ball'):
                const question = userMessage.split(' ').slice(1).join(' ');
                await eightBallCommand(sock, chatId, question);
                break;
            case userMessage.startsWith('.lyrics'):
                const songTitle = userMessage.split(' ').slice(1).join(' ');
                await lyricsCommand(sock, chatId, songTitle, message);
                break;
            case userMessage.startsWith('.simp'):
                const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await simpCommand(sock, chatId, quotedMsg, mentionedJid, senderId);
                break;
            case userMessage.startsWith('.stupid') || userMessage.startsWith('.itssostupid') || userMessage.startsWith('.iss'):
                const stupidQuotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const stupidMentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                const stupidArgs = userMessage.split(' ').slice(1);
                await stupidCommand(sock, chatId, stupidQuotedMsg, stupidMentionedJid, senderId, stupidArgs);
                break;
            case userMessage === '.dare':
                await dareCommand(sock, chatId, message);
                break;
            case userMessage === '.truth':
                await truthCommand(sock, chatId, message);
                break;
            case userMessage === '.clear':
                if (isGroup) await clearCommand(sock, chatId);
                break;
            case userMessage.startsWith('.promote'):
                const mentionedJidListPromote = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await promoteCommand(sock, chatId, mentionedJidListPromote, message);
                break;
            case userMessage.startsWith('.demote'):
                const mentionedJidListDemote = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await demoteCommand(sock, chatId, mentionedJidListDemote, message);
                break;
            case userMessage === '.ping':
                await pingCommand(sock, chatId, message);
                break;
            case userMessage === '.alive':
                await aliveCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.mention '):
                {
                    const args = userMessage.split(' ').slice(1).join(' ');
                    const isOwner = message.key.fromMe || senderIsSudo;
                    await mentionToggleCommand(sock, chatId, message, args, isOwner);
                }
                break;
            case userMessage === '.setmention':
                {
                    const isOwner = message.key.fromMe || senderIsSudo;
                    await setMentionCommand(sock, chatId, message, isOwner);
                }
                break;
            case userMessage.startsWith('.blur'):
                const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                await blurCommand(sock, chatId, message, quotedMessage);
                break;
            case userMessage === '.welcome' || userMessage.startsWith('.welcome '):
                if (isGroup) {
                    // Check admin status if not already checked
                    if (!isSenderAdmin) {
                        const adminStatus = await isAdmin(sock, chatId, [message.key.participantAlt, message.key.remoteJidAlt, message.key.participant, senderId]);
                        isSenderAdmin = adminStatus.isSenderAdmin;
                    }

                    if (isSenderAdmin || message.key.fromMe) {
                        await welcomeCommand(sock, chatId, message);
                    } else {
                        await sock.sendMessage(chatId, { text: 'Sorry, only group admins can use this command.', ...channelInfo }, { quoted: message });
                    }
                } else {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                }
                break;
            case userMessage === '.goodbye' || userMessage.startsWith('.goodbye '):
                if (isGroup) {
                    // Check admin status if not already checked
                    if (!isSenderAdmin) {
                        const adminStatus = await isAdmin(sock, chatId, [message.key.participantAlt, message.key.remoteJidAlt, message.key.participant, senderId]);
                        isSenderAdmin = adminStatus.isSenderAdmin;
                    }

                    if (isSenderAdmin || message.key.fromMe) {
                        await goodbyeCommand(sock, chatId, message);
                    } else {
                        await sock.sendMessage(chatId, { text: 'Sorry, only group admins can use this command.', ...channelInfo }, { quoted: message });
                    }
                } else {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                }
                break;
            case userMessage.startsWith('.antibadword') || userMessage.startsWith('.badword'):
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                    return;
                }

                const adminStatus = await isAdmin(sock, chatId, [message.key.participantAlt, message.key.remoteJidAlt, message.key.participant, senderId]);
                isSenderAdmin = adminStatus.isSenderAdmin;
                isBotAdmin = adminStatus.isBotAdmin;

                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, { text: '*Bot must be admin to use this feature*', ...channelInfo }, { quoted: message });
                    return;
                }

                await antibadwordCommand(sock, chatId, message, senderId, isSenderAdmin);
                break;
            case userMessage.startsWith('.take') || userMessage.startsWith('.steal'):
                {
                    const isSteal = userMessage.startsWith('.steal');
                    const sliceLen = isSteal ? 6 : 5; // '.steal' vs '.take'
                    const takeArgs = rawText.slice(sliceLen).trim().split(' ');
                    await takeCommand(sock, chatId, message, takeArgs);
                }
                break;
            case userMessage === '.flirt':
                await flirtCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.character'):
                await characterCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.waste'):
                await wastedCommand(sock, chatId, message);
                break;
            case userMessage === '.ship':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await shipCommand(sock, chatId, message);
                break;
            case userMessage === '.groupinfo' || userMessage === '.infogp' || userMessage === '.infogrupo':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await groupInfoCommand(sock, chatId, message);
                break;
            case userMessage === '.resetlink' || userMessage === '.revoke' || userMessage === '.anularlink':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await resetlinkCommand(sock, chatId, senderId);
                break;
            case userMessage === '.staff' || userMessage === '.admins' || userMessage === '.listadmin':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await staffCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.tourl') || userMessage.startsWith('.url'):
                await urlCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.emojimix') || userMessage.startsWith('.emix'):
                await emojimixCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.tg') || userMessage.startsWith('.stickertelegram') || userMessage.startsWith('.tgsticker') || userMessage.startsWith('.telesticker'):
                await stickerTelegramCommand(sock, chatId, message);
                break;

            case userMessage === '.vv':
                await viewOnceCommand(sock, chatId, message);
                break;
            case userMessage === '.clearsession' || userMessage === '.clearsesi':
                await clearSessionCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.autostatus'):
                const autoStatusArgs = userMessage.split(' ').slice(1);
                await autoStatusCommand(sock, chatId, message, autoStatusArgs);
                break;
            case userMessage.startsWith('.simp'):
                await simpCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.metallic'):
                await textmakerCommand(sock, chatId, message, userMessage, 'metallic');
                break;
            case userMessage.startsWith('.ice'):
                await textmakerCommand(sock, chatId, message, userMessage, 'ice');
                break;
            case userMessage.startsWith('.snow'):
                await textmakerCommand(sock, chatId, message, userMessage, 'snow');
                break;
            case userMessage.startsWith('.impressive'):
                await textmakerCommand(sock, chatId, message, userMessage, 'impressive');
                break;
            case userMessage.startsWith('.matrix'):
                await textmakerCommand(sock, chatId, message, userMessage, 'matrix');
                break;
            case userMessage.startsWith('.light'):
                await textmakerCommand(sock, chatId, message, userMessage, 'light');
                break;
            case userMessage.startsWith('.neon'):
                await textmakerCommand(sock, chatId, message, userMessage, 'neon');
                break;
            case userMessage.startsWith('.devil'):
                await textmakerCommand(sock, chatId, message, userMessage, 'devil');
                break;
            case userMessage.startsWith('.purple'):
                await textmakerCommand(sock, chatId, message, userMessage, 'purple');
                break;
            case userMessage.startsWith('.thunder'):
                await textmakerCommand(sock, chatId, message, userMessage, 'thunder');
                break;
            case userMessage.startsWith('.leaves'):
                await textmakerCommand(sock, chatId, message, userMessage, 'leaves');
                break;
            case userMessage.startsWith('.1917'):
                await textmakerCommand(sock, chatId, message, userMessage, '1917');
                break;
            case userMessage.startsWith('.arena'):
                await textmakerCommand(sock, chatId, message, userMessage, 'arena');
                break;
            case userMessage.startsWith('.hacker'):
                await textmakerCommand(sock, chatId, message, userMessage, 'hacker');
                break;
            case userMessage.startsWith('.sand'):
                await textmakerCommand(sock, chatId, message, userMessage, 'sand');
                break;
            case userMessage.startsWith('.blackpink'):
                await textmakerCommand(sock, chatId, message, userMessage, 'blackpink');
                break;
            case userMessage.startsWith('.glitch'):
                await textmakerCommand(sock, chatId, message, userMessage, 'glitch');
                break;
            case userMessage.startsWith('.fire'):
                await textmakerCommand(sock, chatId, message, userMessage, 'fire');
                break;
            case userMessage.startsWith('.antidelete'):
                const antideleteMatch = userMessage.slice(11).trim();
                await handleAntideleteCommand(sock, chatId, message, antideleteMatch);
                break;
            case userMessage === '.surrender':
                // Handle surrender command for tictactoe game
                await handleTicTacToeMove(sock, chatId, senderId, 'surrender');
                break;
            case userMessage === '.cleartmp':
                await clearTmpCommand(sock, chatId, message);
                break;
            case userMessage === '.setpp':
                await setProfilePicture(sock, chatId, message);
                break;
            case userMessage.startsWith('.setgdesc'):
                {
                    const text = rawText.slice(9).trim();
                    await setGroupDescription(sock, chatId, senderId, text, message);
                }
                break;
            case userMessage.startsWith('.setgname'):
                {
                    const text = rawText.slice(9).trim();
                    await setGroupName(sock, chatId, senderId, text, message);
                }
                break;
            case userMessage.startsWith('.setgpp'):
                await setGroupPhoto(sock, chatId, senderId, message);
                break;
            case userMessage.startsWith('.instagram') || userMessage.startsWith('.insta') || (userMessage === '.ig' || userMessage.startsWith('.ig ')):
                await instagramCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.igsc'):
                await igsCommand(sock, chatId, message, true);
                break;
            case userMessage.startsWith('.igs'):
                await igsCommand(sock, chatId, message, false);
                break;
            case userMessage.startsWith('.fb') || userMessage.startsWith('.facebook'):
                await facebookCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.music'):
                await playCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.spotify'):
                await spotifyCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.play') || userMessage.startsWith('.mp3') || userMessage.startsWith('.ytmp3') || userMessage.startsWith('.song'):
                await songCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.video') || userMessage.startsWith('.ytmp4'):
                await videoCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.tiktok') || userMessage.startsWith('.tt'):
                await tiktokCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.translate') || userMessage.startsWith('.trt'):
                const commandLength = userMessage.startsWith('.translate') ? 10 : 4;
                await handleTranslateCommand(sock, chatId, message, userMessage.slice(commandLength));
                return;
            case userMessage.startsWith('.ss') || userMessage.startsWith('.ssweb') || userMessage.startsWith('.screenshot'):
                const ssCommandLength = userMessage.startsWith('.screenshot') ? 11 : (userMessage.startsWith('.ssweb') ? 6 : 3);
                await handleSsCommand(sock, chatId, message, userMessage.slice(ssCommandLength).trim());
                break;
            case userMessage.startsWith('.areact') || userMessage.startsWith('.autoreact') || userMessage.startsWith('.autoreaction'):
                await handleAreactCommand(sock, chatId, message, isOwnerOrSudoCheck);
                break;
            case userMessage.startsWith('.sudo'):
                await sudoCommand(sock, chatId, message);
                break;
            case userMessage === '.goodnight' || userMessage === '.lovenight' || userMessage === '.gn':
                await goodnightCommand(sock, chatId, message);
                break;
            case userMessage === '.shayari' || userMessage === '.shayri':
                await shayariCommand(sock, chatId, message);
                break;
            case userMessage === '.roseday':
                await rosedayCommand(sock, chatId, message);
                break;
            case userMessage === '.jid': await groupJidCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.autotyping'):
                await autotypingCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.autoread'):
                await autoreadCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.heart'):
                await handleHeart(sock, chatId, message);
                break;
            case userMessage.startsWith('.horny'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['horny', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.circle'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['circle', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.lgbt'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['lgbt', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.lolice'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['lolice', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.simpcard'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['simpcard', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.tonikawa'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['tonikawa', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.its-so-stupid'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['its-so-stupid', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.namecard'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['namecard', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;

            case userMessage.startsWith('.oogway2'):
            case userMessage.startsWith('.oogway'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const sub = userMessage.startsWith('.oogway2') ? 'oogway2' : 'oogway';
                    const args = [sub, ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.tweet'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['tweet', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.ytcomment'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['youtube-comment', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.comrade'):
            case userMessage.startsWith('.gay'):
            case userMessage.startsWith('.glass'):
            case userMessage.startsWith('.jail'):
            case userMessage.startsWith('.passed'):
            case userMessage.startsWith('.triggered'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const sub = userMessage.slice(1).split(/\s+/)[0];
                    const args = [sub, ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('.animu'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = parts.slice(1);
                    await animeCommand(sock, chatId, message, args);
                }
                break;
            // animu aliases
            case userMessage.startsWith('.nom'):
            case userMessage.startsWith('.poke'):
            case userMessage.startsWith('.cry'):
            case userMessage.startsWith('.kiss'):
            case userMessage.startsWith('.pat'):
            case userMessage.startsWith('.hug'):
            case userMessage.startsWith('.wink'):
            case userMessage.startsWith('.facepalm'):
            case userMessage.startsWith('.face-palm'):
            case userMessage.startsWith('.animuquote'):
            case userMessage.startsWith('.quote'):
            case userMessage.startsWith('.loli'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    let sub = parts[0].slice(1);
                    if (sub === 'facepalm') sub = 'face-palm';
                    if (sub === 'quote' || sub === 'animuquote') sub = 'quote';
                    await animeCommand(sock, chatId, message, [sub]);
                }
                break;
            case userMessage === '.crop':
                await stickercropCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('.pies'):
                {
                    const parts = rawText.trim().split(/\s+/);
                    const args = parts.slice(1);
                    await piesCommand(sock, chatId, message, args);
                    commandExecuted = true;
                }
                break;
            case userMessage === '.china':
                await piesAlias(sock, chatId, message, 'china');
                commandExecuted = true;
                break;
            case userMessage === '.indonesia':
                await piesAlias(sock, chatId, message, 'indonesia');
                commandExecuted = true;
                break;
            case userMessage === '.japan':
                await piesAlias(sock, chatId, message, 'japan');
                commandExecuted = true;
                break;
            case userMessage === '.korea':
                await piesAlias(sock, chatId, message, 'korea');
                commandExecuted = true;
                break;
            case userMessage === '.india':
                await piesAlias(sock, chatId, message, 'india');
                commandExecuted = true;
                break;
            case userMessage === '.malaysia':
                await piesAlias(sock, chatId, message, 'malaysia');
                commandExecuted = true;
                break;
            case userMessage === '.thailand':
                await piesAlias(sock, chatId, message, 'thailand');
                commandExecuted = true;
                break;
            case userMessage.startsWith('.update'):
                {
                    const parts = rawText.trim().split(/\s+/);
                    const zipArg = parts[1] && parts[1].startsWith('http') ? parts[1] : '';
                    await updateCommand(sock, chatId, message, zipArg);
                }
                commandExecuted = true;
                break;
            default:
                // V3 feature layer: only commands not already handled by RAUF's native switch reach here.
                // This keeps the current bot runtime/behavior intact while importing the second project's
                // command implementations, APIs, and feature logic.
                if (userMessage.startsWith('.')) {
                    try {
                        const handledByFeature = await featureBridge.handle(sock, message, '.');
                        if (handledByFeature) {
                            commandExecuted = true;
                            break;
                        }
                    } catch (featureError) {
                        console.error('[RAUF FEATURES]', featureError);
                        await sock.sendMessage(chatId, { text: `❌ Feature error: ${featureError.message}` }, { quoted: message });
                        commandExecuted = true;
                        break;
                    }
                }
                if (isGroup) {
                    // Handle non-command group messages
                    if (userMessage) {  // Make sure there's a message
                    }
                    await handleTagDetection(sock, chatId, message, senderId);
                    await handleMentionDetection(sock, chatId, message);
                }
                commandExecuted = false;
                break;
        }

        // If a command was executed, show typing status after command execution
        if (commandExecuted !== false) {
            // Command was executed, now show typing status after command execution
            await showTypingAfterCommand(sock, chatId);
        }

        // Function to handle .groupjid command
        async function groupJidCommand(sock, chatId, message) {
            const groupJid = message.key.remoteJid;

            if (!groupJid.endsWith('@g.us')) {
                return await sock.sendMessage(chatId, {
                    text: "❌ This command can only be used in a group."
                });
            }

            await sock.sendMessage(chatId, {
                text: `✅ Group JID: ${groupJid}`
            }, {
                quoted: message
            });
        }

        // Auto-reaction is handled once at message ingress; do not react a second time after command routing.
    } catch (error) {
        console.error('❌ Error in message handler:', error.message);
        // chatId lives inside the try-block, so read it again from the update (old code threw a ReferenceError here)
        const errChatId = messageUpdate?.messages?.[0]?.key?.remoteJid;
        // the owner (own number) also sees the real cause; other people only get the short notice
        const errDetail = messageUpdate?.messages?.[0]?.key?.fromMe ? `\n\n🔧 ${String(error?.message || error).slice(0, 200)}\n(.errors shows more)` : '';
        if (errChatId) {
            try {
                await sock.sendMessage(errChatId, {
                    text: '❌ Failed to process command!' + errDetail,
                    ...channelInfo
                });
            } catch (e) { console.error('❌ Could not send error notice:', e?.message || e); }
        }
    }
}

async function handleGroupParticipantUpdate(sock, update) {
    try {
        const { id, participants, action, author } = update;

        // Check if it's a group
        if (!id.endsWith('@g.us')) return;

        // Respect bot mode: only announce promote/demote in public mode
        let isPublic = true;
        try {
            const modeData = require('./lib/modeCache').read();
            if (typeof modeData.isPublic === 'boolean') isPublic = modeData.isPublic;
        } catch (e) {
            // If reading fails, default to public behavior
        }

        // Handle promotion events
        if (action === 'promote') {
            if (!isPublic) return;
            await handlePromotionEvent(sock, id, participants, author);
            return;
        }

        // Handle demotion events
        if (action === 'demote') {
            if (!isPublic) return;
            await handleDemotionEvent(sock, id, participants, author);
            return;
        }

        // Handle join events. Welcome handler can never block the intro (isolated try/catch);
        // the intro itself lives in lib/groupIntro.js (also driven by `groups.upsert`).
        if (action === 'add') {
            try { await handleJoinEvent(sock, id, participants); } catch (e) { console.error('[JOIN EVENT]', e?.message || e); }
            try { await require('./lib/groupIntro').onParticipantsAdd(sock, id, participants); } catch (e) { console.error('[GROUP INTRO]', e?.message || e); }
        }

        // Handle leave events
        if (action === 'remove') {
            try { await require('./lib/groupIntro').onParticipantsRemove(sock, id, participants); } catch (e) { console.error('[GROUP INTRO]', e?.message || e); }
            await handleLeaveEvent(sock, id, participants);
        }
    } catch (error) {
        console.error('Error in handleGroupParticipantUpdate:', error);
    }
}

// Instead, export the handlers along with handleMessages
module.exports = {
    handleMessages,
    handleGroupParticipantUpdate,
    handleStatus: async (sock, status) => {
        await handleStatusUpdate(sock, status);
    }
};