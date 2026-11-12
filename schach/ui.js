/* Schach – game flow, board, clocks, computer, tips, analysis and online play. */
'use strict';
const $=id=>document.getElementById(id);
const HUB_URL=/github\.io$/.test(location.hostname)?'../':'https://thisksad.github.io/Game-Hub/';
const LS={get(k,d){try{const v=JSON.parse(localStorage.getItem(k));return v??d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const START='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FILES='abcdefgh';
const other=c=>c==='w'?'b':'w';

/* ---------- language ---------- */
function detectLang(){
  const s=LS.get('scopa-settings',{}); if(LANGS[s.lang]) return s.lang;
  const n=(navigator.language||'de').toLowerCase();
  return n.startsWith('pt')?'pt':n.startsWith('en')?'en':n.startsWith('de')?'de':'en';
}
let LANG=detectLang();
function T(k,v){ let s=I18N[LANG][k]; if(s==null) s=I18N.de[k]; if(typeof s==='string'&&v) s=s.replace(/\{(\w+)\}/g,(_,x)=>v[x]??''); return s; }
function setLang(l){ LANG=l; const s=LS.get('scopa-settings',{}); s.lang=l; LS.set('scopa-settings',s); document.documentElement.lang=l==='pt'?'pt-BR':l; }
const FIG={k:'♔',q:'♕',r:'♖',b:'♗',n:'♘'};
const fig=san=>String(san||'').replace(/^([KQRBN])/,(_,c)=>FIG[c.toLowerCase()]).replace(/=([QRBN])/,(_,c)=>'='+FIG[c.toLowerCase()]);
const dec=x=>LANG==='en'?String(x):String(x).replace('.',',');

/* ---------- settings ---------- */
const TCS=[null,{m:3,i:2},{m:5,i:3},{m:10,i:0},{m:10,i:5},{m:15,i:10},{m:30,i:0}];
let SET=Object.assign({mode:'computer',level:2,color:'w',tc:-1,custom:{m:15,i:10},tips:false,autoFlip:false,name:'',ocolor:'r',otc:5},LS.get('schach-settings',{}));
const saveSet=()=>LS.set('schach-settings',SET);
function tcFrom(idx,custom){ if(idx===-1||idx==null) return null; if(idx==='c') return custom.m>0?{base:custom.m*60000,inc:custom.i*1000}:null; const t=TCS[idx]; return t?{base:t.m*60000,inc:t.i*1000}:null; }
const tcLabel=tc=>tc?(tc.base/60000)+'+'+(tc.inc/1000):'';

/* ---------- sound ---------- */
let sound=LS.get('schach-sound',true), actx=null;
function tone(f,d,v,type='triangle'){
  if(!sound) return;
  try{ actx=actx||new (window.AudioContext||window.webkitAudioContext)(); if(actx.state==='suspended') actx.resume();
    const o=actx.createOscillator(), g=actx.createGain(); o.type=type; o.frequency.value=f;
    g.gain.setValueAtTime(v,actx.currentTime); g.gain.exponentialRampToValueAtTime(.0001,actx.currentTime+d);
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime+d+.02);
  }catch(e){}
}
function sfx(m){ if(!m) return; if(m.captured) { tone(180,.12,.35,'square'); tone(120,.09,.2); } else tone(420,.07,.25); }
function sfxEnd(){ tone(523,.15,.2); setTimeout(()=>tone(659,.15,.2),140); setTimeout(()=>tone(784,.3,.2),280); }

/* ---------- state ---------- */
let G=null;      // current game
const UI={view:'game', flip:false, sel:null, hint:null, hintBusy:false, hintSan:null, warn:null, thinking:false, token:0, promo:null, aIdx:0, anBusy:false, anProg:0, overShown:false, toastT:null};
let ON=null;     // online session

function newLocalGame(mode){
  const myColor=mode==='computer'?(SET.color==='r'?(Math.random()<.5?'w':'b'):SET.color):null;
  const tc=tcFrom(SET.tc,SET.custom);
  G={mode, chess:new Chess(), myColor, level:SET.level, tips:mode==='computer'&&SET.tips, autoFlip:mode==='local'&&SET.autoFlip,
     tc, clock:tc?{w:tc.base,b:tc.base,last:null}:null, result:null, analysis:null};
  G.names=mode==='computer'
    ?{[myColor]:T('you'),[other(myColor)]:T('computer')+' · '+(T('levelNames')[SET.level-1])}
    :{w:T('whitePl'),b:T('blackPl')};
  UI.flip=false; UI.view='game'; UI.overShown=false; resetTransient();
  save(); render();
  maybeComputer();
}
function resetTransient(){ UI.sel=null; UI.hint=null; UI.hintSan=null; UI.warn=null; UI.promo=null; UI.thinking=false; UI.token++; }
function save(){
  if(!G||G.mode==='online') return;
  LS.set('schach-game',{mode:G.mode, moves:G.chess.history({verbose:true}).map(m=>m.from+m.to+(m.promotion||'')), myColor:G.myColor, level:G.level, tips:G.tips,
    autoFlip:G.autoFlip, tc:G.tc, clock:G.clock?{w:G.clock.w,b:G.clock.b}:null, result:G.result, names:G.names, analysis:G.analysis, flip:UI.flip, overShown:UI.overShown});
}
function restore(){
  const s=LS.get('schach-game',null); if(!s||!s.mode||s.mode==='online') return false;
  const c=new Chess(); for(const u of s.moves||[]) if(!c.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]||'q'})) break;
  G={mode:s.mode, chess:c, myColor:s.myColor, level:s.level||2, tips:!!s.tips, autoFlip:!!s.autoFlip, tc:s.tc||null,
     clock:s.tc&&s.clock?{w:s.clock.w,b:s.clock.b,last:c.history().length?performance.now():null}:null, result:s.result||null, names:s.names||{w:T('whitePl'),b:T('blackPl')}, analysis:s.analysis||null};
  UI.flip=!!s.flip; UI.overShown=!!s.overShown;
  return true;
}

/* ---------- helpers ---------- */
const turn=()=>G.chess.turn();
const hist=()=>G.chess.history({verbose:true});
function bottomColor(){
  let b='w';
  if(G.mode==='computer'||G.mode==='online') b=G.myColor||'w';
  else if(G.autoFlip) b=turn();
  return UI.flip?other(b):b;
}
function humanToMove(){
  if(!G||G.result||UI.view!=='game'||UI.thinking||UI.warn||UI.promo) return false;
  if(G.mode==='computer') return turn()===G.myColor;
  if(G.mode==='online') return ON&&ON.st&&ON.st.status==='play'&&turn()===G.myColor;
  return true;
}
function kingSq(c,color){ let s=null; c.board().forEach((r,ri)=>r.forEach((p,fi)=>{ if(p&&p.type==='k'&&p.color===color) s=FILES[fi]+(8-ri); })); return s; }
function canMate(c,color){ let minors=0,oth=0; c.board().forEach(r=>r.forEach(p=>{ if(!p||p.color!==color||p.type==='k') return; if(p.type==='n'||p.type==='b') minors++; else oth++; })); return oth>0||minors>=2; }
function checkEnd(){
  const c=G.chess; if(!c.game_over()) return;
  const mover=other(c.turn());
  if(c.in_checkmate()) G.result={winner:mover,reason:'mate'};
  else if(c.in_stalemate()) G.result={winner:null,reason:'stalemate'};
  else if(c.insufficient_material()) G.result={winner:null,reason:'material'};
  else if(c.in_threefold_repetition()) G.result={winner:null,reason:'repetition'};
  else G.result={winner:null,reason:'fifty'};
}
function toast(text){ document.querySelectorAll('.toast').forEach(x=>x.remove()); const el=document.createElement('div'); el.className='toast'; el.setAttribute('role','status'); el.textContent=text; document.body.appendChild(el); setTimeout(()=>el.remove(),3800); }

