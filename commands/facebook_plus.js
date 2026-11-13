const axios = require('axios');

async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const url = text.split(' ').slice(1).join(' ').trim();
        
        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "📌 *Usage:* `.fb <Facebook video URL>`\n\n*Example:*\n`.fb https://www.facebook.com/watch?v=xxx`\n`.fb https://fb.watch/xxx`"
            }, { quoted: message });
        }

        // ✅ URL validation (fb.com, facebook.com, fb.watch)
        const urlLower = url.toLowerCase();
        const isValidFbUrl = urlLower.includes('facebook.com') || 
                            urlLower.includes('fb.watch') || 
                            urlLower.includes('fb.com');
        
        if (!isValidFbUrl) {
            return await sock.sendMessage(chatId, { 
                text: "❌ That's not a valid Facebook link." 
            }, { quoted: message });
        }

        // ✅ Loading reactions
        const loadEmojis = ['📥', '⏳', '🎬'];
        for (const emoji of loadEmojis) {
            try {
                await sock.sendMessage(chatId, { react: { text: emoji, key: message.key } });
            } catch (e) {}
        }

        // ✅ Resolve short URLs (fb.watch)
        let resolvedUrl = url;
        try {
            const res = await axios.get(url, { 
                timeout: 15000, 
                maxRedirects: 10, 
                headers: { 'User-Agent': 'Mozilla/5.0' } 
            });
            const possible = res?.request?.res?.responseUrl;
            if (possible && typeof possible === 'string') {
                resolvedUrl = possible;
            }
        } catch (e) {
            // Use original URL if resolution fails
        }

        // ✅ Multiple APIs with fallback
        async function fetchFromSiputzx(u) {
            const apiUrl = `https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(u)}`;
            const response = await axios.get(apiUrl, {
                timeout: 20000,
                headers: {
                    'accept': '*/*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                maxRedirects: 5
            });
            
            if (response.data?.status && response.data?.data?.data) {
                const hdVideo = response.data.data.data.find(item => item.resolution === 'HD' && item.format === 'mp4');
                const sdVideo = response.data.data.data.find(item => item.resolution === 'SD' && item.format === 'mp4');
                const videoUrl = hdVideo?.url || sdVideo?.url;
                
                if (videoUrl) {
                    return { 
                        download: videoUrl, 
                        title: response.data.data.title || 'Facebook Video' 
                    };
                }
            }
            throw new Error('Siputzx failed');
        }

        async function fetchFromNexoracle(u) {
            const apiUrl = `https://api.nexoracle.com/downloader/facebook?apikey=null&url=${encodeURIComponent(u)}`;
            const response = await axios.get(apiUrl, { timeout: 20000 });
            
            if (response.data?.result?.download) {
                return { 
                    download: response.data.result.download, 
                    title: response.data.result.title || 'Facebook Video' 
                };
            }
            if (response.data?.result?.url) {
                return { 
                    download: response.data.result.url, 
                    title: response.data.result.title || 'Facebook Video' 
                };
            }
            throw new Error('Nexoracle failed');
        }

        async function fetchFromZenkey(u) {
            const apiUrl = `https://api.zenkey.my.id/download/fb?url=${encodeURIComponent(u)}`;
            const response = await axios.get(apiUrl, { timeout: 20000 });
            
            if (response.data?.result?.url) {
                return { 
                    download: response.data.result.url, 
                    title: response.data.result.title || 'Facebook Video' 
                };
            }
            if (response.data?.result?.hd) {
                return { 
                    download: response.data.result.hd, 
                    title: response.data.result.title || 'Facebook Video' 
                };
            }
            throw new Error('Zenkey failed');
        }

        // ✅ Try all APIs
        let videoData = null;
        const apiMethods = [
            { name: 'Siputzx', method: () => fetchFromSiputzx(resolvedUrl) },
            { name: 'Nexoracle', method: () => fetchFromNexoracle(resolvedUrl) },
            { name: 'Zenkey', method: () => fetchFromZenkey(resolvedUrl) }
        ];

        for (const apiMethod of apiMethods) {
            try {
                console.log(`🎬 Trying: ${apiMethod.name}`);
                videoData = await apiMethod.method();
                if (videoData && videoData.download) {
                    console.log(`✅ Success: ${apiMethod.name}`);
                    break;
                }
            } catch (err) {
                console.log(`❌ ${apiMethod.name} failed: ${err.message}`);
            }
        }

        if (!videoData || !videoData.download) {
            throw new Error('All Facebook download sources failed. Video may be private.');
        }

        // ✅ Send the video
        const caption = `📝 *Title:* ${videoData.title}\n\n> *Downloaded by RAUF × LUCIFER MD BOT*`;

        await sock.sendMessage(chatId, {
            video: { url: videoData.download },
            mimetype: "video/mp4",
            fileName: `${(videoData.title || 'facebook_video').replace(/[^\w\s-]/g, '')}.mp4`,
            caption: caption
        }, { quoted: message });

    } catch (error) {
        console.error('❌ Facebook command error:', error.message);
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message}\n\n💡 Make sure the video is public.` 
        }, { quoted: message });
    }
}

module.exports = facebookCommand;