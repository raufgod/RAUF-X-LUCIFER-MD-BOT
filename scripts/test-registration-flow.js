'use strict';
// Registration -> owner number + ready message for the website popup; a "hi" sent before the voice note is due is remembered, not answered.
const os = require('os'), path = require('path'), fs = require('fs'), assert = require('assert');
process.env.CALL_QUEUE_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'reg-')), 'q.json');
process.env.CALL_DRYRUN = '1';
const CA = require('../lib/callAgent'); const WA = require('../lib/callAgent/wa'); const store = require('../lib/callAgent/store');
WA.setSocket({ user: { id: '919000000001:12@s.whatsapp.net' } });
const r = CA.register({ name: 'Rahul', number: '919876543210', consent: true }, '1.2.3.4');
assert(r.out.ok && r.out.scheduled && r.out.owner === '919000000001' && /Rahul/.test(r.out.hiText)); console.log('ok registration returns owner number + default message');
const again = CA.register({ name: 'Rahul', number: '919876543210', consent: true }, '1.2.3.4');
assert(again.out.already && again.out.owner === '919000000001'); console.log('ok already-registered also gets the owner number');
const sock = { user: { id: '919000000001:12@s.whatsapp.net' }, sendMessage: async () => { throw new Error('must stay silent'); }, readMessages: async () => {} };
const mek = { key: { id: 'H1', remoteJid: '919876543210@s.whatsapp.net', fromMe: false }, message: { conversation: 'Hi, I am Rahul' }, messageTimestamp: Math.floor(Date.now() / 1000) };
(async () => {
  assert(r.out.awaiting && r.out.id); assert.equal(store.load().jobs[0].status, 'awaiting'); console.log('ok registered -> waiting for Continue (nothing scheduled yet)');
  assert.equal(await WA.handleIncoming(sock, mek, 'notify'), true); console.log('ok "hi" before Continue: swallowed silently (no double intro from the normal bot)');
  const c = CA.confirm({ id: r.out.id }, '1.2.3.4'); assert(c.out.ok); const job = store.load().jobs[0]; assert.equal(job.status, 'pending'); console.log('ok Continue -> voice note scheduled');
  assert.equal(await WA.handleIncoming(sock, { ...mek, key: { ...mek.key, id: 'H2' } }, 'notify'), true); assert(job.contactedAt); console.log('ok "hi" after Continue: swallowed silently, voice note stays scheduled');
  console.log('REG FLOW PASSED');
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
