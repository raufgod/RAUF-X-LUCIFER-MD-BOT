const { callApi } = require('../lib/kingApiClient');
async function talkaiCommand(sock, chatId, message, input) { return callApi('talkai', input || '', sock, chatId, message); }
module.exports = talkaiCommand;
