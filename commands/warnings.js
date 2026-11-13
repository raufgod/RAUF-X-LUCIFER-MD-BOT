const card = require('../lib/cardStyle');
const fs = require('fs');
const path = require('path');

const warningsFilePath = path.join(__dirname, '../data/warnings.json');

function loadWarnings() {
    if (!fs.existsSync(warningsFilePath)) {
        fs.writeFileSync(warningsFilePath, JSON.stringify({}), 'utf8');
    }
    const data = fs.readFileSync(warningsFilePath, 'utf8');
    return JSON.parse(data);
}

async function warningsCommand(sock, chatId, mentionedJidList) {
    const warnings = loadWarnings();

    if (mentionedJidList.length === 0) {
        await sock.sendMessage(chatId, { text: card.problem('Please mention a user to check warnings.\nExample: .warnings @user', 'Warnings') });
        return;
    }

    const userToCheck = mentionedJidList[0];
    const warningCount = warnings[userToCheck] || 0;

    await sock.sendMessage(chatId, { text: card.panel({ icon: '⚠️', title: 'Warnings', rows: [['👤', 'User', '@' + String(userToCheck).split('@')[0]], ['📛', 'Warnings', `${warningCount}`]] }), mentions: [userToCheck] });
}

module.exports = warningsCommand;