/* ---------- moves ---------- */
function legalTargets(sq){ return G.chess.moves({square:sq,verbose:true}); }
function needsPromo(from,to){ return legalTargets(from).some(m=>m.to===to&&m.promotion); }
function tryMove(from,to,promo,force){
  if(!humanToMove()) return;
  const ms=legalTargets(from).filter(m=>m.to===to); if(!ms.length){ UI.sel=null; render(); return; }
  if(ms[0].promotion&&!promo){ UI.promo={from,to}; UI.sel=null; render(); return; }
  const uci=from+to+(promo||'');
  if(G.tips&&G.mode==='computer'&&!force){
    const w=ENG.moveWarning(G.chess.fen(),uci);
    if(w){ UI.warn={uci,w,from,to,promo}; UI.sel=null; render(); return; }
  }
  if(G.mode==='online'){ onlineMove(uci); return; }
  doMove(uci);
}
function doMove(uci){
  const now=performance.now(), mover=turn();
  const m=G.chess.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||'q'}); if(!m) return false;
  if(G.clock){
    if(G.clock.last!=null){ G.clock[mover]-=now-G.clock.last; G.clock[mover]+=G.tc.inc; }
    G.clock.last=now;    // the opponent's clock starts once White has made the first move
  }
  UI.sel=null; UI.hint=null; UI.hintSan=null; UI.warn=null; UI.promo=null; G.analysis=null;
  checkEnd();
  save(); render({anim:UI.noAnim?null:m}); sfx(m);
  if(G.result) onGameOver();
  else maybeComputer();
  return true;
}
async function maybeComputer(){
  if(!G||G.mode!=='computer'||G.result||turn()===G.myColor) return;
  const tok=++UI.token; UI.thinking=true; render();
  const t0=performance.now(), fen=G.chess.fen();
  let uci=null;
  try{ uci=await ENG.computerMove(fen,G.level); }catch(e){ const ms=new Chess(fen).moves({verbose:true}); const m=ms[Math.floor(Math.random()*ms.length)]; uci=m&&m.from+m.to+(m.promotion||''); }
  const wait=Math.max(0,(G.level<=3?650:350)-(performance.now()-t0));
  if(wait) await new Promise(r=>setTimeout(r,wait));
  if(tok!==UI.token||!G||G.result||G.chess.fen()!==fen) return;
  UI.thinking=false;
  if(uci) doMove(uci); else render();
}
function undo(){
  if(!G||G.mode==='online') return;
  UI.token++; ENG.stop(); UI.thinking=false;
  const c=G.chess; if(!c.history().length) return;
  if(G.mode==='computer'){
    if(turn()===G.myColor||G.result){ c.undo(); if(c.history().length&&turn()!==G.myColor) c.undo(); }
    else c.undo();
  } else c.undo();
  G.result=null; G.analysis=null; UI.overShown=false; resetTransient();
  if(G.clock) G.clock.last=c.history().length?performance.now():null;
  save(); render(); maybeComputer();
}
async function hint(){
  if(!G||!G.tips||UI.hintBusy||!humanToMove()) return;
  UI.hintBusy=true; UI.hintSan=null; render();
  const fen=G.chess.fen();
  try{
    const r=await ENG.search(fen,{skill:20,ms:900});
    if(G.chess.fen()===fen&&r.best){ UI.hint=r.best; const c=new Chess(fen); const m=c.move({from:r.best.slice(0,2),to:r.best.slice(2,4),promotion:r.best[4]||'q'}); UI.hintSan=m?fig(m.san):r.best; }
  }catch(e){}
  UI.hintBusy=false; render();
}
function resign(){
  confirmBox(T('resignQ'),T('resignYes'),()=>{
    if(G.mode==='online'){ api('resign').catch(e=>toast(e.message)); return; }
    const loser=G.mode==='computer'?G.myColor:turn();
    G.result={winner:other(loser),reason:'resign'}; UI.token++; UI.thinking=false; save(); render(); onGameOver();
  });
}
function offerDraw(){
  if(G.mode==='online'){ api('draw',{op:'offer'}).then(()=>toast(T('drawSent'))).catch(e=>toast(e.message)); return; }
  confirmBox(T('draw')+'?',T('accept'),()=>{ G.result={winner:null,reason:'agreed'}; save(); render(); onGameOver(); });
}

/* ---------- clocks ---------- */
function liveClock(color){
  if(G.mode==='online'){
    const st=ON&&ON.st; if(!st||!st.clock) return null;
    let v=st.clock[color];
    if(st.status==='play'&&st.clock.since&&turn()===color) v-=(Date.now()-ON.offset)-st.clock.since;
    return v;
  }
  if(!G.clock) return null;
  let v=G.clock[color];
  if(!G.result&&G.clock.last!=null&&turn()===color&&UI.view==='game') v-=performance.now()-G.clock.last;
  return v;
}
function fmtClock(ms){
  ms=Math.max(0,ms);
  if(ms<10000) return (ms/1000).toFixed(1).replace('.',LANG==='en'?'.':',');
  const s=Math.ceil(ms/1000), h=Math.floor(s/3600), m=Math.floor(s%3600/60), x=s%60;
  return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0');
}
function tick(){
  if(G&&UI.view==='game'){
    for(const c of ['w','b']){
      const el=document.querySelector('.clock[data-c="'+c+'"]'); if(!el) continue;
      const v=liveClock(c); if(v==null) continue;
      el.textContent=fmtClock(v);
      const on=!G.result&&turn()===c&&(G.mode==='online'?ON&&ON.st&&ON.st.status==='play':true);
      el.classList.toggle('on',on); el.classList.toggle('low',v<20000);
      el.classList.toggle('out',v<=0);
      if(v<=0&&!G.result){
        if(G.mode==='online'){ if(ON&&ON.flagSent!==ON.version){ ON.flagSent=ON.version; api('flag').catch(()=>{}); } }
        else if(turn()===c){
          G.clock[c]=0; UI.token++; UI.thinking=false;
          G.result={winner:canMate(G.chess,other(c))?other(c):null,reason:'time'};
          save(); render(); onGameOver();
        }
      }
    }
  }
  requestAnimationFrame(tick);
}

