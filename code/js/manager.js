/* Extracted manager script */

/* SPORT SELECTOR CANVAS */
(function(){
  const canvas=document.getElementById('sel-canvas');
  if(!canvas) return;
  const ctx=canvas.getContext('2d');
  let W,H;
  function resize(){
    const dpr = window.devicePixelRatio || 1;
    const scale = (window.HS_REDUCED ? Math.max(0.5, dpr * 0.6) : dpr);
    const w = Math.max(120, Math.floor((canvas.offsetWidth || innerWidth) * scale));
    const h = Math.max(80, Math.floor((canvas.offsetHeight || innerHeight*0.25) * scale));
    canvas.width = w; canvas.height = h;
    canvas.style.width = (canvas.offsetWidth || innerWidth) + 'px';
    canvas.style.height = (canvas.offsetHeight || 160) + 'px';
    try{ ctx.setTransform(scale,0,0,scale,0,0); }catch(e){}
    W = Math.floor(canvas.offsetWidth || innerWidth); H = Math.floor(canvas.offsetHeight || 160);
  }
  resize();window.addEventListener('resize',resize);
  const P=[];
  function mk(){
    const x=Math.random()*W;
    return{x,y:H+5,col:[Math.random()<0.5?240:48,Math.random()<0.5?192:144,Math.random()<0.5?64:248],sz:Math.random()*1.2+0.2,vy:-(Math.random()*0.35+0.1),vx:(Math.random()-0.5)*0.15,life:1,decay:Math.random()*0.003+0.001};
  }
  for(let i=0;i<60;i++){const p=mk();p.y=Math.random()*H;P.push(p);}  
  
  window.HS_REDUCED = (function(){ try{ return localStorage.getItem('hs_low_power')==='1'; }catch(e){return false;} })();
  window.addEventListener('message', (e)=>{ try{ if(e && e.data && e.data.type==='hs_low_power'){ window.HS_REDUCED = !!e.data.flag; document.documentElement.classList.toggle('low-power', !!e.data.flag);
      if(window.gsap){ try{ if(window.HS_REDUCED||document.hidden){ try{ gsap.globalTimeline.pause(); }catch(e){}; try{ gsap.globalTimeline.clear(); }catch(e){} } else { try{ gsap.globalTimeline.resume(); }catch(e){} } }catch(_){} }
    } }catch(_){}});
  document.addEventListener('visibilitychange', ()=>{
    try{ if(window.gsap){ if(document.hidden||window.HS_REDUCED) gsap.globalTimeline.pause(); else gsap.globalTimeline.resume(); } }catch(e){}
  });

  function frame(){
    try{
      if(document.hidden){ setTimeout(frame,1000); return; }
      ctx.clearRect(0,0,W,H);
      if(Math.random() < (window.HS_REDUCED ? 0.05 : 0.25)) P.push(mk());
      const maxP = window.HS_REDUCED ? 40 : 90;
      while(P.length > maxP) P.shift();
      for(let i=P.length-1;i>=0;i--){
        const p=P[i];p.y+=p.vy;p.x+=p.vx;p.life-=p.decay;
        if(p.life<=0||p.y<-3){P.splice(i,1);continue;}
        ctx.beginPath();ctx.arc(p.x,p.y,p.sz,0,Math.PI*2);
        ctx.fillStyle=`rgba(${p.col[0]},${p.col[1]},${p.col[2]},${(p.life*0.12).toFixed(3)})`;
        ctx.fill();
      }
    }catch(e){}
    if(window.HS_REDUCED) setTimeout(frame, Math.round(1000/20)); else requestAnimationFrame(frame);
  }
  frame();
})();

/* STATE + UI logic */
const DEF={
  sport:'basketball',
  teamA:{name:'TEAM A',score:0,redCards:0,teamFouls:0,players:[]},
  teamB:{name:'TEAM B',score:0,redCards:0,teamFouls:0,players:[]},
  round:1,totalRounds:4,roundMinutes:15,intermissionMinutes:15,
  timerSeconds:900,intermissionSeconds:900,
  matchRunning:false,intermissionRunning:false,matchEnded:false,
  shotclockSeconds:15,shotclockRunning:false
};
let S=JSON.parse(JSON.stringify(DEF));
let timerInterval=null;
let scIntervalManager=null;

function normalizeState(){
  ['teamA','teamB'].forEach(k=>{
    const t=S[k]||(S[k]={});
    if(typeof t.redCards!=='number'){
      const legacyYellow=Number(t.yellowCards)||0;
      t.redCards=Math.max(0,Math.floor(legacyYellow/3));
    }
    if(typeof t.teamFouls!=='number')t.teamFouls=0;
    if(!Array.isArray(t.players))t.players=[];
  });
  if(typeof S.shotclockSeconds!=='number') S.shotclockSeconds = 15;
  if(typeof S.shotclockRunning!=='boolean') S.shotclockRunning = false;
}

window.addEventListener('message', e => {
  try{
    const d = e && e.data;
    if(!d) return;
    if(d.type === 'hs_countdown_done'){ try{ startMatch(); }catch(err){} }
  }catch(err){}
});

let _matchEndTimeout = null;

