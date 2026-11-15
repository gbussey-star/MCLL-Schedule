import {users,same,makeSession,sessionCookie,sameOrigin,json,sleep,SESSION_HOURS} from '../../server/auth.js';
export async function onRequestPost({request,env}){
  if(!sameOrigin(request)) return json({error:'Sign in from the schedule page.'},403);
  const U=users(env);
  if(!Object.keys(U).length) return json({error:'Sign-in is not set up yet (ADMIN_USERS is empty).'},503);
  let b={}; try{ b=await request.json(); }catch(e){}
  const name=String(b.user||'').trim().toLowerCase(), pw=String(b.password||'');
  /* always run one comparison so an unknown name takes as long as a wrong password */
  const ok=await same(pw,U[name]||'\u0000no-such-user')&&!!U[name];
  if(!ok){ await sleep(900); return json({error:'That name and password do not match.'},401); }
  return json({user:name},200,{'Set-Cookie':sessionCookie(await makeSession(name,env),SESSION_HOURS*3600)});
}
