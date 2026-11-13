const { callApi } = require('../lib/kingApiClient');
async function mediafiredlCommand(sock, chatId, message, input) { return callApi('mediafiredl', input || '', sock, chatId, message); }
module.exports = mediafiredlCommand;