function handleMatchEnd(){
  try{
    const a = (S.teamA&&S.teamA.score)||0; const b = (S.teamB&&S.teamB.score)||0;
    const winner = a>b ? 'a' : (b>a ? 'b' : 'tie');
    try{
      if (window.HighScoreBridge && typeof window.HighScoreBridge.sendMessage === 'function') {
        try { window.HighScoreBridge.sendMessage({ type: 'hs_match_end', winner: winner, scoreA: a, scoreB: b, duration: 10 }); } catch(e) {}
      } else {
        const bb = window.open('','HighScore_Billboard');
        try{ if(bb && !bb.closed) bb.postMessage({type:'hs_match_end', winner:winner, scoreA:a, scoreB:b, duration:10}, '*'); }catch(e){}
      }
    }catch(e){}
    if(_matchEndTimeout) clearTimeout(_matchEndTimeout);
    _matchEndTimeout = setTimeout(()=>{
      try{ stopTimer(); }catch(e){}
      const sp = S.sport; S = JSON.parse(JSON.stringify(DEF)); S.sport = sp; S.totalRounds = sp==='football'?2:4;
      S.roundMinutes = sp==='basketball'?15:sp==='football'?45:30; S.timerSeconds = S.roundMinutes*60;
      S.intermissionSeconds = S.intermissionMinutes*60; S.shotclockSeconds = 15; S.shotclockRunning = false;
      if(scIntervalManager){ clearInterval(scIntervalManager); scIntervalManager=null; }
      save(true); renderAll();
    }, 10000);
  }catch(e){}
}

function requestStartMatch(){
  try{
    S.timerSeconds = S.roundMinutes * 60; S.intermissionRunning = false;
    try{
      if (window.HighScoreBridge && typeof window.HighScoreBridge.sendMessage === 'function') {
        try{
          window.HighScoreBridge.sendMessage({type:'hs_countdown', seconds:3});
          const onMsg = function(e){ try{ const d=e&&e.data; if(!d) return; if(d.type==='hs_countdown_done'){ window.removeEventListener('message', onMsg); startMatch(); } }catch(err){} };
          window.addEventListener('message', onMsg);
          setTimeout(()=>{ try{ window.removeEventListener('message', onMsg); startMatch(); }catch(e){} }, 6000);
        }catch(e){ setTimeout(()=>startMatch(),3000); }
      } else {
        const bb = window.open('','HighScore_Billboard');
        if(bb && !bb.closed){
          try{
            bb.postMessage({type:'hs_countdown', seconds:3}, '*');
            const onMsg = function(e){ try{ const d=e&&e.data; if(!d) return; if(d.type==='hs_countdown_done'){ window.removeEventListener('message', onMsg); startMatch(); } }catch(err){} };
            window.addEventListener('message', onMsg);
            setTimeout(()=>{ try{ window.removeEventListener('message', onMsg); startMatch(); }catch(e){} }, 6000);
          }catch(e){ setTimeout(()=>startMatch(),3000); }
        }else{
          let nb=null; try{ nb = window.open('billboard.html','HighScore_Billboard','width=1280,height=720,toolbar=no,menubar=no,scrollbars=no'); }catch(e){}
          if(nb){ setTimeout(()=>{ try{ nb.postMessage({type:'hs_countdown', seconds:3}, '*'); }catch(e){} },500); }
          setTimeout(()=>startMatch(),3000);
        }
      }
    }catch(e){}
  }catch(e){}
}

let _saveTimeout=null;
function save(force){
  if(force){
    if(_saveTimeout){clearTimeout(_saveTimeout);_saveTimeout=null;}
    try{localStorage.setItem('hs_state',JSON.stringify(S));}catch(e){}
    renderStatus(); return;
  }
  if(_saveTimeout) clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(()=>{try{localStorage.setItem('hs_state',JSON.stringify(S));}catch(e){};renderStatus();_saveTimeout=null;},220);
}

/* SPORT SELECTOR helpers */
const SPORT_ICONS={basketball:'🏀',football:'⚽',handball:'🤾',volleyball:'🏐'};
const SPORT_NAMES={basketball:'BASKETBALL',football:'FOOTBALL',handball:'HANDBALL',volleyball:'VOLLEYBALL'};

function selectSport(sport){
  S.sport=sport; S.teamA.score=0;S.teamB.score=0; S.teamA.redCards=0;S.teamB.redCards=0;
  S.teamA.teamFouls=0;S.teamB.teamFouls=0; S.teamA.players=S.teamA.players||[];S.teamB.players=S.teamB.players||[];
  S.round=1;S.matchRunning=false;S.intermissionRunning=false;S.matchEnded=false;
  S.totalRounds=sport==='football'?2:4; S.roundMinutes=sport==='basketball'?15:sport==='football'?45:30;
  S.intermissionMinutes=15; S.timerSeconds=S.roundMinutes*60;S.intermissionSeconds=S.intermissionMinutes*60;
  stopTimer();save();

  const sel=document.getElementById('sport-selector');
  sel.style.transition='opacity 0.45s ease,transform 0.45s ease';
  sel.style.opacity='0';sel.style.transform='scale(0.97)';
  setTimeout(()=>{sel.style.display='none';},440);

  document.getElementById('pill-icon').textContent=SPORT_ICONS[sport];
  document.getElementById('pill-name').textContent=SPORT_NAMES[sport];
  renderAll();
}
function openSportSelector(){const sel=document.getElementById('sport-selector');sel.style.display='flex';sel.style.opacity='0';sel.style.transform='scale(0.97)';requestAnimationFrame(()=>{sel.style.transition='opacity 0.35s ease,transform 0.35s ease';sel.style.opacity='1';sel.style.transform='scale(1)';});}

