/* ════════════════════════════════════════════════════
	 UTILITIES
════════════════════════════════════════════════════ */
const $=id=>document.getElementById(id);
const BODY=document.body;

/* ════════════════════════════════════════════════════
	 AUDIO — resolves assets/ next to this file
════════════════════════════════════════════════════ */
function assetPath(name){
	try{
		return new URL(`../../assets/${name}`, location.href).href;
	}catch(e){return 'assets/'+name;}
}
const SFX={countdown:assetPath('countdown.mp3'),matchstart:assetPath('matchstart.mp3'),foulOrRed:assetPath('foulOrRedCard.mp3'),matchend:assetPath('matchend.mp3')};
const SFX_PLAYERS={};
Object.keys(SFX).forEach(k=>{
	const a=new Audio(SFX[k]);
	a.preload='auto';
	SFX_PLAYERS[k]=a;
});
function playSound(key){
	try{
		const a=SFX_PLAYERS[key];
		if(!a)return;
		a.currentTime=0;
		a.volume=0.85;
		a.play().catch(()=>{});
	}catch(e){}
}

/* ════════════════════════════════════════════════════
	 COUNTDOWN
════════════════════════════════════════════════════ */
const cdOverlay=$('countdown-overlay'), cdDigit=$('countdown-digit');
function showCountdown(from,cb){
	let n=Math.max(1,Math.floor(from)||3);
	playSound('countdown');
	function tick(){
		cdDigit.textContent=n;
		cdDigit.style.animation='none';void cdDigit.offsetWidth;cdDigit.style.animation='';
		cdOverlay.classList.add('show');
		if(n>1){n--;setTimeout(tick,1000);} else {
			setTimeout(()=>{
				cdDigit.textContent='TIME TO GAME!';
				cdDigit.style.fontSize='clamp(4rem,9vw,7rem)';
				cdDigit.style.letterSpacing='0.08em';
				cdDigit.style.animation='none';void cdDigit.offsetWidth;cdDigit.style.animation='';
			},1000);
			setTimeout(()=>{
				cdOverlay.classList.remove('show');
				cdDigit.style.fontSize='';
				cdDigit.style.letterSpacing='';
				if(cb)cb();
			},1900);
		}
	}
	tick();
}

/* ════════════════════════════════════════════════════
	 STATE TRANSITIONS → SOUND
════════════════════════════════════════════════════ */
function handleTransitions(prev,curr){
	if(!prev||!curr)return;
	if(!prev.matchRunning&&curr.matchRunning&&!curr.intermissionRunning)
		showCountdown(3,()=>playSound('matchstart'));
	if(!prev.intermissionRunning&&curr.intermissionRunning)
		showCountdown(3,()=>{});
	if(prev.intermissionRunning&&!curr.intermissionRunning&&curr.matchRunning)
		showCountdown(3,()=>playSound('matchstart'));
	if(!prev.matchEnded&&curr.matchEnded) playSound('matchend');
	['teamA','teamB'].forEach(k=>{
		const pp=(prev[k]&&prev[k].players)||[];
		const cp=(curr[k]&&curr[k].players)||[];
		for(let i=0;i<Math.max(pp.length,cp.length);i++){
			if((cp[i]&&cp[i].fouls||0)>(pp[i]&&pp[i].fouls||0)){playSound('foulOrRed');break;}
		}
		const pr=(prev[k]&&prev[k].redCards)||0;
		const cr=(curr[k]&&curr[k].redCards)||0;
		if(cr>pr)playSound('foulOrRed');
		const ptf=(prev[k]&&prev[k].teamFouls)||0;
		const ctf=(curr[k]&&curr[k].teamFouls)||0;
		if(ctf>ptf)playSound('foulOrRed');
	});
}

