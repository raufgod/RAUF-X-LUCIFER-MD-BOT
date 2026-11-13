// .setname / .botname alias router entry (see lib/newMenuV2Bridge.js). Real logic: commands/ownerSettings.js
async function setnameCommand(sock, from, msg, isOwner, botData, saveBotData, userId, q) {
    if (!isOwner) return sock.sendMessage(from, { text: '❌ Only owner can use this command.' }, { quoted: msg });
    const ownerSettings = require('./ownerSettings');
    return ownerSettings.handle(sock, from, msg, { cmd: 'setbotname', arg: String(q || '').trim() });
}
module.exports = setnameCommand;
