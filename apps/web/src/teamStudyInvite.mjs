const key='study-room:team-invite';
const lifetime=7*86400000;
export function isTeamInviteToken(value) { return typeof value==='string' && /^[a-f0-9]{64}$/.test(value); }
export function clearTeamInvite(storage) { try { storage?.removeItem(key); } catch {} }
export function readTeamInvite(storage,now=Date.now()) {
 try { const data=JSON.parse(storage?.getItem(key)??'null');
  if(isTeamInviteToken(data?.token) && Number.isFinite(data.expires) && data.expires>now && data.expires<=now+lifetime)return data.token;
 } catch {}
 clearTeamInvite(storage);return null;
}
export function captureTeamInvite({hash,storage,now=Date.now(),replaceHash=()=>{}}) {
 if(String(hash).startsWith('#together?')) {
  const value=new URLSearchParams(hash.slice(hash.indexOf('?')+1)).get('invite');
  if(value!==null){replaceHash('#together');
   if(isTeamInviteToken(value)){try{storage?.setItem(key,JSON.stringify({token:value,expires:now+lifetime}));}catch{}return value;}
  }
 }
 return readTeamInvite(storage,now);
}
export function getTeamInviteStorage() { try{return window.sessionStorage;}catch{return undefined;} }
