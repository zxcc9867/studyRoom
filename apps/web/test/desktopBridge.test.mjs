import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDeviceStudyTracker } from '../src/deviceStudyActivity.mjs';
let api;
try { api = await import('../src/desktopBridge.mjs'); } catch {}
const tick = () => new Promise(resolve => setImmediate(resolve));
async function waitState(states, status) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (states.at(-1)?.status === status) return;
    await tick();
  }
  assert.equal(states.at(-1)?.status, status);
}
function host() {
  const listeners = new Set(), calls = [];
  const h = { location: { origin: 'https://study-room-attendance.vercel.app' }, crypto: { randomUUID },
    studyRoomDesktop: { protocolVersion: 1, request: async m => { calls.push(m); return { id: m.id, ok: true, value: {} }; },
      onEvent: fn => { listeners.add(fn); return () => listeners.delete(fn); } } };
  h.top = h;
  return { h, calls, emit: m => [...listeners].forEach(fn => fn(m)) };
}
test('desktop bridge rejects spoof origins, old protocols and subframes', () => {
  assert.ok(api, 'desktop bridge implementation is missing');
  const { h } = host(); assert.equal(api.isDesktopStudyApp(h), true);
  h.location.origin = 'https://evil.invalid'; assert.equal(api.isDesktopStudyApp(h), false);
  h.location.origin = 'https://study-room-attendance.vercel.app'; h.top = {}; assert.equal(api.isDesktopStudyApp(h), false);
  h.top = h; h.studyRoomDesktop.protocolVersion = 0; assert.equal(api.isDesktopStudyApp(h), false);
});
test('desktop request validates reply correlation, native failures and timeouts', async () => {
  assert.ok(api, 'desktop bridge implementation is missing');
  const { h, calls } = host(); await api.desktopRequest(h, 'info', {});
  assert.match(calls[0].id, /^[a-f0-9-]{36}$/);
  h.studyRoomDesktop.request = async () => ({ id: 'other', ok: true, value: {} });
  await assert.rejects(api.desktopRequest(h, 'info', {}), /DESKTOP_REPLY/);
  h.studyRoomDesktop.request = async m => ({ id: m.id, ok: false, error: 'AUTH_BUSY' });
  await assert.rejects(api.desktopRequest(h, 'info', {}), /AUTH_BUSY/);
  h.studyRoomDesktop.request = () => new Promise(() => {});
  await assert.rejects(api.desktopRequest(h, 'info', {}, { timeoutMs: 5 }), /DESKTOP_TIMEOUT/);
});
test('fresh native probes read current pending state and echo only the requested envelope id', async () => {
  assert.ok(api, 'desktop bridge implementation is missing');
  const { h, calls, emit } = host(); let pending = false;
  const tracker = { check: (s, session) => { assert.equal(session, s.session); return s.operationPending ? 'studying' : 'allowed'; } };
  const stop = api.bindDesktopStudy(h, () => ({ userId: 'a', ready: true, session: null, cameraActive: false, operationPending: pending }), tracker, () => {});
  pending = true; emit({ type: 'state-requested', requestId: 'quit-state-3' }); await tick();
  const probe = calls.find(c => c.id === 'quit-state-3'); assert.equal(probe.payload.operationPending, true); assert.equal(probe.payload.activity, 'allowed');
  assert.equal(calls.filter(c => c.action !== 'studyState').length, 0); stop();
});
test('camera-only preparation and observer writes do not become local session engagement', async () => {
  const { h, calls, emit } = host();
  const tracker = { check: s => s.operationPending || s.cameraActive ? 'studying' : 'allowed' };
  let state = {userId:'a',ready:true,session:null,cameraActive:true,operationPending:false};
  const stop=api.bindDesktopStudy(h,()=>state,tracker,()=>{});
  emit({type:'state-requested',requestId:'camera-only'});await tick();
  assert.equal(calls.find(c=>c.id==='camera-only').payload.activity,'allowed');
  state={...state,session:{id:'remote',paused:false},cameraActive:false,operationPending:true};
  emit({type:'state-requested',requestId:'observer-write'});await tick();
  assert.equal(calls.find(c=>c.id==='observer-write').payload.activity,'allowed');stop();
});
test('real camera preparation can request cleanup but after stop must independently prove idle', async () => {
  const {h,calls,emit}=host(),values=new Map();
  const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  const tracker=createDeviceStudyTracker(storage);tracker.prepare('a',false);
  let state={userId:'a',ready:true,session:null,cameraActive:true,operationPending:false};
  const stop=api.bindDesktopStudy(h,()=>state,tracker,()=>{});
  try {
    emit({type:'state-requested',requestId:'camera-preparation'});await tick();
    assert.equal(calls.find(c=>c.id==='camera-preparation').payload.activity,'allowed');
    state={...state,cameraActive:false};emit({type:'state-requested',requestId:'stopped-unproven'});await tick();
    assert.equal(calls.find(c=>c.id==='stopped-unproven').payload.activity,'unknown');
    tracker.observe('a',null);emit({type:'state-requested',requestId:'stopped-proven'});await tick();
    assert.equal(calls.find(c=>c.id==='stopped-proven').payload.activity,'allowed');
  } finally {stop();}
});
function authFixture(initial = 'a') {
  const f = host(); let native = initial, session = { user: { id: 'stale' } }, callback = () => {}; const localScopes = [];
  f.h.studyRoomDesktop.request = async m => {
    f.calls.push(m);
    const value = m.action === 'authStatus' ? { userId: native } : m.action === 'webTicket'
      ? { type: 'STUDY_WEB_AUTH_TICKET', requestId: m.id, userId: native, tokenHash: native } : {};
    if (m.action === 'signOut') native = null;
    return { id: m.id, ok: true, value };
  };
  const sdk = { auth: {
    signOut: async options => { localScopes.push(options); session = null; callback('SIGNED_OUT', null); return { error: null }; },
    verifyOtp: async ({ token_hash }) => { if (f.hold) await f.hold; session = { user: { id: f.exchangeUser ?? token_hash } }; callback('SIGNED_IN', session); return { data: { user: session.user, session }, error: null }; },
    onAuthStateChange: fn => { callback = fn; return { data: { subscription: { unsubscribe() {} } } }; }
  } };
  return Object.assign(f, { sdk, localScopes, setNative: id => { native = id; f.emit({ type: 'auth-changed' }); }, getSession: () => session,
    refreshToken: () => { session = { ...session, access_token: 'renewed' }; callback('TOKEN_REFRESHED', session); } });
}
test('auth gate hides stale identity until same-user native ticket exchange', async () => {
  assert.ok(api, 'desktop bridge implementation is missing');
  const f = authFixture(), states = []; let release; f.hold = new Promise(r => release = r);
  const c = api.createDesktopAuthSession(f.h, f.sdk, s => states.push(s)); c.start(); await tick();
  assert.equal(states.at(-1).status, 'connecting'); release(); await waitState(states, 'ready');
  assert.equal(states.at(-1).status, 'ready'); assert.equal(states.at(-1).session.user.id, 'a');
  assert.ok(f.localScopes.every(s => s.scope === 'local')); c.dispose();
});
test('mismatched ticket user never opens protected children', async () => {
  assert.ok(api, 'desktop bridge implementation is missing');
  const f = authFixture(), states = []; f.exchangeUser = 'evil';
  const c = api.createDesktopAuthSession(f.h, f.sdk, s => states.push(s)); await c.start();
  assert.equal(states.at(-1).status, 'error'); assert.equal(f.getSession(), null); c.dispose();
});
test('logout fences and serializes a late ticket exchange before clearing local session', async () => {
  assert.ok(api, 'desktop bridge implementation is missing');
  const f = authFixture(), states = []; let release; f.hold = new Promise(r => release = r);
  const c = api.createDesktopAuthSession(f.h, f.sdk, s => states.push(s)); c.start(); await tick();
  const logout = c.signOut(); assert.equal(states.at(-1).status, 'connecting'); release(); await logout;
  assert.equal(states.at(-1).status, 'signed-out'); assert.equal(f.getSession(), null);
  assert.equal(states.some(s => s.status === 'ready'), false); c.dispose();
});
test('account ABA invalidates old exchange and never wipes a newer verified identity', async () => {
  assert.ok(api, 'desktop bridge implementation is missing');
  const f = authFixture(), states = []; let release; f.hold = new Promise(r => release = r);
  const c = api.createDesktopAuthSession(f.h, f.sdk, s => states.push(s)); c.start(); await tick();
  f.setNative('b'); f.setNative('a'); f.hold = null; release(); await waitState(states, 'ready');
  assert.equal(states.filter(s => s.status === 'ready').length, 1); assert.equal(f.getSession().user.id, 'a'); c.dispose();
});
test('signed-out gate answers shutdown probe with known idle, connecting stays unknown', async () => {
  assert.ok(api, 'desktop bridge implementation is missing');
  const f = authFixture(null), states = []; const c = api.createDesktopAuthSession(f.h, f.sdk, s => states.push(s));
  const started=c.start(); f.emit({ type: 'state-requested', requestId: 'boot' }); await started;
  f.emit({ type: 'state-requested', requestId: 'signed-out' }); await tick();
  assert.equal(f.calls.find(m => m.id === 'boot').payload.activity, 'unknown');
  assert.deepEqual(f.calls.find(m => m.id === 'signed-out').payload, { userId: null, ready: true, session: null, cameraActive: false, operationPending: false, activity: 'allowed' }); c.dispose();
});
test('initial native identity announcement settles the newest authentication generation', async () => {
  const f=authFixture(),states=[]; const original=f.h.studyRoomDesktop.request;let first=true;
  f.h.studyRoomDesktop.request=async m=>{
    if(m.action==='authStatus'&&first){first=false;f.emit({type:'auth-changed'});}
    return original(m);
  };
  const c=api.createDesktopAuthSession(f.h,f.sdk,s=>states.push(s));c.start();await waitState(states,'ready');
  assert.equal(states.filter(s=>s.status==='ready').length,1);c.dispose();
});
test('quit events require current user, exact session and native engagement metadata', async () => {
  const {h,emit}=host(),events=[];const state={userId:'a',ready:true,session:{id:'s',paused:true},cameraActive:false,operationPending:false};
  const stop=api.bindDesktopStudy(h,()=>state,{check:()=> 'allowed'},event=>events.push(event));
  emit({type:'quit-requested',requestId:'q',userId:'old',sessionId:'s',localEngagement:true});
  emit({type:'quit-requested',requestId:'q',userId:'a',sessionId:'old',localEngagement:true});
  emit({type:'quit-requested',requestId:'q'});
  emit({type:'quit-requested',requestId:'q',userId:'a',sessionId:'s',localEngagement:true});
  assert.equal(events.length,1);assert.equal(events[0].localEngagement,true);stop();
});
test('verified same-user token refresh reaches protected app without another ticket exchange', async () => {
  const f=authFixture(),states=[];const c=api.createDesktopAuthSession(f.h,f.sdk,s=>states.push(s));await c.start();
  f.refreshToken();assert.equal(states.at(-1).session.access_token,'renewed');
  assert.equal(f.calls.filter(c=>c.action==='webTicket').length,1);c.dispose();
});
test('hung SDK exchange shows recoverable error without overlapping late session cleanup', async () => {
  const f=authFixture(),states=[];let release;f.hold=new Promise(r=>release=r);
  const c=api.createDesktopAuthSession(f.h,f.sdk,s=>states.push(s),{timeoutMs:5});c.start();
  await new Promise(r=>setTimeout(r,15));assert.equal(states.at(-1).status,'error');
  f.hold=null;release();await tick();await tick();assert.equal(f.getSession(),null);
  assert.equal(states.some(s=>s.status==='ready'),false);await c.retry();assert.equal(states.at(-1).status,'ready');c.dispose();
});
