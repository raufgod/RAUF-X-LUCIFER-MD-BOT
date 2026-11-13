const axios = require('axios');
const { extractText, cleanString } = require('./cleanApiResponse');
const BASE = 'https://eliteprotech-apis.zone.id';
const AI = require('./aiChat');
const SPECS = {
  gpt: { path:'/ai/chatgpt', input:'prompt', kind:'text' },
  gemini: { path:'/ai/chatgpt', input:'prompt', kind:'text' },
  asyntai: { path:'/ai/asyntai', input:'prompt', kind:'text' },
  talkai: { path:'/ai/talkai', input:'prompt', kind:'text' },
  notegpt: { path:'/ai/notegpt', input:'prompt', kind:'text' },
  story: { path:'/ai/story', input:'prompt', kind:'text' },
  imagine: { path:'/ai/imagine', input:'prompt', kind:'media' },
  zonerai: { path:'/ai/zonerai', input:'prompt', kind:'text' },
  pollinationai: { path:'/ai/pollinationai', input:'prompt', kind:'text' },
  mathgpt: { path:'/ai/mathgpt', input:'prompt', kind:'text' },
  deepseek: { path:'/ai/deepseekai', input:'prompt', kind:'text' },
  airmore: { path:'/ai/airmore', input:'text', kind:'text' },
  insult: { path:'/fun/insult', input:'text', kind:'text' },
  lighteffects: { path:'/image/ephoto', fixed:{type:'lighteffects'}, input:'text', kind:'media' },
  effectclouds: { path:'/image/ephoto', fixed:{type:'effectclouds'}, input:'text', kind:'media' },
  galaxywallpaper: { path:'/image/ephoto', fixed:{type:'galaxywallpaper'}, input:'text', kind:'media' },
  cartoonstyle: { path:'/image/ephoto', fixed:{type:'cartoonstyle'}, input:'text', kind:'media' },
  writetext: { path:'/image/ephoto', fixed:{type:'writetext'}, input:'text', kind:'media' },
  image: { path:'/image/image', input:'prompt', kind:'media' },
  x: { path:'/download/x', input:'url', kind:'media' },
  aio3: { path:'/download/aio3', input:'url', kind:'media' },
  spotifydl: { path:'/download/spotify', input:'url', kind:'media' },
  facebookdl: { path:'/download/facebook', input:'url', kind:'media' },
  mediafiredl: { path:'/download/mediafire', input:'url', kind:'media' }
};
function responseText(data, allowUrl = false) { return extractText(data, { allowUrl }); }

// AirMore's list endpoint may return a plain string, an object, or an array of
// voice records. Format known voice fields instead of passing raw JSON to chat.
function formatVoiceList(payload) {
  const preferred = ['voices', 'voiceList', 'voice_list', 'data', 'results', 'result', 'items'];
  let value = payload;
  if (typeof value === 'string') {
    const s = value.trim();
    try { value = JSON.parse(s); } catch (_) {
      const readable = responseText(s);
      return readable && !/^<!doctype html|^<html\b/i.test(readable) ? readable : '';
    }
  }
  for (let depth = 0; depth < 5 && value && typeof value === 'object' && !Array.isArray(value); depth++) {
    let next;
    for (const key of preferred) if (value[key] != null) { next = value[key]; break; }
    if (next == null) break;
    value = next;
  }
  if (Array.isArray(value)) {
    const lines = value.map((item) => {
      if (typeof item === 'string' || typeof item === 'number') return String(item).trim();
      if (!item || typeof item !== 'object') return '';
      const name = item.name || item.voiceName || item.voice_name || item.voice || item.id || item.value;
      const lang = item.language || item.lang || item.locale || item.languageCode;
      const gender = item.gender || item.sex;
      if (!name) return '';
      return `• ${name}${lang ? ` — ${lang}` : ''}${gender ? ` (${gender})` : ''}`;
    }).filter(Boolean);
    return [...new Set(lines)].join('\n');
  }
  const readable = responseText(value);
  return readable && !/^<!doctype html|^<html\b/i.test(readable) ? readable : '';
}