/* ════════════════════════════════════════════════════
	 PARTICLES
════════════════════════════════════════════════════ */
(function(){
	const cv=$('bg'),ctx=cv.getContext('2d');let W,H;
	function rsz(){W=cv.width=innerWidth;H=cv.height=innerHeight;}
	rsz();addEventListener('resize',rsz);
	const P=[];
	function mk(){
		const s=Math.random()<0.5?'L':'R',c=Math.random()<0.1;
		let x,col;
		if(c){x=W/2+(Math.random()-.5)*180;col=[240,192,64];}
		else if(s==='L'){x=Math.random()*(W/2-80);col=[232,48,80];}
		else{x=W/2+80+Math.random()*(W/2-80);col=[48,144,248];}
		return{x,y:H+6,col,sz:Math.random()*1.3+0.2,vy:-(Math.random()*0.4+0.12),vx:(Math.random()-.5)*0.22,life:1,decay:Math.random()*0.003+0.001};
	}
	for(let i=0;i<65;i++){const p=mk();p.y=Math.random()*H;P.push(p);}
	(function frame(){
		if(document.hidden){requestAnimationFrame(frame);return;}
		ctx.clearRect(0,0,W,H);
		if(Math.random()<0.3)P.push(mk());
		while(P.length>100)P.shift();
		for(let i=P.length-1;i>=0;i--){
			const p=P[i];p.y+=p.vy;p.x+=p.vx;p.life-=p.decay;
			if(p.life<=0||p.y<-4){P.splice(i,1);continue;}
			ctx.beginPath();ctx.arc(p.x,p.y,p.sz,0,Math.PI*2);
			ctx.fillStyle=`rgba(${p.col[0]},${p.col[1]},${p.col[2]},${(p.life*0.13).toFixed(3)})`;
			ctx.fill();
		}
		requestAnimationFrame(frame);
	})();
})();

/* ════════════════════════════════════════════════════
	 TIMER RING UPDATE
════════════════════════════════════════════════════ */
const CIRC=263.9;
function updateRing(fillEl,liqEl,wrapEl,secs,maxSecs,warn){
	const ratio=maxSecs>0?Math.min(1,secs/maxSecs):0;
	let sc,lc;
	if(warn){sc='#e83050';lc='rgba(232,48,80,0.15)';}
	else if(ratio>0.5){sc='#38e888';lc='rgba(56,232,136,0.08)';}
	else if(ratio>0.2){sc='#f0c040';lc='rgba(240,192,64,0.08)';}
	else{sc='#e83050';lc='rgba(232,48,80,0.15)';}
	fillEl.style.stroke=sc;
	fillEl.setAttribute('stroke-dashoffset',String(CIRC*(1-ratio)));
	if(liqEl){liqEl.style.height=(ratio*100)+'%';liqEl.style.background=lc;}
	if(wrapEl)wrapEl.classList.toggle('warning',warn);
}

/* ════════════════════════════════════════════════════
	 SHOTCLOCK (15 s) — basketball only
════════════════════════════════════════════════════ */
const SC_MAX=15;
let scSecs=SC_MAX,scRunning=false,scInterval=null;
function startShotclock(){
	scSecs=SC_MAX;scRunning=true;
	clearInterval(scInterval);
	scInterval=setInterval(()=>{
		scSecs=Math.max(0,scSecs-1);
		renderShotclock();
		if(scSecs<=0){clearInterval(scInterval);scRunning=false;}
	},1000);
	renderShotclock();
}
function resetShotclock(){
	clearInterval(scInterval);scSecs=SC_MAX;scRunning=false;renderShotclock();
}
function renderShotclock(){
	const el=$('shotclock-digits'),fill=$('sc-fill');
	if(!el)return;
	el.textContent=String(scSecs).padStart(2,'0');
	const warn=scSecs<=5;
	el.className=warn?'warn':'';
	if(fill){
		fill.style.stroke=warn?'#e83050':getComputedStyle(BODY).getPropertyValue('--accent').trim()||'#ff7700';
		fill.setAttribute('stroke-dashoffset',String(CIRC*(1-scSecs/SC_MAX)));
	}
}

