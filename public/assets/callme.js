/* Registration dialog. Shown once, after the visitor accepts the terms: name + WhatsApp number + consent.
   The server then schedules the welcome voice note (about a minute later). Styled with the site's own theme tokens. */
(function () {
  'use strict';
  var D = document, KEY = 'callme_v2', SKIP = KEY + '_skip', open = false;
  function get(store, k) { try { return window[store].getItem(k); } catch (e) { return null; } }
  function set(store, k, v) { try { window[store].setItem(k, v); } catch (e) {} }
  function consented() { try { return !!localStorage.getItem('rx_consent') || /(?:^|; )rx_consent=/.test(D.cookie); } catch (e) { return false; } }

  var css = '#cmx{position:fixed;inset:0;z-index:2147482000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,8,6,.9);overflow:auto}' +
    '#cmx .cmx-bx{width:100%;max-width:440px;max-height:calc(100dvh - 32px);overflow:auto;background:linear-gradient(180deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:22px;padding:24px 22px 20px;box-shadow:0 30px 90px -20px #000;color:var(--text);animation:cmin .35s cubic-bezier(.2,.8,.2,1)}' +
    '@keyframes cmin{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}' +
    '#cmx h2{font:800 22px/1.2 Sora,system-ui,sans-serif;margin:0 0 8px}' +
    '#cmx p{margin:0 0 14px;font-size:15px;line-height:1.65;color:var(--mute)}#cmx p.cmx-hi{margin:-6px 0 14px;font-size:14px}' +
    '#cmx label.cmx-f{display:block;margin:12px 0 6px;font-size:13px;font-weight:600;letter-spacing:.02em;color:var(--mute)}' +
    '#cmx input[type=text],#cmx input[type=tel],#cmx select{width:100%;height:48px;padding:0 14px;border-radius:13px;border:1px solid var(--line);background:var(--ink2);color:var(--text);font:500 16px "DM Sans",system-ui,sans-serif;outline:none;transition:border-color .15s}' +
    '#cmx input:focus,#cmx select:focus{border-color:var(--cyan)}#cmx ::placeholder{color:var(--mute);opacity:.6}' +
    '#cmx .cmx-row{display:flex;gap:8px}#cmx .cmx-row select{flex:0 0 42%;width:42%}#cmx .cmx-row input{flex:1;min-width:0}' +
    '#cmx label.cmx-ck{display:flex;gap:10px;align-items:flex-start;margin:16px 0 0;font-size:13.5px;line-height:1.55;color:var(--mute);cursor:pointer}' +
    '#cmx input[type=checkbox]{flex:none;width:20px;height:20px;margin-top:1px;accent-color:var(--blue)}#cmx a{color:var(--cyan);text-decoration:underline}' +
    '#cmx .cmx-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}' +
    '#cmx .cmx-er{min-height:20px;margin-top:10px;font-size:13.5px;color:var(--err)}' +
    '#cmx .cmx-ab{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}' +
    '#cmx button{flex:1 1 150px;height:48px;border-radius:13px;font:700 15px Sora,system-ui,sans-serif;cursor:pointer;border:1px solid var(--line);background:var(--ink2);color:var(--text)}' +
    '#cmx button.cmx-ok{border:0;color:#fff;background:linear-gradient(135deg,var(--blue),var(--cyan))}#cmx button:disabled{opacity:.45;cursor:not-allowed}' +
    '#cmx button:focus-visible,#cmx input:focus-visible,#cmx select:focus-visible,#cmx a:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}' +
    '#cmx .cmx-done{text-align:center;padding:6px 0 0}#cmx .cmx-done svg{width:52px;height:52px;margin:0 auto 10px;display:block;color:var(--ok)}#cmx .cmx-done p{margin-bottom:18px}' +
    '#cmx .cmx-bx{position:relative}#cmx button.cmx-x{position:absolute;top:10px;right:10px;flex:none;width:36px;height:36px;padding:0;border-radius:50%;font:400 22px/1 system-ui,sans-serif;background:var(--ink2);color:var(--mute)}#cmx button.cmx-x:hover{color:var(--text)}' +
    '#cmx .cmx-num{margin:4px 0 10px;padding:12px 14px;border-radius:13px;border:1px dashed var(--line);background:var(--ink2);text-align:center;font:800 22px Sora,system-ui,sans-serif;letter-spacing:.04em;color:var(--text);user-select:all}' +
    '#cmx .cmx-msg{margin:0 0 12px;padding:10px 14px;border-radius:13px;background:var(--ink2);border:1px solid var(--line);font-size:14px;line-height:1.55;color:var(--text)}#cmx .cmx-msg small{display:block;margin-bottom:4px;font-size:12px;font-weight:600;color:var(--mute)}' +
    '#cmx .cmx-note{margin:12px 0 0;padding:10px 12px;border-radius:12px;background:var(--ink2);border:1px solid var(--line);font-size:13px;line-height:1.6;color:var(--mute)}#cmx .cmx-note b{color:var(--text)}' +
    '@media (prefers-reduced-motion:reduce){#cmx .cmx-bx{animation:none}}';

  var COUNTRIES = [['India', '91'], ['Pakistan', '92'], ['Bangladesh', '880'], ['Nepal', '977'], ['Sri Lanka', '94'], ['United Arab Emirates', '971'], ['Saudi Arabia', '966'], ['Qatar', '974'], ['Kuwait', '965'], ['Oman', '968'], ['United Kingdom', '44'], ['United States / Canada', '1'], ['Australia', '61'], ['Singapore', '65'], ['Malaysia', '60'], ['Indonesia', '62'], ['Nigeria', '234'], ['South Africa', '27']];
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function show() {
    if (open || D.getElementById('cmx')) return; open = true;
    var st = D.createElement('style'); st.textContent = css; D.head.appendChild(st);
    var root = D.createElement('div'); root.id = 'cmx'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'cmx-h');
    root.innerHTML = '<div class="cmx-bx"><h2 id="cmx-h">Get a quick voice walkthrough</h2>' +
      '<p>This step is <b>optional</b>. We use your name to greet you and your number only to send one short welcome voice note from our assistant Arya on WhatsApp, and to answer if you reply by voice or text. Nothing else.</p>' +
      '<p class="cmx-hi">After you register you will be asked to message our WhatsApp number first. The voice note is sent only after you do that. Send STOP at any time to end it.</p>' +
      '<label class="cmx-f" for="cmx-n">Your name</label><input id="cmx-n" type="text" maxlength="40" autocomplete="given-name" placeholder="Rahul">' +
      '<label class="cmx-f" for="cmx-p">WhatsApp number</label><div class="cmx-row"><select id="cmx-c" aria-label="Country code"></select><input id="cmx-p" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="16" placeholder="98765 43210"></div>' +
      '<input class="cmx-hp" id="cmx-w" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<label class="cmx-ck"><input type="checkbox" id="cmx-k"><span>I agree to receive this WhatsApp voice message and the assistant\'s replies. Send STOP at any time and they end. My name and number are kept only for this purpose, as described in the <a href="/privacy#collect" target="_blank" rel="noopener">Privacy Policy</a>.</span></label>' +
      '<div class="cmx-er" id="cmx-e" role="alert" aria-live="polite"></div>' +
      '<div class="cmx-ab"><button class="cmx-ok" id="cmx-g" type="button" disabled>Register</button><button id="cmx-s" type="button">Not now</button></div></div>';
    D.body.appendChild(root);

    var $ = function (i) { return root.querySelector('#' + i); }, sel = $('cmx-c'), n = $('cmx-n'), p = $('cmx-p'), k = $('cmx-k'), g = $('cmx-g'), e = $('cmx-e'), box = root.querySelector('.cmx-bx');
    COUNTRIES.forEach(function (c) { var o = D.createElement('option'); o.value = c[1]; o.textContent = '+' + c[1] + '  ' + c[0]; sel.appendChild(o); });
    function valid() { return n.value.trim().length >= 2 && p.value.replace(/\D/g, '').length >= 7 && k.checked; }
    function update() { g.disabled = !valid(); }
    [n, p].forEach(function (x) { x.addEventListener('input', update); }); k.addEventListener('change', update);
    function close() { root.remove(); D.removeEventListener('keydown', key); }
    function key(ev) {
      if (ev.key === 'Escape') { set('sessionStorage', SKIP, '1'); close(); return; }
      if (ev.key !== 'Tab') return;
      var f = box.querySelectorAll('input:not(.hp),select,button:not(:disabled),a'); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && D.activeElement === first) { ev.preventDefault(); last.focus(); } else if (!ev.shiftKey && D.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
    D.addEventListener('keydown', key);
    $('cmx-s').addEventListener('click', function () { set('sessionStorage', SKIP, '1'); close(); });

    function addClose() {                                  // the little X (top right) works on every screen of the popup
      var x = D.createElement('button'); x.type = 'button'; x.className = 'cmx-x'; x.setAttribute('aria-label', 'Close'); x.innerHTML = '&times;';
      x.addEventListener('click', function () { set('sessionStorage', SKIP, '1'); close(); }); box.appendChild(x);
    }
    addClose();
    function finish(title, text) {
      box.innerHTML = '<div class="cmx-done">' + CHECK + '<h2></h2><p></p><div class="cmx-ab"><button class="cmx-ok" id="cmx-d" type="button">Done</button></div></div>';
      box.querySelector('h2').textContent = title; box.querySelector('p').textContent = text; addClose();
      $('cmx-d').addEventListener('click', close); $('cmx-d').focus();
    }
    // Step 2: the visitor must tap Continue. Only then the voice note is scheduled (server: /api/register-call/confirm) and WhatsApp opens
    // on the owner number with the message ready. The popup closes by itself; the X (top right) closes it too, but then NO voice note is sent.
    function step2(j) {
      var owner = String(j.owner).replace(/\D/g, ''), hi = j.hiText || 'Hi', m = Number(j.minutes) || 1;
      var link = 'https://wa.me/' + owner + '?text=' + encodeURIComponent(hi);
      box.innerHTML = '<div class="cmx-done">' + CHECK + '<h2></h2><p class="cmx-a"></p></div>' +
        '<div class="cmx-num" id="cmx-o"></div>' +
        '<div class="cmx-msg"><small>Message</small><span id="cmx-t"></span></div>' +
        '<div class="cmx-ab"><button class="cmx-ok" id="cmx-go" type="button">Continue</button><button id="cmx-cp" type="button">Copy number</button></div>' +
        '<div class="cmx-er" id="cmx-e2" role="alert" aria-live="polite"></div>' +
        '<div class="cmx-note"><b>Note:</b> When you tap <b>Continue</b> you will be taken to WhatsApp. <b>First save this number, then send the message.</b> Your voice note arrives about ' + m + (m === 1 ? ' minute' : ' minutes') + ' after you tap Continue. <b>If you do not tap Continue, no voice note is sent.</b></div>';
      box.querySelector('h2').textContent = 'One last step';
      box.querySelector('.cmx-a').textContent = 'Tap Continue and send the message to our WhatsApp number.';
      $('cmx-o').textContent = '+' + owner; $('cmx-t').textContent = hi; addClose();
      $('cmx-cp').addEventListener('click', function () {
        var b = $('cmx-cp'), t = '+' + owner;
        (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { b.textContent = 'Copied ✓'; }).catch(function () { b.textContent = t; });
        setTimeout(function () { b.textContent = 'Copy number'; }, 1800);
      });
      $('cmx-go').addEventListener('click', function () {
        var go = $('cmx-go'), er = $('cmx-e2'); er.textContent = ''; go.disabled = true; go.textContent = 'Please wait…';
        fetch('/api/register-call/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: j.id }) })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok && b.ok, b: b }; }); })
          .then(function (x) {
            if (!x.ok) throw new Error(x.b.error || 'Something went wrong. Please try again.');
            set('localStorage', KEY, '1');
            close();                                            // popup closes by itself ...
            window.location.href = link;                        // ... and WhatsApp opens on the owner number
          })
          .catch(function (err) { er.textContent = /failed to fetch|networkerror/i.test(err.message) ? 'Could not reach the server. Please try again.' : err.message; go.disabled = false; go.textContent = 'Continue'; });
      });
      $('cmx-go').focus();
    }
    g.addEventListener('click', function () {
      if (!valid()) return;
      e.textContent = ''; g.disabled = true; g.textContent = 'Registering…';
      var local = p.value.replace(/\D/g, '').replace(/^0+/, ''), cc = sel.value;
      if (local.indexOf(cc) === 0 && local.length > 10) local = local.slice(cc.length);          // pasted together with the country code
      fetch('/api/register-call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n.value, number: cc + local, consent: true, website: $('cmx-w').value }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j.ok, j: j }; }); })
        .then(function (x) {
          if (!x.ok) throw new Error(x.j.error || 'Something went wrong. Please try again.');
          if (x.j.owner && x.j.awaiting && x.j.id) return step2(x.j);          // KEY is saved only after Continue, so a closed popup can come back
          set('localStorage', KEY, '1');
          if (x.j.already) return finish('Already registered', x.j.sent ? 'The voice note is already in your WhatsApp. Open the chat and say hi.' : 'This number is registered. Your voice note will arrive shortly.');
          var m = Number(x.j.minutes) || 1;
          finish('You are registered', 'Keep an eye on WhatsApp. Your voice note arrives in about ' + m + (m === 1 ? ' minute' : ' minutes') + '.');
        })
        .catch(function (err) { e.textContent = /failed to fetch|networkerror/i.test(err.message) ? 'Could not reach the server. Please try again.' : err.message; g.textContent = 'Register'; update(); });
    });
    n.focus();
  }

  var tries = 0;
  (function wait() {                                       // wait until the terms gate has been accepted and is gone
    if (get('localStorage', KEY) || get('sessionStorage', SKIP) || ++tries > 7200) return;
    if (consented() && !D.getElementById('rxc') && D.body && D.body.getAttribute('data-page') !== 'legal') return void setTimeout(show, 700);
    setTimeout(wait, 500);
  })();
})();
