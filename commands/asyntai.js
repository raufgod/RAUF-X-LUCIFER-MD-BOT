const { callApi } = require('../lib/kingApiClient');
async function asyntaiCommand(sock, chatId, message, input) { return callApi('asyntai', input || '', sock, chatId, message); }
module.exports = asyntaiCommand;
