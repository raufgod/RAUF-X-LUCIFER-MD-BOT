const { callApi } = require('../lib/kingApiClient');
async function airmoreCommand(sock, chatId, message, input) { return callApi('airmore', input || '', sock, chatId, message); }
module.exports = airmoreCommand;
