import test from 'node:test';
import assert from 'node:assert/strict';
import {seal,unseal,googlePages,calendarEvent,safeSource,redactSource,repositoryTasks} from './coach-integrations-core.mjs';
import {dueKind,eligibleTargets,quiet,pushEndpointAllowed} from './coach-notifications-core.mjs';
test('credentials authenticated encryption binds owner and rejects tampering',async()=>{const key=Buffer.alloc(32,2).toString('base64');const encrypted=await seal({token:'private'},key,'user:google');assert.deepEqual(await unseal(encrypted,key,'user:google'),{token:'private'});await assert.rejects(()=>unseal(encrypted,key,'other:google'));});
test('all pages required; partial failure rejects snapshot input',async()=>{let calls=0;await assert.rejects(()=>googlePages('https://www.googleapis.com/calendar/v3/test','token',async()=>{calls++;return calls===1?new Response(JSON.stringify({items:[{id:'a'}],nextPageToken:'b'})):new Response('',{status:500});}));assert.equal(calls,2);});
test('google cancelled/transparent ignored and date-only retained',()=>{assert.equal(calendarEvent({status:'cancelled'},'a','Asia/Seoul'),null);const e=calendarEvent({id:'x',start:{date:'2026-09-01'},end:{date:'2026-09-02'}},'a','Asia/Tokyo');assert.equal(e.start_date,'2026-09-01');assert.equal(e.start_at,null);});
test('source allowlist excludes secrets generated files and large blobs',()=>{for(const path of ['.env','src/secret.ts','node_modules/a.ts','dist/a.js','x.pem'])assert.equal(safeSource(path,10),false);assert.equal(safeSource('src/a.ts',24001),false);assert.equal(safeSource('src/a.ts',10),true);assert.equal(redactSource('const token = "abcdefghij"'),false);});
test('repository evidence points at real fetched lines and max three',()=>{const result=repositoryTasks([{path:'src/a.ts',text:'// TODO improve\nfetch(url)'}],'abc');assert.equal(result.length,2);assert.equal(result[0].evidence[0].line,2);assert.equal(result[0].evidence[0].sha,'abc');});
test('no connected opted-in target means no dispatch or fallback',()=>{const targets=[{enabled:true,kind:'slack',destination:'C123'},{enabled:true,kind:'email',destination:'x@y.com'}];assert.deepEqual(eligibleTargets({enabled:true,channels:{}},targets,{email_reminders_enabled:true}),[]);assert.equal(eligibleTargets({enabled:true,channels:{email:true}},targets,{email_reminders_enabled:false}).length,0);assert.equal(eligibleTargets({enabled:true,channels:{slack:true}},targets,{}).length,1);});
test('quiet hours wrap midnight and opportunity local day',()=>{assert.equal(quiet('23:00','22:00','08:00'),true);assert.equal(quiet('10:00','22:00','08:00'),false);const s={enabled:true,quiet_start:'22:00',quiet_end:'08:00',summary_time:'09:00'};const r={status:'pending',local_date:'2026-09-06',start_at:'2026-09-06T01:10:00Z'};assert.equal(dueKind(s,r,new Date('2026-09-06T01:00:00Z'),'Asia/Seoul'),'opportunity');assert.equal(dueKind(s,{...r,status:'accepted'},new Date('2026-09-06T01:00:00Z'),'Asia/Seoul'),null);});
test('push SSRF endpoints rejected',()=>{assert.equal(pushEndpointAllowed({endpoint:'http://127.0.0.1/test'}),false);assert.equal(pushEndpointAllowed({endpoint:'https://fcm.googleapis.com/fcm/send/abc'}),true);assert.equal(pushEndpointAllowed({endpoint:'https://fcm.googleapis.com.evil.test'}),false);});

test('known credential formats and hidden credential directories never leave source filter',()=>{
  const values=[
    'const authorization = "ghp_'+ 'A'.repeat(36)+'"',
    'export const auth = "github_pat_'+ 'A'.repeat(40)+'"',
    'const key = "sk-or-v1-'+ 'a'.repeat(64)+'"',
    'const value = "xoxb-'+ '1234567890'.repeat(3)+'"',
    'const value = "AKIA'+ 'A'.repeat(16)+'"',
    'postgresql://user:pass123@localhost/database',
    'mongodb+srv://admin:pass123@cluster/database',
    '"password": "supersecretvalue"',
    '-----BEGIN RSA PRIVATE KEY-----',
    'AccountKey=long_connection_key;',
  ];
  for(const value of values)assert.equal(redactSource(value),false);
  for(const path of ['.aws/config.json','src/.credentials/config.json','.ssh/config.json','secrets/config.json','src/service-account.json','src\\.aws\\config.json'])assert.equal(safeSource(path,200),false);
  assert.equal(redactSource('export function add(a,b) { return a+b; }'),true);
});

