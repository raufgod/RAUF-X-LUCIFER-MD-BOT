const card = require('../lib/cardStyle');
const fs = require('fs');
function setMode(isPublic) {
    let data = {};
    try { data = JSON.parse(fs.readFileSync('./data/messageCount.json')); } catch (_) {}
    data.isPublic = isPublic;
    fs.mkdirSync('./data', { recursive: true });
    fs.writeFileSync('./data/messageCount.json', JSON.stringify(data, null, 2));
}
async function publicCommand(sock, from, msg, isAdmin) {
    if (!isAdmin && !msg?.key?.fromMe) return await sock.sendMessage(from, { text: card.problem("Only the owner can use this command.", "Owner only") }, { quoted: msg });
    setMode(true);
    await sock.sendMessage(from, { text: card.panel({ icon: "🌍", title: "Mode changed", rows: [["🔓", "Mode", "PUBLIC"], ["👥", "Access", "Everyone can use commands"]] }) }, { quoted: msg });
}

module.exports = publicCommand;
