# RAUF × LUCIFER MD BOT — Notes
All setup guides and the change history in one file.
## Contents
- **Setup**: INSTALL, WHITE-LABEL-SETUP, PAIRING-WEBSITE
- **Change history**: API-AUDIT-REPORT, API-ENDPOINT-AND-MENU-FIX, API-INTEGRATION-NOTES, API-RESPONSE-CLEANUP-FIX, AUTO-FEATURES-FIX-NOTES, COMMAND-AUDIT-STATUS, FINAL-IMPLEMENTATION-REPORT, FLASH-MD-MERGE-STATUS, FOLLOWUP-SETTINGS-CHANGES, MEDIA-DOWNLOAD-FIX-NOTES, MERGE-NOTES, MERGED-COMMANDS, NEW-1.9.5-BETA-PATCH-NOTES, NEW-COMMAND-IDEAS, NEW-MENU-V2-COMMANDS, NEW-MENU-V2-INTEGRATION, REBUILD-AUDIT, REPAIR-NOTES-2026-10-19, REPAIR-STATUS-AND-LIMITATIONS, V2-CHANGES, WHITE-LABEL-CHANGELOG

# Setup

## INSTALL

1. On the panel, delete the old `node_modules` folder and `package-lock.json`. **Do not delete the `session` folder** (otherwise you must log in again).
2. Upload this zip and extract it.
3. Run `npm install` in the console, then start the bot.
4. Test: send `.menu` and `.ping` from another number and check the double tick.

### In this version
- `sharp` + `archiver` errors fixed (convertor, fun, user, search and zip commands now load)
- Baileys `7.0.0-rc13` (message resend / TC-token fixes); to go back, use `7.0.0-rc.9` in package.json
- Retry cache bug fixed, RAM-limit restart raised from 400MB to 1200MB (change with the `MAX_RAM_MB` env)
- Multi-session (.pair) duplicate-message bug fixed
- `.mode private|public`, `.private`, `.public` now really work (default PUBLIC)
- Outgoing look: "Forwarded many times / Search on web" + hidden top line (tap = channel) + "View channel" + AI label
  (`lib/globalCard.js`; to switch the AI label off use env `AI_LABEL=0`)
- Branding: SHADAN / MH TECH / Atlas / France King / Keith all removed and replaced with KING OF BOTS
- Bugs fixed: antilink, promote, ship (infinite loop), jam (timezone), feature-plugin globals

### AI label (Baileys fork)
In package.json, `@whiskeysockets/baileys` is aliased to `npm:@itsliaaa/baileys@0.3.6` (the fork that supports the AI label).
The AI label only appears in private chats (a WhatsApp limit). The chance is higher on a WhatsApp Business number.
If the fork causes any error, set it back in package.json to `"@whiskeysockets/baileys": "7.0.0-rc13"` and run npm install again.

## WHITE-LABEL-SETUP

No AI/chat model or AI API key is used in this build. Configure only the non-AI integrations you use in `.env`, including `TELEGRAM_BOT_TOKEN` and owner settings.


### Pairing configuration
Set `PAIRING_NUMBER=919103902586` in `.env` to use this as the default WhatsApp pairing target. `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ALLOWED_USERS` remain supported by the existing Telegram pairing module. `TELEGRAM_BOT_ID` is informational; Telegram identifies the bot through its token. The supplied archive did not contain a populated `.env`, so the included `.env` is a blank template and does not include private credentials.

## PAIRING-WEBSITE

### How it works
The user types a number on the website -> the website sends it to the bot's API -> the bot creates a **separate session** for that number
-> the WhatsApp pairing code is shown on the website -> the user enters the code in WhatsApp > Linked devices -> "Connected" appears.

### Option A (easiest, recommended): the page runs together with the bot
1. Upload this zip to the panel, run `npm install`, Start.
2. Take a port from **Network / Allocations** in the panel (the bot uses the `SERVER_PORT` the panel provides). If there is none, add the variable `PAIR_PORT=<port>` in Startup.
3. The console shows: `🌐 Web pairing page: http://<panel-ip>:<port>/`
4. Open `http://<panel-ip>:<port>/` in a browser. Done.
   For a custom pairing code, set the variable `CUSTOM_PAIRING_CODE=KINGBOTS` (8 letters/digits).

### Option B: a PUBLIC live website using only Google AI Studio (no tunnel needed)
In **Build**, Google AI Studio creates a full-stack app (frontend + small server) and **Publish** puts it live on Cloud Run.
Google also gives the domain: `https://your-name.ai.studio` (type the name in "Custom URL" while publishing), free and https.
Idea: the website's server is a **proxy**: the browser only talks to that https site, and the site's server talks to the bot (`http://IP:port`).
So there is no mixed-content problem.

#### Bot side (panel variables)
- `PAIR_PORT` = the panel's port (if `SERVER_PORT` is not set)
- `PAIR_SHARED_SECRET` = a long random password (for example `kob-9fT2xQ7LmA41`) so that only your site can call the bot
- Restart the bot; the console prints `Web pairing page: http://<panel-ip>:<port>/`.
- Test: in a browser open `http://<panel-ip>:<port>/api/health` -> `{"ok":true}`. If it does not open, the panel's port must be public/allocated.

#### AI Studio side
1. https://aistudio.google.com -> **Build** -> new app.
2. Paste the whole text of `AI-STUDIO-PROMPT.txt` and press Enter.
3. In the app's **Secrets/Environment** settings add `BOT_API=http://<panel-ip>:<port>` and `BOT_SECRET=<the same PAIR_SHARED_SECRET>`.
4. Type a number in the preview to test (a code should appear).
5. **Publish** -> **Get Started** -> enter your name in Custom URL (for example `king-of-bots`) -> **Publish App**. Live link: `https://king-of-bots.ai.studio`.
Note: the Starter Tier is not available to every account (not for Workspace accounts or accounts with paid Cloud billing); in that case a Google Cloud project with billing must be attached.
A separate domain (.com) has to be bought outside Google (or set up with Cloud Run domain mapping).


### API
- `POST /api/pair`  {number}  -> {ok, code} | {ok, alreadyLinked} | {ok:false, error}
- `GET /api/status/:number` -> {ok, connected}
- Rate limit: 5 tries / 10 min / IP (change with `PAIR_RATE_PER_IP`)

### Notes
- Every linked number increases the bot's RAM use; keep an eye on the panel's RAM (`MAX_RAM_MB`).
- This server keeps running as long as the bot is running.