/* TIMER ENGINE */
function startTimer(){
  stopTimer();
  timerInterval = setInterval(()=>{
    if(S.intermissionRunning){
      S.intermissionSeconds = Math.max(0, S.intermissionSeconds-1);
      if(S.intermissionSeconds<=0){ S.intermissionRunning = false; startMatch(); return; }
    } else if(S.matchRunning){
      S.timerSeconds = Math.max(0, S.timerSeconds-1);
      if(S.timerSeconds<=0){
        S.matchRunning = false;
        if((S.sport==='basketball'&&S.round>=4) || (S.sport==='football'&&S.round>=2) || S.sport==='handball' || S.sport==='volleyball'){
          S.matchEnded = true; stopTimer(); try{ handleMatchEnd(); }catch(e){}
        } else { stopTimer(); }
      }
    }
    save(); renderStatus();
  },1000);
}

function stopTimer(){if(timerInterval){clearInterval(timerInterval);timerInterval=null;}}
function startMatch(){S.matchRunning=true;S.intermissionRunning=false;S.timerSeconds=S.roundMinutes*60;startTimer();save();renderAll();}

/* RENDER */
function renderAll(){renderTeam('a');renderTeam('b');renderCenter();renderStatus();renderShotclockManager();}
function renderShotclockManager(){
  const el = document.getElementById('shotclock-disp');
  if(!el) return;
  el.textContent = String(S.shotclockSeconds||15).padStart(2,'0');
  if((S.shotclockSeconds||0) <= 5) el.style.color = '#ef4444'; else el.style.color = '';
}

const CIRC=263.9;
function renderStatus(){
  const secs=S.intermissionRunning?S.intermissionSeconds:S.timerSeconds;
  const m=Math.floor(secs/60),s=secs%60;
  const tstr=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  document.getElementById('bar-timer').textContent=tstr;
  document.getElementById('ctrl-time-digits').textContent=tstr;
  const warn=S.matchRunning&&secs<=60;
  document.getElementById('bar-timer').className=warn?'warning':'';
  document.getElementById('ctrl-ring-wrap').classList.toggle('warning',warn);
  const maxSecs=S.roundMinutes*60||900; const ratio=maxSecs>0?secs/maxSecs:0;
  const offset=CIRC*(1-ratio);
  const crf=document.getElementById('crf'); crf.setAttribute('stroke-dashoffset',String(offset));
  let sc='#3b82f6',lc='rgba(59, 130, 246, 0.1)';
  if(warn){sc='#ef4444';lc='rgba(239, 68, 68, 0.15)';}
  crf.style.stroke=sc; crf.style.filter=`drop-shadow(0 0 4px ${sc})`;
  const liq=document.getElementById('ctrl-liquid'); liq.style.height=(ratio*100)+'%';liq.style.background=lc;
  const cap=document.getElementById('live-capsule'); const capLbl=document.getElementById('cap-label');
  if(S.matchEnded){cap.className='ended';capLbl.textContent='FINAL';}
  else if(S.intermissionRunning){cap.className='intermission';capLbl.textContent='INTERMISSION';}
  else if(S.matchRunning){cap.className='live';capLbl.textContent='LIVE';}
  else{cap.className='';capLbl.textContent='WAITING';}
  const br=document.getElementById('bar-round');
  if(S.sport==='basketball'){br.textContent=`Q${S.round}/4`;br.style.display='';}
  else if(S.sport==='football'){br.textContent=`H${S.round}/2`;br.style.display='';}
  else br.style.display='none';
}

function renderTeam(side){
  const team=side==='a'?S.teamA:S.teamB; const body=document.getElementById('body-'+side);
  const prevInputs = Array.from(body.querySelectorAll('.pl-name-inp')).map(el=>({value:el.value,selStart:el.selectionStart,selEnd:el.selectionEnd,focused:document.activeElement===el}));
  body.innerHTML='';
  const ni=document.getElementById('name-'+side);
  if(ni&&document.activeElement!==ni)ni.value=team.name||'';
  const sd=document.getElementById('score-disp-'+side);
  if(sd)sd.textContent=team.score;
  body.appendChild(mkMod(null,`
    <div class="row score-actions">
      <button class="btn bg" onclick="addScore('${side}',1)">+1</button>
      <button class="btn bg" onclick="addScore('${side}',2)">+2</button>
      <button class="btn bg" onclick="addScore('${side}',3)">+3</button>
      <button class="btn br" onclick="addScore('${side}',-1)">−1</button>
    </div>
    <button class="btn bd full" onclick="resetScore('${side}')">RESET SCORE</button>
  `,'SCORE'));
  if(S.sport==='basketball')renderBball(side,team,body,prevInputs);
  if(S.sport==='football')  renderFtbl(side,team,body);
  if(S.sport==='handball'||S.sport==='volleyball') renderRoster(side,team,body,prevInputs);
}

