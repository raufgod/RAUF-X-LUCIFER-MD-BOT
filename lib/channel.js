// RAUF × LUCIFER MD BOT 💫 — official channel resolver
const fs = require('fs');
const path = require('path');

const CHANNEL_NAME = 'RAUF × LUCIFER MD BOT 👑';
const CHANNEL_LINK = 'https://whatsapp.com/channel/0029VbDZOHWLtOjKFsWcAP0a';
const INVITE_CODE = CHANNEL_LINK.split('/channel/')[1];
const FILE = path.join(process.cwd(), 'data', 'channel.json');

function readState() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}

const NEWSLETTER_RE = /^\d{10,25}@newsletter$/;
const LINK_RE = /^https?:\/\/(?:www\.)?whatsapp\.com\/channel\/([A-Za-z0-9_-]{10,})\/?(?:\?.*)?$/i;

/** Channel currently in use: the owner's custom one (.channeljid) or the built-in official one. */
function getChannel() {
  const st = readState();
  const jidEnv = String(process.env.CHANNEL_JID || '').trim();
  if (st.custom && st.link) return { name: st.name || CHANNEL_NAME, link: st.link, jid: NEWSLETTER_RE.test(jidEnv) ? jidEnv : (st.jid || null), custom: true };
  return { name: CHANNEL_NAME, link: CHANNEL_LINK, jid: NEWSLETTER_RE.test(jidEnv) ? jidEnv : (st.jid || null), custom: false };
}

/** Link -> { jid, name, link } using WhatsApp itself (needs a connected socket). */
async function resolveFromLink(sock, rawLink) {
  const m = String(rawLink || '').trim().match(LINK_RE);
  if (!m) throw new Error('That is not a channel link. It should look like https://whatsapp.com/channel/0029Vb...');
  if (typeof sock?.newsletterMetadata !== 'function') throw new Error('This WhatsApp library cannot look up channels. Give the JID directly: .setchanneljid 120363...@newsletter');
  let meta;
  try { meta = await sock.newsletterMetadata('invite', m[1]); }
  catch (e) { throw new Error('WhatsApp could not find that channel (' + (e?.message || e) + '). Check the link, or give the JID directly.'); }
  const jid = meta?.id || meta?.jid;
  if (!NEWSLETTER_RE.test(String(jid || ''))) throw new Error('WhatsApp did not return a channel ID for that link. Give the JID directly: .setchanneljid 120363...@newsletter');
  return { jid, name: meta?.name || meta?.thread_metadata?.name?.text || CHANNEL_NAME, link: 'https://whatsapp.com/channel/' + m[1] };
}

/** Save the owner's own channel (link + JID + name). Everything (cards, menu, forward label) follows it. */
function saveCustomChannel({ jid, name, link }) {
  const state = { name: name || CHANNEL_NAME, link: link || CHANNEL_LINK, jid, custom: true, resolvedAt: new Date().toISOString(), metadataName: name || CHANNEL_NAME };
  saveState(state);
  if (link) {
    try { require('./botConfig').setLink('channelLink', link); } catch (_) {}
  }
  return state;
}

async function resolveOfficialChannel(sock) {
  const current = readState();
  if (current.custom && current.jid) return current;     // owner chose their own channel — never overwrite it
  if (current.name === CHANNEL_NAME && current.link === CHANNEL_LINK && current.jid) {
    return current;
  }

  let jid = current.jid || null;
  let metadata = null;
  try {
    if (typeof sock.newsletterMetadata === 'function') {
      metadata = await sock.newsletterMetadata('invite', INVITE_CODE);
      jid = metadata?.id || metadata?.jid || jid;
    }
  } catch (error) {
    console.log('[CHANNEL] Invite resolution unavailable:', error?.message || error);
  }

  const state = {
    name: CHANNEL_NAME,
    link: CHANNEL_LINK,
    jid,
    resolvedAt: new Date().toISOString(),
    metadataName: metadata?.name || CHANNEL_NAME
  };
  saveState(state);
  return state;
}

module.exports = { CHANNEL_NAME, CHANNEL_LINK, NEWSLETTER_RE, LINK_RE, getChannel, resolveFromLink, saveCustomChannel, resolveOfficialChannel };