/* ---------- board rendering ---------- */
function sqXY(sq,bottom){ const f=FILES.indexOf(sq[0]), r=+sq[1]-1; return bottom==='w'?{x:f,y:7-r}:{x:7-f,y:r}; }
function xySq(x,y,bottom){ return bottom==='w'?FILES[x]+(8-y):FILES[7-x]+(y+1); }
const BADGE={bad:['??','var(--bad)'],err:['?','var(--err)'],inac:['?!','var(--inac)'],best:['★','var(--best)'],good:['!','var(--good)']};
function drawBoard(el,fen,o){
  const bottom=o.bottom, c=new Chess(fen);
  let sq='';
  for(let y=0;y<8;y++) for(let x=0;x<8;x++){
    const s=xySq(x,y,bottom), light=(FILES.indexOf(s[0])+ +s[1])%2===1;
    const cls=['sq',light?'l':'d'];
    if(o.last&&(o.last.from===s||o.last.to===s)) cls.push('last');
    if(o.sel===s) cls.push('sel');
    if(o.check===s) cls.push('chk');
    if(o.hang&&o.hang.includes(s)) cls.push('hang');
    let inner='';
    if(y===7) inner+=`<span class="co f">${s[0]}</span>`;
    if(x===0) inner+=`<span class="co r">${s[1]}</span>`;
    if(o.targets&&o.targets[s]!=null) inner+=o.targets[s]?'<span class="ring"></span>':'<span class="dot"></span>';
    sq+=`<div class="${cls.join(' ')}" data-sq="${s}">${inner}</div>`;
  }
  let pcs='';
  c.board().forEach((row,ri)=>row.forEach((p,fi)=>{
    if(!p) return; const s=FILES[fi]+(8-ri), {x,y}=sqXY(s,bottom);
    pcs+=`<div class="pc ${p.color}${p.type}" data-sq="${s}" style="left:${x*12.5}%;top:${y*12.5}%"></div>`;
  }));
  let arrows='';
  for(const a of o.arrows||[]){
    const A=sqXY(a.from,bottom), B=sqXY(a.to,bottom);
    const x1=A.x+.5,y1=A.y+.5,x2=B.x+.5,y2=B.y+.5, dx=x2-x1, dy=y2-y1, len=Math.hypot(dx,dy), ux=dx/len, uy=dy/len;
    const ex=x2-ux*.28, ey=y2-uy*.28;
    arrows+=`<line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}" stroke="${a.color}" stroke-width=".17" stroke-linecap="round" opacity=".85"/>`+
      `<polygon points="${x2},${y2} ${ex-uy*.26},${ey+ux*.26} ${ex+uy*.26},${ey-ux*.26}" fill="${a.color}" opacity=".85"/>`;
  }
  let badge='';
  if(o.badge&&BADGE[o.badge.k]){ const {x,y}=sqXY(o.badge.sq,bottom); const [t,col]=BADGE[o.badge.k];
    badge=`<div class="badge" style="left:${(x+1)*12.5}%;top:${y*12.5}%;transform:translate(-75%,-25%);background:${col}">${t}</div>`; }
  el.innerHTML=`<div class="sqs">${sq}</div><div class="pcs">${pcs}</div><svg class="arrows" viewBox="0 0 8 8">${arrows}</svg>${badge}`;
  if(o.anim) animate(el,o.anim,bottom);
}
function animate(el,m,bottom){
  const go=(from,to)=>{
    const p=el.querySelector('.pc[data-sq="'+to+'"]'); if(!p) return;
    const A=sqXY(from,bottom), B=sqXY(to,bottom);
    p.style.transform=`translate(${(A.x-B.x)*100}%,${(A.y-B.y)*100}%)`;
    p.getBoundingClientRect();
    p.classList.add('anim'); p.style.transform='';
    setTimeout(()=>p.classList.remove('anim'),220);
  };
  go(m.from,m.to);
  if(m.flags&&m.flags.includes('k')) go('h'+m.from[1],'f'+m.from[1]);
  if(m.flags&&m.flags.includes('q')) go('a'+m.from[1],'d'+m.from[1]);
}

/* ---------- player bars ---------- */
const PVAL={p:1,n:3,b:3,r:5,q:9};
function material(c){
  const have={w:{p:0,n:0,b:0,r:0,q:0},b:{p:0,n:0,b:0,r:0,q:0}};
  c.board().forEach(r=>r.forEach(p=>{ if(p&&p.type!=='k') have[p.color][p.type]++; }));
  const full={p:8,n:2,b:2,r:2,q:1};
  const caps={w:'',b:''}, pts={w:0,b:0};
  for(const col of ['w','b']) for(const t of ['q','r','b','n','p']){
    const lost=Math.max(0,full[t]-have[other(col)][t]);  // pieces of the other side that col has taken
    caps[col]+=('♟♞♝♜♛'['pnbrq'.indexOf(t)]).repeat(lost);
    pts[col]+=have[col][t]*PVAL[t];
  }
  return {caps,diff:pts.w-pts.b};
}
function pbar(el,color){
  const mat=material(G.chess), d=color==='w'?mat.diff:-mat.diff;
  const nm=G.names?G.names[color]:'';
  const hasClock=G.mode==='online'?!!(ON&&ON.st&&ON.st.clock):!!G.clock;
  el.innerHTML=`<div class="av ${color} pc ${color}k" style="position:relative;width:34px;height:34px;background-size:80%"></div>
    <div class="who"><div class="nm">${esc(nm)}</div><div class="cap">${mat.caps[color]}${d>0?'<b>+'+d+'</b>':''}</div></div>
    <div class="clock" data-c="${color}" ${hasClock?'':'hidden'}></div>`;
}