function renderBball(side,team,body,prevInputs){
  body.appendChild(mkMod('PLAYERS — CONFIG',`
    <div class="lbl">Number of players</div>
    <div class="row">
      <input type="number" id="pcount-${side}" value="${team.players.length}" min="1" max="20">
      <button class="btn ba" onclick="setPlayerCount('${side}')">SET</button>
    </div>
  `));
  body.appendChild(mkMod('TEAM FOULS',`
    <div class="row">
      <button class="btn bo" onclick="addTeamFoul('${side}',1)">+ TEAM FOUL</button>
      <button class="btn bd" onclick="addTeamFoul('${side}',-1)" ${(team.teamFouls||0)<=0?'disabled':''}>− TEAM FOUL</button>
    </div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--muted)">Current: <span style="color:var(--accent-blue)">${team.teamFouls||0}</span></div>
  `));
  if(!team.players.length) return;
  const sec=mkMod('PLAYERS — FOULS',''); const bod=sec.querySelector('.module-body');
  const frag=document.createDocumentFragment();
  team.players.forEach((p,i)=>{
    const fouls=p.fouls||0,out=fouls>=5;
    const row=document.createElement('div');row.className='player-row';row.style.animationDelay=(i*0.04)+'s';
    const inp=document.createElement('input');inp.type='text';inp.className='pl-name-inp';inp.id=`pl-name-${side}-${i}`;
    const prev = prevInputs && prevInputs[i] ? prevInputs[i] : null;
    inp.value = prev && typeof prev.value!=='undefined' ? prev.value : (p.name||`P${i+1}`);
    inp.placeholder=`P${i+1}`;
    inp.oninput = e=>{ (side==='a'?S.teamA:S.teamB).players[i].name = e.target.value; save(); };
    inp.onblur = e=>{ const v = (e.target.value||'').trim()||`P${i+1}`; (side==='a'?S.teamA:S.teamB).players[i].name = v; save(true); };
    const fs=document.createElement('span');fs.className='pl-fouls'+(out?' out':'');fs.textContent=fouls+'F';
    const ab=document.createElement('button');ab.className='btn bo';ab.textContent='+F';if(out)ab.disabled=true;ab.onclick=()=>addFoul(side,i,1);
    const sb=document.createElement('button');sb.className='btn bd';sb.textContent='−F';if(fouls<=0)sb.disabled=true;sb.onclick=()=>addFoul(side,i,-1);
    row.appendChild(inp);row.appendChild(fs);row.appendChild(ab);row.appendChild(sb);
    frag.appendChild(row);
    if(prev && prev.focused){ setTimeout(()=>{ try{ const el=document.getElementById(`pl-name-${side}-${i}`); if(el){ el.focus(); if(typeof prev.selStart==='number'&&typeof prev.selEnd==='number') el.setSelectionRange(prev.selStart,prev.selEnd); } }catch(e){} },0); }
  });
  bod.appendChild(frag); body.appendChild(sec);
}

function renderFtbl(side,team,body){
  const reds=team.redCards||0; let chips='<div class="card-chips">';
  for(let r=0;r<reds;r++)chips+='<div class="chip r"></div>';
  if(!reds)chips+='<span style="color:var(--muted);font-size:0.8rem">No red cards</span>';
  chips+=`</div><div style="font-size:0.68rem;color:var(--muted);font-family:'JetBrains Mono',monospace">${reds} red cards</div>`;
  body.appendChild(mkMod('RED CARDS',chips+`
    <div class="row">
      <button class="btn br" onclick="addRed('${side}',1)">+ RED</button>
      <button class="btn bd" onclick="addRed('${side}',-1)" ${reds<=0?'disabled':''}>− RED</button>
    </div>
    <button class="btn bd full" onclick="resetCards('${side}')">RESET CARDS</button>
  `));
}

function renderRoster(side,team,body,prevInputs){
  body.appendChild(mkMod('PLAYERS — CONFIG',`
    <div class="lbl">Number of players</div>
    <div class="row">
      <input type="number" id="pcount-${side}" value="${team.players.length}" min="1" max="20">
      <button class="btn ba" onclick="setPlayerCount('${side}')">SET</button>
    </div>
  `));
  if(!team.players.length) return;
  const sec=mkMod('TEAM ROSTER',''); const bod=sec.querySelector('.module-body');
  const frag=document.createDocumentFragment();
  team.players.forEach((p,i)=>{
    const row=document.createElement('div');row.className='player-row';row.style.animationDelay=(i*0.03)+'s';
    const inp=document.createElement('input');inp.type='text';inp.className='pl-name-inp';inp.id=`pl-name-${side}-${i}`;
    const prev = prevInputs && prevInputs[i] ? prevInputs[i] : null;
    inp.value = prev && typeof prev.value!=='undefined' ? prev.value : (p.name||`P${i+1}`);
    inp.placeholder=`P${i+1}`;
    inp.oninput = e=>{ (side==='a'?S.teamA:S.teamB).players[i].name = e.target.value; save(); };
    inp.onblur = e=>{ const v = (e.target.value||'').trim()||`P${i+1}`; (side==='a'?S.teamA:S.teamB).players[i].name = v; save(true); };
    row.appendChild(inp); frag.appendChild(row);
    if(prev && prev.focused){ setTimeout(()=>{ try{ const el=document.getElementById(`pl-name-${side}-${i}`); if(el){ el.focus(); if(typeof prev.selStart==='number'&&typeof prev.selEnd==='number') el.setSelectionRange(prev.selStart,prev.selEnd); } }catch(e){} },0); }
  });
  bod.appendChild(frag); body.appendChild(sec);
}

