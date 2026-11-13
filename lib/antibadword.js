const { setAntiBadword, getAntiBadword, removeAntiBadword, incrementWarningCount, resetWarningCount } = require('../lib/index');
const fs = require('fs');
const path = require('path');

const BADWORDS_PATH = path.join(__dirname, '../data/badwords.json');
function loadBadwordList() {
  try {
    const data = JSON.parse(fs.readFileSync(BADWORDS_PATH, 'utf8'));
    return Array.from(new Set([...(Array.isArray(data.words) ? data.words : []), ...(Array.isArray(data.customWords) ? data.customWords : [])]));
  } catch { return []; }
}
function saveBadwordList(data) {
  fs.mkdirSync(path.dirname(BADWORDS_PATH), { recursive: true });
  fs.writeFileSync(BADWORDS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}


// Load antibadword config
function loadAntibadwordConfig(groupId) {
    try {
        const configPath = path.join(__dirname, '../data/userGroupData.json');
        if (!fs.existsSync(configPath)) {
            return {};
        }
        const data = JSON.parse(fs.readFileSync(configPath));
        return data.antibadword?.[groupId] || {};
    } catch (error) {
        console.error('❌ Error loading antibadword config:', error.message);
        return {};
    }
}

async function handleAntiBadwordCommand(sock, chatId, message, match) {
    if (!match) {
        return sock.sendMessage(chatId, {
            text: `*ANTIBADWORD SETUP*\n\n*.antibadword on/off*\nEnable or disable detection\n*.antibadword set delete|kick|warn*\nSet action\n*.badword list*\nShow configured words\n*.badword add <word or phrase>*\n*.badword remove <word or phrase>*\nDefault lexicon: ${loadBadwordList().length} entries`
        }, { quoted: message });
    }
    const parts = match.trim().split(/\s+/);
    const sub = parts[0]?.toLowerCase();
    if (['list','add','remove'].includes(sub)) {
        let data;
        try { data = JSON.parse(fs.readFileSync(BADWORDS_PATH, 'utf8')); } catch { data = { version: 1, words: [], customWords: [] }; }
        data.words = Array.isArray(data.words) ? data.words : [];
        data.customWords = Array.isArray(data.customWords) ? data.customWords : [];
        if (sub === 'list') {
            const page = Math.max(1, Number(parts[1]) || 1);
            const all = [...new Set([...data.words, ...data.customWords])];
            const pageSize = 100;
            const slice = all.slice((page-1)*pageSize, page*pageSize);
            return sock.sendMessage(chatId, { text: `*BADWORD LIST — ${page}/${Math.max(1,Math.ceil(all.length/pageSize))}*\nTotal: ${all.length}\n\n` + (slice.length ? slice.map((w,i)=>`${(page-1)*pageSize+i+1}. ${w}`).join('\n') : 'No entries on this page.') }, { quoted: message });
        }
        const value = match.trim().slice(sub.length).trim().toLowerCase();
        if (!value) return sock.sendMessage(chatId, { text: `Usage: .badword ${sub} <word or phrase>` }, { quoted: message });
        if (sub === 'add') {
            if (!data.customWords.some(w => String(w).toLowerCase() === value) && !data.words.some(w => String(w).toLowerCase() === value)) data.customWords.push(value);
            saveBadwordList(data);
            return sock.sendMessage(chatId, { text: `Added to badword list: ${value}\nTotal entries: ${loadBadwordList().length}` }, { quoted: message });
        }
        data.customWords = data.customWords.filter(w => String(w).toLowerCase() !== value);
        data.words = data.words.filter(w => String(w).toLowerCase() !== value);
        saveBadwordList(data);
        return sock.sendMessage(chatId, { text: `Removed from badword list if present: ${value}\nTotal entries: ${loadBadwordList().length}` }, { quoted: message });
    }

    if (match === 'on') {
        const existingConfig = await getAntiBadword(chatId, 'on');
        if (existingConfig?.enabled) {
            return sock.sendMessage(chatId, { text: '*AntiBadword is already enabled for this group*' });
        }
        await setAntiBadword(chatId, 'on', 'delete');
        return sock.sendMessage(chatId, { text: '*AntiBadword has been enabled. Use .antibadword set <action> to customize action*' }, { quoted: message });
    }

    if (match === 'off') {
        const config = await getAntiBadword(chatId, 'on');
        if (!config?.enabled) {
            return sock.sendMessage(chatId, { text: '*AntiBadword is already disabled for this group*' }, { quoted: message } );
        }
        await removeAntiBadword(chatId);
        return sock.sendMessage(chatId, { text: '*AntiBadword has been disabled for this group*' }, { quoted: message } );
    }

    if (match.startsWith('set')) {
        const action = match.split(' ')[1];
        if (!action || !['delete', 'kick', 'warn'].includes(action)) {
            return sock.sendMessage(chatId, { text: '*Invalid action. Choose: delete, kick, or warn*' }, { quoted: message } );
        }
        await setAntiBadword(chatId, 'on', action);
        return sock.sendMessage(chatId, { text: `*AntiBadword action set to: ${action}*` }, { quoted: message } );
    }

    return sock.sendMessage(chatId, { text: '*Invalid command. Use .antibadword to see usage*' }, { quoted: message } );
}

async function handleBadwordDetection(sock, chatId, message, userMessage, senderId) {
    const config = loadAntibadwordConfig(chatId);
    if (!config.enabled) return;

    // Skip if not group
    if (!chatId.endsWith('@g.us')) return;

    // Skip if message is from bot
    if (message.key.fromMe) return;

    // Get antibadword config first
    const antiBadwordConfig = await getAntiBadword(chatId, 'on');
    if (!antiBadwordConfig?.enabled) {
        console.log('Antibadword not enabled for this group');
        return;
    }

    // Convert message to lowercase and clean it
    const normalizeText = (value) => String(value || '').toLowerCase()
        .normalize('NFKD')
        .replace(/[0@]/g, 'o').replace(/[1!|]/g, 'i').replace(/[3]/g, 'e')
        .replace(/[4@]/g, 'a').replace(/[5$]/g, 's').replace(/[7]/g, 't')
        .replace(/[8]/g, 'b').replace(/[6]/g, 'g')
        .replace(/[._*\-]+/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ').trim();
    const cleanMessage = normalizeText(userMessage);

    // List of bad words
    const badWords = loadBadwordList();
    
    // Normalize the lexicon too; use phrase boundaries to avoid matching harmless substrings.
    const normalizedBadWords = badWords.map(normalizeText).filter(w => w.length >= 2);
    const containsBadWord = normalizedBadWords.some(word => {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
        return new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`, 'u').test(cleanMessage);
    });
    if (!containsBadWord) return;

   // console.log('Bad word detected in:', userMessage);

    // Check if bot is admin before taking action
    const groupMetadata = await sock.groupMetadata(chatId);
    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const bot = groupMetadata.participants.find(p => p.id === botId);
    if (!bot?.admin) {
       // console.log('Bot is not admin, cannot take action');
        return;
    }

    // Check if sender is admin
    const participant = groupMetadata.participants.find(p => p.id === senderId);
    if (participant?.admin) {
        //console.log('Sender is admin, skipping action');
        return;
    }

    // Delete message immediately
    try {
        await sock.sendMessage(chatId, { 
            delete: message.key
        });
        //console.log('Message deleted successfully');
    } catch (err) {
        console.error('Error deleting message:', err);
        return;
    }

    // Take action based on config
    switch (antiBadwordConfig.action) {
        case 'delete':
            await sock.sendMessage(chatId, {
                text: `*@${senderId.split('@')[0]} bad words are not allowed here*`,
                mentions: [senderId]
            });
            break;

        case 'kick':
            try {
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                await sock.sendMessage(chatId, {
                    text: `*@${senderId.split('@')[0]} has been kicked for using bad words*`,
                    mentions: [senderId]
                });
            } catch (error) {
                console.error('Error kicking user:', error);
            }
            break;

        case 'warn':
            const warningCount = await incrementWarningCount(chatId, senderId);
            if (warningCount >= 3) {
                try {
                    await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                    await resetWarningCount(chatId, senderId);
                    await sock.sendMessage(chatId, {
                        text: `*@${senderId.split('@')[0]} has been kicked after 3 warnings*`,
                        mentions: [senderId]
                    });
                } catch (error) {
                    console.error('Error kicking user after warnings:', error);
                }
            } else {
                await sock.sendMessage(chatId, {
                    text: `*@${senderId.split('@')[0]} warning ${warningCount}/3 for using bad words*`,
                    mentions: [senderId]
                });
            }
            break;
    }
}

module.exports = {
    handleAntiBadwordCommand,
    handleBadwordDetection
}; 