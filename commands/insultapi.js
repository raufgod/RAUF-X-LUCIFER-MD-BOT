const { callApi } = require('../lib/kingApiClient');
async function insultApiCommand(sock, chatId, message, input) { return callApi('insult', input || 'insult', sock, chatId, message); }
module.exports = insultApiCommand;
