/* MCLL schedule console - the page.
   TeamLinkt is the source of truth. data/schedule.csv is the latest export and
   is what every visitor sees. Edits made here stay in this browser as proposed
   changes until they are entered in TeamLinkt and a new export is imported. */
(function(){
'use strict';
const CFG=window.MCLL_CONFIG, TL=window.TL, RU=window.RULES, FD=window.FD;
const $=id=>document.getElementById(id);
const KEY='mcll_console_v1', KEYF='mcll_fields_v1';
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=m=>{const h=Math.floor(m/60),n=((m%60)+60)%60;return `${(h%12)||12}:${String(n).padStart(2,'0')}${h<12?'am':'pm'}`;};
const hhmm=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const LANE_SNAP=15;

let BASE=[], G=[];                 // TeamLinkt truth, and the working copy
let REPO=null;                     // games in the published file, when it could be read
let cur=null, prog='ALL', sel=null, admin=false, panel='issues', view='grid', fieldMode='permitted';
let hide=new Set(), teamFocus='', bad=new Set(), warned=new Set(), ISSUES=[];
let ignored=new Set(), litLocal={}, meta={src:'',when:'',sig:'',last:null};
let PX=1.55;
/* field supply: permits and practices. RAW holds the text in use for each
   (the published file, or one imported in this browser); FX is the index. */
let RAW={permits:null,practices:null}, PUBF={permits:null,practices:null};
let PERMITS=[], PRACS=[], FX=FD.index([],[]), FPROB={permits:[],practices:[]}, showPrac=true;

/* ------------------------------------------------------------ derived facts */
const _gm={};
function gmeta(group){
  if(_gm[group]) return _gm[group];
  const s=TL.splitGroup(group);
  s.prog=CFG.programs.find(p=>p.test(s)).id;
  s.label=s.div+(s.prog==='AC'&&s.sport?` (${s.sport})`:'');
  const c=(CFG.colors.find(([re])=>re.test(s.div))||[null,'#7A8B93'])[1];
  s.color=c; s.lite=/#C2A63C|#8FA84E/i.test(c);
  return _gm[group]=s;
}
const progOf=g=>gmeta(g.group).prog;
const inProg=g=>prog==='ALL'||progOf(g)===prog;
const isLit=f=>litLocal[f]!==undefined?litLocal[f]:CFG.litFields.some(x=>f.indexOf(x)>=0);
const noField=l=>!l||/^tba$/i.test(l.trim());
const sunset=d=>RU.sunset(d,CFG.lat,CFG.lon);
const dlabel=(d,o)=>new Date(d+'T12:00:00').toLocaleDateString('en-US',o||{weekday:'short',month:'short',day:'numeric'});
const todayISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const isGame=g=>/game/i.test(g.type);
const vsFull=g=>g.away?`${g.home} v ${g.away}`:(g.home||g.notes||g.type);

/* "Stranger Swings - LC QA/Majors - Melchior" -> "Stranger Swings Melchior" */
const _st={};
function shortTeam(t){
  if(_st[t]) return _st[t];
  const s=String(t).replace(/\b(UC|LC|SB|LL)\b/g,' ')
    .replace(/\b(QA\/Majors|Majors|Minors|AAAA|AAA|AA|Hybrid|CP-RB|CP-SR|CP|TB|TBall|T-Ball|Rookie|Intermediates|Juniors|Seniors|Softball|Team\s*\d+)\b/gi,' ')
    .replace(/(^|\s)A(?=\s*-|\s*$)/,' ')
    .split(/\s*-\s*|\s{2,}/).map(x=>x.trim()).filter(Boolean).join(' ');
  return _st[t]=s||t;
}
const vs=g=>g.away?`${shortTeam(g.home)} v ${shortTeam(g.away)}`:(shortTeam(g.home||'')||g.notes||g.type);
/* "Beverly Farms Local Park - Field 1" -> "Beverly Farms LP #1" (display only) */
function shortField(f){
  return String(f).replace(/\bLocal Park\b/g,'LP').replace(/\b(Recreational|Regional|Rec) Park\b/g,'RP')
    .replace(/\bMiddle School\b/g,'MS').replace(/\bElementary School\b/g,'ES').replace(/\bHigh School\b/g,'HS')
    .replace(/\s*-\s*Field\s+(\w+)$/,' #$1').replace(/\s+Field\s+(\w+)$/,' #$1');
}
function park(loc){
  const m=String(loc).match(/^(.*?)(?:\s+-\s+|\s+)(Field\s+\w+)$/i);
  return m?{park:m[1],sub:m[2]}:{park:loc,sub:''};
}
const hasTeam=(g,t)=>g.home===t||g.away===t;
const focusHit=g=>!teamFocus||hasTeam(g,teamFocus);
const inProgX=x=>prog==='ALL'||!x.prog||x.prog===prog;            // a permit or practice
const pracHit=p=>!teamFocus||p.team===teamFocus;
const pracShown=()=>showPrac?PRACS:[];
const capFor=(date,f)=>isLit(f)?null:sunset(date)+CFG.sunsetGrace;
const openOn=(date,f,o)=>FX.free(date,f,Object.assign({games:G.filter(g=>g.date===date&&!RU.noTime(g)),cap:capFor(date,f)},o||{}))
  .filter(w=>w.end-w.start>=CFG.minOpen);
const seed=(f,w,date)=>({loc:f,date,start:w.start,end:w.start+Math.min(120,w.end-w.start)});
const hrs=m=>{ const h=Math.round(m/30)/2; return h+' h'; };

/* ------------------------------------------------------------ field supply */
function locations(){ return [...new Set(G.map(g=>g.loc).concat(BASE.map(g=>g.loc)).filter(l=>!noField(l)))]; }
function teamOf(coach,div){
  const sur=String(coach||'').trim().split(/\s+/).pop().toLowerCase(); if(!sur) return '';
  const teams=[...new Set(G.flatMap(g=>[g.home,g.away]).filter(Boolean))].filter(t=>t.toLowerCase().indexOf(sur)>=0);
  const d=String(div||'').toLowerCase(), narrow=d?teams.filter(t=>t.toLowerCase().indexOf(d)>=0):[];
  return (narrow.length===1?narrow:teams.length===1?teams:[])[0]||'';
}
function rebuildFields(){
  const R=FD.resolver(locations(),CFG.fieldAliases);
  const a=RAW.permits?FD.parsePermits(RAW.permits.text,R):{permits:[],problems:[]};
  const b=RAW.practices?FD.parsePractices(RAW.practices.text,R,teamOf):{practices:[],problems:[]};
  const progOfTeam={}; G.forEach(g=>[g.home,g.away].forEach(t=>{ if(t&&!progOfTeam[t]) progOfTeam[t]=progOf(g); }));
  b.practices.forEach(p=>{ if(!p.prog) p.prog=progOfTeam[p.team]||''; });
  PERMITS=a.permits; PRACS=b.practices; FPROB={permits:a.problems,practices:b.problems};
  FX=FD.index(PERMITS,PRACS);
}
function saveF(){ try{ const o={}; ['permits','practices'].forEach(k=>{ if(RAW[k]&&RAW[k].local) o[k]=RAW[k]; });
  localStorage.setItem(KEYF,JSON.stringify(o)); }catch(e){} }
function loadF(){ try{ return JSON.parse(localStorage.getItem(KEYF)||'{}')||{}; }catch(e){ return {}; } }

/* ------------------------------------------------------------------ storage */
function save(){
  try{ localStorage.setItem(KEY,JSON.stringify({base:BASE,work:G,ignored:[...ignored],lit:litLocal,meta})); }catch(e){}
}
function load(){ try{ return JSON.parse(localStorage.getItem(KEY)||'null'); }catch(e){ return null; } }
function hash(s){ let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return String(h); }
const clone=list=>list.map(g=>({...g}));
const pending=()=>TL.pending(BASE,G);

/* --------------------------------------------------------------- url state */
function readHash(){
  const p=new URLSearchParams(location.hash.slice(1));
  if(p.get('p')&&(p.get('p')==='ALL'||CFG.programs.some(x=>x.id===p.get('p')))) prog=p.get('p');
  if(/^\d{4}-\d\d-\d\d$/.test(p.get('d')||'')) cur=p.get('d');
  if(p.get('t')) teamFocus=p.get('t');
  if(p.get('v')==='list'||p.get('v')==='grid') view=p.get('v');
  if(['used','permitted','all'].includes(p.get('f'))) fieldMode=p.get('f');
}
function writeHash(){
  const p=new URLSearchParams(); p.set('p',prog); if(cur) p.set('d',cur);
  if(teamFocus) p.set('t',teamFocus); if(view==='list') p.set('v','list');
  if(fieldMode!=='permitted') p.set('f',fieldMode);
  history.replaceState(null,'','#'+p.toString());
}

/* -------------------------------------------------------------------- dates */
function scoped(){ return G.filter(g=>inProg(g)&&focusHit(g)); }
function scopedPrac(){ return pracShown().filter(p=>inProgX(p)&&pracHit(p)); }
function allDates(){
  const d=new Set(scoped().map(g=>g.date));
  scopedPrac().forEach(p=>d.add(p.date));
  if(fieldMode==='permitted'&&!teamFocus) PERMITS.forEach(p=>{ if(inProgX(p)) d.add(p.date); });
  return [...d].sort();
}
function defaultDate(){
  const all=allDates(); if(!all.length) return null;
  const t=todayISO(); return all.includes(t)?t:(all.find(d=>d>=t)||all[all.length-1]);
}

/* ------------------------------------------------------------------- render */
function renderProgs(){
  const box=$('progs'); box.innerHTML='';
  const tabs=[{id:'ALL',name:'All programs'}].concat(CFG.programs);
  tabs.forEach(p=>{
    const n=G.filter(g=>p.id==='ALL'||progOf(g)===p.id).length;
    if(!n&&p.id!=='ALL') return;
    const mine=ISSUES.filter(i=>!ignored.has(issueKey(i))&&(p.id==='ALL'||i.progs.has(p.id)));
    const nb=mine.filter(i=>i.lv==='bad').length;
    const b=document.createElement('button'); b.className='prog'; b.setAttribute('aria-pressed',prog===p.id);
    b.innerHTML=`${esc(p.name)} <small>${n} games</small>`
      +(nb?`<span class="pb bad" title="${nb} rule break${nb===1?'':'s'}">${nb}</span>`
        :mine.length?`<span class="pb warn" title="${mine.length} to check">${mine.length}</span>`:'');
    b.onclick=()=>{ prog=p.id; hide=new Set(); sel=null; if(teamFocus&&!G.some(g=>inProg(g)&&hasTeam(g,teamFocus))) setTeam('');
      cur=allDates().includes(cur)?cur:defaultDate(); render(); };
    box.appendChild(b);
  });
}
function renderStrip(){
  const s=$('strip'); s.innerHTML='';
  const today=todayISO();
  allDates().forEach(d=>{
    const day=scoped().filter(g=>g.date===d), wd=new Date(d+'T12:00:00').getDay();
    const np=scopedPrac().filter(p=>p.date===d).length;
    const flag=day.some(g=>bad.has(g.id));
    const b=document.createElement('button'); b.className='chip'; b.setAttribute('aria-current',d===cur);
    b.innerHTML=`<b>${dlabel(d)}${d===today?' · today':''}</b>${day.length?day.length+' game'+(day.length===1?'':'s'):np?'':'permits only'}${np?(day.length?' · ':'')+np+' prac':''}`
      +(flag?'<span class="dot flag" title="A rule is broken on this date"></span>':(wd===6||wd===0?'<span class="dot"></span>':''));
    b.onclick=()=>{cur=d;sel=null;render();b.scrollIntoView({block:'nearest',inline:'center'});};
    s.appendChild(b);
  });
}
function divsInScope(){
  const seen=new Map();
  G.filter(inProg).forEach(g=>{ if(!seen.has(g.group)) seen.set(g.group,gmeta(g.group)); });
  const order=CFG.colors.map(c=>c[0]);
  const rank=m=>{const i=order.findIndex(re=>re.test(m.div));return i<0?99:i;};
  return [...seen.entries()].sort((a,b)=>CFG.programs.findIndex(p=>p.id===a[1].prog)-CFG.programs.findIndex(p=>p.id===b[1].prog)
    ||rank(a[1])-rank(b[1])||a[0].localeCompare(b[0]));
}
function renderFilters(){
  const f=$('filters'); f.innerHTML='';
  divsInScope().forEach(([grp,m])=>{
    const on=!hide.has(grp), b=document.createElement('button');
    b.className='f'; b.setAttribute('aria-pressed',on);
    const pn=prog==='ALL'?(CFG.programs.find(p=>p.id===m.prog)||{}).id+' ':'';
    b.title=(on?'Fade ':'Show ')+grp;
    b.innerHTML=`<i style="background:${m.color}"></i>${esc(pn+m.div)}`;
    b.onclick=()=>{on?hide.add(grp):hide.delete(grp);render();};
    f.appendChild(b);
  });
  const tl=$('teamList');
  tl.innerHTML=[...new Set(G.filter(inProg).flatMap(g=>[g.home,g.away]).filter(Boolean))].sort()
    .map(t=>`<option value="${esc(t)}">`).join('');
  $('teamFind').value=teamFocus; $('teamClear').hidden=!teamFocus;
  $('viewsel').value=view; $('fieldsel').value=fieldMode; $('showsel').value=showPrac?'all':'games';
  $('showsel').parentElement.hidden=!PRACS.length;
  [...$('fieldsel').options].forEach(o=>{ if(o.value==='permitted') o.hidden=!PERMITS.length; });
}

function lanesFor(date){
  const day=G.filter(g=>g.date===date), dp=pracShown().filter(p=>p.date===date&&inProgX(p)&&pracHit(p));
  let names;
  if(fieldMode==='all'){ names=new Set(G.filter(g=>inProg(g)).map(g=>g.loc));
    PERMITS.forEach(p=>{ if(inProgX(p)) names.add(p.field); }); pracShown().forEach(p=>{ if(inProgX(p)) names.add(p.field); }); }
  else { names=new Set(day.filter(g=>inProg(g)&&focusHit(g)).map(g=>g.loc)); dp.forEach(p=>names.add(p.field));
    if(fieldMode==='permitted'&&!teamFocus) PERMITS.forEach(p=>{ if(p.date===date&&inProgX(p)) names.add(p.field); }); }
  return [...names].sort((a,b)=>(noField(a)-noField(b))||a.localeCompare(b,undefined,{numeric:true}));
}

function renderGrid(){
  const g=$('grid'); g.innerHTML='';
  if(!G.length){ g.innerHTML=`<div class="empty"><b>No schedule loaded yet</b>
    Press <b style="display:inline;font-size:inherit">Import TeamLinkt</b> and choose the schedule export, or drop the file anywhere on this page.</div>`;
    $('dayName').textContent=''; $('dayMeta').textContent=''; return; }
  if(!cur){ g.innerHTML='<div class="empty"><b>Nothing scheduled</b>No games match this program and team.</div>';
    $('dayName').textContent=''; $('dayMeta').textContent=''; return; }
  const ss=sunset(cur), lanes=lanesFor(cur);
  const dayAll=G.filter(x=>x.date===cur&&lanes.includes(x.loc));
  const dayPrac=pracShown().filter(p=>p.date===cur&&lanes.includes(p.field));
  const mine=dayAll.filter(x=>inProg(x)), myPrac=dayPrac.filter(inProgX);
  $('dayName').textContent=dlabel(cur,{weekday:'long',month:'long',day:'numeric'});
  const other=dayAll.length-mine.length+dayPrac.length-myPrac.length;
  const openMin=lanes.filter(f=>FX.known.has(f)).reduce((m,f)=>m+openOn(cur,f).reduce((a,w)=>a+w.end-w.start,0),0);
  $('dayMeta').textContent=`sunset ${fmt(ss)} · ${mine.length} game${mine.length===1?'':'s'}`
    +(myPrac.length?` · ${myPrac.length} practice${myPrac.length===1?'':'s'}`:'')
    +` on ${lanes.length} field${lanes.length===1?'':'s'}`
    +(openMin?` · ${hrs(openMin)} of permitted time open`:'')
    +(other?` · ${other} from other programs on the same fields (faded)`:'');
  $('dayMeta').title=$('dayMeta').textContent;
  g.classList.toggle('aslist',view==='list');
  if(view==='list') return renderList(g,dayAll,ss,dayPrac);

  const timed=dayAll.filter(x=>!RU.noTime(x)).concat(dayPrac);
  lanes.forEach(f=>FX.windows(cur,f).forEach(w=>timed.push(w)));
  const lo=timed.map(x=>x.start), hi=timed.map(x=>x.end).concat([ss+CFG.sunsetGrace]);
  let t0=Math.floor((lo.length?Math.min(...lo):9*60)/60)*60-60, t1=Math.ceil(Math.max(...hi)/60)*60;
  if(fieldMode==='all') t0=Math.min(t0,9*60);
  t0=Math.max(0,t0); if(t1-t0<240) t0=Math.max(0,t1-240);
  const gw=window.innerWidth<=760?152:222;
  const room=(g.parentElement.clientWidth||1200)-gw-4;
  PX=Math.min(8,Math.max(1.55,room/(t1-t0)));
  const W=(t1-t0)*PX, x=m=>(m-t0)*PX;
  g.dataset.t0=t0;

  const axis=document.createElement('div'); axis.className='axis'; axis.innerHTML='<div class="gut"></div>';
  const at=document.createElement('div'); at.className='track'; at.style.width=W+'px';
  for(let m=Math.ceil(t0/60)*60;m<=t1;m+=60){ const k=document.createElement('span'); k.className='tick';
    k.style.left=x(m)+'px'; k.textContent=fmt(m).replace(':00',''); at.appendChild(k); }
  axis.appendChild(at); g.appendChild(axis);

  const parkCount={}; lanes.forEach(f=>{const p=park(f).park; parkCount[p]=(parkCount[p]||0)+1;});
  let lastPark=null;
  lanes.forEach(f=>{
    const pk=park(f), grouped=parkCount[pk.park]>1&&pk.sub;
    if(grouped&&pk.park!==lastPark){
      const ar=document.createElement('div'); ar.className='arow';
      ar.innerHTML=`<div class="gut">${esc(shortField(pk.park))}</div>`;
      const t2=document.createElement('div'); t2.className='track'; t2.style.width=W+'px'; ar.appendChild(t2); g.appendChild(ar);
    }
    lastPark=grouped?pk.park:null;
    const lit=isLit(f), here=dayAll.filter(x=>x.loc===f).sort((a,b)=>a.start-b.start);
    const pr=dayPrac.filter(p=>p.field===f);
    const lane=document.createElement('div'); lane.className='lane'; lane.dataset.field=f;
    const known=FX.known.has(f), wins=known?FX.windows(cur,f):[], opens=known?openOn(cur,f):[];
    const free=noField(f)||known||PERMITS.length?'':freeText(here.filter(x=>!RU.noTime(x)).concat(pr),t0,lit?t1:Math.min(t1,ss+CFG.sunsetGrace));
    const openTot=opens.reduce((a,w)=>a+w.end-w.start,0);
    const use=!known?'':!wins.length?'<b class="use n" title="No permit on file for this date">no permit</b>'
      :wins.some(w=>w.use==='Game')?'<b class="use g" title="Game permit">game</b>':'<b class="use p" title="Practice permit">prac</b>';
    const booked=[here.length?here.length+' game'+(here.length===1?'':'s'):'',pr.length?pr.length+' prac':''].filter(Boolean).join(', ')||'nothing booked';
    lane.innerHTML=`<div class="gut" title="${esc(f)}"><div class="g1"><button class="gname fl" data-f="${esc(f)}" title="${esc(f)} - permits, practices and open time">${esc(grouped?pk.sub:shortField(f))}</button>${use}${lit?'<b class="lit">lit</b>':''}`
      +(admin&&!noField(f)?`<button class="flipb" data-f="${esc(f)}" title="Lit fields are not held to sunset. Saved in this browser - add the field to litFields in js/config.js to make it permanent.">${lit?'unmark lit':'mark lit'}</button>`:'')
      +`</div><div class="g2"><em>${booked}${free?' · '+free:''}${openTot?' · '+hrs(openTot)+' open':''}</em></div></div>`;
    const tr=document.createElement('div'); tr.className='track'; tr.style.width=W+'px';
    /* permit hours: hatch what MCLL does not hold; open ground drawn as boxes */
    if(known){
      if(!wins.length){ const sh=document.createElement('div'); sh.className='shut nop'; sh.style.left='0'; sh.style.right='0';
        const n=FX.nearest(cur,f); sh.title='No permit on file for this date'+(n.prev?` - last one ${dlabel(n.prev)}`:'')+(n.next?`, next ${dlabel(n.next)}`:''); tr.appendChild(sh); }
      else { let c=t0; wins.concat([{start:t1,end:t1}]).forEach(w=>{ if(w.start>c){ const sh=document.createElement('div'); sh.className='shut';
          sh.style.left=x(c)+'px'; sh.style.width=(x(Math.min(w.start,t1))-x(c))+'px'; sh.title='Outside the permit'; tr.appendChild(sh); }
          c=Math.max(c,w.end); }); }
      opens.forEach(w=>{ const o=document.createElement('div'); o.className='open'+(w.use==='Practice'?' soft':'');
        o.style.left=x(w.start)+'px'; o.style.width=Math.max((w.end-w.start)*PX-2,20)+'px';
        o.innerHTML=`<b>open</b><small>${fmt(w.start)}–${fmt(w.end)}</small>`;
        o.title=`${f}\n${fmt(w.start)}–${fmt(w.end)} open (${w.end-w.start} min) on a ${w.use.toLowerCase()} permit`
          +(admin?'\nClick to add a game here':'\nClick for this field\'s permits');
        o.onclick=e=>{ e.stopPropagation(); admin?openEdit(null,seed(f,w,cur)):openField(f); };
        tr.appendChild(o); });
    }
    if(!lit){ const dusk=document.createElement('div'); dusk.className='dusk'; dusk.style.left=x(ss)+'px'; dusk.style.right='0'; tr.appendChild(dusk); }
    const sl=document.createElement('div'); sl.className='sunline'; sl.style.left=x(ss)+'px'; sl.title=`Sunset ${fmt(ss)}`; tr.appendChild(sl);
    if(admin&&!noField(f)){ tr.addEventListener('dblclick',e=>{ if(e.target!==tr) return;
      const m=Math.round((t0+(e.clientX-tr.getBoundingClientRect().left)/PX)/LANE_SNAP)*LANE_SNAP; openEdit(null,{loc:f,start:m}); }); }
    const rows=[], items=here.concat(pr).sort((a,b)=>a.start-b.start);
    here.forEach(gm=>{ const tbd=RU.noTime(gm); gm._s=tbd?t0:gm.start; gm._e=tbd?t0+100/PX:gm.end; });
    pr.forEach(p=>{ p._s=p.start; p._e=p.end; });
    items.forEach(gm=>{ let r=rows.findIndex(rw=>rw.every(o=>gm._s>=o._e||gm._e<=o._s));
      if(r<0){rows.push([gm]);r=rows.length-1;}else rows[r].push(gm); gm._row=r; });
    const nrow=Math.max(rows.length,1);
    if(nrow>1) tr.style.height=(nrow*30+8)+'px';
    here.forEach(gm=>{
      const m=gmeta(gm.group), el=document.createElement('div');
      const faded=hide.has(gm.group)||!focusHit(gm);
      el.className='blk'+(faded?' dim':'')+(!inProg(gm)?' other':'')+(sel===gm.id?' sel':'')
        +(isPending(gm)?' moved':'')+(bad.has(gm.id)?' bad':'')+(m.lite?' lite':'')
        +(meta.last&&meta.last.ids&&meta.last.ids.indexOf(gm.id)>=0?' fresh':'');
      el.style.left=x(gm._s)+'px'; el.style.width=Math.max((gm._e-gm._s)*PX-2,26)+'px';
      el.style.background=m.color; el.dataset.id=gm.id;
      if(nrow>1){ el.style.top=(4+gm._row*30)+'px'; el.style.bottom='auto'; el.style.height='28px'; el.classList.add('thin'); }
      el.innerHTML=`<div style="position:relative"><b>${esc(vs(gm))}</b><small>${RU.noTime(gm)?'time not set':esc(m.label)+' · '+fmt(gm.start)+'–'+fmt(gm.end)}</small></div>`;
      el.title=`${gm.group}\n${vsFull(gm)}\n${f} ${fmt(gm.start)}–${fmt(gm.end)}`+(gm.notes?`\n${gm.notes}`:'');
      if(!admin) el.style.cursor='pointer';
      el.addEventListener('pointerdown',e=>startDrag(e,gm));
      el.addEventListener('click',()=>{ if(!admin){ sel=gm.id; openInfo(gm); markSel(); } });
      tr.appendChild(el);
    });
    pr.forEach(p=>{
      const el=document.createElement('div');
      el.className='blk practice'+(/proj/i.test(p.status)?' proj':'')+(!inProgX(p)?' other':'')+(!pracHit(p)?' dim':'')+(sel===p.id?' sel':'');
      el.style.left=x(p._s)+'px'; el.style.width=Math.max((p._e-p._s)*PX-2,26)+'px'; el.dataset.id=p.id;
      if(nrow>1){ el.style.top=(4+p._row*30)+'px'; el.style.bottom='auto'; el.style.height='28px'; el.classList.add('thin'); }
      el.innerHTML=`<div style="position:relative"><b>${esc(shortTeam(p.team))} practice</b><small>${esc(p.div||'')} · ${fmt(p.start)}–${fmt(p.end)}</small></div>`;
      el.title=`Practice: ${p.team}\n${f} ${fmt(p.start)}–${fmt(p.end)}${p.status?'\n'+p.status:''}`;
      el.onclick=()=>{ sel=p.id; openPractice(p); markSel(); };
      tr.appendChild(el);
    });
    lane.appendChild(tr);
    if(nrow>1) lane.querySelector('.gut').style.minHeight=(nrow*30+8)+'px';
    g.appendChild(lane);
  });
  g.querySelectorAll('.flipb').forEach(b=>b.onclick=()=>{ const f=b.dataset.f; litLocal[f]=!isLit(f); save(); render(); });
  g.querySelectorAll('.gname.fl').forEach(b=>b.onclick=()=>openField(b.dataset.f));
}
function freeText(here,t0,t1){
  let c=t0, best=0; here.forEach(g=>{ best=Math.max(best,g.start-c); c=Math.max(c,g.end); });
  best=Math.max(best,t1-c);
  return best>=90?`up to ${Math.floor(best/30)/2} h free`:'';
}
function markSel(){ $('grid').querySelectorAll('.blk.sel,tr.sel').forEach(e=>e.classList.remove('sel'));
  const el=$('grid').querySelector(`[data-id="${sel}"]`); if(el) el.classList.add('sel'); }

function renderList(g,dayAll,ss,dayPrac){
  const rows=dayAll.concat((dayPrac||[]).map(p=>({...p,_p:1,loc:p.field}))).sort((a,b)=>a.start-b.start||a.loc.localeCompare(b.loc));
  let h='<table class="listv"><tr><th>Time</th><th>Game</th><th>Field</th><th>Division</th></tr>';
  rows.forEach(gm=>{ if(gm._p){ const faded=!inProgX(gm)||!pracHit(gm);
      h+=`<tr class="g prow${faded?' dimrow':''}" data-pid="${gm.id}"><td style="white-space:nowrap">${fmt(gm.start)}–${fmt(gm.end)}</td>
        <td><b>${esc(gm.team)}</b> practice${/proj/i.test(gm.status)?' <span class="note">projected</span>':''}<span class="mfield"><br>${esc(gm.loc)}</span></td>
        <td>${esc(gm.loc)}</td><td style="white-space:nowrap"><i class="sw" style="background:var(--d-prac)"></i>practice${gm.div?' · '+esc(gm.div):''}</td></tr>`; return; }
    const m=gmeta(gm.group), faded=hide.has(gm.group)||!focusHit(gm)||!inProg(gm);
    h+=`<tr class="g${bad.has(gm.id)?' bad':''}${faded?' dimrow':''}" data-id="${gm.id}">
      <td style="white-space:nowrap">${RU.noTime(gm)?'time not set':fmt(gm.start)+'–'+fmt(gm.end)}${!isLit(gm.loc)&&gm.end>ss+CFG.sunsetGrace?' <span class="note">after sunset</span>':''}</td>
      <td><b>${esc(gm.home)}</b>${gm.away?' v <b>'+esc(gm.away)+'</b>':''}${isPending(gm)?' <span class="note">changed here</span>':''}<span class="mfield"><br>${esc(gm.loc)} · ${esc(m.label)}</span>${gm.notes?`<br><span class="note">${esc(gm.notes)}</span>`:''}</td>
      <td>${esc(gm.loc)}</td><td style="white-space:nowrap"><i class="sw" style="background:${m.color}"></i>${esc(m.label)}</td></tr>`; });
  const open=[];
  lanesFor(cur).filter(f=>FX.known.has(f)).forEach(f=>openOn(cur,f).forEach(w=>open.push({f,w})));
  if(open.length){ h+=`<tr><th colspan="4" style="padding-top:10px">Open permitted time</th></tr>`;
    open.sort((a,b)=>a.w.start-b.w.start||a.f.localeCompare(b.f)).forEach(o=>{
      h+=`<tr class="orow" data-f="${esc(o.f)}" data-s="${o.w.start}" data-e="${o.w.end}"><td style="white-space:nowrap">${fmt(o.w.start)}–${fmt(o.w.end)}</td>
        <td><b>open</b> · ${o.w.end-o.w.start} min${admin?' <span class="note">click to add a game</span>':''}<span class="mfield"><br>${esc(o.f)}</span></td>
        <td>${esc(o.f)}</td><td style="white-space:nowrap">${o.w.use.toLowerCase()} permit</td></tr>`; }); }
  g.innerHTML=h+'</table>';
  g.querySelectorAll('tr.g:not(.prow)').forEach(tr=>tr.onclick=()=>{ const gm=G.find(x=>x.id===tr.dataset.id); sel=gm.id; admin?openEdit(gm):openInfo(gm); });
  g.querySelectorAll('tr.prow').forEach(tr=>tr.onclick=()=>openPractice(PRACS.find(p=>p.id===tr.dataset.pid)));
  g.querySelectorAll('tr.orow').forEach(tr=>tr.onclick=()=>admin?openEdit(null,seed(tr.dataset.f,{start:+tr.dataset.s,end:+tr.dataset.e},cur)):openField(tr.dataset.f));
}

/* ------------------------------------------------------------------- issues */
const issueKey=i=>i.id+'|'+String(i.t).replace(/\b\d{1,2}:\d{2}(am|pm)\b/gi,'#').replace(/\b\d+ min\b/g,'# min').replace(/\s+/g,' ').trim();
function runRules(){
  const byId=new Map(G.map(g=>[g.id,g]));
  ISSUES=RU.validate(G,{cfg:CFG,lit:isLit,programOf:progOf,fields:FX});
  ISSUES.forEach(i=>{ i.progs=new Set((i.ids||[]).map(id=>byId.get(id)).filter(Boolean).map(progOf)); });
  const live=ISSUES.filter(i=>!ignored.has(issueKey(i)));
  bad=new Set(live.filter(i=>i.lv==='bad').flatMap(i=>i.ids||[]));
  warned=new Set(live.flatMap(i=>i.ids||[]));
}
function groupIssues(list){
  const by=new Map();
  list.forEach(i=>{ const k=issueKey(i); if(!by.has(k)) by.set(k,{...i,all:[]}); by.get(k).all.push(i); });
  return [...by.values()];
}
function setIgnore(key,on){ on?ignored.add(key):ignored.delete(key); save(); render(); }
function jumpTo(date,id){
  const gm=G.find(x=>x.id===id);
  if(gm&&!inProg(gm)) prog='ALL';
  if(gm&&!focusHit(gm)) setTeam('');
  if(gm) hide.delete(gm.group);
  cur=date||(gm&&gm.date)||cur; sel=id||null; render(); window.scrollTo({top:0,behavior:'smooth'});
}
function renderIssues(){
  const scope=ISSUES.filter(i=>prog==='ALL'||i.progs.has(prog))
    .filter(i=>!teamFocus||(i.ids||[]).some(id=>{const gm=G.find(x=>x.id===id);return gm&&hasTeam(gm,teamFocus);}));
  const iss=groupIssues(scope.filter(i=>!ignored.has(issueKey(i))));
  const hid=groupIssues(scope.filter(i=>ignored.has(issueKey(i))));
  const nb=iss.filter(i=>i.lv==='bad').length, tag=$('issueN');
  tag.textContent=String(iss.length); tag.className='n'+(nb?' bad':iss.length?' warn':'');
  const box=$('issues'); box.innerHTML='';
  if(!iss.length) box.innerHTML=`<p class="clean">All ${RU.RULES.length} rules hold across ${G.filter(inProg).length} games.</p>`;
  iss.forEach(i=>{
    const d=document.createElement('div'); d.className='issue'; const n=i.all.length;
    const first=(i.ids||[])[0]||'';
    const more=n>1?`<button class="more">${n} dates</button>`
      :`<button class="jump" data-d="${i.date||''}" data-i="${first}">${i.date?dlabel(i.date):'show'}</button>`;
    d.innerHTML=`<span class="tag ${i.lv}">${i.lv==='bad'?'breaks':'check'}</span>
      <span>${esc(i.t)} ${more}<span class="dlist" hidden>${i.all.map(x=>
        `<button class="jump" data-d="${x.date||''}" data-i="${(x.ids||[])[0]||''}">${x.date?dlabel(x.date):'show'}</button>`).join(' ')}</span></span>
      <span><button class="btn ghost ig" title="Seen it, living with it - moves to the Ignored tab">Ignore</button></span>`;
    d.querySelectorAll('.jump').forEach(b=>b.onclick=()=>jumpTo(b.dataset.d,b.dataset.i));
    const mb=d.querySelector('.more'); if(mb) mb.onclick=()=>{const l=d.querySelector('.dlist');l.hidden=!l.hidden;};
    d.querySelector('.ig').onclick=()=>setIgnore(issueKey(i),true);
    box.appendChild(d);
  });
  const rb=$('rules'); rb.innerHTML='';
  RU.RULES.forEach(r=>{ const n=iss.filter(i=>i.id===r.id).length, d=document.createElement('div'); d.className='rule';
    d.innerHTML=`<span><b>${r.name}</b><em>${r.why}</em></span><span class="n2 ${n?r.lv:''}">${n?`${n} flagged`:'clear'}</span>`; rb.appendChild(d); });
  const ib=$('ign'); ib.innerHTML='';
  if(!hid.length) ib.innerHTML='<p class="note">Nothing ignored. Use the Ignore button on an issue to park it here. The list is kept in this browser.</p>';
  hid.forEach(i=>{ const d=document.createElement('div'); d.className='issue';
    d.innerHTML=`<span class="tag ${i.lv}">${i.lv==='bad'?'breaks':'check'}</span><span>${esc(i.t)}${i.all.length>1?` <em class="note">${i.all.length} dates</em>`:''}</span>
      <span><button class="btn ghost un">Restore</button></span>`;
    d.querySelector('.un').onclick=()=>setIgnore(issueKey(i),false); ib.appendChild(d); });
  renderChanges();
  $('tabIgn').textContent=hid.length?`Ignored (${hid.length})`:'Ignored';
  [['issues','tabIssues'],['rules','tabRules'],['hist','tabHist'],['ign','tabIgn']].forEach(([p,t])=>{
    $(p).hidden=panel!==p; $(t).setAttribute('aria-pressed',panel===p); });
}
const describe=(k,g)=>k==='date'?dlabel(g.date):k==='start'||k==='end'?fmt(g[k]):(g[k]||'blank');
function changeLine(was,now,fields){
  return fields.map(k=>`${TL.fieldLabel(k)} <s>${esc(describe(k,was))}</s> → <u>${esc(describe(k,now))}</u>`).join(' · ');
}
const isPending=g=>_pend.has(g.id); let _pend=new Set();
function renderChanges(){
  const p=pending(), box=$('hist'); box.innerHTML='';
  $('tabHist').textContent=p.length?`Changes (${p.length})`:'Changes';
  const last=meta.last;
  let h='';
  if(!p.length) h+='<p class="clean">This browser matches the TeamLinkt schedule - no changes waiting.</p>';
  else h+=`<p class="note" style="margin:0 0 8px">Made here and <b>not in TeamLinkt yet</b>. Enter them in TeamLinkt, then import the new export and they clear by themselves.
    <button class="btn ghost" id="chgExport">Download this list</button></p>`;
  box.innerHTML=h;
  p.forEach(c=>{ const d=document.createElement('div'); d.className='issue'; const g=c.game;
    const what=c.kind==='add'?`<b>Add</b> ${esc(vsFull(g))} — ${dlabel(g.date)} ${fmt(g.start)}, ${esc(g.loc)}`
      :c.kind==='remove'?`<b>Remove</b> ${esc(vsFull(g))} — ${dlabel(g.date)} ${fmt(g.start)}, ${esc(g.loc)}`
      :`<b>${esc(vsFull(c.was))}</b> (${dlabel(c.was.date)})<br><span class="chg">${changeLine(c.was,g,c.fields)}</span>`;
    d.innerHTML=`<span class="tag warn">${c.kind}</span><span>${what} ${c.kind!=='remove'?`<button class="jump">show</button>`:''}</span>
      <span><button class="btn ghost un">Undo</button></span>`;
    const j=d.querySelector('.jump'); if(j) j.onclick=()=>jumpTo(g.date,g.id);
    d.querySelector('.un').onclick=()=>{ if(c.kind==='add') G=G.filter(x=>x.id!==g.id);
      else if(c.kind==='remove') G.push({...c.was}); else Object.assign(G.find(x=>x.id===g.id),c.was);
      commit(); };
    box.appendChild(d); });
  if(last){ const n=document.createElement('p'); n.className='note';
    n.innerHTML=`Last import: <b>${esc(last.name||'TeamLinkt export')}</b>, ${esc(last.when)} — ${esc(last.summary)}.`
      +(last.ids&&last.ids.length?' Games it touched carry a dashed yellow outline. <button class="btn ghost" id="clrFresh">Clear the outlines</button>':'');
    box.appendChild(n); }
  if($('chgExport')) $('chgExport').onclick=exportChanges;
  if($('clrFresh')) $('clrFresh').onclick=()=>{ meta.last.ids=[]; save(); render(); };
}
function renderCounts(){
  const c=RU.counts(G), box=$('counts'); let off=0;
  const offIds=new Set(ISSUES.filter(i=>i.id==='count'&&!ignored.has(issueKey(i))).map(i=>i.t.split(' has ')[0]));
  let h='<table><tr><th>Team</th><th class="num">Games</th><th class="num">Home</th><th class="num">Away</th></tr>';
  divsInScope().forEach(([grp,m])=>{ const teams=c[grp]; if(!teams) return;
    h+=`<tr><th colspan="4" style="padding-top:7px"><i class="sw" style="display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;background:${m.color}"></i>${esc((prog==='ALL'?m.prog+' ':'')+m.label)}</th></tr>`;
    Object.keys(teams).sort().forEach(t=>{ const x=teams[t], o=offIds.has(t); if(o) off++;
      h+=`<tr class="${o?'off':''}"><td><button class="tlink" data-t="${esc(t)}" title="${esc(t)}">${esc(shortTeam(t))}</button>${x.guest?' <span class="note">guest</span>':''}</td>
        <td class="num">${x.n}</td><td class="num">${x.h}</td><td class="num">${x.a}</td></tr>`; }); });
  box.innerHTML=h+'</table>';
  box.querySelectorAll('.tlink').forEach(b=>b.onclick=()=>openTeam(b.dataset.t));
  const tag=$('offN'); tag.textContent=off?`${off} uneven`:'even'; tag.className='n'+(off?' warn':'');
}
function renderHead(){
  const p=pending().length, b=$('pushBtn');
  b.style.display=p?'':'none'; b.textContent=`${p} change${p===1?'':'s'} not in TeamLinkt`; b.className='hbtn solid warnb';
  $('reset').style.display=admin&&p?'':'none'; $('addBtn').style.display=admin?'':'none';
  $('modeBadge').textContent=admin?'Editing':'View only'; $('modeBadge').className='mode'+(admin?' admin':'');
  $('modeBtn').textContent=admin?'Done':'Edit';
  $('title').textContent=CFG.title;
  $('src').textContent=`${CFG.season} · ${meta.src||'no schedule loaded'}${meta.when?' · '+meta.when:''}`;
  $('src').title=$('src').textContent;
  $('reloadBtn').style.display=location.protocol==='file:'?'none':'';
  const ban=$('banner'), msgs=[];
  if(REPO&&G.length&&TL.diff(BASE,REPO).same.length!==Math.max(BASE.length,REPO.length))
    msgs.push(`This browser holds a newer TeamLinkt import than the website. Other people still see the old one. <button id="banPub">Download schedule.csv</button> then upload it to the <b>data</b> folder on GitHub.`);
  ['permits','practices'].forEach(k=>{ const r=RAW[k]; if(!r||!r.local) return;
    msgs.push(`This browser is using ${KIND[k].label} imported from <b>${esc(r.name)}</b> (${esc(r.when||'')}), which are not on the website. <button data-dl="${k}">Download ${KIND[k].file}</button> then upload it to the <b>data</b> folder on GitHub, or <button data-drop="${k}">go back to the published ${KIND[k].label}</button>.`); });
  if(FPROB.permits.length||FPROB.practices.length) msgs.push(`Some rows of the ${FPROB.permits.length?'permit':'practice'} file could not be read. <button id="banProb">See which</button>`);
  ban.hidden=!msgs.length; ban.innerHTML=msgs.map(m=>`<div>${m}</div>`).join('');
  if($('banPub')) $('banPub').onclick=()=>download('schedule.csv',TL.serialize(BASE));
  ban.querySelectorAll('[data-dl]').forEach(b=>b.onclick=()=>download(KIND[b.dataset.dl].file,RAW[b.dataset.dl].text));
  ban.querySelectorAll('[data-drop]').forEach(b=>b.onclick=()=>dropLocal(b.dataset.drop));
  if($('banProb')) $('banProb').onclick=()=>{ showModal('Rows that could not be read','data/permits.csv and data/practices.csv',
    `<div class="pre">${FPROB.permits.concat(FPROB.practices).map(esc).join('<br>')}</div>`,'<button class="btn ghost" id="mClose">Close</button>'); $('mClose').onclick=closeModal; };
}
let _fkey='';
function ensureFields(){
  const k=[RAW.permits?RAW.permits.sig||RAW.permits.text.length:0,RAW.practices?RAW.practices.sig||RAW.practices.text.length:0,hash(locations().join('|'))].join('/');
  if(k!==_fkey){ _fkey=k; rebuildFields(); }
}
function render(){
  ensureFields();
  _pend=new Set(pending().filter(c=>c.kind!=='remove').map(c=>c.game.id));
  runRules();
  const ds=allDates(); if(!cur||!ds.includes(cur)) cur=ds.includes(cur)?cur:defaultDate();
  renderHead(); renderProgs(); renderStrip(); renderFilters(); renderGrid(); renderIssues(); renderCounts();
  $('hint').textContent=!G.length?'':admin
    ?'Drag a game sideways to change the time, or up and down to change field. Click a game to edit it; double-click empty ground to add one. Changes stay in this browser until they are entered in TeamLinkt.'
    :'Click any game for its details. Red outline = breaks a rule. Anything past the dashed line is after sunset. Press Edit to try out a move.';
  const i=ds.indexOf(cur); $('prevDay').disabled=i<=0; $('nextDay').disabled=i<0||i>=ds.length-1;
  $('todayBtn').hidden=!cur||cur===defaultDate();
  writeHash();
  const on=$('strip').querySelector('[aria-current="true"]'); if(on&&!render._once){ render._once=1; on.scrollIntoView({block:'nearest',inline:'center'}); }
}
function commit(){ save(); render(); }

/* -------------------------------------------------------------------- drag */
function startDrag(e,gm){
  if(e.button!==0||!admin) return;
  e.preventDefault();
  const el=e.currentTarget, lanes=[...$('grid').querySelectorAll('.lane')];
  const x0=e.clientX,y0=e.clientY,s0=gm.start; let moved=false;
  const move=ev=>{ const dx=ev.clientX-x0,dy=ev.clientY-y0;
    if(Math.abs(dx)>3||Math.abs(dy)>3) moved=true;
    el.style.transform=`translate(${dx}px,${dy}px)`; el.style.zIndex=9; };
  const up=ev=>{
    window.removeEventListener('pointermove',move,true); window.removeEventListener('pointerup',up,true); window.removeEventListener('pointercancel',up,true);
    el.style.transform=''; el.style.zIndex='';
    if(!moved){ sel=gm.id; markSel(); openEdit(gm); return; }
    const ns=Math.max(0,Math.round((s0+(ev.clientX-x0)/PX)/LANE_SNAP)*LANE_SNAP);
    const lane=lanes.find(l=>{const r=l.getBoundingClientRect();return ev.clientY>=r.top&&ev.clientY<=r.bottom;});
    const dur=gm.end-gm.start; gm.start=ns; gm.end=ns+dur; if(lane) gm.loc=lane.dataset.field;
    sel=gm.id; commit();
    const nw=$('grid').querySelector(`[data-id="${gm.id}"]`); if(nw) nw.classList.add('settle'); };
  window.addEventListener('pointermove',move,true); window.addEventListener('pointerup',up,true); window.addEventListener('pointercancel',up,true);
}

/* ---------------------------------------------------------- drawer + modal */
const drawer=$('drawer'), modal=$('modal');
const closeDrawer=()=>{drawer.classList.remove('on');drawer.setAttribute('aria-hidden','true');};
const openDrawer=()=>{drawer.classList.add('on');drawer.setAttribute('aria-hidden','false');};
const closeModal=()=>modal.classList.remove('on');
function showModal(title,sub,body,foot){ $('mTitle').textContent=title; $('mSub').textContent=sub;
  $('mBody').innerHTML=body; $('mFoot').innerHTML=foot; modal.classList.add('on'); }
modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});

