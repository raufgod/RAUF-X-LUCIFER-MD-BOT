const settings = require('../settings');

async function ownerCommand(sock, from, msg) {
    const ownerText = `👤 *BOT OWNER:* ${settings.botOwner}\n` +
                    `📱 *OWNER 1:* +${settings.ownerNumber}\n` +
                    (settings.ownerNumber2 ? `📱 *OWNER 2:* +${settings.ownerNumber2}\n` : '') +
                    `👑 *POWERED BY ${String(settings.botName || 'RAUF × LUCIFER MD BOT').toUpperCase()}*`;
    await sock.sendMessage(from, { text: ownerText }, { quoted: msg });
}

module.exports = ownerCommand;
