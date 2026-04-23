/* Extracted manager script from manager.html */

/* SPORT SELECTOR CANVAS */
(function(){
  const canvas=document.getElementById('sel-canvas');
  const ctx=canvas.getContext('2d');
  let W,H;
  function resize(){W=canvas.width=canvas.offsetWidth;H=canvas.height=canvas.offsetHeight;}
  resize();window.addEventListener('resize',resize);
  const P=[];
  function mk(){
    const x=Math.random()*W;
    return{x,y:H+5,col:[Math.random()<0.5?240:48,Math.random()<0.5?192:144,Math.random()<0.5?64:248],sz:Math.random()*1.2+0.2,vy:-(Math.random()*0.35+0.1),vx:(Math.random()-0.5)*0.15,life:1,decay:Math.random()*0.003+0.001};
  }
  for(let i=0;i<60;i++){const p=mk();p.y=Math.random()*H;P.push(p);}  
  function frame(){
    if(document.hidden){requestAnimationFrame(frame);return;}
    ctx.clearRect(0,0,W,H);
    if(Math.random()<0.25)P.push(mk());
    while(P.length>90)P.shift();
    for(let i=P.length-1;i>=0;i--){
      const p=P[i];p.y+=p.vy;p.x+=p.vx;p.life-=p.decay;
      if(p.life<=0||p.y<-3){P.splice(i,1);continue;}
      ctx.beginPath();ctx.arc(p.x,p.y,p.sz,0,Math.PI*2);
      ctx.fillStyle=`rgba(${p.col[0]},${p.col[1]},${p.col[2]},${(p.life*0.12).toFixed(3)})`;
      ctx.fill();
    }
    requestAnimationFrame(frame);
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
  matchRunning:false,intermissionRunning:false,matchEnded:false
};
let S=JSON.parse(JSON.stringify(DEF));
let timerInterval=null;

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
}

let _saveTimeout=null;
function save(force){
  if(force){
    if(_saveTimeout){clearTimeout(_saveTimeout);_saveTimeout=null;}
    try{localStorage.setItem('hs_state',JSON.stringify(S));}catch(e){}
    renderStatus();
    return;
  }
  if(_saveTimeout) clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(()=>{try{localStorage.setItem('hs_state',JSON.stringify(S));}catch(e){};renderStatus();_saveTimeout=null;},220);
}

/* SPORT SELECTOR helpers */
const SPORT_ICONS={basketball:'🏀',football:'⚽',handball:'🤾',volleyball:'🏐'};
const SPORT_NAMES={basketball:'BASKETBALL',football:'FOOTBALL',handball:'HANDBALL',volleyball:'VOLLEYBALL'};

function selectSport(sport){
  S.sport=sport;
  S.teamA.score=0;S.teamB.score=0;
  S.teamA.redCards=0;S.teamB.redCards=0;
  S.teamA.teamFouls=0;S.teamB.teamFouls=0;
  S.teamA.players=S.teamA.players||[];S.teamB.players=S.teamB.players||[];
  S.round=1;S.matchRunning=false;S.intermissionRunning=false;S.matchEnded=false;
  S.totalRounds=sport==='football'?2:4;
  S.roundMinutes=sport==='basketball'?15:sport==='football'?45:30;
  S.intermissionMinutes=15;
  S.timerSeconds=S.roundMinutes*60;S.intermissionSeconds=S.intermissionMinutes*60;
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
function startTimer(){stopTimer();timerInterval=setInterval(()=>{if(S.intermissionRunning){S.intermissionSeconds=Math.max(0,S.intermissionSeconds-1);if(S.intermissionSeconds<=0){S.intermissionRunning=false;startMatch();return;}}else if(S.matchRunning){S.timerSeconds=Math.max(0,S.timerSeconds-1);if(S.timerSeconds<=0){S.matchRunning=false;if((S.sport==='basketball'&&S.round>=4)||(S.sport==='football'&&S.round>=2)||S.sport==='handball'||S.sport==='volleyball')S.matchEnded=true;stopTimer();}}save();renderStatus();},1000);} 
function stopTimer(){if(timerInterval){clearInterval(timerInterval);timerInterval=null;}}
function startMatch(){S.matchRunning=true;S.intermissionRunning=false;S.timerSeconds=S.roundMinutes*60;startTimer();save();renderAll();}

/* RENDER */
function renderAll(){renderTeam('a');renderTeam('b');renderCenter();renderStatus();}
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
  const maxSecs=S.roundMinutes*60||900;
  const ratio=maxSecs>0?secs/maxSecs:0;
  const offset=CIRC*(1-ratio);
  const crf=document.getElementById('crf');
  crf.setAttribute('stroke-dashoffset',String(offset));
  let sc='#f0c040',lc='rgba(240,192,64,0.06)';
  if(warn){sc='#e83050';lc='rgba(232,48,80,0.15)';}
  else if(ratio>0.5){sc='#38e888';lc='rgba(56,232,136,0.08)';}
  else if(ratio>0.2){sc='#f0c040';lc='rgba(240,192,64,0.08)';}
  else{sc='#e83050';lc='rgba(232,48,80,0.15)';}
  crf.style.stroke=sc;crf.style.filter=`drop-shadow(0 0 4px ${sc})`;
  const liq=document.getElementById('ctrl-liquid');
  liq.style.height=(ratio*100)+'%';liq.style.background=lc;
  const cap=document.getElementById('live-capsule');
  const capLbl=document.getElementById('cap-label');
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
  const team=side==='a'?S.teamA:S.teamB;
  const body=document.getElementById('body-'+side);
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
    <div style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--muted)">Current: <span style="color:var(--orange)">${team.teamFouls||0}</span> (unlimited)</div>
  `));
  if(!team.players.length) return;
  const sec=mkMod('PLAYERS — FOULS','');
  const bod=sec.querySelector('.module-body');
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
  bod.appendChild(frag);
  body.appendChild(sec);
}

function renderFtbl(side,team,body){
  const reds=team.redCards||0;
  let chips='<div class="card-chips">';
  for(let r=0;r<reds;r++)chips+='<div class="chip r"></div>';
  if(!reds)chips+='<span style="color:var(--muted);font-size:0.8rem">No red cards</span>';
  chips+='</div>';
  chips+=`<div style="font-size:0.68rem;color:var(--muted);font-family:'JetBrains Mono',monospace">${reds} red cards</div>`;
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
  const sec=mkMod('TEAM ROSTER','');
  const bod=sec.querySelector('.module-body');
  const frag=document.createDocumentFragment();
  team.players.forEach((p,i)=>{
    const row=document.createElement('div');row.className='player-row';row.style.animationDelay=(i*0.03)+'s';
    const inp=document.createElement('input');inp.type='text';inp.className='pl-name-inp';inp.id=`pl-name-${side}-${i}`;
    const prev = prevInputs && prevInputs[i] ? prevInputs[i] : null;
    inp.value = prev && typeof prev.value!=='undefined' ? prev.value : (p.name||`P${i+1}`);
    inp.placeholder=`P${i+1}`;
    inp.oninput = e=>{ (side==='a'?S.teamA:S.teamB).players[i].name = e.target.value; save(); };
    inp.onblur = e=>{ const v = (e.target.value||'').trim()||`P${i+1}`; (side==='a'?S.teamA:S.teamB).players[i].name = v; save(true); };
    row.appendChild(inp);
    frag.appendChild(row);
    if(prev && prev.focused){ setTimeout(()=>{ try{ const el=document.getElementById(`pl-name-${side}-${i}`); if(el){ el.focus(); if(typeof prev.selStart==='number'&&typeof prev.selEnd==='number') el.setSelectionRange(prev.selStart,prev.selEnd); } }catch(e){} },0); }
  });
  bod.appendChild(frag);
  body.appendChild(sec);
}

function renderCenter(){
  const az=document.getElementById('action-zone');
  az.innerHTML='';az.style.display='flex';az.style.flexDirection='column';az.style.gap='5px';
  if(!S.matchEnded){
    if(!S.matchRunning&&!S.intermissionRunning){
      const hasPausedTime = S.timerSeconds>0 && S.timerSeconds<(S.roundMinutes*60);
      az.appendChild(mkBtn(hasPausedTime?'▶ RESUME MATCH':'▶ START MATCH','btn bg big full',()=>{S.matchRunning=true;S.intermissionRunning=false;startTimer();save();renderAll();}));
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
    const rc=mkCtrlMod('ROUND',`
      <div class="round-display">${S.round}</div>
      <div class="round-sublbl">${S.sport==='football'?'HALF':'QUARTER'} OF ${max}</div>
      <div class="row">
        <button class="btn bd" onclick="changeRound(-1)" ${S.round<=1?'disabled':''}>◀</button>
        <button class="btn bd" onclick="changeRound(1)"  ${S.round>=max?'disabled':''}>▶</button>
      </div>
    `);
    rcb.appendChild(rc);
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
  tcb.appendChild(mkCtrlMod('INTERMISSION',`
    <div class="lbl">Minutes</div>
    <div class="row">
      <input type="number" id="int-mins" value="${S.intermissionMinutes}" min="1" max="60">
      <button class="btn ba" onclick="setIntMins()">SET</button>
    </div>
  `));
}

/* HELPERS */
function mkMod(title,bodyHtml,altTitle){const d=document.createElement('div');d.className='module';const hd=document.createElement('div');hd.className='module-hd';const dot=document.createElement('div');dot.className='dot';hd.appendChild(dot);const span=document.createElement('span');span.textContent=title||altTitle||'';hd.appendChild(span);const bd=document.createElement('div');bd.className='module-body';bd.innerHTML=bodyHtml;d.appendChild(hd);d.appendChild(bd);return d}
function mkCtrlMod(title,bodyHtml){const d=document.createElement('div');d.className='ctrl-mod';d.innerHTML=`<div class="ctrl-hd">${title}</div><div class="ctrl-body">${bodyHtml}</div>`;return d}
function mkBtn(text,cls,fn){const b=document.createElement('button');b.className=cls;b.innerHTML=text;b.onclick=fn;return b}
function addScore(side,delta){const t=side==='a'?S.teamA:S.teamB;t.score=Math.max(0,t.score+delta);const d=document.getElementById('score-disp-'+side);if(d){d.classList.remove('pop');void d.offsetWidth;d.classList.add('pop');try{ if(window.gsap){ gsap.fromTo(d,{scale:0.9,opacity:0.7},{scale:1.14,opacity:1,duration:0.36,ease:'elastic.out(1,0.5)'}); } }catch(e){}}save();renderTeam('a');renderTeam('b')}
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
function openBillboard(){window.open('billboard.html','HighScore_Billboard','width=1280,height=720,toolbar=no,menubar=no,scrollbars=no')}

/* MODAL */
function showModal(title,body,ok){document.getElementById('modal-title').textContent=title;document.getElementById('modal-body').textContent=body;document.getElementById('modal-ok').onclick=()=>{closeModal();ok();};document.getElementById('modal').classList.add('show')}
function closeModal(){document.getElementById('modal').classList.remove('show')}

/* GITHUB UPDATE CHECK */
let latestRelease=null;const UPD={modal:document.getElementById('update-modal'),progressWrap:document.getElementById('upd-progress-wrap'),progressFill:document.getElementById('upd-progress-fill'),progressLabel:document.getElementById('upd-progress-label'),doneMsg:document.getElementById('upd-done-msg'),downloadBtn:document.getElementById('upd-download-btn'),searchBtn:document.getElementById('upd-search-btn'),result:document.getElementById('upd-result'),newVer:document.getElementById('upd-new-ver')};

function parseVersion(vstr){const s=(vstr||'').replace(/^v/i,'').trim();let m=s.match(/^(\d+)\.(\d+)\.(\d+)[\- _]?[Bb](\d+)$/i);if(m)return{major:+m[1],minor:+m[2],patch:+m[3],type:'beta',betaNum:+m[4]};m=s.match(/^(\d+)\.(\d+)\.(\d+)[\- _]?(?:RC|rc)(\d*)$/);if(m)return{major:+m[1],minor:+m[2],patch:+m[3],type:'rc',rcNum:(m[4]?+m[4]:0)};m=s.match(/^(\d+)\.(\d+)\.(\d+)$/);if(m)return{major:+m[1],minor:+m[2],patch:+m[3],type:'stable'};return null}
function versionIsNewer(latest,current){if(!latest||!current)return false;if(latest.major!==current.major)return latest.major>current.major;if(latest.minor!==current.minor)return latest.minor>current.minor;if(latest.patch!==current.patch)return latest.patch>current.patch;const order={stable:3,rc:2,beta:1};const la=order[latest.type]||0, cu=order[current.type]||0;if(la!==cu)return la>cu;if(latest.type==='beta'&&current.type==='beta')return (latest.betaNum||0)>(current.betaNum||0);if(latest.type==='rc'&&current.type==='rc')return (latest.rcNum||0)>(current.rcNum||0);return false}
function formatVersion(parsed,raw){if(!parsed)return raw||'?';if(parsed.type==='beta')return `V${parsed.major}.${parsed.minor}.${parsed.patch} Beta ${parsed.betaNum}`;return `V${parsed.major}.${parsed.minor}.${parsed.patch}`} 

async function checkUpdate(){let localVersion=VERSION||'';try{if(window.UpdateChecker&&window.UpdateChecker.getLocalVersion){const lv=await window.UpdateChecker.getLocalVersion();if(lv) localVersion=lv;}}catch(e){}const curParsed=parseVersion(localVersion);if(!curParsed) return;try{const r=await fetch('https://api.github.com/repos/robert19066/HighScore/releases?per_page=10',{headers:{'Accept':'application/vnd.github.v3+json'},cache:'no-store'});let bestRelease=null,bestParsed=null;if(r.ok){const list=await r.json();for(const rel of list){const verStr=(rel.name&&rel.name.trim())?rel.name.trim():rel.tag_name||'';const p=parseVersion(verStr);if(!p)continue;if(versionIsNewer(p,curParsed)){if(!bestParsed||versionIsNewer(p,bestParsed)){bestParsed=p;bestRelease=rel;}}}}if(bestRelease&&bestParsed){latestRelease=bestRelease;document.getElementById('upd-new-ver').textContent=formatVersion(bestParsed,bestRelease.name||bestRelease.tag_name);} }catch(e){} }

function openUpdateModal(){UPD.modal.classList.add('show');document.body.classList.add('modal-open');UPD.progressWrap.style.display='none';UPD.doneMsg.style.display='none';UPD.downloadBtn.style.display='';UPD.downloadBtn.disabled=false;UPD.downloadBtn.textContent='⬇ DOWNLOAD UPDATE'}
function closeUpdateModal(){UPD.modal.classList.remove('show');document.body.classList.remove('modal-open')}
function setUpdateBusy(isBusy,label){const searchBtn=UPD.searchBtn;const downloadBtn=UPD.downloadBtn;const progWrap=UPD.progressWrap;const progFill=UPD.progressFill;const progLabel=UPD.progressLabel;if(progLabel&&label)progLabel.textContent=label;if(isBusy){if(searchBtn)searchBtn.disabled=true;if(downloadBtn)downloadBtn.disabled=true;if(progWrap){progWrap.style.display='flex';progWrap.classList.add('busy');}if(progFill)progFill.style.width='55%';}else{if(searchBtn)searchBtn.disabled=false;if(downloadBtn)downloadBtn.disabled=false;if(progWrap)progWrap.classList.remove('busy');}}
function getExeAsset(release){if(!release||!release.assets)return null;return release.assets.find(a=>a.name.toLowerCase().endsWith('.exe'))||null}

async function startDownload(){const btn=UPD.downloadBtn;const pw=UPD.progressWrap;const pf=UPD.progressFill;const pl=UPD.progressLabel;const done=UPD.doneMsg;btn.disabled=true;btn.textContent='DOWNLOADING…';pw.style.display='flex';pw.classList.remove('busy');pf.style.width='20%';pl.textContent='Starting download…';try{const ok=await window.UpdateChecker.downloadRelease(latestRelease);if(ok){pf.style.width='100%';pl.textContent='Complete! Opening file…';btn.style.display='none';done.style.display='';}else{pl.textContent='Opened release page';setTimeout(()=>{closeUpdateModal();},800);} }catch(e){pl.textContent='Error during download';console.warn(e);} finally{if(pw)pw.classList.remove('busy');try{btn.disabled=false;btn.textContent='⬇ DOWNLOAD UPDATE';}catch(e){}}}

function checkForUpdatesClicked(e){setUpdateChannel(window.updateChannel||'stable');window.UpdateChecker && window.UpdateChecker.getLocalVersion && window.UpdateChecker.getLocalVersion().then(v=>{const lv=document.getElementById('upd-local-ver'); if(lv)lv.textContent=v||'-';}).catch(()=>{});UPD.result.textContent='';UPD.newVer.textContent='';UPD.downloadBtn.style.display='none';UPD.searchBtn.style.display='';UPD.progressWrap.style.display='none';UPD.progressWrap.classList.remove('busy');UPD.progressFill.style.width='0%';UPD.progressLabel.textContent='Preparing download…';UPD.modal.classList.add('show');document.body.classList.add('modal-open')}

function setUpdateChannel(ch){window.updateChannel=ch||'stable';const sbtn=document.getElementById('upd-ch-stable');const bbtn=document.getElementById('upd-ch-beta');if(sbtn) sbtn.className = (window.updateChannel==='stable' ? 'btn bg' : 'btn bd');if(bbtn) bbtn.className = (window.updateChannel==='beta' ? 'btn bg' : 'btn bd');const topBtn=document.getElementById('check-update-btn'); if(topBtn) topBtn.textContent=`Check For Updates (${window.updateChannel})`}

function performUpdateSearch(){const ch=window.updateChannel||'stable';const searchBtn=document.getElementById('upd-search-btn');const resEl=document.getElementById('upd-result');const newver=document.getElementById('upd-new-ver');searchBtn.disabled=true; searchBtn.textContent='Searching…';setUpdateBusy(true,'Checking releases…');const listEl = document.getElementById('upd-list'); if(listEl) listEl.innerHTML='';newver.textContent=''; resEl.textContent='';window.UpdateChecker && window.UpdateChecker.getRecentReleases && window.UpdateChecker.getRecentReleases({channel:ch,count:3}).then(list=>{if(!list||!list.length){ resEl.textContent='No releases found for channel '+ch+'.'; const ub=document.getElementById('update-badge'); if(ub) ub.style.display='none'; return;}list.forEach(item=>{const rel=item.release;const parsed=item.parsed;const vtxt = formatVersion(parsed, rel.name||rel.tag_name);const date = rel.published_at? (new Date(rel.published_at)).toLocaleString() : '';const div=document.createElement('div');div.className='upd-item';const left=document.createElement('div');const h=document.createElement('div');h.className='ver';h.textContent=vtxt;left.appendChild(h);const meta=document.createElement('div');meta.className='meta';meta.textContent=date;left.appendChild(meta);const right=document.createElement('div');if(item.exe && item.exe.browser_download_url){const b=document.createElement('button');b.className='btn ba act-btn';b.textContent='⬇ Download';b.onclick=()=>{window.UpdateChecker.downloadRelease(rel);};right.appendChild(b);}else{const b=document.createElement('button');b.className='btn bd act-btn';b.textContent='Open Release';b.onclick=()=>{ if(rel.html_url) window.open(rel.html_url,'_blank');};right.appendChild(b);}div.appendChild(left);div.appendChild(right);if(listEl) listEl.appendChild(div);});const ub=document.getElementById('update-badge'); if(ub) ub.style.display='';}).catch(err=>{resEl.textContent='Check failed';console.warn(err);}).finally(()=>{setUpdateBusy(false,'Search complete');searchBtn.disabled=false;searchBtn.textContent='🔎 SEARCH';});}

/* INIT */
let VERSION='';
try{const saved=localStorage.getItem('hs_state');if(saved)S=JSON.parse(saved);}catch(e){}
normalizeState();
try{const p=new URLSearchParams(location.search);VERSION=p.get('v')||'';const lv=document.getElementById('logo-ver');if(lv)lv.textContent=VERSION?'v'+VERSION:'';}catch(e){}

if(window.UpdateChecker&&window.UpdateChecker.getLocalVersion){window.UpdateChecker.getLocalVersion().then(t=>{const v=(t||'').trim();if(v){VERSION=v.replace(/^v/i,'');const lv=document.getElementById('logo-ver');if(lv)lv.textContent='v'+VERSION;}}).catch(()=>{});}

function initSportFromState(){const s=S.sport||'basketball';S.sport=s;const pi=document.getElementById('pill-icon'); if(pi) pi.textContent=SPORT_ICONS[s]||'🏀';const pn=document.getElementById('pill-name'); if(pn) pn.textContent=SPORT_NAMES[s]||'BASKETBALL';S.totalRounds = s==='football'?2:4;S.roundMinutes = S.roundMinutes|| (s==='basketball'?15:s==='football'?45:30);S.intermissionMinutes = S.intermissionMinutes||15;S.timerSeconds = S.timerSeconds||S.roundMinutes*60;S.intermissionSeconds = S.intermissionSeconds||S.intermissionMinutes*60;const sel=document.getElementById('sport-selector'); if(sel) sel.style.display='none';renderAll();}

if(S.sport) initSportFromState();

// Automatic update checks disabled — use the "Check For Updates" button
