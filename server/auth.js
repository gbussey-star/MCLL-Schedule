/* Shared by the functions in /functions/api. Runs on Cloudflare Pages.
   Nothing secret lives in this file: passwords, the bot key and the GitHub
   token are Cloudflare secrets (Settings -> Variables and secrets).

   ADMIN_USERS     name:password pairs, comma separated   e.g. george:...,jay:...
   SESSION_SECRET  optional; any long random text (signs the sign-in cookie)
   BOT_TOKEN       optional; a long random key for a bot that posts files directly
   GITHUB_TOKEN    fine-grained token, this repository only, Contents: read and write
   GITHUB_REPO     plain variable, default gbussey-star/MCLL-Schedule
   GITHUB_BRANCH   plain variable, default main */
const enc=new TextEncoder();
const b64u=bytes=>{ let s=''; const a=new Uint8Array(bytes); for(let i=0;i<a.length;i++) s+=String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); };
const unb64u=s=>{ s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='='; return atob(s); };

export function users(env){
  const out={};
  String(env.ADMIN_USERS||'').split(/[,\n]/).forEach(p=>{ const i=p.indexOf(':'); if(i<1) return;
    const u=p.slice(0,i).trim().toLowerCase(), pw=p.slice(i+1).trim(); if(u&&pw) out[u]=pw; });
  return out;
}
/* equal-length digests compared without an early exit */
export async function same(a,b){
  const [x,y]=await Promise.all([a,b].map(s=>crypto.subtle.digest('SHA-256',enc.encode(String(s)))));
  const A=new Uint8Array(x), B=new Uint8Array(y); let d=0; for(let i=0;i<A.length;i++) d|=A[i]^B[i]; return d===0;
}
async function hmac(key,msg){
  const k=await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return b64u(await crypto.subtle.sign('HMAC',k,enc.encode(msg)));
}
const secret=env=>env.SESSION_SECRET||('mcll-session|'+(env.ADMIN_USERS||''));
export const SESSION_HOURS=12;
export async function makeSession(user,env){
  const body=`${user}|${Date.now()+SESSION_HOURS*3600e3}`;
  return `${b64u(enc.encode(body))}.${await hmac(secret(env),body)}`;
}
export async function readSession(request,env){
  const c=(request.headers.get('Cookie')||'').split(/;\s*/).find(s=>s.startsWith('mcll_session='));
  if(!c) return null;
  const [b,sig]=c.slice('mcll_session='.length).split('.'); if(!b||!sig) return null;
  let body; try{ body=unb64u(b); }catch(e){ return null; }
  if(!(await same(await hmac(secret(env),body),sig))) return null;
  const i=body.lastIndexOf('|'), user=body.slice(0,i), exp=Number(body.slice(i+1));
  if(!exp||Date.now()>exp||!users(env)[user]) return null;   // removing a user ends their session
  return user;
}
export const sessionCookie=(v,maxAge)=>`mcll_session=${v}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
export async function botOK(request,env){
  const m=(request.headers.get('Authorization')||'').match(/^Bearer\s+(\S+)/i);
  return !!(env.BOT_TOKEN&&m&&await same(m[1],env.BOT_TOKEN));
}
/* a signed-in browser request must come from this site's own pages */
export function sameOrigin(request){
  const o=request.headers.get('Origin'); if(!o) return false;
  try{ return new URL(o).host===new URL(request.url).host; }catch(e){ return false; }
}
export const json=(o,status=200,headers={})=>new Response(JSON.stringify(o),
  {status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
export const setup=env=>({login:Object.keys(users(env)).length>0,publish:!!env.GITHUB_TOKEN,bot:!!env.BOT_TOKEN});
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
