const { callApi } = require('../lib/kingApiClient');
async function effectcloudsCommand(sock, chatId, message, input) { return callApi('effectclouds', input || '', sock, chatId, message); }
module.exports = effectcloudsCommand;
