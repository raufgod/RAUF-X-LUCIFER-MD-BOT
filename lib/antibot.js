'use strict';
// RAUF × LUCIFER MD BOT by RAUF × LUCIFER — Anti-Bot: detects messages that look like another bot's command
// menu (a long numbered/bulleted list of ".command" entries) and removes them from the group.
//
// Detection is rule-based (no external AI call, so it needs no API key and works offline):
// a message scores points for things real bot menus almost always contain — many distinct
// ".command" tokens, menu-style framing lines, and marker words like "PREFIX"/"OWNER"/"MENU".
// A message only gets flagged once it clears a threshold that ordinary chat practically never
// reaches, so normal conversation (including a few stray "." commands) is left alone.
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'antibotConfig.json');

const sessionContext = require('./sessionContext');
const caches = new Map();   // one config per paired session
function load() {
  return sessionContext.perSession(caches, () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')) || {}; } catch (_) { return {}; } });
}
function save() {
  try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(load(), null, 2)); } catch (e) { console.error('[antibot] save failed:', e.message); }
}
const isEnabled = (chatId) => !!load()[chatId];
const setEnabled = (chatId, on) => { load()[chatId] = !!on; save(); return !!on; };

const FRAME_RE = /[╔╗╚╝║╦╩╠╣▰▬━─═┏┓┗┛❰❱〔〕╭╮╰╯]{3,}/;
const MARKER_RE = /\b(prefix|owner|menu|commands?|uptime|runtime|version|mode)\b/gi;

function looksLikeBotMenu(text) {
  const t = String(text || '');
  if (t.length < 120) return false; // real menus are long; short texts never trigger this
  const dotCommands = new Set((t.match(/(?:^|\s)\.[a-z][a-z0-9_-]{1,24}\b/gim) || []).map((m) => m.trim().toLowerCase()));
  const markers = new Set((t.match(MARKER_RE) || []).map((m) => m.toLowerCase()));
  const lines = t.split('\n');
  const bulletLines = lines.filter((l) => /^\s*[➤➛➜•\-*◦»▪➥]\s*\S/.test(l) || /^\s*\d{1,3}[.)]\s*\.?[a-z]/i.test(l)).length;
  const hasFrame = FRAME_RE.test(t);

  let score = 0;
  if (dotCommands.size >= 15) score += 3;
  else if (dotCommands.size >= 8) score += 2;
  else if (dotCommands.size >= 4) score += 1;
  if (markers.size >= 3) score += 2;
  else if (markers.size >= 2) score += 1;
  if (bulletLines >= 10) score += 2;
  else if (bulletLines >= 5) score += 1;
  if (hasFrame) score += 1;

  // Needs several independent signals together — a normal message won't rack these up by accident.
  return score >= 6;
}

module.exports = { isEnabled, setEnabled, looksLikeBotMenu };
