'use strict';
// RAUF × LUCIFER MD BOT by RAUF × LUCIFER — extra group-management commands (new; none of these existed before).
//   .joinmode on|off      approve-to-join on/off
//   .addmode all|admin    who may add members
//   .demoteall            demote every admin except bot & group owner (group owner / bot owner only)
//   .groupowner           show the group's creator
//   .groupcreated         creation date, owner and size
//   .listcc <code>        list members whose number starts with a country code
//   .kickcc <code>        remove non-admin members with a country code (anti-fake)
//   .tagrandom            tag one random member
const COMMANDS = ['joinmode', 'addmode', 'demoteall', 'groupowner', 'groupcreated', 'listcc', 'kickcc', 'tagrandom', 'antibot'];

const clean = (v) => String(v || '').toLowerCase().replace(/:\d+(?=@)/, '');
const digits = (jid) => clean(jid).split('@')[0].replace(/\D/g, '');
const pid = (p) => p?.id || p?.jid || p?.lid || '';
const phoneOf = (p) => {
  const pn = p?.phoneNumber || p?.pn || '';
  if (pn) return digits(pn);
  const id = clean(pid(p));
  return id.endsWith('@s.whatsapp.net') ? digits(id) : '';
};
const isAdminP = (p) => p?.admin === 'admin' || p?.admin === 'superadmin';

