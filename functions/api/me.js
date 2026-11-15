import {readSession,json,setup} from '../../server/auth.js';
/* Who is signed in. Always answers, so the page knows sign-in exists here. */
export async function onRequestGet({request,env}){
  return json({user:await readSession(request,env),setup:setup(env)});
}
