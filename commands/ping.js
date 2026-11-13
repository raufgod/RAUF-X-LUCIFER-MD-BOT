const card = require('../lib/cardStyle');
const settings = require('../settings');

// .ping — one clean card (sent once, so the channel card stays on it)
async function pingCommand(sock, chatId, message) {
    const started = Date.now();
    const botName = settings.botName || 'RAUF × LUCIFER MD BOT';
    // Speed = time since the message was sent from the phone until the bot handles it.
    // WhatsApp timestamps have 1-second precision; if the phone/server clock is off we use the bot's own handling time instead.
    const ts = message?.messageTimestamp;
    const sentAt = Number(typeof ts === 'object' && ts !== null ? (ts.low ?? ts.toNumber?.() ?? 0) : ts || 0) * 1000;
    // WhatsApp cuts the send time to whole seconds, so on average 500 ms is added by the rounding itself; remove that part.
    let ms = sentAt ? started - sentAt - 500 : 0;
    if (ms <= 0 && sentAt) ms = Math.max(1, Date.now() - started) + 40;
    if (!(ms > 0 && ms < 30000)) ms = Math.max(1, Date.now() - started);
    const sp = Math.round(ms);
    const grade = sp < 200 ? '🟢 Excellent' : sp < 600 ? '🟡 Good' : '🔴 Slow';
    const text = card.panel({ icon: '🏓', title: 'Pong!', rows: [['⚡', 'Speed', `${sp} ms`], ['📶', 'Status', `Online · ${grade}`], ['⏱️', 'Uptime', card.dur(process.uptime())]] });
    await sock.sendMessage(chatId, { text, ...require('../lib/pairCard').webCard() }, { quoted: message });   // small tappable card -> pairing website
}

module.exports = pingCommand;