# Change history

## API-AUDIT-REPORT

### Changes made
- Added a consistent KING OF BOTS identity instruction for all Gemini-backed aliases.
- Expanded Pinterest `pin.it` short links before calling photo/video endpoints, and added a built-in YouTube audio fallback if the Adeel-XTech `ytmp3` endpoint fails.
- Removed the embedded Gemini credential from `.env`; fill in your own key and Telegram token before starting the bot.
- Centralized the listed Adeel-XTech routes in `lib/adeelApi.js` and added missing command mappings for the GET-style routes used by the bot.
- Added media-family inference for photo/video/audio downloader routes. This handles CDN URLs that have no `.jpg`, `.mp4`, or `.mp3` suffix by checking the returned content type before falling back to the direct media URL.
- Fixed request timeout cleanup so timers are cleared even when a request throws.
- Added `.printrest` as an alias for the Pinterest photo downloader (provide a Pinterest pin URL). Improved Pinterest keyword-search parsing in `features/Plugins/pictures.js` to support Bing's HTML-escaped and JSON-escaped `murl` variants, deduplicate results, and only accept direct `pinimg.com` image URLs.
- Removed a hard-coded Pinterest login/session cookie from `features/System/Scrapers.js`; it could expire and should not be embedded in source. The scraper now encodes the query and uses normal request headers.
- Removed the SIM-database lookup route from the generic command dispatcher because it can expose private personal information. The VCC endpoint was not added to the generic command list because its purpose/schema is unclear and it could facilitate misuse of payment-card data.

### Routes mapped in the bot

### Not live-verified / needs provider schema
- This environment could not resolve the provider hostname, so no endpoint response was live-verified. Static mapping and local syntax checks are not proof that a remote endpoint is currently up or that its undocumented parameter names are correct.
- `imgtourl` and `readqr` are not wired into the generic text-command path because these commonly require image/file input; their exact API request schema must be confirmed before implementing them.
- `translate`, `welcome-goodbye-image`, `qrcodegenerator`, `tweet`, `getpastebin`, `llama`, and some no-query endpoints have no complete parameter examples in the supplied URL list. Their parameter names should be confirmed against provider documentation or a sample JSON response before calling them production-verified.

### Local checks
- `node --check` passed for all 250 JavaScript files.
- ZIP integrity is checked after packaging.


### AI endpoint configuration update (2026-10-20)
- `.gpt` and `.gemini` both route only to `https://eliteprotech-apis.zone.id/ai/chatgpt` using the `prompt` query parameter.
- No Adeel-XTech or other provider fallback is used for these two commands.
- These command handlers do not require `OPENAI_API_KEY` or `GEMINI_API_KEY`. This does not prove the remote service will emulate distinct GPT and Gemini models; both commands call the same endpoint.

## API-ENDPOINT-AND-MENU-FIX

### Changes
- `.chatgpt` / `.gpt` continue to use the known working `/ai/chatgpt` endpoint with the `prompt` parameter.
- Added the separately requested `.notegpt <question>` handler using `/ai/notegpt` and `prompt`.
- `.airmore list` and `.voicelist` call the specified `/ai/airmore?list=voices` endpoint and format common voice-list response shapes (array, nested `data`, `voices`, voice name/id/language fields) instead of emitting raw JSON.
- Existing full command inventory is retained, but menu separators/command rows use the open-code layout pattern from `ELITE-PRO-V2-main.zip` (`╭─〔 category 〕`, `│ ✦ command`, `╰──────────────`). Menu branding remains KING OF BOTS AI / Rauf Legacy.
- Empty or unparseable API responses now result in a short actionable error; raw HTML/JSON dumps are not forwarded.

### Verification and limitations
- `node scripts/check.js`: 266/266 JavaScript files pass syntax checks.
- `node scripts/smoke.js`: pass.
- Local unit checks for voice-list array/nested/string JSON formats and endpoint registry: pass.
- Live endpoint checks were not possible in this runtime because DNS resolution for `eliteprotech-apis.zone.id` failed. Therefore, the `/ai/notegpt` and AirMore provider availability/response shape must still be confirmed against the live service; no fake live-success claim is made.

## API-INTEGRATION-NOTES

### Dedicated handlers added
Each command below has its own `commands/*.js` handler and a named endpoint contract in `lib/kingApiClient.js`:
- AI: `.gpt`, `.deepseek`, `.asyntai`, `.talkai`, `.zonerai`, `.pollinationai`, `.mathgpt`, `.story`
- Images/text effects: `.imagine`, `.imageai`, `.lighteffects`, `.effectclouds`, `.galaxywallpaper`, `.cartoonstyle`, `.writetext`
- Voice: `.airmore <text>`, `.airmore list`, `.voicelist`
- Downloads: `.xdl`, `.aio3`, `.spotifydl`, `.facebookdl`, `.mediafiredl`
- Fun: `.insultapi`

The existing `.song` and `.video` command handlers were retained as the primary handlers for those established commands. The existing menu layout was retained, with new commands added in full menu categories. External API vendor names are not shown in the menu or generated captions.

### Important verification boundary
The API host could not be live-tested in this environment. Endpoint paths above come from the endpoint list supplied in the conversation. For routes whose provider request parameters/response schemas were not supplied, the integration uses a conservative GET contract (`prompt`, `text`, or `url` as appropriate) and reports HTTP/API errors rather than pretending success. AirMore voice listing uses the explicitly supplied `?list=voices` query; voice generation IDs/parameters were not invented. Please check the provider's current schema if any endpoint returns a parameter/schema error.

### Checks performed
- `node scripts/check.js`: 264/264 JavaScript files passed syntax check.
- `node scripts/smoke.js`: settings, branding globals, channel URL, core command exports passed.
- Full live WhatsApp/API request test was not possible here.

## API-RESPONSE-CLEANUP-FIX

### What changed
- Added `lib/cleanApiResponse.js` to convert provider payloads into readable WhatsApp output.
- Removes HTML tags and suppresses script/style/head content when a provider returns an HTML page.
- Extracts user-facing fields such as `answer`, `response`, `text`, `message`, and nested `data.result` instead of serializing the full JSON payload.
- For media commands, prioritizes a real media/download URL and does not dump arbitrary provider JSON when no readable result exists.
- Applied the helper to both the Elite API command client and the fallback API sender.
- When no readable answer or media URL exists, the bot reports a short error rather than pasting the raw server response.

