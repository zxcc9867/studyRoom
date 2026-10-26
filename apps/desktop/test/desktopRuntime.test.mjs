import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createDesktopLifecycle } from '../src/desktopLifecycle.mjs';
import { createDesktopAuth } from '../src/desktopAuth.mjs';
import { createShellSettings } from '../src/desktopShellSettings.mjs';

const module = await import('../src/desktopRuntime.mjs').catch(() => ({}));
const ORIGIN = 'https://study-room-attendance.vercel.app';
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const idle = { userId: 'u', ready: true, session: null, cameraActive: false, operationPending: false, activity: 'allowed' };

function fixture(options = {}) {
  assert.equal(typeof module.createDesktopRuntime, 'function', 'desktop runtime feature must exist');
  const calls = { loads: [], external: [], dialogs: [], quit: 0, events: [], hidden: 0, shown: 0, authReads: 0 };
  let latestState = null;
  let clock = 1000;
  const app = Object.assign(new EventEmitter(), { isPackaged: options.packaged ?? true, getVersion: () => '0.1.0', quit: () => { calls.quit++; } });
  const session = {
    setPermissionCheckHandler: fn => { calls.permissionCheck = fn; },
    setPermissionRequestHandler: fn => { calls.permissionRequest = fn; },
    setDisplayMediaRequestHandler: fn => { calls.displayRequest = fn; },
  };
  const contents = Object.assign(new EventEmitter(), {
    mainFrame: { url: ORIGIN + '/' }, session, getURL: () => contents.mainFrame.url,
    send: (channel, value) => {
      calls.events.push({ channel, value });
      if (value.type === 'state-requested' && options.autoProbe !== false && latestState) {
        queueMicrotask(() => { void calls.ipc({ sender: contents, senderFrame: contents.mainFrame },
          { id: value.requestId, action: 'studyState', payload: latestState }); });
      }
    },
    setWindowOpenHandler: fn => { calls.openWindow = fn; },
    isDestroyed: () => false,
  });
  class Window extends EventEmitter {
    constructor(config) { super(); calls.config = config; this.bounds={x:config.x??0,y:config.y??0,width:config.width,height:config.height}; this.webContents = contents; calls.window = this; }
    getNormalBounds(){return this.bounds;}
    setBounds(value){this.bounds=value;}
    loadURL(url) { calls.loads.push(url); return Promise.resolve(); }
    loadFile(path) { calls.loads.push(path); return Promise.resolve(); }
    hide() { calls.hidden++; }
    show() { calls.shown++; }
    focus() {}
    isMinimized() { return false; }
    isDestroyed() { return false; }
    isVisible() { return calls.hidden === 0 || calls.shown > 0; }
    isFocused() { return true; }
    setMenuBarVisibility() {}
  }
  class Tray extends EventEmitter {
    constructor() { super(); calls.trayAttempts=(calls.trayAttempts??0)+1; if (options.trayFails && (!options.retryTraySucceeds || calls.trayAttempts===1)) throw Error('tray unavailable'); calls.tray = this; }
    setToolTip(text) { calls.tooltip = text; }
    setContextMenu(menu) { calls.menu = menu; }
    displayBalloon(value) { calls.balloon = value; }
    destroy() {}
  }
  const responses = [...(options.responses ?? [])];
  const auth = {
    status: async () => { calls.authReads++; return { userId: 'u' }; },
    webTicket: async id => ({ requestId: id, tokenHash: 'one-use' }),
    signOut: async () => ({ signedOut: true }), dispose() {},
    ...(options.auth ?? {}),
  };
  const life = createDesktopLifecycle({ now: () => clock });
  const runtime = module.createDesktopRuntime({
    electron: { app, BrowserWindow: Window, Tray, screen:options.screen, Menu: { buildFromTemplate: value => value },
      ipcMain: { handle: (channel, fn) => { calls.ipc = fn; }, removeHandler() {} },
      dialog: { showMessageBox: async (...args) => { calls.dialogs.push(args.at(-1)); return { response: responses.shift() ?? 1 }; } },
      shell: { openExternal: async url => { calls.external.push(url); } } },
    auth, storage: { secure: true }, lifecycle: life, preloadPath: '/preload.cjs', iconPath: '/icon.png', errorPath: '/error.html',
    now: () => clock, quitProbeTimeoutMs: 20, ...(options.runtime ?? {}),
  });
  const event = () => ({ sender: contents, senderFrame: contents.mainFrame });
  let id = 0;
  const request = (action, payload = {}, sender = event()) => {
    if (action === 'studyState') latestState = payload;
    return calls.ipc(sender, { id: `r-${++id}`, action, payload });
  };
  const navigate = () => { contents.emit('did-start-navigation', { url: ORIGIN + '/', isMainFrame: true, isSameDocument: false }); };
  return { calls, runtime, request, event, contents, app, life, navigate, advance: ms => { clock += ms; } };
}

