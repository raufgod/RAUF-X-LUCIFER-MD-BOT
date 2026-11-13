'use strict';
// Reads data/messageCount.json (bot mode: public / private) without parsing it again for every single message.
// A cheap stat() tells whether the file changed (by .mode, .public, .private or the admin panel), so the answer is always current.
const fs = require('fs');
const FILE = './data/messageCount.json';
let cache = null, mt = -1, sz = -1;
function read() {
  const st = fs.statSync(FILE);
  if (cache && st.mtimeMs === mt && st.size === sz) return cache;
  cache = JSON.parse(fs.readFileSync(FILE, 'utf8')); mt = st.mtimeMs; sz = st.size;
  return cache;
}
module.exports = { read };
