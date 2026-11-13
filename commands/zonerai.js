const { callApi } = require('../lib/kingApiClient');
async function zoneraiCommand(sock, chatId, message, input) { return callApi('zonerai', input || '', sock, chatId, message); }
module.exports = zoneraiCommand;