/* ---------- render ---------- */
function render(o={}){
  if(!G) return;
  document.title=T('title'); $('brand').textContent=T('title');
  $('exitBtn').href=HUB_URL; $('exitBtn').title=T('exit'); $('exitBtn').setAttribute('aria-label',T('exit'));
  $('menuBtn').title=T('menu'); $('menuBtn').setAttribute('aria-label',T('menu'));
  $('soundBtn').innerHTML=sound?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
  document.body.classList.toggle('analysis',UI.view==='analysis');
  if(UI.view==='analysis'){ renderAnalysis(); return; }
  const bottom=bottomColor(), c=G.chess, h=hist(), last=h[h.length-1];
  const targets={};
  if(UI.sel) legalTargets(UI.sel).forEach(m=>{ targets[m.to]=!!m.captured||m.flags.includes('e'); });
  const arrows=[];
  if(UI.hint) arrows.push({from:UI.hint.slice(0,2),to:UI.hint.slice(2,4),color:'#3f8f5a'});
  if(UI.warn&&UI.warn.w.kind==='mate') arrows.push({from:UI.warn.w.from,to:UI.warn.w.to,color:'#c0392b'});
  let hang=null;
  if(G.tips&&G.mode==='computer'&&!G.result&&turn()===G.myColor&&!UI.thinking) hang=ENG.hanging(c.fen(),G.myColor).map(x=>x.sq);
  if(UI.warn&&UI.warn.w.kind==='hang') hang=[UI.warn.from];
  drawBoard($('board'),c.fen(),{bottom,last,sel:UI.sel,targets,check:c.in_check()?kingSq(c,turn()):null,arrows,hang,anim:o.anim});
  $('evalbar').hidden=true;
  pbar($('pTop'),other(bottom)); pbar($('pBot'),bottom);
  if(UI.promo) drawPromo();
  renderSide(hang);
}
function drawPromo(){
  const col=turn(), box=document.createElement('div'); box.className='promo';
  box.innerHTML=`<div class="box"><b>${T('promote')}</b><div class="row">${['q','r','b','n'].map(p=>`<button type="button" data-p="${p}" aria-label="${T('pieceNom')[p]}"><span class="pc ${col}${p}"></span></button>`).join('')}</div></div>`;
  box.addEventListener('pointerdown',e=>e.stopPropagation());
  box.addEventListener('click',e=>{ const b=e.target.closest('button'); const pr=UI.promo; UI.promo=null;
    if(!b){ render(); return; } tryMove(pr.from,pr.to,b.dataset.p); });
  $('board').appendChild(box);
}
function statusHTML(hang){
  const c=G.chess;
  if(UI.warn){
    const w=UI.warn.w;
    const msg=w.kind==='mate'?T('warnMate',{san:fig(w.san)}):T('warnHang',{piece:T('pieceNames')[w.type],sq:w.sq});
    return {cls:'warn',html:`<div class="msg">${esc(msg)}</div><div class="acts"><button class="btn sm primary" id="warnOther">${T('warnOther')}</button><button class="btn sm" id="warnAny">${T('warnAnyway')}</button></div>`};
  }
  if(G.result) return {html:`<div class="msg">${esc(resultText())}</div><div class="acts"><button class="btn sm primary" data-act="analyse">${T('analyse')}</button><button class="btn sm" data-act="again">${G.mode==='online'?T('rematch'):T('again')}</button></div>`};
  if(G.mode==='online'&&ON&&ON.st){
    const st=ON.st;
    if(st.drawOffer&&st.drawOffer!==G.myColor) return {html:`<div class="msg">${esc(T('drawOffered',{name:G.names[st.drawOffer]}))}</div><div class="acts"><button class="btn sm primary" data-act="drawYes">${T('accept')}</button><button class="btn sm" data-act="drawNo">${T('decline')}</button></div>`};
  }
  const parts=[];
  if(UI.hintBusy) parts.push(T('hintThinking'));
  else if(UI.hintSan) parts.push(T('hintIs',{san:UI.hintSan}));
  else if(UI.thinking) parts.push(T('thinking'));
  else{
    const me=G.mode==='local'?true:turn()===G.myColor;
    parts.push((c.in_check()?T('check')+' ':'')+(G.mode==='local'?T('turnOf',{name:G.names[turn()]}):me?T('yourTurn'):T('turnOf',{name:G.names[turn()]})));
  }
  let extra='';
  if(hang&&hang.length&&!UI.hintSan){
    const pc=G.chess;
    extra=`<div class="small" style="color:#f2a49b">${esc(T('hangingNow',{list:hang.map(s=>T('pieceNom')[pc.get(s).type]+' '+s).join(', ')}))}</div>`;
  }
  return {html:`<div class="msg">${esc(parts.join(' '))}</div>${extra}`};
}
function resultText(){
  const r=G.result; if(!r) return '';
  const reason=T({mate:'rMate',resign:'rResign',time:'rTime',stalemate:'rStalemate',repetition:'rRepetition',material:'rMaterial',fifty:'rFifty',agreed:'rAgreed',abandon:'rAbandon'}[r.reason]);
  let head;
  if(!r.winner) head=T('drawRes');
  else if(G.mode==='computer'||G.mode==='online') head=r.winner===G.myColor?T('youWin'):T('youLose');
  else head=r.winner==='w'?T('winW'):T('winB');
  return head+' '+reason;
}
const ICON={
  undo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  hint:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>',
  flip:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16M7 20l-3-3M7 20l3-3"/><path d="M17 20V4M17 4l-3 3M17 4l3 3"/></svg>',
  flag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>',
  draw:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 9h14M5 15h14"/></svg>',
  first:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 5v14M18 6l-7 6 7 6"/></svg>',
  prev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  next:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  lastI:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 5v14M6 6l7 6-7 6"/></svg>'
};
function moveListHTML(cur,cls){
  const h=hist(); let out='<div class="mvgrid">';
  for(let i=0;i<h.length;i+=2){
    out+=`<div class="n">${i/2+1}.</div>`;
    for(const j of [i,i+1]){
      if(j>=h.length){ out+='<div></div>'; continue; }
      const k=cls&&cls[j], tag=k&&BADGE[k]&&k!=='best'?`<i style="background:${BADGE[k][1]}">${BADGE[k][0]}</i>`:'';
      out+=`<button class="mv ${cur===j+1?'cur':''}" data-k="${j+1}" type="button">${esc(fig(h[j].san))}${tag}</button>`;
    }
  }
  return out+'</div>';
}
function renderSide(hang){
  const s=statusHTML(hang), c=G.chess, n=c.history().length;
  const showHint=G.tips&&G.mode==='computer'&&!G.result;
  const btns=[];
  if(G.mode!=='online') btns.push(`<button class="btn" id="undoBtn" ${n&&!UI.warn?'':'disabled'}>${ICON.undo}${T('undo')}</button>`);
  if(showHint) btns.push(`<button class="btn" id="hintBtn" ${humanToMove()&&!UI.hintBusy?'':'disabled'}>${ICON.hint}${T('hint')}</button>`);
  btns.push(`<button class="btn" id="flipBtn">${ICON.flip}${T('flip')}</button>`);
  if(!G.result&&G.mode!=='computer') btns.push(`<button class="btn" id="drawBtn" ${n?'':'disabled'}>${ICON.draw}${T('draw')}</button>`);
  if(!G.result) btns.push(`<button class="btn" id="resignBtn" ${n||G.mode!=='online'?'':'disabled'}>${ICON.flag}${T('resign')}</button>`);
  $('side').innerHTML=`<div class="status ${s.cls||''}" role="status" aria-live="polite">${s.html}</div>
    <div class="controls">${btns.join('')}</div>
    <div class="moves" id="moves">${n?moveListHTML(n):`<span class="small muted">${T('moves')} …</span>`}</div>`;
  const mv=$('moves'); mv.scrollTop=mv.scrollHeight;
  const on=(id,f)=>{ const e=$(id); if(e) e.onclick=f; };
  on('undoBtn',undo); on('hintBtn',hint); on('flipBtn',()=>{ UI.flip=!UI.flip; save(); render(); });
  on('drawBtn',offerDraw); on('resignBtn',resign);
  on('warnOther',()=>{ UI.warn=null; render(); });
  on('warnAny',()=>{ const w=UI.warn; UI.warn=null; tryMove(w.from,w.to,w.promo,true); });
  $('side').querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>act(b.dataset.act));
}
function act(a){
  if(a==='analyse') openAnalysis();
  else if(a==='again'){ if(G.mode==='online') api('rematch').catch(e=>toast(e.message)); else newLocalGame(G.mode); }
  else if(a==='drawYes') api('draw',{op:'accept'}).catch(e=>toast(e.message));
  else if(a==='drawNo') api('draw',{op:'decline'}).catch(e=>toast(e.message));
}

/* ---------- board input: tap or drag ---------- */
let drag=null;
function boardSq(e){
  const r=$('board').getBoundingClientRect(); const x=Math.floor((e.clientX-r.left)/r.width*8), y=Math.floor((e.clientY-r.top)/r.height*8);
  if(x<0||x>7||y<0||y>7) return null; return xySq(x,y,bottomColor());
}
function mine(sq){ const p=G.chess.get(sq); return p&&p.color===turn(); }
$('board').addEventListener('pointerdown',e=>{
  if(!G||UI.view!=='game'||!humanToMove()) return;
  const sq=boardSq(e); if(!sq) return;
  e.preventDefault();
  if(UI.sel&&UI.sel!==sq&&legalTargets(UI.sel).some(m=>m.to===sq)){ tryMove(UI.sel,sq); return; }
  if(mine(sq)){
    const wasSel=UI.sel===sq;
    UI.sel=sq; UI.hint=null; UI.hintSan=null; render();
    const el=$('board').querySelector('.pc[data-sq="'+sq+'"]'); if(!el) return;
    const r=$('board').getBoundingClientRect();
    drag={sq,el,x0:e.clientX,y0:e.clientY,moved:false,wasSel,size:r.width/8};
    try{ $('board').setPointerCapture(e.pointerId); }catch(_){}
  } else { UI.sel=null; render(); }
});
$('board').addEventListener('pointermove',e=>{
  if(!drag) return;
  const dx=e.clientX-drag.x0, dy=e.clientY-drag.y0;
  if(!drag.moved&&Math.hypot(dx,dy)<6) return;
  drag.moved=true; drag.el.classList.add('drag');
  drag.el.style.transform=`translate(${dx}px,${dy}px) scale(1.08)`;
});
function endDrag(e){
  if(!drag) return; const d=drag; drag=null;
  if(!d.moved){ if(d.wasSel){ UI.sel=null; render(); } return; }
  const sq=boardSq(e);
  if(sq&&sq!==d.sq&&legalTargets(d.sq).some(m=>m.to===sq)){ d.el.remove(); UI.noAnim=true; tryMove(d.sq,sq); UI.noAnim=false; if(!UI.promo&&!UI.warn) return; render(); }
  else { d.el.classList.remove('drag'); d.el.style.transform=''; }
}
$('board').addEventListener('pointerup',endDrag);
$('board').addEventListener('pointercancel',()=>{ if(drag){ drag.el.classList.remove('drag'); drag.el.style.transform=''; drag=null; } });

/* ---------- game over ---------- */
function onGameOver(){
  if(UI.overShown) return; UI.overShown=true; save();
  sfxEnd();
  setTimeout(()=>{
    if(!G||!G.result||UI.view!=='game') return;
    const again=G.mode==='online'?T('rematch'):T('again');
    showOverlay(`<div class="sheet" role="dialog" aria-modal="true"><p class="result-title">${esc(T('over'))}</p><p style="text-align:center">${esc(resultText())}</p>
      <div class="actions"><button class="btn" data-x="close">${T('close')}</button><button class="btn" data-x="again">${again}</button><button class="btn primary" data-x="analyse">${T('analyse')}</button></div></div>`,
      x=>{ closeOverlay(); if(x==='again') act('again'); else if(x==='analyse') openAnalysis(); });
  },650);
}