function openInfo(gm){
  const ss=sunset(gm.date), lit=isLit(gm.loc), was=BASE.find(b=>b.id===gm.id);
  const flags=ISSUES.filter(i=>(i.ids||[]).includes(gm.id)&&!ignored.has(issueKey(i)));
  const others=G.filter(g=>g.date===gm.date&&g.loc===gm.loc&&g.id!==gm.id&&!noField(g.loc)).sort((a,b)=>a.start-b.start);
  const chg=was?TL.fieldsChanged(was,gm):[];
  $('dTitle').textContent=vs(gm); $('dSub').textContent=`${gmeta(gm.group).label} · ${dlabel(gm.date)}`;
  $('dBody').innerHTML=(flags.length?`<div class="pre"><b>Rule check</b><ul>${flags.map(i=>`<li>${esc(i.t)}</li>`).join('')}</ul></div>`:'')
    +(!was?'<div class="pre ok"><b>Added here.</b> Not in TeamLinkt yet.</div>':chg.length?`<div class="pre ok"><b>Changed here, not in TeamLinkt yet.</b><br>${changeLine(was,gm,chg)}</div>`:'')
    +`<dl class="pdl"><dt>Time</dt><dd>${fmt(gm.start)}–${fmt(gm.end)} (${gm.end-gm.start} min)</dd>
    <dt>Home</dt><dd><button class="tlink" data-t="${esc(gm.home)}">${esc(gm.home)}</button></dd>
    ${gm.away?`<dt>Away</dt><dd><button class="tlink" data-t="${esc(gm.away)}">${esc(gm.away)}</button></dd>`:''}
    <dt>Field</dt><dd>${esc(gm.loc)}${lit?' <b class="lit">lit</b>':''}</dd>
    <dt>Group</dt><dd>${esc(gm.group||'none in TeamLinkt')}</dd>
    <dt>Sunset</dt><dd>${fmt(ss)}${lit?' <span class="note">— lit, so it does not cap the field</span>':(gm.end>ss?' <span class="note">— this game runs past it</span>':'')}</dd>
    ${gm.notes?`<dt>Notes</dt><dd>${esc(gm.notes)}</dd>`:''}
    ${others.length?`<dt>Also here</dt><dd>${others.map(o=>`${fmt(o.start)} ${esc(vs(o))}`).join('<br>')}</dd>`:''}</dl>`;
  $('dFoot').innerHTML=(admin?'<button class="btn" id="giEdit">Edit</button>':'')+'<button class="btn ghost" id="dCancel">Close</button>';
  if($('giEdit')) $('giEdit').onclick=()=>openEdit(gm);
  $('dBody').querySelectorAll('.tlink').forEach(b=>b.onclick=()=>{closeDrawer();openTeam(b.dataset.t);});
  $('dCancel').onclick=closeDrawer; openDrawer();
}