### Validation
- `node scripts/check.js`: 265/265 JavaScript files passed.
- `node scripts/smoke.js`: passed.
- Sanitizer examples checked: HTML page -> plain text, nested JSON -> answer text, arbitrary object -> suppressed, media object -> URL.

Note: API providers can change their response schema. Live provider responses require a real WhatsApp/API runtime test and are not claimed as verified here.

## AUTO-FEATURES-FIX-NOTES

KING OF BOTS — Auto/Group Safety Repair Notes

Changes in this build:
- Removed the vertical `║` prefix from command rows in the help/menu sources.
- Fresh installs default Auto Read, Auto Status View, Status Reactions, and Auto Reaction to ON. Existing saved user choices are preserved by command handlers where applicable.
- Connected incoming-message auto-reaction to the active message processing path.
- Fixed `.areact` argument parsing for both normal and quoted/extended text messages.
- Removed duplicate `messages.upsert` status processing in index.js to avoid double handling.
- New group configs enable anti-spam, anti-flood, anti-mention, and link deletion by default. Group admins can adjust supported settings with the corresponding commands.
- The existing anti-badword module contains a broad Hindi/English bad-word list; it still requires group configuration through `.antibadword on` for that module's dedicated moderation action.

Important: Real WhatsApp runtime behavior depends on the Baileys version, session connectivity, and bot admin permissions. Status reactions may be restricted by WhatsApp protocol/account capabilities and must be tested with a connected account.

## COMMAND-AUDIT-STATUS

KING OF BOTS BY RAUF — static command audit notes

Changes applied in this revision:
- Removed the second auto-reaction call after command routing. Auto-reaction is invoked once at message ingress to prevent duplicate reactions.
- Hardened anti-badword normalization for common leetspeak substitutions, punctuation obfuscation, Unicode normalization, and whitespace.
- Anti-badword phrase matching now uses word boundaries to reduce accidental substring matches.
- Preserved the existing command set and data format.

Validation performed:
- `node --check` passed for all JavaScript files in this archive.

Limitations:
- Syntax checks are not live WhatsApp integration tests. Group participant events, permissions, message deletion, read receipts, status view/reaction, and every individual command still require testing with a connected WhatsApp session.
- This revision does not claim a verified 500–1000-entry curated profanity dictionary. The current lexicon is retained and matching is more robust; expanding a large multilingual dictionary requires a curated source and language-specific review to avoid false positives.
- Group safety switches are not forcibly enabled in every existing group database, because silently changing established group policy can cause unintended moderation. Configure per group and confirm bot admin permissions.

## FINAL-IMPLEMENTATION-REPORT

### Base archive
`KING-OF-BOTS-1.9.5-BETA-MEDIA-FIX.zip`

### Changes applied in this build
- Removed the index-level PRIVATE-mode early `continue` that prevented incoming owner commands from reaching the centralized owner/mode authorization handler. Applied to root and mirrored `src/index.js`.
- Kept centralized owner/sudo checks in `main.js`; ordinary non-owner commands remain blocked in PRIVATE mode.
- Made `.menu` image caption short enough for WhatsApp's image-caption limit. The caption shows bot info, live mode, version, deduplicated listed-command count, and five main commands. The complete category-separated command index is sent as a follow-up text message; voice note is sent afterward. This avoids attempting an oversized image caption that can fail on WhatsApp.
- Kept `assets/rauf-header.jpg` and `assets/menu-voice.ogg` and included them in the menu flow.
- Made the mirrored `src/commands/help.js` match the root menu implementation.
- Updated Instagram media sending to fetch media bytes with a timeout and size cap, reject obvious HTML/JSON error payloads, and send buffers rather than remote URLs.
- Hardened badword list add/remove handling against malformed JSON and case-variant duplicates. Existing `data/badwords.json` contains 1,000 default entries; custom entries remain supported and list pagination remains 100 entries/page.
- Set the display version to `NEW 1.9.5 BETA 🫶` in root and mirrored settings.
- `.bv`/`.bv2` were outside this patch scope and were not intentionally modified.

### Automated checks performed
- `node scripts/check.js`: 612/612 JavaScript files passed syntax validation.
- `node scripts/smoke.js`: passed.
- Menu mock test: three outbound messages; image caption 294 characters; full command index sent separately; voice note included.
- Badword data check: 1,000 default entries.
- ZIP integrity test: performed before release.

### Important constraints / not verified live
- No live WhatsApp session was available. Owner commands in real chats, group participant events, status reactions/likes, and provider downloads must be tested on the authorized connected account.
- WhatsApp image captions have a platform-enforced length limit. Therefore the complete command index cannot reliably be embedded in the image caption; this build sends five main commands and bot information in the image caption, followed by the complete category-separated index as a text message. WhatsApp's own Read More behavior is client-controlled.
- Instagram scraper provider availability can change; this patch validates the downloaded response but does not guarantee the third-party provider works for every post.
- The other external download/API providers were not all live-tested and are not represented as verified. Their endpoints and quotas depend on the source/provider in the existing code.
- Anti-badword enforcement remains per-group opt-in (`.antibadword on`) to avoid unexpectedly deleting group members' messages. The 1,000-entry lexicon is bundled by default.
- Status handling uses the configured ❤️ status reaction method supported by the current source; actual server-side acceptance must be confirmed live.

## FLASH-MD-MERGE-STATUS

- KING OF BOTS remains the sole WhatsApp client and main dispatcher.
- Flash MD command modules and their local `france/` support files are included under `commands/flashmd/`.
- Compatible Flash commands are loaded and dispatched directly from `main.js`; no second Flash MD bot process is started.
- The standalone Flash MD entrypoint and Baileys client are intentionally not copied.
- Excluded Flash command names: DeepSeek, ChatGPT, image/imagine, MathGPT/Math-El.
- Removed the explicit `sharp` dependency/overrides to avoid the native `libvips` startup failure shown in the hosting screenshot.
- Disabled optional Telegram pairing initialization because its dependency chain caused `es-abstract/2025/ToString` startup failure. WhatsApp pairing/auth remains in the original KING OF BOTS flow.

### Validation
ZIP integrity and syntax checks are run on this artifact. Live WhatsApp/API runtime tests require the user's hosting environment and valid external API services; public endpoints in the upstream source may be unavailable or rate-limited.

## FOLLOWUP-SETTINGS-CHANGES

