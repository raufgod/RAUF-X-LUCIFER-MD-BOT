const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const roots = ['.', 'commands', 'lib', 'features/Plugins', 'features/System', 'scripts'];
const files = new Set();
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'session', '.git'].includes(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (ent.isFile() && full.endsWith('.js')) files.add(full);
  }
}
for (const root of roots) walk(root);
let failed = 0;
for (const file of [...files].sort()) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status !== 0) { failed++; process.stderr.write(`FAIL ${file}\n${r.stderr}`); }
}
console.log(`Syntax check: ${files.size - failed}/${files.size} JavaScript files passed`);
process.exitCode = failed ? 1 : 0;