test('IPC accepts only owning current trusted main frame and never leaks dependency errors', async () => {
  const f = fixture({ auth: { sendCode: async () => { throw Error('secret dependency error'); } } });
  assert.equal((await f.request('info')).value.platform, 'windows');
  assert.equal((await f.request('info', {}, { sender: f.contents, senderFrame: { url: ORIGIN } })).error, 'UNTRUSTED_DOCUMENT');
  assert.equal((await f.request('info', {}, { sender: {}, senderFrame: f.contents.mainFrame })).error, 'UNTRUSTED_DOCUMENT');
  assert.equal((await f.request('sendCode', { email: 'a@example.com' })).error, 'INTERNAL_ERROR');
  f.contents.mainFrame.url = ORIGIN + '.evil.test/';
  assert.equal((await f.request('info')).error, 'UNTRUSTED_DOCUMENT');
});

test('navigation while awaiting a ticket discards response and invalidates lifecycle proof', async () => {
  const pending = defer();
  const f = fixture({ auth: { webTicket: () => pending.promise } });
  await f.request('studyState', idle);
  const response = f.request('webTicket');
  f.navigate();
  pending.resolve({ tokenHash: 'must-not-escape' });
  assert.equal((await response).error, 'UNTRUSTED_DOCUMENT');
  assert.equal(f.life.view().known, false);
});

test('runtime also fences an in-flight ticket on native auth changes', async () => {
  const pending = defer(); const f = fixture({ auth: { webTicket: () => pending.promise } });
  const response = f.request('webTicket');
  f.runtime.authChanged(); pending.resolve({ tokenHash: 'must-not-escape' });
  assert.equal((await response).error, 'AUTH_CHANGED');
});

