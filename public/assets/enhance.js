/* =====================================================================
   RAUF × LUCIFER MD BOT - enhance.js
   Extra layer on top of site.js (site.js / pair.js are NOT modified and no API call is made here).
   - Animation ON/OFF switch + Level slider (saved in the browser)
   - Keeps the page vertical-only (safety net for horizontal scroll)
   - Scroll-reveal stagger, card tilt, back-to-top, scroll cue, second ticker
   Loaded BEFORE site.js so the OFF mode can also calm the canvas loops.
   ===================================================================== */
(function () {
  'use strict';
  var D = document, R = D.documentElement;
  var KON = 'kob_anim_on', KLV = 'kob_anim_lvl';

  function lsG(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  var OPTK=/^(theme|acc|fx|snd|kob_zoom|srv|kob_iso|kob_ann)$/;function optOk(){try{var j=JSON.parse(localStorage.getItem('rx_consent')||'null');return !!(j&&j.opt===true)}catch(e){return false}} function lsS(k, v) { try { if (OPTK.test(k) && !optOk()) return; localStorage.setItem(k, v); } catch (e) {} }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  var osReduce = false;
  try { osReduce = matchMedia('(prefers-reduced-motion:reduce)').matches; } catch (e) {}

  // weak phones / slow data: start calmer (still one tap to turn everything on)
  var LITE = false;
  try { var nv = navigator, cn = nv.connection || {};
    LITE = !!((nv.deviceMemory && nv.deviceMemory <= 2) || cn.saveData || /^(slow-2g|2g|3g)$/.test(cn.effectiveType || '')); } catch (e) {}
  // (v23) effects and glass stay ON by default; LITE is true only on really weak devices / data-saver
  window.__KOB_LITE = LITE;
  var saved = lsG(KON, null);
  var on = saved === null ? !(osReduce || LITE) : saved === '1';
  var lvl = clamp(parseInt(lsG(KLV, '100'), 10) || 100, 10, 200);

  /* ---- OFF mode: the background canvas loops (site.js) are slowed to ~4 fps so a phone does not burn battery ---- */
  var raf0 = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : null;
  if (raf0) {
    window.requestAnimationFrame = function (cb) {
      if (on) return raf0(cb);
      return setTimeout(function () { cb(performance.now()); }, 250);
    };
  }

  /* ---- speed: every endless CSS animation runs at level/100 (one-shot entrance animations stay normal) ---- */
  function fixAnim(a) {
    try {
      if (window.CSSAnimation && !(a instanceof CSSAnimation)) return;
      var t = a.effect && a.effect.getComputedTiming();
      if (t && t.iterations === Infinity) a.updatePlaybackRate(on ? lvl / 100 : 1);
    } catch (e) {}
  }
  var rateT = 0;
  function applyRate() {
    if (!D.getAnimations) return;
    clearTimeout(rateT);
    rateT = setTimeout(function () { D.getAnimations().forEach(fixAnim); }, 30);
  }
  D.addEventListener('animationstart', function () { if (on && lvl !== 100) applyRate(); }, true);

  /* ---- apply state ---- */
  var ui = {};
  function apply(persist) {
    R.classList.toggle('e-off', !on);
    R.style.setProperty('--fx', String(lvl / 100));
    if (persist) { lsS(KON, on ? '1' : '0'); lsS(KLV, String(lvl)); }
    applyRate();
    if (!ui.sw) return;
    ui.sw.setAttribute('aria-checked', on ? 'true' : 'false');
    ui.sw.firstChild.textContent = on ? 'ON' : 'OFF';
    ui.panel.classList.toggle('dis', !on);
    ui.range.value = lvl; ui.range.disabled = !on;
    ui.range.style.setProperty('--p', ((lvl - 10) / 190 * 100) + '%');
    ui.val.textContent = lvl + '%';
    ui.state.textContent = on ? 'Motion & effects are on' : 'Everything is still';
    [].forEach.call(ui.pre.querySelectorAll('button'), function (b) { b.classList.toggle('on', +b.getAttribute('data-v') === lvl); });
  }
  apply(false);

  /* =========================== UI =========================== */
  var SVG_ON = '<svg class="on" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';
  var SVG_OFF = '<svg class="off" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M3 3l18 18"/></svg>';

  function buildUI() {
    if (D.getElementById('eCtl')) return;
    var c = D.createElement('div'); c.className = 'e-ctl'; c.id = 'eCtl';
    c.innerHTML =
      '<button type="button" class="e-sbtn" id="eSearch" aria-label="Search pages and commands (Ctrl+K)"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></button>' +
      '<button type="button" class="e-top" id="eTop" aria-label="Back to top"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>' +
      '<div class="e-panel" id="ePanel" role="dialog" aria-label="Animation settings" hidden>' +
        '<div class="e-ph"><div><b>Animations</b><small id="eState"></small></div>' +
        '<button type="button" class="e-sw" id="eSw" role="switch" aria-checked="true" aria-label="Animations on or off"><span>ON</span><i></i></button></div>' +
        '<div class="e-lv"><label for="eRange">Animation level</label><output id="eVal" for="eRange">100%</output></div>' +
        '<div class="e-slide"><button type="button" class="e-step" data-d="-10" aria-label="Decrease animation level">&minus;</button>' +
        '<input class="e-range" id="eRange" type="range" min="10" max="200" step="10" value="100" aria-label="Animation level">' +
        '<button type="button" class="e-step" data-d="10" aria-label="Increase animation level">+</button></div>' +
        '<div class="e-pre" id="ePre"><button type="button" data-v="50">Low</button><button type="button" data-v="100">Normal</button><button type="button" data-v="150">High</button><button type="button" data-v="200">Max</button></div>' +
        '<p class="e-note">Level changes how fast and how strong the background motion, glow and scroll effects are.' + (osReduce ? ' Your device is set to reduce motion, so animations start switched off.' : '') + '</p>' +
      '</div>' +
      '<button type="button" class="e-fab" id="eFab" aria-label="Animation settings" aria-expanded="false" aria-controls="ePanel">' + SVG_ON + SVG_OFF + '</button>';
    D.body.appendChild(c);
    ui.panel = D.getElementById('ePanel'); ui.sw = D.getElementById('eSw'); ui.range = D.getElementById('eRange');
    ui.val = D.getElementById('eVal'); ui.state = D.getElementById('eState'); ui.pre = D.getElementById('ePre');
    ui.fab = D.getElementById('eFab'); ui.top = D.getElementById('eTop');

    function open(v) { ui.panel.hidden = !v; ui.fab.setAttribute('aria-expanded', v ? 'true' : 'false'); }
    ui.fab.addEventListener('click', function (e) { e.stopPropagation(); open(ui.panel.hidden); });
    D.addEventListener('click', function (e) { if (!ui.panel.hidden && !c.contains(e.target)) open(false); });
    D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !ui.panel.hidden) { open(false); ui.fab.focus(); } });

    ui.sw.addEventListener('click', function () { on = !on; apply(true); });
    ui.range.addEventListener('input', function () { lvl = clamp(parseInt(ui.range.value, 10) || 100, 10, 200); apply(true); });
    [].forEach.call(c.querySelectorAll('.e-step'), function (b) {
      b.addEventListener('click', function () { lvl = clamp(lvl + parseInt(b.getAttribute('data-d'), 10), 10, 200); apply(true); });
    });
    ui.pre.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; lvl = +b.getAttribute('data-v'); apply(true); });
    ui.top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: on ? 'smooth' : 'auto' }); });
    apply(false);

    if (!D.querySelector('.e-bg')) {
      var bg = D.createElement('div'); bg.className = 'e-bg'; bg.setAttribute('aria-hidden', 'true');
      bg.innerHTML = '<i class="e-grid"></i><i class="e-beam b1"></i><i class="e-beam b2"></i>';
      D.body.insertBefore(bg, D.body.firstChild);
    }
  }

  /* ================= vertical-only safety net ================= */
  var sT = 0;
  function onScroll() {
    if (window.scrollX) window.scrollTo(0, window.scrollY);      // never allow a sideways offset
    var y = window.scrollY || R.scrollTop;
    R.classList.toggle('e-scrolled', y > 80);
    if (ui.top) ui.top.classList.toggle('show', y > 520);
  }
  window.addEventListener('scroll', function () {
    if (sT) return;
    sT = raf0 ? raf0(function () { sT = 0; onScroll(); }) : (setTimeout(function () { sT = 0; onScroll(); }, 16));
  }, { passive: true });
  window.addEventListener('resize', function () { R.scrollLeft = 0; if (D.body) D.body.scrollLeft = 0; }, { passive: true });

  /* ================= per-page enhancements (re-run after every page swap) ================= */
  var GRIDS = '.feat,.tiles,.steps,.stats,.chips,.pvchips,.sup,.qs,.gr';
  var io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var t = e.target; io.unobserve(t);
        t.classList.add('e-in');
        setTimeout(function () { t.classList.remove('e-stg', 'e-in'); }, 1600 + t.children.length * 75);  // hand control back to normal hover styles
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  }

  function enhance(root) {
    root = root || D;
    if (io) [].forEach.call(root.querySelectorAll(GRIDS), function (g) {
      if (g.getAttribute('data-e') || g.closest('.os,.phone,.osslot')) return;
      g.setAttribute('data-e', '1');
      [].forEach.call(g.children, function (c, i) { c.style.setProperty('--i', Math.min(i, 12)); });
      g.classList.add('e-stg'); io.observe(g);
    });

    var hero = root.querySelector ? root.querySelector('.hero.home') : null;
    if (hero && !D.querySelector('.e-cue')) {
      var cue = D.createElement('a'); cue.className = 'e-cue'; cue.href = '#'; cue.setAttribute('aria-label', 'Scroll down');
      cue.innerHTML = '<i></i><span>Scroll</span>';
      cue.addEventListener('click', function (e) {
        e.preventDefault();
        var n = cue.nextElementSibling; if (n && n.scrollIntoView) n.scrollIntoView({ behavior: on ? 'smooth' : 'auto', block: 'start' });
      });
      hero.parentNode.insertBefore(cue, hero.nextSibling);
    }
    var tick = root.querySelector ? root.querySelector('.tick:not(.e-rev)') : null;
    if (tick && !tick.nextElementSibling.classList.contains('e-rev') && tick.firstElementChild) {
      var t2 = tick.cloneNode(true); t2.classList.add('e-rev');
      var inner = t2.firstElementChild, kids = [].slice.call(inner.children).reverse();
      kids.forEach(function (k) { inner.appendChild(k); });
      tick.parentNode.insertBefore(t2, tick.nextSibling);
    }
    initCommands(root); markCopyable(root); markNav();
  }

  /* ================= card tilt + spotlight (mouse only) ================= */
  var tiltRaf = 0, last = null;
  D.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || !on) return;
    var t = e.target.closest && e.target.closest('.tile,.feat div');
    if (!t) return;
    last = { t: t, x: e.clientX, y: e.clientY };
    if (tiltRaf) return;
    tiltRaf = requestAnimationFrame(function () {
      tiltRaf = 0; if (!last) return;
      var b = last.t.getBoundingClientRect(), px = (last.x - b.left) / b.width, py = (last.y - b.top) / b.height, k = 6 * (lvl / 100);
      last.t.style.setProperty('--px', (last.x - b.left) + 'px'); last.t.style.setProperty('--py', (last.y - b.top) + 'px');
      last.t.style.setProperty('--ty', ((px - .5) * k).toFixed(2) + 'deg'); last.t.style.setProperty('--tx', (-(py - .5) * k).toFixed(2) + 'deg');
    });
  }, { passive: true });

  /* ================= helpers: toast, copy, command data ================= */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var toastT;
  function toast(m) {
    var t = D.getElementById('toast'); if (!t) return;
    t.textContent = m; t.classList.add('on'); clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('on'); }, 1800);
  }
  function copyText(txt) {
    var shown = String(txt).trim();
    function done() { toast('Copied ' + shown); }
    function fallback() {
      var a = D.createElement('textarea'); a.value = txt; a.setAttribute('readonly', '');
      a.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
      D.body.appendChild(a); a.select();
      try { D.execCommand('copy'); done(); } catch (e) { toast('Press Ctrl+C to copy'); }
      a.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
  }
  window.KOBX = { copy: copyText, toast: toast };   // used by enhance2.js
  var cmdWait = [];
  function loadCmds(cb) {
    if (window.KOB_CMDS) return cb(window.KOB_CMDS);
    cmdWait.push(cb);
    if (cmdWait.length > 1) return;
    var s = D.createElement('script'); s.src = '/assets/commands-data.js';
    s.onload = function () { var w = cmdWait.splice(0); w.forEach(function (f) { f(window.KOB_CMDS || null); }); };
    s.onerror = function () { var w = cmdWait.splice(0); w.forEach(function (f) { f(null); }); };
    D.head.appendChild(s);
  }

  /* tap-to-copy: any [data-copy] button, and inline command snippets like .menu */
  D.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-copy]');
    if (t) {
      e.preventDefault(); copyText(t.getAttribute('data-copy'));
      t.classList.add('copied'); setTimeout(function () { t.classList.remove('copied'); }, 1100);
      return;
    }
    var c = e.target.closest && e.target.closest('#app code.cp');
    if (c) copyText(c.textContent.trim());
  });
  function markCopyable(root) {
    [].forEach.call((root.querySelectorAll ? root : D).querySelectorAll('#app code, code'), function (c) {
      if (c.classList.contains('cp') || !c.closest('#app') || c.closest('pre,[data-copy],.cm-it,.try-c,.codebox')) return;
      var tx = c.textContent.trim();
      if (/^[.!#\/][a-z0-9_-]+(\s[^<>]*)?$/i.test(tx) && tx.length < 40) { c.classList.add('cp'); c.title = 'Tap to copy'; }
    });
  }

  /* ================= Commands page: search + categories ================= */
  function initCommands(root) {
    var list = root.querySelector && root.querySelector('#cml');
    if (!list || list.getAttribute('data-e')) return;
    list.setAttribute('data-e', '1');
    loadCmds(function (data) {
      if (!data) { list.innerHTML = '<p class="cm-empty">Could not load the list. Open the <a href="/docs" data-nav>Docs page</a> instead.</p>'; return; }
      var q = D.getElementById('cmq'), cats = D.getElementById('cmc'), cnt = D.getElementById('cmn'), more = D.getElementById('cmm'), cur = 'all';
      if (!q || !cats) return;
      cats.innerHTML = '<button type="button" class="cm-chip on" data-k="all">All <em>' + data.total + '</em></button>' +
        data.groups.map(function (g, i) { return '<button type="button" class="cm-chip" data-k="' + i + '">' + g.i + ' ' + esc(g.c) + ' <em>' + g.items.length + '</em></button>'; }).join('');
      if (more) more.hidden = false;
      try { var pre = sessionStorage.getItem('kob_cmq'); if (pre) { q.value = pre; sessionStorage.removeItem('kob_cmq'); } } catch (e) {}
      function render() {
        var term = q.value.trim().toLowerCase().replace(/^[.!#\/]/, ''), html = '', n = 0;
        data.groups.forEach(function (g, i) {
          if (cur !== 'all' && +cur !== i) return;
          var its = g.items.filter(function (it) {
            return !term || it.n.indexOf(term) > -1 || (it.d && it.d.toLowerCase().indexOf(term) > -1) || g.c.toLowerCase().indexOf(term) > -1;
          });
          if (!its.length) return;
          n += its.length;
          html += '<section class="cm-grp"><h2>' + g.i + ' ' + esc(g.c) + ' <em>' + its.length + '</em></h2><div class="cm-grid">' +
            its.map(function (it) {
              return '<button type="button" class="cm-it" data-copy=".' + esc(it.n) + (it.u ? ' ' : '') + '"><b>.' + esc(it.n) + '</b>' +
                (it.d ? '<span>' + esc(it.d) + '</span>' : '') + (it.u ? '<code>' + esc(it.u) + '</code>' : '') + '</button>';
            }).join('') + '</div></section>';
        });
        list.innerHTML = html || '<p class="cm-empty">No command matches &ldquo;' + esc(q.value.trim()) + '&rdquo;. Try a shorter word, or ask the <a href="/ai" data-nav>AI Support Center</a>.</p>';
        if (cnt) cnt.textContent = (n === data.total ? data.total + ' commands' : 'Showing ' + n + ' of ' + data.total);
      }
      q.addEventListener('input', render);
      q.addEventListener('keydown', function (e) { if (e.key === 'Escape' && q.value) { q.value = ''; render(); } });
      cats.addEventListener('click', function (e) {
        var b = e.target.closest('.cm-chip'); if (!b) return;
        cur = b.getAttribute('data-k');
        [].forEach.call(cats.querySelectorAll('.cm-chip'), function (x) { x.classList.toggle('on', x === b); });
        render();
      });
      if (more) more.addEventListener('click', function () {
        var c = cats.classList.toggle('collapsed'); more.textContent = c ? 'All categories' : 'Fewer categories';
      });
      render();
    });
  }

  /* ================= search palette (Ctrl/Cmd+K, "/" or the search button) ================= */
  var PAGES = [['🏠', 'Home', '/', 'Overview, features and live demo'], ['🔗', 'Link WhatsApp', '/pair', 'Get your pairing code'],
    ['🛠️', 'Create Bot', '/create', 'Your own name, logo and links'], ['📱', 'Preview', '/preview', 'Try the bot on a virtual phone'],
    ['🤖', 'AI Support', '/ai', 'Ask anything or paste an error'], ['📘', 'Learn', '/learn', 'Short guides for common tasks'],
    ['⌨️', 'Commands', '/commands', 'Search featured commands'], ['📄', 'Docs', '/docs', 'Full documentation'], ['💬', 'Support', '/support', 'Email, Telegram and WhatsApp']];
  var POP = ['menu', 'ping', 'sticker', 'play', 'tiktok', 'gpt', 'tagall'];
  var pal = null, palSel = 0, palItems = [], palLast = null;
  function goTo(p) {
    var a = D.createElement('a'); a.href = p; a.setAttribute('data-nav', ''); a.style.display = 'none';
    D.body.appendChild(a); a.click(); a.remove();
  }
  function palClose() { if (!pal || pal.hidden) return; pal.hidden = true; if (palLast && palLast.focus) try { palLast.focus(); } catch (e) {} }
  function palRender() {
    var inp = D.getElementById('palq'), term = inp.value.trim().toLowerCase().replace(/^[.!#\/]/, ''), out = '', n = 0;
    palItems = [];
    function row(ic, title, sub, hint, type, val) {
      palItems.push({ type: type, val: val });
      return '<button type="button" class="pal-it" role="option" id="po' + (n) + '" data-i="' + (n++) + '"><i>' + ic + '</i><span><b>' + esc(title) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span><em>' + hint + '</em></button>';
    }
    var pg = PAGES.filter(function (p) { return !term || (p[1] + ' ' + p[3]).toLowerCase().indexOf(term) > -1; });
    if (term) pg = pg.map(function (p, i) { return [p, i]; }).sort(function (a, b) {
      var ra = a[0][1].toLowerCase().indexOf(term) === 0 ? 0 : 1, rb = b[0][1].toLowerCase().indexOf(term) === 0 ? 0 : 1;
      return ra - rb || a[1] - b[1];
    }).map(function (x) { return x[0]; });
    if (pg.length) out += '<div class="pal-h">Pages</div>' + pg.map(function (p) { return row(p[0], p[1], p[3], 'Open', 'page', p[2]); }).join('');
    var data = window.KOB_CMDS, cm = [];
    if (data) data.groups.forEach(function (g) {
      g.items.forEach(function (it) {
        if (term ? (it.n.indexOf(term) > -1 || (it.d && it.d.toLowerCase().indexOf(term) > -1)) : POP.indexOf(it.n) > -1) cm.push([it, g]);
      });
    });
    if (term) cm.sort(function (a, b) { return (a[0].n.indexOf(term) === 0 ? 0 : 1) - (b[0].n.indexOf(term) === 0 ? 0 : 1) || a[0].n.length - b[0].n.length; });
    var total = cm.length; cm = cm.slice(0, 30);
    if (cm.length) out += '<div class="pal-h">' + (term ? 'Commands' : 'Popular commands') + '</div>' +
      cm.map(function (c) { return row('\u203A', '.' + c[0].n + (c[0].u ? c[0].u.replace(/^\.\S+/, '') : ''), c[0].d || c[1].c, 'Copy', 'cmd', c[0].n); }).join('');
    if (term && total > 30) out += '<div class="pal-h">' + (total - 30) + ' more on the Commands page</div>' + row('⌨️', 'See all matches for “' + term + '”', '', 'Open', 'all', term);
    if (!out) out = '<div class="pal-empty">Nothing found for “' + esc(term) + '”. Try another word.</div>';
    D.getElementById('pall').innerHTML = out; palSel = 0; palMark();
  }
  function palMark() {
    var els = D.querySelectorAll('#pall .pal-it');
    [].forEach.call(els, function (el, i) { el.setAttribute('aria-selected', i === palSel ? 'true' : 'false'); });
    var cur = els[palSel]; if (cur) { D.getElementById('palq').setAttribute('aria-activedescendant', cur.id); if (cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' }); }
  }
  function palPick(i) {
    var it = palItems[i]; if (!it) return;
    palClose();
    if (it.type === 'page') goTo(it.val);
    else if (it.type === 'cmd') copyText('.' + it.val);
    else { try { sessionStorage.setItem('kob_cmq', it.val); } catch (e) {} goTo('/commands'); }
  }
  function palOpen() {
    if (!pal) {
      pal = D.createElement('div'); pal.className = 'pal'; pal.id = 'pal'; pal.hidden = true;
      pal.innerHTML = '<div class="pal-bg"></div><div class="pal-box" role="dialog" aria-modal="true" aria-label="Search pages and commands">' +
        '<div class="pal-in"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
        '<input id="palq" type="text" role="combobox" aria-expanded="true" aria-controls="pall" aria-autocomplete="list" placeholder="Search pages and commands" autocomplete="off" autocapitalize="off" spellcheck="false"><kbd>Esc</kbd></div>' +
        '<div class="pal-l" id="pall" role="listbox"></div><div class="pal-f"><span>&uarr;&darr; move</span><span>Enter select</span><span>Esc close</span></div></div>';
      D.body.appendChild(pal);
      pal.querySelector('.pal-bg').addEventListener('click', palClose);
      var inp = D.getElementById('palq');
      inp.addEventListener('input', palRender);
      inp.addEventListener('keydown', function (e) {
        var n = palItems.length;
        if (e.key === 'ArrowDown') { e.preventDefault(); palSel = n ? (palSel + 1) % n : 0; palMark(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = n ? (palSel - 1 + n) % n : 0; palMark(); }
        else if (e.key === 'Enter') { e.preventDefault(); palPick(palSel); }
        else if (e.key === 'Escape') { e.preventDefault(); palClose(); }
      });
      D.getElementById('pall').addEventListener('click', function (e) { var b = e.target.closest('.pal-it'); if (b) palPick(+b.getAttribute('data-i')); });
      D.getElementById('pall').addEventListener('mousemove', function (e) { var b = e.target.closest('.pal-it'); if (b && +b.getAttribute('data-i') !== palSel) { palSel = +b.getAttribute('data-i'); palMark(); } });
    }
    palLast = D.activeElement; pal.hidden = false;
    var inp2 = D.getElementById('palq'); inp2.value = ''; palRender(); inp2.focus();
    if (!window.KOB_CMDS) loadCmds(function () { if (!pal.hidden) palRender(); });
  }
  function initPalette() {
    D.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '') || (e.target && e.target.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (pal && !pal.hidden) palClose(); else palOpen(); }
      else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); palOpen(); }
    });
    var b = D.getElementById('eSearch'); if (b) b.addEventListener('click', function (e) { e.stopPropagation(); palOpen(); });
  }

  /* ================= skip link + current-page marker ================= */
  function initSkip() {
    if (D.querySelector('.skip')) return;
    var a = D.createElement('a'); a.className = 'skip'; a.href = '#app'; a.textContent = 'Skip to content';
    a.addEventListener('click', function (e) { e.preventDefault(); var m = D.getElementById('app'); if (m) { m.setAttribute('tabindex', '-1'); m.focus(); } });
    D.body.insertBefore(a, D.body.firstChild);
  }
  function markNav() {
    [].forEach.call(D.querySelectorAll('nav .links a, .drawer a'), function (a) {
      if (a.classList.contains('on')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  /* ================= start ================= */
  function start() {
    buildUI(); initSkip(); initPalette(); enhance(D); onScroll();
    var app = D.getElementById('app');
    if (app && 'MutationObserver' in window) {
      var mt = 0;
      new MutationObserver(function () { clearTimeout(mt); mt = setTimeout(function () { enhance(app); window.scrollTo(0, window.scrollY); }, 40); })
        .observe(app, { childList: true });
    }
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', start); else start();
})();
