const { callApi } = require('../lib/kingApiClient');
async function imageaiCommand(sock, chatId, message, input) { return callApi('image', input || '', sock, chatId, message); }
module.exports = imageaiCommand;
