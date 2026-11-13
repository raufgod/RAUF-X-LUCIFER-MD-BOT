'use strict';
// Everything that touches WhatsApp: the welcome voice note (sent from the bot's own paired number) and the replies.
const store = require('./store'), K = require('./knowledge'), TTS = require('./tts'), STT = require('./stt'), brain = require('./brain');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const num = (k, d) => { const v = Number(process.env[k]); return Number.isFinite(v) && v >= 0 ? v : d; };
const pace = (a, b) => (process.env.CALL_FAST === '1' ? 0 : rnd(a, b));          // human-like pauses (switched off in tests)
const coded = (code, final) => { const e = new Error(code); e.code = code; e.final = !!final; return e; };
// Ids of every message Arya sent to a person (saved in the queue file). She answers ONLY when the person replies to one of them.
const track = (job, res) => { try { const id = res && res.key && res.key.id; if (!job || !id) return; job.ids = Array.isArray(job.ids) ? job.ids : []; if (!job.ids.includes(id)) job.ids.push(id); if (job.ids.length > 60) job.ids.splice(0, job.ids.length - 60); store.save(); } catch (_) {} };
const quotedId = (m) => { const x = (m && (m.extendedTextMessage || m.audioMessage)) || null; return String((x && x.contextInfo && x.contextInfo.stanzaId) || ''); };

let sockRef = null, downloader = null;
const setSocket = (s) => { sockRef = s; };
const setDownloader = (f) => { downloader = f; };
const dry = () => process.env.CALL_DRYRUN === '1';
function ready() { if (dry()) return true; const s = sockRef; return !!(s && s.user && !(s.ws && s.ws.isOpen === false)); }
const digits = (j) => String(j || '').split('@')[0].split(':')[0].replace(/\D/g, '');
const mask = (n) => String(n).slice(0, 3) + '******' + String(n).slice(-2);
// The number that sends the voice notes = the bot's own paired (owner) number. Shown on the website so the visitor can say Hi first.
function ownerNumber() {
  const d = digits(sockRef && sockRef.user && sockRef.user.id);
  return d || String(process.env.PAIRING_NUMBER || process.env.OWNER_NUMBER || '').replace(/\D/g, '');
}

