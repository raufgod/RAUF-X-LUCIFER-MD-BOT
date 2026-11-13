'use strict';
// RAUF × LUCIFER MD BOT — Telegram PASSWORD bot for the website lock.
// Needs its own token (BotFather → new bot): TELEGRAM_PASSWORD_BOT_TOKEN.
// Same force-join channels as the pairing bot (membership is checked through the pairing bot, which is the channel admin).
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const gate = require('./webGate');

const token = process.env.TELEGRAM_PASSWORD_BOT_TOKEN || '';
const btn = (text, o) => ({ text, ...o });
const kb = rows => ({ reply_markup: { inline_keyboard: rows } });
const brand = () => { try { return require('../settings').botName; } catch (_) { return 'RAUF × LUCIFER MD BOT'; } };

function start() {
  if (global.__webPwBot) return global.__webPwBot;
  if (!token) { console.log('[Password bot] Disabled: TELEGRAM_PASSWORD_BOT_TOKEN is not set (website lock stays OFF).'); return null; }
  const bot = new TelegramBot(token, { polling: { params: { allowed_updates: ['message', 'callback_query'] } } });
  global.__webPwBot = bot;
  bot.on('polling_error', e => console.error('[Password bot polling]', e.message));
  bot.getMe().then(me => { gate.setBotUsername(me.username); console.log(`[Password bot] @${me.username} ready — website lock is ${gate.isOn() ? 'ON' : 'OFF'}.`); }).catch(e => console.error('[Password bot]', e.message));
  const TP = () => require('./telegramPairing');

  async function sendJoin(chatId, missing) {
    const rows = missing.map((c, i) => [btn(`📢 Join ${c.title || 'Channel ' + (i + 1)}`, { url: c.url, style: 'primary' })]);
    rows.push([btn('✅ Verify', { callback_data: 'verify', style: 'success' })]);
    return bot.sendMessage(chatId, `🔒 ACCESS LOCKED\n\nTo get the website password you must join ${missing.length > 1 ? 'all our official channels' : 'our official channel'} first.\n\n1️⃣ Tap every “📢 Join” button\n2️⃣ Come back and tap “✅ Verify”`, kb(rows));
  }
  async function offer(chatId, uid) {
    let g; try { g = await TP().checkChannels(uid); } catch (_) { g = { ok: true, missing: [] }; }
    if (!g.ok) return sendJoin(chatId, g.missing);
    const rl = gate.canIssue(uid);
    if (!rl.ok) return bot.sendMessage(chatId, `⏳ Please wait ${rl.wait}s before asking for a new password.`);
    const code = gate.issue(uid);
    return bot.sendMessage(chatId,
      `🔑 YOUR WEBSITE PASSWORD\n\n<code>${code}</code>\n\n⏱ Valid for ${gate.TTL_MS / 60000} minutes\n1️⃣ Single use — works once\n👤 Only for you\n\nOpen the website and enter this password to unlock it.`,
      { parse_mode: 'HTML', ...kb([[btn('🔄 New password', { callback_data: 'new', style: 'success' })]]) });
  }

  bot.on('message', msg => {
    if (!msg.from || msg.from.is_bot || msg.chat.type !== 'private') return;
    offer(msg.chat.id, msg.from.id).catch(e => console.error('[Password bot]', e.message));
  });
  bot.on('callback_query', async q => {
    try {
      const chatId = q.message?.chat?.id; if (!chatId) return;
      if (q.data === 'verify' || q.data === 'new') {
        const g = await TP().checkChannels(q.from.id).catch(() => ({ ok: true, missing: [] }));
        if (!g.ok) return void bot.answerCallbackQuery(q.id, { text: `❌ You have not joined ${g.missing.length} channel(s) yet.`, show_alert: true });
        await bot.answerCallbackQuery(q.id);
        if (q.data === 'verify') { try { await bot.deleteMessage(chatId, q.message.message_id); } catch (_) {} }
        return void offer(chatId, q.from.id);
      }
      bot.answerCallbackQuery(q.id).catch(() => {});
    } catch (e) { console.error('[Password bot cb]', e.message); }
  });
  return bot;
}
module.exports = { start };
