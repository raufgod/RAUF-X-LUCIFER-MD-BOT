/* =====================================================================
   RAUF × LUCIFER MD BOT - enhance2.js
   Second extra layer (site.js / pair.js / API code are NOT modified).
   Stability : offline + server notice, error guard, offline cache (service worker), install as app
   Visitors  : favourites + recent commands, command of the day, shortcuts (?), reading bar,
               text size, share, pairing helpers (checklist, paste, open WhatsApp), expand/collapse all, copy on code blocks
   ===================================================================== */
(function () {
  'use strict';
  var D = document, R = D.documentElement;
  var INLINE = !!window.__INLINE || location.protocol === 'file:';

  function lsG(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  var OPTK=/^(theme|acc|fx|snd|kob_zoom|srv|kob_iso|kob_ann)$/;function optOk(){try{var j=JSON.parse(localStorage.getItem('rx_consent')||'null');return !!(j&&j.opt===true)}catch(e){return false}} function lsS(k, v) { try { if (OPTK.test(k) && !optOk()) return; localStorage.setItem(k, v); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function jget(k) { try { var v = JSON.parse(lsG(k, '[]')); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function $(id) { return D.getElementById(id); }
  function page() { return D.body ? D.body.getAttribute('data-page') || '' : ''; }
  function say(m) { if (window.KOBX && KOBX.toast) KOBX.toast(m); }
  function copy(t) { if (window.KOBX && KOBX.copy) KOBX.copy(t); else if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { say('Copied'); }); }
  function typing(t) { return t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); }
  function goTo(p) {
    var a = D.createElement('a'); a.href = p; a.setAttribute('data-nav', ''); a.style.display = 'none';
    D.body.appendChild(a); a.click(); a.remove();
  }

  /* ============ 1. reading progress bar ============ */
  function initProgress() {
    if (D.querySelector('.e2-prog')) return;
    var p = D.createElement('div'); p.className = 'e2-prog'; p.setAttribute('aria-hidden', 'true'); D.body.appendChild(p);
    var t = 0;
    function upd() {
      t = 0;
      var h = R.scrollHeight - window.innerHeight, y = window.scrollY || R.scrollTop;
      p.style.transform = 'scaleX(' + (h > 40 ? Math.min(1, Math.max(0, y / h)) : 0) + ')';
    }
    window.addEventListener('scroll', function () { if (!t) t = setTimeout(upd, 30); }, { passive: true });
    window.addEventListener('resize', upd, { passive: true });
    upd();
  }

  /* ============ 2. connection + server notice ============ */
  var bar = null, offline = false, srvDown = false, srvState = 'checking';
  function showBar(html, cls) {
    if (!bar) { bar = D.createElement('div'); bar.className = 'e2-bar'; bar.setAttribute('role', 'status'); bar.setAttribute('aria-live', 'polite'); D.body.appendChild(bar); }
    bar.className = 'e2-bar on ' + (cls || ''); bar.innerHTML = html;
  }
  function hideBar() { if (bar) bar.classList.remove('on'); }
  function refreshBar() {
    if (offline) showBar('<b>You are offline.</b> <span>Saved pages still open. Pairing and AI need internet.</span>', 'warn');
    else if (srvDown && /^(pair|create|ai|preview)$/.test(page())) showBar('<b>Can’t reach the bot server.</b> <span>Retrying automatically…</span><button type="button" data-e2="retry">Try now</button>', 'warn');
    else hideBar();
  }
  function setSrv(s) {
    srvState = s;
    var d = $('e2Srv'); if (d) { d.setAttribute('data-s', s); d.querySelector('span').textContent = s === 'up' ? 'Bot server is online' : s === 'down' ? 'Bot server not reachable' : s === 'off' ? 'You are offline' : 'Checking server…'; }
  }
  var fails = 0;
  function checkServer() {
    if (INLINE) { setSrv('up'); return; }
    if (!navigator.onLine) { setSrv('off'); return; }
    var ctl = ('AbortController' in window) ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 7000);
    fetch((window.PAIR_API_BASE || '') + '/api/health', { headers: { 'ngrok-skip-browser-warning': '1' }, cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (j) { clearTimeout(to); if (j && j.ok) { fails = 0; srvDown = false; setSrv('up'); } else throw 0; })
      .catch(function () { clearTimeout(to); if (++fails >= 2) { srvDown = true; setSrv('down'); } else setTimeout(checkServer, 4000); })
      .then(refreshBar);
  }
  function initConn() {
    offline = !navigator.onLine;
    window.addEventListener('offline', function () { offline = true; setSrv('off'); refreshBar(); });
    window.addEventListener('online', function () { offline = false; fails = 1; say('Back online'); refreshBar(); checkServer(); });
    D.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-e2=retry]')) { fails = 1; checkServer(); say('Checking…'); } });
    D.addEventListener('visibilitychange', function () { if (!D.hidden) checkServer(); });
    setInterval(function () { if (!D.hidden) checkServer(); }, 45000);
    refreshBar(); setTimeout(checkServer, 1200);
  }

  /* ============ 3. error guard (quiet: only after repeated errors) ============ */
  var errAt = [], errShown = 0;
  function onErr(ev) {
    try {
      var f = ev && ev.filename || '';
      if (/extension:\/\//.test(f)) return;
      if (ev && !ev.error && /Script error|ResizeObserver/i.test(ev.message || '')) return;
      var n = Date.now(); errAt.push(n); errAt = errAt.filter(function (x) { return n - x < 15000; });
      if (errAt.length < 3 || n - errShown < 60000) return;
      errShown = n;
      showBar('<b>Something on this page went wrong.</b> <span>Reloading usually fixes it.</span><button type="button" data-e2="reload">Reload</button>', 'err');
      setTimeout(refreshBar, 12000);
    } catch (e) {}
  }
  function initGuard() {
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', function () { onErr({ message: 'promise' }); });
    D.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-e2=reload]')) location.reload(); });
  }

  /* ============ 4. offline cache + install as app ============ */
  var deferred = null;
  function initPWA() {
    if (INLINE) return;
    if (!D.querySelector('link[rel=manifest]')) {
      var m = D.createElement('link'); m.rel = 'manifest'; m.href = '/manifest.webmanifest'; D.head.appendChild(m);
      var a = D.createElement('link'); a.rel = 'apple-touch-icon'; a.href = '/assets/icon-192.png'; D.head.appendChild(a);
    }
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
    }
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; var b = $('e2Inst'); if (b) b.hidden = false; });
    window.addEventListener('appinstalled', function () { deferred = null; var b = $('e2Inst'); if (b) b.hidden = true; say('App installed'); });
  }
  function isStandalone() { try { return matchMedia('(display-mode:standalone)').matches || navigator.standalone; } catch (e) { return false; } }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream; }

  /* ============ 5. extra section in the settings panel ============ */
  function initPanel() {
    var p = $('ePanel'); if (!p || $('e2Sec')) return;
    var z = parseFloat(lsG('kob_zoom', '1')) || 1; if ([1, 1.12, 1.25].indexOf(z) < 0) z = 1;
    var s = D.createElement('div'); s.className = 'e2-sec'; s.id = 'e2Sec';
    s.innerHTML =
      '<div class="e2-h">Text size</div><div class="e2-seg" id="e2Z"><button type="button" data-z="1">Normal</button><button type="button" data-z="1.12">Large</button><button type="button" data-z="1.25">Huge</button></div>' +
      '<div class="e2-h">Quick actions</div><div class="e2-act">' +
      '<button type="button" id="e2Share">Share page</button><button type="button" id="e2Inst" hidden>Install app</button><button type="button" id="e2Keys">Shortcuts</button></div>' +
      '<div class="e2-srv" id="e2Srv" data-s="checking"><i></i><span>Checking server…</span></div>';
    p.appendChild(s);
    function setZ(v) {
      z = v; R.style.setProperty('--e2z', String(v)); lsS('kob_zoom', String(v));
      [].forEach.call(s.querySelectorAll('[data-z]'), function (b) { b.classList.toggle('on', +b.getAttribute('data-z') === v); });
    }
    setZ(z);
    $('e2Z').addEventListener('click', function (e) { var b = e.target.closest('[data-z]'); if (b) setZ(+b.getAttribute('data-z')); });
    $('e2Share').addEventListener('click', function () {
      var u = location.href.replace(/#.*$/, ''), d = { title: D.title, url: u };
      if (navigator.share) navigator.share(d).catch(function () {}); else copy(u);
    });
    $('e2Keys').addEventListener('click', function () { var c = $('eFab'); if (c) c.click(); help(true); });
    var ib = $('e2Inst');
    if (isStandalone()) ib.hidden = true;
    else if (deferred || isIOS()) ib.hidden = false;
    ib.addEventListener('click', function () {
      if (deferred) { deferred.prompt(); deferred.userChoice.then(function () { deferred = null; ib.hidden = true; }); }
      else say('Tap Share, then Add to Home Screen');
    });
    setSrv(srvState);
  }
  (function applyZoomEarly() { var z = parseFloat(lsG('kob_zoom', '1')); if (z === 1.12 || z === 1.25) R.style.setProperty('--e2z', String(z)); })();

  /* ============ 6. keyboard shortcuts + help ============ */
  var helpEl = null, gKey = 0;
  function help(v) {
    if (!helpEl) {
      helpEl = D.createElement('div'); helpEl.className = 'e2-help'; helpEl.hidden = true; helpEl.setAttribute('role', 'dialog'); helpEl.setAttribute('aria-label', 'Keyboard shortcuts');
      helpEl.innerHTML = '<div class="e2-card"><div class="e2-hh"><b>Shortcuts</b><button type="button" aria-label="Close" data-e2="x">×</button></div><ul>' +
        [['Ctrl K or /', 'Search pages and commands'], ['?', 'Show this help'], ['G then H', 'Home'], ['G then P', 'Link WhatsApp'], ['G then C', 'Commands'], ['G then D', 'Docs'], ['G then L', 'Learn'], ['G then S', 'Support'], ['T', 'Back to top'], ['A', 'Animations on / off'], ['S', 'Style Studio (themes, effects)']]
          .map(function (r) { return '<li><kbd>' + r[0] + '</kbd><span>' + r[1] + '</span></li>'; }).join('') + '</ul></div>';
      helpEl.addEventListener('click', function (e) { if (e.target === helpEl || (e.target.closest && e.target.closest('[data-e2=x]'))) help(false); });
      D.body.appendChild(helpEl);
    }
    helpEl.hidden = !v;
  }
  function initKeys() {
    D.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && helpEl && !helpEl.hidden) { help(false); return; }
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      var k = e.key;
      if (k === '?') { e.preventDefault(); help(!(helpEl && !helpEl.hidden)); return; }
      if (gKey) {
        var map = { h: '/', p: '/pair', c: '/commands', d: '/docs', l: '/learn', s: '/support' }, to = map[k.toLowerCase()];
        clearTimeout(gKey); gKey = 0; if (to) { e.preventDefault(); goTo(to); } return;
      }
      if (k === 'g' || k === 'G') { gKey = setTimeout(function () { gKey = 0; }, 1200); return; }
      if (k === 't' || k === 'T') window.scrollTo({ top: 0, behavior: R.classList.contains('e-off') ? 'auto' : 'smooth' });
      if (k === 'a' || k === 'A') { var sw = $('eSw'); if (sw) sw.click(); }
    });
  }

  /* ============ 7. favourites + recent commands ============ */
  var KFAV = 'kob_favs', KREC = 'kob_recent';
  function favs() { return jget(KFAV); }
  function cmdName(el) { return (el.getAttribute('data-copy') || '').trim().replace(/^\./, ''); }
  function addRecent(c) {
    if (!/^[a-z0-9_-]+$/i.test(c)) return;
    var r = jget(KREC).filter(function (x) { return x !== c; }); r.unshift(c); lsS(KREC, JSON.stringify(r.slice(0, 8)));
  }
  D.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-copy]');
    if (!t) return;
    var m = (t.getAttribute('data-copy') || '').trim().match(/^\.([a-z0-9_-]+)/i);
    if (m && D.getElementById('cml')) { addRecent(m[1]); setTimeout(function () { renderMine(); }, 0); }
  });
  D.addEventListener('click', function (e) {          // capture: a star tap must not copy the command
    var st = e.target.closest && e.target.closest('.e2-star'); if (!st) return;
    e.stopPropagation(); e.preventDefault();
    var b = st.parentNode, c = cmdName(b), f = favs(), i = f.indexOf(c);
    if (i > -1) { f.splice(i, 1); say('Removed from favourites'); } else { f.unshift(c); say('Saved to favourites'); }
    lsS(KFAV, JSON.stringify(f)); decorate(); renderMine();
  }, true);
  D.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('e2-star')) { e.preventDefault(); e.target.click(); }
  });
  function decorate() {
    var f = favs();
    [].forEach.call(D.querySelectorAll('#cml .cm-it'), function (b) {
      var c = cmdName(b), on = f.indexOf(c) > -1, s = b.querySelector('.e2-star');
      if (!s) { s = D.createElement('span'); s.className = 'e2-star'; s.setAttribute('role', 'button'); s.tabIndex = 0; b.appendChild(s); }
      s.textContent = on ? '★' : '☆'; s.setAttribute('aria-label', (on ? 'Remove ' : 'Save ') + '.' + c + (on ? ' from favourites' : ' to favourites'));
      b.classList.toggle('is-fav', on);
    });
  }
  var onlyFav = false;
  function renderMine() {
    var list = $('cml'); if (!list) return;
    var box = $('e2mine');
    if (!box) { box = D.createElement('div'); box.id = 'e2mine'; list.parentNode.insertBefore(box, list); }
    var f = favs(), r = jget(KREC).filter(function (x) { return f.indexOf(x) < 0; }), h = '';
    function chips(a) { return a.map(function (c) { return '<button type="button" class="e2-chip" data-copy=".' + esc(c) + '">.' + esc(c) + '</button>'; }).join(''); }
    if (f.length) h += '<div class="e2-row"><b>★ Favourites</b>' + chips(f) + '<button type="button" class="e2-lnk" data-e2="onlyfav">' + (onlyFav ? 'Show all' : 'Only these') + '</button></div>';
    if (r.length) h += '<div class="e2-row"><b>⏱ Recent</b>' + chips(r) + '<button type="button" class="e2-lnk" data-e2="clrrec">Clear</button></div>';
    if (!f.length) { onlyFav = false; }
    box.innerHTML = h; box.hidden = !h;
    list.classList.toggle('e2-onlyfav', onlyFav && f.length > 0);
    if (!h && !D.querySelector('#cml .cm-empty') && !jget(KFAV).length) { /* nothing yet */ }
  }
  D.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-e2]'); if (!b) return;
    var k = b.getAttribute('data-e2');
    if (k === 'onlyfav') { onlyFav = !onlyFav; renderMine(); }
    if (k === 'clrrec') { lsS(KREC, '[]'); renderMine(); }
  });
  function initFavs(root) {
    var list = $('cml'); if (!list) return;
    if (!list.getAttribute('data-e2')) {
      list.setAttribute('data-e2', '1');
      new MutationObserver(function () { decorate(); }).observe(list, { childList: true });
      var tip = D.createElement('p'); tip.className = 'e2-tip'; tip.textContent = 'Tip: tap the star on a command to keep it in your favourites.';
      list.parentNode.insertBefore(tip, list);
    }
    decorate(); renderMine();
  }

  /* ============ 8. command of the day (home) ============ */
  function initCotd(root) {
    var host = root.querySelector && root.querySelector('#tryfirst'); if (!host || host.querySelector('.e2-cotd')) return;
    function build(data) {
      if (!data || host.querySelector('.e2-cotd')) return;
      var all = []; data.groups.forEach(function (g) { g.items.forEach(function (it) { if (it.d) all.push(it); }); });
      if (!all.length) return;
      var it = all[Math.floor(Date.now() / 86400000) % all.length];
      var box = D.createElement('div'); box.className = 'e2-cotd';
      box.innerHTML = '<span class="e2-k">Command of the day</span><b>.' + esc(it.n) + '</b><span class="e2-d">' + esc(it.d) + '</span><button type="button" data-copy=".' + esc(it.n) + (it.u ? ' ' : '') + '">Copy</button>';
      var sub = host.querySelector('.sub'); (sub || host.firstChild).insertAdjacentElement('afterend', box);
    }
    if (window.KOB_CMDS) return build(window.KOB_CMDS);
    var s = D.createElement('script'); s.src = '/assets/commands-data.js'; s.onload = function () { build(window.KOB_CMDS); }; D.head.appendChild(s);
  }

  /* ============ 9. pairing page helpers ============ */
  function initPair(root) {
    var form = root.querySelector && root.querySelector('#formCard'); if (!form || form.getAttribute('data-e2')) return;
    form.setAttribute('data-e2', '1');
    var chk = D.createElement('details'); chk.className = 'e2-chk';
    var items = ['WhatsApp is updated to the latest version', 'You have fewer than 4 linked devices (WhatsApp allows 4)', 'Your number is typed without the country code or a leading 0', 'Your internet connection is stable'];
    chk.innerHTML = '<summary>Before you start <em>4 quick checks</em></summary><div>' + items.map(function (t, i) {
      return '<label class="e2-ck"><input type="checkbox" id="e2c' + i + '"><span>' + t + '</span></label>';
    }).join('') + '</div>';
    form.parentNode.insertBefore(chk, form);
    var hint = form.querySelector('.hint'), num = $('num');
    if (hint && num) {
      var pb = D.createElement('button'); pb.type = 'button'; pb.className = 'e2-paste'; pb.textContent = 'Paste number';
      pb.addEventListener('click', function () {
        if (!navigator.clipboard || !navigator.clipboard.readText) { say('Long-press the box and choose Paste'); num.focus(); return; }
        navigator.clipboard.readText().then(function (t) {
          var d = String(t || '').replace(/\D/g, ''), dial = (($('cdial') || {}).textContent || '').replace(/\D/g, '');
          if (dial && d.indexOf(dial) === 0 && d.length > dial.length + 6) d = d.slice(dial.length);
          d = d.replace(/^0+/, '').slice(0, 15);
          if (!d) { say('No number found in the clipboard'); return; }
          num.value = d; num.dispatchEvent(new Event('input', { bubbles: true })); num.focus(); say('Number pasted');
        }).catch(function () { say('Long-press the box and choose Paste'); num.focus(); });
      });
      hint.parentNode.insertBefore(pb, hint.nextSibling);
    }
    var cc = $('codeCard');
    if (cc && !cc.querySelector('.e2-wab')) {
      var ua = navigator.userAgent, and = /android/i.test(ua), ios = /iphone|ipad|ipod/i.test(ua);
      var note = D.createElement('p'); note.className = 'e2-wan';
      note.innerHTML = 'Check your phone: WhatsApp shows <b>\u201CEnter code to link new device\u201D</b>. Tap it, or open the app below.';
      var cb = $('copy');
      if (cb) cb.parentNode.insertBefore(note, cb.nextSibling);
      if (and || ios) {
        var box = D.createElement('div'); box.className = 'e2-wab';
        var L = [['Open WhatsApp', and ? 'intent://send/#Intent;scheme=whatsapp;package=com.whatsapp;end' : 'whatsapp://'],
                 ['Open WhatsApp Business', and ? 'intent://send/#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end' : 'whatsapp-smb://']];
        box.innerHTML = L.map(function (l) { return '<a class="e2-wa" href="' + l[1] + '" rel="noopener">' + l[0] + '</a>'; }).join('');
        box.addEventListener('click', function () {      // copy the code first so it can be pasted inside WhatsApp
          var c = ($('code') || {}).textContent || ''; c = c.replace(/[^A-Za-z0-9]/g, '');
          if (c.length >= 8) copy(c);
        });
        note.parentNode.insertBefore(box, note.nextSibling);
      }
    }
  }

  /* ============ 10. docs-style pages: expand / collapse all + copy on code blocks ============ */
  function initDocs(root) {
    if (!/^(docs|learn)$/.test(page())) return;
    var ds = root.querySelectorAll ? root.querySelectorAll('details') : [];
    if (ds.length >= 4 && !root.querySelector('.e2-xp')) {
      var bx = D.createElement('div'); bx.className = 'e2-xp';
      bx.innerHTML = '<button type="button" data-x="1">Expand all</button><button type="button" data-x="0">Collapse all</button>';
      bx.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        [].forEach.call(D.querySelectorAll('#app details'), function (d) { d.open = b.getAttribute('data-x') === '1'; });
      });
      var f = ds[0]; f.parentNode.insertBefore(bx, f);
    }
  }
  function initPre(root) {
    [].forEach.call((root.querySelectorAll ? root : D).querySelectorAll('#app pre:not(.lg)'), function (p) {
      if (p.getAttribute('data-e2')) return; p.setAttribute('data-e2', '1');
      p.classList.add('e2-pre');
      var b = D.createElement('button'); b.type = 'button'; b.className = 'e2-cpb'; b.textContent = 'Copy'; b.setAttribute('aria-label', 'Copy this code');
      b.addEventListener('click', function () { copy(p.textContent.replace(/Copy$/, '').trim()); });
      p.appendChild(b);
    });
  }

  /* ============ run ============ */
  function enhance2(root) {
    initPanel(); initFavs(root); initCotd(root); initPair(root); initDocs(root); initPre(root);
  }
  function start() {
    initProgress(); initConn(); initGuard(); initPWA(); initKeys();
    enhance2(D);
    var app = $('app');
    if (app && 'MutationObserver' in window) {
      var mt = 0;
      new MutationObserver(function () { clearTimeout(mt); mt = setTimeout(function () { enhance2(app); refreshBar(); }, 80); }).observe(app, { childList: true });
    }
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', start); else start();
})();
