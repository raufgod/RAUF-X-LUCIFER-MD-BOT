const axios = require('axios');
const { adeelMedia } = require('../lib/mediaFallback');

async function spotifyCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            '';

        const used = (rawText || '').split(/\s+/)[0] || '.spotify';
        const query = rawText.slice(used.length).trim();

        if (!query) {
            await sock.sendMessage(chatId, { text: 'Usage: .spotify <song/artist/keywords>\nExample: .spotify con calma' }, { quoted: message });
            return;
        }

        let r = null;
        let audioUrl = null;
        let audioBuffer = null;
        try {
            const apiUrl = `https://okatsu-rolezapiiz.vercel.app/search/spotify?q=${encodeURIComponent(query)}`;
            const { data } = await axios.get(apiUrl, { timeout: 20000, headers: { 'user-agent': 'Mozilla/5.0' } });
            if (!data?.status || !data?.result?.audio) throw new Error('Primary Spotify provider returned no audio');
            r = data.result;
            audioUrl = r.audio;
        } catch (primaryError) {
            console.log('[SPOTIFY] Primary failed, using Adeel-XTech fallback:', primaryError.message);
            const fallback = await adeelMedia('spotifydl', query, 'audio');
            audioBuffer = fallback.buffer;
            r = { title: query, artist: '', duration: '', url: '' };
        }

        const caption = `🎵 ${r.title || r.name || 'Unknown Title'}\n👤 ${r.artist || ''}\n⏱ ${r.duration || ''}\n🔗 ${r.url || ''}`.trim();

         // Send cover and info as a follow-up (optional)
         if (r.thumbnails) {
            await sock.sendMessage(chatId, { image: { url: r.thumbnails }, caption }, { quoted: message });
        } else if (caption) {
            await sock.sendMessage(chatId, { text: caption }, { quoted: message });
        }
        await sock.sendMessage(chatId, {
            audio: audioBuffer || { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: `${(r.title || r.name || 'track').replace(/[\\/:*?"<>|]/g, '')}.mp3`
        }, { quoted: message });

       

    } catch (error) {
        console.error('[SPOTIFY] error:', error?.message || error);
        await sock.sendMessage(chatId, { text: 'Failed to fetch Spotify audio. Try another query later.' }, { quoted: message });
    }
}

module.exports = spotifyCommand;
