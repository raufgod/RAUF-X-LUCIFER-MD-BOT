// Compatibility router for additional command aliases.
const path = require('path');
const settings = require('../settings');
const base = path.join(__dirname, '..', 'commands');
const load = (name) => { try { const m=require(path.join(base,name)); if(typeof m==='function') return m; if(name==='autoread') return m.autoreadCommand; if(name==='translate') return m.handleTranslateCommand; if(name==='autostatus') return m.handleStatusUpdate; return m.default || m.handleCommand || null; } catch (e) { console.error('[NEW MENU V2 load]', name, e.message); return null; } };
const fileMap = { accept:'accept_plus.js', antistatus:'antistatus_plus.js', apk:'apk_plus.js', autoreacts:'autoreacts_plus.js', status:'status_plus.js', dp:'dp_plus.js', gdrive:'gdrive_plus.js', hack:'hack_plus.js', kickoffline:'kickoffline_plus.js', mf:'mf_plus.js', private:'private_plus.js', public:'public_plus.js', setname:'setname_plus.js' };
const handlers = Object.fromEntries(Object.entries(fileMap).map(([n,file])=>[n,load(file)]));
// Use existing RAUF × LUCIFER MD BOT command modules for aliases that were absent from the imported command set.
for (const n of ['song','video','emojimix']) { try { handlers[n]=require(path.join(__dirname,'..','commands',`${n}.js`)); } catch(e) { console.error('[NEW MENU V2 fallback]',n,e.message); } }
const aliases = { acceptcall:'accept', statusguard:'antistatus', apksearch:'apk', statusauto:'status', profilepic:'dp', driveget:'gdrive', numbercheck:'hack', instafetch:'insta', kickinactive:'kickoffline', mediafetch:'mf', privatemode:'private', publicmode:'public', botname:'setname' };
function getText(msg) { const m=msg?.message||{}; return (m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || m.ephemeralMessage?.message?.conversation || '').trim(); }
function normalizedOwnerJid(sock) { const n=String(sock?.__ownerNumber || settings.ownerNumber || '').replace(/\D/g,''); return n ? `${n}@s.whatsapp.net` : ''; }
async function runV2({sock,chatId,message,senderIsOwner,senderIsAdmin,isGroup,userId}) {
  const text=getText(message); const match=text.match(/^\.([a-z0-9_-]+?)(?:\s+v2|v2)?(?:\s+([\s\S]*))?$/i); if(!match) return false; if (!handlers[(aliases[match[1].toLowerCase()]||match[1].toLowerCase())]) return false;
  const command=(aliases[match[1].toLowerCase()]||match[1].toLowerCase()); const handler=handlers[command];
  if(typeof handler!=='function') { await sock.sendMessage(chatId,{text:`⚠️ Command .${match[1]} is not available in this build.`},{quoted:message}); return true; }
  const q=(match[2]||'').trim(); const args=q ? q.split(/\s+/) : [];
  const botData={ statusSettings:{}, antiCall:{}, antiDelete:{}, antilinkGroups:{} }; const saveBotData=()=>{};
  const session={};
  switch(command) {
    case 'antidelete': {
      await handler(sock,chatId,message,!!senderIsOwner,botData,saveBotData,userId,args); return true;
    }
    case 'antilink': case 'antistatus': await handler(sock,chatId,message,!!senderIsAdmin,botData,saveBotData,args); return true;
    case 'autoreacts': await handler(sock,chatId,message,!!senderIsOwner,session,args); return true;
    case 'autoread': await handler(sock,chatId,message); return true;
    case 'autostatus': case 'status': await handler(sock,chatId,message,!!senderIsAdmin,botData,saveBotData,userId,args); return true;
    case 'hidetag': case 'tagall': await handler(sock,chatId,message,!!senderIsAdmin,q); return true;
    case 'kickoffline': await handler(sock,chatId,message,!!senderIsAdmin,botData,saveBotData,args); return true;
    case 'setname': await handler(sock,chatId,message,!!senderIsOwner,botData,saveBotData,userId,q); return true;
    case 'private': case 'public': await handler(sock,chatId,message,!!senderIsOwner,session); return true;
    case 'kick': case 'accept': await handler(sock,chatId,message,!!senderIsAdmin); return true;
    case 'translate': { const fn=handler.handleTranslateCommand || handler; await fn(sock,chatId,message,q); return true; }
    case 'gdrive': case 'mf': case 'tiktok': await handler(sock,chatId,message,q); return true;
    case 'song': case 'video': case 'emojimix': await handler(sock,chatId,message); return true;
    case 'owner': case 'ping': case 'joke': case 'meme': case 'dp': case 'character': case 'facebook': case 'apk': case 'groupinfo': case 'hack': await handler(sock,chatId,message,q); return true;
    case 'vv': { await require('../commands/viewonce')(sock, chatId, message); return true; }
    default: return false;
  }
}
module.exports={runV2,handlers};
