// V2 alias routes to the same privacy-safe .vv implementation.
module.exports = async function vvPlus(sock, chatId, message) {
  return require('./viewonce')(sock, chatId, message);
};