/* ---------- overlays ---------- */
function showOverlay(html,onClick,sticky){
  const o=$('overlay'); o.innerHTML=`<div class="overlay">${html}</div>`;
  const ov=o.firstChild;
  ov.addEventListener('click',e=>{ if(e.target===ov){ if(!sticky) closeOverlay(); return; } const b=e.target.closest('[data-x]'); if(b&&onClick) onClick(b.dataset.x,b); });
  const sh=ov.querySelector('.sheet'); if(sh) sh.scrollTop=0;
  const f=ov.querySelector('.btn.primary,.btn'); if(f) f.focus({preventScroll:true});
}
function closeOverlay(){ $('overlay').innerHTML=''; }
function confirmBox(text,yes,fn){
  showOverlay(`<div class="sheet" role="alertdialog" aria-modal="true"><p style="font-size:18px;font-weight:700">${esc(text)}</p><div class="actions"><button class="btn" data-x="no">${T('cancel')}</button><button class="btn primary" data-x="yes">${esc(yes)}</button></div></div>`,
    x=>{ closeOverlay(); if(x==='yes') fn(); });
}
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&$('overlay').innerHTML&&!document.querySelector('#overlay .menu-sheet.forced')) closeOverlay();
  if(UI.view==='analysis'&&!$('overlay').innerHTML){ if(e.key==='ArrowLeft') setA(UI.aIdx-1); if(e.key==='ArrowRight') setA(UI.aIdx+1); } });

/* ---------- menu ---------- */
const MODE_ICON={
  computer:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/><path d="M9 10h.01M15 10h.01"/></svg>',
  local:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20c0-3 2.5-5 5-5s5 2 5 5M11 20c0-3 2.5-5 5-5s5 2 5 5"/></svg>',
  online:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>'
};
function tcButtons(cur,key){
  const opts=[[-1,T('noTime')],...TCS.slice(1).map((t,i)=>[i+1,t.m+'+'+t.i]),['c',T('custom')]];
  return `<div class="seg" data-seg="${key}">${opts.map(([v,l])=>`<button type="button" data-v="${v}" class="${String(cur)===String(v)?'on':''}">${l}</button>`).join('')}</div>`;
}
function openMenu(forced){
  const m=SET.mode;
  const langs=Object.keys(LANGS).map(k=>`<button type="button" class="lang ${k===LANG?'on':''}" data-lang="${k}" title="${LANGS[k]}">${k==='pt'?'PT-BR':k.toUpperCase()}</button>`).join('');
  const modes=['computer','local','online'].map(k=>`<button type="button" class="mode ${m===k?'on':''}" data-mode="${k}">${MODE_ICON[k]}<div><b>${T('mode'+k[0].toUpperCase()+k.slice(1))}</b><span>${T('mode'+k[0].toUpperCase()+k.slice(1)+'Desc')}</span></div></button>`).join('');
  const custom=`<div class="field" id="customBox" ${SET.tc==='c'?'':'hidden'} style="margin-top:8px"><input type="number" id="cMin" min="1" max="180" value="${SET.custom.m}"><span class="small muted">${T('minutes')}</span><input type="number" id="cInc" min="0" max="60" value="${SET.custom.i}"><span class="small muted">${T('incSec')}</span></div>`;
  let body='';
  if(m==='computer'){
    body=`<h3>${T('level')}</h3><div class="lvl"><input type="range" id="lvl" min="1" max="8" value="${SET.level}"><output id="lvlOut">${SET.level} · ${T('levelNames')[SET.level-1]}</output></div>
      <h3>${T('color')}</h3><div class="seg" data-seg="color">${[['w',T('white')],['b',T('black')],['r',T('random')]].map(([v,l])=>`<button type="button" data-v="${v}" class="${SET.color===v?'on':''}">${l}</button>`).join('')}</div>
      <h3>${T('time')}</h3>${tcButtons(SET.tc,'tc')}${custom}
      <h3>&nbsp;</h3><label class="check"><input type="checkbox" id="tipsChk" ${SET.tips?'checked':''}><span>${T('tips')}<small>${T('tipsDesc')}</small></span></label>
      <div class="actions">${G&&!forced?`<button class="btn" data-x="close">${T('resume')}</button>`:''}<button class="btn primary" data-x="start">${T('start')}</button></div>`;
  } else if(m==='local'){
    body=`<h3>${T('time')}</h3>${tcButtons(SET.tc,'tc')}${custom}
      <h3>&nbsp;</h3><label class="check"><input type="checkbox" id="flipChk" ${SET.autoFlip?'checked':''}><span>${T('autoFlip')}</span></label>
      <div class="actions">${G&&!forced?`<button class="btn" data-x="close">${T('resume')}</button>`:''}<button class="btn primary" data-x="start">${T('start')}</button></div>`;
  } else {
    const code=(location.hash.match(/^#([A-Za-z]{4})$/)||[])[1]||'';
    body=`<h3>${T('yourName')}</h3><div class="field"><input type="text" class="name" id="oName" maxlength="16" value="${esc(SET.name)}" autocomplete="nickname"></div>
      <h3>${T('hostColor')}</h3><div class="seg" data-seg="ocolor">${[['w',T('white')],['b',T('black')],['r',T('random')]].map(([v,l])=>`<button type="button" data-v="${v}" class="${SET.ocolor===v?'on':''}">${l}</button>`).join('')}</div>
      <h3>${T('time')}</h3>${tcButtons(SET.otc,'otc').replace(/<button type="button" data-v="c"[^>]*>[^<]*<\/button>/,'')}
      <div class="actions"><button class="btn primary" data-x="create">${T('createRoom')}</button></div>
      <div class="divider">${T('orJoin')}</div>
      <div class="field"><input type="text" class="code" id="oCode" maxlength="4" value="${esc(code)}" placeholder="ABCD" autocapitalize="characters" autocomplete="off"><button class="btn primary" data-x="join" type="button">${T('joinRoom')}</button></div>
      <div class="err" id="oErr"></div>
      ${G&&!forced?`<div class="actions"><button class="btn" data-x="close">${T('resume')}</button></div>`:''}`;
  }
  showOverlay(`<div class="sheet menu-sheet ${forced?'forced':''}" role="dialog" aria-modal="true" aria-labelledby="mTitle"><div class="shead"><h2 id="mTitle">${T('newGame')}</h2><div class="langs">${langs}</div></div>
    <div class="modes">${modes}</div>${body}</div>`, (x,b)=>menuAction(x,b), forced);
  const ov=$('overlay').firstChild;
  ov.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{ SET.mode=b.dataset.mode; saveSet(); openMenu(forced); });
  ov.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{ setLang(b.dataset.lang); if(G&&G.mode==='computer') G.names[other(G.myColor)]=T('computer')+' · '+T('levelNames')[G.level-1], G.names[G.myColor]=T('you'); openMenu(forced); render(); });
  ov.querySelectorAll('[data-seg]').forEach(seg=>seg.onclick=e=>{
    const b=e.target.closest('button'); if(!b) return; const k=seg.dataset.seg; let v=b.dataset.v;
    if(k==='tc'||k==='otc') v=v==='c'?'c':+v;
    SET[k]=v; saveSet();
    seg.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
    const cb=$('customBox'); if(cb&&k==='tc') cb.hidden=v!=='c';
  });
  const lvl=$('lvl'); if(lvl) lvl.oninput=()=>{ SET.level=+lvl.value; saveSet(); $('lvlOut').textContent=SET.level+' · '+T('levelNames')[SET.level-1]; };
  const tc=$('tipsChk'); if(tc) tc.onchange=()=>{ SET.tips=tc.checked; saveSet(); };
  const fc=$('flipChk'); if(fc) fc.onchange=()=>{ SET.autoFlip=fc.checked; saveSet(); };
  ['cMin','cInc'].forEach(id=>{ const e=$(id); if(e) e.oninput=()=>{ SET.custom={m:Math.max(1,Math.min(180,+$('cMin').value||1)),i:Math.max(0,Math.min(60,+$('cInc').value||0))}; saveSet(); }; });
  const on=$('oName'); if(on) on.oninput=()=>{ SET.name=on.value.trim().slice(0,16); saveSet(); };
  const oc=$('oCode'); if(oc){ oc.oninput=()=>{ oc.value=oc.value.toUpperCase().replace(/[^A-Z]/g,''); }; oc.onkeydown=e=>{ if(e.key==='Enter') menuAction('join'); }; }
}
async function menuAction(x){
  if(x==='close'){ closeOverlay(); return; }
  if(x==='start'){
    closeOverlay();
    if(ON) leaveOnline(true,true);
    newLocalGame(SET.mode);
    return;
  }
  if(x==='create'||x==='join'){
    const err=$('oErr'); err.textContent='';
    const name=($('oName').value||'').trim()||(LANG==='en'?'Player':LANG==='pt'?'Jogador':'Spieler');
    SET.name=name; saveSet();
    try{
      let r;
      if(x==='create'){ const t=tcFrom(SET.otc,SET.custom); r=await api('create',{name,color:SET.ocolor,tc:t},true); }
      else{ const code=($('oCode').value||'').toUpperCase(); if(code.length!==4){ err.textContent=T('e_noRoom'); return; } r=await api('join',{code,name},true); }
      closeOverlay();
      await enterOnline({code:r.code,roomId:r.roomId,seat:r.seat,token:r.token},r.now);
    }catch(e){ err.textContent=e.message; }
  }
}
$('menuBtn').onclick=()=>{ if(UI.view==='analysis'){ UI.view='game'; render(); } openMenu(false); };
$('soundBtn').onclick=()=>{ sound=!sound; LS.set('schach-sound',sound); render(); if(sound) tone(420,.07,.25); };

