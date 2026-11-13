/* v23: fixed bottom dock (Home, Link device, Preview, AI Support) + the "..." menu (pages, theme, sound, animations). Old floating controls are hidden and driven from here. */
(function () {
  'use strict';
  var D = document, B = D.body, R = D.documentElement;
  if (!B || D.getElementById('ibar')) return;
  function $(s, r) { return (r || D).querySelector(s); }
  function btn(label) { return $('button[aria-label="' + label + '"]'); }

  /* ---------- dock (appended to <html>, so no transformed ancestor can un-fix it) ---------- */
  var T = [
    ['home', '/', 'Home', 'M4 11 12 4l8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z'],
    ['pair', '/pair', 'Link device', 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1'],
    ['preview', '/preview', 'Preview', 'M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2'],
    ['ai', '/ai', 'AI Support', 'M7 8h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3zM12 4v4M9 14h.01M15 14h.01']
  ];
  var bar = D.createElement('div'); bar.id = 'ibar'; bar.className = 'ibar';
  var inner = '<div class="ibw"><div class="ibc" role="navigation" aria-label="Main"><i class="ind" aria-hidden="true"></i>';
  T.forEach(function (t) { inner += '<a href="' + t[1] + '" data-nav data-tab="' + t[0] + '" aria-label="' + t[2] + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + t[3] + '"/></svg><span>' + t[2] + '</span></a>'; });
  inner += '</div><button type="button" class="ibs" id="ibs" aria-label="Search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></button></div>';
  bar.innerHTML = inner;
  R.appendChild(bar);
  var tg = $('.ibc', bar), ind = $('.ind', bar), links = [].slice.call(bar.querySelectorAll('a'));
  var cur = 0;
  function setI(i, anim) {
    ind.classList.toggle('none', i < 0);
    if (i >= 0) { cur = i; tg.style.setProperty('--i', i); ind.style.setProperty('--i', i); }
    links.forEach(function (a, j) { a.classList.toggle('on', j === i); if (j === i) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (anim && i >= 0) { ind.classList.remove('go'); void ind.offsetWidth; ind.classList.add('go'); }
  }
  function sync() { var p = B.getAttribute('data-page') || 'home', idx = -1; R.classList.toggle('fs', p === 'preview' || p === 'ai'); T.forEach(function (t, i) { if (t[0] === p) idx = i; }); setI(idx, false); }
  sync();
  new MutationObserver(sync).observe(B, { attributes: true, attributeFilter: ['data-page'] });
  bar.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[data-tab]'); if (a) setI(links.indexOf(a), true); });
  $('#ibs', bar).addEventListener('click', function () { var s = $('#eSearch'); if (s) s.click(); });

  /* drag the glass bubble with a finger / mouse: it swells, follows, and opens the tab it lands on */
  (function () {
    var down = false, moved = false, x0 = 0, w = 1, left = 0, pid = null;
    function frac(x) { var f = (x - left - 4) / ((w - 8) / 4) - 0.5; return Math.max(0, Math.min(3, f)); }
    tg.addEventListener('pointerdown', function (e) {
      if (e.button) return; var r = tg.getBoundingClientRect(); w = r.width; left = r.left; down = true; moved = false; x0 = e.clientX; pid = e.pointerId;
    });
    tg.addEventListener('pointermove', function (e) {
      if (!down) return;
      if (!moved && Math.abs(e.clientX - x0) > 6) { moved = true; tg.classList.add('drag'); ind.classList.remove('none', 'go'); try { tg.setPointerCapture(pid); } catch (x) {} ind.style.transition = 'none'; }
      if (moved) { var f = frac(e.clientX); ind.style.setProperty('--i', f); var n = Math.round(f); links.forEach(function (a, j) { a.classList.toggle('on', j === n); }); }
    });
    function end(e) {
      if (!down) return; down = false;
      if (!moved) return;
      var i = Math.round(frac(e.clientX));
      tg.classList.remove('drag'); ind.style.transition = ''; ind.style.setProperty('--i', i);
      try { tg.releasePointerCapture(pid); } catch (x) {}
      var a = links[i]; if (i === cur) { setI(i, true); } else if (a) a.click();
      e.preventDefault && e.preventDefault();
      var stop = function (ev) { ev.stopPropagation(); ev.preventDefault(); }; tg.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(function () { tg.removeEventListener('click', stop, true); }, 50);
    }
    tg.addEventListener('pointerup', end); tg.addEventListener('pointercancel', end);
  })();

  /* real glass refraction for the bubble (Chromium/Android WebView): an SVG displacement map used by backdrop-filter */
  (function () {
    try {
      if (!/Chrome|Chromium|CriOS|Edg/.test(navigator.userAgent) || /Firefox/.test(navigator.userAgent)) return;
      var NS = 'http://www.w3.org/2000/svg', svg = D.createElementNS(NS, 'svg');
      svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('style', 'position:absolute'); svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = '<filter id="rxLens" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage id="rxLensMap" x="0" y="0" width="80" height="60" preserveAspectRatio="none" result="m"/><feDisplacementMap in="SourceGraphic" in2="m" scale="34" xChannelSelector="R" yChannelSelector="G"/></filter>';
      R.appendChild(svg);
      function build() {
        var r = ind.getBoundingClientRect(), W = Math.max(40, Math.round(ind.offsetWidth)), H = Math.max(30, Math.round(ind.offsetHeight));
        var cv = D.createElement('canvas'); cv.width = W; cv.height = H; var cx = cv.getContext('2d'), im = cx.createImageData(W, H);
        for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
          var u = (x + .5) / W * 2 - 1, v = (y + .5) / H * 2 - 1;
          var e = Math.pow(Math.max(Math.abs(u), Math.abs(v)), 3);          // stronger bending near the rim
          var k = .32 + .68 * e;
          var dx = -u * k, dy = -v * k, o = (y * W + x) * 4;
          im.data[o] = Math.round(127.5 + dx * 127.5); im.data[o + 1] = Math.round(127.5 + dy * 127.5); im.data[o + 2] = 128; im.data[o + 3] = 255;
        }
        cx.putImageData(im, 0, 0);
        var m = D.getElementById('rxLensMap'); m.setAttribute('width', W); m.setAttribute('height', H);
        m.setAttributeNS('http://www.w3.org/1999/xlink', 'href', cv.toDataURL()); m.setAttribute('href', cv.toDataURL());
      }
      build(); R.classList.add('lens');
      addEventListener('resize', function () { clearTimeout(build.t); build.t = setTimeout(build, 200); });
    } catch (e) { }
  })();

  /* ---------- header "..." button ---------- */
  var nav = $('nav');
  var xb = D.createElement('button'); xb.type = 'button'; xb.className = 'xbtn'; xb.id = 'xbtn'; xb.setAttribute('aria-label', 'Menu'); xb.setAttribute('aria-haspopup', 'dialog'); xb.setAttribute('aria-expanded', 'false');
  xb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
  if (nav) nav.appendChild(xb);

  /* ---------- the sheet ---------- */
  var P = [['/', 'Home', '🏠'], ['/pair', 'Link device', '🔗'], ['/create', 'Create Bot', '🛠'], ['/preview', 'Preview', '📱'], ['/ai', 'AI Support', '✨'], ['/commands', 'Commands', '⌘'], ['/learn', 'Learn', '🎓'], ['/docs', 'Docs', '📄'], ['/support', 'Support', '💬']];
  var scrim = D.createElement('div'); scrim.className = 'xscrim';
  var sh = D.createElement('div'); sh.className = 'xsheet'; sh.id = 'xsheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', 'Menu'); sh.setAttribute('aria-modal', 'true');
  var h = '<h5>Pages</h5><div class="xpages">';
  P.forEach(function (p) { h += '<a href="' + p[0] + '" data-nav data-xp><span aria-hidden="true">' + p[2] + '</span>' + p[1] + '</a>'; });
  h += '</div><h5>Theme</h5><div class="xseg" id="xseg" data-v="black"><i></i><button type="button" data-t="black">Black</button><button type="button" data-t="white">White</button></div>' +
    '<h5>Sound &amp; motion</h5>' +
    '<button type="button" class="xrow" id="xmus"><span>Menu song<small>Background music</small></span><i class="xsw"></i></button>' +
    '<button type="button" class="xrow" id="xfx"><span>Button sounds<small>Tap feedback</small></span><i class="xsw"></i></button>' +
    '<button type="button" class="xrow" id="xan"><span>Animations<small>Background &amp; scroll effects</small></span><i class="xsw"></i></button>' +
    '<button type="button" class="xrow" id="xlv"><span>Animation level<small>Low, normal, high</small></span><i class="xarrow">›</i></button>' +
    '<h5>More</h5>' +
    '<button type="button" class="xrow" id="xse"><span>Search<small>Pages and commands</small></span><i class="xarrow">⌕</i></button>';
  sh.innerHTML = h;
  R.appendChild(scrim); R.appendChild(sh);

  var open = false;
  function paint() {
    var cur = location.pathname.replace(/\/+$/, '') || '/';
    [].forEach.call(sh.querySelectorAll('.xpages a'), function (a) { a.classList.toggle('on', (a.getAttribute('href').replace(/\/+$/, '') || '/') === cur); });
    var th = R.getAttribute('data-theme') === 'white' ? 'white' : 'black'; $('#xseg').setAttribute('data-v', th);
    var m = btn('Toggle sound'), f = btn('Toggle button sounds'), s = $('#eSw');
    $('#xmus .xsw').classList.toggle('on', !!m && m.textContent.indexOf('🎵') > -1);
    $('#xfx .xsw').classList.toggle('on', !!f && f.textContent.indexOf('🔔') > -1);
    $('#xan .xsw').classList.toggle('on', !!s && s.getAttribute('aria-checked') === 'true');
  }
  function show(v) { open = v; sh.classList.toggle('on', v); scrim.classList.toggle('on', v); xb.setAttribute('aria-expanded', v ? 'true' : 'false'); if (v) paint(); }
  xb.addEventListener('click', function (e) { e.stopPropagation(); show(!open); });
  scrim.addEventListener('click', function () { show(false); });
  D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) show(false); });
  sh.addEventListener('click', function (e) {
    var t = e.target, a = t.closest('a[data-xp]'), b;
    if (a) { show(false); return; }
    if ((b = t.closest('#xseg button'))) { var n = b.getAttribute('data-t'), o = $('#pop [data-n="' + n + '"]'); if (o) o.click(); else R.setAttribute('data-theme', n); paint(); return; }
    function drive(id, fn) { var el = t.closest(id); if (el) { fn(); setTimeout(paint, 60); return true; } }
    if (drive('#xmus', function () { var m = btn('Toggle sound'); if (m) m.click(); })) return;
    if (drive('#xfx', function () { var f = btn('Toggle button sounds'); if (f) f.click(); })) return;
    if (drive('#xan', function () { var s = $('#eSw'); if (s) s.click(); })) return;
    if (t.closest('#xlv')) { show(false); setTimeout(function () { var f = $('#eFab'); if (f) f.click(); }, 120); return; }
    if (t.closest('#xse')) { show(false); setTimeout(function () { var s = $('#eSearch'); if (s) s.click(); }, 120); return; }
  });
  /* route changes (the site swaps <main> without reloading) */
  new MutationObserver(function () { if (open) show(false); }).observe(B, { attributes: true, attributeFilter: ['data-page'] });
})();
