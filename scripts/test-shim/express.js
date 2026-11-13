// Minimal Express-compatible SHIM used only for offline tests (the real "express" package is not installed here).
// It mirrors the documented Express behaviour for: routing, :params, json/raw body, req.ip + "trust proxy", res.status/json/send/sendFile.
const http = require('http'), fs = require('fs');
function express() {
  const stack = [], settings = {};
  const app = (req, res) => handle(req, res);
  app.disable = (k) => { settings[k] = false; }; app.set = (k, v) => { settings[k] = v; }; app.getSetting = (k) => settings[k];
  const mk = (method) => (p, ...h) => { stack.push({ method, p, h: h.flat() }); return app; };
  app.get = mk('GET'); app.post = mk('POST'); app.put = mk('PUT'); app.delete = mk('DELETE');
  app.use = (p, ...h) => { if (typeof p === 'function') { h.unshift(p); p = null; } stack.push({ method: null, p, h: h.flat(), use: true }); return app; };
  const match = (pat, path, use) => {
    if (pat == null) return {}; const pats = Array.isArray(pat) ? pat : [pat];
    for (const q of pats) {
      if (q instanceof RegExp) { if (q.test(path)) return {}; continue; }
      if (use) { if (path === q || path.startsWith(q.replace(/\/$/, '') + '/')) return {}; continue; }
      const names = [], re = new RegExp('^' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '/?$');
      const m = re.exec(path); if (m) { const o = {}; names.forEach((n, i) => { o[n] = decodeURIComponent(m[i + 1]); }); return o; }
    }
    return null;
  };
  function ipOf(req) {
    const sock = req.socket.remoteAddress.replace('::ffff:', ''), xff = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
    const t = settings['trust proxy']; if (!t) return sock;
    const addrs = [sock, ...xff.reverse()];
    if (t === true) return addrs[addrs.length - 1];
    const n = Number(t) || 0; return addrs[Math.min(n, addrs.length - 1)];
  }
  function handle(req, res) {
    const u = new URL(req.url, 'http://x'); req.path = u.pathname; req.query = Object.fromEntries(u.searchParams); req.ip = ipOf(req); req.secure = false; req.originalUrl = req.url; req.protocol = 'http'; req.params = {}; req.app = app;
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { if (!res.getHeader('content-type')) res.setHeader('content-type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); return res; };
    res.send = (b) => { if (typeof b === 'object' && !Buffer.isBuffer(b)) return res.json(b); if (!res.getHeader('content-type')) res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(b); return res; };
    res.sendStatus = (c) => { res.statusCode = c; res.end(String(c)); }; res.type = (t) => { res.setHeader('content-type', t === 'html' ? 'text/html' : t); return res; };
    res.append = (k, v) => { const o = res.getHeader(k); res.setHeader(k, o ? [].concat(o, v) : v); return res; };
    res.sendFile = (f) => { try { res.setHeader('content-type', f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream'); res.end(fs.readFileSync(f)); } catch (e) { res.statusCode = 404; res.end('nf'); } };
    let i = 0;
    const next = (err) => {
      if (err) { res.statusCode = 500; return res.end('err'); }
      while (i < stack.length) {
        const L = stack[i++]; if (L.method && L.method !== req.method) continue;
        const m = match(L.p, req.path, L.use); if (!m) continue; req.params = m;
        let j = 0; const run = () => { const f = L.h[j++]; if (!f) return next(); try { const r = f(req, res, run); if (r && r.catch) r.catch(() => { if (!res.writableEnded) { res.statusCode = 500; res.end('err'); } }); } catch (e) { res.statusCode = 500; res.end('err'); } }; return run();
      }
      res.statusCode = 404; res.end('Not found');
    };
    next();
  }
  app.listen = (port, host, cb) => { if (typeof host === 'function') { cb = host; host = undefined; } const s = http.createServer(app); app._server = s; return s.listen(port, host || '127.0.0.1', cb); };
  return app;
}
const body = (req, lim) => new Promise((ok, no) => { const c = []; let n = 0; req.on('data', d => { n += d.length; if (n > lim) { req.destroy(); return no(new Error('too large')); } c.push(d); }); req.on('end', () => ok(Buffer.concat(c))); });
express.json = ({ limit = '100kb' } = {}) => { const lim = typeof limit === 'string' ? parseInt(limit) * (/mb/i.test(limit) ? 1048576 : 1024) : limit; return async (req, res, next) => { if (!/json/.test(req.headers['content-type'] || '')) { req.body = req.body || {}; return next(); } try { const b = await body(req, lim); req.body = b.length ? JSON.parse(b) : {}; next(); } catch (e) { res.statusCode = /large/.test(e.message) ? 413 : 400; res.end('bad body'); } }; };
express.raw = ({ limit = '100kb' } = {}) => (req, res, next) => body(req, 1e8).then(b => { req.body = b; next(); }).catch(() => { res.statusCode = 400; res.end(); });
express.static = () => (req, res, next) => next();
module.exports = express;
