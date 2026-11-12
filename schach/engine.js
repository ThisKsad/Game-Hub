/* Stockfish (stockfish.js, GPL) in a Web Worker: computer moves, hints and post-game analysis.
   Also pure chess.js helpers for hanging pieces and mate threats, used by the tips. */
(function(){
const ENG={};
let W=null, listeners=[], queue=Promise.resolve();
function boot(){
  if(W) return W;
  const w=new Worker('stockfish.js');
  w.onmessage=e=>{ const l=typeof e.data==='string'?e.data:String(e.data); listeners.slice().forEach(f=>f(l)); };
  const send=c=>w.postMessage(c);
  const wait=pred=>new Promise(res=>{ const f=l=>{ if(pred(l)){ listeners=listeners.filter(x=>x!==f); res(l); } }; listeners.push(f); });
  W={send,wait,ready:(async()=>{ send('uci'); await wait(l=>l==='uciok'); send('isready'); await wait(l=>l==='readyok'); })()};
  return W;
}
// one search at a time; later callers wait their turn
function serial(fn){ const p=queue.then(fn,fn); queue=p.catch(()=>{}); return p; }

/* search: returns {best, lines:[{uci,pv,cp,mate}]} from the side to move's view */
ENG.search=(fen,{skill=20,depth=null,ms=null,multipv=1}={})=>serial(async()=>{
  const E=boot(); await E.ready;
  const lines={};
  const f=l=>{
    if(!l.startsWith('info')||l.indexOf(' pv ')<0) return;
    const m=/ multipv (\d+)/.exec(l), sc=/ score (cp|mate) (-?\d+)/.exec(l), pv=/ pv (.+)$/.exec(l);
    if(!sc||!pv) return;
    const k=m?+m[1]:1, v=+sc[2];
    lines[k]={pv:pv[1].trim().split(/\s+/), cp:sc[1]==='cp'?v:null, mate:sc[1]==='mate'?v:null};
  };
  listeners.push(f);
  E.send('setoption name Skill Level value '+skill);
  E.send('setoption name MultiPV value '+multipv);
  E.send('ucinewgame'); E.send('isready'); await E.wait(l=>l==='readyok');
  E.send('position fen '+fen);
  E.send('go '+(depth?'depth '+depth:'movetime '+(ms||500)));
  const bm=await E.wait(l=>l.startsWith('bestmove'));
  listeners=listeners.filter(x=>x!==f);
  const out=Object.keys(lines).sort((a,b)=>a-b).map(k=>({uci:lines[k].pv[0],...lines[k]}));
  return {best:(bm.split(' ')[1]||'').trim(), lines:out};
});
ENG.stop=()=>{ if(W) W.send('stop'); };

/* computer strength: 1 = absolute beginner … 8 = strong club player.
   Low levels mix in random moves so they really make beginner mistakes. */
ENG.LEVELS=[
  {skill:0, depth:1, rnd:.55},
  {skill:0, depth:1, rnd:.35},
  {skill:1, depth:2, rnd:.2},
  {skill:3, depth:3, rnd:.1},
  {skill:6, depth:5, rnd:.04},
  {skill:10,depth:8, rnd:0},
  {skill:15,depth:11,rnd:0},
  {skill:20,ms:1200, rnd:0}
];
ENG.computerMove=async(fen,level)=>{
  const L=ENG.LEVELS[Math.max(0,Math.min(7,level-1))];
  const c=new Chess(fen), legal=c.moves({verbose:true});
  if(!legal.length) return null;
  const toUci=m=>m.from+m.to+(m.promotion||'');
  // always take a mate in one, even when blundering otherwise
  for(const m of legal){ c.move(m); const mate=c.in_checkmate(); c.undo(); if(mate&&level>=2) return toUci(m); }
  if(L.rnd&&Math.random()<L.rnd){
    // random, but prefer captures a little so it doesn't feel aimless
    const caps=legal.filter(m=>m.captured);
    const pool=caps.length&&Math.random()<.4?caps:legal;
    return toUci(pool[Math.floor(Math.random()*pool.length)]);
  }
  const r=await ENG.search(fen,{skill:L.skill,depth:L.depth||null,ms:L.ms||null});
  return r.best&&r.best!=='(none)'?r.best:toUci(legal[0]);
};

/* evaluation in pawns from White's view; mate turned into a big number */
ENG.whiteScore=(line,turn)=>{
  if(!line) return {cp:0,mate:null};
  const s=turn==='w'?1:-1;
  return line.mate!=null?{cp:null,mate:s*line.mate}:{cp:s*line.cp,mate:null};
};
ENG.winPct=e=>{
  if(e.mate!=null) return e.mate>0?100:0;
  return 50+50*(2/(1+Math.exp(-0.00368208*e.cp))-1);
};

/* ---------- pure helpers (no engine) ---------- */
const VAL={p:1,n:3,b:3,r:5,q:9,k:100};
ENG.VAL=VAL;
const FILES='abcdefgh';
function withTurn(fen,color){ const p=fen.split(' '); p[1]=color; p[3]='-'; return p.join(' '); }
function safe(fen){ const c=new Chess(); if(!c.validate_fen(fen).valid) return null; return c.load(fen)?c:null; }
// pieces of `color` able to capture on sq
function capturers(fen,sq,color){
  const c=safe(withTurn(fen,color)); if(!c) return [];
  const opp=color==='w'?'b':'w'; const p=c.get(sq); if(p&&p.type==='k') return [];
  c.remove(sq); c.put({type:'q',color:opp},sq);
  // a king with a dummy queen next to it could leave itself in check; chess.js filters that
  try{ return c.moves({verbose:true}).filter(m=>m.to===sq).map(m=>m.piece); }catch(e){ return []; }
}
/* pieces of `color` that are attacked and either undefended or attacked by something cheaper */
ENG.hanging=(fen,color)=>{
  const c=new Chess(fen), opp=color==='w'?'b':'w', out=[];
  c.board().forEach((row,r)=>row.forEach((p,f)=>{
    if(!p||p.color!==color||p.type==='k') return;
    const sq=FILES[f]+(8-r);
    const atk=capturers(fen,sq,opp); if(!atk.length) return;
    const cheapest=atk.reduce((a,b)=>VAL[a]<=VAL[b]?a:b);
    const def=capturers(fen,sq,color).length;
    if(def===0||VAL[cheapest]<VAL[p.type]) out.push({sq,type:p.type});
  }));
  return out.sort((a,b)=>VAL[b.type]-VAL[a.type]);
};
/* a move of `by` that mates right now (if it were their turn) */
ENG.mateInOne=(fen,by)=>{
  const c=safe(withTurn(fen,by)); if(!c) return null;
  for(const m of c.moves({verbose:true})){ c.move(m); const mate=c.in_checkmate(); c.undo(); if(mate) return m; }
  return null;
};
/* What would go wrong with this move? Used by the optional warning before a move. */
ENG.moveWarning=(fen,uci)=>{
  const c=new Chess(fen), me=c.turn(), opp=me==='w'?'b':'w';
  const m=c.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||'q'});
  if(!m||c.game_over()) return null;
  const after=c.fen();
  const mate=ENG.mateInOne(after,opp);
  if(mate) return {kind:'mate',san:mate.san,from:mate.from,to:mate.to};
  const before=ENG.hanging(fen,me).map(x=>x.sq);
  // only warn about pieces that are newly in trouble (or the piece that just moved)
  const h=ENG.hanging(after,me).filter(x=>!before.includes(x.sq)||x.sq===m.to);
  // a capture that wins more than it loses is fine
  if(h.length){
    const worst=h[0];
    if(m.captured&&VAL[m.captured]>=VAL[worst.type]) return null;
    return {kind:'hang',sq:worst.sq,type:worst.type};
  }
  return null;
};

window.ENG=ENG;
})();
