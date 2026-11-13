'use strict';
// RAUF × LUCIFER MD BOT by RAUF × LUCIFER — global bot ON/OFF switch (persists across restarts).
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'botSwitch.json');
const sessionContext = require('./sessionContext');
const states = new Map();   // one switch per session

function load() {
  return sessionContext.perSession(states, () => {
    let st; try { st = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (_) { st = { on: true }; }
    if (typeof st.on !== 'boolean') st.on = true;
    return st;
  });
}
function isOn() { return load().on; }
function setOn(value) {
  const state = load();
  state.on = !!value;
  state.changedAt = new Date().toISOString();
  try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(state, null, 2)); } catch (e) { console.error('[botSwitch] save failed:', e.message); }
  return state.on;
}
// Returns 'on' | 'off' | null for .boton / .botoff / .bot on / .bot off
function parse(text) {
  const m = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ').match(/^\.(?:bot ?(on|off))$/);
  return m ? m[1] : null;
}
module.exports = { isOn, setOn, parse };
