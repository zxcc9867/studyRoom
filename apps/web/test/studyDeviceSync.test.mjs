import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudyDeviceSync, getSharedCameraView } from '../src/studyDeviceSync.mjs';

const instant = Date.parse('2026-10-18T10:00:00Z');
function snapshot(overrides = {}) {
  const session = {id:'session',user_id:'owner',status:'active',started_at:'2026-10-18T09:00:00Z',ended_at:null,paused_at:null,lease_expires_at:'2026-10-18T11:00:00Z'};
  return {server_now:new Date(instant).toISOString(),received_at_ms:instant,active_session:session,session,tracking:{session_id:'session',excluded_seconds:20,todos:[]},camera:{session_id:'session',owner_client_id:'pc',generation:3,device_type:'browser',status:'watching',last_seen_at:new Date(instant).toISOString(),expires_at:new Date(instant+45000).toISOString(),absence_seconds:0,excluded_seconds:20,is_owner:false},...overrides};
}

test('remote healthy camera never requires local camera or allows camera publishing',()=>{
  const result=getSharedCameraView(snapshot(),'phone',instant);
  assert.equal(result.remote,true);assert.equal(result.canPublish,false);assert.equal(result.cameraRequired,false);
  assert.equal(result.status,'watching');assert.match(result.label,/다른 기기.*감시 중/);
});
test('expired remote state is unknown, not proof of camera absence',()=>{
  const result=getSharedCameraView(snapshot(),'phone',instant+46000);
  assert.equal(result.status,'stale');assert.equal(result.cameraRequired,false);assert.match(result.label,/연결 확인/);
});
test('remote automatic exclusion projects only up to the last confirmed freshness deadline',()=>{
  const state=snapshot();state.camera.status='auto_paused';state.camera.absence_seconds=620;
  assert.equal(getSharedCameraView(state,'phone',instant+10000).excludedSeconds,30);
  assert.equal(getSharedCameraView(state,'phone',instant+120000).excludedSeconds,65);
});

test('observer exclusion begins at the auto-pause threshold when it falls after the last report',()=>{
 const state=snapshot();state.camera.status='auto_paused';state.camera.auto_paused_at=new Date(instant+5000).toISOString();
 assert.equal(getSharedCameraView(state,'phone',instant+10000).excludedSeconds,25);
});

test('observer exclusion stays capped at the lease deadline instead of disappearing at expiry',()=>{
 const state=snapshot();state.camera.status='auto_paused';state.camera.auto_paused_at=new Date(instant-1000).toISOString();state.active_session.lease_expires_at=new Date(instant+30000).toISOString();
 assert.equal(getSharedCameraView(state,'phone',instant+29000).excludedSeconds,49);
 assert.equal(getSharedCameraView(state,'phone',instant+30000).excludedSeconds,50);
 assert.equal(getSharedCameraView(state,'phone',instant+60000).excludedSeconds,50);
});
test('only the current camera owner gets the camera-required state',()=>{
  const state=snapshot();state.camera.status='off';state.camera.is_owner=true;
  assert.equal(getSharedCameraView(state,'pc',instant).cameraRequired,true);
  assert.equal(getSharedCameraView(state,'phone',instant).cameraRequired,false);
  state.active_session={...state.active_session,paused_at:new Date(instant).toISOString()};
  assert.equal(getSharedCameraView(state,'pc',instant).cameraRequired,false);
});
test('missing or failed initial coordination never invents local camera responsibility',()=>{
  assert.equal(getSharedCameraView(null,'phone',instant).cameraRequired,false);
  assert.equal(getSharedCameraView(snapshot({camera:null}),'phone',instant).canPublish,false);
});

test('shared timers use the server clock offset rather than a different device clock',()=>{
 const state=snapshot();state.received_at_ms=instant+3600000;
 assert.equal(getSharedCameraView(state,'phone',instant+3605000).clockMs,instant+5000);
});

