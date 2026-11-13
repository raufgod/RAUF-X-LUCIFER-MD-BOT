const { callApi } = require('../lib/kingApiClient');
async function lighteffectsCommand(sock, chatId, message, input) { return callApi('lighteffects', input || '', sock, chatId, message); }
module.exports = lighteffectsCommand;
