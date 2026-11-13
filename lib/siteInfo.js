'use strict';
// Public, non-sensitive facts about the project. Used for the crawler/AI page, llms.txt, robots.txt, sitemap.xml and JSON-LD,
// so search engines and AI assistants can tell what this website is even when it is password protected.
const NAME = 'RAUF × LUCIFER MD BOT';
const SUMMARY = 'RAUF × LUCIFER MD BOT is a free, multi-device WhatsApp bot (Node.js, Baileys) with more than 600 commands: music and video downloads, an AI assistant, stickers and media tools, group administration, anime and fun commands and everyday utilities. A user links their own WhatsApp number from this website with an 8-character pairing code (no QR scan) and then controls the bot by sending commands such as .menu in WhatsApp. A companion Telegram bot can also create sessions.';
const FEATURES = [
  'Link a WhatsApp number with a pairing code in under a minute',
  '600+ commands - send .menu in WhatsApp to list them',
  'Music, video and app downloads',
  'AI assistant and AI support chat',
  'Stickers, image and media tools',
  'Group tools: anti-link, welcome messages, admin commands, warnings',
  'Anime, fun and utility commands',
  'Create your own branded bot (name, prefix, links, logo)',
  'Live phone preview of the bot on the website',
  'Telegram companion bot'
];
const PAGES = [
  ['/', 'Home', 'What the bot is and how to start'],
  ['/pair', 'Link device', 'Link your WhatsApp number with a pairing code'],
  ['/create', 'Create Bot', 'Create your own branded bot with a free demo'],
  ['/preview', 'Preview', 'Try the bot on a virtual phone without signing up'],
  ['/ai', 'AI Support', 'Ask the AI support assistant about the bot or paste an error'],
  ['/commands', 'Commands', 'Search commands by category and copy them'],
  ['/learn', 'Learn', 'Guides: linking, groups, stickers, downloads, fixes'],
  ['/docs', 'Documentation', 'Quick start, command categories, customising, troubleshooting'],
  ['/support', 'Support', 'Contact options'],
  ['/privacy', 'Privacy Policy', 'How data is handled (DPDP Act, 2023)'],
  ['/terms', 'Terms & Conditions', 'Rules for using the service'],
  ['/cookies', 'Cookie Policy', 'Cookies and browser storage'],
  ['/disclaimer', 'Disclaimer', 'Limits of the service; not affiliated with WhatsApp or Meta']
];
const jsonLd = (origin) => ({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', name: NAME, url: origin + '/', description: SUMMARY, inLanguage: 'en' },
    { '@type': 'SoftwareApplication', name: NAME, applicationCategory: 'CommunicationApplication', operatingSystem: 'WhatsApp, Telegram, Node.js',
      description: SUMMARY, url: origin + '/', image: origin + '/assets/og-card.jpg', featureList: FEATURES, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      author: { '@type': 'Organization', name: 'RAUF × LUCIFER' } }
  ]
});
function llms(origin) {
  return `# ${NAME}

> ${SUMMARY}

This website is the control and information site of the bot. It is not affiliated with, endorsed by or sponsored by WhatsApp or Meta.

## Main pages
${PAGES.slice(0, 9).map(([p, t, d]) => `- [${t}](${origin}${p}): ${d}`).join('\n')}

## Key facts
${FEATURES.map((f) => '- ' + f).join('\n')}

## Legal
${PAGES.slice(9).map(([p, t, d]) => `- [${t}](${origin}${p}): ${d}`).join('\n')}
`;
}
const robots = (origin) => `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin
Disallow: /unlock

Sitemap: ${origin}/sitemap.xml
`;
function sitemap(origin) {
  const d = new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PAGES.map(([p]) => `  <url><loc>${origin}${p === '/' ? '/' : p}</loc><lastmod>${d}</lastmod></url>`).join('\n')}\n</urlset>\n`;
}
module.exports = { NAME, SUMMARY, FEATURES, PAGES, jsonLd, llms, robots, sitemap };
