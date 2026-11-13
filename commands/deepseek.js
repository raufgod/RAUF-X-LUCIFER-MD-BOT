const { callApi } = require('../lib/kingApiClient');
async function deepseekCommand(sock, chatId, message, input) { return callApi('deepseek', input || '', sock, chatId, message); }
module.exports = deepseekCommand;
