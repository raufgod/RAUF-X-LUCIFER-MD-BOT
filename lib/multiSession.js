'use strict';
// RAUF × LUCIFER MD BOT by RAUF × LUCIFER — in-chat ".pair <number>" sessions.
//
// Every paired number gets a REAL, separate WhatsApp connection with the full bot runtime
// (lib/botSession.js): same commands as the main bot, its own settings, owner = the paired person.
// Sessions are saved on disk and reconnected automatically after a restart.
const fs = require('fs-extra');
const path = require('path');
const {
    default: makeWASocketDefault,
    makeWASocket: makeWASocketNamed,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
    delay,
} = require('@whiskeysockets/baileys');
const makeWASocket = makeWASocketDefault || makeWASocketNamed;
const { socketOptions, attachRuntime } = require('./botSession');
const sessionContext = require('./sessionContext');

const DATA_DIR = path.resolve(process.env.MULTI_SESSIONS_DIR || './multi_sessions');
fs.ensureDirSync(DATA_DIR);

// number -> { sock, connecting, number, ownerId }
const sessions = new Map();

function getCustomCode() {
    const raw = String(process.env.CUSTOM_PAIRING_CODE || '').trim().toUpperCase();
    return /^[A-Z0-9]{8}$/.test(raw) ? raw : undefined;
}

// old layout: multi_sessions/<ownerJid>/{session.json,creds...}  ->  multi_sessions/<number>/
async function migrateLegacy() {
    try {
        for (const id of await fs.readdir(DATA_DIR)) {
            if (/^\d{8,15}$/.test(id)) continue;
            const dir = path.join(DATA_DIR, id);
            const meta = await fs.readJson(path.join(dir, 'session.json')).catch(() => null);
            const number = String(meta?.number || '').replace(/\D/g, '');
            if (!number) continue;
            const target = path.join(DATA_DIR, number);
            if (!(await fs.pathExists(target))) await fs.move(dir, target);
        }
    } catch (e) { console.error('[multiSession migrate]', e.message); }
}

/**
 * Create (or replace) the session for `number`; ownerId = who asked (only that person may remove it).
 * handlers: { onCode(code), onConnected(sock), onDisconnected(reason), onError(err) }
 */
async function createPairedSession(ownerId, number, handlers = {}, isReconnect = false) {
    number = String(number).replace(/\D/g, '');
    try { if (!isReconnect && !require('./brand').isAllowed(number)) { handlers.onError?.(new Error('This number is not allowed to link with this bot.')); return; } } catch (_) {}
    const existing = sessions.get(number);
    if (existing?.connecting) {
        handlers.onError?.(new Error('This number is already being prepared. Please wait a moment and try again.'));
        return;
    }
    if (existing && existing.ownerId && String(existing.ownerId) !== String(ownerId) && !isReconnect) {
        handlers.onError?.(new Error('This number is already linked by someone else.'));
        return;
    }
    if (existing?.sock) { try { existing.sock.end(undefined); } catch (_) {} }

    const authDir = path.join(DATA_DIR, number);
    await fs.ensureDir(authDir);
    await fs.writeJson(path.join(authDir, 'session.json'), { ownerId: String(ownerId), number }, { spaces: 2 });

    if (!isReconnect) await require('./pairingReady').cleanUnfinished(authDir, { ownerId: String(ownerId), number });   // fresh keys for a new link
    const session = { connecting: true, number, ownerId: String(ownerId) };
    sessions.set(number, session);

    try {
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        if (isReconnect && !state.creds.registered) {          // the pairing code expired — don't spam new ones
            sessions.delete(number);
            try { await fs.remove(authDir); } catch (_) {}
            handlers.onError?.(new Error(`Pairing code for +${number} expired. Send .pair ${number} again.`));
            return;
        }
        const { version } = await (typeof fetchLatestBaileysVersion === 'function' ? fetchLatestBaileysVersion() : Promise.resolve({})).catch(() => ({}));
        const sock = makeWASocket(socketOptions({ version, state, number }));
        attachRuntime(sock, { number });                        // full commands + own settings
        session.sock = sock;
        session.connecting = false;
        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            if (update.connection === 'open') {
                handlers.onConnected?.(sock);
                try { require('./connectNotice').onOpen(sock, number, authDir); } catch (_) {}
            }
            if (update.connection === 'close') {
                if (sessions.get(number) !== session) return;   // replaced / removed on purpose
                const statusCode = update.lastDisconnect?.error?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    sessions.delete(number);
                    try { await fs.remove(authDir); await fs.remove(sessionContext.sessionDir(number)); } catch (_) {}
                    handlers.onDisconnected?.(statusCode);
                } else {
                    setTimeout(() => createPairedSession(ownerId, number, handlers, true).catch((e) => handlers.onError?.(e)), 4000);
                }
            }
        });

        if (!state.creds.registered) {
            // one shared, correct way (wait for the handshake, normal server code, one retry) so the phone gets its notification
            const code = await require('./pairingReady').requestCode(sock, number);
            try { require('./connectNotice').markPending(authDir); } catch (_) {}
            handlers.onCode?.(String(code).match(/.{1,4}/g)?.join('-') || String(code));
        }
    } catch (e) {
        session.connecting = false;
        sessions.delete(number);
        handlers.onError?.(e);
        throw e;
    }
}

