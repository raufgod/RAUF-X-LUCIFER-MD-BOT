'use strict';
// Offline test of "reply to an AI answer" + voice-to-AI. Run:  node scripts/test-ai-session.js
const Module = require('module'), os = require('os'), path = require('path'), fs = require('fs'), assert = require('assert');
process.env.AI_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'aisess-'));
const origLoad = Module._load;
let aiCalls = [];
Module._load = function (req, ...a) {
  if (req === 'axios') return { get: async (url, o) => { aiCalls.push(o.params.prompt); return { status: 200, data: { success: true, result: 'ANSWER#' + aiCalls.length } }; } };
  if (req === '@whiskeysockets/baileys') return { downloadContentFromMessage: async function* () { yield Buffer.from('fake-ogg'); } };
  return origLoad.call(this, req, ...a);
};
let fetchLog = [];
global.fetch = async (url, o) => {
  fetchLog.push(url);
  if (url.endsWith('/audio/transcriptions')) return { ok: true, status: 200, json: async () => ({ text: 'भारत की राजधानी क्या है' }) };
  if (url.endsWith('/chat/completions')) return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'नई दिल्ली' } }] }) };
  if (url.endsWith('/models')) return { ok: true, status: 200, json: async () => ({}) };
  throw new Error('unexpected ' + url);
};
const TTS = require('../lib/callAgent/tts'); const ttsCalls = []; TTS.synth = async (t, o) => { ttsCalls.push({ t, o }); return Buffer.from('opus'); };
const S = require('../lib/aiSession'); const { callApi } = require('../lib/kingApiClient');
let n = 0; const sent = [];
const sock = { __sessionKey: '911', __ownerNumber: '911', sendPresenceUpdate: async () => {}, sendMessage: async (jid, c) => { const m = { key: { id: 'BOT' + (++n), remoteJid: jid, fromMe: true } }; sent.push({ jid, c, m }); return m; } };
const chat = '919@s.whatsapp.net';
const mk = (id, msg) => ({ key: { id, remoteJid: chat, fromMe: false }, message: msg });
const reply = (id, text, quotedId) => mk(id, { extendedTextMessage: { text, contextInfo: { stanzaId: quotedId } } });
const voice = (id, quotedId) => mk(id, { audioMessage: { mimetype: 'audio/ogg', seconds: 4, contextInfo: quotedId ? { stanzaId: quotedId } : undefined } });
(async () => {
  // 1. first .gpt -> answer is tracked
  await callApi('gpt', 'hello', sock, chat, mk('U1', { conversation: '.gpt hello' }));
  const a1 = sent.pop(); assert(/ANSWER#1/.test(a1.c.text)); console.log('1 ok  first .gpt answered');
  // 2. reply to that answer in text -> same AI answers again with history, no command
  assert(await S.handleReply(sock, reply('U2', 'and who made you?', a1.m.key.id), { rawText: 'and who made you?' }));
  const a2 = sent.pop(); assert(/ANSWER#2/.test(a2.c.text));
  assert(/hello/.test(aiCalls[1]) && /ANSWER#1/.test(aiCalls[1]) && /who made you/.test(aiCalls[1])); console.log('2 ok  text reply continues chat with history');
  // 3. reply to the 2nd answer too (chain)
  assert(await S.handleReply(sock, reply('U3', 'thanks, one more', a2.m.key.id), { rawText: 'thanks, one more' })); sent.pop(); console.log('3 ok  chain of replies');
  // 4. unrelated reply / commands are not touched
  assert(!(await S.handleReply(sock, reply('U4', 'hi', 'SOMEONE_ELSE'), { rawText: 'hi' })));
  assert(!(await S.handleReply(sock, reply('U5', '.menu', a1.m.key.id), { rawText: '.menu' }))); console.log('4 ok  unrelated replies and commands ignored');
  // 5. voice reply WITHOUT key -> notice only, no AI call
  const before = aiCalls.length, f0 = fetchLog.length;
  assert(await S.handleReply(sock, voice('V1', a1.m.key.id), {})); const nk = sent.pop();
  assert(/Groq API key/.test(nk.c.text) && aiCalls.length === before && fetchLog.length === f0); console.log('5 ok  voice without key -> not processed, user told how to add key');
  // 6. .aikey saves the key (owner)
  const out = await S.runCommand(sock, mk('K1', { conversation: '.aikey gsk_' + 'a'.repeat(40) }), S.parseCommand('.aikey gsk_' + 'a'.repeat(40)));
  assert(/saved/.test(out) && S.getKey(sock)); assert(/not valid|does not look/.test(await S.runCommand(sock, mk('K2', {}), { arg: 'bad' }))); console.log('6 ok  .aikey saves / rejects');
  // 7. voice reply WITH key -> transcribed, answered by Groq, shown like AI answer, tracked, history kept
  assert(await S.handleReply(sock, voice('V2', a1.m.key.id), {})); const va = sent.pop();
  assert(va.c.audio && va.c.ptt === true && /opus/.test(va.c.mimetype) && !va.c.text); assert(ttsCalls.length === 1 && /नई दिल्ली/.test(ttsCalls[0].t) && ttsCalls[0].o.lang === 'hi');
  assert(fetchLog.some(u => u.endsWith('/audio/transcriptions'))); console.log('7 ok  voice with key -> answer comes back as a VOICE NOTE (Edge voice, Hindi)');
  // voice synthesis broken -> never silent, plain AI text instead
  const keep = TTS.synth; TTS.synth = async () => { throw new Error('edge down'); };
  assert(await S.handleReply(sock, voice('V3', a1.m.key.id), {})); const vf = sent.pop(); assert(/नई दिल्ली/.test(vf.c.text)); TTS.synth = keep; console.log('7b ok TTS failure -> text fallback');
  assert(await S.handleReply(sock, reply('U6', 'और बताओ', va.m.key.id), { rawText: 'और बताओ' })); assert(/राजधानी/.test(aiCalls[aiCalls.length - 1])); sent.pop(); console.log('8 ok  text reply to a voice-answer continues, history includes the voice question');
  // 9. ".gpt" as reply to a voice note
  const cmdMsg = mk('C1', { extendedTextMessage: { text: '.gpt', contextInfo: { stanzaId: 'VN', quotedMessage: { audioMessage: { mimetype: 'audio/ogg', seconds: 3 } } } } });
  await callApi('gpt', '', sock, chat, cmdMsg); assert(sent.pop().c.audio); console.log('9 ok  .gpt on a quoted voice note -> voice answer');
  console.log('\nALL PASSED');
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
