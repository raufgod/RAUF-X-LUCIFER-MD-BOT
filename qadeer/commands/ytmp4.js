const axios = require("axios");
const { adeelMedia } = require("../../lib/mediaFallback");

module.exports = {
  pattern: "ytmp4",
  desc: "Download YouTube video in MP4 format using EliteProTech and fallback providers",
  react: "🎬",
  category: "downloader",
  filename: __filename,

  execute: async (conn, mek, m, { from, q, reply }) => {
    // Helper function to send messages with contextInfo
    const sendMessageWithContext = async (text, quoted = mek) => {
      return await conn.sendMessage(from, {
        text: text,
        contextInfo: {
          
          
          }
      }, { quoted: quoted });
    };

    try {
      if (!q) return await sendMessageWithContext("❌ Please provide a YouTube video link.");

      // React 🎬
      if (module.exports.react) {
        await conn.sendMessage(from, { react: { text: module.exports.react, key: mek.key } });
      }

      await sendMessageWithContext("⏳ Downloading YouTube video, please wait...");

      // Try the configured provider first, then the shared fallback provider.
      // HTTP 402/429/5xx or an incomplete response must not stop fallback.
      let media = null;
      let title = "YouTube Video";
      let thumbnail;
      let quality;
      let duration;
      let primaryError;
      // User-confirmed EliteProTech route. The endpoint expects the actual YouTube
      // URL in `url`; passing the API endpoint itself returns unknown_video.
      try {
        const { data } = await axios.get("https://eliteprotech-apis.zone.id/download/ytmp4", {
          params: { url: q }, timeout: 45000,
          headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json, text/plain, */*" }
        });
        const result = data?.download || data?.result || data?.data || data;
        const downloadUrl = result?.downloadUrl || result?.download_url || result?.downloadURL || result?.url || result?.link || result?.mp4;
        if (data?.status === false || !downloadUrl || typeof downloadUrl !== "string" || downloadUrl.includes("/download/ytmp4")) {
          throw new Error("EliteProTech returned no actual MP4 download URL");
        }
        media = { url: downloadUrl };
        title = result.title || title;
        thumbnail = result.thumbnail || result.thumb;
        quality = result.quality || result.format;
        duration = result.duration;
      } catch (err) {
        primaryError = err;
        console.error("[YTMP4] EliteProTech failed; trying legacy provider:", err.response?.status || err.message);
        try {
          const apiUrl = `https://apis.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(q)}&apikey=`;
          const { data } = await axios.get(apiUrl, { timeout: 45000, headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json, text/plain, */*" } });
          const result = data?.result || data?.data || data;
          const downloadUrl = result?.download_url || result?.downloadUrl || result?.downloadURL || result?.url || result?.link;
          if (!downloadUrl || typeof downloadUrl !== "string") throw new Error("Legacy provider returned no video URL");
          media = { url: downloadUrl };
          title = result.title || title;
          thumbnail = result.thumbnail || result.thumb;
          quality = result.quality;
          duration = result.duration;
        } catch (legacyErr) {
          primaryError = primaryError || legacyErr;
          console.error("[YTMP4] Legacy provider failed:", legacyErr.response?.status || legacyErr.message);
        }
      }
      if (!media) {
        try {
          const fallback = await adeelMedia("ytmp4", q, "video");
          media = fallback.buffer ? { buffer: fallback.buffer } : { url: fallback.url };
          if (!media.buffer && !media.url) throw new Error("Fallback returned no usable video");
        } catch (fallbackError) {
          const status = primaryError?.response?.status;
          const detail = status === 402
            ? "EliteProTech returned HTTP 402 and the fallback providers also failed. The API may be enforcing access, quota, or billing limits."
            : `All video providers failed${status ? ` (primary HTTP ${status})` : ""}.`;
          console.error("[YTMP4] Fallback failed:", fallbackError.message);
          return await sendMessageWithContext(`❌ ${detail} Please try again later or check the downloader provider.`);
        }
      }

      const caption = `🎬 *YouTube Video*\n\n` +
                      `📖 *Title:* ${title || "Unknown"}\n` +
                      `🎚️ *Quality:* ${quality || "Unknown"}\n` +
                      `⏱️ *Duration:* ${duration ? duration + "s" : "Unknown"}\n\n` +
                      `> _ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀᴀᴜғ ʟᴀɢᴀᴄʏ_`;

      // Prepare thumbnail buffer if exists
      let thumbBuffer;
      if (thumbnail) {
        try {
          const res = await axios.get(thumbnail, { responseType: "arraybuffer" });
          thumbBuffer = Buffer.from(res.data);
        } catch {}
      }

      // Send the video with contextInfo
      await conn.sendMessage(from, {
        video: media.buffer ? media.buffer : { url: media.url },
        caption: caption,
        jpegThumbnail: thumbBuffer,
        contextInfo: {
          
          
          }
      }, { quoted: mek });

    } catch (error) {
      console.error("❌ YouTube Downloader Error:", error);
      await sendMessageWithContext(`⚠️ Error downloading YouTube video: ${error.message}`);
    }
  }
};