- Global auto-reaction defaults to OFF (`data/userGroupData.json` and `lib/reactions.js` fallback).
- Auto-read remains OFF by default.
- Auto status viewing remains ON by default.
- Status auto-action remains enabled and uses the ❤️ status reaction as the closest supported Baileys status-like action. Baileys exposes this as a `reactionMessage`; there is no separate documented `likeStatus()` method in the current API.
- `.vv` was not replaced in this patch because the available historical ZIPs do not contain a matching original implementation; their `qadeer/commands/vv.js` files are privacy-notice placeholders. Current `.vv` still forwards ordinary quoted media and does not copy View Once media. To restore the exact old behavior, the original source ZIP/file is needed.

These changes are syntax/configuration checked, not live-tested against a connected WhatsApp account.

## MEDIA-DOWNLOAD-FIX-NOTES

KING OF BOTS media patch notes

- Instagram handler now extracts URL from command text, downloads media bytes first, checks file signatures, and sends real buffers instead of passing a URL that may resolve to an HTML/placeholder response.
- YouTube video handler now downloads the provider URL to a buffer and checks for MP4 file signature before sending; HTML/JSON error pages are rejected with a clear error.
- Root and src copies are kept in sync.
- Auto status defaults remain enabled with the ❤️ status-heart relay enabled. Baileys exposes status heart likes through the status reaction protocol; this is not a separate public likeStatus API.
- Generic auto-react default remains off in data/userGroupData.json.
- .vv still forwards ordinary quoted media; the exact older .vv behavior could not be reconstructed from this uploaded ZIP alone. It does not copy View Once media.

Validation: JavaScript syntax and ZIP integrity checked. Live WhatsApp/provider tests require running the bot with a paired session and working provider APIs.

## MERGE-NOTES

KING OF BOTS — MERGE NOTES

- Original RAUF commands remain under their original names.
- Imported Qadeer commands use suffix 2, e.g. .kick2, .promote2, .aura2.
- Extra tools proposed earlier are available under their unsuffixed RAUF names (see .menu).
- Imported commands that call third-party APIs may fail when those APIs are down or require API keys.
- Group moderation commands require appropriate WhatsApp group admin permissions.
- .vv2 removed. .pair2 gives safe host-based pairing guidance instead of a third-party pairing link.
- Menu image is resized and recompressed to reduce file size.
- Syntax checks do not equal live WhatsApp/API tests. Test in a private test group first.

## MERGED-COMMANDS

### Imported commands (suffix `2`)

**Group/Admin:** `.kick2`, `.promote2`, `.demote2`, `.mute2`, `.open2`, `.invite2`, `.tagall2`, `.tagadmins2`, `.tag_admins2`, `.hidetag2`, `.welcome2`, `.goodbye2`

**Fun:** `.aura2`, `.choose2`, `.character2`, `.compliment2`, `.dare2`, `.truth2`, `.8ball2`, `.eightball2`, `.lovetest2`, `.roast2`, `.ship2`

**Media/Utility:** `.fancy2`, `.readmore2`, `.img2`, `.pinterest2`, `.s2`, `.sticker2`, `.take2`, `.save2`, `.url2`, `.tempmail2`, `.inbox2`, `.tiktok2`, `.ttstalk2`, `.play2`, `.ytmp32`, `.ytmp42`, `.weather2`, `.translate2`, `.trt2`, `.jid2`, `.runtime2`, `.pair2`

### New RAUF tools

The `extra-tools.js` additions remain available under their unsuffixed names. Examples: `.groupstats`, `.membercount`, `.adminlist`, `.userinfo`, `.groupreport`, `.lockgroup`, `.unlockgroup`, `.slowmode`, `.antispam`, `.antiflood`, `.antimention`, `.antisticker`, `.antimedia`, `.antiforward`, `.allowlink`, `.blocklink`, `.antilinkmode`, `.badword`, `.securityreport`, `.setrules`, `.rules`, `.setwelcome`, `.setgoodbye`, `.grouplink`, `.revokeinvite`, `.approve`, `.reject`, `.poll`, `.note`, `.calc`, `.qr`, `.shorturl`, `.define`, `.summarize`, `.password`, `.uuid`, `.base64`, `.jsonformat`, `.spellcheck`, `.remind`, `.reminderlist`, `.cancelreminder`, `.health`, `.uptime`, `.commandstats`, `.disablecmd`, `.enablecmd`, `.maintenance`, `.backupconfig`, `.restoreconfig`, `.exportstats`, `.serverinfo`, `.permissions`, `.admincheck`, `.helpsearch`.

### White-label and safety notes

- Imported command names use the `2` suffix to preserve existing RAUF command names.
- `.welcome2` and `.goodbye2` connect to RAUF's existing welcome-event system.
- `.pair2` provides owner-host pairing guidance and avoids unrelated third-party pairing websites.
- - `.antibot` explains platform limitations instead of claiming reliable bot-account detection.
- Menu artwork is optimized; the full command menu is sent as a separate text message to avoid image-caption length limits.
- This is not a live WhatsApp integration test. External API commands depend on third-party services and may require API keys. Test in a private test group first.

## NEW-1.9.5-BETA-PATCH-NOTES

- `.vv` keeps the existing ordinary quoted image/video/audio/document forwarder. View Once media is not copied.
- `.autoread` default is OFF (`data/autoread.json`).
- Auto Status View and Status Reactions default ON (`data/autoStatus.json`). Status reaction uses the configured status reaction handler.
- Added persistent badword lexicon (`data/badwords.json`) with 1000 default entries and custom add/remove/list support via `.badword list [page]`, `.badword add <word or phrase>`, `.badword remove <word or phrase>`. `.antibadword on/off` controls enforcement per group.
- Menu remains image + one caption with bot info and category-separated commands. WhatsApp's Read More cutoff is client-controlled.

Live WhatsApp tests have not been run. Test in a private test group before production.

## NEW-COMMAND-IDEAS

These are future suggestions and are not implemented in this ZIP. Check permissions, storage, and WhatsApp/Baileys API support before adding them.

