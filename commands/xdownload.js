const { callApi } = require('../lib/kingApiClient');
async function xdownloadCommand(sock, chatId, message, input) { return callApi('x', input || '', sock, chatId, message); }
module.exports = xdownloadCommand;
