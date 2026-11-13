# Changelog

## 25.2.0-beta
- New README with contents, quick start, linking guide and troubleshooting table.
- Release prepared for GitHub (secret-free package with upload guide).

## 25.1.0-beta
- The console now says why a command is skipped (bot switch off, private mode, banned sender, wrong prefix) instead of failing silently.
- A leftover test brand ("Test Bot") in `data/brand.json` is removed automatically at start-up.
- Added `GITHUB-UPLOAD.md` (how to publish the project without secrets).

## 25.0.0-beta
- Version bump; contains everything from 23.1 (see below). Next releases: 25.1, 25.2, ...

## 23.1.0-beta
### Added
- Admin panel reachable at `/<ADMIN_CODE>` with health, backups and upgrade tools; rate-limited sign-in.
- Redesigned voice-agent (Arya) admin page.
- Full-screen Preview and AI Support pages.
- Server picker with 50 entries (no latency probing).
- Public machine-readable site description: `robots.txt`, `sitemap.xml`, `llms.txt`, JSON-LD and Open Graph metadata; link-preview and AI crawlers get a descriptive page even when the website is password protected.
- `.env.example`, `ngrok.txt.example`, LICENSE, SECURITY.md.
### Changed
- Owner pairing runs only when `PAIRING_NUMBER` is set. Without it no code or QR is produced and the website, Telegram bots and admin panel still start.
- Documentation moved to `docs/`; README rewritten.

## 23.0
- New liquid-glass interface (dock, lens control, Black/White themes), Android WebView wrapper project.

## 22.x
- Create/Edit Bot (white-label), website password gate, voice agent, security hardening (see `docs/security-test-report.md`).
