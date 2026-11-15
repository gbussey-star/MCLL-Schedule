/* TeamLinkt export: read, write, and compare. No page code in here, so the same
   file runs in a browser or under Node (which is how it is tested). */
(function(root){
'use strict';
const TL={};

TL.csvRows=function(text){
  const rows=[]; let row=[], cell='', q=false;
  text=String(text).replace(/^﻿/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){cell+='"';i++;} else q=false; } else cell+=c; }
    else if(c==='"') q=true;
    else if(c===','){ row.push(cell); cell=''; }
    else if(c==='\n'||c==='\r'){ if(c==='\r'&&text[i+1]==='\n') i++;
      row.push(cell); cell=''; if(row.some(x=>x.trim()!=='')) rows.push(row); row=[]; }
    else cell+=c;
  }
  row.push(cell); if(row.some(x=>x.trim()!=='')) rows.push(row);
  return rows;
};

TL.toMin=function(v){
  const m=String(v||'').trim().match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([ap])?\.?m?\.?$/i);
  if(!m) return null;
  let h=+m[1]; const n=+(m[2]||0), ap=(m[3]||'').toLowerCase();
  if(ap==='p'&&h<12) h+=12; if(ap==='a'&&h===12) h=0;
  return h*60+n;
};
TL.fmtTime=function(min){
  const h=Math.floor(min/60), n=min%60;
  return `${(h%12)||12}:${String(n).padStart(2,'0')} ${h<12?'am':'pm'}`;
};
TL.toDate=function(v){
  v=String(v||'').trim(); let m;
  if((m=v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  if((m=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/))){
    const y=m[3].length===2?'20'+m[3]:m[3];
    return `${y}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`; }
  const d=new Date(v); if(isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

/* "Baseball - Minors A - Hybrid - Upper County" -> sport / division / region */
TL.splitGroup=function(group){
  const p=String(group||'').split(/\s+-\s+/).map(s=>s.trim()).filter(Boolean);
  if(p.length<2) return {sport:p[0]||'', div:p[0]||'Unassigned', region:''};
  const hasRegion=/county/i.test(p[p.length-1]);
  return { sport:p[0], div:p.slice(1,hasRegion?-1:undefined).join(' - ')||p[0],
           region:hasRegion?p[p.length-1]:'' };
};

const ALIAS={date:['date','event date','game date'], start:['start time','time','start'],
  end:['end time','end'], dur:['duration'], loc:['location','venue','field'],
  group:['group','division','league'], type:['event type','type'], notes:['notes','note'],
  home:['home team','home'], away:['away team','away','visitor','visiting team']};

/* text -> { games, problems }. Rows it cannot place in time are reported, not dropped silently. */
TL.parse=function(text){
  const rows=TL.csvRows(text), problems=[];
  if(!rows.length) return {games:[],problems:['The file is empty.']};
  const head=rows[0].map(h=>h.trim().toLowerCase()), col={};
  Object.keys(ALIAS).forEach(k=>{ col[k]=head.findIndex(h=>ALIAS[k].includes(h)); });
  ['date','start','loc','home','away'].forEach(k=>{
    if(col[k]<0) problems.push(`No "${ALIAS[k][0]}" column - is this a TeamLinkt schedule export?`); });
  if(problems.length) return {games:[],problems};
  const get=(r,k)=>col[k]<0?'':String(r[col[k]]==null?'':r[col[k]]).trim();
  const games=[];
  rows.slice(1).forEach((r,i)=>{
    const date=TL.toDate(get(r,'date')), start=TL.toMin(get(r,'start'));
    if(!date||start==null){ problems.push(`Row ${i+2}: could not read the date or start time - skipped.`); return; }
    let end=TL.toMin(get(r,'end'));
    if(end==null){ const d=parseInt(get(r,'dur'),10); end=start+(d>0?d:120); }
    games.push({ id:'g'+(i+1), date, start, end, loc:get(r,'loc')||'TBA', group:get(r,'group'),
      type:get(r,'type')||'Game', notes:get(r,'notes'), home:get(r,'home'), away:get(r,'away') });
  });
  /* a row with no group: borrow it from the same teams' other games */
  const seen={};
  games.forEach(g=>{ if(g.group) [g.home,g.away].forEach(t=>{ if(t){ (seen[t]=seen[t]||{})[g.group]=(seen[t][g.group]||0)+1; } }); });
  games.forEach(g=>{ if(g.group) return;
    const votes={}; [g.home,g.away].forEach(t=>Object.entries(seen[t]||{}).forEach(([k,n])=>votes[k]=(votes[k]||0)+n));
    const best=Object.entries(votes).sort((a,b)=>b[1]-a[1])[0];
    if(best){ g.group=best[0]; g.groupGuess=true; } });
  return {games,problems};
};

const q=s=>/[",\n]/.test(s)?'"'+String(s).replace(/"/g,'""')+'"':String(s);
TL.serialize=function(games,extra){
  const head=['Date','Start Time','End Time','Location','Group','Event Type','Notes','Home Team','Away Team'].concat(extra?extra.head:[]);
  const sorted=games.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start||a.loc.localeCompare(b.loc));
  return [head].concat(sorted.map(g=>[g.date,TL.fmtTime(g.start),TL.fmtTime(g.end),g.loc,
    g.groupGuess?'':g.group,g.type,g.notes,g.home,g.away].concat(extra?extra.row(g):[])))
    .map(r=>r.map(q).join(',')).join('\r\n')+'\r\n';
};

/* ------------------------------------------------------------------ compare
   The export carries no game id, so games are paired by what they are:
     1. identical rows
     2. same group and same home/away - nearest date wins (a moved game)
     3. same two teams with home and away flipped
     4. same date, time and field with different teams (an opponent swap)
   Whatever is left over on the old side was removed; on the new side, added. */
const F=['date','start','end','loc','group','home','away','type','notes'];
const LABEL={date:'date',start:'start',end:'end',loc:'field',group:'group',home:'home',away:'away',type:'type',notes:'notes'};
const n=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
const dayNum=d=>Date.parse(d+'T12:00:00Z')/86400000;
TL.fieldsChanged=(a,b)=>F.filter(k=>k==='start'||k==='end'?a[k]!==b[k]:n(a[k])!==n(b[k]));
TL.fieldLabel=k=>LABEL[k];

TL.diff=function(oldList,newList){
  const res={same:[],changed:[],added:[],removed:[]};
  let O=oldList.slice(), N=newList.slice();
  const pair=(o,nw,how)=>{ const f=TL.fieldsChanged(o,nw);
    if(f.length) res.changed.push({old:o,new:nw,fields:f,how}); else res.same.push({old:o,new:nw}); };
  const pass=(keyFn,keyFnNew,how)=>{
    const buckets={};
    N.forEach(g=>{ const k=keyFnNew(g); if(k) (buckets[k]=buckets[k]||[]).push(g); });
    const usedO=new Set(), usedN=new Set();
    const cands=[];
    O.forEach(o=>{ const k=keyFn(o); if(!k) return; (buckets[k]||[]).forEach(nw=>
      cands.push([Math.abs(dayNum(o.date)-dayNum(nw.date))*10000+Math.abs(o.start-nw.start)+(n(o.loc)===n(nw.loc)?0:.5),o,nw])); });
    cands.sort((a,b)=>a[0]-b[0]).forEach(([,o,nw])=>{
      if(usedO.has(o)||usedN.has(nw)) return; usedO.add(o); usedN.add(nw); pair(o,nw,how); });
    O=O.filter(o=>!usedO.has(o)); N=N.filter(g=>!usedN.has(g));
  };
  const full=g=>F.map(k=>k==='start'||k==='end'?g[k]:n(g[k])).join('|');
  pass(full,full,'same');
  const teams=g=>g.home&&g.away?[n(g.group),n(g.home),n(g.away)].join('|'):'';
  pass(teams,teams,'moved');
  pass(teams,g=>g.home&&g.away?[n(g.group),n(g.away),n(g.home)].join('|'):'','flipped');
  const slot=g=>/^tba$/i.test(g.loc)?'':[g.date,g.start,n(g.loc)].join('|');
  pass(slot,slot,'slot');
  res.removed=O; res.added=N;
  return res;
};

/* Take an import. `accept(item,kind)` says which differences to take; anything
   declined stays as it is in the working copy and shows up as a pending change.
   base  = the new export (the truth), carrying the old ids where games matched
   work  = the working copy after the accepted differences */
TL.reconcile=function(work,incoming,accept,diff){
  const d=diff||TL.diff(work,incoming), base=[], out=[];
  let seq=work.concat(incoming).reduce((m,g)=>Math.max(m,parseInt(String(g.id).replace(/\D/g,''),10)||0),0);
  const yes=(x,k)=>!accept||accept(x,k);
  d.same.forEach(p=>{ const g={...p.new,id:p.old.id}; base.push(g); out.push({...g}); });
  d.changed.forEach(p=>{ const g={...p.new,id:p.old.id}; base.push(g); out.push(yes(p,'changed')?{...g}:{...p.old}); });
  d.added.forEach(g0=>{ const g={...g0,id:'g'+(++seq)}; base.push(g); if(yes(g0,'added')) out.push({...g}); });
  d.removed.forEach(g=>{ if(!yes(g,'removed')) out.push({...g}); });
  return {base,work:out,diff:d};
};

/* differences between two lists that share ids (base vs working copy) */
TL.pending=function(base,work){
  const B=new Map(base.map(g=>[g.id,g])), W=new Map(work.map(g=>[g.id,g])), out=[];
  work.forEach(g=>{ const b=B.get(g.id);
    if(!b) out.push({kind:'add',game:g});
    else { const f=TL.fieldsChanged(b,g); if(f.length) out.push({kind:'change',game:g,was:b,fields:f}); } });
  base.forEach(b=>{ if(!W.has(b.id)) out.push({kind:'remove',game:b,was:b}); });
  return out;
};

root.TL=TL;
if(typeof module!=='undefined') module.exports=TL;
})(typeof window!=='undefined'?window:globalThis);
