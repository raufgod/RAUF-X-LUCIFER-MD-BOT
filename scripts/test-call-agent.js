// Offline test of the voice agent. No real WhatsApp, TTS or AI service is used; they are replaced by small fakes.
// The ffmpeg opus conversion is REAL. Run: node scripts/test-call-agent.js
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), assert = require('assert'), { spawnSync } = require('child_process');
process.env.CALL_QUEUE_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'va-')), 'q.json');
process.env.CALL_FAST = '1'; process.env.CALL_ADMIN_SECRET = 'adm'; process.env.GROQ_API_KEY = 'k';
const CA = require('../lib/callAgent'), WA = require('../lib/callAgent/wa'), store = require('../lib/callAgent/store'), TTS = require('../lib/callAgent/tts'), brain = require('../lib/callAgent/brain'), K = require('../lib/callAgent/knowledge');
const ff = process.env.FFMPEG_PATH || 'ffmpeg'; const sine = () => spawnSync(ff, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=1', '-f', 'mp3', 'pipe:1'], { maxBuffer: 1e7 }).stdout;
let ttsCalls = []; TTS.setEngine(async (t, lang) => { ttsCalls.push({ t, lang }); return sine(); });
let aiCalls = []; brain.setAsk(async (key, q, sys) => { aiCalls.push({ q, sys }); return /spoken Hindi/.test(sys) ? '**जी** हाँ, डॉट प्ले लिखकर गाने का नाम लिखिए 🎵 https://x.y' : '**Ji** haan, dot play likhkar gaane ka naam likhiye 🎵 https://x.y'; });
WA.setDownloader(async () => Buffer.from('fake-ogg'));
const ok = (m) => console.log('  ✓', m);
const sent = []; let onWA = (n) => [{ exists: true, jid: n + '@s.whatsapp.net' }], open = true;
const sock = { user: { id: '919000000000:5@s.whatsapp.net' }, ws: { get isOpen() { return open; } }, signalRepository: { lidMapping: { getPNForLID: async () => null } },
  onWhatsApp: async (n) => onWA(n), presenceSubscribe: async () => {}, sendPresenceUpdate: async () => {}, readMessages: async () => {},
  sendMessage: async (jid, content, opt) => { sent.push({ jid, content, opt }); return { key: { id: 'S' + sent.length + Math.random().toString(36).slice(2, 6) } }; } };
WA.setSocket(sock);
// the website popup: register -> (visitor taps Continue) -> confirm. Tests register AND confirm, except where they check the unconfirmed state.
const reg = (b, ip) => { ip = ip || '9.9.' + Math.floor(Math.random() * 250) + '.1'; const r = CA.register(b, ip); if (r.out && r.out.awaiting && r.out.id) { CA.confirm({ id: r.out.id }, ip); const jb = store.load().jobs.find(x => x.id === r.out.id); if (jb) jb.contactedAt = Date.now(); } return r; };
const jobs = () => store.load().jobs;
const msg = (jid, body, extra) => Object.assign({ key: { remoteJid: jid, id: 'M' + Math.random().toString(36).slice(2), fromMe: false }, messageTimestamp: Math.floor(Date.now() / 1000), message: body }, extra);
const due = (j) => { j.dueAt = Date.now() - 1; };

(async () => {
  console.log('Registration');
  assert.equal(reg({ name: 'A', number: '919876543210', consent: true }).code, 400); assert.equal(reg({ name: 'Rahul', number: '123', consent: true }).code, 400);
  assert.equal(reg({ name: 'Rahul', number: '919876543210', consent: false }).code, 400); assert.equal(jobs().length, 0); ok('bad name / number / no consent are rejected, nothing queued');
  reg({ name: 'x', number: '919000000009', consent: true, website: 'spam' }); assert.equal(jobs().length, 0); ok('honeypot ignored');
  const t0 = Date.now(), r = reg({ name: 'राहुल <b>शर्मा</b>', number: '+91 98765-43210', consent: true }), j = jobs()[0], d = (j.dueAt - t0) / 60000;
  assert(r.out.scheduled && d >= 0.99 && d <= 1.51, 'delay ' + d); assert.equal(j.number, '919876543210'); assert.equal(j.name, 'राहुल शर्मा'); ok(`scheduled ${d.toFixed(2)} min after registering (default 1 - 1.5 min), number normalised, name cleaned: "${j.name}"`);
  const again = reg({ name: 'Rahul', number: '919876543210', consent: true }); assert(again.out.already && jobs().length === 1); ok('same number twice in 24h is not queued twice');
  const raw = CA.register({ name: 'Gopal', number: '919866666666', consent: true }, '8.8.8.8'); assert(raw.out.awaiting && raw.out.id && raw.out.owner === '919000000000' && /Gopal/.test(raw.out.hiText) && !/voice/i.test(raw.out.hiText));
  const jg = jobs().find(x => x.name === 'Gopal'); assert.equal(jg.status, 'awaiting'); due(jg); await CA.tick(); assert.equal(sent.length, 0); assert.equal(jg.status, 'awaiting'); ok('registered but did not tap Continue -> NO voice note');
  assert(CA.register({ name: 'Gopal', number: '919866666666', consent: true }, '8.8.8.8').out.awaiting); ok('registering again before Continue shows the same popup step again');
  assert.equal(CA.confirm({ id: 'nope' }, '8.8.8.8').code, 404); const cf = CA.confirm({ id: raw.out.id }, '8.8.8.8'), dg = (jg.dueAt - Date.now()) / 60000;
  assert(cf.out.ok && jg.status === 'pending' && dg > 0.9 && dg < 1.51, 'confirm delay ' + dg); ok(`Continue tapped -> voice note scheduled ${dg.toFixed(2)} min from then (1 - 1.5)`);
  due(jg); await CA.tick(); assert.equal(sent.length, 0); assert.equal(jg.status, 'pending'); ok('Continue tapped but NO message sent to the owner number yet -> still NO voice note');
  assert.equal(await WA.handleIncoming(sock, msg('919866666666@s.whatsapp.net', { conversation: 'Hi, I am Gopal' }), 'notify'), true); assert(jg.contactedAt && jg.dueAt > Date.now() && jg.dueAt < Date.now() + 11000); ok('first message sent after Continue -> voice note follows a few seconds later (not before)');
  for (let i = 0; i < 5; i++) reg({ name: 'Ab', number: '9198000000' + String(10 + i), consent: true }, '5.5.5.5'); assert.equal(reg({ name: 'Ab', number: '919811111199', consent: true }, '5.5.5.5').code, 429); ok('per-IP rate limit (5/hour)');
  jobs().splice(1); store.save();
  process.env.CALL_QUIET_HOURS = '21-9'; const night = Date.parse('2026-11-09T23:00:00+05:30'), a = CA._t.allowedAt(night); assert(a > night); assert.equal(CA._t.allowedAt(Date.parse('2026-11-09T15:00:00+05:30')), Date.parse('2026-11-09T15:00:00+05:30')); process.env.CALL_QUIET_HOURS = 'off'; ok('optional quiet hours work; OFF by default so any-time registrations go out in about a minute');

  console.log('Welcome voice note');
  await CA.tick(); assert.equal(sent.length, 0); ok('nothing is sent before the minute is over');
  due(j); open = false; await CA.tick(); assert.equal(sent.length, 0); assert.equal(j.status, 'pending'); assert.equal(j.attempts || 0, 0); ok('WhatsApp reconnecting -> waits, does not burn a retry'); open = true;
  due(j); await CA.tick();
  assert.equal(sent.length, 2); const [v, t] = sent;
  assert.equal(v.jid, '919876543210@s.whatsapp.net'); assert.equal(v.content.ptt, true); assert.equal(v.content.mimetype, 'audio/ogg; codecs=opus'); assert(v.opt.noCard);
  assert.equal(v.content.audio.slice(0, 4).toString(), 'OggS'); assert(v.content.audio.includes(Buffer.from('OpusHead'))); ok('first message is a real ogg/opus voice note (PTT), without the forwarded banner');
  assert(/आर्या/.test(ttsCalls[0].t) && /ए आई असिस्टेंट/.test(ttsCalls[0].t) && /राहुल/.test(ttsCalls[0].t)); assert.equal(ttsCalls[0].lang, 'hi'); ok('script greets by name and says: "मैं आर्या हूँ, राउफ एक्स लूसिफ़र की AI असिस्टेंट"');
  assert(t.content.text.includes('STOP') && t.content.text.includes('.menu')); assert.equal(j.status, 'sent'); assert(j.audioSent); ok('follow-up text with .menu and STOP; job marked sent');
  due(reg({ name: 'Sita', number: '919811111111', consent: true }) && jobs()[1]); await CA.tick(); assert.equal(sent.length, 4); ok('second person gets their own note');

  console.log('Failure handling');
  onWA = () => [{ exists: false }]; reg({ name: 'Noor', number: '919822222222', consent: true }); let jn = jobs()[2]; due(jn); await CA.tick(); assert.equal(jn.status, 'no-whatsapp'); ok('number not on WhatsApp -> skipped, no retries'); onWA = (n) => [{ exists: true, jid: n + '@s.whatsapp.net' }];
  reg({ name: 'Own', number: '919000000000', consent: true }); jn = jobs()[3]; due(jn); await CA.tick(); assert.equal(jn.status, 'skipped'); ok("the bot's own number is never messaged");
  TTS.setEngine(async () => { throw new Error('tts down'); }); reg({ name: 'Ravi', number: '919833333333', consent: true }); jn = jobs()[4];
  const before = sent.length; for (let i = 0; i < 3; i++) { due(jn); await CA.tick(); } assert.equal(jn.status, 'sent'); assert.equal(sent.length, before + 1); assert(/text only/.test(jn.note)); assert(!sent[sent.length - 1].content.audio); ok('voice keeps failing -> 3 tries, then the same info goes as text (never silent)');
  TTS.setEngine(async () => sine());
  jn.status = 'sending'; jn.audioSent = true; store.reset(); store.flushNow(); fs.writeFileSync(process.env.CALL_QUEUE_FILE, JSON.stringify({ jobs: [Object.assign({}, jn)], dnc: [] })); store.reset(); assert.equal(store.load().jobs[0].status, 'sent'); ok('restart in the middle of a send -> voice note is not sent twice');
  fs.writeFileSync(process.env.CALL_QUEUE_FILE, JSON.stringify({ jobs: [], dnc: [] })); store.reset(); assert.equal((fs.statSync(process.env.CALL_QUEUE_FILE).mode & 0o777).toString(8).length, 3); store.load();

  console.log('Hourly / daily caps');
  process.env.CALL_MAX_PER_HOUR = '2'; const db = store.load(); db.jobs.push({ id: 'a', name: 'A1', number: '919844444441', status: 'sent', sentAt: Date.now() - 1000, createdAt: Date.now() }, { id: 'b', name: 'B1', number: '919844444442', status: 'sent', sentAt: Date.now() - 1000, createdAt: Date.now() });
  reg({ name: 'Cap', number: '919844444443', consent: true }); const jc = jobs().find(x => x.name === 'Cap'); due(jc); const n0 = sent.length; await CA.tick(); assert.equal(sent.length, n0); assert(jc.dueAt > Date.now() + 4 * 60000); ok('hourly cap holds extra people back so the owner number is not flooded'); delete process.env.CALL_MAX_PER_HOUR; jobs().length = 0;

  console.log('Replies');
  reg({ name: 'Anil', number: '919855555555', consent: true }); const ja = jobs()[0]; due(ja); await CA.tick(); assert.equal(ja.status, 'sent');
  const PN = '919855555555@s.whatsapp.net', last = () => sent[sent.length - 1];
  assert(ja.ids && ja.ids.length >= 2); ok('ids of Arya\'s own messages (voice note + text) are remembered');
  // a person\'s reply to one of Arya\'s messages (text or voice), as WhatsApp delivers it
  const rq = (x) => { const ctx = { stanzaId: ja.ids[ja.ids.length - 1] }; return msg(PN, typeof x === 'string' ? { extendedTextMessage: { text: x, contextInfo: ctx } } : { audioMessage: Object.assign({}, x, { contextInfo: ctx }) }); };
  let n = sent.length; assert.equal(await WA.handleIncoming(sock, msg(PN, { conversation: 'gaana kaise sunein?' }), 'notify'), true); assert.equal(sent.length, n); ok('a plain message (not a reply to Arya) gets NO answer from Arya');
  assert.equal(await WA.handleIncoming(sock, msg(PN, { audioMessage: { seconds: 4 } }), 'notify'), true); assert.equal(sent.length, n); ok('a plain voice note (not a reply to Arya) gets NO answer either');
  assert.equal(await WA.handleIncoming(sock, msg(PN, { extendedTextMessage: { text: 'kya hai', contextInfo: { stanzaId: 'someone-elses-message' } } }), 'notify'), true); assert.equal(sent.length, n); ok('a reply to some OTHER message gets no answer');
  assert.equal(await WA.handleIncoming(sock, rq('गाना कैसे सुनें?'), 'notify'), true);
  assert.equal(sent.length, n + 1); assert.equal(last().content.text, 'Ji haan, dot play likhkar gaane ka naam likhiye'); assert(!/[\u0900-\u097F]/.test(last().content.text)); ok('REPLY by TEXT -> TEXT answer in Roman Hindi (markdown, emoji, link stripped, no Devanagari)');
  assert(/RAUF x LUCIFER/.test(aiCalls[0].sys) && /\.play/.test(aiCalls[0].sys) && /Roman Hindi/.test(aiCalls[0].sys) && /never Devanagari/.test(aiCalls[0].sys)); assert(aiCalls[0].sys.length < 1800); ok('prompt carries the bot\'s own command data and stays small (' + aiCalls[0].sys.length + ' chars)');
  const stt = http.createServer((q, s) => { q.resume(); q.on('end', () => { s.setHeader('content-type', 'application/json'); s.end(JSON.stringify({ text: 'डॉट प्ले कैसे इस्तेमाल करते हैं' })); }); }); await new Promise(r => stt.listen(0, r)); process.env.STT_BASE_URL = 'http://127.0.0.1:' + stt.address().port;
  n = sent.length; await WA.handleIncoming(sock, rq({ seconds: 5, mimetype: 'audio/ogg; codecs=opus', ptt: true }), 'notify');
  assert.equal(sent.length, n + 1); assert.equal(last().content.ptt, true); assert.equal(last().content.audio.slice(0, 4).toString(), 'OggS'); assert(/डॉट प्ले/.test(aiCalls[aiCalls.length - 1].q)); assert(/spoken Hindi/.test(aiCalls[aiCalls.length - 1].sys)); ok('REPLY by VOICE -> transcribed -> understood -> VOICE answer (Devanagari so the Hindi voice reads it)');
  n = sent.length; await WA.handleIncoming(sock, rq('ye voice mein batao'), 'notify'); assert(last().content.text && !last().content.ptt); ok('even if the text says \"voice mein batao\": a text reply gets a text answer (the flow decides, not keywords)');
  n = sent.length; assert.equal(await WA.handleIncoming(sock, msg(PN, { conversation: '.menu' }), 'notify'), false); assert.equal(sent.length, n); ok('real commands (.menu) are left to the normal bot');
  assert.equal(await WA.handleIncoming(sock, msg('919800000000@s.whatsapp.net', { conversation: 'hello' }), 'notify'), false); assert.equal(await WA.handleIncoming(sock, msg('1203@g.us', { conversation: 'hello' }), 'notify'), false); assert.equal(await WA.handleIncoming(sock, msg(PN, { imageMessage: {} }), 'notify'), false); assert.equal(await WA.handleIncoming(sock, msg(PN, { conversation: 'hi' }), 'append'), false); ok('strangers, groups, images and history-sync messages are ignored');
  assert.equal(await WA.handleIncoming(sock, msg(PN, { conversation: 'hi' }, { messageTimestamp: Math.floor(Date.now() / 1000) - 3600 }), 'notify'), false); ok('old messages delivered late are not answered');
  const dup = rq('repeat'); n = sent.length; await WA.handleIncoming(sock, dup, 'notify'); await WA.handleIncoming(sock, dup, 'notify'); assert.equal(sent.length, n + 1); ok('the same message delivered twice is answered once');
  const L = '99887766@lid'; n = sent.length; assert.equal(await WA.handleIncoming(sock, msg(L, { conversation: 'hello' }, {}), 'notify'), false);
  const lm = rq('kya hai ye'); lm.key.remoteJid = L; lm.key.remoteJidAlt = PN; assert.equal(await WA.handleIncoming(sock, lm, 'notify'), true); assert.equal(ja.lid, L); const l2 = rq('aur batao'); l2.key.remoteJid = L; assert.equal(await WA.handleIncoming(sock, l2, 'notify'), true); ok('new-style @lid chats are matched through the alternate number and remembered');
  n = sent.length; await WA.handleIncoming(sock, rq({ seconds: 200 }), 'notify'); assert(/chhota/.test(last().content.text) && !/[\u0900-\u097F]/.test(last().content.text)); ok('too-long voice note -> polite text');
  const oldKey = process.env.GROQ_API_KEY; delete process.env.GROQ_API_KEY; await WA.handleIncoming(sock, rq({ seconds: 5 }), 'notify'); assert(/likhkar/.test(last().content.text)); process.env.GROQ_API_KEY = oldKey; ok('no speech-to-text key -> asks to type instead (never crashes, never silent)');
  brain.setAsk(async () => { throw new Error('all providers busy'); }); await WA.handleIncoming(sock, rq('ping kya hai'), 'notify'); assert(/ping/.test(last().content.text) && !/[\u0900-\u097F]/.test(last().content.text)); ok('AI busy -> answers from the command list instead');
  brain.setAsk(async () => 'As ChatGPT by OpenAI I can help'); await WA.handleIncoming(sock, rq('sticker'), 'notify'); assert(!/ChatGPT|OpenAI/.test(last().content.text)); ok('answers that name an AI vendor are replaced');
  brain.setAsk(async () => 'Theek hai.');
  console.log('Opt-out and limits');
  const dnc = (v) => { n = sent.length; return WA.handleIncoming(sock, msg(PN, { conversation: v }), 'notify'); };
  ja.turns = 19; await WA.handleIncoming(sock, rq('ek sawal'), 'notify'); ja.turns = 20; await WA.handleIncoming(sock, rq('aur'), 'notify'); assert(/seema/.test(last().content.text)); n = sent.length; assert.equal(await WA.handleIncoming(sock, rq('phir'), 'notify'), false); assert.equal(sent.length, n); ok('20 answers per person per day, one polite notice, then silence (no endless bot-to-bot loops)');
  ja.turns = 0; await dnc('STOP'); assert(/will not receive any more/.test(last().content.text)); assert(store.load().dnc.includes('919855555555')); assert.equal(ja.status, 'opted-out'); assert.equal(await WA.handleIncoming(sock, msg(PN, { conversation: 'hello' }), 'notify'), false); ok('STOP -> confirmed, number blocked, no more replies');
  assert.equal(reg({ name: 'Anil', number: '919855555555', consent: true }).out.scheduled, false); assert.equal(jobs().filter(x => x.number === '919855555555').length, 1); ok('opted-out number cannot be re-queued');
  assert(WA._t.STOP.test('बंद') && WA._t.STOP.test(' stop. ') && !WA._t.STOP.test('stop kaise kare') && WA._t.WANT_VOICE.test('voice me batao') && WA._t.WANT_TEXT.test('text mein likh ke do') && !WA._t.WANT_VOICE.test('voice note kaise bhejte hain')); ok('keyword detectors do not fire on normal questions');

  const webm = spawnSync(ff, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=400:duration=1', '-c:a', 'libopus', '-f', 'webm', 'pipe:1'], { maxBuffer: 1e7 }).stdout;
  const conv = await TTS.toOpus(webm); assert.equal(conv.slice(0, 4).toString(), 'OggS'); ok('WEBM/Opus from the Edge voice converts to a WhatsApp ogg/opus voice note (real ffmpeg)');
  console.log('Admin + TTS plugin');
  const routes = {}; CA.attach({ post: (p, f) => routes['POST ' + p] = f, get: (p, f) => routes['GET ' + p] = f }); let out; const res = { setHeader() {}, status(c) { out = { c }; return this; }, json(x) { out = Object.assign(out || { c: 200 }, { j: x }); } };
  routes['GET /api/call/admin']({ headers: {} }, res); assert.equal(out.c, 401); routes['GET /api/call/admin']({ headers: { 'x-call-admin-secret': 'adm' } }, res); assert(out.j.ok && !JSON.stringify(out.j).includes('919855555555')); ok('admin endpoint locked; numbers masked in its output');
  const spoken = TTS.speakable('Send .menu, AI is fun https://a.b', 'hi'); assert.equal(spoken, 'Send डॉट menu, ए आई is fun'); assert.equal(TTS.speakable('AI .menu', 'en'), 'AI .menu'); assert.equal(TTS.voiceFor('hi'), 'hi-IN-SwaraNeural'); ok('TTS text prep and female voices (hi-IN-SwaraNeural, en-IN-NeerjaNeural ...)');
  const mod = (await import('../features/Plugins/text-to-speech.js')).default; const ps = []; sent.length = 0;
  await mod.start({ sendMessage: async (j, c, o) => { ps.push(c); }, sendPresenceUpdate: async () => {} }, { from: 'x@s.whatsapp.net', reply: async () => {}, quoted: null }, { inputCMD: 'sayhindi', text: 'नमस्ते', prefix: '.', doReact: async () => {}, args: ['नमस्ते'], isMedia: false });
  assert(ps[0].ptt && ps[0].audio.slice(0, 4).toString() === 'OggS'); ok('existing .sayhindi command now sends an opus voice note through the new engine');
  store.flushNow(); stt.close(); console.log('\nALL TESTS PASSED'); process.exit(0);
})().catch(e => { console.error('\nFAILED:', e.stack || e); process.exit(1); });
