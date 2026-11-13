'use strict';
// Keeps the bot light: deletes old temporary files (downloads, converted media) so the panel disk and RAM stay small.
const fs = require('fs'), path = require('path');
const DIRS = ['tmp', 'temp'].map((d) => path.join(process.cwd(), d));
const MAX_AGE = 30 * 60 * 1000;
function sweep() {
  for (const dir of DIRS) {
    let names = []; try { names = fs.readdirSync(dir); } catch (_) { continue; }
    for (const n of names) {
      const p = path.join(dir, n);
      try { const s = fs.statSync(p); if (Date.now() - s.mtimeMs > MAX_AGE) fs.rmSync(p, { recursive: true, force: true }); } catch (_) {}
    }
  }
}
function start() { sweep(); const t = setInterval(sweep, 30 * 60 * 1000); if (t.unref) t.unref(); }
module.exports = { start, sweep };
