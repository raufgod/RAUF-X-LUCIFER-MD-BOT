// .truecaller <number>   caller-ID lookup (name, carrier, place, spam score) using the bundled truecallerjs 2.2.0 (lib/truecallerjs).
// Needs YOUR Truecaller installationId (login once with the truecallerjs CLI: `npx truecallerjs login`).
// Put it in .env as TRUECALLER_INSTALLATION_ID=a1i0...   or send  .truecaller setid <id>   to the bot (owner only).
// Owner/sudo only. Returns caller-ID details only (no e-mail or street address).
const fs = require('fs');
const FILE = './data/truecaller.json';

function readCfg() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')) || {}; } catch { return {}; } }
function writeCfg(c) { try { fs.mkdirSync('./data', { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(c, null, 2)); } catch {} }
const installationId = () => String(process.env.TRUECALLER_INSTALLATION_ID || readCfg().installationId || '').trim();
const defaultRegion = () => String(process.env.TRUECALLER_COUNTRY || readCfg().region || 'IN').trim().toUpperCase();

async function truecallerCommand(sock, chatId, message, args) {
    const reply = (t) => sock.sendMessage(chatId, { text: t }, { quoted: message });
    const parts = String(args || '').trim().split(/\s+/).filter(Boolean);

    if (!parts.length) return reply('*🔎 TRUECALLER*\n\n.truecaller <number>  - e.g. .truecaller +919876543210\n.truecaller setid <installationId>  - save your Truecaller login id\n.truecaller country <IN|US|…>  - default country for numbers without +code');
    if (parts[0].toLowerCase() === 'setid') {
        const id = parts[1] || '';
        if (id.length < 10) return reply('Send it like:  .truecaller setid <installationId>');
        writeCfg({ ...readCfg(), installationId: id });
        return reply('✅ Truecaller login id saved. You can delete that message from the chat now.');
    }
    if (parts[0].toLowerCase() === 'country') {
        const rc = (parts[1] || '').toUpperCase();
        if (!/^[A-Z]{2}$/.test(rc)) return reply('Use a 2-letter country code, e.g. .truecaller country IN');
        writeCfg({ ...readCfg(), region: rc });
        return reply(`Default country is now *${rc}*.`);
    }

    const id = installationId();
    if (!id) return reply('Truecaller is not set up yet.\n\n1) Run `npx truecallerjs login` once on any computer and verify the OTP.\n2) Then send:  .truecaller setid <installationId>\n(or put TRUECALLER_INSTALLATION_ID in .env)');

    const raw = parts.join('');
    const number = raw.replace(/[^\d+]/g, '');
    if (number.replace(/\D/g, '').length < 7) return reply('Send a valid number, e.g. .truecaller +919876543210');

    try {
        const { search } = require('../lib/truecallerjs/search.js');
        const res = await search({ number, countryCode: defaultRegion(), installationId: id });
        const j = res.json();
        const status = j && (j.status || (j.response && j.response.status));
        if (status === 401 || status === 403) return reply('❌ Truecaller refused the login id (expired or wrong). Login again and use .truecaller setid <new id>.');
        if (status === 429) return reply('⏳ Truecaller limit reached for now. Try again later.');
        const d = j && j.data && j.data[0];
        if (!d) return reply('No Truecaller result for this number.');
        const ph = (d.phones && d.phones[0]) || {};
        const ad = (d.addresses && d.addresses[0]) || {};
        const country = (() => { try { return res.getCountryDetails().name; } catch { return ''; } })();
        const place = [ad.city, country && country !== 'unknown' ? country : ad.countryCode].filter(Boolean).join(', ');
        const spam = d.spamInfo || {};
        const lines = [
            '*🔎 TRUECALLER*',
            '',
            `📞 *Number:* ${ph.e164Format || number}`,
            `👤 *Name:* ${d.name || 'unknown'}`,
            d.altName ? `🏷️ *Alt name:* ${d.altName}` : '',
            ph.carrier ? `📡 *Carrier:* ${ph.carrier}` : '',
            ph.numberType ? `📱 *Type:* ${ph.numberType}` : '',
            place ? `📍 *Place:* ${place}` : '',
            (d.score !== undefined || spam.spamScore !== undefined || spam.spamType) ? `🚨 *Spam:* ${spam.spamType || (d.score > 0.5 ? 'likely spam' : 'not marked')}${spam.spamScore !== undefined ? ` (score ${spam.spamScore})` : ''}` : ''
        ].filter((x) => x !== '');
        return reply(lines.join('\n'));
    } catch (e) {
        console.error('[truecaller]', e && e.message || e);
        return reply('❌ Lookup failed. Check the number and try again.');
    }
}

module.exports = { truecallerCommand };
