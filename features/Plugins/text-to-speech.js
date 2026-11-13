// Text to speech. Natural female neural voices (Microsoft Edge) sent as real WhatsApp voice notes,
// with automatic fallback to Google TTS. Engine and voices live in lib/callAgent/tts.js.
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const mergedCommands = [
  "say", "speak", "tts",
  "saybengali", "saybangla",
  "sayhindi",
  "sayja", "sayjapanese",
  "saykorean",
  "saychinese",
  "sayindo", "sayindonesian",
];

// command -> language code understood by lib/callAgent/tts.js
const LANG = {
  say: "en", speak: "en", tts: "en",
  saybengali: "bn", saybangla: "bn",
  sayhindi: "hi",
  sayja: "ja", sayjapanese: "ja",
  saykorean: "ko",
  saychinese: "zh",
  sayindo: "id", sayindonesian: "id",
};

export default {
  name: "texttospeech",
  alias: [...mergedCommands],
  uniquecommands: ["say", "saybengali", "sayhindi", "sayjapanese", "saykorean", "saychinese", "sayindo"],
  description: "Text to speech with natural female voices",
  start: async (Atlas, m, { inputCMD, text, prefix, doReact, args, isMedia }) => {
    const example = `Please provide a text (type it or reply to a message)!\n\nExample: ${prefix}say RAUF × LUCIFER MD BOT is OP`;
    if ((!text && !m.quoted) || isMedia) {
      await doReact("❔");
      return m.reply(example);
    }

    const lang = LANG[inputCMD];
    if (!lang) return;
    const tts = require("../../lib/callAgent/tts");
    const quotedText = m.quoted ? (typeof m.quoted.msg === "string" ? m.quoted.msg : m.quoted.text) : "";
    let sayMess = String(quotedText || (args.length ? args.join(" ") : text) || "").trim();
    if (!sayMess) {
      await doReact("❔");
      return m.reply(example);
    }
    let note = "";
    if (sayMess.length > tts.MAX_CHARS) {
      sayMess = sayMess.slice(0, tts.MAX_CHARS);
      note = `Only the first ${tts.MAX_CHARS} characters were spoken.`;
    }

    await doReact("🪄");
    try { await Atlas.sendPresenceUpdate("recording", m.from); } catch (_) {}
    try {
      const audio = await tts.synth(sayMess, { lang });
      await Atlas.sendMessage(m.from, { audio, mimetype: "audio/ogg; codecs=opus", ptt: true }, { quoted: m });
      if (note) await m.reply(note);
    } catch (e) {
      console.error("[tts]", e && e.message);
      await doReact("❌");
      m.reply("Could not make the voice right now. Please try again in a moment.");
    }
  },
};
