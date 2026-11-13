'use strict';
// Crash-safe JSON queue (data/call-queue.json): scheduled messages survive a restart. Contains phone numbers, so it is created private (0600).
const fs = require('fs'), path = require('path');
const FILE = () => process.env.CALL_QUEUE_FILE || path.join(__dirname, '..', '..', 'data', 'call-queue.json');
let db = { jobs: [], dnc: [] }, loaded = false, timer = null;

function load() {
  if (loaded) return db; loaded = true;
  try { const j = JSON.parse(fs.readFileSync(FILE(), 'utf8')); db = { jobs: Array.isArray(j.jobs) ? j.jobs : [], dnc: Array.isArray(j.dnc) ? j.dnc : [] }; } catch (_) {}
  for (const j of db.jobs) if (j.status === 'sending') {          // the bot stopped in the middle of a send
    if (j.audioSent) { j.status = 'sent'; j.sentAt = j.sentAt || Date.now(); j.note = 'recovered after restart'; }   // never send the voice note twice
    else j.status = 'pending';
  }
  return db;
}
function write() {
  try { const f = FILE(); fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 1), { mode: 0o600 }); fs.renameSync(t, f); }
  catch (e) { console.error('[call-agent] could not save queue:', e.message); }
}
function save() { clearTimeout(timer); timer = setTimeout(write, 250); timer.unref && timer.unref(); }
function flushNow() { clearTimeout(timer); if (loaded) write(); }
process.on('exit', () => { if (timer) { clearTimeout(timer); write(); } });
function reset() { db = { jobs: [], dnc: [] }; loaded = false; }      // tests only
module.exports = { load, save, flushNow, reset };