/* ════════════════════════════════════════════════════
	 SCORE FLASH
════════════════════════════════════════════════════ */
let prevA=-1,prevB=-1;
function triggerFlash(team,side){
	const f=$('score-flash'),ft=$('flash-text'),fs=$('flash-sub');
	ft.textContent=team.name||(side==='a'?'TEAM A':'TEAM B');
	ft.style.color=side==='a'?'var(--teamA)':'var(--teamB)';
	fs.textContent='HIGHSCORE';
	f.classList.remove('fire');void f.offsetWidth;f.classList.add('fire');
	BODY.classList.add('flash-glow');
	setTimeout(()=>BODY.classList.remove('flash-glow'),900);
	try{
		if(window.gsap){
			gsap.killTweensOf(f);
			gsap.fromTo(f, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.48, ease: 'power2.out' });
			gsap.to(f, { opacity: 0, delay: 1.1, duration: 0.6 });
		}
	}catch(e){}
	let sh=document.getElementById('score-sheen');
	if(!sh){sh=document.createElement('div');sh.id='score-sheen';sh.className='score-sheen';BODY.appendChild(sh);}
	sh.classList.remove('show');void sh.offsetWidth;sh.classList.add('show');
	sh.addEventListener('animationend',()=>sh.classList.remove('show'),{once:true});
}

/* ════════════════════════════════════════════════════
	 CACHED DOM
════════════════════════════════════════════════════ */
const elNameA=$('name-a'),elNameB=$('name-b');
const elScoreA=$('score-a'),elScoreB=$('score-b');
const elTimerDigits=$('timer-digits'),elStatusPill=$('status-pill');
const elRoundLbl=$('round-lbl'),elRoundNum=$('round-num'),elRoundOf=$('round-of');
const elIntOverlay=$('int-overlay'),elIntTimer=$('int-timer'),elIntNext=$('int-next');
const elBottomBar=$('bottom-bar'),elPlayersA=$('players-a'),elPlayersB=$('players-b');
const elSubA=$('sub-a'),elSubB=$('sub-b');
const elSportBadge=$('sport-badge'),elTexRect=$('tex-rect'),elWaitOverlay=$('wait-overlay');
const elCenterPanel=$('center-panel'),elBBspacer=$('bb-spacer');
let activeSport=null,timerMax=900;
let state=null,prevStateObj=null,_prevSer='';

/* ════════════════════════════════════════════════════
	 APPLY SPORT
════════════════════════════════════════════════════ */
function applySport(sport){
	activeSport=sport;
	BODY.className='sport-'+sport;
	if(elWaitOverlay)elWaitOverlay.style.display='none';
	if(window.gsap){
		gsap.fromTo('.team-block', {opacity:0,y:30}, {opacity:1,y:0,duration:.7,ease:'power3.out',stagger:.12});
		gsap.fromTo('.team-score', {scale:.7,opacity:0}, {scale:1,opacity:1,duration:.9,ease:'back.out(1.4)',stagger:.1,delay:.1});
	}
	const pats={basketball:'bball-pat',football:'foot-pat',handball:'hand-pat',volleyball:'voll-pat'};
	if(elTexRect)elTexRect.setAttribute('fill',`url(#${pats[sport]||'hand-pat'})`);
	const names={basketball:'BASKETBALL — HIGHSCORE',football:'FOOTBALL — HIGHSCORE',handball:'HANDBALL — HIGHSCORE',volleyball:'VOLLEYBALL — HIGHSCORE'};
	if(elSportBadge)elSportBadge.textContent=names[sport]||'HIGHSCORE';
	if(elRoundLbl&&elRoundNum&&elRoundOf){
		if(sport==='basketball'){
			elRoundLbl.textContent='QUARTER';elRoundLbl.style.display='';
			elRoundNum.style.display='';elRoundOf.textContent='OF 4';elRoundOf.style.display='';
		}else if(sport==='football'){
			elRoundLbl.textContent='HALF';elRoundLbl.style.display='';
			elRoundNum.style.display='';elRoundOf.textContent='OF 2';elRoundOf.style.display='';
		}else{
			elRoundLbl.style.display='none';elRoundNum.style.display='none';elRoundOf.style.display='none';
		}
	}
	if(elBottomBar){
		if(sport==='basketball') elBottomBar.className='show bball-layout';
		else if(sport==='handball'||sport==='volleyball') elBottomBar.className='show free-layout';
		else {elBottomBar.className='';elBottomBar.style.display='none';}
	}
	if(elCenterPanel){
		if(sport==='basketball'){
			const w=Math.min(320,Math.max(250,Math.floor(innerWidth*0.22)));
			elCenterPanel.style.width=w+'px'; if(elBBspacer)elBBspacer.style.width=w+'px';
		}else{elCenterPanel.style.width=''; if(elBBspacer)elBBspacer.style.width='';}
	}
}