function renderCenter(){
  const az=document.getElementById('action-zone'); az.innerHTML='';az.style.display='flex';az.style.flexDirection='column';az.style.gap='5px';
  if(!S.matchEnded){
    if(!S.matchRunning&&!S.intermissionRunning){
      const hasPausedTime = S.timerSeconds>0 && S.timerSeconds<(S.roundMinutes*60);
      if(hasPausedTime){ az.appendChild(mkBtn('▶ RESUME MATCH','btn bg big full',()=>{S.matchRunning=true;S.intermissionRunning=false;startTimer();save();renderAll();})); }
      else{ az.appendChild(mkBtn('▶ START MATCH','btn bg big full',()=>{requestStartMatch();})); }
      az.appendChild(mkBtn('☕ START INTERMISSION','btn bo full',()=>{S.intermissionRunning=true;S.matchRunning=false;S.intermissionSeconds=S.intermissionMinutes*60;startTimer();save();renderAll();}));
    }else if(S.matchRunning){
      az.appendChild(mkBtn('⏸ PAUSE MATCH','btn bo big full',()=>{S.matchRunning=false;stopTimer();save();renderAll();}));
      az.appendChild(mkBtn('⏹ STOP CLOCK','btn br full',()=>{S.matchRunning=false;stopTimer();save();renderAll();}));
    }else if(S.intermissionRunning){
      az.appendChild(mkBtn('⏹ END INTERMISSION','btn bo big full',()=>{S.intermissionRunning=false;stopTimer();startMatch();}));
    }
  }
  const rcb=document.getElementById('round-config-block');rcb.innerHTML='';
  if(S.sport==='basketball'||S.sport==='football'){
    const max=S.sport==='basketball'?4:2;
    rcb.appendChild(mkCtrlMod('ROUND',`
      <div class="round-display">${S.round}</div>
      <div class="round-sublbl">${S.sport==='football'?'HALF':'QUARTER'} OF ${max}</div>
      <div class="row">
        <button class="btn bd" onclick="changeRound(-1)" ${S.round<=1?'disabled':''}>◀</button>
        <button class="btn bd" onclick="changeRound(1)"  ${S.round>=max?'disabled':''}>▶</button>
      </div>
    `));
  }
  const tcb=document.getElementById('time-config-block');tcb.innerHTML='';
  if(S.sport==='basketball'||S.sport==='football'){
    tcb.appendChild(mkCtrlMod(`${S.sport==='football'?'HALF':'QUARTER'} DURATION`,`
      <div class="lbl">Minutes</div>
      <div class="row">
        <input type="number" id="round-mins" value="${S.roundMinutes}" min="1" max="60">
        <button class="btn ba" onclick="setRoundMins()">SET</button>
      </div>
    `));
  }
  if(S.sport==='basketball'){
    tcb.appendChild(mkCtrlMod('SHOT CLOCK',`
      <div style="display:flex;align-items:center;gap:12px">
        <div id="shotclock-disp" style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;padding:6px 10px;border-radius:8px;background:var(--bg-panel);min-width:56px;text-align:center">${String(S.shotclockSeconds||15).padStart(2,'0')}</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;gap:6px">
            <button class="btn bg" onclick="startShotclockManager()">▶ START</button>
            <button class="btn bd" onclick="resetShotclockManager()">↺ RESET</button>
          </div>
          <div style="font-size:0.78rem;color:var(--text-muted)">15 second shot clock</div>
        </div>
      </div>
    `));
  }
  tcb.appendChild(mkCtrlMod('INTERMISSION',`
    <div class="lbl">Minutes</div>
    <div class="row">
      <input type="number" id="int-mins" value="${S.intermissionMinutes}" min="1" max="60">
      <button class="btn ba" onclick="setIntMins()">SET</button>
    </div>
  `));
}

/* SHOTCLOCK */
function startShotclockManager(){
  try{
    if(scIntervalManager) clearInterval(scIntervalManager);
    S.shotclockSeconds = 15; S.shotclockRunning = true;
    scIntervalManager = setInterval(()=>{
      S.shotclockSeconds = Math.max(0,(S.shotclockSeconds||15)-1); renderShotclockManager(); save();
      if(S.shotclockSeconds<=0){ clearInterval(scIntervalManager); scIntervalManager=null; S.shotclockRunning=false; save(); }
    },1000);
    renderShotclockManager(); save();
    try{
      if (window.HighScoreBridge && typeof window.HighScoreBridge.sendMessage === 'function') {
        try { window.HighScoreBridge.sendMessage({ type: 'hs_shotclock', action: 'start' }); } catch(e) {}
      } else { const bb = window.open('billboard.html','HighScore_Billboard'); if(bb && !bb.closed) bb.postMessage({type:'hs_shotclock', action:'start'}, '*'); }
    }catch(e){}
  }catch(e){}
}

function resetShotclockManager(){
  try{
    if(scIntervalManager){ clearInterval(scIntervalManager); scIntervalManager=null; }
    S.shotclockSeconds = 15; S.shotclockRunning = false;
    renderShotclockManager(); save();
    try{
      if (window.HighScoreBridge && typeof window.HighScoreBridge.sendMessage === 'function') {
        try { window.HighScoreBridge.sendMessage({ type: 'hs_shotclock', action: 'reset' }); } catch(e) {}
      } else { const bb = window.open('billboard.html','HighScore_Billboard'); try{ if(bb && !bb.closed) bb.postMessage({type:'hs_shotclock', action:'reset'}, '*'); }catch(e){} }
    }catch(e){}
  }catch(e){}
}

/* HELPERS */
function mkMod(title,bodyHtml,altTitle){const d=document.createElement('div');d.className='module';const hd=document.createElement('div');hd.className='module-hd';const dot=document.createElement('div');dot.className='dot';hd.appendChild(dot);const span=document.createElement('span');span.textContent=title||altTitle||'';hd.appendChild(span);const bd=document.createElement('div');bd.className='module-body';bd.innerHTML=bodyHtml;d.appendChild(hd);d.appendChild(bd);return d}
function mkCtrlMod(title,bodyHtml){const d=document.createElement('div');d.className='ctrl-mod';d.innerHTML=`<div class="ctrl-hd">${title}</div><div class="ctrl-body">${bodyHtml}</div>`;return d}
function mkBtn(text,cls,fn){const b=document.createElement('button');b.className=cls;b.innerHTML=text;b.onclick=fn;return b}

