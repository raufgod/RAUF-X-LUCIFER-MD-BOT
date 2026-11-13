async function acceptCommand(sock, from, msg, isAdmin) {
    // ✅ Group check
    if (!from.endsWith('@g.us')) {
        return await sock.sendMessage(from, { 
            text: '❌ This command can only be used in groups.' 
        }, { quoted: msg });
    }

    // ✅ Admin check
    if (!isAdmin) {
        return await sock.sendMessage(from, { 
            text: '❌ Only group admins can use this command.' 
        }, { quoted: msg });
    }

    try {
        // ✅ Loading reactions
        const loadEmojis = ['📥', '⏳', '✅'];
        for (const emoji of loadEmojis) {
            try {
                await sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
            } catch (e) {}
        }

        // ✅ Fetch pending join requests
        const response = await sock.groupRequestParticipantsList(from);
        
        if (!response || response.length === 0) {
            return await sock.sendMessage(from, { 
                text: '✅ *No pending join requests found in this group.*' 
            }, { quoted: msg });
        }

        await sock.sendMessage(from, { 
            text: `⏳ *Found ${response.length} pending request(s).*\n\n> Starting auto-accept...\n\n> Powered by RAUF × LUCIFER MD BOT` 
        }, { quoted: msg });

        let acceptedCount = 0;
        let failedCount = 0;

        for (const participant of response) {
            try {
                await sock.groupRequestParticipantsUpdate(from, [participant.jid], 'approve');
                acceptedCount++;
                console.log(`✅ Accepted: ${participant.jid}`);
                // Small delay to prevent rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (err) {
                console.error(`❌ Failed to accept ${participant.jid}:`, err.message);
                failedCount++;
            }
        }

        // ✅ Final report
        await sock.sendMessage(from, { 
            text: `✅ *Auto-Accept Complete!*\n\n👥 Total Requests: ${response.length}\n✅ Accepted: ${acceptedCount}\n❌ Failed: ${failedCount}\n\n> Powered by RAUF × LUCIFER MD BOT` 
        }, { quoted: msg });

    } catch (e) {
        console.error('❌ Accept command error:', e.message);
        await sock.sendMessage(from, { 
            text: `❌ Error: ${e.message}` 
        }, { quoted: msg });
    }
}

module.exports = acceptCommand;