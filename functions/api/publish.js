import {readSession,botOK,sameOrigin,json} from '../../server/auth.js';
/* Publish a schedule, permit or practice file for everyone.

   The file is committed to the GitHub repository (data/...). Cloudflare
   redeploys on every commit, so the change is live in about a minute and every
   version stays in the repository's history.

   Who may publish:
     - someone signed in on the schedule page (POST from the page, JSON body)
     - a bot holding BOT_TOKEN:
         POST /api/publish?kind=schedule
         Authorization: Bearer <BOT_TOKEN>
         Content-Type: text/csv
         <the TeamLinkt export, unmodified>                                    */
const FILES={schedule:'data/schedule.csv',permits:'data/permits.csv',practices:'data/practices.csv'};
const SCHED_HEAD=['Date','Start Time','End Time','Location','Group','Event Type','Notes','Home Team','Away Team'];
const MAX_BYTES=3*1024*1024;

/* rows of a CSV, quotes and embedded newlines respected */
function parseCsv(t){
  const rows=[]; let row=[],cell='',q=false; t=String(t).replace(/^﻿/,'');
  for(let i=0;i<t.length;i++){ const c=t[i];
    if(q){ if(c==='"'){ if(t[i+1]==='"'){ cell+='"'; i++; } else q=false; } else cell+=c; }
    else if(c==='"') q=true; else if(c===','){ row.push(cell); cell=''; }
    else if(c==='\n'||c==='\r'){ if(c==='\r'&&t[i+1]==='\n') i++; row.push(cell); cell=''; if(row.some(x=>x.trim())) rows.push(row); row=[]; }
    else cell+=c; }
  row.push(cell); if(row.some(x=>x.trim())) rows.push(row);
  return rows;
}
function check(kind,csv){
  const rows=parseCsv(csv); if(rows.length<2) return {error:'The file has no rows.'};
  const head=rows[0].map(h=>h.trim().toLowerCase());
  if(kind==='schedule'){
    const miss=SCHED_HEAD.filter(h=>!head.includes(h.toLowerCase()));
    if(miss.length) return {error:`Not a full TeamLinkt schedule export - missing columns: ${miss.join(', ')}.`};
  } else {
    if(!head.includes('field')) return {error:'Expected a Field column.'};
    if(!head.includes('date')&&!head.includes('day')) return {error:'Expected a Date column (or Day with First and Last).'};
    if(kind==='practices'&&!head.includes('team')&&!head.includes('coach')) return {error:'Expected a Team or Coach column.'};
  }
  return {rows:rows.length-1};
}
const toB64=s=>{ const b=new TextEncoder().encode(s); let o=''; for(let i=0;i<b.length;i+=0x8000) o+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000)); return btoa(o); };
const fromB64=s=>{ const bin=atob(String(s).replace(/\s/g,'')); const b=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) b[i]=bin.charCodeAt(i); return new TextDecoder().decode(b); };

async function gh(env,path,init){
  const repo=env.GITHUB_REPO||'gbussey-star/MCLL-Schedule';
  return fetch(`https://api.github.com/repos/${repo}/contents/${path}`,Object.assign({},init,{headers:{
    'Authorization':`Bearer ${env.GITHUB_TOKEN}`,'Accept':'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28','User-Agent':'mcll-schedule-site',
    ...(init&&init.body?{'Content-Type':'application/json'}:{})}}));
}

export async function onRequestPost({request,env}){
  /* who is asking */
  let who=await readSession(request,env), via='website';
  if(who&&!sameOrigin(request)) return json({error:'Publish from the schedule page.'},403);
  if(!who&&await botOK(request,env)){ who='bot'; via='bot key'; }
  if(!who) return json({error:'Sign in first.'},401);
  if(!env.GITHUB_TOKEN) return json({error:'Publishing is not set up yet (GITHUB_TOKEN is missing in Cloudflare).'},503);

  /* what they sent */
  let kind, csv, name='', force=false;
  const ct=request.headers.get('Content-Type')||'';
  if(/json/i.test(ct)){ let b={}; try{ b=await request.json(); }catch(e){ return json({error:'Could not read the request.'},400); }
    kind=b.kind; csv=b.csv; name=String(b.name||'').slice(0,120); force=!!b.force; }
  else { kind=new URL(request.url).searchParams.get('kind')||'schedule'; csv=await request.text(); name='upload'; }
  if(!FILES[kind]) return json({error:'kind must be schedule, permits or practices.'},400);
  if(typeof csv!=='string'||!csv.trim()) return json({error:'The file is empty.'},400);
  if(csv.length>MAX_BYTES) return json({error:'The file is too large.'},413);
  const c=check(kind,csv); if(c.error) return json({error:c.error},422);

  /* what is there now */
  const path=FILES[kind], branch=env.GITHUB_BRANCH||'main';
  const cur=await gh(env,`${path}?ref=${encodeURIComponent(branch)}`);
  let sha=null, oldText='';
  if(cur.ok){ const j=await cur.json(); sha=j.sha;
    if(j.content) oldText=fromB64(j.content);
    else if(j.download_url){ const r=await fetch(j.download_url); if(r.ok) oldText=await r.text(); } }
  else if(cur.status!==404){ return json({error:`GitHub refused the read (${cur.status}). Check GITHUB_TOKEN and GITHUB_REPO.`},502); }
  const norm=s=>s.replace(/\r\n/g,'\n').trim();
  if(oldText&&norm(oldText)===norm(csv)) return json({ok:true,unchanged:true,rows:c.rows});
  const was=oldText?Math.max(parseCsv(oldText).length-1,0):0;

  /* a schedule that suddenly loses a quarter of its games is usually a filtered export */
  if(kind==='schedule'&&was>=20&&c.rows<was*0.75&&!(force&&via==='website'))
    return json({error:`This file has ${c.rows} games; the published one has ${was}. It may be filtered to one division or a date range.`,
      needForce:via==='website',rows:c.rows,was},409);

  const put=await gh(env,path,{method:'PUT',body:JSON.stringify({
    message:`Publish ${kind} (${c.rows} rows) - ${who} via ${via}${name?' - '+name:''}`,
    content:toB64(csv),branch,...(sha?{sha}:{})})});
  if(!put.ok){ const t=await put.text(); return json({error:`GitHub refused the save (${put.status}).`,detail:t.slice(0,300)},502); }
  const pj=await put.json();
  return json({ok:true,rows:c.rows,was,commit:(pj.commit&&pj.commit.sha||'').slice(0,7),by:who});
}
