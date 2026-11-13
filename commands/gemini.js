const { callApi } = require('../lib/kingApiClient');
async function geminiCommand(sock, chatId, message, input) { return callApi('gemini', input || '', sock, chatId, message); }
module.exports = geminiCommand;