async function _callApi(name, input, sock, chatId, message) {
  const spec=SPECS[name]; if(!spec) throw new Error('No API contract configured for this command');
  if(name==='airmore' && /^list(?:\s+voices)?$/i.test(input.trim())) {
    const r=await axios.get(BASE+spec.path,{params:{list:'voices'},timeout:45000,maxRedirects:5,validateStatus:()=>true,headers:{Accept:'application/json, text/plain, */*','User-Agent':'KING-OF-BOTS-AI/1.0'}});
    if(r.status<200||r.status>=300) throw new Error(`AirMore voice-list endpoint returned HTTP ${r.status}`);
    const body=formatVoiceList(r.data);
    if(!body) throw new Error('AirMore voice-list endpoint returned no readable voice entries. Provider may be temporarily unavailable or changed its response format.');
    return sock.sendMessage(chatId,{text:`*RAUF × LUCIFER MD BOT AI — AirMore Voice List*\n\n${body.slice(0,6000)}\n\n*Powered by RAUF × LUCIFER*`},{quoted:message});
  }
  // ".gpt" (any AI command) sent as a reply to a voice note -> the AI answers that voice (needs the user's Groq key)
  if(AI.isChatAI(name) && !String(input||'').trim() && await require('./aiSession').commandOnVoice(sock, chatId, message, name)) return;
  if(!input.trim()) throw new Error(name==='airmore'?'Usage: .airmore <text> or .airmore list':'Please provide a prompt or URL.');
  const value=input.trim();
  const hkey = AI.isChatAI(name) ? `wa:${chatId}:${(message&&message.key&&(message.key.participant||message.key.remoteJid))||chatId}:${name}` : null;
  if(hkey && /^(clear|reset|new)$/i.test(value)) { AI.clear(hkey); return sock.sendMessage(chatId,{text:`*${require('../settings').botName} AI*\n\n🧹 ${name} chat history cleared.`},{quoted:message}); }
  const promptVal = hkey ? AI.buildPrompt(hkey, value) : value;   // last 20 messages of THIS AI are sent along
  const requests=[];
  // GPT and Gemini intentionally share the user's chosen EliteProTech GPT endpoint.
  // No provider fallback is used for either command.
  if(name==='gpt' || name==='gemini') {
    requests.push({url:BASE+'/ai/chatgpt',params:{prompt:promptVal}});
  } else if(name==='airmore') {
    requests.push({url:BASE+spec.path,params:{text:value}});
    requests.push({url:BASE+spec.path,params:{prompt:value}});
    requests.push({url:BASE+spec.path,params:{q:value}});
  } else {
    requests.push({url:BASE+spec.path,params:{...(spec.fixed||{}),[spec.input]:promptVal}});
  }
  let data, lastError;
  for (const request of requests) {
    try {
      const r=await axios.get(request.url,{params:request.params,timeout:45000,maxRedirects:5,validateStatus:()=>true,headers:{Accept:'application/json, text/plain, */*','User-Agent':'KING-OF-BOTS-AI/1.0'}});
      if(r.status<200||r.status>=300) { lastError=new Error(`HTTP ${r.status} from ${new URL(request.url).host}`); continue; }
      const candidate=r.data;
      if(candidate && typeof candidate==='object' && (candidate.success===false || candidate.status==='error')) { lastError=new Error(candidate.message||candidate.error||'Provider reported failure'); continue; }
      const text=responseText(candidate, spec.kind==='media');
      if(!text || /^<!doctype html|^<html\b/i.test(String(text).trim())) { lastError=new Error('Provider returned an empty/unreadable response'); continue; }
      data=candidate; break;
    } catch(e) { lastError=e; }
  }
  if(data===undefined) throw new Error(`${name} providers failed: ${String(lastError?.message||'service unavailable').slice(0,180)}`);
  if(spec.kind==='media') {
    const url=responseText(data, true);
    if(url && /^https?:\/\//i.test(url)) {
      const caption=`*${require('../settings').botName} AI*\n${data.caption||data.title||'Your result is ready.'}`;
      return sock.sendMessage(chatId,{text:`${caption}\n\n${url}`},{quoted:message});
    }
    if(typeof data==='object' && data && (data.success===false || data.status==='error')) throw new Error(data.message||data.error||'Provider reported failure');
    const readable = responseText(data);
    if (!readable) throw new Error('API returned no readable answer or media URL (raw response suppressed).');
    return sock.sendMessage(chatId,{text:`*${require('../settings').botName} AI*\n\n${readable.slice(0,5500)}\n\n*© RAUF × LUCIFER*\n*Powered by RAUF × LUCIFER*`},{quoted:message});
  }
  if(typeof data==='object' && data && (data.success===false || data.status==='error')) throw new Error(data.message||data.error||'Provider reported failure');
  const text=responseText(data);
  if(!text) throw new Error('API response did not contain a readable answer (HTML/JSON dump suppressed).');
  if(hkey) AI.record(hkey, value, text);
  const sentMsg=await sock.sendMessage(chatId,{text:`*${require('../settings').botName} AI*\n\n${text.slice(0,6500)}\n\n*© RAUF × LUCIFER*\n*Powered by RAUF × LUCIFER*`},{quoted:message});
  if(hkey) { try { require('./aiSession').track(sock, chatId, sentMsg, name); } catch(_) {} }   // replying to this answer continues the chat with the same AI
  return sentMsg;
}
async function callApi(name, input, sock, chatId, message) {
  try { return await _callApi(name, input, sock, chatId, message); }
  catch (e) {
    console.error(`[api:${name}]`, e?.message || e);          // details stay in the console only
    return sock.sendMessage(chatId, { text: '⚠️ Service is busy right now. Please try again in a moment.' }, { quoted: message }).catch(() => {});
  }
}
module.exports={callApi,SPECS,formatVoiceList,responseText};
