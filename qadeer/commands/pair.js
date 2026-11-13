module.exports = {
  pattern: "pair", desc: "Show safe pairing guidance", category: "utility", use: ".pair2",
  execute: async (conn, message, m, { from, reply }) => {
    const settings = require("../../settings");
    return reply(`🔐 *${settings.botName} Pairing*\n\nUse the pairing code shown by your own hosting console during first setup. This command will not send your phone number or session to a third-party pairing website.`);
  }
};
