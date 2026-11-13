'use strict';

// Convert API payloads into user-facing text. Never dump raw HTML or a whole
// provider JSON object into WhatsApp when the endpoint has no answer field.
const TEXT_KEYS = [
  'answer', 'response', 'result', 'text', 'message', 'output', 'content',
  'translatedText', 'translated_text', 'description', 'definition', 'story',
  'caption', 'title', 'transcript', 'completion', 'generated_text'
];
const URL_KEYS = ['url', 'downloadUrl', 'download_url', 'imageUrl', 'image_url', 'link', 'mediaUrl', 'videoUrl', 'audioUrl'];

function decodeHtml(value) {
  // Lightweight parser intentionally avoids another runtime dependency.
  return String(value)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|iframe|svg|head|title|meta|link)[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/section|\/article)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;|&#34;/gi, '\"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
}
function isHtml(value) {
  return typeof value === 'string' && /<!doctype\s+html|<html\b|<body\b|<(?:script|style|div|p|main|article|section)\b/i.test(value);
}
function cleanString(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (isHtml(raw)) {
    const text = decodeHtml(raw);
    // If a server returned a page shell with no visible answer, do not forward it.
    return text && !/^error\s*\d{3}\b/i.test(text) ? text : '';
  }
  return raw.replace(/<\/?(?:br|p|div|span|strong|em|b|i|a|html|body)[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'").replace(/[ \t]+/g, ' ').trim();
}
function extractText(payload, options = {}) {
  const { allowUrl = false, maxDepth = 7 } = options;
  const seen = new Set();
  function walk(value, depth) {
    if (depth > maxDepth || value == null) return '';
    if (typeof value === 'string') {
      const s = value.trim();
      if (!s) return '';
      // Some APIs serialize JSON inside a string; inspect it before treating it as prose.
      if (/^[{[]/.test(s)) {
        try { const parsed = JSON.parse(s); if (parsed && typeof parsed === 'object') { const nested = walk(parsed, depth + 1); if (nested) return nested; } } catch (_) {}
      }
      return cleanString(s);
    }
    if (typeof value !== 'object' || seen.has(value)) return '';
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) { const found = walk(item, depth + 1); if (found) return found; }
      return '';
    }
    if (allowUrl) for (const key of URL_KEYS) {
      const found = cleanString(value[key]);
      if (/^https?:\/\//i.test(found)) return found;
    }
    for (const key of TEXT_KEYS) {
      if (value[key] != null && typeof value[key] !== 'object') {
        const found = walk(value[key], depth + 1);
        if (found && (!/^https?:\/\//i.test(found) || allowUrl)) return found;
      }
    }
    // Search common nested envelopes, but never stringify arbitrary objects.
    for (const key of ['data', 'result', 'results', 'payload', 'choices', 'candidate', 'candidates', 'output']) {
      if (value[key] && typeof value[key] === 'object') {
        const found = walk(value[key], depth + 1);
        if (found) return found;
      }
    }
    return '';
  }
  return walk(payload, 0);
}
module.exports = { cleanString, decodeHtml, extractText, isHtml };
