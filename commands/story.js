const { callApi } = require('../lib/kingApiClient');
async function storyCommand(sock, chatId, message, input) { return callApi('story', input || '', sock, chatId, message); }
module.exports = storyCommand;
