/* Legal links in the footer, e-mail fill-in, first-visit consent gate (Terms, Privacy, Disclaimer, 18+) with a SEPARATE optional-preferences choice. No tracking. */
(function () {
  'use strict';
  var V = 3, KEY = 'rx_consent', OPTKEYS = ['theme','acc','fx','snd','kob_zoom','srv','kob_iso','kob_ann'], D = document, R = D.documentElement;
  function ls(m, k, v) { try { return m === 'g' ? localStorage.getItem(k) : m === 's' ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) { return null; } }
  function cookieHas() { return new RegExp('(?:^|; )' + KEY + '=' + V + '(?:;|$)').test(D.cookie); }
  function given() {
    var j = null; try { j = JSON.parse(ls('g', KEY) || 'null'); } catch (e) {}
    return (j && j.v === V) || cookieHas();
  }
  function rec() { var j = null; try { j = JSON.parse(ls('g', KEY) || 'null'); } catch (e) {} return j && j.v === V ? j : null; }
  function save(opt) {
    ls('s', KEY, JSON.stringify({ v: V, t: Date.now(), opt: !!opt }));
    D.cookie = KEY + '=' + V + '; Max-Age=31536000; Path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
    if (!opt) clearOptional();
  }
  function clearOptional() { OPTKEYS.forEach(function (k) { ls('r', k); }); }
  function withdraw() {   // withdraw ALL consent: policies, optional preferences and the visitor ID (and the website AI chat memory tied to it)
    var sid = ls('g', 'sid');
    if (sid) { try { fetch('/api/ai/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sid: sid }) }).catch(function () {}); } catch (e) {} }
    clearOptional(); ls('r', 'sid'); ls('r', KEY); D.cookie = KEY + '=; Max-Age=0; Path=/; SameSite=Lax';
    if (box) { box.remove(); box = null; } gate(true, true);
  }
  function page() { return D.body && D.body.getAttribute('data-page'); }

  // ---------- footer links + support e-mail fill-in
  function footer() {
    var f = D.querySelector('.fcopy');
    if (f && !D.getElementById('lglinks')) {
      var d = D.createElement('div'); d.id = 'lglinks'; d.className = 'lglinks';
      d.innerHTML = '<a href="/terms" data-nav>Terms</a><a href="/privacy" data-nav>Privacy</a><a href="/cookies" data-nav>Cookies</a><a href="/disclaimer" data-nav>Disclaimer</a><a role="button" tabindex="0" id="rxpc">Privacy choices</a>';
      f.parentNode.insertBefore(d, f);
      var b = D.getElementById('rxpc');
      b.addEventListener('click', function () { gate(true); });
      b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); gate(true); } });
    }
    var em = (window.SITE && window.SITE.email) || '';
    [].forEach.call(D.querySelectorAll('[data-site="email"]'), function (s) {
      if (s.getAttribute('data-f')) return;
      if (!em) {   // no support e-mail configured: drop the placeholder instead of showing "our support e-mail"
        var p = s.previousSibling, n = s.nextSibling;
        if (p && p.nodeType === 3) p.nodeValue = p.nodeValue.replace(/e-mail\s*$/i, '');
        if (n && n.nodeType === 3) n.nodeValue = n.nodeValue.replace(/^\s*,\s*/, '');
        s.parentNode.removeChild(s); s.setAttribute('data-f', '1'); return;
      }
      var a = D.createElement('a'); a.href = 'mailto:' + em; a.textContent = em; s.textContent = ''; s.appendChild(a); s.setAttribute('data-f', '1');
    });
  }

  // ---------- table-of-contents jumps on legal pages
  D.addEventListener('click', function (e) {
    if (page() !== 'legal') return;
    var a = e.target.closest && e.target.closest('[data-jump]'); if (!a) return;
    e.preventDefault(); var t = D.getElementById(a.getAttribute('data-jump'));
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ---------- consent gate
  var box = null;
  function close() { if (box) { box.remove(); box = null; } R.classList.remove('rxlock'); var m = D.getElementById('app'); if (m) m.removeAttribute('aria-hidden'); }
  function gate(force, fresh) {
    if (box) return;
    var cur = fresh ? null : rec();
    if (!force && (given() || page() === 'legal')) return;
    box = D.createElement('div'); box.id = 'rxc'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'rxt');
    var date = cur && cur.t ? new Date(cur.t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    if (cur) {   // Privacy choices: current status, change optional choice, or withdraw
      box.innerHTML =
        '<div class="bx"><h2 id="rxt">Privacy choices</h2>' +
        '<p><b>Current status:</b> policies accepted on ' + date + ' (version ' + V + '). Optional preferences: <b>' + (cur.opt ? 'ON' : 'OFF') + '</b>.</p>' +
        '<ul class="pt"><li>Essential storage (this choice, the unlock cookie if the site lock is on, the visitor ID used by Preview and AI Support, and the page cache) always stays on because the site cannot work without it.</li><li>Optional preferences are your theme, colour, sounds, zoom, selected server, country code and closed notices.</li></ul>' +
        '<label><input type="checkbox" id="rxo"' + (cur.opt ? ' checked' : '') + '><span>Remember my display and form choices on this device (optional).</span></label>' +
        '<div class="ab"><button type="button" id="rxw">Withdraw all consent</button><button type="button" id="rxc2">Close</button><button type="button" class="ok" id="rxs">Save choice</button></div></div>';
      D.body.appendChild(box);
      D.getElementById('rxs').addEventListener('click', function () { save(D.getElementById('rxo').checked); box.remove(); box = null; });
      D.getElementById('rxc2').addEventListener('click', function () { box.remove(); box = null; });
      D.getElementById('rxw').addEventListener('click', withdraw);
      D.getElementById('rxo').focus(); return;
    }
    box.innerHTML =
      '<div class="bx"><h2 id="rxt">Before you continue</h2>' +
      '<p>Please read and accept our policies to use this website and the bot.</p>' +
      '<ul class="pt"><li>We use the phone number you enter and the linked WhatsApp session only to run your bot.</li><li>No ads and no analytics or tracking cookies. Fonts load from Google Fonts, which sees your IP address.</li><li>Essential browser storage is always used: this choice, the unlock cookie when the site lock is on, a random visitor ID for Preview and AI Support, and a page cache. See the <a href="/cookies" target="_blank" rel="noopener">Cookie Policy</a>.</li><li>The bot is built by an independent team and works through WhatsApp\'s linked-devices feature, so WhatsApp\'s own rules apply to your number. Heavy automated messaging can lead to limits set by WhatsApp.</li><li>You can withdraw consent at any time with &ldquo;Privacy choices&rdquo; in the footer, and ask us to delete your data.</li></ul>' +
      '<label><input type="checkbox" id="rx1"><span>I am <b>18 or older</b> and I have read and agree to the <a href="/terms" target="_blank" rel="noopener">Terms &amp; Conditions</a>, <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a> and <a href="/disclaimer" target="_blank" rel="noopener">Disclaimer</a>. <i>(Required)</i></span></label>' +
      '<label><input type="checkbox" id="rx2"><span>Remember my display and form choices on this device (theme, colour, sounds, zoom, server, country code, closed notices). <i>(Optional, you can change this later.)</i></span></label>' +
      '<div class="ab"><button type="button" id="rxn">Decline</button><button type="button" class="ok" id="rxy" disabled>Accept &amp; continue</button></div></div>';
    D.body.appendChild(box); R.classList.add('rxlock');
    var m = D.getElementById('app'); if (m) m.setAttribute('aria-hidden', 'true');
    var c1 = D.getElementById('rx1'), c2 = D.getElementById('rx2'), y = D.getElementById('rxy');
    function upd() { y.disabled = !c1.checked; }
    c1.addEventListener('change', upd);
    y.addEventListener('click', function () { if (y.disabled) return; save(c2.checked); close(); });
    D.getElementById('rxn').addEventListener('click', function () {
      box.querySelector('.bx').innerHTML = '<h2>You declined</h2><p>Without accepting the Terms, Privacy Policy and Disclaimer (and confirming you are 18 or older) we cannot let you link a number or use the bot features. Nothing has been saved.</p><div class="ab"><button type="button" class="ok" id="rxb">Review again</button></div>';
      D.getElementById('rxb').addEventListener('click', function () { box.remove(); box = null; gate(true, true); });
    });
    c1.focus();
  }
  function counts() { var els = D.querySelectorAll('[data-cmdn]'); if (!els.length || !window.fetch) return; fetch('/api/command-count', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.ok && j.total > 0) [].forEach.call(D.querySelectorAll('[data-cmdn]'), function (e) { e.textContent = String(j.total); }); }).catch(function () {}); }
  function init() {
    footer(); gate(); counts();
    if (window.MutationObserver) {
      new MutationObserver(function () { footer(); if (!given() && page() !== 'legal') gate(); }).observe(D.body, { attributes: true, attributeFilter: ['data-page'] });
      var t = 0; new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { footer(); counts(); }, 120); }).observe(D.body, { childList: true, subtree: true });
    }
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init); else init();
})();
