# Security Policy

## Supported versions
Only the latest release (25.x) receives security fixes.

## Reporting a vulnerability
Please do not open a public issue. Contact the maintainers privately through the
Telegram channel linked on the website and include the affected version, steps
to reproduce and the impact. You will get an answer within a few days.

## Operational guidance
- Never commit or share `.env`, `ngrok.txt`, `session/` or `data/`; they contain tokens and WhatsApp credentials.
- Change `ADMIN_CODE` to a long random value before exposing the server.
- Put the server behind HTTPS (own domain, Cloudflare Tunnel or ngrok).
- Keep dependencies current (`npm audit`, `npm update`).

Test coverage and results: [docs/security-test-report.md](docs/security-test-report.md).
