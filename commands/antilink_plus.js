async function antilinkCommand(sock, from, msg, isAdmin, botData, saveBotData, args) {
    // ✅ Group check
    if (!from.endsWith('@g.us')) {
        return await sock.sendMessage(from, { 
            text: "❌ This command only works in groups." 
        }, { quoted: msg });
    }

    // ✅ Admin check
    if (!isAdmin) {
        return await sock.sendMessage(from, { 
            text: "❌ Only admins can use this command." 
        }, { quoted: msg });
    }

    const action = args[0]?.toLowerCase();

    // ✅ No args - show current status
    if (!action) {
        const current = botData.antilinkGroups[from];
        let statusText = '❌ OFF';
        if (current === 'del') statusText = '✅ ON (Delete Only)';
        else if (current === 'kick') statusText = '✅ ON (Kick + Delete)';

        return await sock.sendMessage(from, { 
            text: `📊 *Anti-Link Status:* ${statusText}\n\n*Usage:*\n.antilink on - Delete links\n.antilink kick - Delete + kick\n.antilink off - Disable` 
        }, { quoted: msg });
    }

    if (action === 'on' || action === 'del') {
        // ✅ Loading reaction
        await sock.sendMessage(from, { 
            react: { text: '🔗', key: msg.key } 
        });

        botData.antilinkGroups[from] = 'del';
        saveBotData();

        await sock.sendMessage(from, { 
            text: "✅ *Anti-Link Enabled!*\n\n> Mode: Delete Only\n> Links will be deleted, members stay." 
        }, { quoted: msg });

    } else if (action === 'kick') {
        // ✅ Loading reaction
        await sock.sendMessage(from, { 
            react: { text: '👢', key: msg.key } 
        });

        botData.antilinkGroups[from] = 'kick';
        saveBotData();

        await sock.sendMessage(from, { 
            text: "✅ *Anti-Link Enabled!*\n\n> Mode: Kick + Delete\n> Links will be deleted AND member will be kicked." 
        }, { quoted: msg });

    } else if (action === 'off') {
        // ✅ Loading reaction
        await sock.sendMessage(from, { 
            react: { text: '🔓', key: msg.key } 
        });

        delete botData.antilinkGroups[from];
        saveBotData();

        await sock.sendMessage(from, { 
            text: "❌ *Anti-Link Disabled!*" 
        }, { quoted: msg });

    } else {
        await sock.sendMessage(from, { 
            text: "❌ *Usage:*\n.antilink on\n.antilink kick\n.antilink off" 
        }, { quoted: msg });
    }
}

module.exports = antilinkCommand;