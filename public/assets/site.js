
(function(){
  var $=function(i){return document.getElementById(i)},R=document.documentElement;
  function lsG(k,d){try{var v=localStorage.getItem(k);return v===null?d:v}catch(e){return d}}var OPTK=/^(theme|acc|fx|snd|kob_zoom|srv|kob_iso|kob_ann)$/;function optOk(){try{var j=JSON.parse(localStorage.getItem('rx_consent')||'null');return !!(j&&j.opt===true)}catch(e){return false}}function lsS(k,v){try{if(OPTK.test(k)&&!optOk())return;localStorage.setItem(k,v)}catch(e){}}
  var snd=lsG('snd','1')!=='0',FX=lsG('fx','0')==='1',ac=null,out=null,an=null,au=null,lv=0,started=false;   // snd = background naat ON/OFF (default ON). FX = button sounds, default OFF
  // ---------- sound engine (synth only, no files)
  function ctx(){if(ac)return ac;try{ac=new (window.AudioContext||window.webkitAudioContext)();out=ac.createGain();out.gain.value=.9;var d=ac.createDelay(),f=ac.createGain(),w=ac.createGain();d.delayTime.value=.19;f.gain.value=.16;w.gain.value=.12;out.connect(ac.destination);out.connect(d);d.connect(f);f.connect(d);d.connect(w);w.connect(ac.destination)}catch(e){ac=null}return ac}
  function N(f,d,t,o){o=o||{};if(!FX||!ctx())return;var s=ac.currentTime+(t||0),os=ac.createOscillator(),g=ac.createGain(),fl=ac.createBiquadFilter();os.type=o.type||'sine';os.frequency.setValueAtTime(f,s);if(o.to)os.frequency.exponentialRampToValueAtTime(o.to,s+d);fl.type='lowpass';fl.frequency.value=o.lp||5000;g.gain.setValueAtTime(.0001,s);g.gain.exponentialRampToValueAtTime(o.v||.06,s+(o.a||.012));g.gain.exponentialRampToValueAtTime(.0001,s+d);os.connect(fl);fl.connect(g);g.connect(out);os.start(s);os.stop(s+d+.05)}
  function W(d,a,b,v,t){if(!FX||!ctx())return;var s=ac.currentTime+(t||0),n=ac.sampleRate*d|0,bf=ac.createBuffer(1,n,ac.sampleRate),x=bf.getChannelData(0),i;for(i=0;i<n;i++)x[i]=Math.random()*2-1;var src=ac.createBufferSource(),fl=ac.createBiquadFilter(),g=ac.createGain();src.buffer=bf;fl.type='bandpass';fl.Q.value=1.4;fl.frequency.setValueAtTime(a,s);fl.frequency.exponentialRampToValueAtTime(b,s+d);g.gain.setValueAtTime(.0001,s);g.gain.exponentialRampToValueAtTime(v||.05,s+d*.4);g.gain.exponentialRampToValueAtTime(.0001,s+d);src.connect(fl);fl.connect(g);g.connect(out);src.start(s)}
  function PL(f,d,t,v,tp){N(f,d,t,{type:tp||'sine',v:v||.05,a:.004,lp:6000})}
  var S={
    tap:function(){N(1500,.06,0,{v:.035,a:.003,to:900,lp:7000})},
    send:function(){PL(659,.18,0,.05);PL(988,.26,.07,.05)},
    recv:function(){PL(880,.3,0,.045,'triangle');PL(1318,.4,.1,.04,'triangle')},
    code:function(){[523,659,784,1046].forEach(function(f,i){PL(f,1.1,i*.09,.05)})},
    win:function(){[523,587,659,784,880,1046].forEach(function(f,i){PL(f,.7,i*.08,.055,'triangle')})},
    err:function(){N(150,.25,0,{v:.06,to:90,a:.006,lp:600})},
    theme:function(){PL(784,.4,0,.045);PL(1175,.5,.08,.04)}
  };
  Object.keys(S).forEach(function(k){var f=S[k];S[k]=function(){try{f()}catch(e){}}});   // sound problems must never block the page
  // ---------- nav: sound + theme buttons
  var nav=document.querySelector('nav'),pill=nav.querySelector('.pill'),w=document.createElement('div');w.className='navr';nav.insertBefore(w,pill);
  var sb=document.createElement('button');sb.className='snd';sb.type='button';sb.setAttribute('aria-label','Toggle sound');
  var th=document.createElement('div');th.className='thm';th.innerHTML='<button class="snd" type="button" aria-label="Change theme" id="thb">\uD83C\uDFA8</button><div class="pop" id="pop"></div>';
  var fb=document.createElement('button');fb.className='snd';fb.type='button';fb.setAttribute('aria-label','Toggle button sounds');fb.title='Button sounds';sb.title='Menu song music';w.appendChild(th);w.appendChild(fb);w.appendChild(sb);w.appendChild(pill);
  function paint(){sb.textContent=snd?'\uD83C\uDFB5':'\uD83D\uDD07';fb.textContent=FX?'\uD83D\uDD14':'\uD83D\uDD15'}paint();fb.onclick=function(){FX=!FX;lsS('fx',FX?'1':'0');paint();S.tap()};
  sb.onclick=function(){setMusic(!snd)};

  // ---------- background naat (separate from effects): default ON, can be switched off; starts on first touch/click (browser rule)
  au=new Audio('/assets/menu-song.mp3');au.loop=true;au.preload='none';au.volume=.7;
  var pl=document.createElement('div');pl.className='player';pl.innerHTML='<button type="button" id="pbtn" aria-label="Play or pause music"></button><div class="eq"><i></i><i></i><i></i><i></i><i></i></div><span>Menu Song</span>';document.body.appendChild(pl);
  function pstate(on){pl.classList.toggle('on',on);$('pbtn').textContent=on?'\u275A\u275A':'\u25B6'}
  function wire(){if(an||!ctx())return;try{var ms=ac.createMediaElementSource(au);an=ac.createAnalyser();an.fftSize=128;an.smoothingTimeConstant=.82;ms.connect(an);an.connect(ac.destination)}catch(e){an=null}}
  function play(){if(!snd)return;if(ac&&ac.state==='suspended')ac.resume();wire();var p=au.play();if(p&&p.then)p.then(function(){started=true;pstate(true)}).catch(function(){pstate(false)})}
  function stop(){au.pause();pstate(false)}
  function setMusic(on){snd=on;lsS('snd',on?'1':'0');paint();on?play():stop()}
  ['pointerdown','touchstart','keydown','click'].forEach(function(ev){addEventListener(ev,function f(){if(snd&&!started)play();if(started)removeEventListener(ev,f)},{passive:true})});
  $('pbtn').onclick=function(e){e.stopPropagation();setMusic(au.paused)};
  pstate(false);if(snd)play();
  var TH=[['black','Black','#f54e00','#ff8a4c','#050506'],['white','White','#f54e00','#ff7a33','#f2f2f7']];
  function cols(){var c=getComputedStyle(R);return[c.getPropertyValue('--cyan').trim()||'#d28bff',c.getPropertyValue('--blue').trim()||'#9b3dff']}
  var pal=cols();
  function setTheme(n,quiet){if(!TH.some(function(t){return t[0]===n}))n='black';R.setAttribute('data-theme',n);lsS('theme',n);[].forEach.call($('pop').children,function(d){if(!d.getAttribute('data-n'))return;d.className='thi'+(d.getAttribute('data-n')===n?' on':'')});pal=cols();if(typeof rainInit==='function'&&W0)rainInit();var m=document.querySelector('meta[name=theme-color]');if(m)m.content=getComputedStyle(R).getPropertyValue('--bg').trim()||'#0a0014';if(!quiet)S.theme()}
  TH.forEach(function(t){var d=document.createElement('button');d.type='button';d.setAttribute('data-n',t[0]);d.className='thi';d.innerHTML='<i><b style="background:'+t[2]+'"></b><b style="background:'+t[3]+'"></b><b style="background:'+t[4]+'"></b></i>'+t[1];d.onclick=function(e){e.stopPropagation();setTheme(t[0]);th.classList.remove('open')};$('pop').appendChild(d)});

  var PRE=[['Emerald','#10b981','#5eead4'],['Ocean','#9b3dff','#d28bff'],['Violet','#8b5cf6','#f472b6'],['Sunset','#f97316','#fbbf24'],['Crimson','#ef4444','#fb7185'],['Gold','#c9a227','#f5d76e'],['Mint','#14b8a6','#a7f3d0'],['Neon','#a3e635','#22d3ee']];
  function hx2(h,k){var n=parseInt(h.slice(1),16);return'#'+[n>>16&255,n>>8&255,n&255].map(function(v){return('0'+Math.round(v*k).toString(16)).slice(-2)}).join('')}
  function setAccent(c1,c2,quiet){R.style.setProperty('--blue',c1);R.style.setProperty('--cyan',c2);R.style.setProperty('--glow',hx2(c1,.45));lsS('acc',c1+','+c2);pal=cols();[].forEach.call(document.querySelectorAll('.sw'),function(b){b.className='sw'+(b.getAttribute('data-a')===c1+','+c2?' on':'')});var i1=$('c1'),i2=$('c2');if(i1)i1.value=c1;if(i2)i2.value=c2;if(!quiet)S.theme()}
  function resetAccent(){['--blue','--cyan','--glow'].forEach(function(k){R.style.removeProperty(k)});lsS('acc','');pal=cols();[].forEach.call(document.querySelectorAll('.sw'),function(b){b.className='sw'});S.tap()}
  var h0=document.createElement('div');h0.className='cz-h';h0.textContent='Theme style';$('pop').insertBefore(h0,$('pop').firstChild);
  var h1c=document.createElement('div');h1c.className='cz-h';h1c.textContent='Colours (work with every theme)';$('pop').appendChild(h1c);
  var sws=document.createElement('div');sws.className='sws';PRE.forEach(function(c){var b=document.createElement('button');b.type='button';b.className='sw';b.title=c[0];b.setAttribute('data-a',c[1]+','+c[2]);b.style.background='linear-gradient(135deg,'+c[1]+','+c[2]+')';b.onclick=function(e){e.stopPropagation();setAccent(c[1],c[2])};sws.appendChild(b)});$('pop').appendChild(sws);
  var row=document.createElement('div');row.className='cz-row';row.innerHTML='<span>Main</span><input type="color" id="c1" value="#10b981"><span>Second</span><input type="color" id="c2" value="#5eead4"><button class="adb" id="crs" type="button">Reset</button>';$('pop').appendChild(row);
  row.addEventListener('click',function(e){e.stopPropagation()});$('c1').oninput=$('c2').oninput=function(){setAccent($('c1').value,$('c2').value,true)};$('crs').onclick=function(e){e.stopPropagation();resetAccent()};
  (function(){var a=lsG('acc','');if(a&&a.indexOf(',')>0){var p=a.split(',');if(/^#[0-9a-f]{6}$/i.test(p[0])&&/^#[0-9a-f]{6}$/i.test(p[1]))setAccent(p[0],p[1],true)}})();
  $('thb').onclick=function(e){e.stopPropagation();th.classList.toggle('open');S.tap()};document.addEventListener('click',function(){th.classList.remove('open')});
  setTheme(lsG('theme','black'),true);
  // click feedback: sound + ripple
  document.addEventListener('click',function(e){if(e.target.closest('.thm,.snd'))return;if(e.target.closest('button,.ci,summary,.pill')){S.tap();var r=document.createElement('div');r.className='ripple';r.style.left=(e.clientX-6)+'px';r.style.top=(e.clientY-6)+'px';document.body.appendChild(r);setTimeout(function(){r.remove()},750)}});
  function watch(id,fn,cls){var el=$(id);if(!el)return;new MutationObserver(function(){if(cls?el.className.indexOf(cls)>-1:(el.style.display&&el.style.display!=='none'))fn()}).observe(el,{attributes:true,attributeFilter:[cls?'class':'style']})}
  // ---------- live background: particles + mouse links + shooting stars + spotlight
  var cv=document.createElement('canvas');cv.id='bg';document.body.prepend(cv);var sp=document.createElement('div');sp.className='spot';document.body.prepend(sp);
  ['o1','o2'].forEach(function(c){var d=document.createElement('div');d.className='orb '+c;document.body.prepend(d)});
  var x=cv.getContext('2d'),P=[],St=[],W0,H0,mx=-999,my=-999,reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  function rs(){var dp=Math.min(devicePixelRatio||1,2);W0=innerWidth;H0=innerHeight;cv.width=W0*dp;cv.height=H0*dp;x.setTransform(dp,0,0,dp,0,0);P=[];for(var i=0;i<Math.min(90,W0/9|0);i++)P.push({x:Math.random()*W0,y:Math.random()*H0,vx:(Math.random()-.5)*.5,vy:(Math.random()-.5)*.5,r:Math.random()*1.8+.6})}
  function pm(e){var t=e.touches?e.touches[0]:e;mx=t.clientX;my=t.clientY;sp.style.setProperty('--mx',mx+'px');sp.style.setProperty('--my',my+'px')}
  addEventListener('mousemove',pm,{passive:true});addEventListener('touchmove',pm,{passive:true});addEventListener('touchstart',pm,{passive:true});
  var FXM={black:{gl:0,rain:0,net:0,bars:0},white:{gl:0,rain:0,net:0,bars:0}};function fxm(){return FXM[R.getAttribute('data-theme')]||FXM.black}
  var fd=null;
  function fr(){x.clearRect(0,0,W0,H0);var i,j,p,q,dx,dy,d,nb=0,bw,M=fxm();if(window.__rain&&!reduce)window.__rain();
    if(M.bars&&an&&!au.paused){fd=fd||new Uint8Array(an.frequencyBinCount);an.getByteFrequencyData(fd);var sm=0;for(i=0;i<fd.length;i++)sm+=fd[i];lv=lv*.8+(sm/fd.length/255)*.2*1.6;nb=36;bw=W0/nb;
      for(i=0;i<nb;i++){var h=fd[i%fd.length]/255*Math.min(H0*.22,150)+2,gg=x.createLinearGradient(0,H0,0,H0-h);gg.addColorStop(0,pal[1]);gg.addColorStop(1,pal[0]);x.globalAlpha=.42;x.fillStyle=gg;x.fillRect(i*bw+bw*.18,H0-h,bw*.64,h)}x.globalAlpha=1}
    else lv*=.9;
    R.style.setProperty('--lv',lv.toFixed(3));
    for(i=0;M.net&&i<P.length;i++){p=P[i];p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>W0)p.vx*=-1;if(p.y<0||p.y>H0)p.vy*=-1;dx=mx-p.x;dy=my-p.y;d=dx*dx+dy*dy;if(d<22000){p.x+=dx*.004;p.y+=dy*.004}
      x.globalAlpha=.8;x.fillStyle=pal[0];x.beginPath();x.arc(p.x,p.y,p.r*(1+lv*1.8),0,6.3);x.fill();
      for(j=i+1;M.net===1&&j<P.length;j++){q=P[j];dx=p.x-q.x;dy=p.y-q.y;d=dx*dx+dy*dy;if(d<14000){x.globalAlpha=.3*(1-d/14000);x.strokeStyle=pal[1];x.beginPath();x.moveTo(p.x,p.y);x.lineTo(q.x,q.y);x.stroke()}}}
    if(M.net&&Math.random()<.012&&St.length<3)St.push({x:Math.random()*W0,y:-10,vx:-4-Math.random()*3,vy:3+Math.random()*2,l:60});
    for(i=St.length-1;i>=0;i--){p=St[i];p.x+=p.vx;p.y+=p.vy;p.l--;var g=x.createLinearGradient(p.x,p.y,p.x-p.vx*9,p.y-p.vy*9);g.addColorStop(0,pal[0]);g.addColorStop(1,'transparent');x.globalAlpha=Math.max(p.l/60,0);x.strokeStyle=g;x.lineWidth=2;x.beginPath();x.moveTo(p.x,p.y);x.lineTo(p.x-p.vx*9,p.y-p.vy*9);x.stroke();x.lineWidth=1;if(p.l<=0)St.splice(i,1)}
    x.globalAlpha=1;if(!reduce)requestAnimationFrame(fr)}
  addEventListener('resize',rs);rs();fr();
  // ---------- WebGL aurora background (falls back silently to the 2D layer)
  (function(){if(document.documentElement.classList.contains('e-off'))return;try{var g=document.createElement('canvas');g.id='gl';document.body.prepend(g);var c=g.getContext('webgl',{antialias:false,alpha:false,powerPreference:'low-power'});if(!c){g.remove();return}
    var vs='attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}',fs='#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform vec2 r,m;uniform float t,l;uniform vec3 a,b,d;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}float fbm(vec2 p){float v=0.,k=.5;for(int i=0;i<4;i++){v+=k*n(p);p*=2.03;k*=.5;}return v;}void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv*vec2(r.x/r.y,1.)*2.4;float q=fbm(p+t*.06);float w=fbm(p+vec2(q*2.2,q*1.4)+t*.04+(m-.5)*.7);vec3 col=mix(a,b,smoothstep(.15,.85,w));col=mix(col,d,smoothstep(.5,1.,q)*(.35+l*1.2));float beam=pow(abs(sin((uv.y+q*.35)*11.+t*.35)),48.)*.10;col+=d*beam;col*=.35+.65*smoothstep(1.25,.15,length(uv-vec2(.5,.45)));gl_FragColor=vec4(col,1.);}';
    function sh(ty,src){var o=c.createShader(ty);c.shaderSource(o,src);c.compileShader(o);if(!c.getShaderParameter(o,c.COMPILE_STATUS))throw 0;return o}
    var pr=c.createProgram();c.attachShader(pr,sh(c.VERTEX_SHADER,vs));c.attachShader(pr,sh(c.FRAGMENT_SHADER,fs));c.linkProgram(pr);if(!c.getProgramParameter(pr,c.LINK_STATUS))throw 0;c.useProgram(pr);
    var bf=c.createBuffer();c.bindBuffer(c.ARRAY_BUFFER,bf);c.bufferData(c.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),c.STATIC_DRAW);var lo=c.getAttribLocation(pr,'p');c.enableVertexAttribArray(lo);c.vertexAttribPointer(lo,2,c.FLOAT,false,0,0);
    var U=function(n){return c.getUniformLocation(pr,n)},uR=U('r'),uM=U('m'),uT=U('t'),uL=U('l'),uA=U('a'),uB=U('b'),uD=U('d'),mxn=.5,myn=.5,t0=performance.now(),last=0;
    function hx(v,k){v=(v||'').trim();var m=v.match(/^#([0-9a-f]{6})/i);if(!m)return k;var n=parseInt(m[1],16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}
    function sz(){var sc=.5;g.width=Math.max(2,innerWidth*sc|0);g.height=Math.max(2,innerHeight*sc|0);c.viewport(0,0,g.width,g.height)}sz();addEventListener('resize',sz);
    addEventListener('pointermove',function(e){mxn=e.clientX/innerWidth;myn=1-e.clientY/innerHeight},{passive:true});
    function fr2(now){if(!fxm().gl){g.style.display='none';if(!reduce)requestAnimationFrame(fr2);return}g.style.display='block';if(now-last>32){last=now;var cs=getComputedStyle(R),bg=hx(cs.getPropertyValue('--bg'),[.02,.07,.05]),gw=hx(cs.getPropertyValue('--glow'),[.02,.47,.34]),cy=hx(cs.getPropertyValue('--cyan'),[.1,.8,.9]);
      c.uniform2f(uR,g.width,g.height);c.uniform2f(uM,mxn,myn);c.uniform1f(uT,(now-t0)/1000);c.uniform1f(uL,lv||0);c.uniform3f(uA,bg[0],bg[1],bg[2]);c.uniform3f(uB,gw[0]*.55,gw[1]*.55,gw[2]*.55);c.uniform3f(uD,cy[0]*.8,cy[1]*.8,cy[2]*.8);c.drawArrays(c.TRIANGLES,0,3)}
      if(!reduce)requestAnimationFrame(fr2)}
    requestAnimationFrame(fr2)}catch(e){var o=document.getElementById('gl');if(o)o.remove()}})();
  function reveal(){  var rv=document.querySelectorAll('.rv');if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12});[].forEach.call(rv,function(n){io.observe(n)})}else{[].forEach.call(rv,function(n){n.classList.add('in')})}

}
  // ---------- advanced visuals: digital rain, headline scramble, count-up, card spotlight, scroll progress, stepper, toast
  var rainC=[],rainT='01KINGOFBOTS{}</>$.#';function rainInit(){rainC=[];var sp=fxm().rain==='bin'?18:26;for(var i=0;i<Math.floor(W0/sp);i++)rainC.push({x:i*sp+6,y:Math.random()*H0,v:.8+Math.random()*1.6})}
  rainInit();addEventListener('resize',rainInit);
  function rain(){var M=fxm();if(!M.rain)return;var bin=M.rain==='bin',fs=bin?16:14,T=bin?'0123456789':rainT,n=bin?14:6,i,k,c,yy;x.font=fs+'px ui-monospace,monospace';
    for(i=0;i<rainC.length;i++){c=rainC[i];c.y+=c.v*(bin?2.2:1)*(1+lv*3);if(c.y>H0+fs*n){c.y=-fs*2;c.v=.8+Math.random()*1.6}
      for(k=0;k<n;k++){yy=c.y-k*fs;if(yy<-fs||yy>H0+fs)continue;x.globalAlpha=(bin?.5:.2+lv*.25)*(1-k/n);x.fillStyle=(k===0&&bin)?'#eaffea':pal[0];x.fillText(T.charAt(Math.random()*T.length|0),c.x,yy)}}
    x.globalAlpha=1}
  window.__rain=rain;
  var toastT;function toast(m){var t=$('toast');t.textContent=m;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('on')},1800)}
  addEventListener('scroll',function(){var h=document.documentElement,m=h.scrollHeight-h.clientHeight;R.style.setProperty('--sy',h.scrollTop|0);$('prog').style.width=(m>0?h.scrollTop/m*100:0)+'%'},{passive:true});
  document.addEventListener('mousemove',function(e){var t=e.target.closest&&e.target.closest('.card,.feat div,.sc');if(t){var b=t.getBoundingClientRect();t.style.setProperty('--px',(e.clientX-b.left)+'px');t.style.setProperty('--py',(e.clientY-b.top)+'px')}},{passive:true});

  var CLEAN=[];
  function initHome(){
  var h1=document.querySelector('.hero h1 span');if(h1){var ft=h1.textContent,ch='ABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&',fr0=0;(function sc(){var o='';for(var i=0;i<ft.length;i++)o+=ft[i]===' '?' ':(i<fr0/2?ft[i]:ch[Math.random()*ch.length|0]);h1.textContent=o;fr0++;if(fr0<=ft.length*2+2)setTimeout(sc,40);else h1.textContent=ft})()}
  [].forEach.call(document.querySelectorAll('.stats b'),function(b){var raw=b.textContent,m=raw.match(/^(\d+)(.*)$/);if(!m)return;var to=+m[1],suf=m[2],done=false;b.textContent='0'+suf;new IntersectionObserver(function(es,o){if(es[0].isIntersecting&&!done){done=true;var t0=performance.now();(function tk(t){var k=Math.min((t-t0)/1100,1);b.textContent=Math.round(to*(1-Math.pow(1-k,3)))+suf;if(k<1)requestAnimationFrame(tk)})(t0);o.disconnect()}}).observe(b)});
  // ---------- live phone demo (auto-playing WhatsApp chat)
  var PH=document.createElement('div');PH.className='phone';PH.innerHTML='<div class="notch"></div><div class="ph-top"><span class="av">\uD83D\uDC51</span><div><b>RAUF × LUCIFER MD BOT</b><small>online</small></div></div><div class="ph-chat" id="phc"></div><div class="ph-in"><span>Message</span><i>\u27A4</i></div>';
  var PS=[['u','.menu'],['b','\uD83D\uDCDC *RAUF × LUCIFER MD BOT MENU*\nAI \u2022 Downloads \u2022 Stickers\nGroup tools \u2022 Games'],['u','.gpt write one line on cricket'],['t'],['b','\uD83E\uDD16 Cricket is a game where every ball can change the story.'],['u','.play kesariya'],['t'],['b','\uD83C\uDFB5 Kesariya.mp3 \u2022 sent'],['u','.antilink on'],['b','\uD83D\uDEE1\uFE0F Anti-link enabled for this group']],pi=0;
  function phStep(){var c=$('phc');if(!c)return;if(pi>=PS.length){setTimeout(function(){c.innerHTML='';pi=0;phStep()},3200);return}var st=PS[pi++];
    if(st[0]==='t'){var t=document.createElement('div');t.className='bb b ty';t.innerHTML='<i></i><i></i><i></i>';c.appendChild(t);c.scrollTop=c.scrollHeight;setTimeout(function(){t.remove();phStep()},1100);return}
    var d=document.createElement('div');d.className='bb '+st[0];d.textContent=st[1];c.appendChild(d);c.scrollTop=c.scrollHeight;setTimeout(phStep,st[0]==='u'?650:1500)}
  var st0=$('phslot');if(st0){st0.appendChild(PH);phStep();
    if(!reduce)document.addEventListener('mousemove',function(e){var r=PH.getBoundingClientRect();if(e.clientY<r.top-300||e.clientY>r.bottom+300)return;PH.style.setProperty('--rx',(-(e.clientY-(r.top+r.height/2))/r.height*8).toFixed(2)+'deg');PH.style.setProperty('--ry',((e.clientX-(r.left+r.width/2))/innerWidth*18).toFixed(2)+'deg')},{passive:true})}

  }
  // ---------- server list with LIVE ping (real round-trip time to the bot server, measured from the visitor's device)
  var SRV_N=50;
  /* server picker (v23): 50 servers, no ping / latency shown. Every server connects to the same bot. */
  function initServers(){var pk=$('spick');if(!pk)return;var btn=$('srvbtn'),list=$('srvlist'),sel=parseInt(lsG('srv','1'),10)||1,rows=[];
    if(sel<1||sel>SRV_N)sel=1;
    function nm(i){return 'Server '+(i<10?'0':'')+i}
    function paint(){btn.innerHTML='<i class="sd"></i><span class="sn">'+nm(sel)+'</span><em class="pe">Selected</em><span class="car">▾</span>';window.KOB_SRV=sel;
      rows.forEach(function(r,k){var i=k+1;r.className='sv'+(i===sel?' sel':'');r.setAttribute('aria-selected',i===sel?'true':'false')})}
    list.className='clist sgrid';
    for(var i=1;i<=SRV_N;i++)(function(i){var r=document.createElement('div');r.setAttribute('role','option');r.innerHTML='<i class="sd"></i><b>'+(i<10?'0':'')+i+'</b><small>Server</small>';r.onclick=function(e){e.stopPropagation();sel=i;lsS('srv',String(i));paint();pk.classList.remove('open');toast(nm(i)+' selected')};list.appendChild(r);rows.push(r)})(i);
    btn.onclick=function(e){e.stopPropagation();pk.classList.toggle('open')};var cl=function(e){if(!e.target.closest('#spick'))pk.classList.remove('open')};document.addEventListener('click',cl);
    CLEAN.push(function(){document.removeEventListener('click',cl)});paint()}
  // ---------- create your own bot: details, free demo (trial), pairing and edit
  function initCreate(){
    var editing=false,B3=(window.PAIR_API_BASE||''),g=function(k){var e=$('cb-'+k);return e?e.value.trim():''};
    function prof(){return{botName:g('name'),botOwner:g('owner'),prefix:g('prefix')||'.',channelLink:g('channel'),telegramLink:g('tg'),websiteLink:g('web'),logoUrl:g('logo')}}
    Object.defineProperty(window,'KOB_PROFILE',{get:function(){return editing?undefined:prof()},configurable:true});
    // ----- demo chat (nothing is sent to WhatsApp)
    var dc=$('dm-chat'),din=$('dm-in'),NAME=function(){return g('name')||'My Bot'},OWN=function(){return g('owner')||'You'},PX=function(){return g('prefix')||'.'};
    function add(c,t){var d=document.createElement('div');d.className='bb '+c;d.textContent=t;dc.appendChild(d);dc.scrollTop=dc.scrollHeight;return d}
    function head(){var L=['\u27A4  '+NAME().toUpperCase()+' \uD83D\uDC51\u2694\uFE0F','\uD83D\uDC51 Owner: '+OWN(),'\uD83D\uDEE0\uFE0F Developer: RAUF × LUCIFER','\uD83D\uDCE6 Prefix: '+PX()];if(g('tg'))L.push('\u2708\uFE0F Telegram: '+g('tg'));if(g('web'))L.push('\uD83C\uDF10 Website: '+g('web'));if(g('channel'))L.push('\uD83D\uDCE2 Channel: '+g('channel'));return L}
    function reply(cmd,arg){var x=PX();
      if(cmd==='menu'||cmd==='help')return head().concat(['','\u25B0\u25B0\u25B0\u2770 \uD83C\uDF10 GENERAL \u2771\u25B0\u25B0\u25B0','\u27A4 \u2500\u2500 '+x+'menu','\u27A4 \u2500\u2500 '+x+'ping','\u27A4 \u2500\u2500 '+x+'alive','','\u25B0\u25B0\u25B0\u2770 \uD83C\uDFB5 DOWNLOADERS \u2771\u25B0\u25B0\u25B0','\u27A4 \u2500\u2500 '+x+'play','\u27A4 \u2500\u2500 '+x+'video','\u27A4 \u2500\u2500 '+x+'tiktok','','\u25B0\u25B0\u25B0\u2770 \uD83E\uDD16 AI \u2771\u25B0\u25B0\u25B0','\u27A4 \u2500\u2500 '+x+'gpt','\u27A4 \u2500\u2500 '+x+'deepseek','','\u2026 and 370+ more commands in the real bot']).join('\n');
      if(cmd==='ping')return '*'+NAME()+'* 12ms \uD83D\uDCA8';
      if(cmd==='alive')return '\u2705 '+NAME()+' is alive!\nOwner: '+OWN()+'\nDeveloper: RAUF × LUCIFER';
      if(cmd==='owner')return '\uD83D\uDC51 Owner: '+OWN()+'\n\uD83D\uDEE0\uFE0F Developer: RAUF × LUCIFER';
      if(cmd==='setprefix'){if(/^[^\s\w\u0900-\u097F"'`\\]{1,3}$/.test(arg||'')){$('cb-prefix').value=arg;$('cb-prefix').dispatchEvent(new Event('input'));return '\u2705 Command prefix updated\n\u2022 New: '+arg+'\nNow use '+arg+'menu'}return '\u26A0\uFE0F Prefix must be 1 to 3 symbols, for example  !  #  /'}
      if(cmd==='setbotname'){if(arg){$('cb-name').value=arg.slice(0,30);$('cb-name').dispatchEvent(new Event('input'));return '\u2705 Bot name updated\n\u2022 New: '+arg.slice(0,30)}return '\u26A0\uFE0F Use: '+x+'setbotname <new name>'}
      return null}
    function run(t){t=String(t||'').trim();if(!t)return;add('u',t);var x=PX();
      if(t.indexOf(x)!==0){setTimeout(function(){add('b','(no reply: commands here start with '+x+'  \u2014  try '+x+'menu)')},300);return}
      var m=t.slice(x.length).match(/^(\w+)\s*(.*)$/),r=m?reply(m[1].toLowerCase(),m[2].trim()):null;var ty=document.createElement('div');ty.className='bb b ty';ty.innerHTML='<i></i><i></i><i></i>';dc.appendChild(ty);dc.scrollTop=dc.scrollHeight;
      setTimeout(function(){ty.remove();add('b',r||'\u2753 This demo knows: '+x+'menu '+x+'ping '+x+'alive '+x+'owner '+x+'setprefix '+x+'setbotname')},650)}
    function sync(){var dn=$('dm-name');if(dn)dn.textContent=NAME();var q=$('dm-q');if(q)[].forEach.call(q.children,function(b){b.textContent=PX()+b.getAttribute('data-c')})}
    ['name','owner','prefix','channel','tg','web','logo'].forEach(function(k){var e=$('cb-'+k);if(e)e.addEventListener('input',sync)});sync();
    [].forEach.call($('dm-q').children,function(b){b.onclick=function(){run(PX()+b.getAttribute('data-c'))}});
    $('dm-go').onclick=function(){run(din.value);din.value=''};din.addEventListener('keydown',function(e){if(e.key==='Enter'){run(din.value);din.value=''}});
    add('b','\uD83D\uDC4B This is a free demo of your bot. Fill the details on the left, then tap a button or type '+PX()+'menu. Nothing is sent to WhatsApp.');
    // ----- real pairing + edit
    window.KOB_ONKEY=function(key,logo){$('keybox').style.display='block';$('keyv').textContent=key;if(logo&&String(logo).indexOf('failed')===0)toast('Logo not saved: '+String(logo).slice(8,70))};
    $('keycp').onclick=function(){try{navigator.clipboard.writeText($('keyv').textContent);toast('Key copied \u2713')}catch(e){}};
    CLEAN.push(function(){try{delete window.KOB_PROFILE}catch(e){}window.KOB_ONKEY=null});
    function post(p,b){return fetch(B3+p,{method:'POST',headers:{'Content-Type':'application/json','ngrok-skip-browser-warning':'1'},body:JSON.stringify(b)}).then(function(r){return r.json()}).catch(function(){clearTimeout(tmr);return{ok:false,error:'Server is slow or not reachable - press Refresh'}})}
    function em(t,ok){var m=$('ed-msg');m.className='msg '+(ok?'ok':'err');m.textContent=t}
    $('ed-load').onclick=function(){post('/api/mybot/get',{number:$('ed-num').value.replace(/\D/g,''),key:$('ed-key').value.trim()}).then(function(j){if(!j.ok)return em(j.error||'Could not load',false);var p=j.profile||{};[['name','botName'],['owner','botOwner'],['prefix','prefix'],['channel','channelLink'],['tg','telegramLink'],['web','websiteLink'],['logo','logoUrl']].forEach(function(m){var e=$('cb-'+m[0]);if(e)e.value=p[m[1]]||''});editing=true;$('ed-save').disabled=false;sync();em('Loaded. Change the details above, then press Save changes.',true);S.recv()})};
    $('ed-save').onclick=function(){post('/api/mybot/save',{number:$('ed-num').value.replace(/\D/g,''),key:$('ed-key').value.trim(),profile:prof()}).then(function(j){if(!j.ok)return em(j.error||'Could not save',false);em('Saved \u2713 Your bot is updated'+(j.logo&&j.logo.indexOf('failed')===0?' (logo not changed: '+j.logo.slice(8,80)+')':'')+'.',true);S.win()})};
    initServers();
    watch('codeCard',S.code);watch('doneCard',S.win);watch('msg',S.err,'err');
    if(window.KOB_PAIR)window.KOB_PAIR();
  }
  // ---------- RAUF × LUCIFER MD BOT OS: virtual phone, only WhatsApp installed by default; commands run on the real bot backend (text-safe set)
  var OS_APPS=[{id:'wa',name:'WhatsApp',badge:1}];   // default = WhatsApp only. More apps can be added here later.
  function esc(t){return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
  function wfmt(t){return esc(t).replace(/\*([^*\n]+)\*/g,'<b>$1</b>').replace(/_([^_\n]+)_/g,'<i>$1</i>').replace(/```([^`]+)```/g,'<code>$1</code>')}
  function hhmm(){var d=new Date();return('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)}
  function localBot(t,px){t=String(t||'').trim();if(t.indexOf(px)!==0)return'(no reply: commands start with '+px+' — try '+px+'menu)';var m=t.slice(px.length).match(/^(\S+)\s*([\s\S]*)$/);if(!m)return'';var c=m[1].toLowerCase(),a=m[2].trim();
    if(c==='ping')return'*RAUF × LUCIFER MD BOT* '+(9+Math.floor(Math.random()*18))+'ms 💨';if(c==='alive')return'✅ RAUF × LUCIFER MD BOT is alive!\n👑 Owner: RAUF × LUCIFER';if(c==='owner')return'👑 Owner: RAUF × LUCIFER\n🛠️ Developer: RAUF × LUCIFER (Team RAUF × LUCIFER)';if(c==='flip')return'🪙 '+(Math.random()<.5?'Heads':'Tails');if(c==='dice')return'🎲 You rolled a '+(1+Math.floor(Math.random()*6));
    if(c==='time'||c==='date')return'🕒 '+new Date().toLocaleString();if(c==='menu'||c==='help')return'➤ *RAUF × LUCIFER MD BOT* 👑\n\n▰▰▰❰ 🤖 GENERAL ❱▰▰▰\n➤ ── '+px+'menu\n➤ ── '+px+'ping\n➤ ── '+px+'alive\n\n… 450+ commands in the real bot.\n\n(Bot server is not reachable right now, so this is the offline preview.)';
    return'⚠️ Bot server is not reachable right now. Try again in a moment.'}
  function mountOS(slot){if(slot.getAttribute('data-m'))return;slot.setAttribute('data-m','1');
    var B=(window.PAIR_API_BASE||''),SID=lsG('sid','');if(!SID){SID='v'+Math.random().toString(36).slice(2,12)+Date.now().toString(36);lsS('sid',SID)}
    var PX='.',busy=false,greeted=false,QC=['menu','ping','gpt hello','8ball will I win','fancy king','calc 12*(3+4)','truth'];
    var WA='<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-13 8l-5 1 1-5A9 9 0 1 1 21 12z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .7a4 4 0 0 1-1.7-1.7l.7-1-1-2z" fill="#fff" stroke="none"/></svg>';
    var el=document.createElement('div');el.className='os';
    el.innerHTML='<i class="os-btn pw" title="Restart"></i><i class="os-btn vu"></i><div class="os-body"><div class="os-isl"><b></b></div>'
     +'<div class="os-sb"><span class="os-t">'+hhmm()+'</span><span class="os-ic"><i class="s1"></i><i class="s2"></i><span class="bat"><b></b></span></span></div>'
     +'<div class="os-scr os-boot on"><svg class="os-crown" viewBox="0 0 64 64"><use href="#crown"/></svg><b>RAUF × LUCIFER MD BOT</b><small>OS</small><div class="os-load"><i></i></div></div>'
     +'<div class="os-scr os-home"><div class="os-wall"></div><div class="os-clock"><b class="os-ck">'+hhmm()+'</b><span class="os-dt"></span></div><div class="os-wid"><em>RAUF × LUCIFER MD BOT OS</em><span>Bot status</span><b><i class="lv"></i> Online</b></div><div class="os-apps"></div><div class="os-hint">Tap WhatsApp to chat with the bot</div></div>'
     +'<div class="os-scr os-app"><div class="wa-h"><button type="button" class="wa-bk" aria-label="Back">‹</button><span class="wa-av">👑</span><div class="wa-ti"><b>RAUF × LUCIFER MD BOT</b><small>online</small></div><span class="wa-ac">☎⋮</span></div><div class="wa-c"></div><div class="wa-q"></div><div class="wa-i"><input type="text" placeholder="Message" autocomplete="off" maxlength="300" aria-label="Message"><button type="button" class="wa-s" aria-label="Send">➤</button></div></div>'
     +'<div class="os-bar" title="Home"></div></div>';
    slot.appendChild(el);
    var q=function(s){return el.querySelector(s)},apps=q('.os-apps'),chat=q('.wa-c'),inp=q('.wa-i input'),sub=q('.wa-ti small');
    OS_APPS.forEach(function(a){var b=document.createElement('button');b.type='button';b.className='os-ap';b.innerHTML='<span class="os-ico wa">'+WA+(a.badge?'<u>1</u>':'')+'</span><em>'+a.name+'</em>';b.onclick=function(){openApp(a.id)};apps.appendChild(b)});
    var tk=setInterval(function(){if(!document.body.contains(el)){clearInterval(tk);return}var t=hhmm();q('.os-t').textContent=t;q('.os-ck').textContent=t;q('.os-dt').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'})},4000);q('.os-dt').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'});
    function show(c){[].forEach.call(el.querySelectorAll('.os-scr'),function(s){s.classList.remove('on')});q('.'+c).classList.add('on');el.setAttribute('data-s',c)}
    function boot(){show('os-boot');var l=q('.os-load i');l.style.animation='none';void l.offsetWidth;l.style.animation='';setTimeout(function(){show('os-home')},reduce?300:2300)}
    boot();q('.os-btn.pw').onclick=function(){S.tap();boot()};
    function stamp(){return hhmm()}
    function add(c,t){var d=document.createElement('div');d.className='wm '+c;d.innerHTML='<div class="wt">'+wfmt(t)+'</div><span class="wh">'+stamp()+(c==='u'?' <s>✓✓</s>':'')+'</span>';chat.appendChild(d);chat.scrollTop=chat.scrollHeight;return d}
    function typing(on){var o=chat.querySelector('.wm.ty');if(!on){if(o)o.remove();sub.textContent='online';return}if(o)return;var d=document.createElement('div');d.className='wm b ty';d.innerHTML='<div class="wt"><i></i><i></i><i></i></div>';chat.appendChild(d);chat.scrollTop=chat.scrollHeight;sub.textContent='typing…'}
    function openApp(){S.tap();show('os-app');var b=q('.os-ap');if(b){var u=b.querySelector('u');if(u)u.remove()}
      if(!greeted){greeted=true;typing(true);setTimeout(function(){typing(false);add('b','👑 *RAUF × LUCIFER MD BOT*\nWelcome! This is a live preview of the bot.\nSend *.menu* to see all commands, or tap a shortcut below.');S.recv()},900)}
      setTimeout(function(){try{inp.focus({preventScroll:true})}catch(e){}},400)}
    function home(){S.tap();show('os-home')}
    q('.wa-bk').onclick=home;q('.os-bar').onclick=home;
    var qq=q('.wa-q');QC.forEach(function(c){var b=document.createElement('button');b.type='button';b.textContent=PX+c;b.onclick=function(){send(PX+c)};qq.appendChild(b)});
    function send(text){text=String(text||'').trim();if(!text||busy)return;busy=true;inp.value='';add('u',text);S.send();typing(true);
      var ac=window.AbortController?new AbortController():null,to=setTimeout(function(){if(ac)ac.abort()},55000),t0=Date.now();
      fetch(B+'/api/preview',{method:'POST',headers:{'Content-Type':'application/json','ngrok-skip-browser-warning':'1'},body:JSON.stringify({text:text,sid:SID,prefix:PX}),signal:ac?ac.signal:undefined}).then(function(r){return r.json()}).then(function(j){if(!j||!j.ok)return j&&j.error?'⚠️ '+j.error:localBot(text,PX);return j.reply}).catch(function(){return localBot(text,PX)})
      .then(function(r){clearTimeout(to);var wait=Math.max(0,450-(Date.now()-t0));setTimeout(function(){typing(false);if(r)add('b',r);S.recv();busy=false},wait)})}
    q('.wa-s').onclick=function(){send(inp.value)};inp.addEventListener('keydown',function(e){if(e.key==='Enter')send(inp.value)});
    if(!reduce)el.addEventListener('mousemove',function(e){var r=el.getBoundingClientRect();el.style.setProperty('--rx',(-(e.clientY-(r.top+r.height/2))/r.height*7).toFixed(2)+'deg');el.style.setProperty('--ry',((e.clientX-(r.left+r.width/2))/r.width*10).toFixed(2)+'deg')});
    el.addEventListener('mouseleave',function(){el.style.setProperty('--rx','0deg');el.style.setProperty('--ry','0deg')});
    slot.__os={send:function(t){if(el.getAttribute('data-s')!=='os-app')openApp();setTimeout(function(){send(t)},el.getAttribute('data-s')==='os-app'?0:200)}}}
  function mountAllOS(){[].forEach.call(document.querySelectorAll('.osslot'),mountOS);[].forEach.call(document.querySelectorAll('[data-os-cmd]'),function(b){b.onclick=function(){var s=document.querySelector('.osslot');if(s&&s.__os){s.__os.send(b.getAttribute('data-os-cmd'));var r=s.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight)s.scrollIntoView({behavior:'smooth',block:'center'})}}})}
  // ---------- docs: table of contents jumps + highlight
  function initDocs(){var links=[].slice.call(document.querySelectorAll('.toc [data-jump]'));
    links.forEach(function(a){a.onclick=function(e){e.preventDefault();var t=document.getElementById(a.getAttribute('data-jump'));if(t)t.scrollIntoView({behavior:'smooth',block:'start'})}});
    if(!('IntersectionObserver' in window))return;var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)links.forEach(function(a){a.classList.toggle('on',a.getAttribute('data-jump')===e.target.id)})})},{rootMargin:'-20% 0px -70% 0px'});
    [].forEach.call(document.querySelectorAll('.doc h2[id]'),function(h){io.observe(h)});CLEAN.push(function(){io.disconnect()})}
  function initPair(){
  // 3D tilt on the main card (desktop)
  var fc=$('formCard');if(fc&&!reduce)fc.addEventListener('mousemove',function(e){var b=fc.getBoundingClientRect();fc.style.transform='perspective(900px) rotateY('+(((e.clientX-b.left)/b.width-.5)*6)+'deg) rotateX('+(-((e.clientY-b.top)/b.height-.5)*6)+'deg)'});
  if(fc)fc.addEventListener('mouseleave',function(){fc.style.transform=''});
  var cp=$('copy');if(cp)cp.addEventListener('click',function(){toast('Code copied \u2713')});
  function step(n){var sp=$('stp').children;for(var i=0;i<3;i++){sp[i].className=i<n?'dn':(i===n?'on':'')}}
  watch('codeCard',function(){step(1)});watch('doneCard',function(){step(2)});
  watch('codeCard',S.code);watch('doneCard',S.win);watch('msg',S.err,'err');
  initServers();
  if(window.KOB_PAIR)window.KOB_PAIR();
  }
  function initSupport(){
  // ---------- support center (reads public/site-config.js; only filled items are shown)
  (function(){var IC={email:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',telegram:'<path d="M21 4 3 11l6 2 2 6 3-4 5 3z"/><path d="m9 13 12-9"/>',github:'<path d="M9 19c-4 1-4-2-6-2m12 4v-3a3 3 0 0 0-1-2c3 0 6-1 6-6a5 5 0 0 0-1-3 5 5 0 0 0 0-3s-1 0-3 1a10 10 0 0 0-6 0C6 4 5 4 5 4a5 5 0 0 0 0 3 5 5 0 0 0-1 3c0 5 3 6 6 6a3 3 0 0 0-1 2v3"/>',channel:'<path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M17 8a5 5 0 0 1 0 8"/>',whatsapp:'<path d="M21 12a9 9 0 0 1-13 8l-5 1 1-5A9 9 0 1 1 21 12z"/>',instagram:'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',youtube:'<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/>'},C=window.SITE||{},box=$('sup'),def=[['email','Email','mailto:'],['email2','Email 2','mailto:'],['telegram','Telegram','https://t.me/'],['github','GitHub','https://github.com/'],['channel','WhatsApp Channel',''],['whatsapp','WhatsApp','https://wa.me/'],['instagram','Instagram','https://instagram.com/'],['youtube','YouTube','']],n=0;
    def.forEach(function(r){var v=String(C[r[0]]||'').trim();if(!v)return;var h=/^(https?:|mailto:)/i.test(v)?v:(/^email/.test(r[0])?'mailto:'+v:(r[2]?r[2]+v.replace(/^@/,'').replace(/[^0-9a-zA-Z_.\/-]/g,''):''));if(!/^(https?:|mailto:)/i.test(h))return;
      var a=document.createElement('a');a.className='sc';a.href=h;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label','Open '+r[1]);var ic=document.createElement('i');ic.innerHTML='<svg viewBox="0 0 24 24">'+(IC[r[0].replace(/\d+$/,'')]||'')+'</svg>';a.appendChild(ic);var tx=document.createElement('div');var b=document.createElement('b');b.textContent=r[1];var s=document.createElement('span');s.textContent='Tap to open \u2192';tx.appendChild(b);tx.appendChild(s);a.appendChild(tx);box.appendChild(a);n++});
    if(C.hours){var p=document.createElement('p');p.className='sh';p.textContent='Support hours: '+C.hours;box.appendChild(p)}
    if(!n)box.innerHTML='<p class="sh">Support contacts will appear here soon.</p>'})();
  }
  function initAI(){
  // ---------- AI chat (last 20 messages per AI are remembered on the server)
  var B=(window.PAIR_API_BASE||''),sid=lsG('sid','');if(!sid){sid='v'+Math.random().toString(36).slice(2,12)+Date.now().toString(36);lsS('sid',sid)}
  var used=0,busy=false,chat=$('chat');
  function add(c,t){var d=document.createElement('div');d.className='m '+c;d.textContent=t;chat.appendChild(d);chat.scrollTop=chat.scrollHeight;return d}
  function cnt(){$('hcount').textContent='Memory: '+used+'/20 messages'}
  function send(){var m=$('ain').value.trim();if(!m||busy)return;busy=true;$('ain').value='';add('u',m);S.send();var t=add('a t','Thinking\u2026');
    fetch(B+'/api/ai',{method:'POST',headers:{'Content-Type':'application/json','ngrok-skip-browser-warning':'1'},body:JSON.stringify({message:m,sid:sid})}).then(function(r){return r.json()}).then(function(j){t.className='m a';t.textContent=j.ok?j.reply:('\u26A0\uFE0F '+(j.error||'Try again'));if(j.ok){used=j.used;cnt();S.recv()}else S.err()}).catch(function(){t.className='m a';t.textContent='\u26A0\uFE0F Server not reachable';S.err()}).then(function(){busy=false;chat.scrollTop=chat.scrollHeight})}
  [].forEach.call($('qk').children,function(b){b.onclick=function(){$('ain').value=b.textContent;send()}});
  $('asend').onclick=send;$('ain').addEventListener('keydown',function(e){if(e.key==='Enter')send()});
  $('aclear').onclick=function(){fetch(B+'/api/ai/clear',{method:'POST',headers:{'Content-Type':'application/json','ngrok-skip-browser-warning':'1'},body:JSON.stringify({sid:sid})}).catch(function(){});used=0;cnt();chat.innerHTML='';add('a','Chat cleared. How can I help you?')};
  }
  // ---------- page router: separate pages, but navigation keeps the music/background alive
  var INL=window.__INLINE||null,app=$('app'),INIT={home:initHome,pair:initPair,ai:initAI,support:initSupport,learn:function(){},create:initCreate,docs:initDocs,preview:function(){}};
  function pathOf(h){h=String(h||'/').split('#')[0].split('?')[0];if(h.length>1&&h.slice(-1)==='/')h=h.slice(0,-1);h=h.replace(/\/index\.html$/,'/').replace(/\.html$/,'');return h||'/'}
  function loadPage(p){if(INL)return Promise.resolve(INL[p]||INL['/']);return fetch(p,{headers:{'ngrok-skip-browser-warning':'1'}}).then(function(r){return r.text()}).then(function(t){var d=new DOMParser().parseFromString(t,'text/html'),m=d.getElementById('app');if(!m)throw 0;return{title:d.title,page:d.body.getAttribute('data-page'),html:m.innerHTML}})}
  function mark(p){[].forEach.call(document.querySelectorAll('nav .links a,.drawer a,.fl a'),function(a){a.classList.toggle('on',pathOf(a.getAttribute('href'))===p)})}
  function initPage(p){CLEAN.splice(0).forEach(function(f){try{f()}catch(e){}});reveal();mark(p);var f=INIT[document.body.getAttribute('data-page')];if(f)try{f()}catch(e){console.error(e)}try{mountAllOS()}catch(e){console.error(e)}}
  var swapping=0;
  function render(p){loadPage(p).then(function(pg){app.classList.add('out');setTimeout(function(){app.innerHTML=pg.html;document.title=pg.title;document.body.setAttribute('data-page',pg.page);app.classList.remove('out');scrollTo(0,0);closeDrawer();initPage(p)},160)}).catch(function(){if(!INL)location.href=p})}
  function go(p){p=pathOf(p);if(INL){if(location.hash!=='#'+p)location.hash='#'+p;else render(p)}else{if(pathOf(location.pathname)!==p)history.pushState({},'',p);render(p)}}
  document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-nav]');if(!a||e.metaKey||e.ctrlKey||e.shiftKey||e.button)return;e.preventDefault();go(a.getAttribute('href'))});
  addEventListener(INL?'hashchange':'popstate',function(){render(INL?pathOf(location.hash.slice(1)):pathOf(location.pathname))});
  function openDrawer(){$('dr').classList.add('open');$('scrim').classList.add('open');document.body.style.overflow='hidden';$('mb').setAttribute('aria-expanded','true')}
  function closeDrawer(){$('dr').classList.remove('open');$('scrim').classList.remove('open');document.body.style.overflow='';$('mb').setAttribute('aria-expanded','false')}
  $('mb').onclick=function(e){e.stopPropagation();$('dr').classList.contains('open')?closeDrawer():openDrawer()};$('dx').onclick=closeDrawer;$('scrim').onclick=closeDrawer;
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeDrawer()});
  document.getElementById('dr').addEventListener('click',function(e){if(e.target.closest('a[data-nav]'))closeDrawer()});
  // support buttons (footer + menu): same five options on every page, details stay hidden behind the buttons
  (function(){var IC={email:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',telegram:'<path d="M21 4 3 11l6 2 2 6 3-4 5 3z"/><path d="m9 13 12-9"/>',whatsapp:'<path d="M21 12a9 9 0 0 1-13 8l-5 1 1-5A9 9 0 1 1 21 12z"/>',channel:'<path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M17 8a5 5 0 0 1 0 8"/>',youtube:'<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/>',github:'<path d="M9 19c-4 1-4-2-6-2m12 4v-3a3 3 0 0 0-1-2c3 0 6-1 6-6a5 5 0 0 0-1-3 5 5 0 0 0 0-3s-1 0-3 1a10 10 0 0 0-6 0C6 4 5 4 5 4a5 5 0 0 0 0 3 5 5 0 0 0-1 3c0 5 3 6 6 6a3 3 0 0 0-1 2v3"/>',instagram:'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>'},C=window.SITE||{},def=[['email','Email','mailto:'],['email2','Email 2','mailto:'],['telegram','Telegram','https://t.me/'],['whatsapp','WhatsApp','https://wa.me/'],['channel','Channel',''],['youtube','YouTube',''],['github','GitHub','https://github.com/'],['instagram','Instagram','https://instagram.com/']];
    ['fsup','dsup'].forEach(function(id){var box=$(id);if(!box)return;def.forEach(function(r){var v=String(C[r[0]]||'').trim();if(!v)return;var h=/^(https?:|mailto:)/i.test(v)?v:(/^email/.test(r[0])?'mailto:'+v:(r[2]?r[2]+v.replace(/^@/,'').replace(/[^0-9a-zA-Z_.\/-]/g,''):''));if(!/^(https?:|mailto:)/i.test(h))return;
      var a=document.createElement('a');a.className='fb';a.href=h;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label','Open '+r[1]);a.innerHTML='<svg viewBox="0 0 24 24">'+(IC[r[0].replace(/\d+$/,'')]||'')+'</svg>';var t=document.createElement('span');t.textContent=r[1];a.appendChild(t);box.appendChild(a)})})})();
  var p0=INL?pathOf(location.hash.slice(1)||'/'):pathOf(location.pathname);
  if(INL&&p0!=='/'){render(p0)}else initPage(p0);

})();
