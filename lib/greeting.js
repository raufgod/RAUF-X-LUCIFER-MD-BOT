'use strict';
// Time-of-day greeting (English only, no religion-specific greetings).
// Uses India time (IST) by default; change with env GREETING_TZ (e.g. "Asia/Karachi").
const TZ = process.env.GREETING_TZ || 'Asia/Kolkata';

function hour() {
  try {
    const h = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: TZ }).format(new Date());
    return Number(h) % 24;
  } catch (_) { return new Date().getHours(); }
}

/** "Good Morning" | "Good Afternoon" | "Good Evening" | "Good Night" */
function greeting(h = hour()) {
  if (h >= 5 && h < 12) return 'Good Morning';
  if (h >= 12 && h < 17) return 'Good Afternoon';
  if (h >= 17 && h < 21) return 'Good Evening';
  return 'Good Night';
}

/** Same text in bold math letters (to match the fancy captions). */
function bold(s) {
  return String(s).replace(/[A-Za-z]/g, (c) => String.fromCodePoint(
    c <= 'Z' ? 0x1D400 + c.charCodeAt(0) - 65 : 0x1D41A + c.charCodeAt(0) - 97));
}

module.exports = { greeting, boldGreeting: () => bold(greeting().toUpperCase()), bold };