function addScore(side,delta){
  const t = side==='a' ? S.teamA : S.teamB;
  t.score = Math.max(0, t.score + delta);
  const d = document.getElementById('score-disp-'+side);
  if(d){
    d.classList.remove('pop'); void d.offsetWidth; d.classList.add('pop');
    try{ if(window.gsap){ gsap.fromTo(d,{scale:0.9,opacity:0.7},{scale:1.14,opacity:1,duration:0.36,ease:'elastic.out(1,0.5)'}); } }catch(e){}
  }
  save(); renderTeam('a'); renderTeam('b');

  // Fallback sound locally in manager
  try{ const url = new URL('../../assets/sounds/score.mp3', location.href).href; const a = new Audio(url); a.volume = 0.85; a.play().catch(()=>{}); }catch(e){}
}

function resetScore(side){(side==='a'?S.teamA:S.teamB).score=0;save();renderTeam('a');renderTeam('b')}
function addRed(side,delta){const t=side==='a'?S.teamA:S.teamB;t.redCards=Math.max(0,(t.redCards||0)+delta);save();renderTeam('a');renderTeam('b')}
function resetCards(side){(side==='a'?S.teamA:S.teamB).redCards=0;save();renderTeam('a');renderTeam('b')}
function addFoul(side,idx,delta){const t=side==='a'?S.teamA:S.teamB;t.players[idx].fouls=Math.max(0,Math.min(5,(t.players[idx].fouls||0)+delta));save();renderTeam(side)}
function addTeamFoul(side,delta){const t=side==='a'?S.teamA:S.teamB;t.teamFouls=Math.max(0,(t.teamFouls||0)+delta);save();renderTeam(side)}
function setPlayerCount(side){const n=Math.max(1,Math.min(20,parseInt(document.getElementById('pcount-'+side).value)||1));const t=side==='a'?S.teamA:S.teamB;const cur=t.players.length;if(n>cur)for(let i=cur;i<n;i++)t.players.push({name:`P${i+1}`,fouls:0});else t.players=t.players.slice(0,n);save();renderTeam(side)}
function changeRound(delta){const max=S.sport==='basketball'?4:2;S.round=Math.max(1,Math.min(max,S.round+delta));S.timerSeconds=S.roundMinutes*60;S.matchRunning=false;stopTimer();save();renderAll()}
function setRoundMins(){const mins=parseInt(document.getElementById('round-mins').value)||S.roundMinutes;S.roundMinutes=Math.max(1,Math.min(60,mins));S.timerSeconds=S.roundMinutes*60;save();renderAll()}
function setIntMins(){const mins=parseInt(document.getElementById('int-mins').value)||S.intermissionMinutes;S.intermissionMinutes=Math.max(1,Math.min(60,mins));S.intermissionSeconds=S.intermissionMinutes*60;save();renderAll()}
function confirmReset(){showModal('START NEW MATCH?','This will reset all scores, cards, fouls, and timers.',()=>{stopTimer();const sp=S.sport;S=JSON.parse(JSON.stringify(DEF));S.sport=sp;S.totalRounds=sp==='football'?2:4;S.roundMinutes=sp==='basketball'?15:sp==='football'?45:30;S.timerSeconds=S.roundMinutes*60;save();renderAll();})}
function openBillboard(){
  if (window.HighScoreBridge && typeof window.HighScoreBridge.openBillboard === 'function') {
    try { window.HighScoreBridge.openBillboard(); return; } catch(e) {}
  }
  window.open('billboard.html','HighScore_Billboard','width=1280,height=720,toolbar=no,menubar=no,scrollbars=no')
}

function showModal(title,body,ok){document.getElementById('modal-title').textContent=title;document.getElementById('modal-body').textContent=body;document.getElementById('modal-ok').onclick=()=>{closeModal();ok();};document.getElementById('modal').classList.add('show')}
function closeModal(){document.getElementById('modal').classList.remove('show')}

/* ── SETTINGS & MISTRAL AI LOGIC ── */
function openSettingsModal() {
  document.getElementById('set-ai-enable').checked = localStorage.getItem('hs_ai_enabled') === 'true';
  document.getElementById('set-ai-key').value = localStorage.getItem('hs_mistral_key') || '';
  document.getElementById('set-upd-interval').value = localStorage.getItem('hs_upd_interval') || 'none';
  document.getElementById('settings-modal').classList.add('show');
}
function closeSettingsModal() { document.getElementById('settings-modal').classList.remove('show'); }

function saveSettings() {
  const aiEnabled = document.getElementById('set-ai-enable').checked;
  const aiKey = document.getElementById('set-ai-key').value.trim();
  const updInterval = document.getElementById('set-upd-interval').value;
  
  localStorage.setItem('hs_ai_enabled', aiEnabled);
  localStorage.setItem('hs_mistral_key', aiKey);
  localStorage.setItem('hs_upd_interval', updInterval);
  
  document.getElementById('ai-widget').classList.toggle('enabled', aiEnabled);
  if(updInterval !== 'none' && Notification.permission !== 'granted') { Notification.requestPermission(); }
  closeSettingsModal(); setupUpdateTimer();
}

