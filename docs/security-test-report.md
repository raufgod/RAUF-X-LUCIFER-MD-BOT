# Security and integration test report: RAUF × LUCIFER MD BOT v22.1 (11 Nov 2026)

Run it yourself: `npm run test:security`, `npm run test:telegram`, `npm test`. All tests run offline.
Express was not installed in the test environment, so the API tests ran on a small Express-compatible shim (`scripts/test-shim/express.js`). With a normal `npm install` the same tests use the real Express automatically.

## Executed and passed
| Area | Result |
|---|---|
| Edit keys and ownership (hash, mode, IDOR) | 9/9 |
| SSRF guard on the logo download (35 address and DNS-rebinding cases, redirects, ports) | 38/38 |
| Website API: pairing route logic, Create/Edit Bot, access control, rate limits | 22/22 |
| CSRF / CORS / admin access / zip path-traversal | 6/6 |
| Website password lock and cookie flags | 6/6 |
| AI history (20 messages, 6 h, clear), provider fallback, what is sent to providers | 7/7 |
| STOP handling and confirmation language | 6/6 |
| Telegram bot access control (fake Telegram) | 9/9 |
| Browser (Chromium): XSS payloads, hostile `?api=`, privacy withdrawal, optional-storage | 21/21 |
| Existing suites: call-agent, registration flow, AI session, smoke, syntax (380 files), consent/legal (31), theme/tab bar (24) | all pass |

## Problems found and fixed
1. **Takeover through /api/pair.** Anyone could send a profile for another person's number. This overwrote the bot settings and replaced the owner's edit key. Now a number that already has a bot needs its edit key; a new key is made only for a brand-new bot; a failed first-time pairing rolls the profile back. (Shown by the test before the fix: profile overwritten.)
2. **Rate-limit bypass.** `trust proxy` was `true`, so a fake `X-Forwarded-For` gave a fresh limit on every request. This applied to the AI, password unlock, voice registration, admin secret and admin link limits. Before the fix 0 of 30 / 16 / 9 / 16 / 16 requests were limited. Now `TRUST_PROXY` (default 1) takes the address the nearest proxy saw. Set `TRUST_PROXY=0` if the port has no proxy in front.
3. **Edit-key brute force through /api/pair** had no limit. A per-number and per-client limit was added.
4. **`edit.json` was world-readable (mode 644).** It is now 0600.
5. **SSRF guard.** Rewritten with `net.BlockList`: IPv4-mapped IPv6 (hex form), NAT64, 6to4, ULA, CGNAT, multicast, reserved ranges; only port 443; no user:password in the link. For the hex-mapped form, my first test run was blocked by a test-setup problem, so I did not see the old code fail. This one is from code review.
6. **Open API base.** `/pair?api=https://other-site` would have sent the visitor's number and keys to that site. It is now accepted only for a locally opened file. Found by code review; the browser test passes after the fix.
7. **STOP.** STOP sent before the voice note went out was silently ignored (found by code review; the new test passes after the fix). The confirmation is now in the language of the word used: Hindi, Roman Hindi, or English.
8. **AI error pages shown as answers.** A provider's HTML error page was stripped to text and shown to the visitor. Now it counts as a failed provider and the next provider is tried. (Shown by the test before the fix.)
9. **Command count.** Real registry count with all 38 extra modules loaded is **611 commands in 14 menu sections** (582 before the TechX commands) (measured). The site fallback is now "610+" (it was "470+" and "500+"). The AI assistant prompt no longer states a number. The live number still comes from `/api/command-count`.
10. `/api/status/:number` is now rate-limited (stops scanning many numbers).
11. The privacy page now says the AI text travels in the URL of the request, so provider or network logs may hold it.

## NOT tested (cannot be done here). Please test these on your server
- **Real WhatsApp pairing end to end**, and **existing sessions staying linked after the update.** The sandbox has no Baileys and no WhatsApp access. Only the route logic was tested, with a fake session layer. Nothing in the session code was changed except masked logs and 0600 key files, but it was not run.
- **Real AI providers and real Telegram.** Outside network access is blocked here. Provider fallback and the data sent were tested with a fake HTTP layer only.
- **Real Express behaviour** (static file serving, `req.ip` with `TRUST_PROXY`) and real browsers other than Chromium.
- Full penetration test, dependency audit (`npm audit`), file-upload paths in other commands, and WhatsApp commands that call external download sites.

## Decisions and limitations to know
- A lost edit key cannot be recovered from the website. Delete `data/sessions/<number>/edit.json` on the server, or let the owner use WhatsApp commands.
- A number that already has bot settings (for example from owner commands) cannot be re-created from the website without its key.
- `TELEGRAM_ADMIN_IDS` has default admin ids in the code (`telegramPairing.js`). Set your own in `.env` before giving the bot to others.
- `sid` (visitor id) is stored as essential, as the cookie policy says. It is removed by "Withdraw all consent" and is created again when the AI or preview is used.
- Voice-registration form is public (CORS `*`). Abuse is limited by per-client and global caps, and a voice note goes out only after the visitor sends the first WhatsApp message.

## v22.2: TechX API commands (added later)
- 30 new commands (`commands/flashmd/techx_extra.js`) cover all 43 unique endpoints of your list (the list had 53 lines; 10 were duplicates). Registry count is now **611**; all 30 are registered (one name, `shorturl`, was already a native command, so the TechX one is `.shortlink`).
- Tested offline with a fake HTTP layer (19/19): every endpoint reachable, input validation, answer formatting, POST fallback, error handling, unsafe media links refused, cool-down.
- **Not tested: the live service.** The sandbox cannot reach techxkamran.onrender.com, so the exact parameter names and answer shapes are unverified. Text goes under several names (q, query, text, prompt ...). Try each command once on your server and report any that answer badly.
- The privacy page and docs now mention that these commands send your text or link to that service.
