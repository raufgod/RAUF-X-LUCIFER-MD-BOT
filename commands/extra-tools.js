'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const isAdmin = require('../lib/isAdmin');

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'extra-tools.json');
const STARTED_AT = Date.now();
const recentMessages = new Map();
const recentCommands = new Map();
const activeReminders = new Map();
let reminderSequence = 0;

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) fs.writeFileSync(STORE_PATH, JSON.stringify({ groups: {}, users: {}, commandStats: {}, disabledCommands: [], maintenance: false }, null, 2));
}
function loadStore() {
  ensureStore();
  try { const d = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); d.groups ||= {}; d.users ||= {}; d.commandStats ||= {}; d.disabledCommands ||= []; d.maintenance = Boolean(d.maintenance); if (migrateModerationDefaults(d)) { try { fs.writeFileSync(STORE_PATH, JSON.stringify(d, null, 2)); } catch (_) {} } return d; }
  catch { return { groups: {}, users: {}, commandStats: {}, disabledCommands: [], maintenance: false }; }
}
function saveStore(data) { ensureStore(); fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2)); }
// Moderation is OFF until a group admin turns a feature on. (It used to be ON in every group by default,
// which silently deleted links / flooded messages and ignored `.antilink off`.)
function groupConfig(data, jid) { if (!data.groups[jid]) data.groups[jid] = { antispam: false, antiflood: false, antifloodLimit: 8, antimention: false, antimentionLimit: 8, antilinkMode: 'off', antisticker: false, antimedia: false, antiforward: false, modlog: true, badWords: [] }; return data.groups[jid]; }

// One-time migration: groups that still have EXACTLY the old auto-defaults were never configured by an admin -> switch them off.
function migrateModerationDefaults(d) {
  if (d.moderationDefaultsV2) return false;
  for (const cfg of Object.values(d.groups || {})) {
    if (cfg && cfg.antispam === true && cfg.antiflood === true && cfg.antimention === true && cfg.antilinkMode === 'delete' && cfg.antifloodLimit === 8 && cfg.antimentionLimit === 8) {
      cfg.antispam = false; cfg.antiflood = false; cfg.antimention = false; cfg.antilinkMode = 'off';
    }
  }
  d.moderationDefaultsV2 = true;
  return true;
}

