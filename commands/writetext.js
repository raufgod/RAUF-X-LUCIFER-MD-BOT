const { callApi } = require('../lib/kingApiClient');
async function writetextCommand(sock, chatId, message, input) { return callApi('writetext', input || '', sock, chatId, message); }
module.exports = writetextCommand;
