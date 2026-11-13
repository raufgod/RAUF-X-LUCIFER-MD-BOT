'use strict';
// RAUF × LUCIFER MD BOT 💫 — one place that turns a bare Baileys socket into a FULL bot session.
// Used for every paired number (Telegram /pair and the in-chat .pair command), so each of them
// runs exactly the same command code as the main bot: .menu, owner commands, antilink, welcome ...
//
//   const sock = makeWASocket(socketOptions({ version, state, number }));
//   attachRuntime(sock, { number });          // <- must run BEFORE any sock.ev.on(...)
//
// What the old paired sessions were missing (and why .menu / many commands failed there):
//   • sock.decodeJid / getName / serializeM helpers that commands call,
//   • getMessage + message store (needed to decrypt retries and for quoted media),
//   • the group, call, status and reaction handlers,
//   • their own settings: mode / antilink / bot name ... now isolated per number (lib/sessionContext.js).
const NodeCache = require('node-cache');
const pino = require('pino');
const PhoneNumber = require('awesome-phonenumber');
const {
  makeCacheableSignalKeyStore, jidNormalizedUser, jidDecode
} = require('@whiskeysockets/baileys');

const sessionContext = require('./sessionContext');
const botConfig = require('./botConfig');
const onlineMode = require('./onlineMode');
const store = require('./lightweight_store');
const { patch: patchMediaTransport } = require('./mediaTransport');
const { patch: patchGlobalCard } = require('./globalCard');

function socketOptions({ version, state, number }) {
  return {
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })) },
    markOnlineOnConnect: onlineMode.isEnabled(String(number)),
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    getMessage: async (key) => {
      try { const msg = await store.loadMessage(jidNormalizedUser(key.remoteJid), key.id); return msg?.message || undefined; }
      catch { return undefined; }
    },
    msgRetryCounterCache: new NodeCache(),
    maxMsgRetryCount: 5,
    retryRequestDelayMs: 250,
    defaultQueryTimeoutMs: 60000,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 10000
  };
}

// Same flow as the main bot's messages.upsert handler (index.js). The first-contact DM intro now says
// "Welcome to <name of the person who connected this bot>" (lib/dmIntro.js).
async function handleUpsert(sock, chatUpdate) {
  const { handleMessages, handleStatus } = require('../main');
  // every message runs on its own, so one slow command never blocks .ping or the next message
  for (const mek of (Array.isArray(chatUpdate?.messages) ? chatUpdate.messages : [])) (async () => {
    if (!mek?.message || !mek.key?.remoteJid) return;
    mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
    if (mek.key.remoteJid === 'status@broadcast') { await handleStatus(sock, chatUpdate); return; }
    if (typeof mek.key.id === 'string' && mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return;
    try { await require('./dmIntro').maybeSend(sock, chatUpdate, mek); } catch (e) { console.error('[DM INTRO]', e?.message || e); }
    try {
      await handleMessages(sock, { ...chatUpdate, messages: [mek] }, true);
    } catch (err) {
      console.error(`[session ${sock.__sessionKey}] handleMessages:`, err?.message || err);
      try { await sock.sendMessage(mek.key.remoteJid, { text: '❌ An error occurred while processing your message.' }); } catch (_) {}
    }
  })().catch((e) => console.error('[session message]', e?.message || e));
}

const handleCall = (sock, calls) => require('../commands/anticall').handleCall(sock, calls);

function attachRuntime(sock, { number }) {
  number = String(number);
  sock.__ownerNumber = number;          // lib/isOwner.js: the paired person is THIS bot's owner (not RAUF × LUCIFER)
  sock.__sessionKey = number;
  require('./groupCache').patch(sock);
  const ctx = { key: number, overrides: botConfig.loadSessionOverrides(number) };
  sock.__sessionCtx = ctx;

  // Every listener registered from now on runs inside this session's context (own data files + settings).
  const origOn = sock.ev.on.bind(sock.ev);
  sock.ev.on = (event, listener) => origOn(event, (...args) => sessionContext.run(ctx, () => listener(...args)));

  patchMediaTransport(sock);
  patchGlobalCard(sock);

  // helpers the command code expects on the socket
  sock.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) { const d = jidDecode(jid) || {}; return (d.user && d.server && d.user + '@' + d.server) || jid; }
    return jid;
  };
  sock.getName = (jid, withoutContact = false) => {
    const id = sock.decodeJid(jid);
    withoutContact = sock.withoutContact || withoutContact;
    let v;
    if (id.endsWith('@g.us')) return new Promise(async (resolve) => {
      v = store.contacts[id] || {};
      if (!(v.name || v.subject)) { try { v = (await sock.groupMetadata(id)) || {}; } catch { v = {}; } }
      resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'));
    });
    v = id === '0@s.whatsapp.net' ? { id, name: 'WhatsApp' }
      : id === sock.decodeJid(sock.user?.id) ? sock.user
      : (store.contacts[id] || {});
    return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + String(jid).replace('@s.whatsapp.net', '')).getNumber('international');
  };
  sock.public = true;
  try { const { smsg } = require('./myfunc'); sock.serializeM = (m) => smsg(sock, m, store); } catch (_) {}

  try { store.bind(sock.ev); } catch (_) {}
  sock.ev.on('contacts.update', (update) => {
    for (const c of update) { const id = sock.decodeJid(c.id); if (store?.contacts) store.contacts[id] = { id, name: c.notify }; }
  });

  sock.ev.on('messages.upsert', (u) => handleUpsert(sock, u).catch(e => console.error('[session upsert]', e?.message || e)));
  sock.ev.on('call', (calls) => handleCall(sock, calls));
  sock.ev.on('group-participants.update', async (u) => {
    try { await require('../main').handleGroupParticipantUpdate(sock, u); } catch (e) { console.error('[session group update]', e?.message || e); }
  });
  sock.ev.on('groups.upsert', (g) => require('./groupIntro').onGroupsUpsert(sock, g).catch(() => {}));
  sock.ev.on('status.update', async (s) => { try { await require('../main').handleStatus(sock, s); } catch (_) {} });
  sock.ev.on('messages.reaction', async (s) => { try { await require('../main').handleStatus(sock, s); } catch (_) {} });
  sock.ev.on('connection.update', (u) => { if (u.connection === 'open') { try { onlineMode.register(sock); } catch (_) {} } });
  return sock;
}

module.exports = { socketOptions, attachRuntime, handleUpsert };