/* leaving towards the Game Hub */
document.addEventListener('click',e=>{
  const a=e.target.closest&&e.target.closest('a.exitlink'); if(!a) return;
  if(ON||(G&&!G.result&&G.chess.history().length)){
    e.preventDefault();
    showOverlay(`<div class="sheet" role="alertdialog" aria-modal="true"><h2>${T('exitTitle')}</h2><p>${esc(ON?T('exitOnline'):T('exitText'))}</p><div class="actions"><button class="btn" data-x="stay">${T('resume')}</button><a class="btn primary" data-x="go" href="${HUB_URL}">${T('exitGo')}</a></div></div>`,
      x=>{ if(x==='go'){ if(ON) leaveOnline(true,true); } else closeOverlay(); });
  }
});

/* ---------- analysis ---------- */
const AN_MS=400;
function fensOf(){ const c=new Chess(), out=[c.fen()]; for(const m of hist()){ c.move(m.san); out.push(c.fen()); } return out; }
function openAnalysis(){
  closeOverlay(); UI.view='analysis'; UI.token++; UI.thinking=false;
  const n=G.chess.history().length;
  if(!G.analysis||!G.analysis.ev||G.analysis.n!==n) G.analysis={n,ev:[],best:[],cls:null};
  UI.aIdx=Math.min(n,1)?firstMistake():0;
  render();
  if(!G.analysis.cls) runAnalysis();
}
function firstMistake(){ const a=G.analysis; if(!a||!a.cls) return 0; const me=G.myColor; for(let i=0;i<a.cls.length;i++){ const col=i%2===0?'w':'b'; if((!me||col===me)&&(a.cls[i]==='bad'||a.cls[i]==='err')) return i+1; } return 0; }
async function runAnalysis(){
  if(UI.anBusy) return; UI.anBusy=true;
  const a=G.analysis, F=fensOf(), tok=UI.token;
  for(let i=0;i<F.length;i++){
    if(a.ev[i]) continue;
    if(tok!==UI.token||UI.view!=='analysis'||G.analysis!==a){ UI.anBusy=false; return; }
    UI.anProg=i/F.length; renderAnalysisProgress(i+1,F.length);
    const c=new Chess(F[i]);
    if(c.in_checkmate()){ a.ev[i]={cp:c.turn()==='w'?-100000:100000,mate:null}; a.best[i]=null; continue; }
    if(c.game_over()){ a.ev[i]={cp:0,mate:null}; a.best[i]=null; continue; }
    try{ const r=await ENG.search(F[i],{skill:20,ms:AN_MS}); a.ev[i]=ENG.whiteScore(r.lines[0],c.turn()); a.best[i]=r.best; }
    catch(e){ a.ev[i]={cp:0,mate:null}; a.best[i]=null; }
  }
  a.cls=classifyAll(a,F); UI.anBusy=false; save();
  if(UI.view==='analysis'&&G.analysis===a){ UI.aIdx=firstMistake()||UI.aIdx; render(); }
}
function mv(e,c){ const w=ENG.winPct(e); return c==='w'?w:100-w; }
function mateFor(e,c){ if(e.mate==null) return 0; const m=c==='w'?e.mate:-e.mate; return m>0?m:0; }
function classifyAll(a,F){
  const h=hist(), out=[];
  for(let i=0;i<h.length;i++){
    const col=i%2===0?'w':'b', b=a.ev[i], af=a.ev[i+1], uci=h[i].from+h[i].to+(h[i].promotion||'');
    const drop=mv(b,col)-mv(af,col);
    const prev=out[i-1];
    if(uci===a.best[i]||drop<2){ out.push(prev==='bad'&&uci===a.best[i]?'good':uci===a.best[i]?'best':'ok'); continue; }
    if(mateFor(af,other(col))&&mateFor(af,other(col))<=5&&!mateFor(b,other(col))){ out.push('bad'); continue; }
    if(mateFor(b,col)&&mateFor(b,col)<=5&&!mateFor(af,col)){ out.push(drop>=30?'bad':'err'); continue; }
    // short engine searches are noisy, so a move also has to lose real material value
    const cp=e=>e.mate!=null?(e.mate>0?1500:-1500):Math.max(-1500,Math.min(1500,e.cp));
    const loss=(col==='w'?1:-1)*(cp(b)-cp(af));
    out.push(drop>=30&&loss>=200?'bad':drop>=15&&loss>=110?'err':drop>=8&&loss>=60?'inac':'ok');
  }
  return out;
}
function explain(i){
  const a=G.analysis, F=fensOf(), h=hist(), col=i%2===0?'w':'b', k=a.cls[i], lines=[];
  const best=a.best[i], uci=h[i].from+h[i].to+(h[i].promotion||'');
  let bestSan=null;
  if(best){ const c=new Chess(F[i]); const m=c.move({from:best.slice(0,2),to:best.slice(2,4),promotion:best[4]||'q'}); bestSan=m?fig(m.san):null; }
  if(k==='best'||k==='good'){ lines.push(T('bestWas')); if(k==='good') lines.push(T('aPunish')); return {lines,best:null}; }
  if(k==='ok') return {lines:bestSan&&best!==uci?[T('better',{san:bestSan})]:[],best:null};
  if(bestSan&&best!==uci) lines.push(T('better',{san:bestSan}));
  const om=mateFor(a.ev[i+1],other(col)), mm=mateFor(a.ev[i],col);
  if(om) lines.push(T('aMate',{n:om}));
  else if(mm&&!mateFor(a.ev[i+1],col)&&bestSan) lines.push(T('aMissedMate',{n:mm,san:bestSan}));
  else{
    const before=ENG.hanging(F[i],col).map(x=>x.sq);
    const hg=ENG.hanging(F[i+1],col).filter(x=>!before.includes(x.sq)||x.sq===h[i].to);
    if(hg.length&&!(h[i].captured&&ENG.VAL[h[i].captured]>=ENG.VAL[hg[0].type])) lines.push(T('aHang',{piece:T('pieceNames')[hg[0].type],sq:hg[0].sq}));
    const e0=a.ev[i], e1=a.ev[i+1];
    if(e0.mate==null&&e1.mate==null&&Math.abs(e0.cp)<5000&&Math.abs(e1.cp)<5000){
      const loss=(col==='w'?1:-1)*(e0.cp-e1.cp)/100; if(loss>=1) lines.push(T('aLoss',{n:dec(loss.toFixed(1))}));
    }
  }
  return {lines,best:best&&best!==uci?best:null};
}
function evalText(e){
  if(!e) return '';
  if(e.mate!=null) return (e.mate>0?'+':'-')+'M'+Math.abs(e.mate);
  if(Math.abs(e.cp)>=5000) return e.cp>0?'1-0':'0-1';
  const v=e.cp/100; return (v>0?'+':'')+dec(v.toFixed(1));
}
function setA(k){ const n=G.chess.history().length; UI.aIdx=Math.max(0,Math.min(n,k)); render(); }
function renderAnalysisProgress(i,n){
  const p=$('anProg'); if(p){ p.querySelector('i').style.width=(i/n*100)+'%'; $('anProgText').textContent=T('analysing',{i,n}); }
}
const CLSNAME={bad:'cBad',err:'cErr',inac:'cInac',good:'cGood',best:'cBest',ok:'cBook'};
function renderAnalysis(){
  const a=G.analysis, F=fensOf(), h=hist(), n=h.length, k=UI.aIdx, done=!!(a&&a.cls);
  const bottom=UI.flip?other(G.myColor||'w'):(G.myColor||'w');
  const last=k>0?h[k-1]:null, c=new Chess(F[k]);
  let ex=null, arrows=[];
  if(done&&k>0){ ex=explain(k-1); if(ex.best) arrows.push({from:ex.best.slice(0,2),to:ex.best.slice(2,4),color:'#3f8f5a'}); }
  drawBoard($('board'),F[k],{bottom,last,check:c.in_check()?kingSq(c,c.turn()):null,arrows,badge:done&&k>0?{sq:last.to,k:a.cls[k-1]}:null});
  pbar($('pTop'),other(bottom)); pbar($('pBot'),bottom);
  document.querySelectorAll('.clock').forEach(x=>x.hidden=true);
  const ev=a&&a.ev[k];
  const eb=$('evalbar'); eb.hidden=!ev;
  if(ev){
    const w=ENG.winPct(ev), i=eb.querySelector('i');
    const vertical=matchMedia('(min-width:900px) and (orientation:landscape)').matches;
    i.style.cssText='';
    if(vertical){ i.style.height=w+'%'; if(bottom==='b'){ i.style.top='0'; i.style.bottom='auto'; } }
    else i.style.width=w+'%';
  }
  let card='';
  if(!done) card=`<div class="status"><div class="msg" id="anProgText">${T('analysing',{i:a.ev.length+1,n:n+1})}</div><div class="progress" id="anProg"><i style="width:${a.ev.length/(n+1)*100}%"></i></div></div>`;
  else if(k===0) card=`<div class="an-card"><h3>${T('start0')}</h3><p class="small">${T('accuracyNote')}</p></div>`;
  else{
    const cl=a.cls[k-1], mvNo=Math.ceil(k/2)+(k%2?'. ':'… ');
    card=`<div class="an-card"><h3><span class="tag t-${cl}">${T(CLSNAME[cl])}</span>${esc(mvNo+fig(h[k-1].san))}<span class="small" style="margin-left:auto;color:var(--ink-soft)">${esc(evalText(a.ev[k]))}</span></h3>${ex.lines.map(l=>`<p>${esc(l)}</p>`).join('')}</div>`;
  }
  let sum='';
  if(done){
    const cnt={w:{bad:0,err:0,inac:0},b:{bad:0,err:0,inac:0}};
    a.cls.forEach((x,i)=>{ const col=i%2===0?'w':'b'; if(cnt[col][x]!=null) cnt[col][x]++; });
    const rows=['w','b'].map(col=>`<div>${esc(G.names[col])}</div><div><span class="tag t-bad">${cnt[col].bad}</span></div><div><span class="tag t-err">${cnt[col].err}</span></div><div><span class="tag t-inac">${cnt[col].inac}</span></div>`).join('');
    const who=G.myColor?[G.myColor]:['w','b'];
    const chips=who.map(col=>{
      const list=a.cls.map((x,i)=>({x,i})).filter(o=>(o.i%2===0?'w':'b')===col&&(o.x==='bad'||o.x==='err'));
      return `<div class="small muted" style="margin-top:8px">${esc(G.myColor===col?T('yourMistakes'):T('mistakesOf',{name:G.names[col]}))}</div><div class="chips">${list.length?list.map(o=>`<button class="chip t-${o.x}" data-k="${o.i+1}">${esc(Math.ceil((o.i+1)/2)+(o.i%2?'… ':'. ')+fig(h[o.i].san))}</button>`).join(''):`<span class="small">${T('noMistakes')}</span>`}</div>`;
    }).join('');
    sum=`<div class="status"><div class="sum"><div class="h">${T('summary')}</div><div class="h">??</div><div class="h">?</div><div class="h">?!</div>${rows}</div>${chips}</div>`;
  }
  $('side').innerHTML=`${card}
    <div class="an-nav"><button class="btn" data-n="first" aria-label="|<">${ICON.first}</button><button class="btn" data-n="prev" aria-label="<">${ICON.prev}</button><button class="btn" data-n="next" aria-label=">">${ICON.next}</button><button class="btn" data-n="last" aria-label=">|">${ICON.lastI}</button></div>
    ${sum}
    <div class="moves" id="moves">${moveListHTML(k,done?a.cls:null)}</div>
    <div class="controls"><button class="btn" id="anFlip">${ICON.flip}${T('flip')}</button><button class="btn primary" id="anBack">${T('backToGame')}</button></div>`;
  $('side').querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>{ const x=b.dataset.n; setA(x==='first'?0:x==='prev'?k-1:x==='next'?k+1:n); });
  $('side').querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>setA(+b.dataset.k));
  $('anFlip').onclick=()=>{ UI.flip=!UI.flip; render(); };
  $('anBack').onclick=()=>{ UI.view='game'; UI.token++; render(); };
  const cur=$('moves').querySelector('.mv.cur'); if(cur) cur.scrollIntoView({block:'nearest'});
}
/* swipe on the board to step through the analysis */
(function(){ let sx=null; const b=$('board');
  b.addEventListener('touchstart',e=>{ if(UI.view==='analysis') sx=e.touches[0].clientX; },{passive:true});
  b.addEventListener('touchend',e=>{ if(UI.view!=='analysis'||sx==null) return; const dx=e.changedTouches[0].clientX-sx; sx=null; if(Math.abs(dx)>40) setA(UI.aIdx+(dx<0?1:-1)); });
  b.addEventListener('click',e=>{ if(UI.view!=='analysis') return; const r=b.getBoundingClientRect(); setA(UI.aIdx+(e.clientX-r.left>r.width/2?1:-1)); });
})();

