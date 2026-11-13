'use strict';
// Shared helpers so EVERY way of linking (console, website, Telegram, .pair) asks WhatsApp for the code the same, correct way.
// WhatsApp only pushes the "Enter code to link device" notification to the phone when
//   1) the code is requested only after the connection handshake is ready (first "qr" update), and
//   2) the session folder is clean (no half-finished keys from an earlier failed try).
// CUSTOM_PAIRING_CODE (8 letters/digits, e.g. PAPAXMD1) from .env is used for every link.
const fs = require('fs-extra');
const path = require('path');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function waitReady(sock, minMs = 2500, maxMs = 12000) {
  return new Promise((resolve) => {
    const t0 = Date.now(); let done = false;
    const fin = () => { if (done) return; done = true; try { sock.ev.off('connection.update', h); } catch (_) {} resolve(); };
    const h = (u) => { if (u && u.qr) setTimeout(fin, Math.max(0, minMs - (Date.now() - t0))); };
    sock.ev.on('connection.update', h);
    setTimeout(fin, maxMs);
  });
}

// Wait until ready, ask for the code, and retry once if WhatsApp was not ready yet.
function customCode() { const raw = String(process.env.CUSTOM_PAIRING_CODE || '').trim().toUpperCase(); return /^[A-Z0-9]{8}$/.test(raw) ? raw : undefined; }
async function requestCode(sock, number) {
  await waitReady(sock);
  try { return await sock.requestPairingCode(number, customCode()); }
  catch (e) { await delay(2500); return await sock.requestPairingCode(number, customCode()); }
}

// A number that never finished linking must start from empty keys (stale keys = no notification / "could not link device").
async function cleanUnfinished(authDir, meta) {
  try {
    const credsFile = path.join(authDir, 'creds.json');
    if (!(await fs.pathExists(credsFile))) return false;
    const creds = await fs.readJson(credsFile).catch(() => null);
    if (creds && creds.registered) return false;           // a real, finished session: never touch
    await fs.remove(authDir); await fs.ensureDir(authDir);
    if (meta) await fs.writeJson(path.join(authDir, 'session.json'), meta, { spaces: 2 });
    return true;
  } catch (_) { return false; }
}

module.exports = { waitReady, requestCode, cleanUnfinished, delay };
