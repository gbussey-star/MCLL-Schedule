/* Field supply: permits and practices. Pure functions, no page code, so the same
   file runs in a browser or under Node (which is how it is tested).

   data/permits.csv    when MCLL holds each field (one row per date and window)
   data/practices.csv  which team practises where (from the practice draft)

   Both files also take the weekly form the commissioners already keep:
   a Day column plus First/Last dates, which is expanded to one row per date. */
(function(root){
'use strict';
const TL=root.TL||(typeof require!=='undefined'?require('./teamlinkt.js'):null);
const FD={};

/* ------------------------------------------------------------ field names
   One field, many spellings: the county permit, the practice sheet and
   TeamLinkt each write it differently. Everything is matched to the name
   TeamLinkt uses, so a permit and a game on the same diamond line up. */
const WORDS=[[/\belementary school\b|\belem\b/g,'es'],[/\bmiddle school\b/g,'ms'],[/\bhigh school\b/g,'hs'],
  [/\b(local|regional|recreational|rec|community|neighborhood)\b/g,' '],[/\b(lp|rp|park)\b/g,' '],
  [/\b(bb|sb|fs|r|s\/s|youth|lights?|lighted|games only|90ft|60ft)\b/g,' ']];
FD.key=function(name){
  let s=String(name||'').toLowerCase().replace(/\(.*?\)/g,' ');
  WORDS.forEach(([re,to])=>{ s=s.replace(re,to); });
  s=s.replace(/\bfield\s*#?\s*([a-z0-9]+)\b|#\s*([a-z0-9]+)\b/g,(m,a,b)=>' f'+(a||b)+' ')
     .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  return s;
};
/* names: the locations TeamLinkt uses. aliases: { other spelling: TeamLinkt name } */
FD.resolver=function(names,aliases){
  const al={}, alk={}; Object.entries(aliases||{}).forEach(([k,v])=>{ al[k.trim().toLowerCase()]=v; alk[FD.key(k)]=v; });
  const byKey={}; (names||[]).forEach(n=>{ const k=FD.key(n); (byKey[k]=byKey[k]||new Set()).add(n); });
  return function(raw){
    const s=String(raw||'').trim(); if(!s) return {name:'',how:'blank'};
    if(al[s.toLowerCase()]) return {name:al[s.toLowerCase()],how:'alias'};
    if((names||[]).includes(s)) return {name:s,how:'exact'};
    const k=FD.key(s); if(alk[k]) return {name:alk[k],how:'alias'};
    const hit=byKey[k];
    if(hit&&hit.size===1) return {name:[...hit][0],how:'matched'};
    return {name:s,how:'new'};
  };
};

/* ------------------------------------------------------------ reading */
const DOW={su:0,sun:0,sunday:0,mo:1,mon:1,monday:1,tu:2,tue:2,tues:2,tuesday:2,we:3,wed:3,wednesday:3,
  th:4,thu:4,thur:4,thurs:4,thursday:4,fr:5,fri:5,friday:5,sa:6,sat:6,saturday:6};
FD.days=function(v){   // "Tu, W, Th" / "Mon-Fri" / "MWF" -> [2,3,4]
  const s=String(v||'').toLowerCase().trim(); if(!s) return [];
  const out=new Set();
  s.split(/[,;/&+]|\band\b/).forEach(part=>{ part=part.trim(); if(!part) return;
    const rng=part.split(/\s*(?:-|–|to)\s*/);
    if(rng.length===2&&DOW[rng[0]]!=null&&DOW[rng[1]]!=null){ let d=DOW[rng[0]];
      for(let i=0;i<7;i++){ out.add(d); if(d===DOW[rng[1]]) break; d=(d+1)%7; } return; }
    if(DOW[part]!=null){ out.add(DOW[part]); return; }
    if(/^[mtwrfsu]+$/.test(part)&&part.length<=7) [...part].forEach(c=>{ const m={m:1,t:2,w:3,r:4,f:5,s:6,u:0}[c]; if(m!=null) out.add(m); });
  });
  return [...out];
};
const iso=d=>`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
FD.expand=function(days,first,last){
  const out=[]; if(!first||!last||!days.length) return out;
  const a=new Date(first+'T12:00:00Z'), b=new Date(last+'T12:00:00Z');
  for(let d=a, n=0; d<=b && n<400; d=new Date(d.getTime()+86400000), n++) if(days.includes(d.getUTCDay())) out.push(iso(d));
  return out;
};
/* "9/20, 9/27, 10/4" with the year taken from a nearby full date */
FD.dateList=function(v,year){
  return String(v||'').split(/[,;]/).map(x=>x.trim()).filter(Boolean).map(x=>{
    const m=x.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/); if(!m) return TL.toDate(x);
    const y=m[3]?(m[3].length===2?'20'+m[3]:m[3]):year; return y?`${y}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`:null;
  }).filter(Boolean);
};
const COLS={
  date:['date','event date','permit date'], day:['day','days','actual day','weekday'],
  first:['first','first date','from','start date','begins'], last:['last','last date','to','end date','through','ends'],
  all:['all dates','dates'], field:['field','location','actual field','facility','full field name','venue'],
  start:['start','start time','from time','begin'], end:['end','end time','to time','finish'],
  hours:['hours','window','time','times','permitted time'], use:['use','type','permit type','permit purpose','purpose'],
  prog:['program','region','area program'], permit:['permit','reserv. #','reservation','reservation #','reservation number','permit #','permit number'],
  receipt:['receipt','receipt #','receipt number','permit file'], pname:['permit name','county name','full field name'],
  notes:['notes','note','why','comments'], status:['status'],
  team:['team','team name'], coach:['coach','manager','head coach'], div:['division','div','level']
};
function table(text){
  const rows=TL.csvRows(text); if(!rows.length) return null;
  // first row that looks like a header (has a field/location column)
  let h=rows.findIndex(r=>r.some(c=>COLS.field.includes(String(c).trim().toLowerCase())));
  if(h<0) h=0;
  const head=rows[h].map(c=>String(c).trim().toLowerCase()), col={};
  Object.keys(COLS).forEach(k=>{ col[k]=head.findIndex(c=>COLS[k].includes(c)); });
  if(col.pname===col.field) col.pname=-1;
  const get=(r,k)=>col[k]<0?'':String(r[col[k]]==null?'':r[col[k]]).trim();
  return {rows:rows.slice(h+1),col,get,line:i=>h+i+2};
}
function datesOf(t,r){
  const d=TL.toDate(t.get(r,'date')); if(d&&t.col.date>=0) return [d];
  const first=TL.toDate(t.get(r,'first')), last=TL.toDate(t.get(r,'last'));
  if(t.col.all>=0&&t.get(r,'all')){ const y=(first||last||'').slice(0,4); const l=FD.dateList(t.get(r,'all'),y); if(l.length) return l; }
  return FD.expand(FD.days(t.get(r,'day')),first,last);
}
function timesOf(t,r){
  let s=TL.toMin(t.get(r,'start')), e=TL.toMin(t.get(r,'end'));
  if((s==null||e==null)&&t.get(r,'hours')){
    const p=t.get(r,'hours').replace(/\s+/g,'').split(/-|–|to/i);
    if(p.length===2){ const ap=(p[1].match(/[ap]m?$/i)||[''])[0];
      s=TL.toMin(/[ap]m?$/i.test(p[0])?p[0]:p[0]+ap); e=TL.toMin(p[1]); } }
  return [s,e];
}

/* text -> { permits:[{date,field,start,end,use,prog,permit,receipt,pname,notes,raw}], problems } */
FD.parsePermits=function(text,resolve){
  const t=table(text); if(!t) return {permits:[],problems:['The file is empty.']};
  const problems=[];
  if(t.col.field<0) return {permits:[],problems:['No "Field" column - expected Date, Field, Start, End, Use.']};
  if(t.col.date<0&&!(t.col.day>=0&&t.col.first>=0&&t.col.last>=0)&&t.col.all<0)
    return {permits:[],problems:['No "Date" column, and no Day + First + Last columns to build the dates from.']};
  const out=[];
  t.rows.forEach((r,i)=>{
    const raw=t.get(r,'field'); if(!raw) return;
    if(/no permit/i.test(t.get(r,'hours'))) return;
    const [s,e]=timesOf(t,r), ds=datesOf(t,r);
    if(s==null||e==null||e<=s){ problems.push(`Row ${t.line(i)}: could not read the hours for ${raw} - skipped.`); return; }
    if(!ds.length){ problems.push(`Row ${t.line(i)}: could not work out the dates for ${raw} - skipped.`); return; }
    const f=resolve?resolve(raw):{name:raw,how:'exact'};
    const use=/prac/i.test(t.get(r,'use'))?'Practice':'Game';
    ds.forEach(d=>out.push({date:d,field:f.name,start:s,end:e,use,prog:t.get(r,'prog').toUpperCase(),
      permit:t.get(r,'permit'),receipt:t.get(r,'receipt'),pname:t.get(r,'pname'),notes:t.get(r,'notes'),raw,how:f.how}));
  });
  return {permits:out,problems};
};

/* text -> { practices:[{id,date,field,start,end,team,coach,div,prog,permit,status}], problems } */
FD.parsePractices=function(text,resolve,teamOf){
  const t=table(text); if(!t) return {practices:[],problems:['The file is empty.']};
  const problems=[];
  if(t.col.field<0) return {practices:[],problems:['No "Field" column - expected Date, Field, Start, End, Team.']};
  if(t.col.team<0&&t.col.coach<0) return {practices:[],problems:['No "Team" or "Coach" column.']};
  const out=[];
  t.rows.forEach((r,i)=>{
    const raw=t.get(r,'field'); if(!raw) return;
    const [s,e]=timesOf(t,r), ds=datesOf(t,r);
    const who=t.get(r,'team')||t.get(r,'coach');
    if(s==null||e==null||e<=s){ problems.push(`Row ${t.line(i)}: no practice time for ${who||raw} - skipped.`); return; }
    if(!ds.length){ problems.push(`Row ${t.line(i)}: could not work out the dates for ${who||raw} - skipped.`); return; }
    const f=resolve?resolve(raw):{name:raw,how:'exact'};
    let team=t.get(r,'team'); const coach=t.get(r,'coach'), div=t.get(r,'div');
    if(!team&&teamOf) team=teamOf(coach,div)||'';
    if(!team) team=[div,coach.split(/\s+/).pop()].filter(Boolean).join(' - ');
    ds.forEach(d=>out.push({date:d,field:f.name,start:s,end:e,team,coach,div,prog:t.get(r,'prog').toUpperCase(),
      permit:t.get(r,'permit'),status:t.get(r,'status')||'',raw,how:f.how}));
  });
  out.sort((a,b)=>a.date.localeCompare(b.date)||a.field.localeCompare(b.field)||a.start-b.start);
  out.forEach((p,i)=>{ p.id='p'+(i+1); });
  return {practices:out,problems};
};

const q=s=>/[",\n]/.test(String(s))?'"'+String(s).replace(/"/g,'""')+'"':String(s);
const csv=rows=>rows.map(r=>r.map(x=>q(x==null?'':x)).join(',')).join('\r\n')+'\r\n';
FD.serializePermits=list=>csv([['Date','Field','Start','End','Use','Program','Permit','Receipt','Permit name','Notes']]
  .concat(list.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.field.localeCompare(b.field)||a.start-b.start)
  .map(p=>[p.date,p.field,TL.fmtTime(p.start),TL.fmtTime(p.end),p.use,p.prog,p.permit,p.receipt,p.pname,p.notes])));
FD.serializePractices=list=>csv([['Date','Field','Start','End','Team','Coach','Division','Program','Permit','Status']]
  .concat(list.map(p=>[p.date,p.field,TL.fmtTime(p.start),TL.fmtTime(p.end),p.team,p.coach,p.div,p.prog,p.permit,p.status])));

/* ------------------------------------------------------------ the index
   Built once per load. Answers: what does MCLL hold on this field today,
   and what is left after games and practices. */
FD.index=function(permits,practices){
  const I={permits:permits||[],practices:practices||[],byDay:{},pracByDay:{},known:new Set(),dates:new Set(),pracDates:new Set()};
  I.permits.forEach(p=>{ I.known.add(p.field); I.dates.add(p.date);
    const k=p.date+'|'+p.field; (I.byDay[k]=I.byDay[k]||[]).push(p); });
  Object.values(I.byDay).forEach(l=>l.sort((a,b)=>a.start-b.start));
  /* which programs' permits are in the file - blank Program means every program */
  I.progs=new Set(I.permits.map(p=>p.prog||'*'));
  I.covers=prog=>I.progs.has('*')||I.progs.has(prog);
  I.practices.forEach(p=>{ I.pracDates.add(p.date); (I.pracByDay[p.date]=I.pracByDay[p.date]||[]).push(p); });
  /* permit windows on a field and date, overlapping rows merged; a window is
     'Game' if any game permit covers it */
  I.windows=function(date,field){
    const l=I.byDay[date+'|'+field]||[], out=[];
    l.forEach(p=>{ const w=out[out.length-1];
      if(w&&p.start<=w.end&&p.use===w.use){ w.end=Math.max(w.end,p.end); w.rows.push(p); }
      else out.push({start:p.start,end:p.end,use:p.use,rows:[p]}); });
    return out;
  };
  I.fieldsOn=function(date){ return [...new Set(I.permits.filter(p=>p.date===date).map(p=>p.field))]; };
  I.practicesOn=function(date,field){ return (I.pracByDay[date]||[]).filter(p=>!field||p.field===field); };
  /* last date before, and next date after, that this field had a permit */
  I.nearest=function(date,field){
    let prev=null,next=null;
    I.permits.forEach(p=>{ if(p.field!==field) return;
      if(p.date<date&&(!prev||p.date>prev)) prev=p.date; if(p.date>date&&(!next||p.date<next)) next=p.date; });
    return {prev,next};
  };
  /* open time: permit windows minus whatever is booked.
     opts: games (all games that day), practicesBusy (default true),
           practicePermits (count practice-permit time as open, default true),
           cap (latest usable minute, e.g. sunset + grace on an unlit field) */
  I.free=function(date,field,opts){
    opts=opts||{};
    let wins=I.windows(date,field).filter(w=>opts.practicePermits!==false||w.use==='Game')
      .map(w=>({start:w.start,end:Math.min(w.end,opts.cap==null?w.end:opts.cap),use:w.use})).filter(w=>w.end>w.start);
    const busy=(opts.games||[]).filter(g=>g.loc===field&&g.start!=null&&g.end>g.start).map(g=>[g.start,g.end]);
    if(opts.practicesBusy!==false) I.practicesOn(date,field).forEach(p=>busy.push([p.start,p.end]));
    busy.sort((a,b)=>a[0]-b[0]);
    const out=[];
    wins.forEach(w=>{ let c=w.start;
      busy.forEach(([s,e])=>{ if(e<=c||s>=w.end) return; if(s>c) out.push({start:c,end:s,use:w.use}); c=Math.max(c,e); });
      if(c<w.end) out.push({start:c,end:w.end,use:w.use}); });
    return out;
  };
  return I;
};

root.FD=FD;
if(typeof module!=='undefined') module.exports=FD;
})(typeof window!=='undefined'?window:globalThis);
