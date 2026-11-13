// RAUF × LUCIFER MD BOT by RAUF × LUCIFER — shared brand/config for the additional command modules.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const settings = require('../../settings.js');

const owner = String(process.env.PAIRING_NUMBER || process.env.OWNER_NUMBER || settings.ownerNumber || '').replace(/\D/g, '');

const CONFIG = {
  BOT_NAME: settings.botName,
  BOT_VERSION: settings.version,
  OWNER_NAME: settings.botOwner,
  OWNER_NUMBER: owner,
  PREFIXES: ['.'],
  TZ: process.env.TZ || 'Asia/Kolkata',
  MODE: settings.commandMode || 'public',
  MENU_IMAGES: [settings.menuImage || './assets/rauf-header.jpg'],
  CHANNEL_LINK: settings.channelLink
};

export { CONFIG };
export default CONFIG;
