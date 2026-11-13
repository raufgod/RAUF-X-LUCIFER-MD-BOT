const axios = require('axios');
const yts = require('yt-search');
const { adeelMedia, downloadBuffer } = require('../lib/mediaFallback');

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

async function tryRequest(getter, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            const status = err?.response?.status || err?.status;
            // 4xx responses (especially 402) are provider rejections, not transient
            // failures. Stop retrying this provider immediately so the next fallback runs.
            if (status >= 400 && status < 500 && status !== 429) break;
            if (attempt < attempts) await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }
    throw lastError;
}

// EliteProTech API - Primary (confirmed route: /download/ytmp4?url=<YouTube URL>).
async function getEliteProTechVideoByUrl(youtubeUrl) {
    const res = await tryRequest(() => axios.get('https://eliteprotech-apis.zone.id/download/ytmp4', {
        ...AXIOS_DEFAULTS, params: { url: youtubeUrl }
    }));
    const body = res?.data;
    const result = body?.download || body?.result || body?.data || body;
    const download = result?.downloadUrl || result?.download_url || result?.downloadURL || result?.url || result?.link || result?.mp4 || result?.videoUrl || result?.video_url;
    if ((body?.status === true || body?.success === true || body?.status == null) && typeof download === 'string' && /^https?:\/\//i.test(download) && !download.includes('/download/ytmp4')) {
        return { download, title: result?.title, thumbnail: result?.thumbnail, duration: result?.duration };
    }
    throw new Error('EliteProTech /download/ytmp4 returned no actual MP4 download URL');
}

async function getYupraVideoByUrl(youtubeUrl) {
    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.data?.download_url) {
        return {
            download: res.data.data.download_url,
            title: res.data.data.title,
            thumbnail: res.data.data.thumbnail
        };
    }
    throw new Error('Yupra returned no download');
}

async function getOkatsuVideoByUrl(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    // shape: { status, creator, url, result: { status, title, mp4 } }
    if (res?.data?.result?.mp4) {
        return { download: res.data.result.mp4, title: res.data.result.title };
    }
    throw new Error('Okatsu ytmp4 returned no mp4');
}

async function getAdeelVideoByUrl(youtubeUrl) {
    try { return await adeelMedia('ytmp4', youtubeUrl, 'video'); }
    catch { return await adeelMedia('ytmp4v2', youtubeUrl, 'video'); }
}

