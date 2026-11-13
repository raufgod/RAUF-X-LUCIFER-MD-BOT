// Public API endpoints + message tables used by the additional command modules.
// API URLs are intentionally kept as hard-coded public endpoints.
export const API_CONFIG = {
  nayanApi: {
    youtube: 'https://nayan-video-downloader.vercel.app/ytdown',
    twitter: 'https://nayan-video-downloader.vercel.app/twitterdown',
    playlist: 'https://nayan-video-downloader.vercel.app/ytplaylist',
    timeout: 60000
  },
  country: { url: 'https://countryapi.gleeze.com/api/country', timeout: 30000 }
};

export const LIMITS = { maxFetchSize: 10 * 1024 * 1024, maxMessageLength: 4000, truncateLimit: 3500 };

const B = '{botName}';
const V = '{botVersion}';
const foot = `\n\n⚡ Powered by ${B} ${V}`;

export const MESSAGES = {
  alive: { checking: '⏳ Checking bot status...', online: '✅ *RAUF × LUCIFER MD BOT by RAUF × LUCIFER is online!*', ping: '🏓 Ping: {latency} ms', platform: '🖥️ Platform: {platform}', ram: '💾 RAM: {ram}', uptime: '⏱️ Uptime: {uptime}' },
  alldl: { caption: '✅ Downloaded from {url}', complete: '✅ Download complete.', error: '❌ Could not download this link. Please check it and try again.', noMedia: '❌ No downloadable media found for this link.', noUrl: '❌ Please provide a link.\nExample: .alldl https://example.com/video' },
  apk: { caption: '📦 *{name}*\n\n⬇️ Sending APK...', complete: '✅ {name} sent successfully.', noQuery: '❌ Please provide an app name.\nExample: .apk whatsapp', notFound: '❌ No app found for "{query}".', searching: '🔎 Searching app...' },
  bible: { error: `❌ Could not fetch that verse.${foot}`, usage: `📖 Usage: .bible John 3:16${foot}` },
  currency: { error: '❌ Currency conversion failed. Try again later.', invalid: '❌ Invalid currency code.', invalidTarget: '❌ Unsupported target currency: {currency}', result: '💱 *CURRENCY CONVERTER*\n\n💵 {amount} {from} = {converted} {to}\n📈 Rate: 1 {from} = {rate} {to}\n🏦 Base: {base}\n🕒 Updated: {date}', usage: '💱 Usage: .currency 100 USD INR' },
  define: { notFound: `❌ No definition found for "{word}".${foot}`, usage: `📚 Usage: .define <word>${foot}` },
  emomix: { apiError: '❌ Emoji mix failed: {error}', error: '❌ Could not mix these emojis.', invalid: '❌ Please send exactly two emojis.', usage: '😀 Usage: .emomix 😀+😍' },
  eval: { error: '❌ Eval error: {error}', noCode: '❌ Please provide code to evaluate.' },
  evalSimple: { error: `❌ Error: {error}${foot}`, usage: `ℹ️ Usage: .eval2 <code>${foot}` },
  exchange: { error: '❌ Could not fetch exchange rates.', invalid: '❌ Invalid currency code.', usage: '💱 Usage: .exchange USD' },
  exec: { error: '❌ Command failed: {error}', noCommand: '❌ Please provide a command.', noOutput: '✅ Command executed (no output).', output: '```{output}```' },
  execHelp: { info: '🖥️ Usage: .exec <shell command> (owner only)' },
  fact: { error: `❌ Could not fetch a fact right now.${foot}` },
  fb: { caption: '📘 *{title}*\n🔗 {url}', error: '❌ Could not fetch this Facebook video.', noUrl: '❌ Please provide a Facebook link.', videoCaption: '✅ Facebook video downloaded.' },
  fetch: { error: '❌ Request failed with status {status}.', noUrl: '❌ Please provide a URL.', tooLarge: '❌ Content is too large to fetch.' },
  gitclone: { error: '❌ Could not clone this repository.', invalid: '❌ Invalid GitHub repository link.', noUrl: '❌ Please provide a GitHub repository link.' },
  gpp: { error: '❌ Could not update the group picture.', noImage: '❌ Reply to an image to set it as the group picture.', success: '✅ Group picture updated.' },
  gpt: { error: '❌ AI request failed. Please try again.', noPrompt: '❌ Please provide a prompt.\nExample: .gpt tell me a joke' },
  hack: { creator: '👑 Created by RAUF × LUCIFER MD BOT by RAUF × LUCIFER' },
  imdb: { error: '❌ Could not search IMDb right now.', noQuery: '❌ Please provide a movie or series name.', notFound: '❌ No result found for "{query}".' },
  insta: { caption: '✅ Instagram media downloaded.', error: '❌ {error}', noUrl: '❌ Please provide an Instagram link.' },
  love: { result: '💘 *LOVE METER*\n\n{user1} ❤️ {user2}\nMatch: {percentage}% {emoji}', usage: '💘 Usage: .love name1 name2' },
  mediafire: { caption: '📁 *MEDIAFIRE*\n\n📄 Name: {name}\n📦 Size: {size}\n🧩 Type: {type}\n📅 Uploaded: {uploaded}', error: '❌ Could not fetch this MediaFire link.', fetching: '⏳ Fetching file...', noUrl: '❌ Please provide a MediaFire link.' },
  npm: { error: '❌ NPM search failed.', noQuery: '❌ Please provide a package name.', notFound: '❌ Package "{query}" not found.', result: '📦 *{name}*\n\n🏷️ Version: {version}\n📝 {description}\n👤 Publisher: {publisher}\n⚖️ License: {license}\n📅 Updated: {date}\n🔗 NPM: {npmLink}\n💻 Repo: {repoLink}\n🏠 Home: {homepage}' },
  poll: { usage: `📊 Usage: .poll Question | Option1 | Option2${foot}` },
  posts: { caption: '✅ Post downloaded.', noPosts: '❌ No posts found for @{username}.', noUsername: '❌ Please provide a username.', videoCaption: '✅ Video downloaded.' },
  quote: { error: `❌ Could not fetch a quote right now.${foot}` },
  screenshot: { error: `❌ Screenshot failed.${foot}`, noUrl: `❌ Please provide a website URL.${foot}` },
  spotify: { caption: '🎧 *{title}*\n👤 {artist}\n⏱️ {duration}\n⭐ Popularity: {popularity}\n🔗 {url}', error: '❌ Spotify search failed.', noQuery: '❌ Please provide a song name.', notFound: '❌ Song not found.' },
  sticker: { error: '❌ Sticker creation failed: {error}', noMedia: '❌ Reply to an image or video to make a sticker.' },
  take: { error: '❌ Could not rename the sticker: {error}', noMedia: '❌ Reply to a sticker.' },
  tgs: { error: '❌ Could not fetch the sticker pack.', noStickers: '❌ No stickers found in this pack.', noUrl: '❌ Please provide a Telegram sticker pack link.' },
  tiktok: { caption: '🎵 *{title}*\n\n✅ TikTok downloaded.', error: '❌ TikTok download failed: {reason}', noUrl: '❌ Please provide a TikTok link.', noVideo: '❌ No video found in this link.' },
  toimg: { error: '❌ Could not convert this sticker.', noSticker: '❌ Reply to a sticker.', success: '✅ Converted to image.', unsupported: '❌ Animated stickers are not supported.' },
  tomp3: { error: '❌ Conversion failed: {error}', noVideo: '❌ Reply to a video or audio message.' },
  translate: { error: `❌ Translation failed.${foot}`, noReply: `❌ Reply to a message to translate it.${foot}`, noText: `❌ Please provide text to translate.${foot}`, usage: `🌐 Usage: .translate <lang> <text>${foot}` },
  trim: { downloadError: '❌ Could not download the media.', error: '❌ Trim failed.', failed: '❌ Could not trim this media.', invalid: '❌ Invalid trim range. Example: .trim 00:10 00:30' },
  videoDl: { caption: '🎬 Here is your video.', complete: '✅ Video downloaded successfully.', error: '❌ Video download failed.', noUrl: '❌ Please provide a video link.', noVideo: '❌ No video found for this link.' }
};
