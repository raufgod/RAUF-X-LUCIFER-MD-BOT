'use strict';
// Group metadata cache: sock.groupMetadata() is a network call to WhatsApp. Many checks (admin, owner, anti-spam) ask for it on
// EVERY message, which is the main reason replies in groups felt slow. Now one real call per group per 2 minutes,
// and the cache is dropped as soon as the group changes.
const TTL = 120000;
function patch(sock) {
  if (!sock || sock.__gmCache || typeof sock.groupMetadata !== 'function') return sock;
  sock.__gmCache = true;
  const real = sock.groupMetadata.bind(sock);
  const cache = new Map();                       // jid -> { t, p }
  sock.groupMetadata = (jid) => {
    const hit = cache.get(jid);
    if (hit && Date.now() - hit.t < TTL) return hit.p;
    const p = real(jid);
    cache.set(jid, { t: Date.now(), p });
    p.catch(() => { if (cache.get(jid)?.p === p) cache.delete(jid); });
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    return p;
  };
  const drop = (u) => { try { for (const x of [].concat(u || [])) { const id = x?.id || x?.jid; if (id) cache.delete(id); } } catch (_) {} };
  try {
    sock.ev.on('groups.update', drop);
    sock.ev.on('group-participants.update', drop);
  } catch (_) {}
  return sock;
}
module.exports = { patch };