function listNumbers() { return [...sessions.keys()]; }
function stopLocal(number) {                                    // stop running a number HERE without logging it out of WhatsApp
    const s = sessions.get(String(number)); sessions.delete(String(number));
    if (s?.sock) { try { s.sock.end(undefined); } catch (_) {} }
}

function waitPairingReady(sock, minMs, maxMs) {
    return new Promise((resolve) => {
        const t0 = Date.now(); let done = false;
        const fin = () => { if (done) return; done = true; try { sock.ev.off('connection.update', h); } catch (_) {} resolve(); };
        const h = (u) => { if (u && u.qr) setTimeout(fin, Math.max(0, minMs - (Date.now() - t0))); };
        sock.ev.on('connection.update', h);
        setTimeout(fin, maxMs);
    });
}

function getSession(number) { return sessions.get(String(number)); }

async function removeSession(number) {
    number = String(number);
    const session = sessions.get(number);
    sessions.delete(number);                                   // mark as intentional first
    if (session?.sock) { try { await session.sock.logout(); } catch (_) { try { session.sock.end(undefined); } catch (__) {} } }
    try { await fs.remove(path.join(DATA_DIR, number)); } catch (_) {}
    try { await fs.remove(sessionContext.sessionDir(number)); } catch (_) {}
}

/** Reconnect every saved .pair session after a restart (staggered). */
let restored = false;
async function restoreAll() {
    if (restored) return;                                       // main socket reconnects must not re-create sessions
    restored = true;
    await migrateLegacy();
    let ids = [];
    try { ids = await fs.readdir(DATA_DIR); } catch (_) { return; }
    for (const number of ids) {
        if (!/^\d{8,15}$/.test(number)) continue;
        const dir = path.join(DATA_DIR, number);
        try {
            if (!(await fs.pathExists(path.join(dir, 'creds.json')))) { await fs.remove(dir).catch(() => {}); continue; }
            const meta = await fs.readJson(path.join(dir, 'session.json')).catch(() => ({}));
            createPairedSession(meta.ownerId || number, number, {
                onError: (e) => console.error('[multiSession]', String(number).slice(0, 2) + '******' + String(number).slice(-2), e?.message || e)
            }, true).catch((e) => console.error('[multiSession restore]', String(number).slice(0, 2) + '******' + String(number).slice(-2), e?.message || e));
            await delay(1500);
        } catch (e) { console.error('[multiSession restore]', String(number).slice(0, 2) + '******' + String(number).slice(-2), e.message); }
    }
}

module.exports = { createPairedSession, getSession, removeSession, restoreAll, listNumbers, stopLocal, DATA_DIR };
