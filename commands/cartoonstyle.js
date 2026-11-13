const { callApi } = require('../lib/kingApiClient');
async function cartoonstyleCommand(sock, chatId, message, input) { return callApi('cartoonstyle', input || '', sock, chatId, message); }
module.exports = cartoonstyleCommand;