import {configureEmailTarget,selectSnoozedRecommendation} from './coach-notifications-core.mjs';
function fakeEmailAdmin(){
  const calls=[];
  return {calls,from(table){const call={table,filters:[],operation:null,value:null};calls.push(call);const query={update(value){call.operation='update';call.value=value;return query;},upsert(value,options){call.operation='upsert';call.value=value;call.options=options;return query;},eq(key,value){call.filters.push([key,value]);return query;},then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject);}};return query;}};
}
test('email connect uses verified auth address and scopes every mutation to owner',async()=>{
  const admin=fakeEmailAdmin();const result=await configureEmailTarget(admin,{id:'owner',email:'Owner@example.com',email_confirmed_at:'2026-01-01'},true);
  assert.equal(result.connected,true);const upsert=admin.calls.find(c=>c.operation==='upsert');assert.equal(upsert.value.user_id,'owner');assert.equal(upsert.value.destination,'owner@example.com');assert.equal(upsert.options.onConflict,'user_id,kind,target_key');
  for(const call of admin.calls.filter(c=>c.operation==='update'))assert.ok(call.filters.some(([k,v])=>k==='user_id'&&v==='owner'));
  assert.ok(admin.calls.some(c=>c.table==='profiles'&&c.value.email_reminders_enabled===true));
});
test('unconfirmed email performs no writes; disconnect disables only own email target and flag',async()=>{
  const admin=fakeEmailAdmin();await assert.rejects(()=>configureEmailTarget(admin,{id:'owner',email:'x@example.com'},true));assert.equal(admin.calls.length,0);
  const result=await configureEmailTarget(admin,{id:'owner'},false);assert.equal(result.connected,false);assert.equal(admin.calls.some(c=>c.operation==='upsert'),false);assert.equal(admin.calls.find(c=>c.table==='profiles').value.email_reminders_enabled,false);assert.deepEqual(admin.calls.find(c=>c.table==='notification_targets').filters,[['user_id','owner'],['kind','email']]);
});
test('30 minute snooze uses new future recommendation rather than expired opportunity',()=>{
 const now=Date.parse('2026-09-06T10:30Z');const recs=[{id:'old',status:'pending',local_date:'2026-09-06',start_at:'2026-09-06T10:10Z'},{id:'accepted',status:'accepted',local_date:'2026-09-06',start_at:'2026-09-06T10:40Z'},{id:'new',status:'pending',local_date:'2026-09-06',start_at:'2026-09-06T10:35Z'}];
 assert.equal(selectSnoozedRecommendation(recs,'2026-09-06',now).id,'new');assert.equal(selectSnoozedRecommendation(recs.slice(0,2),'2026-09-06',now),null);
});

import {requestJson} from './coach-integrations-core.mjs';
test('provider streaming cap rejects before buffering oversized body',async()=>{
 let cancelled=false,pulls=0;
 const stream=new ReadableStream({pull(controller){pulls++;controller.enqueue(new Uint8Array(512*1024).fill(65));},cancel(){cancelled=true;}});
 await assert.rejects(()=>requestJson('https://example.test',{},async()=>new Response(stream)),/provider_response_too_large/);
 assert.equal(cancelled,true);assert.ok(pulls<=6);
});
test('caller deadline aborts provider body reading, not only fetch headers',async()=>{
 const controller=new AbortController();let cancelled=false;
 const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"unfinished":'));},cancel(){cancelled=true;}});
 const promise=requestJson('https://example.test',{signal:controller.signal},async()=>new Response(stream));
 setTimeout(()=>controller.abort(new Error('shared_deadline')),10);
 await assert.rejects(()=>promise,/shared_deadline/);assert.equal(cancelled,true);
});
test('already aborted caller prevents provider request',async()=>{
 const signal=AbortSignal.abort(new Error('stopped'));let calls=0;
 await assert.rejects(()=>requestJson('https://example.test',{signal},async()=>{calls++;return new Response('{}');}),/stopped/);assert.equal(calls,0);
});
test('calendar pagination fails closed above remaining total999 budget',async()=>{
 await assert.rejects(()=>googlePages('https://example.test','token',async()=>new Response(JSON.stringify({items:Array.from({length:1000},(_,id)=>({id}))}))),/calendar_too_large/);
 await assert.rejects(()=>googlePages('https://example.test','token',async()=>new Response(JSON.stringify({items:[{id:1},{id:2}]})),{maxItems:1}),/calendar_too_large/);
});