/* a field: what MCLL holds there today, what is booked, and what is left */
function openField(f,date){
  date=date||cur;
  const lit=isLit(f), wins=FX.windows(date,f), known=FX.known.has(f);
  const games=G.filter(g=>g.date===date&&g.loc===f).sort((a,b)=>a.start-b.start);
  const pr=PRACS.filter(p=>p.date===date&&p.field===f).sort((a,b)=>a.start-b.start);
  const opens=known?openOn(date,f):[], n=FX.nearest(date,f);
  const dates=new Set(PERMITS.filter(p=>p.field===f).map(p=>p.date));
  const row=w=>w.rows.map(p=>`${fmt(p.start)}–${fmt(p.end)} · <b>${p.use.toLowerCase()} permit</b>`
    +(p.permit?` · reservation ${esc(p.permit)}`:'')+(p.receipt?` · receipt ${esc(p.receipt)}`:'')
    +(p.pname?`<br><span class="note">${esc(p.pname)}</span>`:'')+(p.notes?`<br><span class="note">${esc(p.notes)}</span>`:'')).join('<br>');
  $('dTitle').textContent=f; $('dSub').textContent=dlabel(date,{weekday:'long',month:'short',day:'numeric'})+(lit?' · lit':'');
  $('dBody').innerHTML=`<dl class="pdl">
    <dt>Permit</dt><dd>${!known?'No permits on file for this field.':wins.length?wins.map(row).join('<br>')
      :`None on file for this date — anything booked here is unpermitted.${n.prev?`<br><span class="note">Last permit ${dlabel(n.prev)}${n.next?`, next ${dlabel(n.next)}`:''}</span>`:n.next?`<br><span class="note">Next permit ${dlabel(n.next)}</span>`:''}`}</dd>
    ${known?`<dt>Open</dt><dd>${opens.length?opens.map(w=>`${fmt(w.start)}–${fmt(w.end)} <span class="note">${w.end-w.start} min${w.use==='Practice'?', practice permit':''}</span>`
      +(admin?` <button class="btn ghost addhere" data-s="${w.start}" data-e="${w.end}">Add game</button>`:'')).join('<br>'):'Nothing — the permit is fully booked.'}
      ${!lit&&wins.length?`<br><span class="note">Not lit, so open time stops ${CFG.sunsetGrace} min after sunset (${fmt(sunset(date))}).</span>`:''}</dd>`:''}
    <dt>Games</dt><dd>${games.length?games.map(g=>`${fmt(g.start)}–${fmt(g.end)} ${esc(vs(g))}`).join('<br>'):'None'}</dd>
    <dt>Practices</dt><dd>${pr.length?pr.map(p=>`${fmt(p.start)}–${fmt(p.end)} ${esc(p.team)}${/proj/i.test(p.status)?' <span class="note">projected</span>':''}`).join('<br>'):'None'}</dd>
    ${known?`<dt>Season</dt><dd>${dates.size} permitted date${dates.size===1?'':'s'}, ${dlabel([...dates].sort()[0])} – ${dlabel([...dates].sort().pop())}</dd>`:''}</dl>`;
  $('dFoot').innerHTML=(known?'<button class="btn" id="fdFind">Open time on this field</button>':'')+'<button class="btn ghost" id="dCancel">Close</button>';
  if($('fdFind')) $('fdFind').onclick=()=>{ closeDrawer(); openOpen({field:f}); };
  $('dBody').querySelectorAll('.addhere').forEach(b=>b.onclick=()=>openEdit(null,seed(f,{start:+b.dataset.s,end:+b.dataset.e},date)));
  $('dCancel').onclick=closeDrawer; openDrawer();
}
function openPractice(p){
  if(!p) return;
  const games=G.filter(g=>g.date===p.date&&g.loc===p.field&&g.start<p.end&&g.end>p.start);
  const w=FX.windows(p.date,p.field);
  $('dTitle').textContent=`${shortTeam(p.team)} practice`; $('dSub').textContent=`${p.div||'Practice'} · ${dlabel(p.date)}`;
  $('dBody').innerHTML=(games.length?`<div class="pre"><b>A game is on this field at the same time</b><ul>${games.map(g=>`<li>${fmt(g.start)} ${esc(vsFull(g))}</li>`).join('')}</ul></div>`:'')
    +`<dl class="pdl"><dt>Time</dt><dd>${fmt(p.start)}–${fmt(p.end)} (${p.end-p.start} min)</dd>
    <dt>Team</dt><dd><button class="tlink" data-t="${esc(p.team)}">${esc(p.team)}</button></dd>
    ${p.coach?`<dt>Coach</dt><dd>${esc(p.coach)}</dd>`:''}
    <dt>Field</dt><dd><button class="tlink fl" data-f="${esc(p.field)}">${esc(p.field)}</button>${isLit(p.field)?' <b class="lit">lit</b>':''}</dd>
    <dt>Permit</dt><dd>${w.length?w.map(x=>`${fmt(x.start)}–${fmt(x.end)} ${x.use.toLowerCase()} permit`).join('<br>'):FX.known.has(p.field)?'None on file for this date':'No permits on file for this field'}${p.permit?` · reservation ${esc(p.permit)}`:''}</dd>
    ${p.status?`<dt>Status</dt><dd>${esc(p.status)}${/proj/i.test(p.status)?' <span class="note">— carried forward from the team\'s standing slot, not on a receipt</span>':''}</dd>`:''}</dl>
    <p class="note">Practices come from data/practices.csv (the practice draft). Change them there, not here.</p>`;
  $('dFoot').innerHTML='<button class="btn ghost" id="dCancel">Close</button>';
  $('dBody').querySelectorAll('.tlink:not(.fl)').forEach(b=>b.onclick=()=>{closeDrawer();openTeam(b.dataset.t);});
  $('dBody').querySelectorAll('.tlink.fl').forEach(b=>b.onclick=()=>openField(b.dataset.f,p.date));
  $('dCancel').onclick=closeDrawer; openDrawer();
}

