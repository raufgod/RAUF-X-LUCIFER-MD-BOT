const { callApi } = require('../lib/kingApiClient');
async function spotifydlCommand(sock, chatId, message, input) { return callApi('spotifydl', input || '', sock, chatId, message); }
module.exports = spotifydlCommand;