/** Used by `.antilink on/off` so there is only ONE anti-link switch from the admin's point of view. */
function setAntilinkMode(chatId, mode) { const d = loadStore(); groupConfig(d, chatId).antilinkMode = mode; saveStore(d); }
function userConfig(data, jid) { if (!data.users[jid]) data.users[jid] = { notes: [] }; return data.users[jid]; }
function jidNum(jid = '') { return String(jid).split('@')[0].split(':')[0]; }
function getText(message) { const m = message?.message || {}; return m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || ''; }
function quotedParticipant(message) { return message?.message?.extendedTextMessage?.contextInfo?.participant || ''; }
function mentioned(message) { return message?.message?.extendedTextMessage?.contextInfo?.mentionedJid || []; }
function duration(ms) { const s = Math.floor(ms / 1000); return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`; }
async function send(sock, chatId, text, message, extra = {}) { return sock.sendMessage(chatId, { text, ...extra }, message ? { quoted: message } : {}); }
async function adminGate(sock, chatId, senderId, message, { bot = true } = {}) {
  if (!chatId.endsWith('@g.us')) { await send(sock, chatId, '❌ This command can only be used in a group.', message); return false; }
  const status = await isAdmin(sock, chatId, senderId);
  if (bot && !status.isBotAdmin) { await send(sock, chatId, '❌ Please make the bot a group admin first.', message); return false; }
  if (!status.isSenderAdmin && !message?.key?.fromMe) { await send(sock, chatId, '❌ Only group admins can use this command.', message); return false; }
  return true;
}
function safeMath(expression) {
  const s = String(expression || '').trim();
  if (!s || s.length > 100 || !/^[0-9+*/().%\s-]+$/.test(s)) throw new Error('Only basic arithmetic (+ - * / % and parentheses) is supported.');
  // A small recursive-descent parser avoids eval/Function.
  let i = 0;
  function ws() { while (/\s/.test(s[i] || '')) i++; }
  function expr() { let n = term(); while (true) { ws(); if (s[i] === '+') { i++; n += term(); } else if (s[i] === '-') { i++; n -= term(); } else return n; } }
  function term() { let n = factor(); while (true) { ws(); if (s[i] === '*') { i++; n *= factor(); } else if (s[i] === '/') { i++; const d = factor(); if (!d) throw new Error('Division by zero.'); n /= d; } else if (s[i] === '%') { i++; n %= factor(); } else return n; } }
  function factor() { ws(); if (s[i] === '+') { i++; return factor(); } if (s[i] === '-') { i++; return -factor(); } if (s[i] === '(') { i++; const n = expr(); ws(); if (s[i++] !== ')') throw new Error('Missing closing parenthesis.'); return n; } const m = s.slice(i).match(/^(?:\d+\.?\d*|\.\d+)/); if (!m) throw new Error('Invalid calculation.'); i += m[0].length; return Number(m[0]); }
  const result = expr(); ws(); if (i !== s.length || !Number.isFinite(result)) throw new Error('Invalid calculation.'); return result;
}

async function handleExtraCommand(sock, message, context = {}) {
  const chatId = message?.key?.remoteJid || '';
  const senderId = message?.key?.participant || chatId;
  const isGroup = chatId.endsWith('@g.us');
  const raw = getText(message).trim();
  if (!raw.startsWith('.')) return false;
  const match = raw.match(/^\.([a-z0-9_-]+)(?:\s+([\s\S]*))?$/i);
  if (!match) return false;
  const cmd = match[1].toLowerCase();
  const arg = (match[2] || '').trim();
  const args = arg.split(/\s+/).filter(Boolean);
  const owner = Boolean(context.isOwner || message.key?.fromMe);
  const sudo = Boolean(context.isSudo);
  const privileged = owner || sudo;
  const data = loadStore();

  // Disabled-command and maintenance guard applies to every dot-command.
  if (data.disabledCommands.includes(cmd) && !privileged && !['enablecmd', 'disablecmd', 'disabledcmd'].includes(cmd)) {
    await send(sock, chatId, `⛔ .${cmd} is currently disabled by the bot owner.`, message); return true;
  }
  if (data.maintenance && !privileged && !['maintenance', 'health', 'help', 'menu'].includes(cmd)) {
    await send(sock, chatId, '🛠️ Bot is temporarily in maintenance mode. Please try again later.', message); return true;
  }

  const commands = new Set([
    'groupstats','membercount','members','adminlist','userinfo','groupreport','lockgroup','unlockgroup','approve','reject','slowmode','antispam','antiflood','antibot','antimention','antisticker','antimedia','antiforward','allowlink','blocklink','linkstats','antilinkmode','badword','securityreport','setwelcome','setgoodbye','rules','setrules','grouplink','revokeinvite','resetwarn','poll','note','notes','calc','qr','shorturl','define','summarize','password','uuid','base64','jsonformat','spellcheck','remind','uptime','botstats','commandstats','disabledcmd','disablecmd','enablecmd','maintenance','health','backupconfig','restoreconfig','exportstats','prefix','pollhelp','id','serverinfo','groupdesc','membercheck','cleanlinks','antimentionmode','modlog','setmodlog','pinhelp','privacy','helpsearch','myid','whoami','pingcheck','echo','time','date','wordcount','reverse','case','hash','random','choose','coinflip','roll','pollvotehelp','groupinviteinfo','exportmembers','clearstats','clearnotes','note-remove','noteadd','notelist','calcpercent','tempcheck','runtime','version','aboutbot','supportinfo','groupmode','setslowmode','removewarn','warncount','messageid','quotedinfo','admincheck','permissions','groupavatarinfo','maintenance-status','linkallowlist','linkblocklist','reminderlist','cancelreminder','groupconfig','botconfig','clean-temp','configstatus'
  ]);
  if (!commands.has(cmd)) return false;
  data.commandStats[cmd] = (data.commandStats[cmd] || 0) + 1;
  const reply = (text, extra = {}) => send(sock, chatId, text, message, extra);
  if (['note','noteadd','notes','notelist','note-remove','clearnotes'].includes(cmd) && isGroup) {
    await reply('🔒 Personal notes work in private chat only so they are not exposed to the group.'); return true;
  }
  if (['password','backupconfig','restoreconfig','exportstats'].includes(cmd) && isGroup) {
    await reply('🔒 For privacy, use this command in a private chat with the bot.'); return true;
  }

  try {
    switch (cmd) {
      case 'groupstats': case 'membercount': case 'members': case 'adminlist': case 'userinfo': case 'groupreport': case 'groupdesc': case 'groupinviteinfo': case 'exportmembers': case 'membercheck': case 'groupavatarinfo': {
        if (!isGroup) { await reply('❌ This command works in groups only.'); break; }
        const meta = await sock.groupMetadata(chatId);
        const participants = meta.participants || [];
        const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
        const targets = mentioned(message);
        const target = targets[0] || quotedParticipant(message) || (args[0] && args[0].replace(/\D/g, '') ? `${args[0].replace(/\D/g, '')}@s.whatsapp.net` : '');
        if (cmd === 'groupstats' || cmd === 'groupreport') {
          await reply(`📊 *GROUP ${cmd === 'groupreport' ? 'REPORT' : 'STATS'}*\n\n🏷️ Name: ${meta.subject || 'Unknown'}\n🆔 JID: ${chatId}\n👥 Members: ${participants.length}\n👑 Admins: ${admins.length}\n📝 Description: ${(meta.desc || 'Not set').slice(0, 500)}\n🕒 Generated: ${new Date().toLocaleString()}`); break;
        }
        if (cmd === 'membercount') { await reply(`👥 Members: ${participants.length}\n👑 Admins: ${admins.length}\n👤 Non-admin members: ${participants.length - admins.length}`); break; }
        if (cmd === 'members' || cmd === 'exportmembers') {
          if (cmd === 'exportmembers' && !(await adminGate(sock, chatId, senderId, message))) break;
          const lines = participants.slice(0, 150).map((p, i) => `${i + 1}. @${jidNum(p.id || p.jid || '')}${p.admin ? ` (${p.admin})` : ''}`);
          await reply(`👥 *MEMBERS (${participants.length})*\n${participants.slice(0,150).map((p,i) => `${i+1}. ${jidNum(p.id || p.jid || '')}${p.admin ? ` (${p.admin})` : ''}`).join('\n')}${participants.length > 150 ? '\n…list capped at 150 members' : ''}`); break;
        }
        if (cmd === 'adminlist') { await reply(`👑 *GROUP ADMINS (${admins.length})*\n${admins.map((p,i) => `${i+1}. ${jidNum(p.id || p.jid || '')}`).join('\n') || 'No admins found.'}`); break; }
        if (cmd === 'groupdesc') { await reply(`📝 *${meta.subject}*\n${meta.desc || 'No description set.'}`); break; }
        if (cmd === 'groupinviteinfo') { const code = await sock.groupInviteCode(chatId); await reply(`🔗 Group invite link: https://chat.whatsapp.com/${code}`); break; }
        if (cmd === 'groupavatarinfo') { await reply(`🖼️ Group: ${meta.subject}\nMembers: ${participants.length}\nUse .groupinfo for full group information.`); break; }
        if (cmd === 'membercheck' || cmd === 'userinfo') {
          if (!target) { await reply(`Usage: .${cmd} @user (or reply to their message)`); break; }
          const found = participants.find(p => [p.id, p.jid, p.lid, p.phoneNumber].some(v => v && (v === target || jidNum(v) === jidNum(target))));
          if (!found) { await reply('❌ That user was not found in this group.'); break; }
          await reply(`👤 *USER INFO*\nJID: ${found.id || found.jid || target}\nRole: ${found.admin || 'member'}\nIn group: Yes`, { mentions: [found.id || found.jid || target] }); break;
        }
        break;
      }
      case 'lockgroup': case 'unlockgroup': {
        if (!(await adminGate(sock, chatId, senderId, message))) break;
        await sock.groupSettingUpdate(chatId, cmd === 'lockgroup' ? 'announcement' : 'not_announcement');
        await reply(cmd === 'lockgroup' ? '🔒 Group locked: only admins can send messages.' : '🔓 Group unlocked: members can send messages.'); break;
      }
      case 'approve': case 'reject': {
        if (!(await adminGate(sock, chatId, senderId, message))) break;
        const target = mentioned(message)[0] || quotedParticipant(message) || (args[0] ? `${args[0].replace(/\D/g, '')}@s.whatsapp.net` : '');
        if (!target || !sock.groupRequestParticipantsUpdate) { await reply(`Usage: .${cmd} @user\nThis Baileys version must support group join-request updates.`); break; }
        await sock.groupRequestParticipantsUpdate(chatId, [target], cmd === 'approve' ? 'approve' : 'reject');
        await reply(`✅ Join request ${cmd === 'approve' ? 'approved' : 'rejected'} for @${jidNum(target)}.`, { mentions: [target] }); break;
      }
      case 'slowmode': case 'setslowmode': {
        if (!(await adminGate(sock, chatId, senderId, message))) break;
        const seconds = Number(args[0] || 0);
        if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600) { await reply('Usage: .slowmode <0-3600 seconds> (0 disables it).'); break; }
        groupConfig(data, chatId).slowmodeSeconds = seconds; saveStore(data);
        await reply(seconds ? `🐢 Slowmode set to ${seconds} seconds. Non-admin messages sent too quickly may be removed.` : '✅ Slowmode disabled.'); break;
      }
      case 'antibot': {
        if (!(await adminGate(sock, chatId, senderId, message))) break;
        await reply('⚠️ WhatsApp/Baileys does not reliably identify whether a participant is an automated bot account. This command cannot safely detect or remove bots; use .antiflood and .antispam for observable spam behavior.');
        break;
      }
      case 'antilinkmode': {
        if (!(await adminGate(sock, chatId, senderId, message))) break;
        const mode = (args[0] || 'delete').toLowerCase();
        if (!['off','delete','allowlist'].includes(mode)) { await reply('Usage: .antilinkmode off/delete/allowlist'); break; }
        const cfg = groupConfig(data, chatId); cfg.antilinkMode = mode; saveStore(data);
        await reply(`🔗 Anti-link mode: ${mode.toUpperCase()}${mode === 'allowlist' ? '\nAdd permitted domains with .allowlink example.com' : ''}`); break;
      }
      case 'antispam': case 'antiflood': case 'antimention': case 'antisticker': case 'antimedia': case 'antiforward': case 'antimentionmode': {
        if (!(await adminGate(sock, chatId, senderId, message))) break;
        const cfg = groupConfig(data, chatId);
        if (cmd === 'antiflood') {
          const value = (args[0] || '5').toLowerCase();
          if (value === 'off') { cfg.antiflood = false; saveStore(data); await reply('🛡️ Anti-flood disabled.'); break; }
          const n = Number(value); if (!Number.isInteger(n) || n < 2 || n > 20) { await reply('Usage: .antiflood <2-20 messages in 10 seconds> or .antiflood off'); break; }
          cfg.antifloodLimit = n; cfg.antiflood = true;
        } else if (cmd === 'antimention') {
          const n = Number(args[0] || 5); if (!Number.isInteger(n) || n < 1 || n > 50) { await reply('Usage: .antimention <1-50 mentions per message>'); break; }
          cfg.antimentionLimit = n; cfg.antimention = true;
        } else {
          const value = (args[0] || 'on').toLowerCase(); if (!['on','off','status'].includes(value)) { await reply(`Usage: .${cmd} on/off/status`); break; }
          const key = cmd === 'antimentionmode' ? 'antimention' : cmd;
          if (value !== 'status') cfg[key] = value === 'on';
          await reply(`🛡️ ${cmd}: ${cfg[key] ? 'ON' : 'OFF'}`); saveStore(data); break;
        }
        saveStore(data); await reply(`🛡️ ${cmd} enabled. Configuration saved.`); break;
      }
      case 'allowlink': case 'blocklink': case 'linkallowlist': case 'linkblocklist': {
        if (!(await adminGate(sock, chatId, senderId, message))) break;
        const domain = (args[0] || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) { await reply(`Usage: .${cmd} example.com`); break; }
        const cfg = groupConfig(data, chatId); cfg.allowLinks ||= []; cfg.blockLinks ||= [];
        const list = cmd === 'allowlink' || cmd === 'linkallowlist' ? cfg.allowLinks : cfg.blockLinks;
        if (!list.includes(domain)) list.push(domain); saveStore(data);
        await reply(`✅ ${domain} added to ${list === cfg.allowLinks ? 'allowed' : 'blocked'} domain list.`); break;
      }
      case 'linkstats': case 'securityreport': case 'modlog': case 'setmodlog': {
        if (!(await adminGate(sock, chatId, senderId, message))) break;
        const cfg = groupConfig(data, chatId);
        if (cmd === 'setmodlog') { cfg.modlog = (args[0] || 'on').toLowerCase() === 'on'; saveStore(data); await reply(`Moderation log ${cfg.modlog ? 'enabled' : 'disabled'}.`); break; }
        await reply(`🛡️ *SECURITY REPORT*\nAnti-spam: ${cfg.antispam ? 'ON' : 'OFF'}\nAnti-flood: ${cfg.antiflood ? `ON (${cfg.antifloodLimit || 5}/10s)` : 'OFF'}\nSlowmode: ${cfg.slowmodeSeconds || 0}s\nAnti-mention: ${cfg.antimention ? `ON (${cfg.antimentionLimit || 5})` : 'OFF'}\nAnti-sticker: ${cfg.antisticker ? 'ON' : 'OFF'}\nAnti-media: ${cfg.antimedia ? 'ON' : 'OFF'}\nAnti-forward: ${cfg.antiforward ? 'ON' : 'OFF'}\nAnti-link mode: ${cfg.antilinkMode || 'off'}\nAllowed domains: ${(cfg.allowLinks || []).join(', ') || 'none'}\nBlocked domains: ${(cfg.blockLinks || []).join(', ') || 'none'}`); break;
      }
      case 'badword': {
        if (!(await adminGate(sock, chatId, senderId, message))) break;
        const [action, ...wordParts] = args; const word = wordParts.join(' ').trim().toLowerCase(); const cfg = groupConfig(data, chatId); cfg.badWords ||= [];
        if (!['add','remove','list'].includes((action || '').toLowerCase())) { await reply('Usage: .badword add <word> | .badword remove <word> | .badword list'); break; }
        if (action === 'list') { await reply(`🚫 Blocked words: ${cfg.badWords.join(', ') || 'none'}`); break; }
        if (!word) { await reply('Please provide a word or phrase.'); break; }
        if (action === 'add' && !cfg.badWords.includes(word)) cfg.badWords.push(word);
        if (action === 'remove') cfg.badWords = cfg.badWords.filter(w => w !== word);
        saveStore(data); await reply(`✅ Badword list updated (${action}).`); break;
      }
      case 'setwelcome': case 'setgoodbye': {
        if (!(await adminGate(sock, chatId, senderId, message, { bot: false }))) break;
        if (!arg) { await reply(`Usage: .${cmd} <message>\nVariables supported by the welcome module: {user}, {group}, {description}, {count}`); break; }
        const lib = require('../lib');
        if (cmd === 'setwelcome' && typeof lib.addWelcome === 'function') await lib.addWelcome(chatId, true, arg);
        else if (cmd === 'setgoodbye' && typeof lib.addGoodbye === 'function') await lib.addGoodbye(chatId, true, arg);
        else { await reply('❌ Welcome storage helper is unavailable in this build.'); break; }
        await reply(`✅ Custom ${cmd === 'setwelcome' ? 'welcome' : 'goodbye'} message saved and enabled.`); break;
      }
      case 'rules': case 'setrules': {
        if (!isGroup) { await reply('This command works in groups only.'); break; }
        const cfg = groupConfig(data, chatId);
        if (cmd === 'rules') { await reply(`📜 *GROUP RULES*\n${cfg.rules || 'No rules configured. Admins can set them with .setrules <text>.'}`); break; }
        if (!(await adminGate(sock, chatId, senderId, message, { bot: false }))) break;
        if (!arg) { await reply('Usage: .setrules <group rules>'); break; }
        cfg.rules = arg.slice(0, 4000); saveStore(data); await reply('✅ Group rules saved. Use .rules to view them.'); break;
      }
      case 'grouplink': case 'revokeinvite': {
        if (!isGroup) { await reply('This command works in groups only.'); break; }
        if (!(await adminGate(sock, chatId, senderId, message, { bot: cmd === 'revokeinvite' }))) break;
        try {
          if (cmd === 'revokeinvite') { await sock.groupRevokeInvite(chatId); await reply('✅ Group invite link has been reset.'); }
          else { const code = await sock.groupInviteCode(chatId); await reply(`🔗 https://chat.whatsapp.com/${code}`); }
        } catch { await reply('❌ Could not retrieve or reset the invite link. Check bot permissions.'); }
        break;
      }
      case 'resetwarn': case 'removewarn': {
        if (!(await adminGate(sock, chatId, senderId, message, { bot: false }))) break;
        const target = mentioned(message)[0] || quotedParticipant(message) || (args[0] ? `${args[0].replace(/\D/g, '')}@s.whatsapp.net` : '');
        if (!target) { await reply(`Usage: .${cmd} @user (or reply to their message)`); break; }
        const p = path.join(DATA_DIR, 'warnings.json'); let w = {}; try { w = JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
        if (w[chatId] && typeof w[chatId] === 'object') delete w[chatId][target];
        delete w[target];
        fs.writeFileSync(p, JSON.stringify(w, null, 2)); await reply(`✅ Warning record cleared for @${jidNum(target)} (where found).`, { mentions: [target] }); break;
      }
      case 'warncount': {
        if (!(await adminGate(sock, chatId, senderId, message, { bot: false }))) break;
        const target = mentioned(message)[0] || quotedParticipant(message) || senderId;
        const p = path.join(DATA_DIR, 'warnings.json'); let w = {}; try { w = JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
        const count = Number(w?.[chatId]?.[target] ?? w?.[target] ?? 0); await reply(`⚠️ Warnings for @${jidNum(target)}: ${count}`, { mentions: [target] }); break;
      }
      case 'poll': {
        if (!isGroup) { await reply('Polls can be created in groups only.'); break; }
        const parts = arg.split('|').map(s => s.trim()).filter(Boolean);
        if (parts.length < 3) { await reply('Usage: .poll Question | Option 1 | Option 2 [| Option 3]\nProvide at least two options.'); break; }
        if (parts.length > 13) { await reply('Maximum: one question and 12 options.'); break; }
        await sock.sendMessage(chatId, { poll: { name: parts[0].slice(0, 200), values: parts.slice(1).map(x => x.slice(0, 100)), selectableCount: 1 } }); break;
      }
      case 'note': case 'noteadd': case 'notes': case 'notelist': case 'note-remove': case 'clearnotes': {
        const u = userConfig(data, senderId); const action = cmd === 'note' ? (args.shift() || 'list').toLowerCase() : (cmd === 'noteadd' ? 'add' : cmd === 'note-remove' ? 'remove' : cmd === 'clearnotes' ? 'clear' : 'list'); const body = (cmd === 'note' ? args.join(' ') : arg.replace(/^(add|remove|clear|list)\s*/i, '')).trim();
        if (action === 'add') { if (!body) { await reply('Usage: .note add <text>'); break; } if (u.notes.length >= 100) { await reply('You have reached the 100-note limit.'); break; } u.notes.push({ text: body.slice(0, 1000), createdAt: new Date().toISOString() }); saveStore(data); await reply(`📝 Note saved. You now have ${u.notes.length} note(s).`); }
        else if (action === 'remove') { const n = Number(body); if (!Number.isInteger(n) || n < 1 || n > u.notes.length) { await reply('Usage: .note remove <note number>'); break; } u.notes.splice(n - 1, 1); saveStore(data); await reply('🗑️ Note removed.'); }
        else if (action === 'clear') { u.notes = []; saveStore(data); await reply('🧹 All your notes have been cleared.'); }
        else { await reply(`📝 *YOUR NOTES*\n${u.notes.map((n,i) => `${i+1}. ${n.text}`).join('\n') || 'No notes yet.'}\n\nUse .note add <text>, .note remove <number>, or .note clear.`); }
        break;
      }
      case 'calc': case 'calcpercent': {
        try { if (cmd === 'calcpercent') { const [part,total] = arg.split(/[\s,]+/).map(Number); if (!Number.isFinite(part) || !Number.isFinite(total) || total === 0) throw new Error('Usage: .calcpercent <part> <total>'); await reply(`${(part / total * 100).toFixed(2)}%`); } else await reply(`🧮 ${arg} = *${safeMath(arg)}*`); }
        catch (e) { await reply(`❌ ${e.message}`); } break;
      }
      case 'qr': {
        if (!arg) { await reply('Usage: .qr <text or URL>'); break; }
        try { const QRCode = require('qrcode'); const image = await QRCode.toBuffer(arg.slice(0, 2000), { type: 'png', width: 512, margin: 2 }); await sock.sendMessage(chatId, { image, caption: '✅ QR code generated.' }, { quoted: message }); }
        catch { await reply('❌ QR generator is unavailable.'); } break;
      }
      case 'shorturl': {
        if (!/^https?:\/\//i.test(arg)) { await reply('Usage: .shorturl https://example.com'); break; }
        try { const axios = require('axios'); const r = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(arg)}`, { timeout: 8000 }); if (String(r.data).startsWith('http')) await reply(`🔗 ${r.data}`); else await reply('❌ URL shortener returned an unexpected response.'); }
        catch { await reply('❌ URL shortening failed. Try again later.'); } break;
      }
      case 'define': {
        if (!arg) { await reply('Usage: .define <word>'); break; }
        try { const axios = require('axios'); const r = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(arg.split(/\s+/)[0])}`, { timeout: 8000 }); const entry = r.data?.[0]; const meaning = entry?.meanings?.[0]?.definitions?.[0]?.definition; await reply(meaning ? `📖 *${entry.word}*\n${meaning}` : 'No definition found.'); }
        catch { await reply('❌ Definition unavailable. Try a single English word.'); } break;
      }
      case 'summarize': {
        if (!arg) { await reply('Usage: .summarize <text>'); break; }
        const sentences = arg.match(/[^.!?]+[.!?]?/g) || [arg]; const selected = sentences.slice(0, Math.max(1, Math.ceil(sentences.length / 3))).join(' ').trim(); await reply(`📝 *SHORT SUMMARY*\n${selected.slice(0, 2500)}${selected.length > 2500 ? '…' : ''}`); break;
      }
      case 'password': {
        const len = Math.min(64, Math.max(12, Number(args[0]) || 20)); const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-_'; let out = ''; for (let i=0;i<len;i++) out += chars[crypto.randomInt(chars.length)]; await reply(`🔐 Random password (${len} chars):\n${out}\n\nKeep it private and store it safely.`); break;
      }
      case 'uuid': await reply(`🆔 ${crypto.randomUUID()}`); break;
      case 'base64': {
        const [action, ...rest] = arg.split(/\s+/); const payload = (['encode','decode'].includes(action) ? rest.join(' ') : arg); if (!payload) { await reply('Usage: .base64 encode/decode <text>'); break; }
        try { const mode = ['encode','decode'].includes(action) ? action : 'encode'; const out = mode === 'encode' ? Buffer.from(payload, 'utf8').toString('base64') : Buffer.from(payload, 'base64').toString('utf8'); await reply(out.slice(0, 3500)); } catch { await reply('❌ Base64 conversion failed.'); } break;
      }
      case 'jsonformat': {
        try { const parsed = JSON.parse(arg); const out = JSON.stringify(parsed, null, 2); await reply('```json\n' + out.slice(0, 3000) + '\n```'); }
        catch { await reply('❌ Invalid JSON. Usage: .jsonformat {"key":"value"}'); } break;
      }
      case 'spellcheck': {
        if (!arg) { await reply('Usage: .spellcheck <text>'); break; }
        try {
          const axios = require('axios');
          const body = new URLSearchParams({ text: arg.slice(0, 8000), language: 'auto' });
          const r = await axios.post('https://api.languagetool.org/v2/check', body.toString(), { timeout: 10000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
          const matches = (r.data?.matches || []).slice(0, 12);
          if (!matches.length) await reply('✅ No spelling/grammar suggestions found.');
          else await reply('✍️ *SPELLCHECK SUGGESTIONS*\n' + matches.map((m,i) => `${i+1}. ${m.message}${m.replacements?.length ? `\n   Suggestion: ${m.replacements.slice(0,3).map(x=>x.value).join(', ')}` : ''}`).join('\n'));
        } catch { await reply('❌ Spellcheck service is unavailable right now. Try again later.'); }
        break;
      }
      case 'remind': {
        const m = arg.match(/^(\d+)(s|m|h)\s+([\s\S]+)/i); if (!m) { await reply('Usage: .remind 30s|10m|2h <reminder text>'); break; }
        const amount = Number(m[1]); const unit = m[2].toLowerCase(); const ms = amount * (unit === 's' ? 1000 : unit === 'm' ? 60000 : 3600000); if (!amount || ms > 7*24*3600000) { await reply('Reminder duration must be between 1 second and 7 days. Reminder only works while the bot process stays online.'); break; }
        const text = m[3].slice(0, 1000); const id = String(++reminderSequence); const timer = setTimeout(() => { sock.sendMessage(chatId, { text: `⏰ Reminder #${id} for @${jidNum(senderId)}: ${text}`, mentions: [senderId] }).catch(()=>{}); activeReminders.delete(id); }, ms); activeReminders.set(id, { id, timer, senderId, chatId, text, dueAt: Date.now() + ms }); await reply(`⏰ Reminder #${id} set for ${m[1]}${unit}. It will not survive a bot restart.`); break;
      }
      case 'version': await reply(`RAUF × LUCIFER MD BOT version ${require('../package.json').version || 'unknown'}\nNode.js ${process.version}`); break;
      case 'uptime': case 'runtime': await reply(`⏱️ Bot process uptime: ${duration(Date.now() - STARTED_AT)}\nSystem uptime: ${duration(os.uptime() * 1000)}`); break;
      case 'botstats': case 'health': {
        const mem = process.memoryUsage(); await reply(`💚 *BOT HEALTH*\nStatus: Online\nProcess uptime: ${duration(Date.now() - STARTED_AT)}\nNode: ${process.version}\nMemory: ${(mem.rss / 1024 / 1024).toFixed(1)} MB RSS\nHeap: ${(mem.heapUsed / 1024 / 1024).toFixed(1)} / ${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB\nPlatform: ${process.platform}\nCommands recorded by extra tools: ${Object.values(data.commandStats).reduce((a,b)=>a+b,0)}`); break;
      }
      case 'commandstats': {
        const top = Object.entries(data.commandStats).sort((a,b)=>b[1]-a[1]).slice(0,20); await reply(`📈 *NEW TOOL COMMAND STATS*\n${top.map(([name,count],i)=>`${i+1}. .${name}: ${count}`).join('\n') || 'No usage recorded yet.'}`); break;
      }
      case 'disabledcmd': await reply(`⛔ Disabled commands: ${data.disabledCommands.map(c=>'.'+c).join(', ') || 'none'}`); break;
      case 'disablecmd': case 'enablecmd': {
        if (!privileged) { await reply('❌ Owner/sudo only.'); break; }
        const name = (args[0] || '').replace(/^\./,'').toLowerCase(); if (!/^[a-z0-9_-]+$/.test(name)) { await reply(`Usage: .${cmd} <command-name>`); break; }
        data.disabledCommands = data.disabledCommands.filter(c=>c!==name); if (cmd === 'disablecmd') data.disabledCommands.push(name); saveStore(data); await reply(`✅ .${name} ${cmd === 'disablecmd' ? 'disabled' : 'enabled'}.`); break;
      }
      case 'maintenance': {
        if (!privileged) { await reply('❌ Owner/sudo only.'); break; }
        const v = (args[0] || 'status').toLowerCase(); if (!['on','off','status'].includes(v)) { await reply('Usage: .maintenance on/off/status'); break; }
        if (v !== 'status') data.maintenance = v === 'on'; saveStore(data); await reply(`🛠️ Maintenance mode: ${data.maintenance ? 'ON' : 'OFF'}`); break;
      }
      case 'backupconfig': {
        if (!privileged) { await reply('❌ Owner/sudo only.'); break; }
        const configPath = path.join(process.cwd(), 'config.js'); const settingsPath = path.join(process.cwd(), 'settings.js');
        const summary = { createdAt: new Date().toISOString(), extraTools: data, config: fs.existsSync(configPath) ? fs.readFileSync(configPath,'utf8') : null, settings: fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath,'utf8') : null };
        const out = Buffer.from(JSON.stringify(summary, null, 2)); await sock.sendMessage(chatId, { document: out, mimetype: 'application/json', fileName: `rauf-config-backup-${Date.now()}.json`, caption: 'Configuration backup (contains settings; keep private).' }, { quoted: message }); break;
      }
      case 'restoreconfig': {
        if (!privileged) { await reply('❌ Owner/sudo only.'); break; }
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const doc = quoted?.documentMessage;
        if (!doc) { await reply('Reply to a .json file created by .backupconfig with .restoreconfig. This restores only the extra-tools settings, not JavaScript source files.'); break; }
        try {
          const stream = await downloadContentFromMessage(doc, 'document'); let buf = Buffer.alloc(0);
          for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);
          const backup = JSON.parse(buf.toString('utf8')); const restored = backup.extraTools;
          if (!restored || typeof restored !== 'object' || !restored.groups || !restored.users || !restored.commandStats || !Array.isArray(restored.disabledCommands)) throw new Error('Unsupported backup structure.');
          saveStore({ groups: restored.groups, users: restored.users, commandStats: restored.commandStats, disabledCommands: restored.disabledCommands, maintenance: Boolean(restored.maintenance) });
          await reply('✅ Extra-tools settings restored from backup.');
        } catch (e) { await reply(`❌ Restore failed: ${String(e.message || 'invalid backup').slice(0,120)}`); }
        break;
      }
      case 'prefix': await reply('Current command prefix is: .\nThis build uses a fixed dot prefix; changing it requires updating the command parser across the project.'); break;
      case 'exportstats': {
        if (!privileged) { await reply('❌ Owner/sudo only.'); break; }
        const out = Buffer.from(JSON.stringify({ exportedAt: new Date().toISOString(), commandStats: data.commandStats, groups: Object.keys(data.groups).length }, null, 2)); await sock.sendMessage(chatId, { document: out, mimetype: 'application/json', fileName: `rauf-stats-${Date.now()}.json` }, { quoted: message }); break;
      }
      case 'clearstats': { if (!privileged) { await reply('❌ Owner/sudo only.'); break; } data.commandStats = {}; saveStore(data); await reply('🧹 Extra-tool command stats cleared.'); break; }
      case 'id': case 'myid': case 'whoami': await reply(`🆔 Your WhatsApp JID: ${senderId}\nChat JID: ${chatId}`); break;
      case 'serverinfo': await reply(`🖥️ *SERVER INFO*\nOS: ${os.type()} ${os.release()}\nPlatform: ${process.platform}\nArchitecture: ${process.arch}\nNode: ${process.version}\nCPUs: ${os.cpus().length}\nTotal RAM: ${(os.totalmem()/1024/1024/1024).toFixed(1)} GB\nFree RAM: ${(os.freemem()/1024/1024/1024).toFixed(1)} GB`); break;
      case 'echo': if (!arg) await reply('Usage: .echo <text>'); else await reply(arg.slice(0, 3000)); break;
      case 'time': await reply(`🕒 ${new Date().toLocaleTimeString()}`); break;
      case 'date': await reply(`📅 ${new Date().toLocaleDateString()}`); break;
      case 'wordcount': await reply(`Words: ${arg ? arg.trim().split(/\s+/).length : 0}\nCharacters: ${arg.length}\nCharacters without spaces: ${arg.replace(/\s/g,'').length}`); break;
      case 'reverse': await reply([...arg].reverse().join('') || 'Usage: .reverse <text>'); break;
      case 'case': { const [style,...rest] = arg.split(/\s+/); const t=rest.join(' '); const out=style==='upper'?t.toUpperCase():style==='lower'?t.toLowerCase():style==='title'?t.replace(/\b\w/g,c=>c.toUpperCase()):null; await reply(out ?? 'Usage: .case upper/lower/title <text>'); break; }
      case 'hash': if (!arg) await reply('Usage: .hash <text>'); else await reply(`SHA-256: ${crypto.createHash('sha256').update(arg).digest('hex')}`); break;
      case 'random': { const [min0,max0]=arg.split(/[\s,]+/); const min=Number(min0), max=Number(max0); if (!Number.isInteger(min)||!Number.isInteger(max)||max<min||max-min>1e9) await reply('Usage: .random <min> <max>'); else await reply(`🎲 ${crypto.randomInt(min,max+1)}`); break; }
      case 'choose': { const opts=arg.split('|').map(x=>x.trim()).filter(Boolean); await reply(opts.length>=2?`🎯 I choose: ${opts[crypto.randomInt(opts.length)]}`:'Usage: .choose option 1 | option 2 | option 3'); break; }
      case 'coinflip': await reply(crypto.randomInt(2) ? '🪙 Heads!' : '🪙 Tails!'); break;
      case 'roll': { const sides=Math.min(1000,Math.max(2,Number(args[0])||6)); await reply(`🎲 d${sides}: ${crypto.randomInt(sides)+1}`); break; }
      case 'privacy': await reply('🔐 Privacy tips: never share OTPs or passwords in groups; keep backups private; only allow trusted admins to use moderation commands.'); break;
      case 'helpsearch': {
        const terms = ['groupstats: group member/admin summary','membercount: count members','adminlist: list group admins','userinfo: show group role','lockgroup/unlockgroup: change posting permissions','slowmode: throttle fast messages','antispam/antiflood: detect repetitive/flood messages','rules/setrules: group rules','poll: create a WhatsApp poll','note: save private notes','calc: basic math','qr: create QR code','health/uptime: runtime info','maintenance: owner maintenance mode','disablecmd/enablecmd: disable/enable commands'];
        const hits=terms.filter(t=>t.toLowerCase().includes(arg.toLowerCase())); await reply(hits.join('\n')||`No extra-tool command matched “${arg}”. Try .help or .menu.`); break;
      }
      case 'permissions': {
        if (!isGroup) { await reply('Use in a group.'); break; } const st=await isAdmin(sock,chatId,senderId); await reply(`👮 Your group admin: ${st.isSenderAdmin?'Yes':'No'}\n🤖 Bot group admin: ${st.isBotAdmin?'Yes':'No'}\n👑 Bot owner/sudo: ${privileged?'Yes':'No'}`); break;
      }
      case 'admincheck': { if (!isGroup) { await reply('Use in a group.'); break; } const st=await isAdmin(sock,chatId,senderId); await reply(`Sender admin: ${st.isSenderAdmin?'Yes':'No'}\nBot admin: ${st.isBotAdmin?'Yes':'No'}`); break; }
      case 'pingcheck': await reply('🏓 Pong! Bot command handler is responding.'); break;
      case 'groupmode': {
        if (!isGroup) { await reply('Use in a group.'); break; } const meta=await sock.groupMetadata(chatId); const st=await isAdmin(sock,chatId,senderId); await reply(`Group: ${meta.subject}\nYour role: ${st.isSenderAdmin?'admin':'member'}\nPosting mode: ${meta.announce?'admins only':'all participants'}`); break;
      }
      case 'tempcheck': { const temp=path.join(process.cwd(),'temp'); const files=fs.existsSync(temp)?fs.readdirSync(temp):[]; await reply(`🧹 Temp directory exists: ${fs.existsSync(temp)?'yes':'no'}\nFiles: ${files.length}`); break; }
      case 'clean-temp': {
        if (!privileged) { await reply('❌ Owner/sudo only.'); break; } const temp=path.join(process.cwd(),'temp'); let removed=0; if (fs.existsSync(temp)) for (const f of fs.readdirSync(temp)) { const p=path.join(temp,f); try { if (fs.statSync(p).isFile()) { fs.unlinkSync(p); removed++; } } catch {} } await reply(`🧹 Removed ${removed} temporary file(s).`); break;
      }
      case 'configstatus': case 'botconfig': await reply(`⚙️ Prefix: .\nOwner number: configured in settings/.env\nExtra tools store: data/extra-tools.json\nMaintenance: ${data.maintenance?'ON':'OFF'}\nDisabled commands: ${data.disabledCommands.length}`); break;
      case 'aboutbot': await reply(`🤖 RAUF × LUCIFER MD BOT WhatsApp Bot\nNode.js ${process.version}\nUse .menu to see native commands and .helpsearch <term> to search extra tools.`); break;
      case 'supportinfo': { const st = require('../settings'); await reply(`🛟 *Support — ${st.botName}*\n\n📢 Channel:\n${st.channelLink}\n\n💫 Group:\n${st.groupLink}\n\n👤 Owner: ${st.botOwner} (+${st.ownerNumber})`); break; }
      case 'pinhelp': case 'pollhelp': case 'pollvotehelp': await reply('📊 WhatsApp polls are native polls. Create one with: .poll Question | Option 1 | Option 2. Vote directly on the poll message.'); break;
      case 'quotedinfo': { const q=message.message?.extendedTextMessage?.contextInfo; if (!q?.stanzaId) await reply('Reply to a message with .quotedinfo.'); else await reply(`Quoted message ID: ${q.stanzaId}\nParticipant: ${q.participant || 'not provided'}\nRemote JID: ${q.remoteJid || chatId}`); break; }
      case 'messageid': await reply(`Message ID: ${message.key?.id || 'not available'}`); break;
      case 'groupconfig': {
        if (!isGroup) { await reply('Use in a group.'); break; } const cfg=groupConfig(data,chatId); await reply(`⚙️ Group config\nSlowmode: ${cfg.slowmodeSeconds||0}s\nAnti-spam: ${cfg.antispam?'on':'off'}\nAnti-flood: ${cfg.antiflood?'on':'off'}\nRules: ${cfg.rules?'configured':'not set'}`); break;
      }
      case 'reminderlist': {
        const own = [...activeReminders.values()].filter(r => r.senderId === senderId);
        await reply(`⏰ *YOUR ACTIVE REMINDERS*\n${own.map(r => `#${r.id} — ${r.text} (in ${duration(Math.max(0,r.dueAt-Date.now()))})`).join('\n') || 'No active reminders.'}\n\nUse .cancelreminder <id> to cancel one.`); break;
      }
      case 'cancelreminder': {
        const r = activeReminders.get(args[0]); if (!r || r.senderId !== senderId) { await reply('❌ Reminder not found. Use .reminderlist to see your active reminder IDs.'); break; }
        clearTimeout(r.timer); activeReminders.delete(r.id); await reply(`✅ Reminder #${r.id} cancelled.`); break;
      }
      case 'cleanlinks': await reply('Use .antilinkmode delete/allowlist and .allowlink <domain> or .blocklink <domain> to configure link moderation. The bot cannot retroactively delete old messages.'); break;
      case 'maintenance-status': await reply(`Maintenance mode: ${data.maintenance?'ON':'OFF'}`); break;
      default: return false;
    }
    saveStore(data);
    return true;
  } catch (err) {
    console.error('[RAUF EXTRA TOOLS]', err);
    await reply(`❌ Command failed: ${String(err.message || 'unknown error').slice(0,180)}`);
    return true;
  }
}