function openEdit(gm,seed){
  const isNew=!gm;
  const groups=[...new Set(G.map(g=>g.group).filter(Boolean))].sort();
  const firstGroup=(divsInScope()[0]||[groups[0]])[0];
  const g0=gm||Object.assign({date:cur||todayISO(),start:10*60,loc:'',group:firstGroup,home:'',away:'',notes:'',type:'Game'},seed||{});
  if(isNew&&!g0.end) g0.end=g0.start+120;
  const fields=[...new Set(G.map(g=>g.loc).concat([...FX.known]))].sort();
  $('dTitle').textContent=isNew?'Add a game':vs(gm);
  $('dSub').textContent=isNew?'Stays in this browser until it is entered in TeamLinkt':`${gmeta(gm.group).label} · ${dlabel(gm.date)}`;
  $('dBody').innerHTML=`
    <div class="row"><label for="eGroup">Division</label><select id="eGroup">${groups.map(x=>`<option${x===g0.group?' selected':''}>${esc(x)}</option>`).join('')}</select></div>
    <div class="row"><label for="eHome">Home</label><select id="eHome"></select></div>
    <div class="row"><label for="eAway">Away</label><select id="eAway"></select></div>
    <div class="row"><label for="eDate">Date</label><input id="eDate" type="date" value="${g0.date}"></div>
    <div class="row two"><span><label for="eStart">First pitch</label><input id="eStart" type="time" step="900" value="${hhmm(g0.start)}"></span>
      <span><label for="eLen">Length (min)</label><input id="eLen" type="number" min="30" max="240" step="15" value="${g0.end-g0.start}"></span></div>
    <div class="row"><label for="eField">Field</label><input id="eField" list="eFields" value="${esc(g0.loc)}" placeholder="start typing a field">
      <datalist id="eFields">${fields.map(f=>`<option value="${esc(f)}">`).join('')}</datalist></div>
    <div class="row"><label for="eNotes">Notes</label><input id="eNotes" value="${esc(g0.notes||'')}"></div>
    <div id="ePre"></div>`;
  $('dFoot').innerHTML=`<button class="btn" id="eOk">${isNew?'Add game':'Save'}</button>${isNew?'':'<button class="btn danger" id="eDel">Remove</button>'}<button class="btn ghost" id="dCancel">Cancel</button>`;
  const fill=()=>{ const grp=$('eGroup').value;
    const ts=[...new Set(G.filter(g=>g.group===grp).flatMap(g=>[g.home,g.away]).concat([g0.home,g0.away]).filter(Boolean))].sort();
    [['eHome',g0.home],['eAway',g0.away]].forEach(([id,v],i)=>{ const s=$(id), k=s.value||v;
      s.innerHTML=ts.map(t=>`<option>${esc(t)}</option>`).join(''); s.value=ts.includes(k)?k:(ts[i]||''); }); upd(); };
  const read=()=>{ const st=TL.toMin($('eStart').value)||0, L=Number($('eLen').value)||120;
    return {date:$('eDate').value,start:st,end:st+L,loc:$('eField').value.trim()||'TBA',group:$('eGroup').value,
      home:$('eHome').value,away:$('eAway').value,notes:$('eNotes').value.trim(),type:g0.type||'Game'}; };
  const upd=()=>{ const v=read(), id=gm?gm.id:'__new', msgs=[];
    if(v.home&&v.home===v.away) msgs.push('A team cannot play itself.');
    const trial=G.filter(g=>g.id!==id).concat([{...v,id}]);
    RU.validate(trial,{cfg:CFG,lit:isLit,programOf:progOf,fields:FX}).filter(i=>(i.ids||[]).includes(id)&&i.id!=='count').forEach(i=>msgs.push(i.t));
    const ow=FX.known.has(v.loc)?openOn(v.date,v.loc,{games:G.filter(g=>g.date===v.date&&g.id!==id&&!RU.noTime(g))}):[];
    const owTxt=FX.known.has(v.loc)?`<p class="note" style="margin:6px 0 0">Open on ${esc(v.loc)} that day: ${ow.length?ow.map(w=>`${fmt(w.start)}–${fmt(w.end)}`).join(', '):'nothing'}.</p>`:'';
    $('ePre').innerHTML=owTxt+(msgs.length?`<div class="pre"><b>Before you save</b><ul>${msgs.map(m=>`<li>${esc(m)}</li>`).join('')}</ul></div>`
      :`<div class="pre ok">No conflicts — ${fmt(v.start)}–${fmt(v.end)} at ${esc(v.loc)}.</div>`);
    $('eOk').disabled=!v.date||v.home===v.away; };
  $('eGroup').onchange=fill;
  ['eHome','eAway','eDate','eStart','eLen','eField'].forEach(id=>$(id).oninput=upd);
  $('eOk').onclick=()=>{ const v=read();
    if(isNew){ const id='n'+Date.now(); G.push({...v,id}); sel=id; } else { Object.assign(gm,v); delete gm.groupGuess; sel=gm.id; }
    cur=v.date; if(!inProg({group:v.group})) prog='ALL'; closeDrawer(); commit(); };
  if($('eDel')) $('eDel').onclick=()=>{ G=G.filter(g=>g.id!==gm.id); sel=null; closeDrawer(); commit(); };
  $('dCancel').onclick=closeDrawer; fill(); openDrawer();
}

