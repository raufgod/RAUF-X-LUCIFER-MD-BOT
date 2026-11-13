require('dotenv').config();
try { require('./lib/brand').applyEnv() } catch (e) { console.error('[brand]', e?.message || e) }   // white-label brand (data/brand.json) fills the settings below
/**
 * RAUF × LUCIFER MD BOT 💫 - A WhatsApp Bot
 * RAUF × LUCIFER MD BOT 💫 custom build
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 * 
 * Credits:
 * - Baileys Library by @adiwajshing
 * - Pair Code implementation inspired by original upstream contributors
 */
require('./settings')
// Optional allowlisted Telegram pairing for independent WhatsApp sessions.
// Telegram pairing is optional and disabled in this lightweight build; WhatsApp pairing remains unchanged.
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const FileType = require('file-type')
const path = require('path')
const axios = require('axios')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, sleep, reSize } = require('./lib/myfunc')
const {
    default: makeWASocketDefault,
    makeWASocket: makeWASocketNamed,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys")
const makeWASocket = makeWASocketDefault || makeWASocketNamed   // works with official Baileys and the AI-label fork
const NodeCache = require("node-cache")
// Using a lightweight persisted store instead of makeInMemoryStore (compat across versions)
const pino = require("pino")
const { parsePhoneNumber } = require("libphonenumber-js")
let PHONENUMBER_MCC = {}
try { ({ PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils/generics')) } catch (_) { /* newer builds do not ship this table */ }
const { rmSync, existsSync } = require('fs')
const { join } = require('path')
const { patch: patchMediaTransport } = require('./lib/mediaTransport')
const { patch: patchGlobalCard } = require('./lib/globalCard')
const { CHANNEL_NAME, CHANNEL_LINK, resolveOfficialChannel } = require('./lib/channel')

// Import lightweight store
const store = require('./lib/lightweight_store')

// Initialize store
store.readFromFile()
const settings = require('./settings')
require('./lib/errorLog').install()   // remembers recent errors for .errors
console.log(`[RAUF × LUCIFER MD BOT] ${settings.version} — build ${settings.build}`)
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)

// Memory optimization - Force garbage collection if available
setInterval(() => {
    if (global.gc) {
        global.gc()
        // Keep KotaBump console available for pairing and diagnostics
    }
}, 60_000) // every 1 minute

// NOTE: no RAM limit / no auto-restart. The bot never restarts itself, however high the RAM goes.

// Automatic backup every 3 hours into ./backups/auto/ (bot keeps running, no restart)
try { require('./lib/housekeeping').start() } catch (e) {}
try { require('./lib/autoBackup').start() } catch (e) { console.error('[autoBackup]', e?.message || e) }

// Preconfigured number for non-interactive hosting panels (KotaBump, etc.).
// Owner pairing number: ONLY PAIRING_NUMBER in .env. If it is empty, NO pairing code is generated and nothing is asked in the console.
let phoneNumber = String(process.env.PAIRING_NUMBER || '').replace(/\D/g, '')
// Update-safe: the update zip ships NO data/*.json (so it can never overwrite your settings or records).
// Any data file that does not exist yet is created from data/_defaults on start.
try {
    fs.mkdirSync('./data', { recursive: true })
    for (const f of fs.readdirSync('./data/_defaults')) {
        const src = path.join('./data/_defaults', f), dst = path.join('./data', f)
        if (fs.statSync(src).isFile() && !fs.existsSync(dst)) fs.copyFileSync(src, dst)
    }
} catch (e) { console.error('[data defaults]', e?.message || e) }
let owner = JSON.parse(fs.readFileSync('./data/owner.json'))

global.botname = "RAUF × LUCIFER MD BOT 💫"
global.themeemoji = "•"
const pairingCode = true
const useMobile = process.argv.includes("--mobile")

// The hosting console supplies the WhatsApp number interactively at first startup.


// Website, Telegram bots and extra paired numbers: started once, with or without the owner WhatsApp connection (v23.1)
function startServices() {
    if (global.__servicesStarted) return
    global.__servicesStarted = true
    // Optional Telegram control bot (multi-device): lets allowlisted Telegram users create
    // their own separate, real WhatsApp session with /pair, and manage it with /session and
    // /deletesession. Stays off unless TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_USERS are set.
    try {
        const { startTelegramPairing } = require('./lib/telegramPairing')
        startTelegramPairing()
    } catch (e) {
        console.error('[Telegram pairing] failed to start:', e?.message || e)
    }

    // Telegram PASSWORD bot for the website lock (needs TELEGRAM_PASSWORD_BOT_TOKEN)
    try { require('./lib/webPassword').start() } catch (e) { console.error('[Password bot] failed to start:', e?.message || e) }

    // Reconnect numbers paired earlier with the in-chat .pair command
    try { require('./lib/webPairing').start() } catch (e) { console.error('[web-pairing] failed to start:', e?.message || e) }
    try { require('./lib/multiSession').restoreAll().catch(e => console.error('[multiSession restore]', e?.message || e)) }
    catch (e) { console.error('[multiSession] failed to start:', e?.message || e) }
}

async function startRaufLegacyBot() {
    try {
        let { version, isLatest } = await (typeof fetchLatestBaileysVersion === 'function' ? fetchLatestBaileysVersion() : Promise.resolve({})).catch(() => ({}))

        // FIX: "pairing code generates but WhatsApp says 'Could not link device'" almost always
        // means the ./session folder holds half-finished keys from an earlier failed pairing
        // attempt. Those stale keys no longer match what WhatsApp expects, so the handshake
        // fails even though a code is still printed. If this session was never fully registered,
        // wipe it and start from a clean, empty key set before requesting a new code.
        {
            const probe = await useMultiFileAuthState(`./session`)
            // (v23.1) No owner pairing number in .env and no linked session -> the main WhatsApp connection is NOT started at all:
            // no pairing code, no QR, no reconnect loop. Website / Telegram / admin keep running. Add PAIRING_NUMBER to .env to turn it on.
            if (!probe.state.creds.registered && !phoneNumber) {
                if (!global.__noOwnerPairNote) { global.__noOwnerPairNote = true; console.log(chalk.yellow('ℹ️ PAIRING_NUMBER is empty in .env - the owner WhatsApp link is OFF (no pairing code, no QR). Add PAIRING_NUMBER=91XXXXXXXXXX to .env and restart to turn it on.')) }
                startServices()
                return null
            }
            if (pairingCode && !probe.state.creds.registered) {
                try {
                    rmSync('./session', { recursive: true, force: true })
                    console.log(chalk.yellow('🧹 Cleared an incomplete session before generating a fresh pairing code.'))
                } catch (cleanupError) {
                    console.error('[SESSION CLEANUP]', cleanupError?.message || cleanupError)
                }
            }
        }

        const { state, saveCreds } = await useMultiFileAuthState(`./session`)
        const msgRetryCounterCache = new NodeCache()

        const RaufLegacyBot = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: !pairingCode,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: require('./lib/onlineMode').isEnabled('main'),   // default OFF (.online on/off)
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                let jid = jidNormalizedUser(key.remoteJid)
                let msg = await store.loadMessage(jid, key.id)
                return msg?.message || undefined
            },
            msgRetryCounterCache,
            maxMsgRetryCount: 5,
            retryRequestDelayMs: 250,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        })
        require('./lib/groupCache').patch(RaufLegacyBot)   // one real group lookup per group per 2 minutes

        // Save credentials when they update
        RaufLegacyBot.ev.on('creds.update', saveCreds)

        // Always download remote media on the bot side before sending.
        // This avoids WhatsApp-side CDN/region/legal blocking for provider URLs.
        patchMediaTransport(RaufLegacyBot)

        // Global channel card on every outgoing message (edit lib/globalCard.js to customise)
        patchGlobalCard(RaufLegacyBot)

        // Voice agent: the paired number is the sender of the welcome voice note to people who register on the website (lib/callAgent)
        try { require('./lib/callAgent').setSocket(RaufLegacyBot) } catch (e) { console.error('[call-agent]', e?.message || e) }

    store.bind(RaufLegacyBot.ev)

    // Message handling
    RaufLegacyBot.ev.on('messages.upsert', async chatUpdate => {
        try {
            const incomingMessages = Array.isArray(chatUpdate?.messages) ? chatUpdate.messages : [];
            // every message is handled on its own: one slow command (download, API call) must never hold up .ping or the next message
            for (const mek of incomingMessages) { (async () => {
            if (!mek?.message || !mek.key?.remoteJid) return;
            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
            if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                await handleStatus(RaufLegacyBot, chatUpdate);
                return;
            }
            if (typeof mek.key.id === 'string' && mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return


            // People who registered on the website get a welcome voice note; their text/voice replies are answered by the voice agent.
            try { if (await require('./lib/callAgent').handleIncoming(RaufLegacyBot, mek, chatUpdate.type)) return } catch (e) { console.error('[call-agent]', e?.message || e) }

            // First-contact private DM intro — sent ONCE per person, ever (lib/dmIntro.js + lib/sentOnce.js).
            try { await require('./lib/dmIntro').maybeSend(RaufLegacyBot, chatUpdate, mek) } catch (e) { console.error('[DM INTRO]', e?.message || e) }
            // Let the central command router enforce PUBLIC/PRIVATE mode and owner permissions.
            // An early return here incorrectly blocked owner commands from alternate private chats.
            try {
                await handleMessages(RaufLegacyBot, { ...chatUpdate, messages: [mek] }, true)
            } catch (err) {
                console.error("Error in handleMessages:", err)
                // Only try to send error message if we have a valid chatId
                if (mek.key && mek.key.remoteJid) {
                    await RaufLegacyBot.sendMessage(mek.key.remoteJid, {
                        text: '❌ An error occurred while processing your message.',
                        contextInfo: {
                            forwardingScore: 1,
                            isForwarded: true,
                            
                        }
                    }).catch(console.error);
                }
            }
            })().catch((e) => console.error('[message]', e?.message || e)) }

        } catch (err) {
            console.error("Error in messages.upsert:", err)
        }
    })

    // Add these event handlers for better functionality
    RaufLegacyBot.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {}
            return decode.user && decode.server && decode.user + '@' + decode.server || jid
        } else return jid
    }

    RaufLegacyBot.ev.on('contacts.update', update => {
        for (let contact of update) {
            let id = RaufLegacyBot.decodeJid(contact.id)
            if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
        }
    })

    RaufLegacyBot.getName = (jid, withoutContact = false) => {
        const id = RaufLegacyBot.decodeJid(jid)
        withoutContact = RaufLegacyBot.withoutContact || withoutContact
        let v
        if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
            v = store.contacts[id] || {}
            if (!(v.name || v.subject)) v = RaufLegacyBot.groupMetadata(id) || {}
            resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
        })
        else v = id === '0@s.whatsapp.net' ? {
            id,
            name: 'WhatsApp'
        } : id === RaufLegacyBot.decodeJid(RaufLegacyBot.user.id) ?
            RaufLegacyBot.user :
            (store.contacts[id] || {})
        return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
    }

    RaufLegacyBot.public = true

    RaufLegacyBot.serializeM = (m) => smsg(RaufLegacyBot, m, store)

    // Handle pairing code
    if (pairingCode && !RaufLegacyBot.authState.creds.registered) {
        if (useMobile) throw new Error('Cannot use pairing code with mobile api')

        // Ask the hosting user for the WhatsApp number; never use the pack author's number.
        if (!phoneNumber) {
            const readline = require('node:readline/promises');
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            try {
                while (!phoneNumber) {
                    const answer = await rl.question('📱 Please enter your WhatsApp number with country code (example: 919XXXXXXXXX): ');
                    const candidate = String(answer || '').replace(/\D/g, '');
                    const pn = require('awesome-phonenumber');
                    if (candidate && pn('+' + candidate).isValid()) {
                        phoneNumber = candidate;
                        settings.ownerNumber = candidate;
                        console.log(chalk.green(`🔐 Pairing target: +${phoneNumber}`));
                    } else {
                        console.log(chalk.red('Invalid number. Include country code, digits only; try again.'));
                    }
                }
            } finally {
                rl.close();
            }
        }

        // Optional: request a pairing code you chose yourself instead of a random one, e.g.
        // CUSTOM_PAIRING_CODE=RAUF1234 in .env. WhatsApp itself requires this to be exactly
        // 8 characters, letters and digits only (this is WhatsApp's own hard rule, not a
        // choice made here — anything else is rejected by WhatsApp before it ever reaches
        // the phone, so there is no way to make a word/phrase of any other length work).
        const rawCustomCode = String(process.env.CUSTOM_PAIRING_CODE || '').trim().toUpperCase()
        let customCode
        if (rawCustomCode) {
            if (/^[A-Z0-9]{8}$/.test(rawCustomCode)) {
                customCode = rawCustomCode
                console.log(chalk.green(`🔧 Using your custom pairing code: ${customCode}`))
            } else {
                console.log(chalk.red(`⚠️ CUSTOM_PAIRING_CODE "${rawCustomCode}" is not valid — WhatsApp requires exactly 8 characters, letters and digits only (e.g. RAUF1234). Falling back to an auto-generated code.`))
            }
        }

        // Request the pairing code with a few retries: the very first request can fail with
        // "Connection Closed" if it is sent before the socket's handshake has fully settled,
        // which otherwise looks identical to "could not link device" on the phone.
        const requestCodeWithRetry = async (attempt = 1) => {
            try {
                let code = await RaufLegacyBot.requestPairingCode(phoneNumber, customCode)
                code = code?.match(/.{1,4}/g)?.join("-") || code
                console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)))
                try { require('./lib/connectNotice').markPending('./session') } catch (_) {}   // "connected" DM is owed for THIS new link only
                console.log(chalk.yellow(`\nPlease enter this code in your WhatsApp app WITHIN 60 SECONDS (it expires quickly):\n1. Open WhatsApp\n2. Go to Settings > Linked Devices\n3. Tap "Link a Device"\n4. Tap "Link with phone number instead"\n5. Enter the code shown above`))
            } catch (error) {
                console.error(`Error requesting pairing code (attempt ${attempt}/3):`, error?.message || error)
                if (attempt < 3) {
                    setTimeout(() => requestCodeWithRetry(attempt + 1), 3000)
                } else {
                    console.log(chalk.red('Failed to get a pairing code after several attempts. Delete the ./session folder and restart, then double-check the phone number (country code, digits only, no +).'))
                }
            }
        }

        require('./lib/pairingReady').waitReady(RaufLegacyBot, 2500, 12000).then(() => requestCodeWithRetry(1))
    }

    // Connection handling
    RaufLegacyBot.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect, qr } = s
        
        // QR codes are never used here: linking is by pairing code only (PAIRING_NUMBER in .env)
        
        if (connection === 'connecting') {
            console.log(chalk.yellow('🔄 Connecting to WhatsApp...'))
        }
        
        if (connection == "open") {
            try { require('./lib/onlineMode').register(RaufLegacyBot) } catch (e) { console.error('[onlineMode]', e?.message || e) }
            console.log(chalk.magenta(` `))
            console.log(chalk.yellow(`🌿Connected to => ` + JSON.stringify(RaufLegacyBot.user, null, 2)))

            try {
                const botNumber = RaufLegacyBot.user.id.split(':')[0] + '@s.whatsapp.net';

                // NOTE: the connected WhatsApp account's profile name is intentionally left untouched.

                // Resolve the official channel from its invite code instead of hardcoding
                // an old newsletter JID. The public link remains the safe fallback.
                let channelState = { name: CHANNEL_NAME, link: CHANNEL_LINK, jid: null };
                try {
                    channelState = await resolveOfficialChannel(RaufLegacyBot);
                    console.log(chalk.green(`✅ Official channel: ${channelState.name} ${channelState.jid ? `(${channelState.jid})` : '(link fallback)'}`));
                } catch (channelError) {
                    console.error('[CHANNEL] Resolver failed:', channelError?.message || channelError);
                }

                // Send the CONNECTED message ONLY once per new link (right after the user pairs).
                // Restarts, updates, manual restarts and auto-reconnects never send it again.
                if (!require('./lib/connectNotice').takePending('./session')) throw { silent: true }

                const connectedCaption = `🤖 *RAUF × LUCIFER MD BOT 💫 CONNECTED!*\n\n⏰ Time: ${new Date().toLocaleString()}\n✅ Status: Online and Ready!\n\n📢 *Official Channel:* ${CHANNEL_NAME}\n${CHANNEL_LINK}\n\n💫 *Official Group:*\n${settings.groupLink || 'Group invite link will be added soon.'}\n\n${require('./lib/connectNotice').linksBlock()}`;
                try {
                    const connectedImagePath = path.isAbsolute(settings.menuImage)
                        ? settings.menuImage
                        : path.join(__dirname, settings.menuImage.replace(/^\.\//, ''));
                    if (!fs.existsSync(connectedImagePath)) {
                        throw new Error(`Bundled connected image missing: ${connectedImagePath}`);
                    }
                    await RaufLegacyBot.sendMessage(botNumber, {
                        image: fs.readFileSync(connectedImagePath),
                        caption: connectedCaption,
                        mimetype: 'image/jpeg'
                    });
                } catch (mediaError) {
                    console.error('[CONNECTED] Image send failed; sending text fallback:', mediaError?.stack || mediaError);
                    await RaufLegacyBot.sendMessage(botNumber, { text: connectedCaption });
                }
            } catch (error) {
                if (!error?.silent) console.error('Error sending connection message:', error?.message || error)
            }

            await delay(1999)
            console.log(chalk.yellow(`\n\n                  ${chalk.bold.blue(`[ ${global.botname || 'RAUF × LUCIFER MD BOT 💫'} ]`)}\n\n`))
            console.log(chalk.cyan(`< ================================================== >`))
            console.log(chalk.magenta(`\n${global.themeemoji || '•'} CHANNEL: ${CHANNEL_NAME}`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} GITHUB: mrunqiuehacker`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} WA NUMBER: ${owner}`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} CREDIT: RAUF × LUCIFER`))
            console.log(chalk.green(`${global.themeemoji || '•'} 🤖 Bot Connected Successfully! ✅`))
            console.log(chalk.blue(`Bot Version: ${settings.version}`))
        }
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
            const statusCode = lastDisconnect?.error?.output?.statusCode
            
            console.log(chalk.red(`Connection closed due to ${lastDisconnect?.error}, reconnecting ${shouldReconnect}`))
            
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                try {
                    rmSync('./session', { recursive: true, force: true })
                    console.log(chalk.yellow('Session folder deleted. Please re-authenticate.'))
                } catch (error) {
                    console.error('Error deleting session:', error)
                }
                console.log(chalk.red('Session logged out. Please re-authenticate.'))
            }
            
            if (shouldReconnect) {
                console.log(chalk.yellow('Reconnecting...'))
                await delay(5000)
                startRaufLegacyBot()
            }
        }
    })

    // Anticall: modes warn / busy / block (see commands/anticall.js)
    RaufLegacyBot.ev.on('call', (calls) => require('./commands/anticall').handleCall(RaufLegacyBot, calls));

    RaufLegacyBot.ev.on('group-participants.update', async (update) => {
        await handleGroupParticipantUpdate(RaufLegacyBot, update);
    });

    // Bot added to a NEW group → send the intro (this event is the reliable one for that case)
    RaufLegacyBot.ev.on('groups.upsert', async (groups) => {
        try { await require('./lib/groupIntro').onGroupsUpsert(RaufLegacyBot, groups) } catch (e) { console.error('[GROUP INTRO upsert]', e?.message || e) }
    });

    startServices()

    RaufLegacyBot.ev.on('status.update', async (status) => {
        await handleStatus(RaufLegacyBot, status);
    });

    RaufLegacyBot.ev.on('messages.reaction', async (status) => {
        await handleStatus(RaufLegacyBot, status);
    });

    return RaufLegacyBot
    } catch (error) {
        console.error('Error in startRaufLegacyBot:', error)
        await delay(5000)
        startRaufLegacyBot()
    }
}


// Start the bot with error handling
startRaufLegacyBot().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
})
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err)
})

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err)
})

let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(chalk.redBright(`Update ${__filename}`))
    delete require.cache[file]
    require(file)
})