async function sendAiMessage() {
  const inputEl = document.getElementById('ai-input');
  const chatBox = document.getElementById('ai-chat-box');
  const userMsg = inputEl.value.trim();
  if(!userMsg) return;

  inputEl.value = '';
  chatBox.innerHTML += `<div class="ai-msg user">${userMsg}</div>`;
  chatBox.scrollTop = chatBox.scrollHeight;

  const apiKey = localStorage.getItem('hs_mistral_key');
  if(!apiKey) {
    chatBox.innerHTML += `<div class="ai-msg bot">Error: Missing Mistral API Key in Settings.</div>`;
    return;
  }

  const ta = S.teamA.name || 'Team A'; const tb = S.teamB.name || 'Team B';
  const taKey = ta.replace(/\s+/g,'_'); const tbKey = tb.replace(/\s+/g,'_');
  let ctx = `SCORE_${taKey}:${S.teamA.score}; SCORE_${tbKey}:${S.teamB.score}; `;
  if(S.sport === 'football') { ctx += `RED_CARDS_${taKey}:${S.teamA.redCards||0}; RED_CARDS_${tbKey}:${S.teamB.redCards||0}; `; } 
  else if(S.sport === 'basketball') { ctx += `TEAM_FOULS_${taKey}:${S.teamA.teamFouls||0}; TEAM_FOULS_${tbKey}:${S.teamB.teamFouls||0}; `; }
  const promptStr = `{PROMPT:"${userMsg}"; ${ctx}}`;

  chatBox.innerHTML += `<div class="ai-msg bot loading">...</div>`;
  chatBox.scrollTop = chatBox.scrollHeight;

  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'mistral-tiny', messages: [{role: 'user', content: promptStr}] })
    });
    const data = await res.json();
    const botReply = data.choices && data.choices[0] ? data.choices[0].message.content : 'Error processing request.';
    document.querySelector('.ai-msg.bot.loading').remove();
    chatBox.innerHTML += `<div class="ai-msg bot">${botReply}</div>`;
  } catch(e) {
    document.querySelector('.ai-msg.bot.loading').remove();
    chatBox.innerHTML += `<div class="ai-msg bot" style="color:#ef4444;">Connection failed. Check API key.</div>`;
  }
  chatBox.scrollTop = chatBox.scrollHeight;
}

/* ── BACKGROUND UPDATE CHECK ── */
let updTimer = null;
function setupUpdateTimer() {
  if(updTimer) clearInterval(updTimer);
  const val = localStorage.getItem('hs_upd_interval');
  if(!val || val === 'none') return;
  const ms = parseInt(val) * 60 * 60 * 1000;
  updTimer = setInterval(async () => {
    try {
      const r = await fetch(`https://api.github.com/repos/robert19066/HighScore/releases/latest`, {cache:'no-store'});
      const rel = await r.json();
      const latestParsed = typeof iosParseVer === 'function' ? iosParseVer(rel.name||rel.tag_name) : null;
      
      let localV = '';
      if(window.UpdateChecker&&window.UpdateChecker.getLocalVersion) localV = await window.UpdateChecker.getLocalVersion();
      const localParsed = typeof iosParseVer === 'function' ? iosParseVer(localV) : null;

      if(typeof iosIsNewer === 'function' && iosIsNewer(latestParsed, localParsed)) {
        const dot = document.getElementById('upd-notify-dot'); if(dot) dot.classList.add('show');
        if(Notification.permission === 'granted') new Notification("HighScore Update", { body: `Version ${rel.name} is available!` });
      }
    } catch(e){}
  }, ms);
}

/* ── IOS-STYLE UPDATER LOGIC ── */
let _iosOpen = false;
let _iosChecked = false;

function iosParseVer(vstr){
  const s=(vstr||'').replace(/^v/i,'').trim();
  let m=s.match(/^(\d+)\.(\d+)\.(\d+)[\-_ ]?[Bb](\d+)$/i);
  if(m)return{major:+m[1],minor:+m[2],patch:+m[3],type:'beta',betaNum:+m[4]};
  m=s.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if(m)return{major:+m[1],minor:+m[2],patch:+m[3],type:'stable'};
  return null;
}

function iosIsNewer(latest,current){
  if(!latest||!current)return false;
  if(latest.major!==current.major)return latest.major>current.major;
  if(latest.minor!==current.minor)return latest.minor>current.minor;
  if(latest.patch!==current.patch)return latest.patch>current.patch;
  const ord={stable:3,beta:1}; return(ord[latest.type]||0)>(ord[current.type]||0);
}

function iosFmtVer(p,raw){ return raw||'?'; }

function iosRenderReleases(list, localParsed, installDate){
  const iosReleases = document.getElementById('ios-releases');
  if(!iosReleases) return;
  iosReleases.innerHTML='';
  if(!list||!list.length){ iosReleases.innerHTML='<div style="text-align:center; color:#888;">No releases found</div>'; return; }

  list.forEach((item,idx)=>{
    const rel = item.release||item;
    const parsed = item.parsed||iosParseVer(rel.name||rel.tag_name||'');
    const vtxt = iosFmtVer(parsed,rel.name||rel.tag_name);
    let desc = (rel.body||'').trim();
    const exe = (rel.assets||[]).find(a=>a.name.toLowerCase().endsWith('.exe'));

    let imgSrc = '';
    desc = desc.replace(/!\[.*?\]\((.*?)\)/, (match, url) => {
      if(!imgSrc) imgSrc = url;
      return ''; 
    });
    const shortDesc = desc.length>300 ? desc.slice(0,300)+'…' : desc;

    const card = document.createElement('div');
    card.className='ios-release-card';
    card.innerHTML=`
      <div class="irc-top"><span class="irc-ver">${vtxt}</span></div>
      ${imgSrc ? `<img src="${imgSrc}" class="irc-img">` : ''}
      ${shortDesc ? `<div class="irc-desc">${shortDesc}</div>` : ''}
      <div class="irc-actions">
        ${exe ? `<button class="irc-btn-dl" onclick="iosDownload(${idx})">⬇ Download</button>` : ''}
        ${rel.html_url ? `<button class="irc-btn-web" onclick="window.open('${rel.html_url}','_blank')">GitHub Release</button>` : ''}
      </div>
    `;
    iosReleases.appendChild(card);
    if(window.gsap) gsap.from(card,{opacity:0,y:10,duration:0.3,delay:idx*0.05});
  });
  window._iosReleaseList = list;
}

