// Offline test of the Telegram pairing bot's ACCESS CONTROL (real lib/telegramPairing.js; Telegram, Baileys and other npm packages are replaced by fakes,
// nothing goes to the network). It does NOT test real Telegram delivery or real WhatsApp pairing.  Run: node scripts/test-telegram.js
const fs = require('fs'), os = require('os'), path = require('path'), EventEmitter = require('events'), assert = require('assert');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rxl-tg-')); process.chdir(TMP);
Object.assign(process.env, { TELEGRAM_BOT_TOKEN: '123:FAKE', TELEGRAM_SESSIONS_DIR: path.join(TMP, 'tgs'), TELEGRAM_ADMIN_IDS: '900', TELEGRAM_RESTRICT_TO_ALLOWED: 'true', TELEGRAM_ALLOWED_USERS: '111,222,900' });
delete process.env.TELEGRAM_PASSWORD_BOT_TOKEN;
const out = []; class FakeBot extends EventEmitter { constructor() { super(); } getMe() { return Promise.resolve({ username: 'fakebot' }); } getChatMember() { return Promise.resolve({ status: 'member' }); } answerCallbackQuery() { return Promise.resolve(); } deleteMessage() { return Promise.resolve(); } setMyCommands() { return Promise.resolve(); } editMessageText() { return Promise.resolve(); } }
for (const m of ['sendMessage', 'sendPhoto', 'sendVideo', 'sendDocument']) FakeBot.prototype[m] = function (chat, text) { out.push({ chat, text: String(text) }); return Promise.resolve({ message_id: out.length }); };
const generic = new Proxy(function () {}, { get: (t, k) => (k === 'then' ? undefined : k === '__esModule' ? false : generic), apply: () => generic, construct: () => generic });
const has = (m) => { try { require.resolve(m, { paths: [path.resolve(__dirname, '..')] }); return true; } catch (_) { return false; } };
const Mod = require('module'), orig = Mod._load; const fsx = Object.assign({}, fs, { ensureDirSync: (p) => fs.mkdirSync(p, { recursive: true }), ensureDir: async (p) => fs.mkdirSync(p, { recursive: true }), pathExists: async (p) => fs.existsSync(p), readJson: async (p) => JSON.parse(fs.readFileSync(p, 'utf8')), remove: async (p) => fs.rmSync(p, { recursive: true, force: true }), readdir: async (p) => fs.readdirSync(p) });
Mod._load = function (r, p, m) {
  if (r === 'node-telegram-bot-api') return FakeBot; if (r === 'fs-extra' && !has('fs-extra')) return fsx; if (r === 'dotenv') return { config() {} };
  if (/^\.\.?\//.test(r) || r.startsWith('node:') || Mod.builtinModules.includes(r)) { try { return orig.apply(this, arguments); } catch (e) { if (/^\.\.?\/(botSession|pairCard|brand|botConfig)/.test(r)) return generic; throw e; } }
  if (has(r)) return orig.apply(this, arguments); return generic;
};
const TG = require(path.resolve(__dirname, '..', 'lib', 'telegramPairing.js'));
let res = 0, fail = 0; const T = async (n, f) => { try { await f(); res++; console.log('  PASS', n); } catch (e) { fail++; console.log('  FAIL', n, '-', e.message); } };
const tick = () => new Promise((r) => setTimeout(r, 60));
(async () => {
  const bot = TG.startTelegramPairing(); assert(bot, 'bot did not start');
  const say = async (from, text, type = 'private') => { out.length = 0; bot.emit('message', { chat: { id: from, type }, from: { id: from, first_name: 'U' }, text }); await tick(); await tick(); return out.map((o) => o.text).join(' | '); };
  await T('restricted mode: a user who is not on the allowed list is refused', async () => { const r = await say(333, '/pair 919800000001'); assert(/restricted/i.test(r), r); });
  await T('group chats are ignored', async () => { const r = await say(111, '/help', 'supergroup'); assert.equal(r, ''); });
  await T('allowed user gets help text', async () => { const r = await say(111, '/help'); assert(/\/pair/.test(r), r); });
  await T('non-admin cannot open the admin panel (/admin gives no panel)', async () => { const r = await say(111, '/admin'); assert(!/Control Center|ADMIN PANEL|SETTINGS|BROADCAST/i.test(r), r); });
  await T('non-admin cannot start a broadcast or admin flow through plain text', async () => { const r = await say(111, '123456789'); assert.equal(r, ''); });
  await T('admin can open the admin panel', async () => { const r = await say(900, '/admin'); assert(r.length > 0, 'no reply'); });
  await T('invalid number for /pair is rejected', async () => { const r = await say(111, '/pair 123'); assert(/valid international|Use: \/pair|country/i.test(r), r); });
  await T('user cannot delete or see another user\'s session (sessions are stored per Telegram id)', async () => { fs.mkdirSync(path.join(TMP, 'tgs', '222', '919800000009'), { recursive: true }); const r = await say(111, '/deletesession 919800000009'); assert(/not one of your sessions|no sessions/i.test(r), r); assert(fs.existsSync(path.join(TMP, 'tgs', '222', '919800000009')), 'other user session folder was touched'); const l = await say(111, '/sessions'); assert(!/919800000009/.test(l), l); });
  await T('path-traversal characters in the number argument are stripped (digits only)', async () => { const r = await say(111, '/deletesession ../../222/919800000009'); assert(fs.existsSync(path.join(TMP, 'tgs', '222', '919800000009')), 'folder removed'); });
  console.log(`\nTELEGRAM ACCESS-CONTROL: ${res} passed, ${fail} failed`); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {} process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.stack || e); process.exit(2); });
