const yts = require('yt-search');
const axios = require('axios');
const { adeelMedia } = require('../lib/mediaFallback');

async function playCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();
        
        if (!searchQuery) {
            return await sock.sendMessage(chatId, { 
                text: "What song do you want to download?"
            });
        }

        // Search for the song
        let videos = [];
        const ytLink = searchQuery.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/i);
        if (ytLink) videos = [{ url: 'https://www.youtube.com/watch?v=' + ytLink[1] }];
        else {
            try { videos = (await yts(searchQuery)).videos || []; } catch (e) { console.error('[play] search 1 failed:', e.message); }
            if (!videos.length) { try { const r2 = await require('youtube-yts')(searchQuery); videos = r2.videos || r2 || []; } catch (e) { console.error('[play] search 2 failed:', e.message); } }
        }
        if (!videos || videos.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: "No songs found!"
            });
        }

        // Send loading message
        await sock.sendMessage(chatId, {
            text: "_Please wait your download is in progress_"
        });

        // Get the first video result
        const video = videos[0];
        const urlYt = video.url;

        // Fetch audio data from API
        let audioBuffer = null;
        let audioUrl = null;
        let title = searchQuery;
        try {
            // Confirmed route from the user's API dashboard: /download/ytmp3?url=<YouTube URL>
            const response = await axios.get('https://eliteprotech-apis.zone.id/download/ytmp3', {
                params: { url: urlYt }, timeout: 60000,
                headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json, text/plain, */*' }
            });
            const data = response.data;
            const result = data?.download || data?.result || data?.data || data;
            const foundUrl = result?.downloadUrl || result?.download_url || result?.url || result?.link;
            if (data?.status === false || !foundUrl || foundUrl.includes('/download/ytmp3')) throw new Error('EliteProTech returned no actual audio download URL');
            audioUrl = foundUrl;
            title = result?.title || title;
        } catch (eliteError) {
            console.log('[PLAY] EliteProTech failed, trying Keith then Adeel-XTech:', eliteError.response?.status || eliteError.message);
            try {
                const response = await axios.get(`https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(urlYt)}`, { timeout: 60000 });
                const data = response.data;
                if (data?.status && data?.result?.downloadUrl) {
                    audioUrl = data.result.downloadUrl;
                    title = data.result.title || title;
                } else throw new Error('Keith provider returned no audio URL');
            } catch (primaryError) {
                const fallback = await adeelMedia('ytmp3', urlYt, 'audio');
                audioBuffer = fallback.buffer;
                if (!audioBuffer && fallback.url) audioUrl = fallback.url;
                if (!audioBuffer && !audioUrl) {   // last resort: download with the bot's own ytdl + ffmpeg
                    try {
                        const own = await require('../lib/ytdl2').mp3(urlYt);
                        audioBuffer = require('fs').readFileSync(own.path);
                        title = own.meta?.title || title;
                        try { require('fs').unlinkSync(own.path); } catch (_) {}
                    } catch (ownErr) { console.error('[play] own ytdl failed:', ownErr.message); throw primaryError; }
                }
            }
        }

        await sock.sendMessage(chatId, {
            audio: audioBuffer || { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`
        }, { quoted: message });

    } catch (error) {
        console.error('Error in song2 command:', error);
        await sock.sendMessage(chatId, { 
            text: "⚠️ Could not download this song right now. Please try again in a moment."
        });
    }
}

module.exports = playCommand; 

/*Powered by RAUF × LUCIFER MD BOT 💫*
*RAUF × LUCIFER MD BOT*`*/