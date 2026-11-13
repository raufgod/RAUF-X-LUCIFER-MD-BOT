// commands/hack.js
const settings = require('./settings');

function onlyDigits(s = '') {
    return String(s).replace(/\D/g, '');
}

function getOwnersNormalized() {
    const raw = settings.ownerNumber;
    let owners = [];
    
    if (Array.isArray(raw)) {
        owners = raw;
    } else if (typeof raw === 'string') {
        owners = raw.split(',');
    } else {
        owners = [raw];
    }
    
    return owners
        .map(o => onlyDigits(o))
        .filter(o => o.length > 0);
}

function waitTime(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function hackCommand(sock, chatId, message, q) {
    try {
        // ✅ Sender nikalo
        const rawSender = message.key?.participant || message.key?.remoteJid || '';
        const senderDigits = onlyDigits(rawSender);

        // ✅ Owner list
        const owners = getOwnersNormalized();

        // ✅ Check — owner ya fromMe
        const isFromMe = message.key?.fromMe === true;
        const isOwner = owners.some(o => senderDigits.endsWith(o) || o.endsWith(senderDigits));

        if (!isOwner && !isFromMe) {
            return await sock.sendMessage(chatId, { 
                text: '❌ Only the bot owner can use this command.' 
            }, { quoted: message });
        }

        // ✅ Initial reaction
        await sock.sendMessage(chatId, { 
            react: { text: '💻', key: message.key } 
        });

        const steps = [
            '💻 *HACK STARTING...* 💻',
            '*Initializing hacking tools...* 🛠️',
            '*Connecting to remote servers...* 🌐',
            '```[█▒▒▒▒] 10%``` ⏳',
            '```[██▒▒▒▒] 30%``` ⏳',
            '```[████▒▒▒] 50%``` ⏳',
            '```[██████▒] 70%``` ⏳',
            '```[████████] 90%``` ⏳',
            '```[████████] 100%``` ✅',
            '🔒 *System Breach: Successful!* 🔓',
            '🚀 *Executing final commands...* 🎯',
            '*📡 Transmitting data...* 📤',
            '_🕵️‍♂️ Covering tracks..._ 🤫',
            '*🔧 Finalizing operations...* 🏁',
            '⚠️ *Note:* This is a joke command for fun.',
            '> *HACK COMPLETE ☣*'
        ];

        for (const line of steps) {
            await sock.sendMessage(chatId, { text: line }, { quoted: message });
            // Random delay 500ms - 2000ms (realism ke liye)
            const randomDelay = Math.floor(Math.random() * 1500) + 500;
            await waitTime(randomDelay);
        }

        // ✅ Final reaction
        await sock.sendMessage(chatId, { 
            react: { text: '☣️', key: message.key } 
        });

    } catch (err) {
        console.error('hackCommand error:', err.message);
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${err.message || String(err)}` 
        }, { quoted: message });
    }
}

module.exports = hackCommand;