// ---------- 1) welcome voice note
async function sendIntro(job, onAudio) {
  if (dry()) { console.log(`[call-agent] DRY-RUN voice note -> ${mask(job.number)} (${job.name})`); job.jid = job.number + '@s.whatsapp.net'; return { jid: job.jid }; }
  if (!ready()) throw coded('WA_NOT_READY');
  const sock = sockRef; let jid = job.jid;
  if (!jid) {
    const r = await sock.onWhatsApp(job.number); const x = Array.isArray(r) ? r[0] : null;
    if (!x || !x.exists) throw coded('NOT_ON_WHATSAPP', true);
    jid = x.jid;
  }
  if (digits(jid) === digits(sock.user && sock.user.id)) throw coded('OWN_NUMBER', true);     // never message the bot's own number
  const audio = await TTS.synth(K.introScript(job.name), { lang: 'hi' });                    // build the audio first: if it fails, nothing half-sent
  try { await sock.presenceSubscribe(jid); } catch (_) {}
  try { await sock.sendPresenceUpdate('recording', jid); } catch (_) {}
  await sleep(pace(1800, 3500));
  track(job, await sock.sendMessage(jid, { audio, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { noCard: true }));
  job.jid = jid; if (onAudio) onAudio();
  try { await sock.sendPresenceUpdate('paused', jid); } catch (_) {}
  await sleep(pace(1500, 3000));
  track(job, await sock.sendMessage(jid, { text: K.followUpText(job.name) }, { noCard: true }));
  return { jid };
}
async function sendTextOnly(job) {          // last resort when voice synthesis keeps failing: the user still gets the information
  if (dry() || !ready()) throw coded('WA_NOT_READY');
  const sock = sockRef; let jid = job.jid;
  if (!jid) { const r = await sock.onWhatsApp(job.number); const x = Array.isArray(r) ? r[0] : null; if (!x || !x.exists) throw coded('NOT_ON_WHATSAPP', true); jid = x.jid; }
  track(job, await sock.sendMessage(jid, { text: K.followUpText(job.name) }, { noCard: true })); job.jid = jid; return { jid };
}

// ---------- 2) replies: text or voice in -> understood -> answered by voice or text
const STOP = /^\s*(stop|unsubscribe|opt[\s-]?out|band|bandh|बंद|रोको|रुको|मत\s?भेजो|मैसेज\s?बंद)\s*[.!।]*\s*$/i;
const WANT_VOICE = /(voice|वॉइस|वायस|आवाज़?)\s*(में|मे|me|mein|se|से)?\s*(बता|बोल|जवाब|भेज|समझा|reply|answer|bata|bol|bhej|samjha|do\b|दो)|(बोलकर|बोल\s?के|bol\s?ke|bolkar)/i;
const WANT_TEXT = /(text|टेक्स्ट|लिखकर|लिख\s?के|likh\s?ke|likhkar|मैसेज)\s*(में|मे|me|mein)?\s*(बता|जवाब|भेज|समझा|लिख|reply|answer|bata|likh|bhej|samjha|do\b|दो)|(लिखकर|लिख\s?के|likh\s?ke|likhkar)\s*(बता|bata|समझा)/i;
const WINDOW = 24 * 3600 * 1000, seen = new Set(), chains = new Map();

async function findJob(sock, mek, pending) {
  const now = Date.now(), live = store.load().jobs.filter(j => pending ? ((j.status === 'pending' || j.status === 'awaiting') && now - j.createdAt < WINDOW) : (j.status === 'sent' || (j.status === 'sending' && j.audioSent)) && now - (j.sentAt || j.createdAt) < WINDOW);
  if (!live.length) return null;
  const k = mek.key, ids = new Set(), add = (v) => { const s = String(v || ''); if (s) { ids.add(s); ids.add(digits(s)); } };
  add(k.remoteJid); add(k.remoteJidAlt); add(k.senderPn); add(k.participantPn);
  if (String(k.remoteJid || '').endsWith('@lid')) { try { const pn = await sock.signalRepository.lidMapping.getPNForLID(String(k.remoteJid).split('@')[0]); add(pn); } catch (_) {} }
  const job = live.find(j => ids.has(j.jid) || ids.has(j.number) || (j.lid && ids.has(j.lid)));
  if (job && String(k.remoteJid || '').endsWith('@lid') && job.lid !== k.remoteJid) { job.lid = k.remoteJid; store.save(); }
  if (!job && process.env.CALL_DEBUG === '1') console.log('[call-agent] reply from a number that could not be matched:', String(k.remoteJid).slice(0, 6) + '…');
  return job || null;
}
async function download(audio) {
  if (downloader) return downloader(audio);
  const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
  const st = await downloadContentFromMessage(audio, 'audio'); const b = []; for await (const c of st) b.push(c); return Buffer.concat(b);
}
async function reply(sock, jid, job, answer, asVoice, quoted) {
  if (asVoice) {
    try {
      const audio = await TTS.synth(answer, { lang: 'hi' });
      try { await sock.sendPresenceUpdate('recording', jid); } catch (_) {}
      await sleep(pace(600, 1400));
      track(job, await sock.sendMessage(jid, { audio, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { noCard: true })); return;
    } catch (e) { console.error('[call-agent] voice reply failed, sending text:', String(e.message).slice(0, 100)); }
  }
  track(job, await sock.sendMessage(jid, { text: answer }, { noCard: true, quoted }));
}
async function converse(sock, mek, job, jid, tx) {
  const m = mek.message, audio = m.audioMessage;
  try { await sock.readMessages([mek.key]); } catch (_) {}
  try { await sock.sendPresenceUpdate(audio ? 'recording' : 'composing', jid); } catch (_) {}
  let text = tx, fromVoice = false;
  if (audio) {
    fromVoice = true;
    if (Number(audio.seconds) > 90 || Number(audio.fileLength) > 3 * 1024 * 1024) return reply(sock, jid, job, 'Voice note thoda lamba hai. Kripya 1 minute se chhota voice note bhejiye, ya apna sawal likh dijiye.', false);
    try { text = await STT.transcribe(await download(audio), audio.mimetype || 'audio/ogg'); }
    catch (e) {
      console.error('[call-agent] could not understand voice:', String(e.message).slice(0, 100));
      return reply(sock, jid, job, e.code === 'NO_STT_KEY' ? 'Abhi main voice nahi sun paa rahi. Kripya apna sawal likhkar bhej dijiye.' : 'Aapki awaaz samajh nahi aayi. Ek baar phir se bhejiye, ya likhkar bata dijiye.', false);
    }
    if (!text || text.length < 2) return reply(sock, jid, job, 'Awaaz saaf sunai nahi di. Kripya dobara bhejiye.', false);
  }
  if (STOP.test(text)) { optOut(job); return sock.sendMessage(jid, { text: stopText(text) }, { noCard: true }); }
  // Flow: the person replied to Arya by VOICE -> answer by voice (Devanagari so the Hindi voice reads it right).
  //       the person replied to Arya by TEXT  -> answer by text, in Roman Hindi or English (never Devanagari).
  const asVoice = fromVoice;
  const ans = await brain.answer(text, { name: job.name, key: job.number, voice: asVoice });
  await reply(sock, jid, job, ans, asVoice, fromVoice ? undefined : mek);
  job.turns = (job.turns || 0) + 1; job.lastReplyAt = Date.now(); store.save();
}
// STOP confirmation in the language of the word the person used: Devanagari -> Hindi, band/bandh -> Roman Hindi, anything else -> English
function stopText(t) {
  const x = String(t || '');
  if (/[\u0900-\u097F]/.test(x)) return 'ठीक है। अब हमारी तरफ़ से आपको कोई संदेश नहीं आएगा। धन्यवाद।';
  if (/^\s*(band|bandh)\b/i.test(x)) return 'Theek hai. Ab hamari taraf se aapko koi message nahi aayega. Shukriya.';
  return 'Okay. You will not receive any more messages from us. Thank you.';
}
function optOut(job) { const db = store.load(); if (!db.dnc.includes(job.number)) db.dnc.push(job.number); job.status = 'opted-out'; store.save(); store.flushNow(); }

// Returns true when the message was handled here (so the normal bot flow must skip it).
async function handleIncoming(sock, mek, type) {
  if (type !== 'notify' || !mek || !mek.message || !mek.key || mek.key.fromMe) return false;
  const jid = mek.key.remoteJid || ''; if (!jid || jid.endsWith('@g.us') || jid.endsWith('@broadcast') || jid.endsWith('@newsletter')) return false;
  const m = mek.message, text = String(m.conversation || (m.extendedTextMessage && m.extendedTextMessage.text) || '').trim();
  if (!text && !m.audioMessage) return false;                                                // images, stickers ... go to the normal bot
  if (text && text.startsWith(K.prefix())) return false;                                    // real commands (.menu, .play) go to the normal bot
  const ts = Number(mek.messageTimestamp && (mek.messageTimestamp.low || mek.messageTimestamp)) || 0;
  if (ts && Date.now() / 1000 - ts > 180) return false;                                       // old message delivered late: do not answer it
  const job = await findJob(sock, mek);
  if (!job) {
    // The visitor opened the chat first (website popup -> "Continue" -> WhatsApp, "Hi") but the welcome voice note is still due:
    // remember it and stay quiet, so the voice note arrives on schedule and the normal bot does not answer with a second intro.
    // Arya's voice note goes out only after BOTH: the visitor tapped Continue (+ ~1 min) AND sent this first message to the owner number.
    const waiting = await findJob(sock, mek, true);
    if (waiting) {
      // STOP before the voice note went out: opt out now (nothing will be sent) and confirm
      if (text && STOP.test(text)) { optOut(waiting); try { await sock.sendMessage(jid, { text: stopText(text) }, { noCard: true }); } catch (_) {} return true; }
      if (!waiting.contactedAt) { waiting.contactedAt = Date.now(); console.log(`[call-agent] ${mask(waiting.number)} sent the first message, voice note follows`); }
      const now = Date.now(); if (waiting.status === 'pending' && waiting.dueAt < now + 5000) waiting.dueAt = now + 5000 + rnd(0, 5000);   // 1 min after Continue has already passed: send shortly after the message
      store.save(); return true;
    }
    return false;
  }
  // Arya answers ONLY a reply to one of her own messages (voice or text). A plain message gets no answer from her. (STOP always works.)
  if (!(job.ids && job.ids.includes(quotedId(m))) && !(text && STOP.test(text))) return true;
  const id = mek.key.id; if (id) { if (seen.has(id)) return true; seen.add(id); if (seen.size > 800) seen.delete(seen.values().next().value); }
  if (!(job.turns >= num('CALL_MAX_TURNS', 20))) {
    const n = job.number, prev = chains.get(n) || Promise.resolve(), depth = (chains.get(n + ':d') || 0);
    if (depth >= 3) return true;                                                              // someone flooding: ignore the extra
    chains.set(n + ':d', depth + 1);
    const run = prev.then(() => converse(sock, mek, job, jid, text)).catch(e => console.error('[call-agent] reply failed:', String(e.message || e).slice(0, 120)))
      .finally(() => { const left = (chains.get(n + ':d') || 1) - 1; if (left <= 0) { chains.delete(n); chains.delete(n + ':d'); } else chains.set(n + ':d', left); });
    chains.set(n, run); await run; return true;
  }
  if (!job.limitNotified) { job.limitNotified = true; store.save(); try { await sock.sendMessage(jid, { text: `Aaj ke liye sawaalon ki seema poori ho gayi. ${K.prefix()}menu likhkar saare commands dekhiye, ya website ke Support section mein poochhiye.` }, { noCard: true }); } catch (_) {} return true; }
  return false;
}
module.exports = { ownerNumber, setSocket, setDownloader, ready, sendIntro, sendTextOnly, handleIncoming, optOut, _t: { stopText, STOP, WANT_VOICE, WANT_TEXT } };
