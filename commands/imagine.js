const { callApi } = require('../lib/kingApiClient');
async function imagineCommand(sock, chatId, message, input) { return callApi('imagine', input || '', sock, chatId, message); }
module.exports = imagineCommand;
