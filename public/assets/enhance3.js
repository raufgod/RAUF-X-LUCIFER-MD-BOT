/* =====================================================================
   RAUF × LUCIFER MD BOT - enhance3.js   (Style Studio + visual effects)
   Extra themes, accent colour, live backgrounds (stars / particles / matrix / aurora / snow),
   cursor glow, click sparkles, confetti on copy, magnetic buttons, page fade, number counters,
   font / corner / density / contrast options, announcement strip.
   site.js, pair.js and all API code are NOT modified. Everything is saved in this browser only.
   ===================================================================== */
(function () {
  'use strict';
  var D = document, R = D.documentElement, KEY = 'kob_style';
  function lsG(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  var OPTK=/^(theme|acc|fx|snd|kob_zoom|srv|kob_iso|kob_ann)$/;function optOk(){try{var j=JSON.parse(localStorage.getItem('rx_consent')||'null');return !!(j&&j.opt===true)}catch(e){return false}} function lsS(k, v) { try { if (OPTK.test(k) && !optOk()) return; localStorage.setItem(k, v); } catch (e) {} }
  function $(id) { return D.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function say(m) { if (window.KOBX && KOBX.toast) KOBX.toast(m); }
  var fine = false, reduce = false;
  try { fine = matchMedia('(hover:hover) and (pointer:fine)').matches; reduce = matchMedia('(prefers-reduced-motion:reduce)').matches; } catch (e) {}
  function off() { return R.classList.contains('e-off'); }

  /* ---------------- settings ---------------- */
  var LITE = !!window.__KOB_LITE;
  var DEF = { theme: '', accent: '', fx: LITE ? 'none' : 'stars', glow: fine && !LITE, spark: !LITE, conf: true, mag: fine && !LITE, fade: !LITE, cnt: !LITE, font: '', corner: '', compact: false, hi: false, solid: false };
  var S = {};
  (function load() { var j = {}; try { j = JSON.parse(lsG(KEY, '{}')) || {}; } catch (e) {} for (var k in DEF) S[k] = (k in j) ? j[k] : DEF[k]; })();
  function save() { lsS(KEY, JSON.stringify(S)); }

  /* ---------------- extra themes (inline variables, so site.css and site.js stay untouched) ---------------- */
  var TH = {};   // (v23) only two site themes exist (Black and White); the extra Style Studio themes were removed
  var VARS = ['hl', 'bg', 'panel', 'panel2', 'line', 'blue', 'cyan', 'gold', 'text', 'mute', 'ink', 'ink2', 'ink3', 'glow', 'glow2', 'ok', 'err'];
  var ACC = ['#9b3dff', '#d28bff', '#22d3a6', '#a78bfa', '#ec4899', '#ff4d1a', '#f6b93b', '#ef4444'];
  function applyLook() {
    VARS.forEach(function (k) { R.style.removeProperty('--' + k); });
    var t = TH[S.theme];
    if (t) { for (var k in t.v) R.style.setProperty('--' + k, t.v[k]); R.setAttribute('data-e3t', S.theme); } else R.removeAttribute('data-e3t');
    if (/^#[0-9a-f]{6}$/i.test(S.accent)) { R.style.setProperty('--blue', S.accent); R.style.setProperty('--cyan', mix(S.accent, '#ffffff', 0.35)); R.style.setProperty('--glow2', S.accent + '55'); }
    R.style.setProperty('--r', S.corner === 'sharp' ? '6px' : S.corner === 'round' ? '28px' : '');
    if (!S.corner) R.style.removeProperty('--r');
    R.setAttribute('data-e3f', S.font || ''); R.setAttribute('data-e3d', S.compact ? 'compact' : '');
    R.setAttribute('data-e3c', S.hi ? 'hi' : ''); R.setAttribute('data-e3s', S.solid ? 'solid' : '');
    colours = null;
  }
  function mix(a, b, t) {
    function p(h) { return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
    var x = p(a), y = p(b);
    return '#' + x.map(function (v, i) { return ('0' + Math.round(v + (y[i] - v) * t).toString(16)).slice(-2); }).join('');
  }
  // choosing a site theme from the top-right palette clears our own theme so the two never fight
  D.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.thi') && S.theme) { S.theme = ''; save(); applyLook(); if ($('e3st') && !$('e3st').hidden) paintStudio(); }
  });

  /* ---------------- background canvas ---------------- */
  var cv = null, cx = null, W = 0, H = 0, dpr = 1, parts = [], mode = '', raf = 0, colours = null, last = 0, cols = [];
  function readColours() {
    var cs = getComputedStyle(R);
    colours = { a: cs.getPropertyValue('--cyan').trim() || '#d28bff', b: cs.getPropertyValue('--blue').trim() || '#9b3dff', g: cs.getPropertyValue('--gold').trim() || '#ffc94d' };
  }
  function speed() { var f = parseFloat(R.style.getPropertyValue('--fx')); return isNaN(f) ? 1 : f; }
  function ensureCanvas() {
    if (cv) return;
    cv = D.createElement('canvas'); cv.className = 'e3-fx'; cv.setAttribute('aria-hidden', 'true');
    D.body.insertBefore(cv, D.body.firstChild); cx = cv.getContext('2d');
    window.addEventListener('resize', function () { size(); seed(); }, { passive: true });
  }
  function size() {
    if (!cv) return;
    dpr = LITE ? 1 : Math.min(window.devicePixelRatio || 1, 1.5); W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function seed() {
    parts = []; cols = [];
    var area = W * H, n;
    if (mode === 'stars') { n = Math.min(160, Math.round(area / 9000)); for (var i = 0; i < n; i++) parts.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(0.4, 1.6), t: rnd(0, 6.28), s: rnd(0.4, 1.6), v: rnd(2, 10) }); }
    else if (mode === 'particles') { n = Math.min(70, Math.round(area / 22000)); for (var j = 0; j < n; j++) parts.push({ x: rnd(0, W), y: rnd(0, H), vx: rnd(-0.25, 0.25), vy: rnd(-0.25, 0.25), r: rnd(1, 2.2) }); }
    else if (mode === 'snow') { n = Math.min(110, Math.round(area / 14000)); for (var k = 0; k < n; k++) parts.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(1, 3), v: rnd(0.3, 1.1), w: rnd(0, 6.28) }); }
    else if (mode === 'matrix') { var c = Math.ceil(W / 18); for (var m = 0; m < c; m++) cols.push({ y: rnd(-H, 0), v: rnd(1.2, 3.4) }); }
    else if (mode === 'aurora') { for (var q = 0; q < 4; q++) parts.push({ x: rnd(0, W), y: rnd(0.1, 0.7) * H, r: rnd(0.25, 0.45) * Math.max(W, H), t: rnd(0, 6.28), s: rnd(0.12, 0.3), k: q }); }
  }
  function frame(ts) {
    raf = 0;
    if (!mode) return;
    if (D.hidden) { raf = requestAnimationFrame(frame); return; }
    var dt = Math.min(50, ts - last || 16) / 16; last = ts;
    var sp = off() ? 0 : speed() * dt;
    draw(sp);
    raf = off() ? setTimeout(function () { raf = 0; frame(performance.now()); }, 800) : requestAnimationFrame(frame);
  }
  function draw(sp) {
    if (!colours) readColours();
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H);
    var i, p;
    if (mode === 'stars') {
      for (i = 0; i < parts.length; i++) {
        p = parts[i]; p.t += 0.03 * p.s * sp; p.y -= p.v * 0.01 * sp; if (p.y < -2) { p.y = H + 2; p.x = rnd(0, W); }
        cx.globalAlpha = 0.25 + 0.6 * Math.abs(Math.sin(p.t)); cx.fillStyle = i % 5 === 0 ? colours.a : '#fff';
        cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill();
      }
    } else if (mode === 'particles') {
      cx.fillStyle = colours.a;
      for (i = 0; i < parts.length; i++) {
        p = parts[i]; p.x += p.vx * sp; p.y += p.vy * sp;
        if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1;
        cx.globalAlpha = 0.7; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill();
        for (var j = i + 1; j < parts.length; j++) {
          var q = parts[j], dx = p.x - q.x, dy = p.y - q.y, d = dx * dx + dy * dy;
          if (d < 12000) { cx.globalAlpha = (1 - d / 12000) * 0.3; cx.strokeStyle = colours.b; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(q.x, q.y); cx.stroke(); }
        }
      }
    } else if (mode === 'snow') {
      cx.fillStyle = '#fff';
      for (i = 0; i < parts.length; i++) {
        p = parts[i]; p.y += p.v * sp; p.w += 0.02 * sp; p.x += Math.sin(p.w) * 0.4 * sp; if (p.y > H + 4) { p.y = -4; p.x = rnd(0, W); }
        cx.globalAlpha = 0.55; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill();
      }
    } else if (mode === 'matrix') {
      cx.font = '15px ui-monospace,monospace'; cx.fillStyle = colours.a;
      for (i = 0; i < cols.length; i++) {
        var c = cols[i]; c.y += c.v * sp * 1.2;
        if (c.y > H + 40) { c.y = rnd(-200, 0); c.v = rnd(1.2, 3.4); }
        for (var t = 0; t < 12; t++) { cx.globalAlpha = Math.max(0, 0.5 - t * 0.045); cx.fillText(String.fromCharCode(0x30A0 + ((i * 7 + t * 13 + Math.floor(c.y / 18)) % 90)), i * 18, c.y - t * 18); }
      }
    } else if (mode === 'aurora') {
      cx.globalCompositeOperation = 'lighter';
      for (i = 0; i < parts.length; i++) {
        p = parts[i]; p.t += 0.004 * p.s * 10 * sp;
        var x = p.x + Math.sin(p.t) * W * 0.18, y = p.y + Math.cos(p.t * 0.8) * H * 0.1, g = cx.createRadialGradient(x, y, 0, x, y, p.r);
        g.addColorStop(0, (p.k % 2 ? colours.a : colours.b) + '40'); g.addColorStop(1, 'transparent');
        cx.globalAlpha = 0.55; cx.fillStyle = g; cx.fillRect(x - p.r, y - p.r, p.r * 2, p.r * 2);
      }
      cx.globalCompositeOperation = 'source-over';
    }
    cx.globalAlpha = 1;
  }
  function setFx() {
    mode = S.fx === 'none' ? '' : S.fx;
    if (!mode) { if (cv) { cv.style.display = 'none'; } if (raf) { cancelAnimationFrame(raf); clearTimeout(raf); raf = 0; } return; }
    ensureCanvas(); cv.style.display = ''; size(); seed(); colours = null;
    if (!raf) raf = requestAnimationFrame(frame);
  }
  setInterval(function () { colours = null; }, 3000);

  /* ---------------- cursor glow, click sparkles, confetti, magnet ---------------- */
  var glow = null, gx = 0, gy = 0, gt = 0;
  function initPointer() {
    if (!fine) return;
    D.addEventListener('pointermove', function (e) {
      gx = e.clientX; gy = e.clientY;
      if (S.glow && !off()) {
        if (!glow) { glow = D.createElement('div'); glow.className = 'e3-cur'; glow.setAttribute('aria-hidden', 'true'); D.body.appendChild(glow); }
        if (!gt) gt = requestAnimationFrame(function () { gt = 0; glow.style.transform = 'translate3d(' + (gx - 160) + 'px,' + (gy - 160) + 'px,0)'; glow.classList.add('on'); });
      }
      if (S.mag && !off()) {
        var m = e.target.closest && e.target.closest('.main,.pill,.cta');
        if (m) { var r = m.getBoundingClientRect(); m.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.12).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * 0.18).toFixed(1) + 'px)'; m.setAttribute('data-e3m', '1'); }
      }
    }, { passive: true });
    D.addEventListener('pointerout', function (e) { var m = e.target.closest && e.target.closest('[data-e3m]'); if (m && !m.contains(e.relatedTarget)) { m.style.transform = ''; m.removeAttribute('data-e3m'); } });
  }
  function burst(x, y, n, big) {
    if (off() || !D.body.animate) return;
    var cs = [colours ? colours.a : '#d28bff', colours ? colours.b : '#9b3dff', colours ? colours.g : '#ffc94d', '#ffffff', '#35e0a1'];
    for (var i = 0; i < n; i++) {
      var d = D.createElement('i'); d.className = 'e3-sp'; d.setAttribute('aria-hidden', 'true');
      var a = rnd(0, 6.283), dist = rnd(30, big ? 150 : 60), s = big ? rnd(5, 9) : rnd(3, 6);
      d.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + s + 'px;height:' + (big ? s * rnd(1, 2.2) : s) + 'px;background:' + cs[i % cs.length] + ';border-radius:' + (big ? '2px' : '50%');
      D.body.appendChild(d);
      var an = d.animate([{ transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 }, { transform: 'translate(' + (Math.cos(a) * dist - 3) + 'px,' + (Math.sin(a) * dist + (big ? 60 : 0)) + 'px) rotate(' + rnd(-360, 360) + 'deg)', opacity: 0 }], { duration: rnd(500, big ? 1100 : 750), easing: 'cubic-bezier(.2,.7,.3,1)' });
      an.onfinish = (function (el) { return function () { el.remove(); }; })(d);
    }
  }
  D.addEventListener('pointerdown', function (e) {
    if (!S.spark || e.button > 0 || (e.target.closest && e.target.closest('input,textarea,select,.e3-st'))) return;
    if (!colours) readColours();
    burst(e.clientX, e.clientY, 7, false);
  }, { passive: true });
  D.addEventListener('click', function (e) {
    if (!S.conf) return;
    var t = e.target.closest && e.target.closest('[data-copy],#copy,.e2-chip'); if (!t) return;
    var r = t.getBoundingClientRect(); if (!colours) readColours(); burst(r.left + r.width / 2, r.top + r.height / 2, 22, true);
  });
  // success on the pairing page: celebrate once when "Connected" appears
  function watchDone(root) {
    var dn = root.querySelector && root.querySelector('#doneCard'); if (!dn || dn.getAttribute('data-e3')) return; dn.setAttribute('data-e3', '1');
    new MutationObserver(function () {
      if (dn.style.display === 'block' && S.conf) { var r = dn.getBoundingClientRect(); for (var i = 0; i < 4; i++) setTimeout(function () { burst(r.left + r.width / 2, r.top + 40, 28, true); }, i * 260); }
    }).observe(dn, { attributes: true, attributeFilter: ['style'] });
  }

  /* ---------------- page fade + number counters ---------------- */
  function swapFade(app) {
    if (!S.fade || off()) return;
    app.classList.remove('e3-swap'); void app.offsetWidth; app.classList.add('e3-swap');
    setTimeout(function () { app.classList.remove('e3-swap'); }, 700);
  }
  var cio = null;
  function counters(root) {
    if (!S.cnt || off() || !('IntersectionObserver' in window)) return;
    if (!cio) cio = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return; var el = en.target; cio.unobserve(el);
        var m = el.textContent.trim().match(/^(\d[\d,]*)(.*)$/); if (!m) return;
        var to = parseInt(m[1].replace(/,/g, ''), 10), suf = m[2], t0 = performance.now(), dur = 900;
        (function step(t) { var k = Math.min(1, (t - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - k, 3))); el.textContent = v + suf; if (k < 1) requestAnimationFrame(step); else el.textContent = m[1] + suf; })(t0);
      });
    }, { threshold: 0.6 });
    [].forEach.call((root.querySelectorAll ? root : D).querySelectorAll('.stats b'), function (b) {
      if (b.getAttribute('data-e3n') || !/^\d[\d,]*\D{0,3}$/.test(b.textContent.trim())) return; b.setAttribute('data-e3n', '1'); cio.observe(b);
    });
  }

  /* ---------------- announcement strip (site-config.js: announce: "text", announceLink: "/commands") ---------------- */
  function announce() {
    var c = window.SITE || {}, t = (c.announce || '').trim(); if (!t || D.querySelector('.e3-ann')) return;
    var id = 'a' + t.length + t.charCodeAt(0) + t.charCodeAt(t.length - 1);
    if (lsG('kob_ann', '') === id) return;
    var a = D.createElement('div'); a.className = 'e3-ann'; a.setAttribute('role', 'region'); a.setAttribute('aria-label', 'Announcement');
    var l = (c.announceLink || '').trim();
    a.innerHTML = '<span>' + esc(t) + '</span>' + (l ? '<a href="' + esc(l) + '"' + (l.charAt(0) === '/' ? ' data-nav' : ' target="_blank" rel="noopener"') + '>Open</a>' : '') + '<button type="button" aria-label="Dismiss">×</button>';
    a.querySelector('button').addEventListener('click', function () { lsS('kob_ann', id); a.remove(); });
    D.body.insertBefore(a, D.body.firstChild);
  }

  /* ---------------- Style Studio dialog ---------------- */
  function seg(id, opts, cur) { return '<div class="e3-seg" id="' + id + '">' + opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="on"' : '') + '>' + o[1] + '</button>'; }).join('') + '</div>'; }
  function tog(k, label) { return '<label class="e3-tg"><input type="checkbox" data-k="' + k + '"' + (S[k] ? ' checked' : '') + '><span>' + label + '</span></label>'; }
  function build() {
    var d = D.createElement('div'); d.className = 'e3-st'; d.id = 'e3st'; d.hidden = true; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Style Studio');
    d.innerHTML = '<div class="e3-card"><div class="e3-hh"><b>🎨 Style Studio</b><button type="button" data-a="x" aria-label="Close">×</button></div><div id="e3body"></div></div>';
    d.addEventListener('click', function (e) { if (e.target === d || (e.target.closest && e.target.closest('[data-a=x]'))) studio(false); });
    D.body.appendChild(d);
    var b = $('e3body');
    b.addEventListener('click', function (e) {
      var t = e.target.closest('[data-t]'), a = e.target.closest('[data-ac]'), s = e.target.closest('.e3-seg button'), r = e.target.closest('[data-a=reset]');
      if (t) { S.theme = t.getAttribute('data-t') === '-' ? '' : t.getAttribute('data-t'); applyLook(); }
      else if (a) { S.accent = a.getAttribute('data-ac') === '-' ? '' : a.getAttribute('data-ac'); applyLook(); }
      else if (s) {
        var id = s.parentNode.id, v = s.getAttribute('data-v');
        if (id === 'e3fx') { S.fx = v; setFx(); } else if (id === 'e3font') { S.font = v; applyLook(); } else if (id === 'e3cor') { S.corner = v; applyLook(); }
      } else if (r) { for (var k in DEF) S[k] = DEF[k]; S.fx = DEF.fx; applyLook(); setFx(); say('Style reset'); }
      else return;
      save(); paintStudio();
    });
    b.addEventListener('change', function (e) {
      var i = e.target;
      if (i.getAttribute('data-k')) { S[i.getAttribute('data-k')] = i.checked; applyLook(); if (i.getAttribute('data-k') === 'glow' && !i.checked && glow) glow.classList.remove('on'); save(); }
      else if (i.id === 'e3col') { S.accent = i.value; applyLook(); save(); paintStudio(); }
    });
  }
  function paintStudio() {
    var b = $('e3body'); if (!b) return;
    var sw = '<button type="button" class="e3-th' + (!S.theme ? ' on' : '') + '" data-t="-"><i style="background:linear-gradient(135deg,#9b3dff,#d28bff)"></i>Site theme</button>' +
      Object.keys(TH).map(function (k) { var t = TH[k]; return '<button type="button" class="e3-th' + (S.theme === k ? ' on' : '') + '" data-t="' + k + '"><i style="background:linear-gradient(135deg,' + t.c[0] + ',' + t.c[1] + ')"></i>' + t.n + '</button>'; }).join('');
    var ac = ACC.map(function (c) { return '<button type="button" class="e3-ac' + (S.accent === c ? ' on' : '') + '" data-ac="' + c + '" style="background:' + c + '" aria-label="Accent ' + c + '"></button>'; }).join('') +
      '<button type="button" class="e3-ac e3-x" data-ac="-" aria-label="Default accent">↺</button><input type="color" id="e3col" value="' + (/^#[0-9a-f]{6}$/i.test(S.accent) ? S.accent : '#9b3dff') + '" aria-label="Custom accent colour">';
    b.innerHTML =
      '<div class="e3-h">Theme <small>More themes are in the palette button at the top right</small></div><div class="e3-grid">' + sw + '</div>' +
      '<div class="e3-h">Accent colour</div><div class="e3-acs">' + ac + '</div>' +
      '<div class="e3-h">Live background</div>' + seg('e3fx', [['none', 'Off'], ['stars', 'Stars'], ['particles', 'Network'], ['aurora', 'Aurora'], ['matrix', 'Matrix'], ['snow', 'Snow']], S.fx) +
      '<div class="e3-h">Effects</div><div class="e3-tgs">' + tog('glow', 'Cursor glow') + tog('spark', 'Click sparkles') + tog('conf', 'Confetti on copy and success') + tog('mag', 'Magnetic buttons') + tog('fade', 'Page fade') + tog('cnt', 'Counting numbers') + '</div>' +
      '<div class="e3-h">Look</div><div class="e3-lab">Font</div>' + seg('e3font', [['', 'Default'], ['sys', 'Clean'], ['mono', 'Mono']], S.font) +
      '<div class="e3-lab">Corners</div>' + seg('e3cor', [['sharp', 'Sharp'], ['', 'Normal'], ['round', 'Round']], S.corner) +
      '<div class="e3-tgs">' + tog('compact', 'Compact layout') + tog('hi', 'High contrast') + tog('solid', 'Solid panels (no blur)') + '</div>' +
      '<p class="e3-n">Effects follow the Animations switch and level. Everything is saved in this browser only.</p>' +
      '<button type="button" class="e3-rs" data-a="reset">Reset all styles</button>';
  }
  var lastFocus = null;
  function studio(v) {
    if (!$('e3st')) build();
    var d = $('e3st');
    if (v) { lastFocus = D.activeElement; paintStudio(); d.hidden = false; var f = d.querySelector('button.on,button'); if (f) f.focus(); }
    else { d.hidden = true; if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {} }
  }
  function addButton() {
    var sec = $('e2Sec'); if (!sec || $('e3Open')) return;
    var b = D.createElement('button'); b.type = 'button'; b.id = 'e3Open'; b.className = 'e3-open'; b.innerHTML = '🎨 Open Style Studio <small>themes, colours, effects</small>';
    b.addEventListener('click', function () { var f = $('eFab'); if (f) f.click(); studio(true); });
    sec.insertBefore(b, sec.firstChild);
  }
  D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('e3st') && !$('e3st').hidden) studio(false); });
  D.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return; var t = e.target;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    if (e.key === 's' || e.key === 'S') { if (window.__e3g) return; studio(!( $('e3st') && !$('e3st').hidden)); }
  });
  D.addEventListener('keydown', function (e) { if (e.key === 'g' || e.key === 'G') { window.__e3g = 1; setTimeout(function () { window.__e3g = 0; }, 1300); } }, true);

  /* ---------------- run ---------------- */
  function enhance3(root) { addButton(); counters(root); watchDone(root); }
  function start() {
    applyLook(); setFx(); initPointer(); announce();
    // add the shortcut line to the help dialog when it exists
    enhance3(D);
    var app = $('app');
    if (app && 'MutationObserver' in window) {
      var mt = 0, first = true;
      new MutationObserver(function () { clearTimeout(mt); mt = setTimeout(function () { swapFade(app); enhance3(app); }, 60); }).observe(app, { childList: true });
    }
    // the E2 panel is built slightly later, so retry for the button
    var n = 0, iv = setInterval(function () { addButton(); if ($('e3Open') || ++n > 20) clearInterval(iv); }, 250);
  }
  // theme/accent applied right away (before DOMContentLoaded) to avoid a colour flash
  try { if (R) { applyLook(); } } catch (e) {}
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', start); else start();
})();