async function handleIncoming(sock, message, context = {}) {
  try {
    const chatId = message?.key?.remoteJid || '';
    if (!chatId.endsWith('@g.us') || !message?.message || message.key?.fromMe) return;
    const senderId = message.key?.participant || '';
    if (!senderId) return;
    const data = loadStore(); const isNewGroup = !data.groups[chatId]; const cfg = groupConfig(data, chatId); if (isNewGroup) saveStore(data);   // no disk write on every message
    const hasActiveRule = Boolean(cfg.slowmodeSeconds || cfg.antispam || cfg.antiflood || cfg.antimention || cfg.antisticker || cfg.antimedia || cfg.antiforward || cfg.antilinkMode === 'delete' || cfg.antilinkMode === 'allowlist' || (cfg.blockLinks || []).length || (cfg.badWords || []).length);
    if (!hasActiveRule) return;
    const text = getText(message).trim().toLowerCase();
    const now = Date.now(); const key = `${chatId}:${senderId}`;
    const status = await isAdmin(sock, chatId, senderId).catch(()=>({isSenderAdmin:false,isBotAdmin:false}));
    if (status.isSenderAdmin) return;
    let reason = '';
    if (cfg.slowmodeSeconds) {
      const last = recentCommands.get(key) || 0;
      if (now - last < cfg.slowmodeSeconds * 1000) reason = `Slowmode: wait ${Math.ceil((cfg.slowmodeSeconds*1000-(now-last))/1000)}s.`;
      else recentCommands.set(key, now);
    }
    const media = message.message.imageMessage || message.message.videoMessage || message.message.documentMessage || message.message.audioMessage;
    const sticker = message.message.stickerMessage;
    const forwarded = Boolean(message.message.extendedTextMessage?.contextInfo?.isForwarded || message.message.imageMessage?.contextInfo?.isForwarded || message.message.videoMessage?.contextInfo?.isForwarded);
    const mentions = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!reason && cfg.antimedia && media) reason = 'Media messages are restricted by this group.';
    if (!reason && cfg.antisticker && sticker) reason = 'Stickers are restricted by this group.';
    if (!reason && cfg.antiforward && forwarded) reason = 'Forwarded messages are restricted by this group.';
    if (!reason && cfg.antimention && mentions.length > (cfg.antimentionLimit || 5)) reason = `Too many mentions (limit ${cfg.antimentionLimit || 5}).`;
    const urls = [...text.matchAll(/(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})(?:\/[^\s]*)?/gi)].map(m=>m[1].toLowerCase().replace(/^www\./,''));
    if (!reason && urls.length && cfg.antilinkMode === 'delete') reason = 'Links are disabled in this group.';
    if (!reason && urls.length && cfg.antilinkMode === 'allowlist' && !(cfg.allowLinks || []).length) reason = 'No link domains have been approved yet.';
    if (!reason && urls.length && cfg.blockLinks?.some(d=>urls.some(u=>u===d||u.endsWith('.'+d)))) reason = 'This domain is blocked in this group.';
    if (!reason && urls.length && (cfg.antilinkMode === 'allowlist' || (cfg.antispam && cfg.allowLinks?.length)) && cfg.allowLinks?.length && urls.some(u=>!cfg.allowLinks.some(d=>u===d||u.endsWith('.'+d)))) reason = 'Only approved link domains are allowed in this group.';
    if (!reason && (cfg.badWords||[]).some(w=>w && text.includes(w))) reason = 'Your message contains a blocked word.';
    if (!reason && cfg.antiflood) {
      const list = recentMessages.get(key) || []; const recent = list.filter(t=>now-t<10000); recent.push(now); recentMessages.set(key,recent);
      if (recent.length > (cfg.antifloodLimit || 5)) reason = 'Please slow down: message flood detected.';
    }
    if (!reason && cfg.antispam && text) {
      const last = recentMessages.get(`${key}:duplicate`) || {text:'',at:0};
      if (last.text === text && now-last.at < 8000) reason = 'Duplicate messages are blocked by anti-spam.';
      recentMessages.set(`${key}:duplicate`, {text,at:now});
    }
    if (!reason) return;
    if (status.isBotAdmin) { try { await sock.sendMessage(chatId, { delete: message.key }); } catch {} }
    if (cfg.modlog !== false) await sock.sendMessage(chatId, { text: `🛡️ @${jidNum(senderId)}: ${reason}`, mentions: [senderId] }).catch(()=>{});
  } catch (e) { console.error('[RAUF EXTRA MODERATION]', e); }
}

module.exports = { handleExtraCommand, handleIncoming, setAntilinkMode };
