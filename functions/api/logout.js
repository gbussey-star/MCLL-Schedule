import {sessionCookie,json} from '../../server/auth.js';
export async function onRequestPost(){ return json({user:null},200,{'Set-Cookie':sessionCookie('',0)}); }
