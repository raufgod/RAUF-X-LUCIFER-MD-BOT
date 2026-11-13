const settings = require('../settings');

async function ownerCommand(sock, chatId) {
    const nums = [settings.ownerNumber, settings.ownerNumber2].map((n) => String(n || '').replace(/\D/g, '')).filter(Boolean);
    const contacts = nums.map((n, i) => ({
        vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${settings.botOwner} (Owner ${i + 1})\nTEL;waid=${n}:+${n}\nEND:VCARD`
    }));
    await sock.sendMessage(chatId, {
        contacts: { displayName: settings.botOwner, contacts },
    });
}

module.exports = ownerCommand;