function transport() {
  const pending=[],calls=[],received=[],errors=[];
  const client={rpc(name,args){calls.push({name,args});return new Promise((resolve,reject)=>pending.push({resolve,reject}));}};
  const sync=createStudyDeviceSync({client,userId:'owner',clientId:'phone',onSnapshot:value=>received.push(value),onError:error=>errors.push(error),now:()=>instant});
  return {sync,pending,calls,received,errors};
}
test('overlapping refresh signals coalesce into one trailing refresh',async()=>{
  const t=transport();const first=t.sync.refresh();void t.sync.refresh();void t.sync.refresh();
  assert.equal(t.calls.length,1);t.pending.shift().resolve({data:snapshot(),error:null});await first;await Promise.resolve();
  assert.equal(t.calls.length,2);t.pending.shift().resolve({data:snapshot({camera:null}),error:null});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(t.received.at(-1).camera,null);t.sync.dispose();
});
test('observer reporting is a no-op and cannot write camera exclusions',async()=>{
  const t=transport();const ready=t.sync.refresh();t.pending.shift().resolve({data:snapshot(),error:null});await ready;
  assert.equal(await t.sync.report('session',3,{status:'off',excludedSeconds:99}),null);
  assert.deepEqual(t.calls.map(call=>call.name),['study_device_snapshot']);t.sync.dispose();
});
test('a response from a disposed account cannot publish state or errors',async()=>{
  const t=transport();const waiting=t.sync.refresh();t.sync.dispose();t.pending.shift().resolve({data:snapshot(),error:null});await waiting;
  assert.equal(t.received.length,0);assert.equal(t.errors.length,0);
});
test('an older refresh cannot overwrite a newly claimed camera generation',async()=>{
  const t=transport();const old=t.sync.refresh();const claim=t.sync.claim('session',{takeover:true,deviceType:'android'});
  const claimed=snapshot();claimed.camera={...claimed.camera,owner_client_id:'phone',generation:4,is_owner:true};
  t.pending[1].resolve({data:{...claimed,accepted:true},error:null});await claim;
  t.pending[0].resolve({data:snapshot(),error:null});await old;
  assert.equal(t.received.at(-1).camera.generation,4);assert.equal(t.sync.read().camera.generation,4);t.sync.dispose();
});

test('an older report response cannot restore ownership after a newer remote takeover snapshot',async()=>{
 const t=transport();const ready=t.sync.refresh();const own=snapshot();own.camera={...own.camera,owner_client_id:'phone',is_owner:true};t.pending.shift().resolve({data:own,error:null});await ready;
 const report=t.sync.report('session',3,{status:'off',excludedSeconds:20});
 const refresh=t.sync.refresh();const remote=snapshot();remote.server_now=new Date(instant+2000).toISOString();remote.camera.generation=4;
 t.pending[1].resolve({data:remote,error:null});await refresh;
 t.pending[0].resolve({data:{...own,server_now:new Date(instant+1000).toISOString(),accepted:true},error:null});await report;
 assert.equal(t.sync.read().camera.owner_client_id,'pc');assert.equal(t.sync.read().camera.generation,4);t.sync.dispose();
});
test('an in-flight snapshot cannot overwrite a local lifecycle mutation',async()=>{
  let revision=0;const received=[];let release;
  const sync=createStudyDeviceSync({client:{rpc:()=>new Promise(resolve=>{release=resolve;})},userId:'owner',clientId:'phone',readRevision:()=>revision,onSnapshot:value=>received.push(value)});
  const request=sync.refresh();revision++;release({data:snapshot(),error:null});await request;
  assert.equal(received.length,0);sync.dispose();
});
test('camera reports are serialized so an older absent request cannot arrive after a newer present report',async()=>{
  const t=transport();const ready=t.sync.refresh();const own=snapshot();own.camera={...own.camera,owner_client_id:'phone',is_owner:true};t.pending.shift().resolve({data:own,error:null});await ready;
  const first=t.sync.report('session',3,{status:'absent',excludedSeconds:20});
  const second=t.sync.report('session',3,{status:'watching',excludedSeconds:20});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(t.calls.filter(call=>call.name==='study_camera_action').length,1);
  t.pending.shift().resolve({data:{...own,accepted:true},error:null});await first;
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(t.calls.at(-1).args.p_status,'watching');
  t.pending.shift().resolve({data:{...own,accepted:true},error:null});await second;t.sync.dispose();
});

test('a failed refresh keeps the last confirmed snapshot without inventing camera ownership',async()=>{
 const t=transport();const ready=t.sync.refresh();t.pending.shift().resolve({data:snapshot(),error:null});await ready;
 const current=t.sync.read();const failed=t.sync.refresh();t.pending.shift().reject(new Error('offline'));await failed;
 assert.equal(t.sync.read(),current);assert.equal(t.errors.length,1);
 assert.equal(getSharedCameraView(t.sync.read(),'phone',instant).canPublish,false);t.sync.dispose();
});
