'use strict';
// Link previews (WhatsApp, Telegram, Facebook, X, Discord, Slack ...).
// Those apps open the link WITHOUT a password cookie, so the website lock used to show them the
// "Enter password" page and no picture. Here they get a tiny public page that holds only the site
// name, a short description and the preview picture. No site content, API or admin data is exposed.
const fs = require('fs');
const path = require('path');

const BOT = /(whatsapp|facebookexternalhit|facebot|telegrambot|twitterbot|slackbot|discordbot|linkedinbot|skypeuripreview|pinterest|redditbot|applebot|vkshare|viber|embedly|iframely|signal|googlebot|bingbot|gptbot|chatgpt|oai-searchbot|openai|claudebot|claude-user|claude-web|anthropic|perplexity|google-extended|bytespider|ccbot|cohere|meta-external|amazonbot|duckduckbot|yandex|mistral|youbot|diffbot|applebot|baiduspider|petalbot|bot\/|crawler|spider)/i;
const SOCIAL = /(whatsapp|facebookexternalhit|facebot|telegrambot|twitterbot|slackbot|discordbot|linkedinbot|skypeuripreview|pinterest|redditbot|vkshare|viber|embedly|iframely|signal)/i;
const PUB = path.join(__dirname, '..', 'public');
const NAME = 'RAUF × LUCIFER MD BOT';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function origin(req) {
  let proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  let host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  try { const b = require('./siteUrl').base(); if (b && !host) return b.replace(/\/$/, ''); } catch (_) {}
  return `${proto}://${host}`;
}
function meta(file) {   // title + description of the real page, so every page gets its own preview text
  try {
    const h = fs.readFileSync(path.join(PUB, file), 'utf8');
    const t = (h.match(/<title>([^<]*)<\/title>/i) || [])[1];
    const d = (h.match(/<meta name="description" content="([^"]*)"/i) || [])[1];
    return { title: t || NAME, desc: d || 'A free WhatsApp bot with 610+ commands. Link it to your number in under a minute.' };
  } catch (_) { return { title: NAME, desc: 'A free WhatsApp bot with 610+ commands.' }; }
}
function pick(p) {
  if (/^\/admin(\/|$)/i.test(p)) return { title: NAME + ' - Admin Panel', desc: 'Private admin panel. Open it with your own admin link.' };
  const name = (p.replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '') || 'index').replace(/[^a-z0-9_-]/gi, '');
  return meta(fs.existsSync(path.join(PUB, name + '.html')) ? name + '.html' : 'index.html');
}
function page(req) {
  const o = origin(req), m = pick(req.path), img = o + '/assets/og-card.jpg', url = o + (/^\/admin(\/|$)/i.test(req.path) ? '/admin' : req.originalUrl.split('?')[0]);   // never echo the admin key
  const t = esc(m.title), d = esc(m.desc);
  const I = require('./siteInfo');
  const ld = JSON.stringify(I.jsonLd(o)).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${t}</title>
<meta name="description" content="${d}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${esc(NAME)}">
<meta property="og:title" content="${t}"><meta property="og:description" content="${d}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(img)}"><meta property="og:image:secure_url" content="${esc(img)}">
<meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${t}"><meta name="twitter:description" content="${d}"><meta name="twitter:image" content="${esc(img)}">
<script type="application/ld+json">${ld}</script>
</head><body><main><h1>${t}</h1><p>${d}</p>
<h2>What is ${esc(NAME)}?</h2><p>${esc(I.SUMMARY)}</p>
<h2>Features</h2><ul>${I.FEATURES.map((f) => '<li>' + esc(f) + '</li>').join('')}</ul>
<h2>Pages</h2><ul>${I.PAGES.map(([p, n, x]) => `<li><a href="${esc(o + p)}">${esc(n)}</a> - ${esc(x)}</li>`).join('')}</ul>
<p>Not affiliated with, endorsed by or sponsored by WhatsApp or Meta.</p></main></body></html>`;
}
const isBot = req => BOT.test(String(req.headers['user-agent'] || ''));
/** serve the preview page to link-preview bots (call BEFORE the website lock) */
function attach(app) {
  app.get(['/robots.txt', '/sitemap.xml', '/llms.txt'], (req, res) => {   // public, before the website lock
    const I = require('./siteInfo'), o = origin(req), p = req.path;
    res.setHeader('Cache-Control', 'public, max-age=3600');
    if (p === '/robots.txt') return res.type('text/plain').send(I.robots(o));
    if (p === '/sitemap.xml') return res.type('application/xml').send(I.sitemap(o));
    return res.type('text/plain').send(I.llms(o));
  });
  app.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || !isBot(req)) return next();
    const p = req.path;
    // search / AI crawlers get the real site when it is open; they only get this public page when the site is password protected
    if (!SOCIAL.test(String(req.headers['user-agent'] || ''))) { let on = true; try { on = require('./webGate').isOn(); } catch (_) {} if (!on) return next(); }
    if (p.startsWith('/api/') || /\.[a-z0-9]{2,5}$/i.test(p) && !/\.html$/i.test(p)) return next();   // images/assets handled normally
    res.setHeader('Cache-Control', 'public, max-age=300'); res.type('html').status(200).send(page(req));
  });
}
module.exports = { attach, isBot, OG_PATH: '/assets/og-card.jpg' };
