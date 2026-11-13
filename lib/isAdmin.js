// Robust Baileys group-admin lookup. Participant IDs can be phone JIDs or LIDs.
function cleanId(value) {
  return String(value || '').trim().toLowerCase().replace(/:\d+(?=@)/g, '');
}
function jidParts(value) {
  const id = cleanId(value);
  const at = id.indexOf('@');
  if (at < 0) return { full: id, user: id, domain: '' };
  return { full: id, user: id.slice(0, at), domain: id.slice(at + 1) };
}
function sameId(a, b) {
  if (!a || !b) return false;
  const x = jidParts(a), y = jidParts(b);
  if (x.full === y.full) return true;
  // Only compare local parts across the two WhatsApp identity formats when one
  // participant explicitly provides both id and lid/phoneNumber; don't equate
  // unrelated IDs from different domains globally.
  return false;
}
function participantMatches(participant, id) {
  if (!participant || !id) return false;
  if (Array.isArray(id)) return id.filter(Boolean).some(value => participantMatches(participant, value));
  const candidateIds = [participant.id, participant.lid, participant.phoneNumber].filter(Boolean).map(value => {
    const raw = String(value).trim();
    return raw.includes('@') ? raw : (/^\+?\d+$/.test(raw) ? `${raw.replace(/\D/g, '')}@s.whatsapp.net` : raw);
  });
  if (candidateIds.some(candidate => sameId(candidate, id))) return true;
  // Some Baileys builds send a device-qualified phone JID while metadata exposes
  // the base phone JID. Compare phone numbers only for phone-JID variants.
  const target = jidParts(id);
  if (target.domain === 's.whatsapp.net') {
    const targetDigits = target.user.replace(/\D/g, '');
    return !!targetDigits && candidateIds.some(candidate => {
      const c = jidParts(candidate);
      return c.domain === 's.whatsapp.net' && c.user.replace(/\D/g, '') === targetDigits;
    });
  }
  return false;
}
function isAdminParticipant(p) {
  return !!p && (p.admin === 'admin' || p.admin === 'superadmin' || p.isAdmin === true || p.isSuperAdmin === true);
}
async function isAdmin(sock, chatId, senderId) {
  if (!String(chatId || '').endsWith('@g.us')) return { isSenderAdmin: false, isBotAdmin: false };
  try {
    const metadata = await sock.groupMetadata(chatId);
    const participants = Array.isArray(metadata?.participants) ? metadata.participants : [];
    const sender = participants.find(p => participantMatches(p, senderId));
    const selfIds = [sock.user?.id, sock.user?.lid].filter(Boolean);
    const bot = participants.find(p => selfIds.some(id => participantMatches(p, id)));
    return {
      isSenderAdmin: isAdminParticipant(sender),
      isBotAdmin: isAdminParticipant(bot),
      senderFound: !!sender,
      botFound: !!bot
    };
  } catch (error) {
    console.error('[isAdmin] Could not fetch group metadata:', error?.message || error);
    return { isSenderAdmin: false, isBotAdmin: false, senderFound: false, botFound: false };
  }
}
module.exports = isAdmin;