async function videoCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();
        
        
        if (!searchQuery) {
            await sock.sendMessage(chatId, { text: 'What video do you want to download?' }, { quoted: message });
            return;
        }

        // Determine if input is a YouTube link
        let videoUrl = '';
        let videoTitle = '';
        let videoThumbnail = '';
        if (searchQuery.startsWith('http://') || searchQuery.startsWith('https://')) {
            videoUrl = searchQuery;
        } else {
            // Search YouTube for the video
            const { videos } = await yts(searchQuery);
            if (!videos || videos.length === 0) {
                await sock.sendMessage(chatId, { text: 'No videos found!' }, { quoted: message });
                return;
            }
            videoUrl = videos[0].url;
            videoTitle = videos[0].title;
            videoThumbnail = videos[0].thumbnail;
        }

        // Send thumbnail immediately
        try {
            const ytId = (videoUrl.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/) || [])[1];
            const thumb = videoThumbnail || (ytId ? `https://i.ytimg.com/vi/${ytId}/sddefault.jpg` : undefined);
            const captionTitle = videoTitle || searchQuery;
            if (thumb) {
                await sock.sendMessage(chatId, {
                    image: { url: thumb },
                    caption: `*${captionTitle}*\nDownloading...`
                }, { quoted: message });
            }
        } catch (e) { console.error('[VIDEO] thumb error:', e?.message || e); }
        

        // Validate YouTube URL
        let urls = videoUrl.match(/(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/|playlist\?list=)?)([a-zA-Z0-9_-]{11})/gi);
        if (!urls) {
            await sock.sendMessage(chatId, { text: 'This is not a valid YouTube link!' }, { quoted: message });
            return;
        }

        // Try multiple APIs with fallback chain: EliteProTech -> Yupra -> Okatsu
        let videoData;
        let downloadSuccess = false;
        
        // List of API methods to try
        const apiMethods = [
            { name: 'EliteProTech', method: () => getEliteProTechVideoByUrl(videoUrl) },
            { name: 'Yupra', method: () => getYupraVideoByUrl(videoUrl) },
            { name: 'Okatsu', method: () => getOkatsuVideoByUrl(videoUrl) },
            { name: 'Adeel-XTech', method: () => getAdeelVideoByUrl(videoUrl) }
        ];
        
        // Try each API until we successfully get video data
        for (const apiMethod of apiMethods) {
            try {
                videoData = await apiMethod.method();
                const videoUrl_check = videoData.download || videoData.dl || videoData.url;
                
                if (!videoUrl_check) {
                    console.log(`${apiMethod.name} returned no download URL, trying next API...`);
                    continue; // Try next API
                }
                
                downloadSuccess = true;
                break; // Success! Exit the loop
            } catch (apiErr) {
                // API call failed, try next API
                console.log(`${apiMethod.name} API failed:`, apiErr.message);
                continue;
            }
        }
        
        // If all APIs failed, throw error
        if (!downloadSuccess || !videoData) {
            throw new Error('All download sources failed. The content may be unavailable or blocked in your region.');
        }

        const resolvedVideo = videoData.download || videoData.dl || videoData.url;
        let videoBuffer;
        let detectedType = '';
        if (Buffer.isBuffer(resolvedVideo)) {
            videoBuffer = resolvedVideo;
        } else {
            const downloaded = await downloadBuffer(resolvedVideo, { timeout: 120000, maxBytes: 150 * 1024 * 1024 });
            videoBuffer = downloaded.buffer;
            detectedType = downloaded.contentType || '';
        }
        // Avoid sending provider error pages as fake videos/grey placeholders.
        const mp4 = videoBuffer.length > 12 && videoBuffer.toString('ascii', 4, 8) === 'ftyp';
        const webm = videoBuffer.length > 4 && videoBuffer.toString('ascii', 0, 4) === '\x1A\x45\xDF\xA3';
        if (!videoBuffer.length || (!mp4 && !webm) || /text\/html|application\/json/i.test(detectedType)) {
            throw new Error(`Provider returned invalid video bytes (${detectedType || 'unknown type'}).`);
        }
        if (webm) throw new Error('Provider returned WebM instead of MP4; this WhatsApp build requires MP4 output.');
        const safeTitle = (videoData.title || videoTitle || 'video').replace(/[^\w\s-]/g, '').trim().slice(0, 80) || 'video';
        await sock.sendMessage(chatId, {
            video: videoBuffer,
            mimetype: 'video/mp4',
            fileName: `${safeTitle}.mp4`,
            caption: `*${videoData.title || videoTitle || 'Video'}*\n\n> *_Downloaded by RAUF × LUCIFER MD BOT 💫 MD_*`
        }, { quoted: message });


    } catch (error) {
        console.error('[VIDEO] Command Error:', error?.message || error);
        
        // Provide more specific error messages
        let errorMessage = '❌ Failed to download video.';
        if (error.message && error.message.includes('blocked')) {
            errorMessage = '❌ Download blocked. The content may be unavailable in your region or due to legal restrictions.';
        } else if (error.response?.status === 451 || error.status === 451) {
            errorMessage = '❌ Content unavailable (451). This may be due to legal restrictions or regional blocking.';
        } else if (error.message && error.message.includes('All download sources failed')) {
            errorMessage = '❌ All download sources failed. The content may be unavailable or blocked.';
        } else if (error.message) {
            errorMessage = '❌ Download failed: ' + error.message;
        }
        
        await sock.sendMessage(chatId, { 
            text: errorMessage 
        }, { quoted: message });
    }
}

module.exports = videoCommand; 