/* ------------------------------------------------------------ team schedule */
function setTeam(t){ teamFocus=t||''; }
function openTeam(t){
  const teams=[...new Set(G.flatMap(g=>[g.home,g.away]).filter(Boolean))].sort();
  if(!t) t=teamFocus||teams.find(x=>G.some(g=>inProg(g)&&hasTeam(g,x)))||teams[0];
  const draw=()=>{
    const list=G.filter(g=>hasTeam(g,t)).concat(PRACS.filter(p=>p.team===t).map(p=>({...p,_p:1,loc:p.field})))
      .sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start);
    const today=todayISO(), np=list.filter(g=>g._p).length;
    $('tsOut').innerHTML=`<table class="listv"><tr><th>Date</th><th>Time</th><th></th><th>Opponent</th><th>Field</th></tr>`
      +list.map(g=>g._p?`<tr class="g prow${g.date<today?' dimrow':''}" data-d="${g.date}"><td style="white-space:nowrap">${dlabel(g.date)}</td><td style="white-space:nowrap">${fmt(g.start)}</td>
        <td colspan="2"><span class="note">practice${/proj/i.test(g.status)?' (projected)':''}</span></td><td>${esc(g.loc)}</td></tr>`
        :`<tr class="g${g.date<today?' dimrow':''}" data-id="${g.id}"><td style="white-space:nowrap">${dlabel(g.date)}</td><td style="white-space:nowrap">${fmt(g.start)}</td>
        <td>${g.home===t?'home':'away'}</td><td>${esc(g.home===t?g.away:g.home)}</td><td>${esc(g.loc)}${isPending(g)?' <span class="note">changed here</span>':''}</td></tr>`).join('')+'</table>'
      +`<p class="note">${list.length-np} games · ${list.filter(g=>!g._p&&g.home===t).length} home, ${list.filter(g=>!g._p&&g.away===t).length} away${np?` · ${np} practices`:''}. Click a row to see that day.</p>`;
    $('tsOut').querySelectorAll('tr.g:not(.prow)').forEach(tr=>tr.onclick=()=>{ closeModal(); jumpTo(null,tr.dataset.id); });
    $('tsOut').querySelectorAll('tr.prow').forEach(tr=>tr.onclick=()=>{ closeModal(); if(!showPrac) showPrac=true; jumpTo(tr.dataset.d,null); });
  };
  showModal('Team schedule','Every game for one team, across all programs',
    `<div class="row"><label for="tsSel">Team</label><select id="tsSel">${teams.map(x=>`<option${x===t?' selected':''}>${esc(x)}</option>`).join('')}</select></div><div id="tsOut"></div>`,
    '<button class="btn" id="tsFocus">Show only this team on the timeline</button><button class="btn ghost" id="tsCsv">CSV</button><button class="btn ghost" id="tsIcs">Calendar file (.ics)</button><button class="btn ghost" id="mClose">Close</button>');
  $('tsSel').onchange=()=>{t=$('tsSel').value;draw();};
  $('tsFocus').onclick=()=>{ setTeam(t); if(!G.some(g=>inProg(g)&&hasTeam(g,t))) prog='ALL'; cur=null; closeModal(); render(); };
  $('tsCsv').onclick=()=>download(safe(t)+'.csv',TL.serialize(G.filter(g=>hasTeam(g,t))));
  $('tsIcs').onclick=()=>download(safe(t)+'.ics',ics(G.filter(g=>hasTeam(g,t)),t),'text/calendar');
  $('mClose').onclick=closeModal; draw();
}
const safe=s=>String(s).replace(/[^\w]+/g,'_').replace(/^_|_$/g,'');
function ics(list,name){
  const st=(d,m)=>d.replace(/-/g,'')+'T'+hhmm(m).replace(':','')+'00';
  const e=s=>String(s).replace(/([,;\\])/g,'\\$1');
  const out=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MCLL//schedule console//EN','X-WR-CALNAME:'+e(name)];
  list.forEach(g=>out.push('BEGIN:VEVENT','UID:'+safe([g.group,g.home,g.away,g.date].join('|'))+'@mcll-schedule',
    'DTSTART;TZID=America/New_York:'+st(g.date,g.start),'DTEND;TZID=America/New_York:'+st(g.date,g.end),
    'SUMMARY:'+e(vsFull(g)),'LOCATION:'+e(g.loc),'END:VEVENT'));
  out.push('END:VCALENDAR'); return out.join('\r\n');
}
function download(name,text,mime){
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:mime||'text/csv'}));
  a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);
}