test('X hides the same document without loading, destroying or ending study', async () => {
  const f = fixture();
  await f.request('studyState', { ...idle, session: { id: 's', paused: false }, activity: 'studying', cameraActive: true });
  let prevented = false;
  f.calls.window.emit('close', { preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(f.calls.hidden, 1);
  assert.equal(f.calls.loads.length, 1);
  assert.equal(f.calls.quit, 0);
  assert.equal(f.life.view().cameraActive, true);
  assert.equal(f.calls.config.webPreferences.backgroundThrottling, false);
  assert.equal(f.calls.config.webPreferences.sandbox, true);
  assert.equal(f.calls.config.webPreferences.nodeIntegration, false);
  assert.ok(f.calls.balloon);
});

test('tray failure keeps the only window visible on X', () => {
  const f = fixture({ trayFails: true });
  f.calls.window.emit('close', { preventDefault() {} });
  assert.equal(f.calls.hidden, 0);
  assert.ok(f.calls.shown > 0);
});

test('failed tray exposes recoverable retry and preserves same document after successful retry', async () => {
  const scheduled=[];
  const f=fixture({trayFails:true,retryTraySucceeds:true,responses:[0],runtime:{schedule:fn=>scheduled.push(fn)}});
  assert.equal(scheduled.length,1);
  await scheduled.shift()();
  assert.match(f.calls.dialogs[0].message,/트레이/);
  assert.ok(f.calls.dialogs[0].buttons.some(label=>/종료/.test(label)));
  assert.equal(f.calls.trayAttempts,2);
  f.calls.window.emit('close',{preventDefault(){}});
  assert.equal(f.calls.hidden,1);assert.equal(f.calls.loads.length,1);
});

test('failed tray explicit quit uses matching probe; cancel and X never abruptly destroy work', async () => {
  const scheduled=[];
  const f=fixture({trayFails:true,responses:[1,2,2],runtime:{schedule:fn=>scheduled.push(fn)}});
  await scheduled.shift()(); // Keep open.
  assert.equal(f.calls.quit,0);
  await f.request('studyState',{...idle,operationPending:true});
  f.calls.window.emit('close',{preventDefault(){}});
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(f.calls.quit,0); // Explicit quit -> fresh pending proof -> existing web completion.
  assert.equal(f.calls.hidden,0);
  const quit=f.calls.events.find(e=>e.value.type==='quit-requested').value;
  await f.request('cancelQuit',{requestId:quit.requestId});
  await f.request('studyState',idle);
  f.calls.window.emit('close',{preventDefault(){}});
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(f.calls.quit,1);
  assert.equal(f.calls.events.filter(e=>e.value.type==='state-requested').length,2);
});

test('failed tray unknown state still offers warned process-only quit with cancellation',async()=>{
  const scheduled=[];const f=fixture({trayFails:true,autoProbe:false,responses:[2,1,2,2],runtime:{schedule:fn=>scheduled.push(fn)}});
  await scheduled.shift()();assert.equal(f.calls.quit,0);
  assert.equal(f.calls.dialogs.at(-1).title,'종료 상태 확인 필요');
  f.calls.window.emit('close',{preventDefault(){}});await new Promise(resolve=>setTimeout(resolve,40));
  assert.equal(f.calls.quit,1);assert.equal(f.calls.hidden,0);
});

test('runtime restores/clamps persisted shell geometry and first-hide notice survives restart',async()=>{
  let disk=JSON.stringify({bounds:{x:4000,y:50,width:1100,height:850},firstHideAcknowledged:false});
  const settings=()=>createShellSettings({read:()=>disk,write:value=>{disk=value;}});
  let displays=[{workArea:{x:0,y:0,width:1920,height:1080}}];
  const screen=Object.assign(new EventEmitter(),{getAllDisplays:()=>displays});
  const f=fixture({screen,runtime:{shellSettings:settings()}});
  assert.deepEqual(f.calls.window.bounds,{x:820,y:50,width:1100,height:850});
  f.calls.window.emit('close',{preventDefault(){}});assert.ok(f.calls.balloon);
  f.calls.window.bounds={x:300,y:200,width:1000,height:800};f.calls.window.emit('move');
  await new Promise(resolve=>setTimeout(resolve,270));
  f.runtime.dispose();
  const restarted=fixture({screen,runtime:{shellSettings:settings()}});
  assert.deepEqual(restarted.calls.window.bounds,{x:300,y:200,width:1000,height:800});
  restarted.calls.window.emit('close',{preventDefault(){}});assert.equal(restarted.calls.balloon,undefined);
  displays=[{workArea:{x:0,y:0,width:800,height:650}}];screen.emit('display-removed');
  assert.deepEqual(restarted.calls.window.bounds,{x:0,y:0,width:800,height:650});
  restarted.runtime.dispose();
});

test('storage degradation immediately invalidates proof, restores window and shows sanitized native recovery',async()=>{
  const f=fixture();await f.request('studyState',idle);f.calls.window.emit('close',{preventDefault(){}});
  f.runtime.storageFailed();
  assert.equal(f.life.view().known,false);assert.ok(f.calls.shown>0);
  assert.equal(f.calls.dialogs.at(-1).title,'독서실 로그인 저장소 확인');
  assert.doesNotMatch(JSON.stringify(f.calls.dialogs),/refresh_token|access_token/);
});

test('tray camera indicator is local and only shown with fresh known state',async()=>{
  const f=fixture();await f.request('studyState',{...idle,cameraActive:true});
  assert.match(f.calls.tooltip,/이 PC 카메라 켜짐/);
  await f.request('studyState',idle);assert.match(f.calls.tooltip,/이 PC 카메라 꺼짐/);
  f.advance(10001);f.calls.tray.emit('right-click');
  assert.match(f.calls.tooltip,/상태 확인 필요/);assert.doesNotMatch(f.calls.tooltip,/카메라 (켜짐|꺼짐)/);
});

test('second launch restores existing window and never loads another document', () => {
  const f = fixture();
  f.app.emit('second-instance', {}, ['StudyRoom.exe']);
  assert.ok(f.calls.shown > 0);
  assert.equal(f.calls.loads.length, 1);
});

test('video requests are denied without explicit consent and permission handlers never show UI', async () => {
  const f = fixture();
  const details = { isMainFrame: true, requestingUrl: ORIGIN + '/', mediaTypes: ['video'] };
  let allowed;
  f.calls.permissionRequest(f.contents, 'media', result => { allowed = result; }, details);
  assert.equal(allowed, false);
  assert.equal(f.calls.permissionCheck(f.contents, 'media', ORIGIN, { isMainFrame: true, requestingUrl: ORIGIN + '/', mediaType: 'video' }), false);
  assert.equal(f.calls.dialogs.length, 0);
  await f.request('openCameraSettings');
  assert.equal(f.calls.dialogs.length, 0);
  assert.deepEqual(f.calls.external, ['ms-settings:privacy-webcam']);
});

test('cancelled consent does not grant camera; accepted consent is top-frame video-only and document-scoped', async () => {
  const f = fixture({ responses: [1, 0] });
  assert.deepEqual((await f.request('cameraConsent')).value, { allowed: false });
  assert.deepEqual((await f.request('cameraConsent')).value, { allowed: true });
  const check = (wc = f.contents, origin = ORIGIN, extra = {}) => f.calls.permissionCheck(wc, 'media', origin,
    { isMainFrame: true, requestingUrl: ORIGIN + '/', mediaType: 'video', ...extra });
  assert.equal(check(), true);
  assert.equal(check({}, ORIGIN), false);
  assert.equal(check(f.contents, ORIGIN + '.evil.test'), false);
  assert.equal(check(f.contents, ORIGIN, { isMainFrame: false }), false);
  assert.equal(check(f.contents, ORIGIN, { mediaType: 'audio' }), false);
  assert.equal(check(f.contents, ORIGIN, { mediaType: 'unknown' }), false);
  f.contents.emit('did-start-navigation', { isMainFrame: true, isSameDocument: true });
  assert.equal(check(), true);
  f.navigate();
  assert.equal(check(), false);
});

for (const origin of [ORIGIN, 'http://127.0.0.1:53064']) {
  test(`native media origin serialization accepts consented video for ${origin}`, async () => {
    const development = origin !== ORIGIN;
    const f = fixture({ responses: [0], packaged: !development,
      runtime: development ? { origin, allowDevelopmentOrigin: true } : {} });
    f.contents.mainFrame.url = origin + '/';
    const details = { isMainFrame: true, mediaTypes: ['video'], requestingUrl: origin + '/', securityOrigin: origin + '/' };
    let allowed;
    f.calls.permissionRequest(f.contents, 'media', value => { allowed = value; }, details);
    assert.equal(allowed, false, 'automatic camera request must remain noninteractive and denied');
    assert.equal(f.calls.dialogs.length, 0);
    assert.deepEqual((await f.request('cameraConsent')).value, { allowed: true });
    f.calls.permissionRequest(f.contents, 'media', value => { allowed = value; }, details);
    assert.equal(allowed, true, 'native serialized securityOrigin includes a trailing slash');
    const checkDetails = { isMainFrame: true, mediaType: 'video', requestingUrl: origin + '/', securityOrigin: origin + '/' };
    assert.equal(f.calls.permissionCheck(f.contents, 'media', origin + '/', checkDetails), true);
    assert.equal(f.calls.permissionCheck(f.contents, 'media', origin, checkDetails), true);
    for (const optionalDetails of [
      { isMainFrame: true, mediaTypes: ['video'], requestingUrl: origin + '/' },
      { ...details, securityOrigin: undefined },
    ]) {
      f.calls.permissionRequest(f.contents, 'media', value => { allowed = value; }, optionalDetails);
      assert.equal(allowed, true, 'official optional securityOrigin absence must remain supported');
    }
    assert.equal(f.calls.permissionCheck(f.contents, 'media', origin + '/',
      { isMainFrame: true, mediaType: 'video', requestingUrl: origin + '/' }), true);
    if (!development) {
      const serializedDefaultPort = 'https://study-room-attendance.vercel.app:443/';
      f.calls.permissionRequest(f.contents, 'media', value => { allowed = value; }, { ...details, securityOrigin: serializedDefaultPort });
      assert.equal(allowed, true);
      assert.equal(f.calls.permissionCheck(f.contents, 'media', serializedDefaultPort, { ...checkDetails, securityOrigin: serializedDefaultPort }), true);
    }
    f.navigate();
    f.calls.permissionRequest(f.contents, 'media', value => { allowed = value; }, details);
    assert.equal(allowed, false, 'new document requires fresh explicit consent');
    assert.equal(f.calls.dialogs.length, 1, 'permission handlers never open a prompt');
    f.runtime.dispose();
  });
}

test('native media origin serialization denies malformed foreign and missing authoritative metadata', async () => {
  const f = fixture({ responses: [0] });
  await f.request('cameraConsent');
  const details = { isMainFrame: true, mediaTypes: ['video'], requestingUrl: ORIGIN + '/', securityOrigin: ORIGIN + '/' };
  const invalid = [null, '', 'null', 'not a URL', 'https://evil.test/', ORIGIN + '.evil.test/',
    'https://user:pass@study-room-attendance.vercel.app/', ORIGIN + '/not-an-origin', ORIGIN + '/?query', ORIGIN + '/#fragment',
    ORIGIN + '/?', ORIGIN + '/#', ORIGIN + '/not-an-origin/..', ORIGIN + '\\'];
  for (const securityOrigin of invalid) {
    let allowed;
    f.calls.permissionRequest(f.contents, 'media', value => { allowed = value; }, { ...details, securityOrigin });
    assert.equal(allowed, false, `invalid supplied securityOrigin: ${String(securityOrigin)}`);
    assert.equal(f.calls.permissionCheck(f.contents, 'media', securityOrigin,
      { isMainFrame: true, requestingUrl: ORIGIN + '/', mediaType: 'video', securityOrigin: ORIGIN + '/' }), false);
  }
  assert.equal(f.calls.permissionCheck(f.contents, 'media', undefined,
    { isMainFrame: true, requestingUrl: ORIGIN + '/', mediaType: 'video' }), false);
  for (const changed of [
    { requestingUrl: undefined }, { requestingUrl: '' }, { requestingUrl: 'https://evil.test/' },
    { isMainFrame: undefined }, { isMainFrame: false }, { mediaTypes: undefined }, { mediaTypes: ['video', 'audio'] }, { mediaTypes: ['audio'] },
  ]) {
    let allowed;
    f.calls.permissionRequest(f.contents, 'media', value => { allowed = value; }, { ...details, ...changed });
    assert.equal(allowed, false);
  }
  let allowed;
  f.calls.permissionRequest({}, 'media', value => { allowed = value; }, details);
  assert.equal(allowed, false);
  assert.equal(f.calls.dialogs.length, 1);
  f.runtime.dispose();
});

test('consent dialog completion after navigation cannot authorize the new document', async () => {
  const f = fixture(); const pending = defer();
  f.runtime.dispose();
  // Recreate the runtime against an asynchronous OS dialog boundary.
  const g = fixture({ runtime: { confirmCamera: () => pending.promise } });
  const response = g.request('cameraConsent');
  g.navigate(); pending.resolve(true);
  assert.equal((await response).error, 'UNTRUSTED_DOCUMENT');
  assert.equal(g.calls.permissionCheck(g.contents, 'media', ORIGIN, { isMainFrame: true, mediaType: 'video' }), false);
});

test('study state reuses event-invalidated verified identity without periodic network auth load', async () => {
  const f = fixture();
  assert.equal((await f.request('studyState', { ...idle, userId: 'attacker' })).error, 'AUTH_CHANGED');
  assert.equal(f.life.view().known, false);
  await f.request('studyState', idle);
  await f.request('studyState', idle);
  assert.equal(f.calls.authReads, 1);
  for (let message = 0; message < 100; message++) { f.advance(3000); await f.request('studyState', idle); }
  assert.equal(f.calls.authReads, 1);
  f.runtime.authChanged();
  assert.equal(f.life.view().known, false);
  await f.request('studyState', idle);
  assert.equal(f.calls.authReads, 2);
});

test('late study proof after auth change is rejected instead of authorizing quit', async () => {
  const pending = defer(); const f = fixture({ auth: { status: () => pending.promise } });
  const response = f.request('studyState', idle);
  f.runtime.authChanged(); pending.resolve({ userId: 'u' });
  assert.equal((await response).error, 'AUTH_CHANGED');
  assert.equal(f.life.view().known, false);
});

test('real Task1 first identity announcement and successful OTP preserve meaningful runtime replies', async () => {
  let runtime;
  let id = 'u';
  const memory = new Map();
  const storage = { getItem: async key => memory.get(key) ?? null,
    setItem: async (key, value) => { memory.set(key, value); }, removeItem: async key => { memory.delete(key); } };
  const auth = createDesktopAuth({ storage, onChange: () => runtime?.authChanged(), openExternal: async () => {},
    supabase: { supabaseUrl: 'https://project.supabase.co', auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      getUser: async () => ({ data: { user: id ? { id } : null }, error: null }),
      verifyOtp: async () => { id = 'new-user'; return { data: { user: { id }, session: { user: { id } } }, error: null }; },
      signOut: async () => { id = null; return { error: null }; },
    } } });
  const f = fixture({ auth }); runtime = f.runtime;
  const status = await f.request('authStatus');
  assert.deepEqual(status.value, { userId: 'u' });
  assert.equal(status.ok, true);
  const otp = await f.request('verifyCode', { email: 'u@example.com', code: '12345678' });
  assert.deepEqual(otp.value, { userId: 'new-user' });
  assert.equal(otp.ok, true);
  assert.equal((await f.request('studyState', idle)).error, 'AUTH_CHANGED');
  await f.request('signOut');
  assert.deepEqual((await f.request('authStatus')).value, { userId: null });
  assert.equal((await f.request('studyState', { ...idle, userId: null })).ok, true);
  f.runtime.dispose();
});

test('explicit quit uses existing web completion and cancellation keeps process running', async () => {
  const f = fixture();
  await f.request('studyState', { ...idle, session: { id: 's', paused: false }, activity: 'studying' });
  await f.runtime.requestQuit();
  const event = f.calls.events.find(item => item.value.type === 'quit-requested').value;
  assert.equal(f.calls.quit, 0);
  assert.ok(f.calls.shown > 0);
  await f.request('cancelQuit', { requestId: event.requestId });
  await f.request('studyState', idle);
  assert.equal(f.calls.quit, 0);
  await f.runtime.requestQuit();
  assert.equal(f.calls.quit, 1);
});

test('quit context identifies active local engagement from the verified matching probe', async () => {
  const f = fixture();
  await f.request('studyState', { ...idle, session: { id: 'local-s', paused: false }, activity: 'studying' });
  await f.runtime.requestQuit();
  assert.deepEqual(f.calls.events.at(-1).value, {
    type: 'quit-requested', requestId: 'quit-1', userId: 'u', sessionId: 'local-s', localEngagement: true,
  });
  assert.equal(f.calls.quit, 0);
  f.runtime.dispose();
});

test('quit context preserves restored local engagement for a paused participation-only state', async () => {
  const lifecycle = createDesktopLifecycle({ now: () => 1000, storage: {
    getItem: () => JSON.stringify({ userId: 'u', sessionId: 'persisted-s' }),
    setItem() {}, removeItem() {},
  } });
  const f = fixture({ runtime: { lifecycle } });
  await f.request('studyState', { ...idle, session: { id: 'persisted-s', paused: true }, activity: 'allowed' });
  await f.runtime.requestQuit();
  assert.deepEqual(f.calls.events.at(-1).value, {
    type: 'quit-requested', requestId: 'quit-1', userId: 'u', sessionId: 'persisted-s', localEngagement: true,
  });
  assert.equal(f.calls.quit, 0);
  f.runtime.dispose();
});

test('quit context never turns an observer pending write into local study participation', async () => {
  const f = fixture();
  await f.request('studyState', { ...idle, session: { id: 'remote-s', paused: false }, operationPending: true });
  await f.runtime.requestQuit();
  assert.deepEqual(f.calls.events.at(-1).value, {
    type: 'quit-requested', requestId: 'quit-1', userId: 'u', sessionId: 'remote-s', localEngagement: false,
  });
  assert.equal(f.calls.quit, 0);
  f.runtime.dispose();
});

test('quit context routes ready camera-only preparation to cleanup with no session or engagement', async () => {
  const f = fixture();
  await f.request('studyState', { ...idle, cameraActive: true });
  await f.runtime.requestQuit();
  assert.deepEqual(f.calls.events.at(-1).value, {
    type: 'quit-requested', requestId: 'quit-1', userId: 'u', sessionId: null, localEngagement: false,
  });
  assert.equal(f.calls.quit, 0);
  f.runtime.dispose();
});

test('quit context preserves nullable native user and session identifiers', async () => {
  const f = fixture({ auth: { status: async () => ({ userId: null }) } });
  await f.request('studyState', { ...idle, userId: null, cameraActive: true });
  await f.runtime.requestQuit();
  assert.deepEqual(f.calls.events.at(-1).value, {
    type: 'quit-requested', requestId: 'quit-1', userId: null, sessionId: null, localEngagement: false,
  });
  f.runtime.dispose();
});

test('quit context stays immutable when an unrelated heartbeat replaces session and engagement', async () => {
  const f = fixture({ autoProbe: false });
  await f.request('studyState', idle);
  const pendingQuit = f.runtime.requestQuit();
  const probe = f.calls.events.at(-1).value;
  const matching = f.calls.ipc(f.event(), { id: probe.requestId, action: 'studyState', payload: {
    ...idle, session: { id: 'matched-local-s', paused: false }, activity: 'studying',
  } });
  const unrelated = f.request('studyState', { ...idle, session: { id: 'later-remote-s', paused: false }, operationPending: true });
  await Promise.all([matching, unrelated, pendingQuit]);
  assert.equal(f.life.view().localEngagement, false, 'later heartbeat really replaced the lifecycle context');
  assert.deepEqual(f.calls.events.at(-1).value, {
    type: 'quit-requested', requestId: 'quit-1', userId: 'u', sessionId: 'matched-local-s', localEngagement: true,
  });
  assert.equal(f.calls.quit, 0);
  f.runtime.dispose();
});

for (const invalidation of ['navigation', 'auth change']) {
  test(`quit context is never emitted for a probe invalidated by ${invalidation}`, async () => {
    const f = fixture({ autoProbe: false, responses: [1] });
    await f.request('studyState', idle);
    const pendingQuit = f.runtime.requestQuit();
    const probe = f.calls.events.at(-1).value;
    if (invalidation === 'navigation') f.navigate();
    else f.runtime.authChanged();
    await f.calls.ipc(f.event(), { id: probe.requestId, action: 'studyState', payload: {
      ...idle, session: { id: 'late-s', paused: false }, activity: 'studying',
    } });
    await pendingQuit;
    assert.equal(f.calls.events.some(item => item.value.type === 'quit-requested'), false);
    assert.equal(f.calls.quit, 0);
    f.runtime.dispose();
  });
}

test('safe fresh web completion after quit intent exits; stale state never auto-quits', async () => {
  const f = fixture({ responses: [1] });
  await f.request('studyState', { ...idle, session: { id: 's', paused: false }, activity: 'studying' });
  await f.runtime.requestQuit();
  f.navigate();
  await f.request('studyState', idle);
  assert.equal(f.calls.quit, 0);
  f.advance(10001); f.contents.mainFrame.url = 'file:///error.html'; await f.runtime.requestQuit();
  assert.equal(f.calls.quit, 0);
  assert.ok(f.calls.dialogs.at(-1).detail.includes('서버'));
});

test('quit probes current document instead of trusting cached idle and rejects mismatched probe IDs', async () => {
  const f = fixture({ autoProbe: false });
  await f.request('studyState', idle);
  const pendingQuit = f.runtime.requestQuit();
  const probe = f.calls.events.at(-1)?.value;
  assert.equal(probe?.type, 'state-requested');
  assert.equal(f.calls.quit, 0);
  await f.request('studyState', idle);
  assert.equal(f.calls.quit, 0);
  await f.calls.ipc(f.event(), { id: probe.requestId, action: 'studyState', payload: { ...idle, operationPending: true } });
  await pendingQuit;
  assert.equal(f.calls.quit, 0);
  assert.equal(f.calls.events.at(-1).value.type, 'quit-requested');
});

test('an unrelated idle heartbeat cannot upgrade matching pending quit proof to safe exit', async () => {
  const f = fixture({ autoProbe: false });
  await f.request('studyState', idle);
  const pendingQuit = f.runtime.requestQuit();
  const probe = f.calls.events.at(-1).value;
  const matching = f.calls.ipc(f.event(), { id: probe.requestId, action: 'studyState', payload: { ...idle, operationPending: true } });
  const unrelated = f.request('studyState', idle);
  await Promise.all([matching, unrelated, pendingQuit]);
  assert.equal(f.calls.quit, 0);
  assert.equal(f.calls.events.at(-1).value.type, 'quit-requested');
});

test('navigation discards outstanding quit probe and late idle cannot quit new document', async () => {
  const f = fixture({ autoProbe: false, responses: [1] });
  await f.request('studyState', idle);
  const pendingQuit = f.runtime.requestQuit();
  const probe = f.calls.events.at(-1).value;
  assert.equal(probe.type, 'state-requested');
  f.navigate();
  await f.calls.ipc(f.event(), { id: probe.requestId, action: 'studyState', payload: idle });
  await pendingQuit;
  assert.equal(f.calls.quit, 0);
  assert.ok(f.calls.dialogs.at(-1).detail.includes('서버'));
});

test('quit probe timeout offers warned process-only exit without server mutation', async () => {
  const f = fixture({ autoProbe: false, responses: [2] });
  await f.request('studyState', idle);
  await f.runtime.requestQuit();
  assert.equal(f.calls.quit, 1);
  assert.equal(f.calls.dialogs.at(-1).buttons[2], '프로세스만 종료');
});

test('healthy quit timeout Retry probes again without reload and exits only on the new matching proof', async () => {
  const scheduled = [];
  const f = fixture({ autoProbe: false, responses: [0, 1], runtime: { schedule: callback => { scheduled.push(callback); } } });
  await f.request('studyState', idle);
  await f.runtime.requestQuit();
  const firstProbe = f.calls.events.at(-1).value;
  assert.equal(firstProbe.type, 'state-requested');
  assert.equal(f.calls.quit, 0);
  assert.equal(f.calls.loads.length, 1);
  assert.equal(scheduled.length, 1, 'Retry must schedule a new quit check after clearing the dialog guard');
  scheduled.shift()();
  const secondProbe = f.calls.events.at(-1).value;
  assert.equal(secondProbe.type, 'state-requested');
  assert.notEqual(secondProbe.requestId, firstProbe.requestId);
  assert.equal(f.calls.quit, 0);
  await f.calls.ipc(f.event(), { id: firstProbe.requestId, action: 'studyState', payload: idle });
  assert.equal(f.calls.quit, 0, 'late first proof must not satisfy the new probe');
  await f.calls.ipc(f.event(), { id: secondProbe.requestId, action: 'studyState', payload: idle });
  await new Promise(setImmediate);
  assert.equal(f.calls.quit, 1);
  assert.equal(f.calls.loads.length, 1, 'healthy Retry must keep the existing document');
  assert.equal(f.calls.dialogs.length, 1);
  f.runtime.dispose();
});

test('pending local pause still requires web completion and verified idle completion exits', async () => {
  const f = fixture();
  await f.request('studyState', { ...idle, session: { id: 's', paused: false }, activity: 'studying' });
  await f.request('studyState', { ...idle, session: { id: 's', paused: true } });
  await f.runtime.requestQuit();
  assert.equal(f.calls.quit, 0);
  assert.equal(f.calls.events.at(-1).value.type, 'quit-requested');
  await f.request('studyState', idle);
  assert.equal(f.calls.quit, 1);
});

test('request IDs reject concurrent and completed replay only within the same document', async () => {
  const pending = defer(); const f = fixture({ auth: { webTicket: () => pending.promise } });
  const input = { id: 'unique', action: 'webTicket', payload: {} };
  const response = f.calls.ipc(f.event(), input);
  assert.equal((await f.calls.ipc(f.event(), input)).error, 'DUPLICATE_REQUEST');
  pending.resolve({ tokenHash: 'ticket' }); await response;
  assert.equal((await f.calls.ipc(f.event(), input)).error, 'DUPLICATE_REQUEST');
  f.navigate();
  assert.equal((await f.calls.ipc(f.event(), { ...input, action: 'info' })).ok, true);
});

test('singleflight native verification cannot repopulate identity cache after navigation', async () => {
  const pending = defer(); let reads = 0;
  const f = fixture({ auth: { status: () => ++reads === 1 ? pending.promise : Promise.resolve({ userId: 'u' }) } });
  const first = f.request('studyState', idle);
  const second = f.request('studyState', idle);
  assert.equal(reads, 1);
  f.navigate(); pending.resolve({ userId: 'u' });
  assert.equal((await first).error, 'UNTRUSTED_DOCUMENT');
  assert.equal((await second).error, 'UNTRUSTED_DOCUMENT');
  await f.request('studyState', idle);
  assert.equal(reads, 2);
});

test('concurrent consent requests cannot open repeated native dialogs', async () => {
  const pending = defer(); let dialogs = 0;
  const f = fixture({ runtime: { confirmCamera: () => { dialogs++; return pending.promise; } } });
  const first = f.request('cameraConsent');
  const second = f.request('cameraConsent');
  pending.resolve(false);
  assert.equal((await second).error, 'AUTH_BUSY');
  assert.equal(dialogs, 1);
  assert.equal((await first).ok, true);
});

test('unverified security origin and display or mixed media never receive permission', async () => {
  const f = fixture({ responses: [0] });
  await f.request('cameraConsent');
  for (const [kind, details] of [
    ['media', { isMainFrame: true, requestingUrl: ORIGIN + '/', securityOrigin: 'https://evil.test', mediaTypes: ['video'] }],
    ['media', { isMainFrame: true, requestingUrl: ORIGIN + '/', mediaTypes: ['video', 'audio'] }],
    ['display-capture', { isMainFrame: true, requestingUrl: ORIGIN + '/', mediaTypes: ['video'] }],
  ]) {
    let allowed; f.calls.permissionRequest(f.contents, kind, value => { allowed = value; }, details);
    assert.equal(allowed, false);
  }
  let display; f.calls.displayRequest({}, value => { display = value; });
  assert.deepEqual(display, {});
});

test('existing invite copy permits sanitized writes only from a visible focused trusted top frame', () => {
  const f = fixture();
  const details = { isMainFrame: true, requestingUrl: ORIGIN + '/' };
  const check = (kind, extra = {}, owner = f.contents, origin = ORIGIN) => f.calls.permissionCheck(owner, kind, origin, { ...details, ...extra });
  assert.equal(check('clipboard-sanitized-write'), true);
  assert.equal(check('clipboard-read'), false);
  assert.equal(check('clipboard-sanitized-write', { isMainFrame: false }), false);
  assert.equal(check('clipboard-sanitized-write', {}, {}), false);
  assert.equal(check('clipboard-sanitized-write', {}, f.contents, 'https://evil.test'), false);
  f.calls.window.isFocused = () => false;
  assert.equal(check('clipboard-sanitized-write'), false);
  f.calls.window.isFocused = () => true;
  f.calls.window.isVisible = () => false;
  assert.equal(check('clipboard-sanitized-write'), false);
});

test('renderer crash invalidates proof and retry loads production in the same window', async () => {
  const f = fixture({ responses: [0] });
  await f.request('studyState', idle);
  f.contents.emit('render-process-gone', {}, { reason: 'crashed' });
  await new Promise(setImmediate);
  assert.equal(f.life.view().known, false);
  assert.equal(f.calls.loads.at(-1), ORIGIN);
  assert.equal(f.calls.quit, 0);
});

test('unsafe links cannot launch shell and trusted navigation remains in app', async () => {
  const f = fixture();
  assert.deepEqual(f.calls.openWindow({ url: 'file:///private' }), { action: 'deny' });
  f.calls.openWindow({ url: 'https://example.com/path' });
  await new Promise(setImmediate);
  assert.deepEqual(f.calls.external, ['https://example.com/path']);
  let prevented = false;
  f.contents.emit('will-navigate', { preventDefault() { prevented = true; } }, 'https://evil.test/');
  assert.equal(prevented, true);
});

test('packaged runtime refuses custom origins; loopback is explicit and unpackaged only', () => {
  assert.throws(() => fixture({ runtime: { origin: 'http://127.0.0.1:3210' } }), /INVALID_ORIGIN/);
  assert.throws(() => fixture({ packaged: false, runtime: { origin: 'https://evil.test' } }), /INVALID_ORIGIN/);
  const f = fixture({ packaged: false, runtime: { origin: 'http://127.0.0.1:3210', allowDevelopmentOrigin: true } });
  assert.equal(f.calls.loads[0], 'http://127.0.0.1:3210');
});