### Group moderation
1. `.tempban @user 1h` — Temporarily remove a member; rejoin depends on the group invite/join flow and cannot be guaranteed automatically.
2. `.warnlimit 3` — Set the maximum warning count.
3. `.warnexpiry 7d` — Automatically expire old warnings.
4. `.modcase @user reason` — Record a moderation case ID and reason.
5. `.caseinfo <id>` — View a moderation case.
6. `.appeal @user` — Start an appeal process for a warning or kick.
7. `.approveall` — List pending join requests and approve only after confirmation.
8. `.quarantine @user` — Restrict member activity where group controls allow it; platform limits apply.
9. `.raidmode on/off` — Apply stricter moderation during sudden join or message floods.
10. `.newaccountcheck` — Show caution indicators from available metadata; account age is generally unavailable, so this cannot identify new accounts reliably.
11. `.mentioncooldown 30` — Add a cooldown for repeated mass mentions.
12. `.linkdomain remove example.com` — Remove a domain from the allow/block list.
13. `.mediahours 09:00-21:00` — Set allowed hours for media messages.
14. `.adminlog` — Search admin action logs.
15. `.modstats 7d` — Show a seven-day moderation summary.

### Group productivity
16. `.event create <title> <time>` — Create a group event.
17. `.event list` — List upcoming events.
18. `.event remind <id>` — Set an event reminder.
19. `.attendance start <title>` — Start an attendance session.
20. `.attendance mark` — Let a member mark attendance.
21. `.task add <text>` — Add a group task.
22. `.task list` — List pending tasks.
23. `.task done <id>` — Mark a task as completed.
24. `.faq add <question> | <answer>` — Save a frequently asked question.
25. `.faq <query>` — Search saved FAQs.
26. `.suggest <idea>` — Send an idea to a suggestions inbox.
27. `.voteclose <poll-id>` — Close a custom vote session; closing a native WhatsApp poll through the API is not guaranteed.
28. `.digest daily` — Opt-in daily activity summary.
29. `.birthday set <date>` — Opt-in birthday reminder.
30. `.welcomecheck` — Validate welcome settings and placeholders.

### Owner and reliability
31. `.backupdata` — Create a timestamped data backup archive.
32. `.restoredata <backup>` — Restore data with confirmation and validation.
33. `.configdiff` — Compare current config with the last backup.
34. `.featureflags` — List feature flags and their status.
35. `.ratelimit <command> <count>` — Set per-user command rate limits.
36. `.errorstats` — Show error counts and recent non-sensitive stack summaries.
37. `.apihealth` — Check configured external API health.
38. `.sessionstatus` — Show safe linked WhatsApp session status without secrets.
39. `.maintenance message <text>` — Update the maintenance notice.
40. `.schedule restart <time>` — Schedule a restart if hosting supports it.
41. `.auditexport` — Export admin/owner actions as CSV or JSON.
42. `.role grant/revoke` — Grant or revoke a custom moderator role inside the bot.
43. `.commandallowlist` — Set which users/groups may run specific commands.
44. `.privacyreport` — Summarize stored data categories and retention.
45. `.cleanupdata 30d` — Clean old logs according to the retention policy.

### Personal tools
46. `.todo add/list/done` — Personal to-do list.
47. `.budget add/list` — Optional personal expense tracking; handle sensitive data carefully.
48. `.habit set <name>` — Habit reminder and streak tracking.
49. `.pomodoro 25 5` — Focus timer and break reminder.
50. `.convert 10 km mi` — Convert units.
51. `.currency 100 USD INR` — Get a current exchange rate; external API required.
52. `.weatheralert <city>` — Weather alert; external API required.
53. `.translateauto on/off` — Translate incoming text to a selected language with explicit privacy opt-in.
54. `.readtext` — Text-to-speech output.
55. `.extracttext` — Extract OCR text from an image; OCR dependency required.
56. `.pdftext` — Extract text from a PDF.
57. `.csvtable` — Format CSV data as a readable table.
58. `.markdown` — Format text as Markdown.
59. `.urlcheck <URL>` — Check URL reputation; external safety API required.
60. `.qrscan` — Decode an uploaded QR image.

### Before implementation
- WhatsApp permissions and Baileys versions do not support every feature; unsupported actions should return a clear error.
- Auto-kick, mass-tag, invite reset, backup/restore, and owner controls should be admin/owner-only.
- Reminders and scheduled jobs need persistent storage so bot restarts do not lose them.
- API-based commands need timeouts, rate limits, error handling, and privacy disclosures.

## NEW-MENU-V2-COMMANDS

These are the imported KING OF BOTS handlers. Availability of third-party endpoints, group permissions, and command-specific arguments still needs runtime validation.

## NEW-MENU-V2-INTEGRATION

### Command namespace


The source KING OF BOTS ZIP had `song`, `video`, and `emojimix` disabled or missing; the V2 aliases for these use the existing KING OF BOTS command implementations rather than a nonexistent KING OF BOTS API.

### Telegram-owned multi-session pairing

Configure `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ALLOWED_USERS` in the hosting environment. The allowlist is required; an empty allowlist intentionally disables pairing. Each allowlisted Telegram user can use `/pair <international-number>`, `/status`, and `/logout` in a private Telegram chat. WhatsApp credentials are stored in `TELEGRAM_SESSIONS_DIR`, with a metadata file to restore authorized sessions after restart.

Each paired socket uses the shared KING OF BOTS message handlers and its paired phone number as that socket's owner identity. Do not share WhatsApp pairing codes or session folders.

### Gemini


### Media privacy

`.vv` forwards ordinary quoted media to the current chat and configured owner DM. It does not copy View Once media.

### Validation scope

`npm test` checks JavaScript syntax and core startup exports. This is static/smoke validation, not a live test of WhatsApp pairing, Telegram polling, or third-party API uptime. External provider availability, WhatsApp account state, group-admin status, and hosting environment still affect runtime behavior.

## REBUILD-AUDIT

KING OF BOTS — REBUILD AUDIT

This package was rebuilt from the supplied MENU-ROUTING-API-DISPATCH-FIX source.
- Flattened commands/new_menu_v2 and commands/flashmd/commands into the root commands directory.
- Kept native basename implementations where conflicts existed; imported conflicting modules under unique names.
- Rewrote relative module paths for moved JS files when the original target could be resolved.
- Updated new-menu bridge and main.js references for flattened paths.
- Added assets/rauf-header.jpg and removed the two legacy menu image assets when present.

IMPORTANT TEST LIMITS
- ZIP integrity is checked at packaging time.
- JavaScript syntax checks are run on every JS file.
- Live WhatsApp pairing and external API calls are not tested in this environment.
- Modules with unresolved relative imports or optional third-party dependencies may still need runtime validation.

## REPAIR-NOTES-2026-10-19