/* ------------------------------------------------------------------- export */
function exportChanges(){
  const rows=pending().map(c=>({...c.game,_c:c}));
  download('changes_for_teamlinkt.csv',TL.serialize(rows,{head:['Change','Was'],row:g=>{const c=g._c;
    return [c.kind,c.kind==='change'?c.fields.map(k=>`${TL.fieldLabel(k)}: ${describe(k,c.was)}`).join('; '):''];}}));
}
function openExport(){
  const divs=divsInScope();
  showModal('Export','Files are in TeamLinkt’s own schedule format',
    `<div class="row"><label for="xWhat">Which schedule</label><select id="xWhat">
        <option value="base">As TeamLinkt has it (this is the file the website publishes)</option>
        <option value="work">With the changes made in this browser</option></select></div>
     <div class="row"><label for="xScope">How much</label><select id="xScope"><option value="ALL">Everything</option>
        ${CFG.programs.map(p=>`<option value="P:${p.id}">${esc(p.name)}</option>`).join('')}
        ${divs.map(([grp])=>`<option value="G:${esc(grp)}">${esc(grp)}</option>`).join('')}</select></div>
     <p class="note">To publish: export <b>Everything</b> “as TeamLinkt has it”, keep the name <b>schedule.csv</b>, and upload it to the <b>data</b> folder on GitHub. A raw TeamLinkt export renamed to schedule.csv works just as well.</p>`,
    '<button class="btn" id="xGo">Download</button><button class="btn ghost" id="xChg">Change list only</button><button class="btn ghost" id="mClose">Close</button>');
  $('xGo').onclick=()=>{ const src=$('xWhat').value==='base'?BASE:G, sc=$('xScope').value;
    const list=src.filter(g=>sc==='ALL'||(sc[0]==='P'?progOf(g)===sc.slice(2):g.group===sc.slice(2)));
    download(sc==='ALL'?'schedule.csv':safe(sc.slice(2))+'.csv',TL.serialize(list)); };
  $('xChg').onclick=exportChanges; $('xChg').disabled=!pending().length;
  $('mClose').onclick=closeModal;
}

/* ------------------------------------------------------------------- import
   Compare an export with what is on screen, show every difference, and take
   the ones that are ticked. A game changed in this browser is left unticked:
   TeamLinkt simply has not caught up with it yet. */
