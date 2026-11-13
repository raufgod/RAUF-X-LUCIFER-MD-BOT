// Collects members who show as online/typing in a group (best effort).
export async function getOnlineMembers(sock, groupJid, waitMs = 4000) {
  const meta = await sock.groupMetadata(groupJid);
  const online = new Set();
  const handler = ({ id, presences }) => {
    if (id !== groupJid || !presences) return;
    for (const [jid, p] of Object.entries(presences)) {
      if (['available', 'composing', 'recording'].includes(p?.lastKnownPresence)) online.add(jid);
    }
  };
  sock.ev.on('presence.update', handler);
  try {
    for (const p of meta.participants) { try { await sock.presenceSubscribe(p.id); } catch {} }
    await new Promise(r => setTimeout(r, waitMs));
  } finally { sock.ev.off('presence.update', handler); }
  return [...online];
}
export default getOnlineMembers;