Changes made in this repair build:
- Replaced `assets/king-of-bots-menu.jpg` with the supplied current KING OF BOTS / RAUF header artwork. The menu command and startup connection-photo setting both reference this same asset.
- Kept the existing Royal Black Edition `.menu` layout and its image+caption single-message behavior.
- Added Gemini text-AI provider fallback order: Adeel-XTech `/api/gemini?text=...`, the same endpoint with `q` as a compatibility fallback, then Ravenn `/ai/gpt4?q=...`. Responses are extracted from common JSON shapes and HTML/empty responses are rejected. This is runtime fallback, not a guarantee that any third-party provider is always online.
- Added Adeel-XTech `ytmp3` fallback to the Flash-MD `.ytmp3`/`.mp3` command when the Noobs API fails or returns no usable audio URL. The command sends audio rather than an error-only response when a provider succeeds.
- Kept the existing API registry and command routing; no Gemini API key was added.

Validation performed locally:
- `node scripts/check.js`: 323/323 JavaScript files passed syntax checks.
- `node scripts/smoke.js`: passed settings, branding globals, channel URL, and core command exports.
- ZIP integrity check performed after packaging.

Limitations:
- Third-party API uptime and actual WhatsApp delivery cannot be guaranteed by local syntax/smoke tests. Live provider tests were not run in this environment.


### AI endpoint configuration update (2026-10-20)
- `.gpt` and `.gemini` both route only to `https://eliteprotech-apis.zone.id/ai/chatgpt` using the `prompt` query parameter.
- No Adeel-XTech or other provider fallback is used for these two commands.
- These command handlers do not require `OPENAI_API_KEY` or `GEMINI_API_KEY`. This does not prove the remote service will emulate distinct GPT and Gemini models; both commands call the same endpoint.

## REPAIR-STATUS-AND-LIMITATIONS

### Changes in this archive
- `.menu` builds one header-image caption containing bot info, an actual deduplicated command count, the current PUBLIC/PRIVATE mode, five main commands first, then the remaining command rows in the same caption. WhatsApp's native caption expansion controls the initial visible portion.
- First-contact private DM intro now uses the bundled `assets/rauf-header.jpg` with the intro caption (falls back to text only if the image is absent).
- Group intro on the group participant add event now uses the same header image and caption (falls back to text if the image is absent); it records the group only after sending succeeds.
- Owner checks for `.kick`, `.ban`, and `.unban` now also use the shared exact-number/LID-aware owner helper rather than relying only on `message.key.fromMe`; ordinary group-admin checks remain in place. This archive does not claim a live WhatsApp authorization test.

### Additional targeted owner-command fixes
- `.kick`, `.ban`, and `.unban` now recognize the configured owner through the shared secure helper when used from another private chat or group. Group-admin permissions are still required for non-owner users.

### Checks performed
- `node scripts/check.js`: 612/612 JavaScript files passed syntax check.
- `node scripts/smoke.js`: passed.
- `unzip -t`: archive integrity passed.

### Not verified live
- No linked WhatsApp session was available for live tests. Therefore actual owner-command behavior across private chats/groups, group participant events, and the WhatsApp client's native Read More rendering must still be verified on the target account/client.
- Intro wording was normalized to the existing KING OF BOTS/RAUF branding and the selected header image; if a different exact custom intro text was agreed in another version, that precise text should be restored from that source rather than guessed.


### Release label
- Bot display version is set to `NEW 1.9.5 BETA 🫶`; package metadata uses `1.9.5-beta`.
- WhatsApp native “Read more” cutoff is controlled by the WhatsApp client and cannot be guaranteed at an exact line on every device.

## V2-CHANGES

- lib/globalCard.js — channel/forwarded card on every outgoing message (main bot, Telegram sessions, multi-sessions). Edit CONFIG at top.
- lib/autoReply.js — `.autoreply on|off|dm|group`, `.mentionreply on|off` (AI replies, never to your own messages).
- lib/groupIntro.js — group intro now driven by `groups.upsert` + participants events, retries, re-sends after re-join.
- lib/telegramPairing.js — public bot, unlimited sessions per Telegram user (`/pair`, `/sessions`, `/session`, `/deletesession`).
  .env: TELEGRAM_RESTRICT_TO_ALLOWED (default false), TELEGRAM_MAX_SESSIONS_PER_USER (0 = unlimited).
- Antidelete: only one handler now (duplicate report fixed).
- Fixed: main.js error handler threw ReferenceError (`chatId`), `.ttt` move used undefined function, implicit global in getName.

### V2.2 — owner commands redesigned
- NEW `.setownername <name>`, `.setbotname <name>` (+ `.setname`, `.botname`), `.setpackname`, `.setauthor` — live + saved in data/botConfig.json (survives restart).
- NEW `.setbotimage` (reply to a photo, or send photo with caption) / `.resetbotimage` — changes menu, welcome & intro image.
- FIXED `.setpp` — works with reply OR photo+caption, wrapped/view-once quotes, own image conversion (sharp/jimp), shows the real error.
- FIXED `.setname` (old one crashed: botData.userNames undefined and never saved anything) and `.owner` v2 (wrong import path / field).
- `.settings` now also shows auto reply, mention reply, bot name and owner name.

### V2.3 — AI for .autoreply / .mentionreply
Primary: EliteProTech ChatGPT. Fallback order: Asyntai → TalkAI → NoteGPT → ZonerAI → Pollination → DeepSeek → MathGPT.
A failed provider is skipped for 60 s, total wait is capped at 45 s, nothing is sent to chat if every provider is down.
Edit PROVIDERS at the top of the AI block in lib/autoReply.js to change the order.

### v1.0.0 STABLE ⚡
Version reset to 1.0.0 (display: "1.0.0 STABLE ⚡", package.json: 1.0.0). Shown in .menu, .alive, .version.

### v1.0.0 — new commands
- `.cmdreact on|off` — bot reacts to every command first (🎵 music, 🤖 AI, 🎬 video, 🎭 sticker, 🛡️ admin, 👑 owner, 😂 fun, 🔎 search, ⚡ others), then runs it. Default ON. (lib/commandReact.js)
- `.online on|off|status` — ON: your number shows online all the time. OFF (default): online only when you open WhatsApp yourself.
  Plain `.online` is still "who is online in this group". (lib/onlineMode.js)

