const { callApi } = require('../lib/kingApiClient');
async function notegptCommand(sock, chatId, message, input) { return callApi('notegpt', input || '', sock, chatId, message); }
module.exports = notegptCommand;
