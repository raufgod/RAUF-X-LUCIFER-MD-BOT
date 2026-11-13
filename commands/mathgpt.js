const { callApi } = require('../lib/kingApiClient');
async function mathgptCommand(sock, chatId, message, input) { return callApi('mathgpt', input || '', sock, chatId, message); }
module.exports = mathgptCommand;