- Official links: channel https://whatsapp.com/channel/0029VbDZOHWLtOjKFsWcAP0a, group https://chat.whatsapp.com/HX2P0t6KxaHHLhctPpCw6x (settings.js; override group with GROUP_LINK in .env). Shown in connect message, channel/group command and .supportinfo.

- Channel forward on EVERY message (text/image/video/audio/document): "Forwarded from KING OF BOTS 👑" + View channel → opens the channel. JID is looked up on demand (retry 1/min, max 4 s wait); manual fallback: `.setchanneljid 120363xxxxxxxxxx@newsletter` or CHANNEL_JID in .env.
- Official group link: `.support .supportgroup .botgroup .officialgroup .joingroup .gclink .botgc .group`, and in DMs "group link / gc link / bot group link" → https://chat.whatsapp.com/HX2P0t6KxaHHLhctPpCw6x. (`.link` still returns the current group's own invite link.)

- `.channeljid <channel link>` — bot looks up your channel's JID from WhatsApp and switches everything to YOUR channel (forward label, View channel, card link, menu/connect links). `.setchanneljid <jid or link>` does the same; both with no argument show the current channel. Saved in data/channel.json + data/botConfig.json (survives restart; the default official channel is restored by deleting data/channel.json).

- Card is now COMPACT (small sender-photo thumbnail instead of a big banner) → `.menu` shows the small card + the menu image once. forwardingScore 5 ("Forwarded many times", no "Search on web" spam). Thumbnail = profile photo of whoever sent the command (owner/fromMe handled; LID senders use the phone-number alias).
- `.ping` is now ONE short message: `*KING OF BOTS* 148ms 💨` (the old "Pinging..." + edit dropped the card).

### v1.0.0 — paired bots (Telegram /pair and .pair) are now FULL bots
- Root cause of "commands / .menu not working" on paired numbers: their socket had no `decodeJid/getName/serializeM`, no `getMessage`/message store, and no group/call/status handlers; `.pair` sessions had no message handler at all.
- NEW lib/botSession.js (`socketOptions` + `attachRuntime`) builds the same runtime as the main bot for every paired number. Both Telegram and `.pair` use it. Saved `.pair` sessions are restored after a restart (multi_sessions/<number>/).
- NEW lib/sessionContext.js: every paired number gets its OWN settings (mode, antilink, autoread, welcome, antidelete, autoreply, cmdreact, ...) in data/sessions/<number>/ — nothing is shared with the main bot or other sessions. `settings` is a Proxy: bot name, pack name, author, channel link and menu image are per number.
- Owner of a paired bot = the paired person (fromMe / their own number). Owner NAME stays RAUF (.setownername is blocked there); .setbotname / .setpackname / .setauthor / .setbotimage / .setpp / .channeljid work for that bot only.
- /deletesession and logout wipe that number's data too. Telegram polling and session restore start only once (the main socket reconnecting no longer duplicates them).

### v1.0.0 — antilink
- The "🛡️ Links are disabled in this group." warning came from a SECOND guard (commands/extra-tools.js) that was ON by default in every group and ignored `.antilink off`. Now: moderation defaults are OFF, old untouched defaults are migrated to OFF once, and `.antilink on/off` controls it (only one system enforces).

### v1.0.0 — card
- Title "WhatsApp", compact card, small ROUND thumbnail (PNG with transparent corners, thumbDiameter/thumbCanvas in lib/globalCard.js).

### build 2026-10-24.6
- Paired bots start from FACTORY defaults (data/_defaults/, a clean copy of the shipped data files) — never from the main bot's current state (.botoff / .mode private / banned list on the main bot no longer leak into paired bots). Don't delete data/_defaults.
- NEW `.card on|off` — switch the channel/forward card off for testing (per bot). If other people could not see a message, turn it off and compare.
- NEW `.errors` / `.errors clear` — shows the last real errors of this bot inside WhatsApp (paired bots see only their own). When YOUR own number triggers a failing command the error cause is appended to "Failed to process command!".
- Startup log + `.settings` show the build number so you can confirm which zip is running.
- Card: thumbnail smaller (round 60px on a 96px canvas). Title "WhatsApp" + whatsapp.com source link (WhatsApp decides the verified tick and thumbnail side).

### build 2026-10-24.7
- NEW `.cardstyle` / `.cardstyle 1-6` — six field combinations for the channel card (with/without link line, with/without "Ad" attribution, video type, media link). WhatsApp decides how a card is drawn (picture side, verified badge), so try them and keep the one that looks right; the reply itself is shown in the chosen style. Saved per bot.
- Round picture smaller (44px circle on a 96px canvas).

## WHITE-LABEL-CHANGELOG

KING OF BOTS white-label pass

- Renamed source-prefixed command filenames to neutral names.
- Renamed menu command filenames to neutral *_plus.js names.
- Updated the shared loader and compatibility router to reference renamed files.
- Replaced visible V2 menu section with white-labelled, distinct command names.
- Static syntax checks and ZIP integrity are run after this pass.
- Live WhatsApp/API execution is not verified in this environment.

## Telegram pairing bot + website lock (v4)
- Admins: TELEGRAM_ADMIN_IDS=8964474291,7362543454 (only they see 🛠 Admin / /admin). Control Center: Statistics, Live Traffic, Users, Broadcast, Sessions, Channels, ➕ Admin in Channel, Settings, Activity Log.
- ➕ Admin in Channel: opens Telegram's "add bot as admin to a channel" link; the channel is registered automatically (max 10). Every non-admin user must join ALL registered channels before the Pair button appears.
- Header = assets/telegram-header.mp4, menu voice = assets/menu-voice.ogg.
- Coloured buttons use Bot API `style` (blue/green/red); shown on Telegram versions from Feb 2026 onward.
- Website lock: create a NEW bot in @BotFather and set TELEGRAM_PASSWORD_BOT_TOKEN. Visitors get a password page → "Get your password here" → password bot → join channels → password valid 10 min, single use, one Telegram user. Unlock cookie lasts WEB_GATE_SESSION_HOURS (default 12). Toggle in 🛠 Admin → Settings or WEB_GATE=false.
- DM intro: "WELCOME TO <name of the user who connected the bot>" … "BY RAUF EXCLUSIVE" (lib/dmIntro.js).

