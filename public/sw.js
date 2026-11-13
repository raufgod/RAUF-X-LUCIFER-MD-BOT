/* RAUF × LUCIFER MD BOT - light offline cache.
   Pages: network first (3 s), cached copy if the network is slow or down. Static files (/assets, icons): cached copy at once, refreshed in the background.
   Only the home page is cached at install, so the first visit is not slowed down. API calls are never cached. */
const V = 'kob-v11';
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.add('/').catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const put = (r, res) => { if (res && res.ok && res.type === 'basic') { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)).catch(() => {}); } return res; };
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname === '/sw.js') return;
  if (/\.(?:mp3|mp4|ogg)$/i.test(u.pathname)) return;                         // big media is never cached
  if (r.mode === 'navigate') {
    e.respondWith(new Promise(resolve => {
      let done = false; const fall = () => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match('/') || Response.error());
      const t = setTimeout(() => { if (!done) fall().then(m => { if (!done && m && m.type !== 'error') { done = true; resolve(m); } }); }, 3000);
      fetch(r).then(res => { clearTimeout(t); if (!done) { done = true; resolve(put(r, res)); } else put(r, res); }).catch(() => { clearTimeout(t); if (!done) { done = true; fall().then(resolve); } });
    }));
    return;
  }
  e.respondWith(caches.match(r, { ignoreSearch: false }).then(hit => {
    const net = fetch(r).then(res => put(r, res)).catch(() => hit || Response.error());
    return hit || net;
  }));
});
