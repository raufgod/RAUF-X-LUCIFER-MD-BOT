const card = require('../lib/cardStyle');
const settings = require("../settings");
async function aliveCommand(sock, chatId, message) {
    try {
        let modeName = 'Public';
        try { modeName = JSON.parse(require('fs').readFileSync('./data/messageCount.json', 'utf8')).isPublic === false ? 'Private' : 'Public'; } catch (_) {}
        const message1 = card.panel({
            icon: '🤖', title: 'I am alive!',
            rows: [['🏷️', 'Version', settings.version], ['🟢', 'Status', 'Online'], ['🔓', 'Mode', modeName], ['⏱️', 'Uptime', card.dur(process.uptime())]],
            body: `🌟 *Features*\n• Group Management\n• Antilink Protection\n• Fun Commands\n• And more!`,
            note: 'Type .menu for the full command list'
        });

        await sock.sendMessage(chatId, {
            text: message1,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                ...(require('../lib/pairCard').webCard().contextInfo || {})     // tap the small card = pairing website
            }
        }, { quoted: message });
    } catch (error) {
        console.error('Error in alive command:', error);
        await sock.sendMessage(chatId, { text: 'Bot is alive and running!' }, { quoted: message });
    }
}

module.exports = aliveCommand;