/* ════════════════════════════════════════════════════
	 RENDER BILLBOARD
════════════════════════════════════════════════════ */
function renderBillboard(s){
	if(!s||!activeSport)return;

	// names
	if(elNameA)elNameA.textContent=s.teamA.name||'TEAM A';
	if(elNameB)elNameB.textContent=s.teamB.name||'TEAM B';

	// scores + bump
	if(elScoreA&&prevA!==-1&&s.teamA.score>prevA){
		elScoreA.classList.remove('bump');void elScoreA.offsetWidth;elScoreA.classList.add('bump');
		if(window.gsap){
			gsap.fromTo(elScoreA,{scale:0.88,filter:'brightness(3)'},{scale:1,filter:'brightness(1)',duration:.55,ease:'elastic.out(1.2,0.5)'});
		}
		triggerFlash(s.teamA,'a');
	}
	if(elScoreB&&prevB!==-1&&s.teamB.score>prevB){
		elScoreB.classList.remove('bump');void elScoreB.offsetWidth;elScoreB.classList.add('bump');
		if(window.gsap){
			gsap.fromTo(elScoreB,{scale:0.88,filter:'brightness(3)'},{scale:1,filter:'brightness(1)',duration:.55,ease:'elastic.out(1.2,0.5)'});
		}
		triggerFlash(s.teamB,'b');
	}
	if(elScoreA)elScoreA.textContent=s.teamA.score??0;
	if(elScoreB)elScoreB.textContent=s.teamB.score??0;
	prevA=s.teamA.score??0;prevB=s.teamB.score??0;

	// main timer
	const secs=s.timerSeconds??0;
	const m=Math.floor(secs/60),sc=secs%60;
	if(elTimerDigits)elTimerDigits.textContent=`${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`;
	const warn=secs<=60&&s.matchRunning;
	const max=s.roundMinutes?s.roundMinutes*60:timerMax;
	if(max>0)timerMax=max;
	updateRing($('t-fill'),$('timer-liquid'),$('timer-wrap'),secs,timerMax,warn);

	// status
	if(elStatusPill){
		if(s.intermissionRunning){elStatusPill.textContent='INTERMISSION';elStatusPill.className='intermission';}
		else if(s.matchRunning){elStatusPill.textContent='LIVE';elStatusPill.className='live';}
		else if(s.matchEnded){elStatusPill.textContent='FINAL';elStatusPill.className='ended';}
		else{elStatusPill.textContent='WAITING';elStatusPill.className='';}
	}

	// round
	if(elRoundNum)elRoundNum.textContent=s.round||1;

	// intermission overlay
	if(elIntOverlay){
		if(s.intermissionRunning){
			elIntOverlay.classList.add('show');
			const it=s.intermissionSeconds??0;
			if(elIntTimer)elIntTimer.textContent=`${String(Math.floor(it/60)).padStart(2,'0')}:${String(it%60).padStart(2,'0')}`;
			if(elIntNext)elIntNext.textContent=activeSport==='football'?'SECOND HALF STARTING SOON':`PERIOD ${(s.round||1)+1} STARTING SOON`;
		}else{
			elIntOverlay.classList.remove('show');
		}
	}

	// sport-specific rendering
	if(activeSport==='basketball') renderBball(s);
	else if(activeSport==='football') renderFootball(s);
	else if(activeSport==='handball'||activeSport==='volleyball') renderFreePlay(s);
}

