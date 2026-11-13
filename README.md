
<div align="center">

# 亗 RAUF × LUCIFER MD BOT 亗

### THE NEXT-GENERATION WHATSAPP AUTOMATION SUITE

**Powerful • Customizable • Multi-Device • Self-Hosted**

<p>
  <img src="https://img.shields.io/badge/VERSION-25.2.0--BETA-8A2BE2?style=for-the-badge" />
  <img src="https://img.shields.io/badge/PLATFORM-WHATSAPP-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" />
  <img src="https://img.shields.io/badge/RUNTIME-NODE.JS-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/STATUS-BETA-orange?style=for-the-badge" />
</p>

<p>
  <b>Developed by RAUF × LUCIFER</b><br>
  <i>Built with passion. Powered by innovation.</i>
</p>

[GitHub Repository](https://github.com/Rauf-ctrl/RAUF-X-LUCIFER-MD-BOT)

</div>

---

# ◈ INTRODUCTION

Welcome to **RAUF × LUCIFER MD BOT**, a WhatsApp Multi-Device automation project designed to bring powerful bot functionality, intelligent utilities and management tools into one customizable platform.

Built around the Baileys ecosystem, this project combines command-based automation, WhatsApp device pairing, web-based management and optional external integrations.

Whether you want to explore bot development, manage a personal bot instance or customize the project for your own environment, RAUF × LUCIFER MD BOT provides a flexible foundation.

> **Version:** 25.2.0-beta  
> **Developer:** RAUF  
> **Team:** RAUF × LUCIFER  
> **Repository:** Rauf-ctrl/RAUF-X-LUCIFER-MD-BOT

# ✨ KEY FEATURES

<table>
<tr>
<td width="50%">

### 📱 WhatsApp Integration
- Multi-Device connection
- Pairing-code system
- Command-based interaction
- Session management

</td>
<td width="50%">

### 🌐 Web Control Centre
- Device-linking interface
- Responsive website
- Command browsing
- Support interface

</td>
</tr>
<tr>
<td>

### ⚡ Advanced Commands
- Group management
- Media utilities
- Sticker tools
- Games and entertainment

</td>
<td>

### 👑 Administration
- Owner-restricted commands
- Admin utilities
- Custom bot identity
- Management features

</td>
</tr>
<tr>
<td>

### 🤖 Integrations
- Optional Telegram features
- External API integrations
- Optional voice-agent features
- Configurable providers

</td>
<td>

### 🖥️ Self Hosting
- VPS deployment
- Node.js environment
- Custom domain support
- Tunnel compatibility

</td>
</tr>
</table>

# 🧩 COMMAND CATEGORIES

The project includes commands from multiple categories:

| Category | Description |
|---|---|
| Group | Group administration and utilities |
| Admin | Owner and administrator tools |
| Media | Media-related utilities |
| Stickers | Sticker creation and tools |
| AI | AI-related integrations |
| Games | Interactive entertainment |
| Tools | Useful everyday utilities |
| Information | Information and lookup features |

**Note:** The available commands depend on the current version, configuration and external service availability. Use `.menu` in WhatsApp to view the commands enabled in your instance.

# 🏗️ SYSTEM ARCHITECTURE

```text
             WHATSAPP DEVICE
                    |
                    |
             BAILEYS CONNECTION
                    |
                    ▼
          RAUF × LUCIFER MD BOT
                    |
       ┌────────────┼────────────┐
       |            |            |
       ▼            ▼            ▼
   COMMANDS      WEB SERVER   INTEGRATIONS
       |            |            |
       ▼            ▼            ▼
   FEATURES      PAIRING       OPTIONAL
   MODULES       INTERFACE     SERVICES
       |            |            |
       └────────────┼────────────┘
                    |
                    ▼
              VPS / HOSTING
```

# ⚙️ REQUIREMENTS

Before installation, prepare the following:

| Requirement | Recommended |
|---|---|
| Node.js | 18 or newer |
| npm | Latest compatible version |
| Git | Latest version |
| Hosting | VPS or Node.js hosting |
| Internet | Stable connection |
| FFmpeg | Required for supported media features |

A public HTTPS URL is recommended when accessing the website remotely.

# 🚀 INSTALLATION GUIDE

## 1. Clone Repository

```bash
git clone https://github.com/Rauf-ctrl/RAUF-X-LUCIFER-MD-BOT.git
```

## 2. Open Project Directory

```bash
cd RAUF-X-LUCIFER-MD-BOT
```

## 3. Install Dependencies

```bash
npm install --legacy-peer-deps --no-audit --no-fund
```

## 4. Configure Environment

If the project includes `.env.example`, create your local environment file:

```bash
cp .env.example .env
```

Open `.env` and configure the values required for your deployment.

## 5. Start the Bot

```bash
npm start
```

The application uses the start scripts defined in `package.json`.

# 🔗 CONNECT WHATSAPP

Follow these steps to connect your WhatsApp account:

1. Start the application.
2. Open the project website.
3. Select the WhatsApp device-linking option.
4. Enter your WhatsApp number with country code.
5. Request a pairing code.
6. Open WhatsApp on your phone.
7. Navigate to **Settings → Linked Devices**.
8. Select **Link with phone number**.
9. Enter the displayed pairing code.

Once connected, send:

```text
.menu
```

to view the available bot commands.

**Security:** Never share your pairing code or WhatsApp session files with anyone.

# 🌐 WEB CONTROL CENTRE

The project includes a web interface served by the Node.js application.

Depending on your configuration, it may provide:

- WhatsApp device-linking interface
- Pairing workflow
- Command information
- Support interface
- Branding options
- Administrative utilities

For remote access, configure your domain or HTTPS tunnel according to your hosting environment.

# 🔧 CONFIGURATION

Configure your environment using the supplied `.env.example` file.

Common configuration options include:

| Variable | Purpose |
|---|---|
| `PAIRING_NUMBER` | Optional startup pairing number |
| `OWNER_NUMBER` | Primary bot owner |
| `OWNER_NUMBER_2` | Optional additional owner |
| `ADMIN_CODE` | Admin panel secret |
| `TELEGRAM_BOT_TOKEN` | Optional Telegram integration |
| `TELEGRAM_PASSWORD_BOT_TOKEN` | Optional Telegram password integration |
| `TELEGRAM_ADMIN_IDS` | Authorized Telegram administrator IDs |
| `SITE_DOMAIN` | Public website domain |
| `CLOUDFLARE_TUNNEL_TOKEN` | Optional Cloudflare Tunnel |
| `NGROK_AUTHTOKEN` | Optional ngrok authentication |
| `NGROK_DOMAIN` | Optional ngrok domain |
| `GROQ_API_KEY` | Optional voice-agent integration |

Not all integrations are mandatory. Configure only the services you intend to use.

Always follow the comments and actual variable names in `.env.example`.

# 🧪 TESTING

Run the available project checks before deploying:

```bash
npm run check
```

Run the test suite:

```bash
npm test
```

Security tests:

```bash
npm run test:security
```

Telegram integration tests:

```bash
npm run test:telegram
```

TechX integration tests:

```bash
npm run test:techx
```

Some integration tests may require their respective service configuration.

# 📦 USEFUL COMMANDS

| Command | Description |
|---|---|
| `npm start` | Start the application |
| `npm run start:optimized` | Optimized startup |
| `npm run start:panel` | Panel-based startup |
| `npm run check` | Source checks |
| `npm test` | Project test suite |
| `npm run test:security` | Security tests |
| `npm run test:telegram` | Telegram tests |
| `npm run test:techx` | TechX integration tests |

Additional scripts may be available in `package.json`.

# 📁 PROJECT STRUCTURE

```text
RAUF-X-LUCIFER-MD-BOT/
│
├── assets/
├── commands/
├── data/
├── docs/
├── features/
├── lib/
├── public/
├── qadeer/
├── scripts/
│
├── index.js
├── main.js
├── config.js
├── settings.js
├── package.json
├── .env.example
├── SECURITY.md
└── LICENSE
```

The exact structure may change between releases.

# 🔐 SECURITY & PRIVACY

Security is important when operating a WhatsApp automation system.

Please follow these rules:

- Never publish your `.env` file.
- Never expose Telegram bot tokens.
- Never publish private API keys.
- Never upload WhatsApp session credentials.
- Protect your admin credentials.
- Restrict access to your hosting panel.
- Rotate credentials if they are accidentally exposed.
- Keep your server and dependencies updated.

**Important API distinction:**

Public API endpoint URLs and provider names are not the same as private API credentials.

Public endpoint references may remain documented in the source code. Secret keys, authorization tokens and private credentials must remain protected.

Read `SECURITY.md` for additional security information.

# 🛠️ TROUBLESHOOTING

| Problem | Possible solution |
|---|---|
| Website not opening | Check server status, port and domain configuration |
| Pairing code unavailable | Check number format and pairing configuration |
| WhatsApp connection fails | Check internet and session status |
| Commands not responding | Check prefix, permissions and logs |
| Media tools fail | Check FFmpeg and external service availability |
| Telegram integration fails | Verify its configuration and credentials |
| Website inaccessible externally | Check HTTPS tunnel or domain configuration |

When reporting an issue, remove private credentials and personal information from logs.

# 🤝 CONTRIBUTION

Contributions and suggestions are welcome.

1. Fork this repository.
2. Create a new branch.
3. Make your changes.
4. Run the relevant checks.
5. Submit a pull request with a clear explanation.

Please do not submit private credentials, WhatsApp sessions or personal user data.

# 📜 LICENSE

This project is distributed under the **ISC License**.

See the [`LICENSE`](LICENSE) file for complete license information.

# ⚖️ DISCLAIMER

RAUF × LUCIFER MD BOT is an independent community-developed project.

- This project is not affiliated with WhatsApp or Meta.
- WhatsApp and Meta are trademarks of their respective owners.
- Users are responsible for their own deployment and usage.
- Use all integrations according to their respective terms and applicable laws.
- The developers are not responsible for misuse or unauthorized access.

# 👑 DEVELOPER & CREDITS

<div align="center">

## 亗 RAUF × LUCIFER 亗

### DEVELOPED BY RAUF

**TEAM RAUF × LUCIFER**

[![GitHub](https://img.shields.io/badge/GITHUB-VISIT%20REPOSITORY-181717?style=for-the-badge&logo=github)](https://github.com/Rauf-ctrl/RAUF-X-LUCIFER-MD-BOT)

<br>

**THANK YOU FOR VISITING OUR REPOSITORY!**

*Built with dedication. Powered by innovation.*

</div>
