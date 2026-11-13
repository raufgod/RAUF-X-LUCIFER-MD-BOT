const { callApi } = require('../lib/kingApiClient');
async function pollinationaiCommand(sock, chatId, message, input) { return callApi('pollinationai', input || '', sock, chatId, message); }
module.exports = pollinationaiCommand;
