const botName = globalThis.botName || "RAUF × LUCIFER MD BOT 💫";
const tenorApiKey = globalThis.tenorApiKey || "";
import axios from "axios";
let mergedCommands = [
  "gig",
  "gimage",
  "googleimage",
  "image",
  "ppcouple",
  "couplepp",
  "gifsearch",
  "gif",
  "pin",
  "pinterest",
];

export default {
  name: "pictures",
  alias: [...mergedCommands],
  uniquecommands: ["image", "couplepp", "gif", "pin"],
  description: "All picture related commands",
  start: async (Atlas, m, { inputCMD, text, doReact, prefix }) => {
    switch (inputCMD) {
      case "ppcouple":
      case "couplepp":
        await doReact("❤️");
        try {
          const imgRes = await axios.get(
            "https://couple-pfp-api.vercel.app/api/v1/couplepfp",
            { timeout: 10000 }
          );
          await Atlas.sendMessage(
            m.from,
            { image: { url: imgRes.data.male }, caption: `_For Him..._` },
            { quoted: m },
          );
          await Atlas.sendMessage(
            m.from,
            { image: { url: imgRes.data.female }, caption: `_For Her..._` },
            { quoted: m },
          );
        } catch (e) {
          await doReact("❌");
          m.reply(`Couple PP fetch failed: ${e.message}`);
        }
        break;

      case "gig":
      case "gimage":
      case "googleimage":
      case "image":
        if (!text) {
          await doReact("❔");
          return m.reply(
            `Please provide an image Search Term !\n\nExample: *${prefix}image cheems*`,
          );
        }
        await doReact("🎴");
        try {
          const bingUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(text)}&first=1&count=15&tsc=ImageBasicHover`;
          const { data: html } = await axios.get(bingUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
            },
            timeout: 10000,
          });

          const imgUrls = [];
          for (const match of html.matchAll(
            /&quot;murl&quot;:&quot;(https?:\/\/[^&]+)&quot;/g,
          )) {
            imgUrls.push(match[1]);
          }

          if (!imgUrls.length) {
            await doReact("❌");
            return m.reply(`No images found for: *${text}*`);
          }

          const pool = imgUrls.slice(0, 10);
          const imageUrl = pool[Math.floor(Math.random() * pool.length)];
          const resText = `\n_🎴 Image Search:_ *${text}*\n\n_🧩 Powered by_ *${botName}*\n`;
          await Atlas.sendMessage(
            m.from,
            { image: { url: imageUrl }, caption: resText },
            { quoted: m },
          );
        } catch (err) {
          console.error("[ IMAGE ] Bing search error:", err.message);
          await doReact("❌");
          await m.reply(`Image search failed: ${err.message}`);
        }
        break;
      case "gif":
      case "gifsearch":
        if (!text) {
          await doReact("❔");
          return m.reply(
            `Please provide an Tenor gif Search Term !\n\nExample: *${prefix}gif cheems bonk*`,
          );
        }
        await doReact("🎴");
        let resGif = await axios.get(
          `https://tenor.googleapis.com/v2/search?q=${text}&key=${tenorApiKey}&client_key=my_project&limit=12&media_filter=mp4`,
        );
        let resultGif = Math.floor(Math.random() * 12);
        let gifUrl = resGif.data.results[resultGif].media_formats.mp4.url;
        await Atlas.sendMessage(
          m.from,
          {
            video: { url: gifUrl },
            gifPlayback: true,
            caption: `🎀 Gif serach result for: *${text}*\n`,
          },
          { quoted: m },
        );
        break;

      case "pin":
      case "pinterest":
        if (!text) {
          await doReact("❔");
          return m.reply(
            `Please provide an Pinterest image Search Term !\n\nExample: *${prefix}pin cheems*`,
          );
        }
        await doReact("📍");
        // If user sends a Pinterest Pin URL, download the pinned photo instead of
        // treating the URL as an image-search keyword. Keyword search stays intact.
        if (/https?:\/\/(?:www\.)?(?:pin\.it|pinterest\.com)\//i.test(text.trim())) {
          try {   // 1) read the pin page directly -> always a playable MP4 / JPEG
            const mod = await import("../../lib/pinFallback.js");
            const { sendPin } = mod.default || mod;
            await sendPin(Atlas, m.from, m, text.trim(), "📍 Pinterest");
          } catch (e) {
            console.error("[pin] direct download failed:", e?.message || e);
            try {   // 2) backup: API providers
              const { send: sendAdeelApi } = await import("../../lib/adeelApi.js");
              await sendAdeelApi(Atlas, m.from, m, "pinterestphoto", text.trim());
            } catch (e2) {
              console.error("[pin] api providers failed:", e2?.message || e2);
              await doReact("❌");
              return m.reply("⚠️ Couldn't download this pin right now. Please try again in a moment.");
            }
          }
          break;
        }
        try {
          const { data: pinHtml } = await axios.get(
            `https://www.bing.com/images/search?q=site:pinterest.com+${encodeURIComponent(text)}&first=1&count=20`,
            {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
              },
              timeout: 10000,
            }
          );
          // Bing has emitted this field both as HTML entities and as raw JSON.
          // Decode common escapes, strip HTML entities, and accept only direct
          // Pinterest CDN image URLs to avoid selecting thumbnails or result pages.
          const pinUrls = [...pinHtml.matchAll(/(?:&quot;|\\?\")murl(?:&quot;|\\?\")\s*:\s*(?:&quot;|\\?\")(https?:[^&\"\\]+)(?:&quot;|\\?\")/gi)]
            .map((m) => m[1].replace(/\\u0026/gi, "&").replace(/\\\//g, "/").replace(/&amp;/g, "&"))
            .filter((u) => /^https?:\/\/(?:i\.)?pinimg\.com\//i.test(u));
          const uniquePinUrls = [...new Set(pinUrls)];
          if (!uniquePinUrls.length) {
            await doReact("❌");
            return m.reply(`No Pinterest images found for: *${text}*. Try a more specific keyword.`);
          }
          const pool = uniquePinUrls.slice(0, 10);
          const imgnyee = pool[Math.floor(Math.random() * pool.length)];
          const txt = `\n_📍 Pinterest Search:_ *${text}*\n\n_🧩 Powered by_ *${botName}*\n`;
          await Atlas.sendMessage(m.from, { image: { url: imgnyee }, caption: txt }, { quoted: m });
        } catch (e) {
          await doReact("❌");
          m.reply(`Pinterest search failed: ${e.message}`);
        }

        break;

      default:
        break;
    }
  },
};
