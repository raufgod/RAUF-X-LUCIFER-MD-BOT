const { callApi } = require('../lib/kingApiClient');
async function gptCommand(sock, chatId, message, input) { return callApi('gpt', input || '', sock, chatId, message); }
module.exports = gptCommand;