/* ---------- online ---------- */
const SB_URL='https://dwsieddjvldzurosjdpp.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3c2llZGRqdmxkenVyb3NqZHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NDE3NjEsImV4cCI6MjEwNzExNzc2MX0.NyIPiH_MQBNrHQn6Ype0SF8KLMO47FwZhosdoAusYeI';
const sbHeaders={'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY};
async function api(action,body={},noSession){
  const payload={action,...body};
  if(!noSession&&ON){ payload.code=ON.code; payload.token=ON.token; }
  let r;
  try{ r=await fetch(SB_URL+'/functions/v1/schach',{method:'POST',headers:sbHeaders,body:JSON.stringify(payload)}); }
  catch(e){ throw new Error(T('netErr')); }
  const j=await r.json().catch(()=>({}));
  if(j.now&&ON) ON.offset=Math.min(ON.offset,Date.now()-j.now);
  if(!r.ok||j.error) throw new Error(j.code&&I18N.de['e_'+j.code]?T('e_'+j.code):T('serverErr'));
  return j;
}
async function fetchRoom(code){
  let r; try{ r=await fetch(SB_URL+'/rest/v1/schach_rooms?code=eq.'+encodeURIComponent(code)+'&select=id,version,state',{headers:sbHeaders}); }catch(e){ throw new Error(T('netErr')); }
  if(!r.ok) throw new Error(T('loadErr'));
  const rows=await r.json(); return rows[0]||null;
}
let sbLib=null;
function loadSupabase(){
  if(window.supabase&&window.supabase.createClient) return Promise.resolve(window.supabase);
  if(!sbLib) sbLib=new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'; s.onload=()=>res(window.supabase); s.onerror=rej; document.head.appendChild(s); });
  return sbLib;
}
async function enterOnline(sess,serverNow){
  leaveOnline(true);
  UI.token++; ENG.stop();
  ON={...sess, st:null, version:-1, offset:serverNow?Date.now()-serverNow:0, flagSent:-1, lastGame:0};
  LS.set('schach-online',{code:sess.code,roomId:sess.roomId,seat:sess.seat,token:sess.token});
  try{ history.replaceState(null,'','#'+sess.code); }catch(e){}
  const row=await fetchRoom(sess.code).catch(()=>null);
  if(!ON) return;
  if(!row){ roomGone(); return; }
  onRow(row);
  ON.poll=setInterval(async()=>{ if(!ON) return; try{ const r=await fetchRoom(ON.code); if(!ON) return; if(!r){ roomGone(); return; } onRow(r); }catch(e){} },3000);
  loadSupabase().then(lib=>{
    if(!ON||!lib||!lib.createClient) return;
    ON.client=lib.createClient(SB_URL,SB_KEY,{auth:{persistSession:false}});
    ON.chan=ON.client.channel('schach-'+ON.code)
      .on('postgres_changes',{event:'*',schema:'public',table:'schach_rooms',filter:'code=eq.'+ON.code},p=>{ if(p.eventType==='DELETE') roomGone(); else onRow(p.new); })
      .subscribe();
  }).catch(()=>{});
}
function leaveOnline(silent,tellServer){
  if(!ON) return; const o=ON; ON=null;
  clearInterval(o.poll);
  try{ if(o.client&&o.chan) o.client.removeChannel(o.chan); }catch(e){}
  if(tellServer||(!silent)) fetch(SB_URL+'/functions/v1/schach',{method:'POST',headers:sbHeaders,keepalive:true,body:JSON.stringify({action:'leave',code:o.code,token:o.token})}).catch(()=>{});
  LS.set('schach-online',null);
  try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){}
}
function roomGone(){ toast(T('e_noRoom')); leaveOnline(true); G=null; closeOverlay(); if(!restore()) G=null; if(G) render(); openMenu(!G); }
function onRow(row){
  if(!ON||!row||!row.state||row.version<=ON.version) return;
  const prev=ON.st, st=row.state; ON.version=row.version; ON.st=st; ON.roomId=row.id;
  if(st.savedAt) ON.offset=Math.min(ON.offset,Date.now()-st.savedAt);
  const myColor=st.white===ON.seat?'w':'b';
  if(st.status==='lobby'){ G=null; showLobby(st); return; }
  if(document.querySelector('#overlay .lobby')) closeOverlay();
  // rebuild the game from the move list; animate when exactly one move was added
  const newGameStarted=!G||G.mode!=='online'||ON.lastGame!==st.game;
  const oldLen=newGameStarted?-1:G.chess.history().length;
  const c=new Chess(); let lastMove=null;
  for(const u of st.moves) lastMove=c.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]||'q'});
  const names={}; names[myColor]=st.players[ON.seat]?st.players[ON.seat].name:'';
  const op=st.players[1-ON.seat]; names[other(myColor)]=op?op.name:T('freeSeat');
  const keepAn=G&&G.mode==='online'&&!newGameStarted&&G.analysis;
  if(newGameStarted){ UI.view='game'; UI.flip=false; UI.overShown=false; closeOverlay(); }
  G={mode:'online', chess:c, myColor, level:0, tips:false, autoFlip:false, tc:st.tc, clock:null, result:st.result, names, analysis:keepAn||null};
  ON.lastGame=st.game;
  const anim=st.moves.length===oldLen+1&&oldLen>=0?lastMove:null;
  if(anim&&st.moves.length&&st.moves.length-1>=0) { /* only animate the opponent's move; ours is already shown */ }
  resetTransient();
  if(UI.view==='game'){ render({anim:anim&&anim.color!==myColor?anim:null}); if(anim&&anim.color!==myColor) sfx(anim); }
  if(prev&&prev.drawOffer&&!st.drawOffer&&prev.drawOffer===myColor&&st.status==='play') toast(T('drawDeclined'));
  if(st.status==='over'){
    if(st.rematch&&st.rematch[1-ON.seat]&&!st.rematch[ON.seat]) toast(T('rematchAsk',{name:names[other(myColor)]}));
    else if(st.rematch&&st.rematch[ON.seat]) toast(T('rematchWait'));
    if(!UI.overShown) onGameOver();
  }
}
function onlineMove(uci){
  const m=G.chess.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||'q'}); if(!m) return;
  UI.sel=null; render({anim:UI.noAnim?null:m}); sfx(m);
  api('move',{uci}).catch(async e=>{ toast(e.message); try{ const r=await fetchRoom(ON.code); if(r){ ON.version=-1; onRow(r); } }catch(_){} });
}
function showLobby(st){
  const link=location.origin+location.pathname+'#'+ON.code;
  $('side').innerHTML=''; $('board').innerHTML=''; $('pTop').innerHTML=''; $('pBot').innerHTML='';
  drawBoard($('board'),START,{bottom:st.colorPref==='b'?'b':'w'});
  showOverlay(`<div class="sheet lobby menu-sheet forced" role="dialog" aria-modal="true"><h2>${T('modeOnline')}</h2><p>${T('shareCode')}</p><div class="bigcode">${esc(ON.code)}</div>
    <p class="small muted" style="text-align:center">${esc(T('waiting'))}${st.tc?' · '+tcLabel(st.tc):''}</p>
    <div class="actions"><button class="btn" data-x="leave">${T('leaveRoom')}</button><button class="btn primary" data-x="copy">${T('copyLink')}</button></div></div>`,
    async (x,b)=>{
      if(x==='copy'){ try{ if(navigator.share) await navigator.share({title:T('title'),text:T('roomCode')+': '+ON.code,url:link}); else{ await navigator.clipboard.writeText(link); b.textContent=T('copied'); } }catch(e){} }
      if(x==='leave'){ leaveOnline(false); G=null; if(!restore()) G=null; closeOverlay(); if(G) render(); openMenu(!G); }
    }, true);
}

window.addEventListener('hashchange',()=>{
  const code=(location.hash.match(/^#([A-Za-z]{4})$/)||[])[1];
  if(code&&(!ON||ON.code!==code.toUpperCase())){ SET.mode='online'; saveSet(); openMenu(!G); }
});
/* ---------- start ---------- */
setLang(LANG);
(async function start(){
  const sess=LS.get('schach-online',null);
  const hashCode=(location.hash.match(/^#([A-Za-z]{4})$/)||[])[1];
  if(sess&&sess.code&&(!hashCode||hashCode.toUpperCase()===sess.code)){
    const row=await fetchRoom(sess.code).catch(()=>null);
    if(row&&row.state&&!(row.state.left||[])[sess.seat]){ await enterOnline(sess,null); requestAnimationFrame(tick); return; }
    LS.set('schach-online',null);
  }
  const had=restore();
  if(had) render();
  else{ G=null; drawBoard($('board'),START,{bottom:'w'}); }
  if(hashCode){ SET.mode='online'; saveSet(); openMenu(!had); }
  else if(!had) openMenu(true);
  else if(G.mode==='computer'&&!G.result) maybeComputer();
  requestAnimationFrame(tick);
})();