function gameLine(g){ return `${dlabel(g.date)} · ${fmt(g.start)} · ${esc(g.loc)}`; }
function openImport(text,name,opts){
  opts=opts||{};
  const parsed=TL.parse(text);
  if(!parsed.games.length){ showModal('Could not read that file',name||'',
    `<div class="pre"><ul>${parsed.problems.map(p=>`<li>${esc(p)}</li>`).join('')||'<li>No games found.</li>'}</ul></div>`,
    '<button class="btn ghost" id="mClose">Close</button>'); $('mClose').onclick=closeModal; return; }
  const incoming=parsed.games, d=TL.diff(G,incoming), mineIds=new Set(pending().map(c=>c.game.id));
  const first=!G.length;
  const items=[]; // {kind, ref, mine, group}
  d.changed.forEach(p=>items.push({kind:'changed',ref:p,mine:mineIds.has(p.old.id),group:p.new.group||p.old.group}));
  d.added.forEach(g=>items.push({kind:'added',ref:g,mine:false,group:g.group}));
  d.removed.forEach(g=>items.push({kind:'removed',ref:g,mine:mineIds.has(g.id),group:g.group}));
  const apply=accept=>{
    const rec=TL.reconcile(G,incoming,accept,d);
    const touched=rec.diff.changed.filter(p=>accept(p,'changed')).map(p=>p.old.id)
      .concat(rec.base.filter(b=>!G.some(g=>g.id===b.id)).map(b=>b.id));
    BASE=rec.base; G=rec.work;
    meta.src=name||'TeamLinkt export'; meta.when=opts.when||('imported '+new Date().toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}));
    if(opts.sig) meta.sig=opts.sig;
    if(!first) meta.last={name:meta.src,when:new Date().toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}),ids:touched,
      summary:`${d.changed.length} changed, ${d.added.length} added, ${d.removed.length} removed`};
    if(!first) cur=null; closeModal(); commit();
    if(touched.length&&!first){ panel='hist'; render(); }
  };
  if(first){ apply(()=>true); return; }
  if(!items.length){ BASE=TL.reconcile(G,incoming,()=>true,d).base; meta.src=name||meta.src; if(opts.sig) meta.sig=opts.sig; if(opts.when) meta.when=opts.when; save(); render();
    if(opts.quiet) return;
    showModal('Nothing to update',name||'',`<div class="pre ok"><b>All ${incoming.length} games match.</b> The schedule on screen is already the same as this export.</div>`
      +(parsed.problems.length?`<p class="note">${parsed.problems.map(esc).join('<br>')}</p>`:''),
      '<button class="btn ghost" id="mClose">Close</button>'); $('mClose').onclick=closeModal; return; }

  const byKind=k=>items.filter(i=>i.kind===k);
  const row=(it,ix)=>{ const tick=it.mine?'':' checked';
    const tag=it.mine?'<span class="mine">you changed this here</span>':'';
    if(it.kind==='changed'){ const p=it.ref;
      const how=p.how==='flipped'?'home and away swapped':p.how==='slot'?'different teams in this slot':'';
      return `<label class="drow"><input type="checkbox" data-ix="${ix}"${tick}><span><b>${esc(vsFull(p.old))}</b>${tag}
        <em>${esc(gmeta(it.group).label)} · ${gameLine(p.old)}${how?' · '+how:''}</em><span class="chg">${changeLine(p.old,p.new,p.fields)}</span></span></label>`; }
    const g=it.ref;
    return `<label class="drow"><input type="checkbox" data-ix="${ix}"${tick}><span><b>${esc(vsFull(g))}</b>${tag}<em>${esc(gmeta(it.group).label)} · ${gameLine(g)}</em></span></label>`;
  };
  const section=(k,title,blurb)=>{ const list=byKind(k); if(!list.length) return '';
    return `<h4 class="dgrp">${title} (${list.length}) <button data-all="${k}">all</button><button data-none="${k}">none</button></h4><p class="note" style="margin:0 0 4px">${blurb}</p>`
      +list.map(it=>row(it,items.indexOf(it))).join(''); };
  const nm=items.filter(i=>i.mine).length;
  showModal(opts.title||'Update from TeamLinkt',`${name||'export'} · ${incoming.length} games`,
    `<div class="stats"><span><b>${d.same.length}</b>unchanged</span><span><b>${d.changed.length}</b>changed</span><span><b>${d.added.length}</b>new</span><span><b>${d.removed.length}</b>gone from TeamLinkt</span></div>`
    +(opts.lead?`<p class="note">${opts.lead}</p>`:'')
    +(nm?`<div class="pre ok">${nm} of these touch games you changed in this browser. They are left unticked so your change stays as a proposal — tick them to take TeamLinkt's version instead.</div>`:'')
    +(parsed.problems.length?`<div class="pre">${parsed.problems.map(esc).join('<br>')}</div>`:'')
    +section('changed','Changed','Same game, different details. Ticked rows are updated to match TeamLinkt.')
    +section('added','New in TeamLinkt','Ticked rows are added.')
    +section('removed','No longer in TeamLinkt','Ticked rows are removed from the schedule.'),
    '<button class="btn" id="imOk"></button><button class="btn ghost" id="mClose">Cancel</button>');
  const boxes=()=>[...$('mBody').querySelectorAll('input[data-ix]')];
  const count=()=>{ const n=boxes().filter(b=>b.checked).length; $('imOk').textContent=n===items.length?`Apply all ${n}`:`Apply ${n} of ${items.length}`; };
  $('mBody').addEventListener('change',count);
  $('mBody').querySelectorAll('[data-all],[data-none]').forEach(b=>b.onclick=()=>{ const k=b.dataset.all||b.dataset.none;
    boxes().forEach(x=>{ if(items[+x.dataset.ix].kind===k) x.checked=!!b.dataset.all; }); count(); });
  $('imOk').onclick=()=>{ const on=new Set(boxes().filter(b=>b.checked).map(b=>items[+b.dataset.ix].ref)); apply(x=>on.has(x)); };
  $('mClose').onclick=closeModal; count();
}
function readFile(f){ const fr=new FileReader();
  fr.onload=()=>{ const m=f.name.match(/(\d{4})(\d\d)(\d\d)_(\d\d)(\d\d)/);
    const when=m?'exported '+new Date(+m[1],m[2]-1,+m[3],+m[4],+m[5]).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';
    const kind=sniff(fr.result);
    if(kind!=='schedule') openFieldImport(kind,String(fr.result),f.name); else openImport(String(fr.result),f.name,{when}); };
  fr.readAsText(f); }

/* -------------------------------------------------------------- open fields
   Permitted time on every field, minus games and practices, over a date range. */
