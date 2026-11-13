/* Admin panel app (v23). Served only from the secret admin link / ADMIN_CODE link, never part of the public website. */
(function () {
  'use strict';
  var D = document, A = D.getElementById('adm'), tok = '', tab = 'ov', timer = null, drag = false;
  var BASE = window.PAIR_API_BASE || '';
  function $(id) { return D.getElementById(id); }
  function lsG(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function lsS(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function e(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function say(m) { var t = $('toast'); if (!t) return; t.textContent = m; t.className = 'toast on'; clearTimeout(say.t); say.t = setTimeout(function () { t.className = 'toast'; }, 1900); }
  function setMsg(el, kind, text) { if (!el) return; el.className = 'msg ' + kind; el.textContent = text; }
  D.documentElement.setAttribute('data-theme', lsG('adth', 'black'));

  function api(m, p, b, raw) {
    var h = { 'ngrok-skip-browser-warning': '1' }; if (tok) h.Authorization = 'Bearer ' + tok;
    var o = { method: m, headers: h };
    if (b !== undefined) { if (raw) { h['Content-Type'] = 'application/octet-stream'; o.body = b; } else { h['Content-Type'] = 'application/json'; o.body = JSON.stringify(b); } }
    return fetch(BASE + p, o).then(function (r) {
      return r.json().then(function (j) { j._s = r.status; if (r.status === 401 && tok && p !== '/api/admin/enter') { tok = ''; lsS('adt', ''); login('Session expired. Opening again…'); } return j; });
    }).catch(function () { return { ok: false, error: 'Server not reachable' }; });
  }

  var ICON = {
    ov: 'M4 13h6V4H4zM14 20h6V4h-6zM4 20h6v-5H4z',
    ss: 'M16 11a4 4 0 1 0-8 0M4 20a8 8 0 0 1 16 0',
    br: 'M12 3l2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8z',
    cs: 'M4 5h16v14H4zM8 10l3 2-3 2M13 14h4',
    mo: 'M5 12h.01M12 12h.01M19 12h.01'
  };
  var TABS = [['ov', 'Home'], ['ss', 'Sessions'], ['br', 'Brand'], ['cs', 'Console'], ['mo', 'More']];

  function login(msg) {
    clearInterval(timer);
    A.innerHTML = '<div class="ad login"><div class="card"><h3>👑 Admin</h3><p class="sub" id="lm">' + e(msg || 'Opening…') + '</p></div></div>';
    var key = window.__K || '';
    api('POST', '/api/admin/enter', { key: key }).then(function (j) {
      if (j.ok) { tok = j.token; lsS('adt', tok); shell(); } else { $('lm').textContent = j.error || 'This admin link is not valid.'; }
    });
  }

  function shell() {
    var th = D.documentElement.getAttribute('data-theme');
    var dock = '<nav class="dock" id="dock"><i class="b" id="db"></i>' + TABS.map(function (t) { return '<button type="button" data-t="' + t[0] + '"><svg viewBox="0 0 24 24"><path d="' + ICON[t[0]] + '"/></svg>' + t[1] + '</button>'; }).join('') + '</nav>';
    A.innerHTML = '<div class="ad"><div class="hdr"><h1>👑 Admin panel<small id="hs">RAUF × LUCIFER MD BOT</small></h1><button class="ib" id="ath" type="button" aria-label="Theme">' + (th === 'white' ? '🌙' : '☀️') + '</button><button class="ib" id="aex" type="button" aria-label="Log out">⏻</button></div><div id="pg"></div></div>' + dock;
    [].forEach.call(A.querySelectorAll('#dock button'), function (b) { b.onclick = function () { tab = b.getAttribute('data-t'); view(); }; });
    $('ath').onclick = function () { var n = D.documentElement.getAttribute('data-theme') === 'white' ? 'black' : 'white'; D.documentElement.setAttribute('data-theme', n); lsS('adth', n); this.textContent = n === 'white' ? '🌙' : '☀️'; };
    $('aex').onclick = function () { tok = ''; lsS('adt', ''); clearInterval(timer); A.innerHTML = '<div class="ad login"><div class="card"><h3>Logged out</h3><p class="sub">Open the admin link again to come back.</p></div></div>'; };
    view();
  }

  function view() {
    clearInterval(timer);
    var idx = 0; TABS.forEach(function (t, i) { if (t[0] === tab) idx = i; });
    var db = $('db'); if (db) db.style.setProperty('--i', idx);
    [].forEach.call(A.querySelectorAll('#dock button'), function (b) { b.className = b.getAttribute('data-t') === tab ? 'on' : ''; });
    var c = $('pg'); c.innerHTML = '<p class="note">Loading…</p>';
    ({ ov: vOv, ss: vSs, br: vBr, cs: vCs, mo: vMo })[tab](c);
  }

  /* ---------- Home ---------- */
  function fmtUp(s) { var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return (d ? d + 'd ' : '') + h + 'h ' + m + 'm'; }
  function vOv(c) {
    Promise.all([api('GET', '/api/admin/overview'), api('GET', '/api/admin/health')]).then(function (r) {
      var j = r[0], h = r[1]; if (!j.ok) { c.innerHTML = '<div class="msg err">' + e(j.error || 'Error') + '</div>'; return; }
      var on = j.sessions.filter(function (s) { return s.active; }).length;
      $('hs').textContent = 'v' + j.version + ' · ' + j.platform;
      c.innerHTML = '<div class="grid"><div class="st"><b>' + e(fmtUp(j.uptime)) + '</b><span>Uptime</span></div><div class="st"><b>' + j.memMB + ' MB</b><span>Memory</span></div><div class="st"><b>' + on + '/' + j.sessions.length + '</b><span>Sessions online</span></div><div class="st"><b>' + j.commands + '</b><span>Command files</span></div></div>' +
        '<div class="card"><h3>Quick actions</h3><p class="sub">Bot is <b id="md">' + (h.ok && h.isPublic ? 'PUBLIC' : 'PRIVATE') + '</b> · prefix <b>' + e(h.prefix || '.') + '</b></p><div class="acts"><button class="btn" id="qm" type="button">Switch to ' + (h.ok && h.isPublic ? 'private' : 'public') + '</button><button class="btn" id="qc" type="button">Clear logs</button><button class="btn dng" id="qr" type="button">Restart bot</button></div><div class="msg" id="qmsg"></div></div>' +
        '<div class="card"><h3>Health</h3>' + (h.ok ? h.checks.map(function (k) { return '<div class="row"><div><b><span class="dot ' + (k.ok ? 'on' : 'off') + '"></span>' + e(k.k) + '</b><span class="s">' + e(k.note) + '</span></div></div>'; }).join('') : '') + '<p class="note" style="margin-top:8px">Only yes/no shown. Secrets are never displayed.</p></div>';
      $('qm').onclick = function () { cmd('mode ' + (h.isPublic ? 'private' : 'public')).then(function () { say('Mode changed'); view(); }); };
      $('qc').onclick = function () { cmd('clearlogs').then(function () { say('Logs cleared'); }); };
      $('qr').onclick = function () { if (confirm('Restart the bot now?')) api('POST', '/api/admin/restart', {}).then(function () { setMsg($('qmsg'), 'ok', 'Restarting…'); waitBack($('qmsg')); }); };
    });
    timer = setInterval(function () { if (!drag && tab === 'ov') vOvQuiet(); }, 15000);
  }
  function vOvQuiet() { api('GET', '/api/admin/overview').then(function (j) { if (j.ok && $('hs')) $('hs').textContent = 'v' + j.version + ' · up ' + fmtUp(j.uptime); }); }
  function cmd(line) { return api('POST', '/api/admin/command', { cmd: line }); }
  function waitBack(m) { var n = 0, t = setInterval(function () { fetch(BASE + '/api/health', { headers: { 'ngrok-skip-browser-warning': '1' } }).then(function (r) { return r.json(); }).then(function (j) { if (j.ok && ++n >= 2) { clearInterval(t); setMsg(m, 'ok', 'Bot is back online ✓'); setTimeout(view, 900); } }).catch(function () { n = 0; }); }, 2500); }

  /* ---------- Sessions ---------- */
  function vSs(c) {
    api('GET', '/api/admin/overview').then(function (j) {
      if (!j.ok) { c.innerHTML = '<div class="msg err">' + e(j.error || 'Error') + '</div>'; return; }
      var L = j.sessions;
      c.innerHTML = '<div class="card"><h3>Linked numbers</h3><p class="sub">' + L.length + ' total · ' + L.filter(function (s) { return s.active; }).length + ' online</p><input id="sq" type="search" placeholder="Search number…" style="margin-top:12px" inputmode="numeric"></div><div id="sl"></div>';
      function paint() {
        var q = ($('sq').value || '').replace(/\D/g, ''), l = L.filter(function (s) { return !q || s.number.indexOf(q) > -1; });
        $('sl').innerHTML = l.length ? l.map(function (s) { return '<div class="row"><div><b>+' + e(s.number) + '</b><span class="s"><span class="bd ' + (s.active ? 'on' : 'off') + '">' + (s.active ? 'online' : 'offline') + '</span></span></div><div class="acts" style="margin:0"><button class="btn" data-c="' + e(s.number) + '" type="button">Copy</button><button class="btn dng" data-n="' + e(s.number) + '" type="button">Remove</button></div></div>'; }).join('') : '<div class="card"><p class="note">No numbers found.</p></div>';
        [].forEach.call($('sl').querySelectorAll('[data-c]'), function (b) { b.onclick = function () { if (navigator.clipboard) navigator.clipboard.writeText('+' + b.getAttribute('data-c')).then(function () { say('Copied'); }); }; });
        [].forEach.call($('sl').querySelectorAll('[data-n]'), function (b) { b.onclick = function () { var n = b.getAttribute('data-n'); if (confirm('Remove +' + n + '? That number will be logged out of the bot.')) api('POST', '/api/admin/session/remove', { number: n }).then(function (r) { say(r.ok ? 'Removed' : (r.error || 'Failed')); view(); }); }; });
      }
      $('sq').oninput = paint; paint();
    });
  }

  /* ---------- Brand ---------- */
  var BF = [
    ['Bot', [['botName', 'Bot name *', 'text'], ['ownerName', 'Owner name', 'text'], ['ownerNumber', 'Owner WhatsApp number (digits, with country code)', 'tel'], ['pairingNumber', 'Owner pairing number (empty = owner pairing OFF)', 'tel'], ['customPairingCode', 'Custom pairing code (8 letters/digits)', 'text'], ['prefix', 'Command prefix', 'text']]],
    ['Telegram', [['telegramToken', 'Telegram bot token (empty keeps the saved one)', 'password'], ['telegramUser', 'Telegram username (no @)', 'text']]],
    ['Links and contact', [['websiteUrl', 'Website link', 'url'], ['channelLink', 'WhatsApp channel link', 'url'], ['groupLink', 'WhatsApp group link', 'url'], ['telegramLink', 'Telegram link', 'url'], ['youtube', 'YouTube link', 'url'], ['instagram', 'Instagram link', 'url'], ['github', 'GitHub username', 'text'], ['email', 'Support email', 'email'], ['whatsappSupport', 'Support WhatsApp number', 'tel']]],
    ['Access', [['allowedNumbers', 'Numbers allowed to link (one per line, empty = anyone)', 'area'], ['adminEmails', 'Admin Google emails (one per line)', 'area']]],
    ['Notice on every page', [['announce', 'Short notice', 'text'], ['announceLink', 'Notice link (e.g. /commands)', 'text']]]
  ];
  function vBr(c) {
    api('GET', '/api/admin/brand').then(function (j) {
      if (!j.ok) { c.innerHTML = '<div class="msg err">' + e(j.error || 'Error') + '</div>'; return; }
      var b = j.brand || {}, h = '<div class="card"><h3>Brand &amp; settings</h3><p class="sub">Name, owner, links and contact. Applied to the website and the bot.</p></div>';
      BF.forEach(function (g, gi) {
        h += '<details class="sec"' + (gi === 0 ? ' open' : '') + '><summary>' + e(g[0]) + '</summary>';
        g[1].forEach(function (f) {
          var v = b[f[0]]; if (Array.isArray(v)) v = v.join('\n'); if (f[0] === 'telegramToken') v = ''; v = v == null ? '' : v;
          h += '<label for="f_' + f[0] + '">' + e(f[1]) + (f[0] === 'telegramToken' && b.telegramTokenSet ? ' — saved ' + e(b.telegramTokenTail) : '') + '</label>' + (f[2] === 'area' ? '<textarea id="f_' + f[0] + '">' + e(v) + '</textarea>' : '<input id="f_' + f[0] + '" type="' + f[2] + '" value="' + e(v) + '" autocomplete="off">');
        });
        h += '</details>';
      });
      c.innerHTML = h + '<div class="acts"><button class="btn pri" id="bs" type="button">Save changes</button></div><div class="msg" id="bm"></div>';
      $('bs').onclick = function () {
        var o = {}; BF.forEach(function (g) { g[1].forEach(function (f) { o[f[0]] = $('f_' + f[0]).value; }); });
        $('bs').disabled = true;
        api('POST', '/api/admin/brand', o).then(function (r) { $('bs').disabled = false; setMsg($('bm'), r.ok ? 'ok' : 'err', r.ok ? 'Saved' + (r.restartNeeded ? ' — restart the bot for the number/token changes to apply.' : '.') : (r.error || 'Could not save')); if (r.ok) say('Saved'); });
      };
    });
  }

  /* ---------- Console ---------- */
  function vCs(c) {
    c.innerHTML = '<div class="card"><h3>Console</h3><p class="sub">Live bot log (auto-refresh 3 s).</p><div class="fr"><input id="lq" type="search" placeholder="Filter (error, +91, …)"><button class="btn" id="lcp" type="button">Copy</button><button class="btn" id="ldl" type="button">Save</button></div><pre class="lg" id="lgp">…</pre><div class="fr"><input id="cc" placeholder="Command: help, status, prefix !, mode private" autocomplete="off" autocapitalize="off"><button class="btn pri" id="cr" type="button">Run</button></div><div class="chips">' + ['help', 'status', 'sessions', 'clearlogs'].map(function (x) { return '<button class="chip" data-x="' + x + '" type="button">' + x + '</button>'; }).join('') + '</div></div>';
    var raw = '';
    function paint() { var q = ($('lq').value || '').toLowerCase(), p = $('lgp'), near = p.scrollHeight - p.scrollTop - p.clientHeight < 50; p.textContent = (q ? raw.split('\n').filter(function (l) { return l.toLowerCase().indexOf(q) > -1; }).join('\n') : raw) || '(empty)'; if (near) p.scrollTop = p.scrollHeight; }
    function pull() { api('GET', '/api/admin/logs').then(function (j) { if (j.ok && tab === 'cs') { raw = j.lines.join('\n'); paint(); } }); }
    pull(); timer = setInterval(pull, 3000); $('lq').oninput = paint;
    $('lcp').onclick = function () { if (navigator.clipboard) navigator.clipboard.writeText(raw).then(function () { say('Copied'); }); };
    $('ldl').onclick = function () { var a = D.createElement('a'); a.href = URL.createObjectURL(new Blob([raw], { type: 'text/plain' })); a.download = 'bot-log.txt'; a.click(); };
    function run(l) { if (!l) return; cmd(l).then(function (r) { raw += '\n> ' + l + '\n' + (r.ok ? (r.out || []).join('\n') : '! ' + (r.error || 'failed')); paint(); }); $('cc').value = ''; }
    $('cr').onclick = function () { run($('cc').value.trim()); }; $('cc').onkeydown = function (ev) { if (ev.key === 'Enter') run(this.value.trim()); };
    [].forEach.call(c.querySelectorAll('[data-x]'), function (b) { b.onclick = function () { run(b.getAttribute('data-x')); }; });
  }

  /* ---------- More: upgrade, backups, admin code ---------- */
  function vMo(c) {
    c.innerHTML = '<div class="card"><h3>Admin code</h3><p class="sub">Your panel opens at <b>your-domain/&lt;code&gt;</b>. Use 8–64 letters, digits, - or _. Anyone who knows the code controls the bot, so keep it secret.</p><label for="ac">New code</label><input id="ac" placeholder="e.g. my-secret-2611" autocomplete="off" autocapitalize="off"><div class="acts"><button class="btn pri" id="acs" type="button">Change code</button></div><div class="msg" id="acm"></div></div>' +
      '<div class="card"><h3>Upgrade from a zip</h3><p class="sub">Upload a full bot zip. Sessions, ngrok.txt and .env are never touched. Replaced files are backed up first.</p><input id="up" type="file" accept=".zip" style="margin-top:12px"><div class="acts"><button class="btn pri" id="upg" type="button">Upload &amp; upgrade</button></div><div class="msg" id="upm"></div></div>' +
      '<div class="card"><h3>Backups</h3><div id="bk"><p class="note">Loading…</p></div></div>';
    api('GET', '/api/admin/backups').then(function (j) { $('bk').innerHTML = j.ok && j.backups.length ? j.backups.map(function (b) { return '<div class="row"><b>' + e(b) + '</b></div>'; }).join('') : '<p class="note">No backups yet. One is made automatically before every upgrade.</p>'; });
    $('acs').onclick = function () { api('POST', '/api/admin/code', { code: $('ac').value.trim() }).then(function (r) { setMsg($('acm'), r.ok ? 'ok' : 'err', r.ok ? 'Saved. Restart the bot, then open your-domain/' + $('ac').value.trim() : (r.error || 'Failed')); }); };
    $('upg').onclick = function () {
      var f = $('up').files[0], m = $('upm'); if (!f) { setMsg(m, 'err', 'Choose a .zip file first.'); return; }
      setMsg(m, 'ok', 'Uploading ' + (f.size / 1048576).toFixed(1) + ' MB…'); $('upg').disabled = true;
      api('POST', '/api/admin/upgrade', f, true).then(function (j) { if (j.ok) { setMsg(m, 'ok', 'Applied ' + j.files + ' files' + (j.depsChanged ? ' · installing packages (a few minutes)' : '') + ' · restarting…'); waitBack(m); } else { setMsg(m, 'err', j.error || 'Upgrade failed'); $('upg').disabled = false; } });
    };
  }

  /* ---------- finger-drag on the dock bubble ---------- */
  D.addEventListener('pointerdown', function (ev) {
    var d = ev.target.closest && ev.target.closest('#dock'); if (!d) return;
    var r = d.getBoundingClientRect(), moved = false, x0 = ev.clientX;
    function f(x) { return Math.max(0, Math.min(4, (x - r.left - 4) / ((r.width - 8) / 5) - 0.5)); }
    function mv(m) { if (!moved && Math.abs(m.clientX - x0) > 8) { moved = true; drag = true; $('db').style.transition = 'none'; } if (moved) $('db').style.setProperty('--i', f(m.clientX)); }
    function up(u) { D.removeEventListener('pointermove', mv); D.removeEventListener('pointerup', up); if (moved) { drag = false; $('db').style.transition = ''; tab = TABS[Math.round(f(u.clientX))][0]; view(); } }
    D.addEventListener('pointermove', mv); D.addEventListener('pointerup', up);
  });

  tok = lsG('adt', ''); login();
})();
