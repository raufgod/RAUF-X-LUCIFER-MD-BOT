const { igdl } = require("ruhend-scraper");
const axios = require("axios");

function extractUniqueMedia(mediaData) {
    const uniqueMedia = [];
    const seenUrls = new Set();
    
    for (const media of mediaData) {
        if (!media.url) continue;
        if (!seenUrls.has(media.url)) {
            seenUrls.add(media.url);
            uniqueMedia.push(media);
        }
    }
    return uniqueMedia;
}

async function instaCommand(sock, from, msg, q) {
    try {
        // If no query was given, extract it from the text
        const messageContent = msg.message?.ephemeralMessage?.message || msg.message?.viewOnceMessage?.message || msg.message?.viewOnceMessageV2?.message || msg.message;
        const text = q || (messageContent.conversation || messageContent.extendedTextMessage?.text || messageContent.imageMessage?.caption || messageContent.videoMessage?.caption || '').trim().replace(/^\.(insta|ig|instagram)\s+/i, '').trim();
        
        if (!text || text.startsWith('.')) {
            return await sock.sendMessage(from, { 
                text: "❌ Please provide an Instagram link."
            }, { quoted: msg });
        }

        // URL validation
        const instagramPatterns = [
            /https?:\/\/(?:www\.)?instagram\.com\//,
            /https?:\/\/(?:www\.)?instagr\.am\//
        ];

        const isValidUrl = instagramPatterns.some(pattern => pattern.test(text));
        
        if (!isValidUrl) {
            return await sock.sendMessage(from, { 
                text: "❌ Invalid Instagram link."
            }, { quoted: msg });
        }

        // Loading reactions
        const loadEmojis = ['📥', '⏳', '📸'];
        for (const emoji of loadEmojis) {
            await sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
        }

        // Download
        const downloadData = await igdl(text);
        
        if (!downloadData || !downloadData.data || downloadData.data.length === 0) {
            return await sock.sendMessage(from, { 
                text: "❌ No media found. The post might be private or the link is invalid."
            }, { quoted: msg });
        }

        const uniqueMedia = extractUniqueMedia(downloadData.data);
        const mediaToDownload = uniqueMedia.slice(0, 5);
        
        for (let i = 0; i < mediaToDownload.length; i++) {
            try {
                const media = mediaToDownload[i];
                const mediaUrl = media.url;
                const isVideo = media.type === 'video' || /\.(mp4|mov|avi|mkv|webm)/i.test(mediaUrl);

                const response = await axios.get(mediaUrl, { responseType: 'arraybuffer', timeout: 45000, maxContentLength: 64 * 1024 * 1024, maxBodyLength: 64 * 1024 * 1024, headers: { 'User-Agent': 'Mozilla/5.0' }, validateStatus: status => status >= 200 && status < 300 });
                const buffer = Buffer.from(response.data);
                if (!buffer.length) throw new Error('Provider returned an empty media file');
                const mime = String(response.headers['content-type'] || '').toLowerCase();
                if (mime.includes('text/html') || mime.includes('application/json')) throw new Error('Provider returned a webpage/error payload instead of media');
                if (isVideo) {
                    await sock.sendMessage(from, { video: buffer, mimetype: mime.startsWith('video/') ? mime : 'video/mp4', caption: '📥 Downloaded from Instagram' }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { image: buffer, mimetype: mime.startsWith('image/') ? mime : 'image/jpeg', caption: '📥 Downloaded from Instagram' }, { quoted: msg });
                }
            } catch (mediaError) {
                console.error(`Media error:`, mediaError.message);
            }
        }

    } catch (error) {
        console.error('Instagram error:', error);
        await sock.sendMessage(from, { text: "❌ Error processing Instagram link." }, { quoted: msg });
    }
}

module.exports = instaCommand;