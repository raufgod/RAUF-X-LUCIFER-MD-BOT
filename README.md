<div align="center">

# RAUF × LUCIFER MD BOT

**A multi-device WhatsApp bot with 600+ commands, a Telegram companion bot and a self-hosted control website.**

![version](https://img.shields.io/badge/version-25.2%20beta-6c5ce7) ![node](https://img.shields.io/badge/node-%3E%3D18-3c873a) ![license](https://img.shields.io/badge/license-ISC-blue) ![platform](https://img.shields.io/badge/platform-WhatsApp%20%7C%20Telegram-25d366)

</div>

> Independent project. Not affiliated with, endorsed by or sponsored by WhatsApp or Meta.

## Contents
- [Overview](#overview)
- [Features](#features)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Linking a WhatsApp number](#linking-a-whatsapp-number)
- [Admin panel](#admin-panel)
- [Website](#website)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [Publishing your own copy on GitHub](#publishing-your-own-copy-on-github)
- [License](#license)

## Overview
RAUF × LUCIFER MD BOT runs as a single Node.js process. It serves a responsive website, links WhatsApp numbers with an 8-character pairing code (no QR scan), runs the WhatsApp bot built on [Baileys](https://github.com/WhiskeySockets/Baileys), and optionally runs Telegram bots for session management and website passwords.

## Features
| Area | What you get |
|---|---|
| Commands | 600+ commands: media downloads, AI assistant, stickers, group administration, games, utilities. Send `.menu` in WhatsApp. |
| Pairing | Pairing-code login from the website or Telegram. Many numbers can be linked. |
| White-label | Users can create their own branded bot (name, owner, prefix, logo) from the website. |
| Website | Liquid-glass interface, command browser, AI support chat, live preview, Black and White themes, optional password gate. |
| Admin panel | Health, backups, sessions, branding and zip upgrades at a private URL. |
| Voice agent | Optional outbound voice replies (Arya), see [docs/voice-agent.md](docs/voice-agent.md). |
| Discoverability | `robots.txt`, `sitemap.xml`, `llms.txt`, JSON-LD and Open Graph metadata so search engines, AI assistants and link previews can identify the project. |

## Requirements
- Node.js 18 or newer (tested on Node 22)
- `ffmpeg` on the `PATH` for media commands
- A public HTTPS address for the website: your own domain, a Cloudflare Tunnel or ngrok

## Quick start
```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
npm install --legacy-peer-deps --no-audit --no-fund
cp .env.example .env            # then edit .env
cp ngrok.txt.example ngrok.txt  # only if you use ngrok
npm start
```
The server listens on `PAIR_PORT`, `SERVER_PORT` or `PORT` (default `2159`).

## Configuration
All settings are environment variables in `.env`. Copy `.env.example` for the full list.

| Variable | Purpose |
|---|---|
| `PAIRING_NUMBER` | Owner number (digits with country code). Leave empty to skip owner pairing; the website, Telegram bots and admin panel still start. |
| `OWNER_NUMBER`, `OWNER_NUMBER_2` | Numbers with owner-only command access. |
| `ADMIN_CODE` | Secret path of the admin panel: `https://your-domain/<ADMIN_CODE>`. Use a long random value. |
| `TELEGRAM_BOT_TOKEN` | Telegram session bot. |
| `TELEGRAM_PASSWORD_BOT_TOKEN` | Bot that issues website passwords when the gate is on. |
| `TELEGRAM_ADMIN_IDS` | Comma-separated Telegram IDs allowed to use admin features. |
| `SITE_DOMAIN` | Your public domain. |
| `CLOUDFLARE_TUNNEL_TOKEN` | Starts a Cloudflare Tunnel automatically. |
| `NGROK_AUTHTOKEN`, `NGROK_DOMAIN` | Alternative tunnel (or put them in `ngrok.txt`). |
| `GROQ_API_KEY` | Speech-to-text for the voice agent. |

## Linking a WhatsApp number
1. Open the website and choose **Link device**.
2. Enter the number with country code.
3. Type the 8-character code in WhatsApp: *Settings > Linked devices > Link with phone number*.
4. Send `.menu` from the linked number.

## Admin panel
Open `https://your-domain/<ADMIN_CODE>`. Wrong codes are rate-limited. From the panel you can check health, download backups, edit branding and upgrade from a zip (sessions, `.env` and `ngrok.txt` are never overwritten).

## Website
A static single-page site in `public/`, served by the same process. It has its own service worker, theme switch and a full-screen Preview and AI Support. When the password gate is on, search and AI crawlers still receive a public description page.

## Project structure
```
index.js, main.js     entry points and message handler
commands/             bot commands
lib/                  server, pairing, admin panel, Telegram, branding, tunnel
public/               website
features/             optional feature modules
scripts/              checks and offline tests
docs/                 guides and reports
```

## Testing
```bash
npm run check            # syntax check of every source file
npm test                 # check + smoke test
npm run test:security    # security suite
npm run test:telegram    # Telegram flow
```
All tests run offline.

## Troubleshooting
| Symptom | Check |
|---|---|
| A command gets a reaction but no reply | Read the console for `[command skipped] ...`. It names the reason: bot switch OFF (`.boton`), private mode (`.public`), banned sender (`.unban`) or a different prefix (`.setprefix .`). |
| No pairing code appears | `PAIRING_NUMBER` is empty on purpose. Set it, or link numbers from the website. |
| Bot name is wrong | Delete `data/brand.json` and restart. |
| Website not reachable | Check `SITE_DOMAIN`, the tunnel token and that the port is open. |

## Security
Never publish `.env`, `ngrok.txt`, `session/`, `multi_sessions/` or `data/`: they contain tokens and WhatsApp logins. Details and reporting: [SECURITY.md](SECURITY.md). Test results: [docs/security-test-report.md](docs/security-test-report.md).

## Publishing your own copy on GitHub
Step-by-step guide: [GITHUB-UPLOAD.md](GITHUB-UPLOAD.md).

## License
ISC. See [LICENSE](LICENSE).