/* ── BASKETBALL ── */
function renderBball(s){
	['a','b'].forEach(side=>{
		const team=side==='a'?s.teamA:s.teamB;
		const sub=side==='a'?elSubA:elSubB;
		const cont=side==='a'?elPlayersA:elPlayersB;
		const players=team.players||[];
		const tf=(typeof team.teamFouls==='number')? team.teamFouls : players.reduce((a,p)=>a+(p.fouls||0),0);
		if(sub){ sub.innerHTML=`<div class="tf-label">TEAM FOULS</div><div class="tf-count">${tf}</div>`; }
		if(cont){ cont.innerHTML=''; const frag=document.createDocumentFragment(); players.slice(0,20).forEach((p,i)=>{ const fouls=p.fouls||0,out=fouls>=5; const card=document.createElement('div'); card.className='player-card'+(out?' fouled-out':''); card.style.animationDelay=(i*0.03)+'s'; const nm=document.createElement('div');nm.className='p-name';nm.textContent=p.name||`P${i+1}`; const fd=document.createElement('div');fd.className='p-fouls'; for(let d=1;d<=5;d++){ const dot=document.createElement('div'); dot.className='foul-dot'+(d<=fouls?(d===5?' fifth':' active'):'' ); fd.appendChild(dot);} card.appendChild(nm);card.appendChild(fd); if(out){const ol=document.createElement('div');ol.className='fo-label';ol.textContent='OUT';card.appendChild(ol);} frag.appendChild(card); }); cont.appendChild(frag); }
	});
}

/* ── FOOTBALL ── */
function renderFootball(s){
	['a','b'].forEach(side=>{
		const team=side==='a'?s.teamA:s.teamB;
		const sub=side==='a'?elSubA:elSubB;
		if(!sub)return;
		const reds=Math.max(0,team.redCards||0);
		let html='<div class="cards-row">';
		if(reds>0){ for(let r=0;r<reds;r++)html+='<div class="card-icon red"></div>'; } else { html+='<span class="no-cards-lbl">NO CARDS</span>'; }
		html+='</div>';
		sub.innerHTML=html;
	});
	if(elPlayersA)elPlayersA.innerHTML='';
	if(elPlayersB)elPlayersB.innerHTML='';
}

function renderFreePlay(s){
	if(elSubA)elSubA.innerHTML=''; if(elSubB)elSubB.innerHTML='';
	['a','b'].forEach(side=>{ const team=side==='a'?s.teamA:s.teamB; const cont=side==='a'?elPlayersA:elPlayersB; if(!cont)return; cont.innerHTML=''; const players=team.players||[]; const frag=document.createDocumentFragment(); players.forEach((p,i)=>{ const el=document.createElement('div'); el.className='p-name-only'; el.style.animationDelay=(i*0.03)+'s'; el.textContent=p.name||`P${i+1}`; frag.appendChild(el); }); cont.appendChild(frag); });
}

/* ════════════════════════════════════════════════════
	 POLL / STORAGE SYNC
════════════════════════════════════════════════════ */
function loadStateRaw(){try{return localStorage.getItem('hs_state')||'';}catch(e){return ''}}
function applyStateRaw(raw){
	if(raw===_prevSer)return;
	let ns=null;
	if(raw){ try{ns=JSON.parse(raw);}catch(e){return;} }
	try{handleTransitions(prevStateObj,ns);}catch(e){}
	_prevSer=raw; prevStateObj=ns?JSON.parse(JSON.stringify(ns)):null; state=ns;
	if(state){ if(state.sport&&state.sport!==activeSport)applySport(state.sport); if(activeSport)renderBillboard(state); }
}

window.addEventListener('storage',e=>{ if(e.key!=='hs_state')return; applyStateRaw(e.newValue||''); });
window.addEventListener('message', e => { try{ if(e && e.data && e.data.type === 'hs_state_update'){ applyStateRaw(e.data.data || ''); } }catch(err){} });
applyStateRaw(loadStateRaw());
(function(){try{const v=new URLSearchParams(location.search).get('v');if(v)$('fl-ver').textContent='v'+v;}catch(e){} })();


