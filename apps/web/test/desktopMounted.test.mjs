import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
let chromium;
try { ({ chromium } = await import(process.env.FEED_BROWSER_MODULE ? pathToFileURL(process.env.FEED_BROWSER_MODULE).href : 'playwright')); } catch {}
const mounted = (name, fn) => test(name, { skip: !chromium && 'Chrome runtime required' }, fn);
// Reuse the existing full dashboard's external server fixture, not a replacement UI.
const existing = (await readFile(new URL('./actualStudyMounted.test.mjs', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
let backend = existing.slice(existing.indexOf('const backend = `') + 'const backend = `'.length, existing.indexOf('\n`;\n', existing.indexOf('const backend = `')));
backend = backend.replace('const authSession=', 'let authSession=').replace("let authCallback;", `
const callbacks=new Set();
authSession={access_token:'stale',user:{id:'stale',email:'stale@example.test',user_metadata:{}}};
const announce=(event,session)=>callbacks.forEach(cb=>cb(event,session));
window.desktopFixture.sdkIdentity=()=>authSession?.user.id??null;
`);
const authStart = backend.indexOf(' auth:{');
const authEnd = backend.indexOf('\n functions:', authStart);
backend = backend.slice(0, authStart) + ` auth:{
 getSession:async()=>({data:{session:authSession},error:null}),
 signOut:async options=>{state.calls.push({name:'auth.signOut',args:options});authSession=null;announce('SIGNED_OUT',null);return {error:null};},
 verifyOtp:async args=>{state.calls.push({name:'auth.verifyOtp',args});if(window.desktopFixture.holdTicket)await new Promise(r=>window.desktopFixture.releaseTicket=r);authSession={access_token:'test-only',user:{id:window.desktopFixture.exchangeUser??'owner',email:'fixture@example.test',user_metadata:{}}};announce('SIGNED_IN',authSession);return {data:{session:authSession,user:authSession.user},error:null};},
 onAuthStateChange:cb=>{callbacks.add(cb);return {data:{subscription:{unsubscribe(){callbacks.delete(cb)}}}};},
 getUser:async()=>({data:{user:authSession?.user??null},error:null})
 },` + backend.slice(authEnd);
backend = backend.replace(" if(name==='get_actual_study_state')", ` if(name==='complete_study_session'){
  const finish=()=>{state.sessions=state.sessions.map(s=>s.id===args.p_session_id?{...s,status:'completed',ended_at:now}:s);state.reflections.push({session_id:args.p_session_id,note:args.p_note,next_action:args.p_next_action,created_at:now});return {data:null,error:null};};
  if(state.holdCompletion)return new Promise(resolve=>state.releaseCompletion=()=>resolve(finish()));return finish();
 }
 if(name==='get_actual_study_state')`);
backend=backend.replace("if(name==='tech-feed'&&body.action==='timezone')state.profile.time_zone=body.time_zone;",`if(name==='tech-feed'&&body.action==='timezone'){
 if(state.holdTimezone)await new Promise((resolve,reject)=>{state.releaseTimezone=resolve;state.rejectTimezone=()=>reject(new Error('fixture timezone failure'));});
 state.profile.time_zone=body.time_zone;
}`);
backend=backend.replace(" if(name==='get_actual_study_state')",` if(name==='team_study_snapshot')return {data:{tag:state.publicTag??'기존#태그',team:null,members:[],forest:{accepted_seconds:0,pending_sessions:0,trees:0,progress_seconds:0}},error:null};
 if(name==='team_study_action'&&args.p_action==='set_tag'){
  const finish=()=>{state.publicTag=args.p_payload.tag;return {data:{ok:true},error:null};};
  if(state.holdTag)return new Promise((resolve,reject)=>{state.releaseTag=()=>resolve(finish());state.rejectTag=()=>reject(new Error('fixture tag failure'));});return finish();
 }
 if(name==='get_actual_study_state')`);
backend=backend.replace('insert=null,update=null,reflectionOps=[]','insert=null,update=null,upsert=false,reflectionOps=[]')
  .replace("if(key==='upsert'){state.calls.push", "if(key==='upsert'){upsert=true;state.calls.push")
  .replace(" if(update&&table==='study_todos'){", " if(upsert&&table==='profiles'&&state.holdAlarm)return new Promise(resolve=>state.releaseAlarm=()=>resolve({data:state.profile,error:null}));\n if(update&&table==='study_todos'){");
backend=backend.replace(" if(name==='team_study_snapshot')return", ` if(name==='team_study_action'&&args.p_action==='set_goal')return new Promise((resolve,reject)=>{state.releaseGoal=()=>resolve({data:{ok:true},error:null});state.rejectGoal=()=>reject(new Error('fixture goal failure'));});
 if(name==='team_study_snapshot'&&state.teamFixture)return {data:{tag:'기존#태그',team:{id:'team',name:'테스트 팀',owner_id:'owner',time_zone:'Asia/Tokyo',member_count:1},members:[{user_id:'owner',display_name:'본인',state:'ready',share_title:false,share_goal:true,goal:''}],invitations:[],invite_links:[],round:null,forest:{accepted_seconds:0,pending_sessions:0,trees:0,progress_seconds:0},server_now:now},error:null};
 if(name==='team_study_snapshot')return`);
backend=backend.replace(' from:query,', " from:query,channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:async()=>{},");
backend=backend.replace("state.calls.push({name,args:body});", `state.calls.push({name,args:body});
if(name==='tech-feed'&&['save','topics_save'].includes(body.action)){
 await new Promise((resolve,reject)=>{state.releaseFeed=resolve;state.rejectFeed=()=>reject(new Error('fixture feed failure'));});
 if(body.action==='topics_save')return {data:{preferences:{prompt:body.prompt,receiving:true,revision:2},search_status:{state:'ready',last_success_at:now}},error:null};
}`);
let bundle;
async function withDesktop(mode, run, options = {}) {
  bundle ??= build({ entryPoints: [fileURLToPath(new URL('../src/main.tsx', import.meta.url))], bundle: true, write: false, outdir: 'fixture', platform: 'browser', format: 'iife', jsx: 'automatic', logLevel: 'silent', define: { 'import.meta.env': '{"VITE_GOOGLE_AUTH_ENABLED":"true"}' }, plugins: [{ name: 'desktop-boundaries', setup(b) {
    b.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: 'backend', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: backend, loader: 'js' }));
    b.onLoad({ filter: /bodyPresenceDetection\.mjs$/ }, () => ({ contents: 'export async function createUpperBodyPresenceDetector(){return {detect:()=>true,close(){}}}', loader: 'js' }));
  } }] });
  const built = await bundle, js = built.outputFiles.find(f => f.path.endsWith('.js')).text;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.FEED_BROWSER_EXECUTABLE || undefined, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
    const page = await browser.newPage(); page.setDefaultTimeout(5000); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.clock.install({ time: new Date('2026-09-21T14:30:00Z') });
    await page.addInitScript(({ mode, options }) => {
      const listeners = new Set(); const f = window.desktopFixture = { calls: [], nativeUser: mode === 'login' ? null : 'owner', ...options };
      if (options.localStudy) localStorage.setItem('study-room:device-study:owner', 'session');
      if (options.restoreIntent) localStorage.setItem('study-room-camera-monitoring-intent:owner',JSON.stringify({userId:'owner',sessionId:'session',savedAtMs:Date.now()}));
      f.mediaRequests=0;f.cameraQueries=0;f.streams=[];
      const media=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia=args=>{f.mediaRequests++;if(f.denyMedia)return Promise.reject(new DOMException('Denied','NotAllowedError'));return media(args).then(stream=>{f.streams.push(stream);return stream;});};
      if(options.denyAutomatic)navigator.permissions.query=async()=>{f.cameraQueries++;return {state:'denied'};};
      f.emit = event => listeners.forEach(cb => cb(event));
      window.studyRoomDesktop = { protocolVersion: 1, onEvent: cb => { listeners.add(cb); return () => listeners.delete(cb); }, request: async m => {
        f.calls.push(m);
        if (f.fail === m.action) return { id: m.id, ok: false, error: 'AUTH_FAILED' };
        let value = {};
        if (m.action === 'authStatus') { if (f.holdStatus) await new Promise(r => f.releaseStatus = r); value = { userId: f.nativeUser }; }
        if (m.action === 'webTicket') value = { type: 'STUDY_WEB_AUTH_TICKET', requestId: m.id, userId: f.nativeUser, tokenHash: 'fixture-ticket' };
        if (m.action === 'verifyCode') { f.nativeUser = 'owner'; queueMicrotask(() => f.emit({ type: 'auth-changed' })); }
        if (m.action === 'signOut') { f.nativeUser = null; queueMicrotask(() => f.emit({ type: 'auth-changed' })); }
        if (m.action === 'info') value = { platform: 'windows', version: '0.1.0', build: '17', protocolVersion: 1, secureStorage: false };
        if (m.action === 'cameraConsent') value = { allowed: f.cameraAllowed === true };
        return { id: m.id, ok: true, value };
      } };
    }, { mode, options });
    await page.route('https://study-room-attendance.vercel.app/**', async route => {
      const path = new URL(route.request().url()).pathname;
      await route.fulfill({ contentType: path === '/app.js' ? 'text/javascript' : 'text/html', body: path === '/app.js' ? js : '<html><body><div id="root"></div><script src="/app.js"></script></body></html>' });
    });
    await page.goto('https://study-room-attendance.vercel.app/?mode=' + mode, { waitUntil: 'domcontentloaded' }); await run(page); assert.deepEqual(errors, []);
  } finally { await browser?.close(); }
}
mounted('desktop startup hides stale web user and requires same native ticket user', () => withDesktop('start', async page => {
  await page.getByRole('heading', { name: '앱 로그인 연결 중' }).waitFor();
  assert.equal(await page.locator('.dashboard-shell').count(), 0);
  await page.evaluate(() => { desktopFixture.holdStatus = false; desktopFixture.releaseStatus(); });
  await page.locator('.topbar-actions button').first().waitFor();
  assert.equal(await page.evaluate(() => desktopFixture.sdkIdentity()), 'owner');
}, { holdStatus: true }));
mounted('desktop common Google and email OTP keep eight-digit input and route native actions', () => withDesktop('login', async page => {
  await page.getByRole('heading', { name: '독서실에 로그인' }).waitFor();
  assert.equal(await page.locator('.login-shell .login-panel').count(), 1);
  assert.equal(await page.getByRole('button', { name: /GitHub/ }).count(), 0);
  await page.getByRole('button', { name: 'Google로 로그인', exact: true }).click();
  await page.waitForFunction(() => desktopFixture.calls.some(c => c.action === 'signInProvider'));
  await page.getByLabel('이메일', { exact: true }).fill('fixture@example.test');
  await page.getByRole('button', { name: '코드 받기', exact: true }).click();
  const code = page.getByLabel('인증 코드', { exact: true }); await code.waitFor(); assert.equal(await code.getAttribute('maxlength'), '8');
  await code.fill('12345678'); await page.getByRole('button', { name: '코드로 로그인', exact: true }).click();
  await page.locator('.topbar-actions button').first().waitFor();
  assert.deepEqual(await page.evaluate(() => desktopFixture.calls.filter(c => ['sendCode', 'verifyCode', 'signInProvider'].includes(c.action)).map(c => [c.action,c.payload])), [['signInProvider',{provider:'google'}],['sendCode',{email:'fixture@example.test'}],['verifyCode',{email:'fixture@example.test',code:'12345678'}]]);
}));
mounted('desktop quit waits for existing reflection save promise and only then publishes idle', () => withDesktop('active', async page => {
  await page.locator('.topbar-actions button').first().waitFor();
  const camera=page.getByRole('dialog',{name:'카메라 인증 필요'});if(await camera.count()){await page.keyboard.press('Escape');await camera.waitFor({state:'detached'});}
  await page.evaluate(()=>{fixture.holdCompletion=true;desktopFixture.emit({type:'quit-requested',requestId:'quit-save',userId:'owner',sessionId:'session',localEngagement:true});});
  const dialog=page.getByRole('dialog',{name:'오늘의 집중을 짧게 돌아봐요'});await dialog.waitFor();
  await dialog.getByLabel('한 줄 메모',{exact:true}).fill('[테스트] Windows 종료 회고');
  await dialog.getByRole('button',{name:'회고 저장하고 종료',exact:true}).evaluate(button=>{button.click();desktopFixture.emit({type:'state-requested',requestId:'save-same-turn'});});
  await page.waitForFunction(()=>desktopFixture.calls.some(c=>c.id==='save-same-turn'));
  assert.equal(await page.evaluate(()=>desktopFixture.calls.find(c=>c.id==='save-same-turn').payload.operationPending),true);
  await page.waitForFunction(()=>!!fixture.releaseCompletion);
  await page.evaluate(()=>desktopFixture.emit({type:'state-requested',requestId:'save-pending'}));
  await page.waitForFunction(()=>desktopFixture.calls.some(c=>c.id==='save-pending'));
  assert.equal(await page.evaluate(()=>desktopFixture.calls.find(c=>c.id==='save-pending').payload.operationPending),true);
  assert.equal(await page.evaluate(()=>fixture.sessions[0].ended_at),null);
  await page.evaluate(()=>fixture.releaseCompletion());await dialog.waitFor({state:'detached'});
  await page.waitForFunction(()=>desktopFixture.calls.some(c=>c.action==='studyState'&&c.payload.ready&&c.payload.session===null&&!c.payload.operationPending));
  assert.equal(await page.evaluate(()=>fixture.reflections.at(-1).note),'[테스트] Windows 종료 회고');
  assert.equal(await page.evaluate(()=>fixture.calls.filter(c=>c.name==='complete_study_session').length),1);
}, {localStudy:true}));
mounted('desktop paused local quit requires exact native metadata and rejects stale user or session', () => withDesktop('unknown', async page => {
  await page.locator('.topbar-actions button').first().waitFor();
  await page.evaluate(()=>{
    desktopFixture.emit({type:'quit-requested',requestId:'old-user',userId:'old',sessionId:'session',localEngagement:true});
    desktopFixture.emit({type:'quit-requested',requestId:'old-session',userId:'owner',sessionId:'old',localEngagement:true});
  });
  assert.equal(await page.getByRole('dialog',{name:'오늘의 집중을 짧게 돌아봐요'}).count(),0);
  await page.evaluate(()=>desktopFixture.emit({type:'quit-requested',requestId:'paused-local',userId:'owner',sessionId:'session',localEngagement:true}));
  await page.getByRole('dialog',{name:'오늘의 집중을 짧게 돌아봐요'}).waitFor();
  assert.equal(await page.evaluate(()=>fixture.calls.some(c=>/complete_study_session|end_study_session/.test(c.name))),false);
}));
mounted('desktop automatic reload recovery never opens native camera consent or media prompt', () => withDesktop('active', async page => {
  await page.locator('.topbar-actions button').first().waitFor();
  await page.waitForFunction(()=>desktopFixture.cameraQueries>0||desktopFixture.calls.some(c=>c.action==='cameraConsent'));
  assert.equal(await page.evaluate(()=>desktopFixture.calls.filter(c=>c.action==='cameraConsent').length),0);
  assert.equal(await page.evaluate(()=>desktopFixture.mediaRequests),0);
  assert.ok(await page.evaluate(()=>desktopFixture.cameraQueries)>0);
}, {restoreIntent:true,denyAutomatic:true}));
mounted('desktop auth connection failure retries without showing stale dashboard', () => withDesktop('start', async page => {
  await page.getByRole('heading', { name: '앱 로그인 연결에 실패했어요' }).waitFor();
  assert.equal(await page.locator('.topbar-actions').count(), 0);
  await page.evaluate(() => desktopFixture.fail = null); await page.getByRole('button', { name: '다시 연결' }).click();
  await page.locator('.topbar-actions button').first().waitFor();
}, { fail: 'webTicket' }));
mounted('desktop settings show Windows build, secure storage and OS camera settings, never APK updater', () => withDesktop('start', async page => {
  await page.locator('.topbar-actions button').first().waitFor(); await page.goto('https://study-room-attendance.vercel.app/?mode=start#settings');
  await page.getByText('0.1.0 · 빌드 17', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '앱 업데이트 열기' }).count(), 0);
  await page.getByText(/암호화 저장/).waitFor();
  await page.getByRole('button', { name: 'Windows 카메라 설정 열기' }).click();
  assert.equal(await page.evaluate(() => desktopFixture.calls.some(c => c.action === 'cameraConsent')), false);
  assert.equal(await page.evaluate(() => desktopFixture.calls.some(c => c.action === 'openCameraSettings')), true);
  await page.getByRole('button', { name: '로그아웃', exact: true }).click(); await page.getByRole('heading', { name: '독서실에 로그인' }).waitFor();
  assert.equal(await page.evaluate(() => fixture.calls.filter(c => c.name === 'auth.signOut').every(c => c.args?.scope === 'local')), true);
}));
mounted('desktop signed-out quit probe is verified idle without starting study', () => withDesktop('login', async page => {
  await page.getByRole('heading', { name: '독서실에 로그인' }).waitFor();
  await page.evaluate(() => desktopFixture.emit({ type: 'state-requested', requestId: 'quit-state-9' }));
  await page.waitForFunction(() => desktopFixture.calls.some(c => c.id === 'quit-state-9'));
  assert.deepEqual(await page.evaluate(() => desktopFixture.calls.find(c => c.id === 'quit-state-9').payload), {userId:null,ready:true,session:null,cameraActive:false,operationPending:false,activity:'allowed'});
  assert.equal(await page.evaluate(() => fixture.calls.some(c => /confirm_actual|pause_actual/.test(c.name))), false);
}));
mounted('desktop native quit reuses existing reflection and cancelQuit', () => withDesktop('active', async page => {
  await page.locator('.topbar-actions button').first().waitFor();
  const prompt=page.getByRole('dialog',{name:'카메라 인증 필요'}); if(await prompt.count()){await page.keyboard.press('Escape');await prompt.waitFor({state:'detached'});}
  await page.evaluate(() => desktopFixture.emit({type:'quit-requested',requestId:'quit-41',userId:'owner',sessionId:'session',localEngagement:true}));
  const reflection=page.getByRole('dialog',{name:'오늘의 집중을 짧게 돌아봐요'}); await reflection.waitFor();
  await reflection.getByRole('button',{name:'계속 공부하기',exact:true}).click();
  await page.waitForFunction(()=>desktopFixture.calls.some(c=>c.action==='cancelQuit'&&c.payload.requestId==='quit-41'));
  assert.equal(await page.evaluate(()=>fixture.calls.some(c=>/pause_actual|confirm_actual|complete_study_session/.test(c.name))),false);
}, {localStudy:true}));
mounted('desktop fresh quit probe preserves pending todo writes without claiming remote participation', () => withDesktop('start', async page => {
  await page.locator('.topbar-actions button').first().waitFor();
  await page.locator('.topbar-actions button').first().click();
  await page.getByRole('button',{name:'카메라 켜고 시작',exact:true}).click();
  const todos=page.getByRole('dialog',{name:'이번 세션에서 할 일'});await todos.waitFor();
  await todos.getByRole('button',{name:'집중 독서 시간 편집',exact:true}).click();
  await page.evaluate(()=>fixture.holdTodoTimeWrite=true);
  const edit=todos.getByRole('group',{name:'집중 독서 시간 편집'});await edit.getByLabel('시작',{exact:true}).fill('22:30');
  await edit.getByRole('button',{name:'시간 저장',exact:true}).evaluate(button=>{button.click();desktopFixture.emit({type:'state-requested',requestId:'todo-save-same-turn'});});
  await page.waitForFunction(()=>desktopFixture.calls.some(c=>c.id==='todo-save-same-turn'));
  assert.equal(await page.evaluate(()=>desktopFixture.calls.find(c=>c.id==='todo-save-same-turn').payload.operationPending),true);
  await page.waitForFunction(()=>!!fixture.releaseTodoTimeWrite);
  await page.evaluate(()=>desktopFixture.emit({type:'state-requested',requestId:'quit-state-busy'}));
  await page.waitForFunction(()=>desktopFixture.calls.some(c=>c.id==='quit-state-busy'));
  assert.equal(await page.evaluate(()=>desktopFixture.calls.find(c=>c.id==='quit-state-busy').payload.operationPending),true);
  assert.equal(await page.evaluate(()=>fixture.calls.some(c=>/pause_actual|confirm_actual/.test(c.name))),false);
  await page.evaluate(()=>desktopFixture.emit({type:'quit-requested',requestId:'camera-prep',userId:'owner',sessionId:null,localEngagement:false}));
  assert.equal(await todos.isVisible(),true);
  await page.evaluate(()=>fixture.releaseTodoTimeWrite());await todos.waitFor({state:'detached'});
  await page.waitForFunction(()=>desktopFixture.calls.some(c=>c.action==='studyState'&&c.payload.ready&&c.payload.session===null&&!c.payload.cameraActive&&!c.payload.operationPending&&c.payload.activity==='allowed'));
  assert.equal(await page.evaluate(()=>desktopFixture.streams.length>0&&desktopFixture.streams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended'))),true);
  const mediaCount=await page.evaluate(()=>desktopFixture.mediaRequests);await page.clock.fastForward(3000);
  assert.equal(await page.evaluate(()=>desktopFixture.mediaRequests),mediaCount);
  assert.equal(await page.evaluate(()=>fixture.calls.some(c=>/complete_study_session|end_study_session|confirm_actual/.test(c.name))),false);
}, {cameraAllowed:true}));
mounted('desktop observer quit probe never ends remote study or opens reflection', () => withDesktop('remote', async page => {
  await page.locator('.topbar-actions button').first().waitFor();
  await page.evaluate(()=>desktopFixture.emit({type:'state-requested',requestId:'observer'}));
  await page.waitForFunction(()=>desktopFixture.calls.some(c=>c.id==='observer'&&c.payload.ready));
  assert.equal(await page.evaluate(()=>desktopFixture.calls.find(c=>c.id==='observer').payload.activity),'allowed');
  await page.evaluate(()=>desktopFixture.emit({type:'quit-requested',requestId:'observer-quit',userId:'owner',sessionId:'session',localEngagement:false}));
  assert.equal(await page.getByRole('dialog',{name:'오늘의 집중을 짧게 돌아봐요'}).count(),0);
  assert.equal(await page.evaluate(()=>fixture.calls.some(c=>/pause_actual|confirm_actual/.test(c.name))),false);
}));
mounted('desktop camera consent cancel never acquires media, explicit retry can start', () => withDesktop('start', async page => {
  await page.locator('.topbar-actions button').first().waitFor();
  await page.locator('.topbar-actions button').first().click();await page.getByRole('button',{name:'카메라 켜고 시작',exact:true}).click();
  await page.waitForFunction(()=>desktopFixture.calls.some(c=>c.action==='cameraConsent'));
  assert.equal(await page.evaluate(()=>fixture.calls.some(c=>c.name==='confirm_actual_study_action')),false);
  await page.getByRole('dialog',{name:'카메라 인증 필요'}).getByRole('alert').waitFor();
  await page.evaluate(()=>desktopFixture.emit({type:'state-requested',requestId:'cancelled-camera-idle'}));
  await page.waitForFunction(()=>desktopFixture.calls.some(c=>c.id==='cancelled-camera-idle'));
  assert.deepEqual(await page.evaluate(()=>desktopFixture.calls.find(c=>c.id==='cancelled-camera-idle').payload),{userId:'owner',ready:true,session:null,cameraActive:false,operationPending:false,activity:'allowed'});
  assert.equal(await page.evaluate(()=>desktopFixture.mediaRequests),0);
  await page.evaluate(()=>desktopFixture.cameraAllowed=true);
  await page.getByRole('button',{name:'카메라 켜고 시작',exact:true}).click();
  await page.waitForFunction(()=>desktopFixture.calls.filter(c=>c.action==='cameraConsent').length===2);
  await page.getByRole('dialog',{name:'이번 세션에서 할 일'}).waitFor();
}));
mounted('desktop OS camera denial opens fixed Windows settings without another consent prompt', () => withDesktop('start', async page => {
  await page.locator('.topbar-actions button').first().waitFor();
  await page.locator('.topbar-actions button').first().click();await page.getByRole('button',{name:'카메라 켜고 시작',exact:true}).click();
  const prompt=page.getByRole('dialog',{name:'카메라 인증 필요'});
  await prompt.getByRole('button',{name:'앱 설정 열기',exact:true}).click();
  await page.waitForFunction(()=>desktopFixture.calls.some(c=>c.action==='openCameraSettings'));
  assert.equal(await page.evaluate(()=>desktopFixture.calls.filter(c=>c.action==='cameraConsent').length),1);
  assert.equal(await page.evaluate(()=>fixture.calls.some(c=>/complete_study_session|confirm_actual/.test(c.name))),false);
}, {cameraAllowed:true,denyMedia:true}));

async function probe(page,id){
  await page.evaluate(id=>desktopFixture.emit({type:'state-requested',requestId:id}),id);
  await page.waitForFunction(id=>desktopFixture.calls.some(c=>c.id===id),id);
  return page.evaluate(id=>desktopFixture.calls.find(c=>c.id===id).payload,id);
}
for(const outcome of ['success','rejection'])mounted(`desktop timezone ${outcome} stays pending from same-turn submit through actual settlement`,()=>withDesktop('start',async page=>{
  await page.locator('.topbar-actions button').first().waitFor();await page.evaluate(()=>{location.hash='settings';fixture.holdTimezone=true;});
  const form=page.locator('.profile-timezone');await form.getByLabel('시간대 검색·선택').fill('Asia/Seoul');
  await form.getByRole('button',{name:'시간대 저장',exact:true}).evaluate(button=>{button.click();desktopFixture.emit({type:'state-requested',requestId:'timezone-same-turn'});});
  await page.waitForFunction(()=>desktopFixture.calls.some(c=>c.id==='timezone-same-turn'));
  assert.equal(await page.evaluate(()=>desktopFixture.calls.find(c=>c.id==='timezone-same-turn').payload.operationPending),true);
  await page.waitForFunction(()=>!!fixture.releaseTimezone);
  assert.equal((await probe(page,'timezone-held')).operationPending,true);
  await page.evaluate(outcome=>outcome==='success'?fixture.releaseTimezone():fixture.rejectTimezone(),outcome);
  if(outcome==='success')await form.getByText('시간대를 저장했어요. 앞으로의 일정과 알림에 적용됩니다.',{exact:true}).waitFor();else await form.getByRole('alert').waitFor();
  const state=await probe(page,'timezone-settled');assert.equal(state.operationPending,false);assert.equal(state.activity,'allowed');assert.equal(state.ready,true);
}));
for(const outcome of ['success','rejection'])mounted(`desktop team goal ${outcome} is pending synchronously through unmount and settlement`,()=>withDesktop('start',async page=>{
  await page.locator('.topbar-actions button').first().waitFor();
  await page.evaluate(()=>{fixture.teamFixture=true;location.hash='together';});
  await page.getByLabel('목표',{exact:true}).fill('명확한 목표');
  await page.getByRole('button',{name:'목표 저장',exact:true}).evaluate(button=>{button.click();desktopFixture.emit({type:'state-requested',requestId:'team-same-turn'});});
  await page.waitForFunction(()=>desktopFixture.calls.some(c=>c.id==='team-same-turn'));
  assert.equal(await page.evaluate(()=>desktopFixture.calls.find(c=>c.id==='team-same-turn').payload.operationPending),true);
  await page.waitForFunction(()=>!!fixture.releaseGoal);
  await page.evaluate(()=>{location.hash='settings';fixture.holdTimezone=true;});
  const zone=page.locator('.profile-timezone');await zone.getByLabel('시간대 검색·선택').fill('Asia/Seoul');await zone.getByRole('button',{name:'시간대 저장',exact:true}).click();
  await page.waitForFunction(()=>!!fixture.releaseTimezone);
  await page.evaluate(outcome=>outcome==='success'?fixture.releaseGoal():fixture.rejectGoal(),outcome);
  assert.equal((await probe(page,'team-settled-zone-held')).operationPending,true);
  await page.evaluate(()=>fixture.releaseTimezone());await zone.getByText('시간대를 저장했어요. 앞으로의 일정과 알림에 적용됩니다.',{exact:true}).waitFor();
  const idle=await probe(page,'team-all-settled');assert.equal(idle.operationPending,false);assert.equal(idle.ready,true);assert.equal(idle.activity,'allowed');
  assert.equal(await page.evaluate(()=>fixture.calls.some(c=>/complete_study_session|end_study_session/.test(c.name))),false);
}));
for(const action of ['save','topics_save'])for(const outcome of ['success','rejection'])mounted(`desktop feed ${action} ${outcome} remains pending from same-turn and after tab unmount`,()=>withDesktop('start',async page=>{
  await page.locator('.topbar-actions button').first().waitFor();await page.evaluate(()=>location.hash='feed');
  const feed=page.locator('.tech-feed');await feed.locator('.feed-card').first().waitFor();
  let button;
  if(action==='save')button=feed.locator('.feed-card').first().getByRole('button',{name:'저장',exact:true});
  else {
    await feed.locator('.feed-settings-panel > summary').click();
    await feed.getByLabel('관심 내용',{exact:true}).fill('React 접근성과 PostgreSQL 성능 개선');
    button=feed.getByRole('button',{name:'관심 내용 변경',exact:true});
  }
  await button.evaluate(button=>{button.click();desktopFixture.emit({type:'state-requested',requestId:'feed-same-turn'});});
  await page.waitForFunction(()=>desktopFixture.calls.some(c=>c.id==='feed-same-turn'));
  assert.equal(await page.evaluate(()=>desktopFixture.calls.find(c=>c.id==='feed-same-turn').payload.operationPending),true);
  await page.waitForFunction(()=>!!fixture.releaseFeed);
  await page.evaluate(()=>location.hash='settings');await page.locator('.profile-timezone').waitFor();
  assert.equal((await probe(page,'feed-unmounted-held')).operationPending,true);
  await page.evaluate(outcome=>outcome==='success'?fixture.releaseFeed():fixture.rejectFeed(),outcome);
  const idle=await probe(page,'feed-settled');assert.equal(idle.operationPending,false);assert.equal(idle.activity,'allowed');assert.equal(idle.ready,true);
}));
for(const producer of ['team','feed'])mounted(`desktop ${producer} unresolved old-account write survives auth parent unmount and signed-out matching probe`,()=>withDesktop('start',async page=>{
  await page.locator('.topbar-actions button').first().waitFor();
  if(producer==='team'){
    await page.evaluate(()=>{fixture.teamFixture=true;location.hash='together';});
    await page.getByLabel('목표',{exact:true}).fill('계정 전환 전 목표');await page.getByRole('button',{name:'목표 저장',exact:true}).click();
    await page.waitForFunction(()=>!!fixture.releaseGoal);
  }else{
    await page.evaluate(()=>location.hash='feed');await page.locator('.feed-card').first().getByRole('button',{name:'저장',exact:true}).click();
    await page.waitForFunction(()=>!!fixture.releaseFeed);
  }
  await page.evaluate(()=>{desktopFixture.nativeUser=null;desktopFixture.emit({type:'auth-changed'});});
  await page.getByRole('heading',{name:'독서실에 로그인',exact:true}).waitFor();
  const held=await probe(page,'old-account-held');assert.equal(held.userId,null);assert.equal(held.operationPending,true);assert.equal(held.activity,'allowed');
  await page.evaluate(producer=>producer==='team'?fixture.rejectGoal():fixture.rejectFeed(),producer);
  const settled=await probe(page,'old-account-settled');assert.equal(settled.userId,null);assert.equal(settled.operationPending,false);assert.equal(settled.ready,true);
}));
mounted('desktop overlapping timezone and public-tag saves release only their own pending count',()=>withDesktop('start',async page=>{
  await page.locator('.topbar-actions button').first().waitFor();await page.evaluate(()=>{location.hash='settings';fixture.holdTimezone=true;fixture.holdTag=true;});
  const zone=page.locator('.profile-timezone'),tag=page.locator('.public-tag-settings');
  await tag.getByLabel('공개 사용자 태그',{exact:true}).waitFor();await tag.getByLabel('공개 사용자 태그',{exact:true}).fill('새이름#새태그');
  await tag.getByRole('button',{name:'태그 저장',exact:true}).evaluate(button=>{button.click();desktopFixture.emit({type:'state-requested',requestId:'tag-same-turn'});});
  await page.waitForFunction(()=>desktopFixture.calls.some(c=>c.id==='tag-same-turn'));
  assert.equal(await page.evaluate(()=>desktopFixture.calls.find(c=>c.id==='tag-same-turn').payload.operationPending),true);
  await page.waitForFunction(()=>!!fixture.releaseTag);
  await zone.getByLabel('시간대 검색·선택').fill('Asia/Seoul');await zone.getByRole('button',{name:'시간대 저장',exact:true}).click();await page.waitForFunction(()=>!!fixture.releaseTimezone);
  await page.evaluate(()=>fixture.releaseTimezone());await zone.getByText('시간대를 저장했어요. 앞으로의 일정과 알림에 적용됩니다.',{exact:true}).waitFor();
  assert.equal((await probe(page,'tag-still-held')).operationPending,true);
  await page.evaluate(()=>fixture.rejectTag());await tag.getByRole('alert').waitFor();
  const state=await probe(page,'both-settled');assert.equal(state.operationPending,false);assert.equal(state.activity,'allowed');
}));
mounted('desktop retained alarm save marks pending synchronously before React commits',()=>withDesktop('start',async page=>{
  await page.locator('.topbar-actions button').first().waitFor();await page.evaluate(()=>{location.hash='settings';fixture.holdAlarm=true;});
  const settings=page.locator('.settings-notifications');await settings.locator('summary').click();
  await settings.getByRole('button',{name:'알람 편집',exact:true}).click();
  await settings.getByLabel('평일 알림 시간').fill('10:00');
  await settings.getByRole('button',{name:'알람 저장',exact:true}).evaluate(button=>{button.click();desktopFixture.emit({type:'state-requested',requestId:'alarm-same-turn'});});
  await page.waitForFunction(()=>desktopFixture.calls.some(c=>c.id==='alarm-same-turn'));
  assert.equal(await page.evaluate(()=>desktopFixture.calls.find(c=>c.id==='alarm-same-turn').payload.operationPending),true);
  await page.waitForFunction(()=>!!fixture.releaseAlarm);assert.equal((await probe(page,'alarm-held')).operationPending,true);
  await page.evaluate(()=>fixture.releaseAlarm());await settings.getByRole('button',{name:'알람 편집',exact:true}).waitFor();
  const state=await probe(page,'alarm-settled');assert.equal(state.operationPending,false);assert.equal(state.activity,'allowed');
}));
