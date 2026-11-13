const { jidNormalizedUser } = require('@whiskeysockets/baileys');

async function kickCommand(sock, from, msg, isAdmin) {
    // ✅ Group check pehle
    if (!from.endsWith('@g.us')) {
        return await sock.sendMessage(from, { text: "❌ This command can only be used in groups." }, { quoted: msg });
    }

    // ✅ Admin check
    if (!isAdmin) {
        return await sock.sendMessage(from, { text: "❌ Only admin can use this command." }, { quoted: msg });
    }

    // ✅ Target nikalo (reply ya mention)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = contextInfo?.participant || contextInfo?.mentionedJid?.[0];

    if (!quoted) {
        return await sock.sendMessage(from, { 
            text: "❌ Please reply to a message or tag someone to kick." 
        }, { quoted: msg });
    }

    // ✅ The bot and yourself cannot be kicked
    const botId = jidNormalizedUser(sock.user.id);
    const senderId = msg.key.participant || from;

    if (quoted === botId) {
        return await sock.sendMessage(from, { 
            text: "❌ I can't kick myself!" 
        }, { quoted: msg });
    }

    if (quoted === senderId) {
        return await sock.sendMessage(from, { 
            text: "❌ You can't kick yourself!" 
        }, { quoted: msg });
    }

    try {
        // ✅ Loading reactions
        const loadEmojis = ['👢', '⏳', '✅'];
        for (const emoji of loadEmojis) {
            await sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
        }

        // ✅ Check whether the bot is an admin
        const metadata = await sock.groupMetadata(from);
        const botParticipant = metadata.participants.find(p => p.id === botId);
        const botIsAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';

        if (!botIsAdmin) {
            return await sock.sendMessage(from, { 
                text: "❌ I need to be an admin to kick members." 
            }, { quoted: msg });
        }

        // ✅ Check whether the target is an admin
        const targetParticipant = metadata.participants.find(p => p.id === quoted);
        const targetIsAdmin = targetParticipant?.admin === 'admin' || targetParticipant?.admin === 'superadmin';

        if (targetIsAdmin) {
            return await sock.sendMessage(from, { 
                text: "❌ I can't kick a group admin." 
            }, { quoted: msg });
        }

        // ✅ Kick the member
        await sock.groupParticipantsUpdate(from, [quoted], "remove");

        // ✅ Kicked user ka number nikalo
        const kickedNumber = quoted.split('@')[0];

        await sock.sendMessage(from, { 
            text: `✅ *User Kicked Successfully!*\n\n👢 Kicked: @${kickedNumber}\n\n> *Powered by RAUF × LUCIFER MD BOT*`,
            mentions: [quoted]
        }, { quoted: msg });

    } catch (e) {
        console.error("Kick error:", e.message);
        await sock.sendMessage(from, { 
            text: "❌ Failed to kick user. Make sure I am an admin." 
        }, { quoted: msg });
    }
}

module.exports = kickCommand;