async function handleGroupPlus(sock, message, ctx = {}) {
  const chatId = message?.key?.remoteJid || '';
  const text = (message?.message?.conversation || message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption || message?.message?.videoMessage?.caption || '').trim();
  const m = text.match(/^\.([a-z0-9_-]+)(?:\s+([\s\S]*))?$/i);
  if (!m) return false;
  const cmd = m[1].toLowerCase();
  if (!COMMANDS.includes(cmd)) return false;
  const arg = (m[2] || '').trim();
  const reply = (t, extra = {}) => sock.sendMessage(chatId, { text: t, ...extra }, { quoted: message });

  if (!chatId.endsWith('@g.us')) { await reply('❌ This command only works in groups.'); return true; }

  try {
    const isAdmin = require('../lib/isAdmin');
    const senderId = message.key.participant || message.key.participantAlt || message.participant || '';
    const status = await isAdmin(sock, chatId, [message.key.participantAlt, message.key.remoteJidAlt, message.key.participant, senderId]);
    const privileged = !!ctx.isOwner || !!message.key.fromMe;
    const senderOk = status.isSenderAdmin || privileged;
    const meta = await sock.groupMetadata(chatId);
    const parts = meta.participants || [];

    const needAdmin = async (needBot = true) => {
      if (!senderOk) { await reply('❌ Only group admins can use this command.'); return false; }
      if (needBot && !status.isBotAdmin) { await reply('❌ Please make the bot an admin first.'); return false; }
      return true;
    };

    switch (cmd) {
      case 'joinmode': {
        if (!(await needAdmin())) return true;
        const v = arg.toLowerCase();
        if (!['on', 'off'].includes(v)) { await reply('ℹ️ Usage: *.joinmode on* or *.joinmode off*\nWhen ON, new members need admin approval to join.'); return true; }
        await sock.groupJoinApprovalMode(chatId, v);
        await reply(v === 'on' ? '✅ Join approval is now *ON* — admins must approve new members.' : '✅ Join approval is now *OFF* — anyone with the link can join.');
        return true;
      }
      case 'addmode': {
        if (!(await needAdmin())) return true;
        const v = arg.toLowerCase();
        if (!['all', 'admin'].includes(v)) { await reply('ℹ️ Usage: *.addmode all* (everyone can add) or *.addmode admin* (only admins can add)'); return true; }
        await sock.groupMemberAddMode(chatId, v === 'all' ? 'all_member_add' : 'admin_add');
        await reply(v === 'all' ? '✅ Now *everyone* can add members.' : '✅ Now only *admins* can add members.');
        return true;
      }
      case 'demoteall': {
        const ownerId = clean(meta.owner || meta.ownerPn || '');
        const isGroupOwner = ownerId && (digits(ownerId) === digits(senderId) || clean(ownerId) === clean(senderId));
        if (!(isGroupOwner || privileged)) { await reply('❌ Only the group owner or the bot owner can use this command.'); return true; }
        if (!status.isBotAdmin) { await reply('❌ Please make the bot an admin first.'); return true; }
        const botNum = digits(sock.user?.id);
        const targets = parts.filter((p) => isAdminP(p) && p.admin !== 'superadmin' && digits(pid(p)) !== botNum && clean(pid(p)) !== ownerId).map(pid);
        if (!targets.length) { await reply('ℹ️ There are no other admins to demote.'); return true; }
        await sock.groupParticipantsUpdate(chatId, targets, 'demote');
        await reply(`✅ Demoted *${targets.length}* admin(s). Only the owner and the bot remain.`);
        return true;
      }
      case 'groupowner': {
        const owner = meta.owner || meta.ownerPn || parts.find((p) => p.admin === 'superadmin')?.id || '';
        if (!owner) { await reply('❌ Could not find the group owner.'); return true; }
        await reply(`👑 *GROUP OWNER*\n\n@${digits(owner) || clean(owner).split('@')[0]}`, { mentions: [owner] });
        return true;
      }
      case 'groupcreated': {
        const when = meta.creation ? new Date(meta.creation * 1000).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown';
        const owner = meta.owner || parts.find((p) => p.admin === 'superadmin')?.id || '';
        const admins = parts.filter(isAdminP).length;
        await reply(`🗓️ *GROUP INFO*\n\n📛 Name: ${meta.subject}\n📅 Created: ${when} (IST)\n👑 Owner: ${owner ? '@' + digits(owner) : 'Unknown'}\n👥 Members: ${parts.length}\n🛡️ Admins: ${admins}`, owner ? { mentions: [owner] } : {});
        return true;
      }
      case 'listcc':
      case 'kickcc': {
        const code = arg.replace(/\D/g, '');
        if (!code) { await reply(`ℹ️ Usage: *.${cmd} <country code>*\nExample: *.${cmd} 92*`); return true; }
        if (cmd === 'kickcc' && !(await needAdmin())) return true;
        if (cmd === 'listcc' && !senderOk) { await reply('❌ Only group admins can use this command.'); return true; }
        const botNum = digits(sock.user?.id);
        const matches = parts.filter((p) => phoneOf(p).startsWith(code) && digits(pid(p)) !== botNum);
        const hidden = parts.filter((p) => !phoneOf(p)).length;
        if (cmd === 'listcc') {
          if (!matches.length) { await reply(`ℹ️ No members found with +${code}.${hidden ? `\n(${hidden} member(s) hide their number.)` : ''}`); return true; }
          await reply(`🌍 *+${code} MEMBERS (${matches.length})*\n\n${matches.map((p, i) => `${i + 1}. @${phoneOf(p)}`).join('\n')}${hidden ? `\n\n(${hidden} member(s) hide their number.)` : ''}`, { mentions: matches.map(pid) });
          return true;
        }
        const targets = matches.filter((p) => !isAdminP(p)).map(pid);
        if (!targets.length) { await reply(`ℹ️ No removable (non-admin) members found with +${code}.`); return true; }
        for (let i = 0; i < targets.length; i += 5) {
          await sock.groupParticipantsUpdate(chatId, targets.slice(i, i + 5), 'remove');
          await new Promise((r) => setTimeout(r, 1500));
        }
        await reply(`✅ Removed *${targets.length}* member(s) with +${code}.`);
        return true;
      }
      case 'antibot': {
        const antibot = require('../lib/antibot');
        const v = arg.toLowerCase();
        if (!['on', 'off', 'status'].includes(v)) { await reply('ℹ️ Usage: *.antibot on* | *.antibot off* | *.antibot status*\nWhen ON, messages that look like another bot\'s command menu are removed automatically.'); return true; }
        if (v === 'status') { await reply(`🤖 Anti-Bot is currently *${antibot.isEnabled(chatId) ? 'ON' : 'OFF'}*.`); return true; }
        if (!(await needAdmin())) return true;
        antibot.setEnabled(chatId, v === 'on');
        await reply(v === 'on' ? '✅ *Anti-Bot* is now *ON*. Messages that look like another bot\'s menu will be deleted.' : '✅ *Anti-Bot* is now *OFF*.');
        return true;
      }
      case 'tagrandom': {
        const botNum = digits(sock.user?.id);
        const pool = parts.filter((p) => digits(pid(p)) !== botNum);
        if (!pool.length) { await reply('❌ No members found.'); return true; }
        const pick = pid(pool[Math.floor(Math.random() * pool.length)]);
        await reply(`🎲 *RANDOM PICK*\n\n@${digits(pick) || clean(pick).split('@')[0]} — you were chosen! 🎉`, { mentions: [pick] });
        return true;
      }
    }
  } catch (e) {
    console.error(`[groupplus .${cmd}]`, e);
    await reply('❌ Something went wrong. Please try again.');
    return true;
  }
  return false;
}

module.exports = { COMMANDS, handleGroupPlus };