async function iosDownload(idx){
  const item = window._iosReleaseList[idx];
  const btns = document.querySelectorAll('.irc-btn-dl');
  btns.forEach(b=>{b.disabled=true; b.textContent='Downloading…';});
  try{
    await window.UpdateChecker.downloadRelease(item.release||item);
    btns.forEach(b=>{b.textContent='Downloaded! Check Downloads folder.';});
  }catch(e){
    btns.forEach(b=>{b.disabled=false; b.textContent='Error. Try Web Link';});
  }
}

async function iosDoSearch(){
  if(_iosChecked)return; _iosChecked=true;
  const iosReleases = document.getElementById('ios-releases');
  const iosLocalVerLbl = document.getElementById('ios-local-ver-lbl');
  const iosNotifyDot = document.getElementById('upd-notify-dot');
  
  if(iosReleases) iosReleases.innerHTML='<div style="text-align:center;color:#888;">Checking...</div>';
  
  let localVersion=''; let localParsed=null;
  try{
    if(window.UpdateChecker&&window.UpdateChecker.getLocalVersion) localVersion = await window.UpdateChecker.getLocalVersion();
  }catch(e){}
  localParsed=iosParseVer(localVersion);
  if(iosLocalVerLbl) iosLocalVerLbl.textContent=localVersion?`Installed: ${localVersion}`:'Installed: Unknown';

  try{
    const r=await fetch(`https://api.github.com/repos/robert19066/HighScore/releases?per_page=5`,{cache:'no-store'});
    const raw=await r.json();
    const list=raw.map(rel=>({ release:rel, parsed:iosParseVer(rel.name||rel.tag_name||'') }));
    if(list.length && iosIsNewer(list[0].parsed, localParsed)){ if(iosNotifyDot) iosNotifyDot.classList.add('show'); }
    iosRenderReleases(list, localParsed, null);
  }catch(err){ if(iosReleases) iosReleases.innerHTML=`<div style="color:#ef4444;">Error checking updates</div>`; }
}

function openUpdateSheet(){
  _iosOpen=true; 
  const iosSheet = document.getElementById('ios-update-sheet');
  const iosSheetBox = document.getElementById('ios-sheet-box');
  if(iosSheet) iosSheet.classList.add('open');
  if(window.gsap && iosSheetBox) gsap.fromTo(iosSheetBox, {y:'100%'}, {y:0,duration:0.4,ease:'power3.out'});
  iosDoSearch();
}

function closeUpdateSheet(){
  const iosSheet = document.getElementById('ios-update-sheet');
  const iosSheetBox = document.getElementById('ios-sheet-box');
  if(window.gsap && iosSheetBox) {
    gsap.to(iosSheetBox,{y:'100%',duration:0.3,ease:'power3.in',onComplete:()=>{ if(iosSheet) iosSheet.classList.remove('open'); _iosOpen=false; }});
  } else {
    if(iosSheet) iosSheet.classList.remove('open');
    _iosOpen = false;
  }
}

/* ALPINE APP ROOT */
function managerApp(){ return{ init(){} }; }

/* INIT */
let VERSION='';
try{const saved=localStorage.getItem('hs_state');if(saved)S=JSON.parse(saved);}catch(e){}
normalizeState();
try{const p=new URLSearchParams(location.search);VERSION=p.get('v')||'';const lv=document.getElementById('logo-ver');if(lv)lv.textContent=VERSION?'v'+VERSION:'';}catch(e){}

if(window.UpdateChecker&&window.UpdateChecker.getLocalVersion){window.UpdateChecker.getLocalVersion().then(t=>{const v=(t||'').trim();if(v){VERSION=v.replace(/^v/i,'');const lv=document.getElementById('logo-ver');if(lv)lv.textContent='v'+VERSION;}}).catch(()=>{});}

function initSportFromState(){const s=S.sport||'basketball';S.sport=s;const pi=document.getElementById('pill-icon'); if(pi) pi.textContent=SPORT_ICONS[s]||'🏀';const pn=document.getElementById('pill-name'); if(pn) pn.textContent=SPORT_NAMES[s]||'BASKETBALL';S.totalRounds = s==='football'?2:4;S.roundMinutes = S.roundMinutes|| (s==='basketball'?15:s==='football'?45:30);S.intermissionMinutes = S.intermissionMinutes||15;S.timerSeconds = S.timerSeconds||S.roundMinutes*60;S.intermissionSeconds = S.intermissionSeconds||S.intermissionMinutes*60;const sel=document.getElementById('sport-selector'); if(sel) sel.style.display='none';renderAll();}

if(S.sport) initSportFromState();
if(S.shotclockRunning){
  try{
    if(scIntervalManager) clearInterval(scIntervalManager);
    scIntervalManager = setInterval(()=>{
      S.shotclockSeconds = Math.max(0,(S.shotclockSeconds||15)-1); renderShotclockManager(); save();
      if(S.shotclockSeconds<=0){ clearInterval(scIntervalManager); scIntervalManager=null; S.shotclockRunning=false; save(); }
    },1000);
  }catch(e){}
}

// Restore widget UI visibility on load
if(localStorage.getItem('hs_ai_enabled') === 'true') {
  const w = document.getElementById('ai-widget');
  if(w) w.classList.add('enabled');
}
setupUpdateTimer();