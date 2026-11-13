


const axios = require('axios');

async function apkCommand(sock, chatId, message) {
    try {
        // Extract the message text
        const userMessage =
            message.message.conversation ||
            message.message.extendedTextMessage?.text ||
            '';
        const appName = userMessage.split(' ').slice(1).join(' ');

        if (!appName) {
            await sock.sendMessage(
                chatId,
                { text: '⚠️ Please provide an app name.\n\n*Example:* `.apk whatsapp`' },
                { quoted: message }
            );
            return;
        }

        // Loading reaction
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        // API call
        const apiUrl = 'https://api.nexoracle.com/downloader/apk';
        const params = {
            apikey: 'free_key@maher_apis',
            q: appName,
        };

        const response = await axios.get(apiUrl, { params });

        if (!response.data || response.data.status !== 200 || !response.data.result) {
            await sock.sendMessage(
                chatId,
                { text: '❌ Unable to find the APK. Please try again later.' },
                { quoted: message }
            );
            return;
        }

        const { name, lastup, package, size, icon, dllink } = response.data.result;

        // Thumbnail preview
        await sock.sendMessage(
            chatId,
            {
                image: { url: icon },
                caption: `📦 *Downloading ${name}... Please wait.*`,
            },
            { quoted: message }
        );

        // APK download
        const apkResponse = await axios.get(dllink, { responseType: 'arraybuffer' });
        if (!apkResponse.data) {
            await sock.sendMessage(
                chatId,
                { text: '❌ Failed to download the APK. Please try again later.' },
                { quoted: message }
            );
            return;
        }

        const apkBuffer = Buffer.from(apkResponse.data, 'binary');

        // Details with RAUF × LUCIFER MD BOT branding
        const details = `📦 *APK Details* 📦\n\n` +
            `🔖 *Name*: ${name}\n` +
            `📅 *Last Update*: ${lastup}\n` +
            `📦 *Package*: ${package}\n` +
            `📏 *Size*: ${size}\n\n` +
            `> © POWERED BY 𝗞𝗜𝗡𝗚 𝗢𝗙 𝗕𝗢𝗧𝗦 👑 𝗕𝘆 𝗥𝗔𝗨𝗙`;

        // Send the APK as a document
        await sock.sendMessage(
            chatId,
            {
                document: apkBuffer,
                mimetype: 'application/vnd.android.package-archive',
                fileName: `${name}.apk`,
                caption: details
            },
            { quoted: message }
        );

        // Success reaction
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('❌ Error in apkCommand:', error);

        await sock.sendMessage(
            chatId,
            { text: '❌ Unable to fetch APK details. Please try again later.' },
            { quoted: message }
        );

        // Failure reaction
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = apkCommand;