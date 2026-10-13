import test from 'node:test';
import assert from 'node:assert/strict';
import * as team from '../src/teamStudyClient.mjs';
const snapshot={tag:null,team:null,members:[],invitations:[],invite_links:[],round:null,connection:null,forest:{accepted_seconds:0,pending_sessions:0,trees:0,progress_seconds:0},server_now:'2026-10-13T00:00:00Z'};
function boundary(){let user={id:'one',is_anonymous:false},calls=[],pending=[];return {calls,pending,setUser:v=>user=v,auth:{getSession:async()=>({data:{session:user?{user}:null}})},rpc:async(name,args)=>{calls.push({name,args});return new Promise(resolve=>pending.push(resolve));},channel(){return {on(){return this},subscribe(fn){fn('SUBSCRIBED');return this}}},removeChannel(){calls.push({name:'removeChannel'})}};}
test('guarded action rejects invalid token before any RPC and anonymous accounts',async()=>{
 const api=boundary(),client=team.createTeamStudyController(api,'one');
 await assert.rejects(client.action('accept_invite',{token:'bad'}),/유효/);assert.equal(api.calls.length,0);
 api.setUser({id:'one',is_anonymous:true});await assert.rejects(client.action('create_team',{name:'독서'}),/정식/);assert.equal(api.calls.length,0);client.dispose();
});
test('latest snapshot wins and identity changes discard private stale response',async()=>{
 const api=boundary(),seen=[],client=team.createTeamStudyController(api,'one',{onState:s=>seen.push(s)});
 const first=client.refresh();await new Promise(r=>setImmediate(r));const second=client.refresh();await new Promise(r=>setImmediate(r));
 api.pending[1]({data:{...snapshot,tag:'새로#확인'},error:null});await second;
 api.pending[0]({data:{...snapshot,tag:'이전#확인'},error:null});await first;
 assert.equal(seen.at(-1).snapshot.tag,'새로#확인');
 const stale=client.refresh();await new Promise(r=>setImmediate(r));api.setUser({id:'two'});api.pending[2]({data:{...snapshot,tag:'누출#금지'},error:null});await stale;
 assert.equal(seen.at(-1).snapshot,null);client.dispose();
});
test('snapshot exposes only member projection and realtime cleanup follows route disposal',async()=>{
 const api=boundary(),seen=[],client=team.createTeamStudyController(api,'one',{onState:s=>seen.push(s)});
 const request=client.refresh();await new Promise(r=>setImmediate(r));
 api.pending[0]({data:{...snapshot,team:{id:'team',name:'책방',owner_id:'one',member_count:1,time_zone:'Asia/Tokyo'},members:[{user_id:'one',display_name:'나',state:'studying',share_title:false,title:'비공개 제목',email:'private@example.test',recovery:'private'}]},error:null});await request;
 assert.equal('email' in seen.at(-1).snapshot.members[0],false);assert.equal('recovery' in seen.at(-1).snapshot.members[0],false);
 assert.equal(seen.at(-1).snapshot.members[0].title,null);
 client.dispose();assert.equal(api.calls.filter(c=>c.name==='removeChannel').length,1);
});
test('transport exceptions never expose raw backend exception text',async()=>{
 const api=boundary(),seen=[],client=team.createTeamStudyController(api,'one',{onState:s=>seen.push(s)});api.rpc=async()=>{throw new Error('PRIVATE_BACKEND_SQL');};await client.refresh();assert.doesNotMatch(seen.at(-1).error,/PRIVATE_BACKEND_SQL/);client.dispose();
});
test('healthy realtime still polls membership loss; fallback and disposal are bounded',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:Date.parse('2026-10-13T00:00:00Z')});
 const api=boundary(),seen=[];let current={...snapshot,team:{id:'team',name:'책방',owner_id:'one',member_count:1,time_zone:'Asia/Tokyo'}};
 api.rpc=async(name)=>{api.calls.push({name});return {data:current,error:null};};
 const client=team.createTeamStudyController(api,'one',{onState:s=>seen.push(s)});client.start();await new Promise(r=>setImmediate(r));t.mock.timers.tick(200);await new Promise(r=>setImmediate(r));const initial=api.calls.filter(c=>c.name==='team_study_snapshot').length;
 t.mock.timers.tick(15000);await new Promise(r=>setImmediate(r));assert.equal(api.calls.filter(c=>c.name==='team_study_snapshot').length,initial);
 current=snapshot;t.mock.timers.tick(15000);await new Promise(r=>setImmediate(r));assert.equal(seen.at(-1).snapshot.team,null);assert.equal(api.calls.filter(c=>c.name==='removeChannel').length,1);
 const after=api.calls.filter(c=>c.name==='team_study_snapshot').length;t.mock.timers.tick(15000);await new Promise(r=>setImmediate(r));assert.equal(api.calls.filter(c=>c.name==='team_study_snapshot').length,after+1);
 client.dispose();t.mock.timers.tick(60000);assert.equal(api.calls.filter(c=>c.name==='team_study_snapshot').length,after+1);
});
test('snapshot revision is rechecked after delayed post-response authentication',async()=>{
 const api=boundary(),seen=[];let checks=0,releaseOldAuth;
 api.auth.getSession=async()=>{checks++;if(checks===2)return new Promise(resolve=>{releaseOldAuth=()=>resolve({data:{session:{user:{id:'one',is_anonymous:false}}}});});return {data:{session:{user:{id:'one',is_anonymous:false}}}};};
 const client=team.createTeamStudyController(api,'one',{onState:s=>seen.push(s)});
 const older=client.refresh();await new Promise(r=>setImmediate(r));api.pending[0]({data:{...snapshot,tag:'이전#책방'},error:null});await new Promise(r=>setImmediate(r));assert.equal(typeof releaseOldAuth,'function');
 const newer=client.refresh();await new Promise(r=>setImmediate(r));api.pending[1]({data:{...snapshot,tag:'새로#책방'},error:null});await newer;assert.equal(seen.at(-1).snapshot.tag,'새로#책방');
 releaseOldAuth();await older;assert.equal(seen.at(-1).snapshot.tag,'새로#책방');client.dispose();
});
