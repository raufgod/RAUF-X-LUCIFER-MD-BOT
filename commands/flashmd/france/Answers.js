// Lightweight AI helper used by the .xenc01 style command.
import axios from 'axios';
export async function xenc01(prompt) {
  const { data } = await axios.get('https://eliteprotech-apis.zone.id/ai/chatgpt', { params: { prompt }, timeout: 45000 });
  const out = typeof data === 'string' ? data : (data?.result || data?.response || data?.answer || data?.message || data?.data);
  return typeof out === 'string' ? out.trim() : JSON.stringify(out ?? data);
}
export default xenc01;
