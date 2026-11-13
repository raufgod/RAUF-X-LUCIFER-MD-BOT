<div align="center">

# 亗 RAUF × LUCIFER MD BOT 亗

### The Multi-Device WhatsApp Automation Suite

**600+ commands · Pairing-code connection · Web control centre · Telegram companion**

<p>
  <a href="https://github.com/Rauf-ctrl/RAUF-X-LUCIFER-MD-BOT"><img src="https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github" alt="GitHub repository"></a>
  <img src="https://img.shields.io/badge/Release-25.2.0--beta-7C3AED?style=for-the-badge" alt="Version 25.2 beta">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 18+">
  <img src="https://img.shields.io/badge/WhatsApp-Multi--Device-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="WhatsApp Multi-Device">
  <img src="https://img.shields.io/badge/License-ISC-64748B?style=for-the-badge" alt="ISC License">
</p>

**Created and maintained by RAUF × LUCIFER**

[Features](#-features) · [Installation](#-installation) · [Configuration](#-configuration) · [Pairing](#-connect-whatsapp) · [Commands](#-commands) · [Security](#-security)

</div>

---

## ◈ Overview

**RAUF × LUCIFER MD BOT** is a Node.js-based WhatsApp Multi-Device automation project built around the Baileys ecosystem. It brings together a large command collection, a browser-based control website, device pairing, optional Telegram integrations and administration utilities in one self-hosted application.

The project is designed for people who want to run and customise their own WhatsApp bot while managing its connected device and website from a single server.

> **Project status:** `25.2.0-beta`  
> This is a beta release. Features, dependencies and setup details may change between versions.

## ✦ Features

| Module | Highlights |
|---|---|
| **WhatsApp Bot** | Multi-Device connection, message handling and command-based interaction |
| **Command Library** | 600+ commands covering utilities, media, stickers, AI features, games and group tools |
| **Pairing System** | Link a WhatsApp device using an 8-character pairing code |
| **Web Control Website** | Responsive website with device-linking flow, command browser and support interface |
| **White-Label Options** | Custom bot identity, owner details, prefix and branding options |
| **Telegram Companion** | Optional Telegram integrations for supported session and password workflows |
| **Admin Panel** | Health information, backups, branding and supported ZIP upgrade tools |
| **Voice Agent** | Optional voice-agent functionality, subject to its configuration |
| **Deployment Options** | Run on a VPS or another Node.js hosting environment |

### Command categories

The command collection includes tools from areas such as:

- Group and community administration
- Media and utility commands
- Stickers and image-related tools
- AI and assistant features
- Games and entertainment
- Information and lookup utilities

Available commands can depend on configuration, API availability and the current release. Use `.menu` in WhatsApp to view the commands enabled in your running instance.

## ◈ Architecture

```text
WhatsApp device
      │
      │ Baileys / Multi-Device connection
      ▼
RAUF × LUCIFER MD BOT
      │
      ├── Command handler
      ├── Feature modules
      ├── Optional Telegram integrations
      ├── Web server and pairing interface
      └── Admin and management utilities
                 │
                 ▼
          Self-hosted server
```

The application starts through `index.js` and uses the scripts defined in `package.json`.

## ⚙️ Requirements

Before installation, make sure your hosting environment has:

- **Node.js 18 or newer** (Node.js 22 is recommended)
- npm
- Git
- A stable internet connection
- `ffmpeg` available in `PATH` for supported media features
- A VPS or hosting environment capable of keeping a Node.js process running
- A public HTTPS URL if you want to access the website from outside your server

A domain, Cloudflare Tunnel or ngrok can be used to expose the website. Tunnel setup is optional if you only need local access.

## 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/Rauf-ctrl/RAUF-X-LUCIFER-MD-BOT.git
cd RAUF-X-LUCIFER-MD-BOT
```

### 2. Install dependencies

```bash
npm install --legacy-peer-deps --no-audit --no-fund
```

If your hosting panel requires the included install script, you can use:

```bash
npm run install:panel
```

### 3. Create your environment file

```bash
cp .env.example .env
```

Open `.env` and configure only the values you actually use. Keep this file private; it must never be committed to a public repository.

### 4. Configure your public URL (optional)

If you use ngrok and the project instructions require its configuration file:

```bash
cp ngrok.txt.example ngrok.txt
```

Add your own tunnel configuration locally. Do not publish authentication tokens or private tunnel details.

### 5. Start the application

```bash
npm start
```

The default server port is `2159`, unless overridden by `PAIR_PORT`, `SERVER_PORT` or `PORT`.

## 🔗 Connect WhatsApp

1. Start the application and open its website.
2. Select the device-linking option.
3. Enter your WhatsApp number with its country code.
4. Request the pairing code.
5. On your phone, open **WhatsApp → Settings → Linked devices → Link with phone number**.
6. Enter the pairing code displayed by your running application.
7. Once connected, send `.menu` from the linked account to view the available commands.

**Keep your WhatsApp session data private.** Anyone with access to a valid session may be able to control that linked bot account.

## 🖥️ Website & Admin Panel

The project includes a website served by the Node.js application. Depending on configuration and release, it provides:

- Device-linking interface
- Command browsing
- Support interface
- Branding and preview options
- Optional website password protection

The private admin route uses the `ADMIN_CODE` value configured in your environment. Treat this value like a password and never share it publicly.

## 🧩 Configuration

The full environment-variable reference is maintained in **`.env.example`**. Common settings include:

| Variable | Purpose |
|---|---|
| `PAIRING_NUMBER` | Number used for the optional startup owner-pairing flow |
| `OWNER_NUMBER` | Primary owner number for owner-restricted commands |
| `OWNER_NUMBER_2` | Optional additional owner number |
| `ADMIN_CODE` | Secret path value for the admin panel |
| `TELEGRAM_BOT_TOKEN` | Optional Telegram session-bot credential |
| `TELEGRAM_PASSWORD_BOT_TOKEN` | Optional Telegram password-bot credential |
| `TELEGRAM_ADMIN_IDS` | Telegram IDs authorised for supported admin actions |
| `SITE_DOMAIN` | Public website domain |
| `CLOUDFLARE_TUNNEL_TOKEN` | Optional Cloudflare Tunnel credential |
| `NGROK_AUTHTOKEN` | Optional ngrok authentication token |
| `NGROK_DOMAIN` | Optional ngrok domain |
| `GROQ_API_KEY` | Optional voice-agent speech-to-text integration |

Not every integration is required. Leave unused options unconfigured and follow the comments in `.env.example`.

## 🧪 Checks & Tests

Run the project checks before deploying changes:

```bash
# Source checks
npm run check

# Project test command (checks + smoke test)
npm test

# Security tests
npm run test:security

# Telegram integration tests
npm run test:telegram

# TechX integration tests
npm run test:techx
```

Some integration tests may require the relevant service credentials or configuration. Do not put real credentials into test output, screenshots or public issue reports.

## 🛠️ Useful npm scripts

| Command | Description |
|---|---|
| `npm start` | Start the application |
| `npm run start:optimized` | Start using the optimized start script |
| `npm run start:panel` | Start the application for panel-based hosting |
| `npm run check` | Run source checks |
| `npm test` | Run checks and smoke test |
| `npm run test:security` | Run security tests |
| `npm run test:telegram` | Run Telegram integration tests |
| `npm run test:techx` | Run TechX integration tests |
| `npm run cleanup` | Run the cleanup script, if included in the deployment package |
| `npm run reset-session` | Run the session-reset script, if included in the deployment package |

Use session-reset commands carefully. Resetting session data may require you to link WhatsApp again.

## 📁 Project Structure

```text
RAUF-X-LUCIFER-MD-BOT/
├── assets/          Static assets
├── commands/        Bot command modules
├── data/            Application data and defaults
├── docs/            Project documentation
├── features/        Feature modules
├── lib/             Core libraries and integrations
├── public/          Website files and assets
├── qadeer/          Additional bot modules
├── scripts/         Checks and test utilities
├── index.js         Main application entry point
├── main.js          Message handling / bot logic
├── config.js        Configuration
├── settings.js      Bot settings
├── package.json     Dependencies and npm scripts
├── .env.example     Environment configuration template
├── SECURITY.md      Security policy
└── LICENSE          License information
```

## 🔐 Security

Security matters especially for bots that connect to personal messaging accounts.

- Never commit `.env`, `ngrok.txt`, access tokens, passwords or private API keys.
- Never publish WhatsApp session folders or linked-device credentials.
- Keep the admin route secret and use strong, unique credentials.
- Restrict server and panel access to trusted users.
- Rotate any credential that is accidentally exposed.
- Review `SECURITY.md` before reporting a vulnerability.
- Use public API endpoints responsibly and follow the provider's terms.

**Public API endpoint URLs are not the same as private API credentials.** Keep public endpoint references intact when documenting integrations, but never expose secret keys, bearer tokens or private access data.

## 🧯 Troubleshooting

| Problem | What to check |
|---|---|
| Website does not open | Confirm the process is running, check the configured port and verify your tunnel/domain |
| Pairing code does not appear | Check the number format and the pairing flow shown by the website; startup pairing may be disabled if `PAIRING_NUMBER` is empty |
| WhatsApp does not connect | Check internet access, phone connectivity and the server logs; try pairing again if the session is no longer valid |
| Commands do not respond | Check the active prefix, bot mode, permissions and console output |
| Media command fails | Check `ffmpeg`, network access and whether the relevant external service is available |
| Optional integration fails | Verify that its environment variables are configured and that the provider is reachable |

When asking for help, share the relevant error message with all tokens, phone numbers, session data and other private information removed.

## 🤝 Contributing

Contributions, bug reports and suggestions are welcome.

1. Fork the repository.
2. Create a branch for your change.
3. Make a focused change and run the relevant checks.
4. Open a pull request with a clear description of what changed.

Please do not include personal credentials, WhatsApp sessions or private user data in commits or issue reports.

## 📜 License

This project is distributed under the **ISC License**. See the [`LICENSE`](LICENSE) file for the full license text.

## ⚖️ Disclaimer

This is an independent, community-developed project. It is **not affiliated with, endorsed by, sponsored by or officially supported by WhatsApp or Meta**.

Use this software responsibly and in accordance with applicable laws and the terms of the platforms and services you connect to. You are responsible for your own deployment, configuration and use.

## 👑 Credits

<div align="center">

### 亗 RAUF × LUCIFER 亗

**Developed by RAUF**  
**Team RAUF × LUCIFER**

[![GitHub](https://img.shields.io/badge/Explore%20Repository-GitHub-181717?style=for-the-badge&logo=github)](https://github.com/Rauf-ctrl/RAUF-X-LUCIFER-MD-BOT)

*Built with dedication. Customised for the community.*

</div>
