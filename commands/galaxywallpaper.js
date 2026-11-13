const { callApi } = require('../lib/kingApiClient');
async function galaxywallpaperCommand(sock, chatId, message, input) { return callApi('galaxywallpaper', input || '', sock, chatId, message); }
module.exports = galaxywallpaperCommand;
