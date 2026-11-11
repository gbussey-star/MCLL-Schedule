/* The rule check. Pure functions: games in, issues out. Runs on every change. */
(function(root){
'use strict';
const R={};
const fmt=m=>{const h=Math.floor(m/60),n=m%60;return `${(h%12)||12}:${String(n).padStart(2,'0')}${h<12?'am':'pm'}`;};

R.RULES=[
 {id:'field',lv:'bad',name:'One game per field at a time',why:'Checked across Upper County, Lower County and softball together - they share fields.'},
 {id:'team',lv:'bad',name:'No team in two places at once',why:'A team listed in two games whose times overlap.'},
 {id:'coach',lv:'bad',name:'No coach in two places at once',why:'Coaches with two teams are listed in js/config.js (coachLinks).'},
 {id:'time',lv:'bad',name:'Sensible start and end',why:'End before start, or a game longer than four hours.'},
 {id:'gap',lv:'warn',name:'Time between a coach’s games',why:'30 minutes on one field, 45 when the coach changes fields.'},
 {id:'coachq',lv:'warn',name:'Possible shared coach',why:'Two teams end in the same surname and are booked at the same time. A guess - ignore it if they are different people.'},
 {id:'dh',lv:'warn',name:'No doubleheaders',why:'A team playing twice on one date.'},
 {id:'sunset',lv:'warn',name:'Finish by sunset',why:'More than 15 minutes past sunset on a field not marked as lit.'},
 {id:'tba',lv:'warn',name:'Every game has a field and a time',why:'Location is blank or TBA, or the start time is still 12:00 am.'},
 {id:'row',lv:'warn',name:'Complete rows',why:'A game missing its group or a team in TeamLinkt.'},
 {id:'count',lv:'warn',name:'Even game counts',why:'A team with more or fewer games than most of its division.'}
];

/* sunset in minutes after local midnight, US Eastern */
R.sunset=function(dstr,lat,lon){
  const [Y,M,D]=dstr.split('-').map(Number);
  const jd=Date.UTC(Y,M-1,D)/86400000+2440587.5;
  const k=Math.round(jd-2451545+0.0008-lon/360), Js=k-lon/360, rad=Math.PI/180;
  const Mn=(357.5291+0.98560028*Js)%360;
  const C=1.9148*Math.sin(Mn*rad)+0.02*Math.sin(2*Mn*rad)+0.0003*Math.sin(3*Mn*rad);
  const lam=(Mn+C+180+102.9372)%360;
  const Jt=2451545+Js+0.0053*Math.sin(Mn*rad)-0.0069*Math.sin(2*lam*rad);
  const dec=Math.asin(Math.sin(lam*rad)*Math.sin(23.4397*rad));
  const cw=(Math.sin(-0.833*rad)-Math.sin(lat*rad)*Math.sin(dec))/(Math.cos(lat*rad)*Math.cos(dec));
  const w=Math.acos(Math.max(-1,Math.min(1,cw)))/rad;
  const utc=new Date(((Jt+w/360)-2440587.5)*86400000);
  const nth=(mo,nn)=>{const d=new Date(Date.UTC(Y,mo,1));return 1+((7-d.getUTCDay())%7)+7*(nn-1);};
  const dst=(M>3&&M<11)||(M===3&&D>=nth(2,2))||(M===11&&D<nth(10,1));
  const loc=new Date(utc.getTime()+(dst?-4:-5)*3600000);
  return loc.getUTCHours()*60+loc.getUTCMinutes();
};

const STOP=new Set(['team','softball','baseball','black','white','orange','columbia','vegas','majors','minors','juniors','seniors','city','hill']);
R.surname=function(team){
  const seg=String(team||'').split(/\s*-\s*/).filter(Boolean); if(seg.length<2) return '';
  const w=(seg[seg.length-1].match(/^[A-Za-z']+/)||[''])[0];
  return w.length>=4&&!STOP.has(w.toLowerCase())?w.toLowerCase():'';
};
const noField=l=>!l||/^tba$/i.test(l.trim());
/* TeamLinkt holds with no time yet come out as 12:00 am */
R.noTime=g=>g.start===0;

/* opts: { cfg, lit:fn(name)->bool, programOf:fn(game)->id } */
R.validate=function(G,opts){
  const cfg=opts.cfg, out=[];
  const lv=Object.fromEntries(R.RULES.map(r=>[r.id,r.lv]));
  const push=(id,date,ids,t)=>out.push({id,lv:lv[id],date,ids,t});
  const vs=g=>g.away?`${g.home} v ${g.away}`:(g.home||g.type);

  /* who coaches what: explicit links first, surname guesses second */
  const person={}, sure={};
  (cfg.coachLinks||[]).forEach((list,i)=>list.forEach(t=>{ person[t.replace(/\s+/g,' ')]='link'+i; sure['link'+i]=true; }));
  const key=t=>t.replace(/\s+/g,' ');
  const byName={};
  G.forEach(g=>[g.home,g.away].forEach(t=>{ if(!t||person[key(t)]) return;
    const s=R.surname(t); if(s){ const k=opts.programOf(g)+':'+s; (byName[k]=byName[k]||new Set()).add(key(t)); } }));
  Object.entries(byName).forEach(([k,set])=>{ if(set.size>1) set.forEach(t=>person[t]=k); });

  const byDate={};
  G.forEach(g=>{ (byDate[g.date]=byDate[g.date]||[]).push(g);
    if(R.noTime(g)) push('tba',g.date,[g.id],`${vs(g)} has no start time yet${g.notes?` (${g.notes})`:''}.`);
    else if(g.end<=g.start||g.end-g.start>240) push('time',g.date,[g.id],`${vs(g)} runs ${fmt(g.start)}–${fmt(g.end)}.`);
    if(noField(g.loc)) push('tba',g.date,[g.id],`${vs(g)} has no field yet.`);
    if(/game/i.test(g.type)&&(!g.home||!g.away||!g.group||g.groupGuess))
      push('row',g.date,[g.id],`${vs(g)} is missing its ${!g.home||!g.away?'opponent':'group'} in TeamLinkt${g.groupGuess?` (shown under ${g.group})`:''}.`);
  });

  for(const d in byDate){
    const list=byDate[d].filter(g=>!R.noTime(g)), ss=R.sunset(d,cfg.lat,cfg.lon);
    const byField={};
    list.forEach(g=>{ if(!noField(g.loc)) (byField[g.loc]=byField[g.loc]||[]).push(g); });
    for(const f in byField){
      const arr=byField[f].sort((a,b)=>a.start-b.start);
      for(let i=0;i<arr.length-1;i++) for(let j=i+1;j<arr.length&&arr[j].start<arr[i].end;j++)
        push('field',d,[arr[i].id,arr[j].id],arr[i].start===arr[j].start
          ?`${f} has two bookings at ${fmt(arr[i].start)} — ${vs(arr[i])} and ${vs(arr[j])}.`
          :`${f} is double-booked at ${fmt(arr[j].start)} — ${vs(arr[i])} has it until ${fmt(arr[i].end)}, ${vs(arr[j])} starts.`);
      if(!opts.lit(f)) arr.forEach(g=>{ if(g.end>ss+cfg.sunsetGrace)
        push('sunset',d,[g.id],`${vs(g)} ends ${fmt(g.end)} at ${f}, ${g.end-ss} min after sunset (${fmt(ss)}).`); });
    }
    const teams={}, people={};
    list.forEach(g=>[g.home,g.away].forEach(t=>{ if(!t) return;
      (teams[key(t)]=teams[key(t)]||[]).push(g);
      const p=person[key(t)]; if(p) (people[p]=people[p]||[]).push({g,t:key(t)}); }));
    for(const t in teams){ const a=teams[t].sort((x,y)=>x.start-y.start); if(a.length<2) continue;
      let overlap=false;
      for(let i=0;i<a.length-1;i++) if(a[i+1].start<a[i].end){ overlap=true;
        push('team',d,[a[i].id,a[i+1].id],`${t} is in two games at once — ${a[i].loc} and ${a[i+1].loc}.`); }
      if(!overlap) push('dh',d,a.map(g=>g.id),`${t} plays ${a.length===2?'twice':a.length+' times'} — ${a.map(g=>fmt(g.start)).join(' and ')}.`);
    }
    for(const p in people){ const a=people[p].sort((x,y)=>x.g.start-y.g.start);
      for(let i=0;i<a.length-1;i++){ const x=a[i], y=a[i+1];
        if(x.t===y.t||x.g===y.g) continue;
        const gap=y.g.start-x.g.end, need=x.g.loc===y.g.loc?cfg.minGap:cfg.travelGap;
        const who=sure[p]?'The coach of':'Possibly one coach:';
        if(gap<0) push(sure[p]?'coach':'coachq',d,[x.g.id,y.g.id],`${who} ${x.t} and ${y.t} ${sure[p]?'is':'are'} booked at ${x.g.loc} and ${y.g.loc} at the same time.`);
        else if(gap<need&&sure[p]) push('gap',d,[x.g.id,y.g.id],`The coach of ${x.t} and ${y.t} gets ${gap} min between ${x.g.loc} and ${y.g.loc} — needs ${need}.`);
      } }
  }

  const c=R.counts(G);
  Object.entries(c).forEach(([grp,teams])=>{
    const vals=Object.values(teams).map(x=>x.n); if(vals.length<3) return;
    const freq={}; vals.forEach(v=>freq[v]=(freq[v]||0)+1);
    const mode=+Object.entries(freq).sort((a,b)=>b[1]-a[1]||b[0]-a[0])[0][0];
    Object.entries(teams).forEach(([t,x])=>{ if(x.n!==mode&&!x.guest)
      out.push({id:'count',lv:'warn',date:'',ids:x.ids,group:grp,t:`${t} has ${x.n} games; most of ${grp.replace(/^\w+ - /,'')} has ${mode}.`}); });
  });
  out.sort((a,b)=>(a.lv===b.lv?String(a.date||'9').localeCompare(String(b.date||'9')):a.lv==='bad'?-1:1));
  return out;
};

/* games per team, by group. A team is counted under the group it plays most in;
   a visiting team with one or two games in a group is a guest there. */
R.counts=function(G){
  const home={}, by={};
  const games=G.filter(g=>/game/i.test(g.type)&&g.home&&g.away&&g.group&&!/^tba$/i.test(g.away)&&!/^tba$/i.test(g.home));
  games.forEach(g=>[g.home,g.away].forEach(t=>{ (home[t]=home[t]||{})[g.group]=(home[t][g.group]||0)+1; }));
  const main=t=>Object.entries(home[t]).sort((a,b)=>b[1]-a[1])[0][0];
  games.forEach(g=>[[g.home,'h'],[g.away,'a']].forEach(([t,side])=>{
    const grp=main(t), x=((by[grp]=by[grp]||{})[t]=by[grp][t]||{n:0,h:0,a:0,ids:[]});
    x.n++; x[side]++; x.ids.push(g.id); }));
  Object.values(by).forEach(teams=>{ const ns=Object.values(teams).map(x=>x.n).sort((a,b)=>a-b);
    const med=ns[Math.floor(ns.length/2)];
    Object.values(teams).forEach(x=>{ x.guest=med>=5&&x.n<=2; }); });
  return by;
};

root.RULES=R;
if(typeof module!=='undefined') module.exports=R;
})(typeof window!=='undefined'?window:globalThis);
