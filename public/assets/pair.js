window.KOB_PAIR = function () {
  // Where the bot's pairing server lives. Same site => leave empty. Hosted elsewhere (e.g. Google AI Studio) => set once:
  //   window.PAIR_API_BASE = "https://your-bot-domain.com";   or open the local file with ?api=https://your-bot-domain.com (file:// only)
  var API = (window.PAIR_API_BASE || (location.protocol === 'file:' ? new URLSearchParams(location.search).get('api') : '') || '').replace(/\/$/, '');   // ?api= is honoured only for a locally opened file, so a shared link can never send a visitor's number / keys to another server

  // ISO:Name:DialCode — flag emoji is built from the ISO code
  var RAW = "IN:India:91,PK:Pakistan:92,BD:Bangladesh:880,NP:Nepal:977,LK:Sri Lanka:94,US:United States:1,CA:Canada:1,DO:Dominican Republic:1,GB:United Kingdom:44,AE:United Arab Emirates:971,SA:Saudi Arabia:966,QA:Qatar:974,KW:Kuwait:965,OM:Oman:968,BH:Bahrain:973,TR:Türkiye:90,EG:Egypt:20,NG:Nigeria:234,GH:Ghana:233,KE:Kenya:254,ZA:South Africa:27,ID:Indonesia:62,MY:Malaysia:60,SG:Singapore:65,PH:Philippines:63,BR:Brazil:55,MX:Mexico:52,AR:Argentina:54,CO:Colombia:57,ES:Spain:34,FR:France:33,DE:Germany:49,IT:Italy:39,RU:Russia:7,AF:Afghanistan:93,IQ:Iraq:964,IR:Iran:98,AU:Australia:61,AL:Albania:355,DZ:Algeria:213,AO:Angola:244,AM:Armenia:374,AT:Austria:43,AZ:Azerbaijan:994,BY:Belarus:375,BE:Belgium:32,BJ:Benin:229,BT:Bhutan:975,BO:Bolivia:591,BA:Bosnia & Herzegovina:387,BW:Botswana:267,BN:Brunei:673,BG:Bulgaria:359,BF:Burkina Faso:226,BI:Burundi:257,KH:Cambodia:855,CM:Cameroon:237,CL:Chile:56,CN:China:86,CR:Costa Rica:506,CI:Côte d’Ivoire:225,HR:Croatia:385,CU:Cuba:53,CY:Cyprus:357,CZ:Czechia:420,CD:DR Congo:243,DK:Denmark:45,DJ:Djibouti:253,EC:Ecuador:593,SV:El Salvador:503,EE:Estonia:372,ET:Ethiopia:251,FJ:Fiji:679,FI:Finland:358,GA:Gabon:241,GM:Gambia:220,GE:Georgia:995,GR:Greece:30,GT:Guatemala:502,GN:Guinea:224,GY:Guyana:592,HT:Haiti:509,HN:Honduras:504,HK:Hong Kong:852,HU:Hungary:36,IS:Iceland:354,IE:Ireland:353,IL:Israel:972,JM:Jamaica:1,JP:Japan:81,JO:Jordan:962,KZ:Kazakhstan:7,KG:Kyrgyzstan:996,LA:Laos:856,LV:Latvia:371,LB:Lebanon:961,LS:Lesotho:266,LR:Liberia:231,LY:Libya:218,LT:Lithuania:370,LU:Luxembourg:352,MO:Macau:853,MG:Madagascar:261,MW:Malawi:265,MV:Maldives:960,ML:Mali:223,MT:Malta:356,MR:Mauritania:222,MU:Mauritius:230,MD:Moldova:373,MN:Mongolia:976,ME:Montenegro:382,MA:Morocco:212,MZ:Mozambique:258,MM:Myanmar:95,NA:Namibia:264,NL:Netherlands:31,NZ:New Zealand:64,NI:Nicaragua:505,NE:Niger:227,MK:North Macedonia:389,NO:Norway:47,PS:Palestine:970,PA:Panama:507,PG:Papua New Guinea:675,PY:Paraguay:595,PE:Peru:51,PL:Poland:48,PT:Portugal:351,PR:Puerto Rico:1,RO:Romania:40,RW:Rwanda:250,SN:Senegal:221,RS:Serbia:381,SL:Sierra Leone:232,SK:Slovakia:421,SI:Slovenia:386,SO:Somalia:252,KR:South Korea:82,SS:South Sudan:211,SD:Sudan:249,SR:Suriname:597,SE:Sweden:46,CH:Switzerland:41,SY:Syria:963,TW:Taiwan:886,TJ:Tajikistan:992,TZ:Tanzania:255,TH:Thailand:66,TG:Togo:228,TT:Trinidad & Tobago:1,TN:Tunisia:216,TM:Turkmenistan:993,UG:Uganda:256,UA:Ukraine:380,UY:Uruguay:598,UZ:Uzbekistan:998,VE:Venezuela:58,VN:Vietnam:84,YE:Yemen:967,ZM:Zambia:260,ZW:Zimbabwe:263";
  var C = RAW.split(',').map(function (x) { var p = x.split(':'); return { iso: p[0], name: p[1], dial: p[2] }; });
  function flag(iso) { return String.fromCodePoint.apply(null, iso.split('').map(function (c) { return 0x1F1E6 + c.charCodeAt(0) - 65; })); }
  var $ = function (id) { return document.getElementById(id); };
  var num = $('num'), go = $('go'), msg = $('msg');
  var pick = $('cpick'), clist = $('clist'), csearch = $('csearch');
  var sel = null; try { sel = localStorage.getItem('kob_iso'); } catch (e) {}
  var cur = C.filter(function (c) { return c.iso === (sel || 'IN'); })[0] || C[0];
  var cc = { get value() { return cur.dial; } };

  function setCountry(c) { cur = c; $('cflag').textContent = flag(c.iso); $('cdial').textContent = '+' + c.dial; try { var cj = JSON.parse(localStorage.getItem('rx_consent') || 'null'); if (cj && cj.opt === true) localStorage.setItem('kob_iso', c.iso); } catch (e) {} }
  function renderList(q) {
    q = (q || '').toLowerCase().replace(/^\+/, '');
    clist.innerHTML = '';
    C.filter(function (c) { return !q || c.name.toLowerCase().indexOf(q) > -1 || c.dial.indexOf(q) === 0 || c.iso.toLowerCase() === q; }).forEach(function (c) {
      var d = document.createElement('div'); d.className = 'ci' + (c.iso === cur.iso ? ' sel' : ''); d.setAttribute('role', 'option');
      d.innerHTML = '<span>' + flag(c.iso) + '</span><span class="n"></span><span class="d">+' + c.dial + '</span>';
      d.querySelector('.n').textContent = c.name;
      d.addEventListener('click', function () { setCountry(c); pick.classList.remove('open'); num.focus(); });
      clist.appendChild(d);
    });
    if (!clist.children.length) clist.innerHTML = '<div class="ci"><span class="n">No country found</span></div>';
  }
  setCountry(cur);
  $('cbtn').addEventListener('click', function (e) { e.stopPropagation(); pick.classList.toggle('open'); if (pick.classList.contains('open')) { csearch.value = ''; renderList(''); setTimeout(function () { csearch.focus(); }, 30); } });
  csearch.addEventListener('input', function () { renderList(csearch.value); });
  document.addEventListener('click', function (e) { if (!pick.contains(e.target)) pick.classList.remove('open'); });

  var timerId = null, pollId = null, current = null;

  function show(t, kind) { msg.className = 'msg ' + kind; msg.textContent = t; }
  function clearMsg() { msg.className = 'msg'; msg.textContent = ''; }
  function stopAll() { clearInterval(timerId); clearInterval(pollId); }

  function api(path, opt) {
    opt = opt || {}; opt.headers = Object.assign({ 'ngrok-skip-browser-warning': '1' }, opt.headers || {});
    return fetch(API + path, opt).then(function (r) { return r.json().then(function (j) { j._status = r.status; return j; }); });
  }

  function fullNumber() {
    var local = num.value.replace(/\D/g, '').replace(/^0+/, '');
    var code = cc.value;
    // if the user pasted the whole number including the country code, don't add it twice
    if (local.indexOf(code) === 0 && local.length > 10) local = local.slice(code.length);
    return code + local;
  }

  function startTimer(sec) {
    var left = sec; stopAll();
    var el = $('timer');
    function tick() { el.textContent = left > 0 ? 'Enter it within ' + left + 's' : 'Code may have expired — tap Get code again'; if (left-- < 0) clearInterval(timerId); }
    tick(); timerId = setInterval(tick, 1000);
  }

  function pollStatus(number) {
    var tries = 0;
    pollId = setInterval(function () {
      if (++tries > 150) return clearInterval(pollId);
      api('/api/status/' + number).then(function (j) {
        if (j && j.connected) { stopAll(); $('codeCard').style.display = 'none'; $('doneCard').style.display = 'block'; }
      }).catch(function () {});
    }, 2000);
  }

  go.addEventListener('click', function () {
    clearMsg();
    var local = num.value.replace(/\D/g, '');
    if (local.length < 6) return show('Please enter your WhatsApp number.', 'err');
    var number = fullNumber();
    go.disabled = true; go.innerHTML = '<span class="spin"></span>Creating your session…';
    api('/api/pair', { method: 'POST', headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }, body: JSON.stringify({ number: number, server: window.KOB_SRV || 1, profile: window.KOB_PROFILE || undefined, aiKey: (($('aikey') || {}).value || '').trim() || undefined }) })
      .then(function (j) {
        if (!j.ok) throw new Error(j.error || 'Something went wrong. Please try again.');
        if (j.alreadyLinked) { $('doneCard').style.display = 'block'; return show('This number is already connected ✅' + (j.aiKeyNote ? ' — ' + j.aiKeyNote : ''), 'ok'); }
        current = number;
        $('code').textContent = j.code; if (j.editKey && window.KOB_ONKEY) window.KOB_ONKEY(j.editKey, j.logo);
        $('codeCard').style.display = 'block';
        $('codeCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
        startTimer(j.expiresIn || 60); pollStatus(number);
      })
      .catch(function (e) { show(e.message === 'Failed to fetch' ? 'Cannot reach the bot server. Check the link / try again later.' : e.message, 'err'); })
      .finally(function () { go.disabled = false; go.textContent = 'Get pairing code'; });
  });

  $('copy').addEventListener('click', function () {
    var t = $('code').textContent.replace(/-/g, '');
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { $('copy').textContent = 'Copied ✓'; setTimeout(function () { $('copy').textContent = 'Copy code'; }, 1500); }).catch(function () { $('copy').textContent = t; });
  });
  num.addEventListener('keydown', function (e) { if (e.key === 'Enter') go.click(); });
};