## v5
- MongoDB and the hub/worker cluster were removed completely (lib/cluster.js, lib/clusterStore.js, CLUSTER-SETUP.md, the `mongodb` dependency, MONGODB_URI/ROLE/WORKER_NAME in .env). Everything runs on this one server with local files.
- features/System/MongoDB was only a local JSON store; it is now features/System/LocalDB (same behaviour).
- Telegram 🛠 Admin → 👮 Admins → ➕ Add Admin: send a chat ID (or forward a message) to add an admin; admins added this way can be removed there. The two IDs in TELEGRAM_ADMIN_IDS are permanent.

## Update — no self-restart, 3-hour auto backup, connect message once
- Bot never restarts itself, no matter how high RAM goes (RAM watchdog removed; `--max-old-space-size` limit removed from `start:optimized`).
- `lib/autoBackup.js`: every 3h it saves a backup into the folder `backups/auto/` as `backup-0001_….zip, backup-0002_….zip …`. Since v15 a backup holds only user data (see LATEST CHANGES), a few KB each.
- "CONNECTED" message (main bot, `.pair`, Telegram `/pair`, website) is sent only once per new link. Restart / update / reconnect never sends it.
- If the bot still restarts every hour, the restart is coming from the VPS (pm2 `--cron-restart`, crontab or systemd), not from the bot code.
- Pinterest: `.pinterest <link>`, `.pinvid`, `.pinphoto` now read the pin page directly (mp4 or HLS m3u8), convert the video with ffmpeg to H.264/AAC MP4 (faststart) and photos to JPEG, so WhatsApp never says "something is wrong with the video file". API providers are only the backup. See `lib/pinFallback.js`.
- ONCE-ONLY messages: DM intro, group intro (and the "connected" message) are recorded in `state/sent-once.log` (outside `data/`, so a code update can't reset it). Recorded BEFORE sending; the same person as `@lid` or phone number counts as one. Old `data/owner-intros.json` / `dm-intros` records are imported automatically on first start. `.resetintro` in a group lets the intro be sent there once more.
- UPDATE ZIPS now contain no `data/*.json`, `.env`, sessions or `state/` — extracting over the old folder cannot overwrite your records. Missing data files are created from `data/_defaults` on start. `.env.example` is the template.

## LATEST CHANGES (v10 and later)
- `.anticall set warn|busy|block`: warn = reject the call + send a warning message; busy = reject + send an "I am busy" message; block = reject + block the caller. Custom text: `.anticall msg warn <text>` / `.anticall msg busy <text>`. Also `.anticall on|off|status`.
- `.truecaller <number>` (owner/sudo only): caller-ID lookup with the bundled truecallerjs. It needs your own installation id: `.truecaller setid <id>` or `TRUECALLER_INSTALLATION_ID` in `.env`.
- Website domain: ngrok is still used (`ngrok.txt`). To use your own domain set `SITE_DOMAIN=yourdomain.com` in `.env`; for a Cloudflare Tunnel also set `CLOUDFLARE_TUNNEL_TOKEN=eyJ...`, add the Public hostname (your domain -> HTTP -> localhost:<bot port>) in Cloudflare, and the bot downloads and runs cloudflared by itself.
- Admin: nothing about the admin panel exists on the website. Each start prints a new link in the console (`<domain>/admin/<key>`); opening it shows the admin panel without a password. The admin files are `lib/admin.html`, `lib/admin-app.js` and `lib/admin.css`, served only through that secret link.
- Speed: every WhatsApp message runs on its own (a slow command no longer blocks `.ping` or the next message), group info is cached for 2 minutes, moderation/XP/AFK checks run beside the command, 112 command modules load on first use, old files in `tmp/` and `temp/` are removed every 30 minutes, and `/api/health` answers first.
- No external database is used (no Mongo/SQL/Redis). The bot, website, Telegram bot and all sessions run in one process; settings live in small JSON files in `data/`.
- Pairing code: `CUSTOM_PAIRING_CODE=PAPAXMD1` is set in `.env`. Every way of linking (console, website, Telegram, `.pair`) waits for the WhatsApp handshake, then asks for the code and retries once; unfinished sessions are cleaned before a new link.
- Backup: the automatic backup contains only user data (`data/` plus the small `session.json` owner files), a few KB per backup; no code, website or WhatsApp login keys. To restore, unzip it into the bot folder and restart.
- Website legal pages: `/terms`, `/privacy`, `/cookies`, `/disclaimer` (written for India: IT Act 2000, IT Rules 2021, DPDP Act 2023). First-time visitors must accept them (`public/assets/legal.js`); the footer has a "Privacy choices" link to withdraw consent. The grievance e-mail comes from `public/site-config.js`.
- Everything the bot and website show is in English.


## Proxy / rate limits (v22.1)
- `TRUST_PROXY` = number of reverse proxies in front of the bot (default `1`: ngrok / cloudflared / one panel proxy). The visitor address used for rate limits is the one the nearest proxy saw, so fake `X-Forwarded-For` values cannot reset the limits. Use `TRUST_PROXY=0` if the port is opened directly with no proxy, or `2` for two proxies in a row.
- Create Bot: a number that already has a bot can only be changed with its edit key. If the key is lost it cannot be recovered from the website; the owner can send the bot commands in WhatsApp, or the server admin can delete `data/sessions/<number>/edit.json`.
- Tests: `npm run test:security` (API / edit keys / SSRF / rate limits / STOP, runs offline).

## TechX API commands (v23)
`commands/flashmd/techx_extra.js` adds 30 commands for 43 endpoints of techxkamran.onrender.com. Set `TECHX_API_BASE` to point to another server. Parameter names are sent under several common aliases (q, query, text, prompt ...) because the service was not reachable while building; if one command answers badly, tell the developer which one so its parameter name can be fixed. Test: `node scripts/test-techx.js`.

## v23.1 - owner pairing OFF by default
`PAIRING_NUMBER` in `.env` is now empty. Empty = no owner pairing code is generated and the console never asks for a number. Set `PAIRING_NUMBER=91XXXXXXXXXX` to turn it on. There is no fallback to OWNER_NUMBER any more.

## v23.1 - Admin panel
- Easy admin link: set `ADMIN_CODE=your-secret` (8-64 letters/digits/-/_) in `.env`, then open `https://your-domain/your-secret` (also `/admin/your-secret`). Empty = random link printed on every start. Too many wrong guesses from one IP are blocked for 15 minutes.
- Admin panel redesigned (liquid glass, Black/White): Home (stats, quick actions, health), Sessions (search/copy/remove), Brand, Console (live logs, filter, commands), More (change admin code, upgrade zip, backups).
