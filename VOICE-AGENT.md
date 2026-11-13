# v17 change — Arya reply flow (latest rules, these override anything below)
1. **Voice note timing:** Arya's welcome voice note goes out only when BOTH are true: the visitor tapped **Continue** (voice note due ~1 - 1.5 min after that) AND the visitor has **sent the first message to the owner (paired) number**. Continue without a message -> nothing is sent. If the message arrives after the minute is over, the voice note follows a few seconds after the message.
2. **Reply-only:** Arya answers ONLY when the person **replies (swipe / long-press > Reply) to one of Arya's own messages** (her voice note or her text). A plain message or plain voice note gets no answer from her. `STOP` always works.
3. **Text reply -> text answer** (Roman Hindi or English, never Devanagari). **Voice reply -> voice answer.**
4. **`.gpt` (or any AI command) as a reply to ANY voice note** (yours or Arya's) -> AI voice answer (needs GROQ_API_KEY / `.aikey`, see AI-REPLY.md).
Tests: `node scripts/test-call-agent.js`, `node scripts/test-registration-flow.js`

# Voice Agent "Arya" — setup

## Naya registration flow (popup)
1. Visitor Register karta hai -> popup: **owner (paired) number** + ready-made message + **Continue** / **Copy number** + upar **X** (band karne ke liye).
2. **Continue dabane par hi** voice note schedule hota hai (Continue ke **1 - 1.5 min baad**, owner number se). Popup apne-aap band hota hai aur `wa.me/<owner number>?text=<message>` par WhatsApp khulta hai. Note: "Pehle number save karein, phir message bhejein."
3. **Continue nahi dabaya / X se band kiya -> voice note kabhi nahi jata.** Wo wapas aakar dobara register kare to wahi popup step phir dikhta hai (24 ghante tak).
4. Visitor ka "Hi" Continue ke baad aaye to bot chup rehta hai (voice note apne time par aata hai, double intro nahi).
5. Default message: `CALL_HI_TEXT` se badlo (default: "Hi, I am <naam>. I just registered on the website and I want to know more about the bot."). Owner number bot ke paired number se apne-aap aata hai.
Tests: `node scripts/test-registration-flow.js`, `node scripts/test-call-agent.js`

## Kya karta hai
1. Website par password -> Terms Agree -> **Register dialog** (naam + WhatsApp number + consent checkbox).
2. (Purana flow, ab Continue ke baad) number queue mein jata hai (`data/call-queue.json`, restart ke baad bhi bachta hai).
3. **~1 se 1.5 minute baad** bot apne **paired number** se us number par ek **Hindi voice note** bhejta hai (female neural awaaz):
   "Main Arya hoon, Raauf x Lucifer ki AI assistant ..." — bot kya hai, kaise link hota hai, `.menu`, `.play` sab samjhata hai. Saath mein ek chhota text aata hai.
4. User **text ya voice** mein reply de to Arya samajh kar jawab deti hai:
   - voice bheja -> voice mein jawab, text likha -> text mein jawab
   - user "voice mein batao" / "text mein likho" bole to uske hisaab se (yaad rakhti hai)
   - `STOP` / `band` likhne par turant band, number blocked
5. Arya ke paas bot ka poora data hai (`public/assets/commands-data.js` ke saare commands + `lib/botKnowledge.js`). Naya command wahan jodo to wo apne-aap jaan jati hai. Bot ke bahar ke sawalon par kehti hai "main sirf bot ke baare mein bata sakti hoon".
6. Existing `.say`, `.sayhindi`, `.sayja` ... commands ab usi female neural awaaz (Microsoft Edge voices) par chalte hain, asli WhatsApp voice note ki tarah. Edge na chale to Google TTS par apne-aap fallback.

## Install
1. Patch ki files bot folder mein upar se extract karo.
2. `npm install` (naya package: `msedge-tts`).
3. `.env` mein ye jodo, phir bot restart:
```
GROQ_API_KEY=...         # sirf user ki VOICE samajhne ke liye (free: console.groq.com). Bina iske voice reply par Arya kehti hai "likh kar bhejiye"
CALL_ADMIN_SECRET=koi-lamba-password
```
Baaki sab optional (defaults theek hain):
```
CALL_DELAY_MIN=1  CALL_DELAY_MAX=1.5     # registration ke kitne minute baad (default 1 - 1.5)
CALL_MAX_PER_HOUR=20  CALL_MAX_PER_DAY=150   # ban se bachne ke liye limit (neeche padho)
CALL_QUIET_HOURS=off                     # raat ko rokna ho: 21-9 (raat 9 se subah 9)
CALL_AGENT_NAME=आर्या   CALL_SPOKEN_BOT_NAME=राउफ एक्स लूसिफ़र
TTS_VOICE=hi-IN-SwaraNeural              # Hindi female (male: hi-IN-MadhurNeural)
TTS_ENGINE=edge                          # google = sirf Google TTS
CALL_MAX_TURNS=20                        # ek user ko 24 ghante mein max jawab
CALL_DRYRUN=1                            # test: kuch bhejta nahi, sirf log karta hai
```

## Test
- `node scripts/test-call-agent.js` — poora flow nakli WhatsApp/AI par jaanchta hai (ffmpeg conversion asli).
- Asli test: website par apna doosra number register karo, ~1 min mein voice note aana chahiye. Phir voice note se reply karo.
- Admin: `curl -H "x-call-admin-secret: <secret>" https://yourdomain.com/api/call/admin` (queue, status, counts; numbers chhupe hue)
- Kisi number ko block: `curl -X POST -H "x-call-admin-secret: <secret>" -H "content-type: application/json" -d '{"number":"919876543210"}' https://yourdomain.com/api/call/optout`

## Suraksha / limits (jo maine built-in rakhe)
- Number paired owner number se jata hai, isliye **hourly (20) aur daily (150) cap** hai, ek ke baad ek bhejta hai (8-20 sec gap), "recording..." dikhata hai. Isse zyada bhejne par WhatsApp number ban kar sakta hai.
- Registration par: consent zaroori, har IP se 5/ghanta, poori site par 100/ghanta, ek number par 24 ghante mein ek hi baar, bot-trap field, queue max 300.
- Number WhatsApp par na ho / bot ka apna number ho -> skip. Voice banne mein fail ho to 3 koshish ke baad wahi jaankari text mein jati hai.
- Reply sirf unhe milta hai jinhone register kiya (24 ghante tak). Commands (`.menu`, `.play` ...) normal bot ke paas jate hain. Group, image, purane/duplicate messages ignore.
- Ek user se 20 jawab ke baad ek notice, phir chup (bot-se-bot loop nahi banta).

## Dhyan rakhne ki baatein
- **Ban risk zero nahi hai.** WhatsApp unsolicited messages par number ban kar sakta hai. Consent + limits + STOP isse kam karte hain, par guarantee nahi. Bade launch se pehle chhote group par test karo.
- Edge TTS ek **unofficial free** service hai; Microsoft kabhi badal sakta hai. Tab Google TTS par apne-aap chala jata hai (thodi robotic awaaz).
- Free AI chain (`lib/aiChat.js`) busy ho to Arya command list se seedha jawab deti hai.
- Jawab matching ke liye user ka number kabhi `@lid` form mein aata hai; code usse pehchanta hai. Agar kisi ka reply na pakda jaye to `CALL_DEBUG=1` lagao aur log dekho.
- Website lock (password) ke peeche hi registration hai, isliye bina password wala register nahi kar sakta.

## Files
Nayi: `lib/callAgent/{index,wa,tts,stt,brain,knowledge,store}.js`, `public/assets/callme.js`, `scripts/test-call-agent.js`, `VOICE-AGENT.md`
Badli: `index.js` (2 jagah chhota hook), `lib/webPairing.js` (1 line), `features/Plugins/text-to-speech.js`, `package.json` (+msedge-tts), `public/*.html` (1 script tag)
