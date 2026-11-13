const fs = require('fs');

const ANTICALL_PATH = './data/anticall.json';

const MODES = {
    warn: 'Call reject + warning message (caller is NOT blocked)',
    busy: 'Call reject + "I am busy" notification (caller is NOT blocked)',
    block: 'Call reject + caller is blocked'
};

const DEFAULT_MSG = {
    warn: '⚠️ *Warning*\n\nPlease do not call this number. Calls are not allowed here.\nSend a text message instead. Calling again may get you blocked.',
    busy: '📵 I am busy right now and cannot take your call.\nPlease leave a text message, I will reply when I am free.',
    block: '📵 Calls are not allowed on this number. Your call was rejected and you have been blocked.'
};

function readRaw() {
    try {
        if (!fs.existsSync(ANTICALL_PATH)) return {};
        return JSON.parse(fs.readFileSync(ANTICALL_PATH, 'utf8') || '{}') || {};
    } catch {
        return {};
    }
}

function readState() {
    const d = readRaw();
    const mode = MODES[d.mode] ? d.mode : 'block';       // old files without a mode keep the old behaviour (block)
    const messages = { ...DEFAULT_MSG, ...(d.messages || {}) };
    return { enabled: !!d.enabled, mode, messages };
}

function writeState(patch) {
    try {
        if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
        const cur = readState();
        const next = {
            enabled: patch.enabled === undefined ? cur.enabled : !!patch.enabled,
            mode: patch.mode || cur.mode,
            messages: { ...cur.messages, ...(patch.messages || {}) }
        };
        fs.writeFileSync(ANTICALL_PATH, JSON.stringify(next, null, 2));
    } catch {}
}

function helpText(state) {
    return `*📵 ANTICALL*\n\n` +
        `Status: *${state.enabled ? 'ON' : 'OFF'}*  |  Mode: *${state.mode.toUpperCase()}*\n\n` +
        `*Modes* (.anticall set <mode>)\n` +
        `• *warn*  - ${MODES.warn}\n` +
        `• *busy*  - ${MODES.busy}\n` +
        `• *block* - ${MODES.block}\n\n` +
        `*Commands*\n` +
        `.anticall set warn|busy|block  - choose the mode (also turns anticall ON)\n` +
        `.anticall msg warn <text>  - change the warning message\n` +
        `.anticall msg busy <text>  - change the busy message\n` +
        `.anticall msg reset  - restore the default messages\n` +
        `.anticall on / off  - enable / disable\n` +
        `.anticall status  - show settings`;
}

function statusText(state) {
    return `*📵 ANTICALL STATUS*\n\nAnticall: *${state.enabled ? 'ON' : 'OFF'}*\nMode: *${state.mode.toUpperCase()}* (${MODES[state.mode]})\n\n` +
        `*Warn message:*\n${state.messages.warn}\n\n*Busy message:*\n${state.messages.busy}`;
}

async function anticallCommand(sock, chatId, message, args) {
    const state = readState();
    const text = String(args || '').trim();
    const parts = text.split(/\s+/).filter(Boolean);
    const sub = (parts[0] || '').toLowerCase();
    const reply = (t) => sock.sendMessage(chatId, { text: t }, { quoted: message });

    if (!sub) return reply(helpText(state));

    if (sub === 'status') return reply(statusText(state));

    if (sub === 'on' || sub === 'off') {
        writeState({ enabled: sub === 'on' });
        return reply(`Anticall is now *${sub === 'on' ? 'ENABLED' : 'DISABLED'}* (mode: *${state.mode.toUpperCase()}*).`);
    }

    if (sub === 'set') {
        const mode = (parts[1] || '').toLowerCase();
        if (!MODES[mode]) return reply(`Choose a mode:\n\n.anticall set warn\n.anticall set busy\n.anticall set block\n\n• warn - ${MODES.warn}\n• busy - ${MODES.busy}\n• block - ${MODES.block}`);
        writeState({ enabled: true, mode });
        return reply(`Anticall is *ON* and the mode is now *${mode.toUpperCase()}*.\n${MODES[mode]}`);
    }

    if (sub === 'msg' || sub === 'message' || sub === 'setmsg') {
        const which = (parts[1] || '').toLowerCase();
        if (which === 'reset') {
            writeState({ messages: { ...DEFAULT_MSG } });
            return reply('Anticall messages are back to the default.');
        }
        if (which !== 'warn' && which !== 'busy') return reply('Usage:\n.anticall msg warn <text>\n.anticall msg busy <text>\n.anticall msg reset');
        const body = text.replace(/^\S+\s+\S+\s*/, '').trim();       // keeps the original upper/lower case
        if (!body) return reply(`Write the message after the word, for example:\n.anticall msg ${which} ${DEFAULT_MSG[which].split('\n')[0]}`);
        if (body.length > 500) return reply('The message is too long (max 500 characters).');
        writeState({ messages: { [which]: body } });
        return reply(`*${which.toUpperCase()}* message saved:\n\n${body}`);
    }

    return reply(helpText(state));
}

// One handler for every call event (main bot and linked sessions).
const notified = new Set();
async function handleCall(sock, calls) {
    try {
        const state = readState();
        if (!state.enabled) return;
        for (const call of calls || []) {
            if (call.status && call.status !== 'offer') continue;     // act once per incoming call, not on every call update
            const callerJid = call.from || call.peerJid || call.chatId;
            if (!callerJid) continue;
            try {
                try {
                    if (typeof sock.rejectCall === 'function' && call.id) await sock.rejectCall(call.id, callerJid);
                    else if (typeof sock.sendCallOfferAck === 'function' && call.id) await sock.sendCallOfferAck(call.id, callerJid, 'reject');
                } catch {}

                if (!notified.has(callerJid)) {                       // one notice per caller per minute
                    notified.add(callerJid);
                    setTimeout(() => notified.delete(callerJid), 60000);
                    await sock.sendMessage(callerJid, { text: state.messages[state.mode] });
                }
            } catch {}
            if (state.mode === 'block') {
                setTimeout(async () => { try { await sock.updateBlockStatus(callerJid, 'block'); } catch {} }, 800);
            }
        }
    } catch {}
}

module.exports = { anticallCommand, readState, writeState, handleCall, MODES };
