const { callApi } = require('../lib/kingApiClient');
async function facebookdlCommand(sock, chatId, message, input) { return callApi('facebookdl', input || '', sock, chatId, message); }
module.exports = facebookdlCommand;
