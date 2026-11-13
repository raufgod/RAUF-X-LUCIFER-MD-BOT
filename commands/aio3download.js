const { callApi } = require('../lib/kingApiClient');
async function aio3downloadCommand(sock, chatId, message, input) { return callApi('aio3', input || '', sock, chatId, message); }
module.exports = aio3downloadCommand;