const addDays=(d,n)=>{ const x=new Date(d+'T12:00:00'); x.setDate(x.getDate()+n);
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
let OPENQ=null;
function openOpen(pre){
  if(!PERMITS.length){ showModal('Open fields','No permit file loaded',
    `<div class="pre">The site finds open fields from <b>data/permits.csv</b>, which is not on the website yet. Use <b>More → Import permits</b> to load one in this browser.</div>`,
    '<button class="btn ghost" id="mClose">Close</button>'); $('mClose').onclick=closeModal; return; }
  const pd=[...FX.dates].filter(d=>PERMITS.some(p=>p.date===d&&inProgX(p))).sort();
  const q=OPENQ=Object.assign({from:null,to:null,days:[0,1,2,3,4,5,6],min:120,field:'',pracPermits:CFG.gamesOnPracticePermits!==false,pracBusy:true},OPENQ||{},pre||{});
  if(!q.from){ const t=cur||todayISO(); q.from=pd.find(d=>d>=t)||pd[0]||t; }
  if(!q.to||q.to<q.from) q.to=addDays(q.from,13);
  const D=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const scope=prog==='ALL'?'every program':(CFG.programs.find(x=>x.id===prog)||{}).name;
  showModal('Open fields',`Permitted time with nothing booked · ${scope}`,
    `<div class="row two"><span><label for="oFrom">From</label><input id="oFrom" type="date" value="${q.from}"></span>
       <span><label for="oTo">To</label><input id="oTo" type="date" value="${q.to}"></span></div>
     <div class="row"><label>Days</label><span class="odays">${D.map((d,i)=>`<label><input type="checkbox" data-d="${i}"${q.days.includes(i)?' checked':''}> ${d}</label>`).join('')}</span></div>
     <div class="row two"><span><label for="oMin">At least (minutes)</label><input id="oMin" type="number" min="30" max="600" step="15" value="${q.min}"></span>
       <span><label for="oField">Field contains</label><input id="oField" value="${esc(q.field)}" placeholder="any field"></span></div>
     <div class="row check"><label><input type="checkbox" id="oPP"${q.pracPermits?' checked':''}> Include time held on practice permits</label></div>
     <div class="row check"><label><input type="checkbox" id="oPB"${q.pracBusy?' checked':''}> Practices hold the field</label></div>
     <p class="note">Permits on file run ${pd.length?dlabel(pd[0])+' – '+dlabel(pd[pd.length-1]):'—'}. Unlit fields stop ${CFG.sunsetGrace} min after sunset.</p>
     <div id="oOut"></div>`,
    '<button class="btn ghost" id="oCsv">CSV</button><button class="btn ghost" id="mClose">Close</button>');
  let res=[];
  const run=()=>{
    q.from=$('oFrom').value; q.to=$('oTo').value; q.min=Math.max(15,Number($('oMin').value)||120); q.field=$('oField').value.trim();
    q.days=[...$('mBody').querySelectorAll('[data-d]')].filter(b=>b.checked).map(b=>+b.dataset.d);
    q.pracPermits=$('oPP').checked; q.pracBusy=$('oPB').checked;
    const ft=q.field.toLowerCase(); res=[];
    pd.filter(d=>d>=q.from&&d<=q.to&&q.days.includes(new Date(d+'T12:00:00').getDay())).forEach(d=>{
      FX.fieldsOn(d).filter(f=>(!ft||f.toLowerCase().indexOf(ft)>=0)&&PERMITS.some(p=>p.date===d&&p.field===f&&inProgX(p))).forEach(f=>{
        openOn(d,f,{practicePermits:q.pracPermits,practicesBusy:q.pracBusy}).filter(w=>w.end-w.start>=q.min).forEach(w=>res.push({d,f,w})); }); });
    res.sort((a,b)=>a.d.localeCompare(b.d)||a.w.start-b.w.start||a.f.localeCompare(b.f));
    const tot=res.reduce((m,r)=>m+r.w.end-r.w.start,0);
    let h=`<div class="stats"><span><b>${res.length}</b>open slot${res.length===1?'':'s'}</span><span><b>${hrs(tot)}</b>open</span><span><b>${new Set(res.map(r=>r.f)).size}</b>fields</span><span><b>${new Set(res.map(r=>r.d)).size}</b>dates</span></div>`;
    if(!res.length) h+='<p class="note">Nothing open with these settings. Try a wider date range, a shorter minimum, or include practice-permit time.</p>';
    let last='';
    res.forEach((r,i)=>{ if(r.d!==last){ h+=`<h4 class="dgrp">${dlabel(r.d,{weekday:'long',month:'short',day:'numeric'})}</h4>`; last=r.d; }
      h+=`<div class="orow2"><button class="flink ojump" data-i="${i}">${esc(r.f)}</button>
        <span>${fmt(r.w.start)}–${fmt(r.w.end)} <em>${r.w.end-r.w.start} min${r.w.use==='Practice'?' · practice permit':''}${isLit(r.f)?' · lit':''}</em></span>
        ${admin?`<button class="btn ghost oadd" data-i="${i}">Add game</button>`:''}</div>`; });
    $('oOut').innerHTML=h;
    $('oOut').querySelectorAll('.ojump').forEach(b=>b.onclick=()=>{ const r=res[+b.dataset.i]; closeModal(); fieldMode='permitted'; setTeam(''); jumpTo(r.d,null);
      const ln=$('grid').querySelector(`.lane[data-field="${CSS.escape(r.f)}"]`); if(ln){ ln.scrollIntoView({block:'center'}); ln.classList.add('hl'); setTimeout(()=>ln.classList.remove('hl'),1600); } });
    $('oOut').querySelectorAll('.oadd').forEach(b=>b.onclick=()=>{ const r=res[+b.dataset.i]; closeModal(); cur=r.d; render(); openEdit(null,seed(r.f,r.w,r.d)); });
  };
  $('mBody').addEventListener('change',run); $('oField').addEventListener('input',run);
  $('oCsv').onclick=()=>download('open_fields.csv',[['Date','Day','Field','Open from','Open to','Minutes','Permit','Lit']].concat(res.map(r=>[r.d,
    new Date(r.d+'T12:00:00').toLocaleDateString('en-US',{weekday:'short'}),r.f,TL.fmtTime(r.w.start),TL.fmtTime(r.w.end),r.w.end-r.w.start,r.w.use,isLit(r.f)?'yes':'']))
    .map(r=>r.map(x=>/[",\n]/.test(String(x))?'"'+String(x).replace(/"/g,'""')+'"':x).join(',')).join('\r\n')+'\r\n');
  $('mClose').onclick=closeModal; run();
}

/* ------------------------------------------------------- permit / practice import
   The file is read, matched to TeamLinkt's field names, and shown before it is
   used. Once taken it is kept in this browser until the same file is published. */
const KIND={permits:{label:'permits',file:'permits.csv',cfg:'permitsFile'},practices:{label:'practices',file:'practices.csv',cfg:'practicesFile'}};
function sniff(text){
  const head=(TL.csvRows(String(text).slice(0,4000)).find(r=>r.some(c=>/\w/.test(c)))||[]).map(c=>String(c).trim().toLowerCase());
  if(head.includes('home team')||head.includes('away team')) return 'schedule';
  if(head.some(h=>['team','coach','manager','head coach','team name'].includes(h))) return 'practices';
  if(head.some(h=>['field','location','full field name','facility'].includes(h))) return 'permits';
  return 'schedule';
}
function openFieldImport(kind,text,name){
  const R=FD.resolver(locations(),CFG.fieldAliases);
  const out=kind==='permits'?FD.parsePermits(text,R):FD.parsePractices(text,R,teamOf);
  const list=out[kind];
  if(!list.length){ showModal(`Could not read that ${KIND[kind].label} file`,name||'',`<div class="pre"><ul>${(out.problems.length?out.problems:['Nothing found.']).map(p=>`<li>${esc(p)}</li>`).join('')}</ul></div>`
    +`<p class="note">${kind==='permits'?'Expected columns: Date, Field, Start, End, Use (Game or Practice). Or the weekly form: Field, Day, Start, End, First, Last.'
      :'Expected columns: Date, Field, Start, End, Team (or Coach and Division). Or the weekly form with Day, First and Last in place of Date.'}</p>`,
    '<button class="btn ghost" id="mClose">Close</button>'); $('mClose').onclick=closeModal; return; }
  const locs=new Set(locations()), dates=list.map(x=>x.date).sort();
  const unplaced=[...new Set(list.filter(x=>x.how==='new'&&!locs.has(x.field)).map(x=>x.raw))].sort();
  const matched=[...new Set(list.filter(x=>x.how==='matched').map(x=>`${x.raw} → ${x.field}`))].sort();
  const cur0=kind==='permits'?PERMITS:PRACS;
  const k=x=>[x.date,x.field,x.start,x.end,x.use||x.team].join('|');
  const was=new Set(cur0.map(k)), now=new Set(list.map(k));
  const add=list.filter(x=>!was.has(k(x))).length, gone=cur0.filter(x=>!now.has(k(x))).length;
  const norm=kind==='permits'?FD.serializePermits(list):FD.serializePractices(list);
  showModal(`Import ${KIND[kind].label}`,`${name||'file'} · ${list.length} ${kind==='permits'?'permit windows':'practices'}`,
    `<div class="stats"><span><b>${list.length}</b>rows</span><span><b>${new Set(list.map(x=>x.field)).size}</b>fields</span>
      <span><b>${dlabel(dates[0])}</b>first</span><span><b>${dlabel(dates[dates.length-1])}</b>last</span>
      ${cur0.length?`<span><b>${add}</b>new</span><span><b>${gone}</b>dropped</span>`:''}</div>`
    +(unplaced.length?`<div class="pre"><b>${unplaced.length} field name${unplaced.length===1?'':'s'} not in the TeamLinkt schedule.</b> They will show as their own lanes. If one is a field TeamLinkt calls something else, add it to <b>fieldAliases</b> in js/config.js.<ul>${unplaced.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></div>`:'')
    +(matched.length?`<details class="note"><summary>${matched.length} name${matched.length===1?'':'s'} matched to TeamLinkt's spelling</summary>${matched.map(esc).join('<br>')}</details>`:'')
    +(out.problems.length?`<div class="pre">${out.problems.slice(0,12).map(esc).join('<br>')}${out.problems.length>12?`<br>… and ${out.problems.length-12} more`:''}</div>`:'')
    +`<p class="note">Using it here changes this browser only. To publish it for everyone, download it as <b>${KIND[kind].file}</b> and upload it to the <b>data</b> folder on GitHub.</p>`,
    `<button class="btn" id="fiUse">Use in this browser</button><button class="btn ghost" id="fiDl">Download ${KIND[kind].file}</button><button class="btn ghost" id="mClose">Cancel</button>`);
  $('fiUse').onclick=()=>{ RAW[kind]={text:norm,name:name||KIND[kind].file,when:'imported '+new Date().toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}),local:true,sig:hash(norm)};
    saveF(); closeModal(); cur=allDates().includes(cur)?cur:defaultDate(); render(); };
  $('fiDl').onclick=()=>download(KIND[kind].file,norm);
  $('mClose').onclick=closeModal;
}
function dropLocal(kind){ RAW[kind]=PUBF[kind]; saveF(); cur=null; render(); }

/* -------------------------------------------------------------------- wiring */
$('importBtn').onclick=()=>$('tlFile').click();
$('tlFile').onchange=e=>{ const f=e.target.files[0]; if(f) readFile(f); e.target.value=''; };
let dragN=0;
window.addEventListener('dragenter',e=>{ if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files')){ dragN++; $('drop').classList.add('on'); } });
window.addEventListener('dragleave',()=>{ dragN=Math.max(0,dragN-1); if(!dragN) $('drop').classList.remove('on'); });
window.addEventListener('dragover',e=>e.preventDefault());
window.addEventListener('drop',e=>{ e.preventDefault(); dragN=0; $('drop').classList.remove('on');
  const f=e.dataTransfer&&e.dataTransfer.files[0]; if(f) readFile(f); });
$('modeBtn').onclick=()=>{ admin=!admin; sel=null; closeDrawer(); render(); };
$('addBtn').onclick=()=>openEdit(null);
$('pushBtn').onclick=()=>{ panel='hist'; render(); $('hist').scrollIntoView({behavior:'smooth',block:'center'}); };
$('reset').onclick=()=>{ if(confirm('Discard every change made in this browser and go back to the TeamLinkt schedule?')){ G=clone(BASE); sel=null; commit(); } };
$('teamBtn').onclick=()=>openTeam();
$('openBtn').onclick=()=>openOpen();
['permits','practices'].forEach(k=>{ const inp=$(k==='permits'?'pmFile':'prFile');
  $(k==='permits'?'pmBtn':'prBtn').onclick=()=>inp.click();
  inp.onchange=e=>{ const f=e.target.files[0]; if(f){ const fr=new FileReader(); fr.onload=()=>openFieldImport(k,String(fr.result),f.name); fr.readAsText(f); } e.target.value=''; }; });
$('showsel').onchange=()=>{ showPrac=$('showsel').value==='all'; cur=allDates().includes(cur)?cur:defaultDate(); render(); };
$('exportBtn').onclick=openExport;
$('linkBtn').onclick=()=>{ writeHash(); const u=location.href;
  (navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(()=>flash('Link copied'),()=>prompt('Copy this link',u)); };
$('reloadBtn').onclick=()=>boot(true);
function flash(t){ const s=$('src'), old=s.textContent; s.textContent=t; setTimeout(()=>{s.textContent=old;},1600); }
function closeMore(){ const p=$('morePop'); if(!p.hidden){ p.hidden=true; $('moreBtn').setAttribute('aria-expanded','false'); } }
$('moreBtn').onclick=e=>{ e.stopPropagation(); const p=$('morePop'); p.hidden=!p.hidden; $('moreBtn').setAttribute('aria-expanded',String(!p.hidden)); };
$('morePop').addEventListener('click',()=>setTimeout(closeMore,0));
document.addEventListener('click',e=>{ if(!e.target.closest('.menu')) closeMore(); });
function stepDay(n){ const ds=allDates(), i=ds.indexOf(cur); if(i<0) return;
  const j=Math.min(ds.length-1,Math.max(0,i+n)); if(j!==i){ cur=ds[j]; sel=null; render();
    const on=$('strip').querySelector('[aria-current="true"]'); if(on) on.scrollIntoView({block:'nearest',inline:'center'}); } }
$('prevDay').onclick=()=>stepDay(-1); $('nextDay').onclick=()=>stepDay(1);
$('todayBtn').onclick=()=>{ cur=defaultDate(); sel=null; render(); };
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){ closeModal(); closeDrawer(); closeMore(); return; }
  if(e.altKey||e.ctrlKey||e.metaKey||e.target.closest('input,select,textarea')) return;
  if(document.querySelector('.modal.on,.drawer.on')) return;
  if(e.key==='ArrowLeft'){ e.preventDefault(); stepDay(-1); } if(e.key==='ArrowRight'){ e.preventDefault(); stepDay(1); } });
$('filtBtn').onclick=()=>{ const b=document.querySelector('.bar'); b.classList.toggle('showf'); $('filtBtn').setAttribute('aria-expanded',String(b.classList.contains('showf'))); };
$('viewsel').onchange=()=>{ view=$('viewsel').value; render(); };
$('fieldsel').onchange=()=>{ fieldMode=$('fieldsel').value; cur=allDates().includes(cur)?cur:defaultDate(); render(); };
$('teamFind').addEventListener('change',()=>{ const v=$('teamFind').value.trim().toLowerCase();
  const teams=[...new Set(G.flatMap(g=>[g.home,g.away]).filter(Boolean))];
  const hit=teams.find(t=>t.toLowerCase()===v)||(v?teams.filter(t=>inProg({group:(G.find(g=>hasTeam(g,t))||{}).group||''})).find(t=>t.toLowerCase().indexOf(v)>=0):'')
    ||(v?teams.find(t=>t.toLowerCase().indexOf(v)>=0):'');
  setTeam(hit||''); if(hit&&!G.some(g=>inProg(g)&&hasTeam(g,hit))) prog='ALL'; cur=null; render(); });
$('teamClear').onclick=()=>{ setTeam(''); render(); };
['tabIssues','tabRules','tabHist','tabIgn'].forEach((id,i)=>$(id).onclick=()=>{ panel=['issues','rules','hist','ign'][i]; renderIssues(); });
let _rz=null; window.addEventListener('resize',()=>{ clearTimeout(_rz); _rz=setTimeout(renderGrid,160); });
window.addEventListener('hashchange',()=>{ readHash(); render(); });

/* --------------------------------------------------------------------- boot
   1. read the published file   2. lay this browser's own state over it
   3. if the published file has moved on since last visit, show what changed */
async function boot(force){
  const st=load(); let repo=null;
  if(location.protocol!=='file:'){
    try{ const r=await fetch(CFG.dataFile+'?t='+Date.now(),{cache:'no-store'});
      if(r.ok){ const lm=r.headers.get('last-modified');
        repo={text:await r.text(),when:lm?'published '+new Date(lm).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):''}; } }catch(e){}
  }
  if(st&&st.base&&!boot._loaded){ BASE=st.base; G=st.work||clone(st.base); ignored=new Set(st.ignored||[]); litLocal=st.lit||{}; meta=Object.assign(meta,st.meta||{}); }
  /* permits and practices: the published files, unless this browser imported newer ones */
  const lf=loadF();
  for(const k of ['permits','practices']){
    let pub=null;
    if(location.protocol!=='file:'&&CFG[KIND[k].cfg]){
      try{ const r=await fetch(CFG[KIND[k].cfg]+'?t='+Date.now(),{cache:'no-store'});
        if(r.ok){ const t=await r.text(), lm=r.headers.get('last-modified');
          pub={text:t,name:CFG[KIND[k].cfg],when:lm?'published '+new Date(lm).toLocaleString('en-US',{month:'short',day:'numeric'}):'',sig:hash(t)}; } }catch(e){} }
    PUBF[k]=pub;
    const loc=lf[k];
    /* the download button writes exactly what was imported, so once that file is
       published its fingerprint matches and the local copy can go */
    RAW[k]=loc&&!(pub&&pub.sig===loc.sig)?loc:pub;
  }
  if((lf.permits&&RAW.permits!==lf.permits)||(lf.practices&&RAW.practices!==lf.practices)) saveF();
  boot._loaded=true;
  if(view==='grid'&&window.innerWidth<=640&&!/v=grid/.test(location.hash)) view='list';
  readHash();
  if(repo){
    const sig=hash(repo.text); REPO=TL.parse(repo.text).games;
    if(!G.length){ openImport(repo.text,'published schedule',{sig,when:repo.when}); }
    else if(meta.sig!==sig||force){
      render();
      openImport(repo.text,'published schedule',{sig,when:repo.when,quiet:!force,title:'The published schedule changed',
        lead:'The schedule file on the website is different from what this browser last saw.'});
      return;
    }
  }
  render();
}
boot();
})();
