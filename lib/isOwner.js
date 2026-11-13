const settings = require('../settings');
const { isSudo } = require('./index');

function normalizeJid(value) {
  return String(value || '').trim().toLowerCase().replace(/:\d+(?=@)/g, '');
}
function phoneDigits(value) {
  const jid = normalizeJid(value);
  if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@c.us')) return '';
  return jid.slice(0, jid.indexOf('@')).replace(/\D/g, '');
}
function ownerNumbersFor(sock) {
  // A paired session's owner is the paired person. The main bot's owners are the owner number AND the number the bot is linked to.
  if (sock?.__ownerNumber) return [String(sock.__ownerNumber).replace(/\D/g, '')].filter(Boolean);
  const all = [process.env.PAIRING_NUMBER, process.env.OWNER_NUMBER, settings.ownerNumber, settings.ownerNumber2].map((x) => String(x || '').replace(/\D/g, '')).filter(Boolean);
  return [...new Set(all)];
}
async function mappedPhoneForLid(sock, lidJid) {
  if (!sock || !normalizeJid(lidJid).endsWith('@lid')) return '';
  try {
    const mapped = await sock.signalRepository?.lidMapping?.getPNForLID?.(normalizeJid(lidJid));
    return phoneDigits(mapped);
  } catch (e) {
    console.error('[owner lookup] LID mapping unavailable:', e?.message || e);
    return '';
  }
}
async function isOwnerOrSudo(senderId, sock = null, chatId = null) {
  const sender = normalizeJid(senderId);
  const owners = ownerNumbersFor(sock);
  const senderPhone = phoneDigits(sender);

  // Owner's configured full phone number, compared exactly (never suffix/partial matching).
  if (owners.length && senderPhone && owners.includes(senderPhone)) return true;

  // Never grant owner privileges merely because an identifier matches the paired account's LID.
  // The configured full phone number (or an explicit Baileys LID->phone mapping) is authoritative.

  // For an incoming LID, ask Baileys for the explicit LID -> phone-number mapping.
  if (owners.length && sender.endsWith('@lid')) {
    const mappedPhone = await mappedPhoneForLid(sock, sender);
    if (mappedPhone && owners.includes(mappedPhone)) return true;
  }

  // Some group metadata versions expose both a LID and its phone JID on one participant.
  if (owners.length && sock && sender.endsWith('@lid') && String(chatId || '').endsWith('@g.us')) {
    try {
      const metadata = await sock.groupMetadata(chatId);
      for (const participant of metadata?.participants || []) {
        const ids = [participant?.id, participant?.jid, participant?.lid].filter(Boolean).map(normalizeJid);
        const phone = phoneDigits(participant?.phoneNumber) || ids.map(phoneDigits).find(Boolean) || '';
        if (owners.includes(phone) && ids.includes(sender)) return true;
        if (sender.endsWith('@lid') && ids.includes(sender) && owners.includes(phone)) return true;
      }
    } catch (e) {
      console.error('[owner lookup] group metadata unavailable:', e?.message || e);
    }
  }

  try {
    // Sudo is also exact-ID only; do not use partial number matching.
    const sudo = await isSudo(sender);
    if (sudo) return true;
    const rawSudo = await isSudo(senderId);
    if (rawSudo) return true;
  } catch {}
  return false;
}

module.exports = isOwnerOrSudo;
