import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
let chromium;
try { ({chromium} = await import(process.env.FEED_BROWSER_MODULE ? pathToFileURL(process.env.FEED_BROWSER_MODULE).href : 'playwright')); } catch {}
const browserTest = (name, run) => test(name, {skip: !chromium && 'Set FEED_BROWSER_MODULE and FEED_BROWSER_EXECUTABLE for mounted main application tests'}, run);

const backend = `
const now='2026-09-21T14:30:00Z';
const todo=(id,title,date='2026-09-21')=>({id,user_id:'owner',title,local_date:date,start_time:'23:00:00',end_time:'01:00:00',is_completed:false,position:0,goal_id:'goal',repeat_group_id:'repeat',repeat_mode:'weekly',repeat_weekdays:[1],repeat_until:null,repeat_forever:true,created_at:now,original_start_at:'2026-09-21T14:00:00Z',original_end_at:'2026-09-21T16:00:00Z',target_seconds:7200,first_started_at:'2026-09-21T14:00:00Z',first_tracked_at:'2026-09-21T14:00:00Z',known_seconds:1800,open_started_at:'2026-09-21T14:00:00Z',remaining_seconds:5400,adjustment_count:1,evaluation_eligible:true,unknown_allocation:false});
const row={id:'session',user_id:'owner',local_date:'2026-09-21',started_at:'2026-09-21T14:00:00Z',ended_at:null,duration_seconds:0,status:'active',lease_expires_at:'2026-09-22T00:00:00Z',lease_warning_sent_at:null,paused_at:null,paused_seconds:0};
const state=window.fixture={calls:[],todos:[todo('a','집중 독서'),todo('b','다음 날 알고리즘','2026-09-22')],sessions:[row],collision:true,stale:false,failConfirm:false,blocking:null,reportFail:false,excluded:60,current:'a'};
state.links=['a','b'];
const mode=new URLSearchParams(location.search).get('mode');
if(['empty-links','completed-links','active-empty'].includes(mode)){state.links=mode==='completed-links'?['a']:[];state.current=null;state.sessions[0].paused_at=mode==='active-empty'?null:now;state.todos[0].is_completed=mode==='completed-links';state.todos[1].local_date='2026-09-21';state.todos.forEach(t=>{t.first_started_at=null;t.unknown_allocation=true;t.evaluation_eligible=false;});}
if(mode==='start'){state.sessions=[];state.todos.forEach(t=>t.local_date='2026-09-21');}
if(mode==='unknown'){state.current=null;state.sessions[0].paused_at=now;state.todos.forEach(t=>{t.first_started_at=null;t.unknown_allocation=true;t.evaluation_eligible=false;});}
const authSession={access_token:'test-only',user:{id:'owner',email:'fixture@example.test',user_metadata:{}}};
const track=()=>({session_id:'session',current_todo_id:state.current,tracking_started_at:row.started_at,excluded_seconds:state.excluded,unknown_allocation:false,server_now:now,todos:state.todos.filter(t=>state.links.includes(t.id)).map(t=>({...t,open_started_at:state.sessions[0]?.paused_at||t.id!==state.current?null:row.started_at}))});
function result(name,args){state.calls.push({name,args});
 if(name==='get_actual_study_state')return {data:track(),error:null};
 if(name==='checkpoint_actual_study_exclusion'){state.excluded=Math.max(state.excluded,args.p_excluded_seconds);return {data:track(),error:null};}
 if(name==='pause_actual_study_session' && state.holdPause)return new Promise(resolve=>{state.releasePause=()=>{state.sessions[0]={...state.sessions[0],paused_at:now};resolve({data:state.sessions[0],error:null});};});
 if(name==='pause_actual_study_session'){state.sessions[0]={...state.sessions[0],paused_at:now};state.excluded=args.p_excluded_seconds;return {data:state.sessions[0],error:null};}
 if(name==='preview_actual_study_action')return {data:{version:1,action:args.p_action,session_id:args.p_session_id,todo_ids:args.p_todo_ids,current_todo_id:args.p_current_todo_id,excluded_seconds:args.p_excluded_seconds,proposed_at:now,expires_at:'2026-09-21T14:31:00Z',time_zone:'Asia/Tokyo',remaining_seconds:5400,revision:'revision',cascade_complete:!state.blocking,blocking_error:state.blocking,changes:state.collision?state.todos.map(t=>({todo_id:t.id,title:t.title,before:{start_at:'2026-09-21T14:00:00Z',end_at:'2026-09-21T16:00:00Z',local_date:'2026-09-21',end_date:'2026-09-22',start_time:'23:00:00',end_time:'01:00:00'},after:{start_at:'2026-09-21T14:30:00Z',end_at:'2026-09-21T16:30:00Z',local_date:'2026-09-21',end_date:'2026-09-22',start_time:'23:30:00',end_time:'01:30:00'}})):[]},error:null};
 if(name==='confirm_actual_study_action'){
  if(state.holdConfirm)return new Promise(resolve=>{const saved={request_id:args.p_request_id,session:{...row},preview:args.p_preview,tracking:track()};state.releaseConfirm=()=>resolve({data:saved,error:null});});
  if(state.failConfirm){state.failConfirm=false;throw new TypeError('Network lost');}
  if(state.stale){state.stale=false;return {data:null,error:{message:'ACTUAL_STUDY_STALE_PREVIEW',code:'P0001'}};}
  state.links=[...new Set([...state.links,...args.p_preview.todo_ids])];state.todos.filter(t=>state.links.includes(t.id)).forEach(t=>{if(['empty-links','completed-links','active-empty'].includes(mode)){t.first_started_at=null;t.first_tracked_at=now;t.unknown_allocation=true;t.evaluation_eligible=false;}});state.current=args.p_preview.current_todo_id;state.sessions=[{...row,paused_at:null}];return {data:{request_id:args.p_request_id,session:state.sessions[0],preview:args.p_preview,tracking:track()},error:null};
 }
 if(name==='get_actual_study_report')return state.reportFail?{error:{message:'report failed'},data:null}:{error:null,data:{scheduled_count:2,started_count:1,on_time_count:0,on_time_ratio:0,adjustment_count:3,unstarted_count:1,plans:[{todo_id:'a',title:'집중 독서',original_start_at:'2026-09-21T12:00:00Z',first_started_at:'2026-09-21T14:00:00Z',delay_minutes:120,adjustment_count:3,is_unstarted:false}]}};
 if(name==='get_study_period_summary')return {data:{completed_seconds:3600,completed_session_count:1,anomaly_session_count:0,cross_date_session_count:0},error:null};
 return {data:[],error:null};
}
function query(table){let single=false,insert=null;const q=new Proxy({}, {get(_,key){if(key==='then')return (resolve,reject)=>Promise.resolve().then(()=>{if(insert && table==='study_todos'){const added={...todo('new',''),...insert[0],id:'new'};state.todos.push(added);return {data:added,error:null};}let data=table==='profiles'?{user_id:'owner',time_zone:'Asia/Tokyo',reminder_time:'09:00',email_reminders_enabled:false}:table==='study_goals'?[{id:'goal',title:'자격증 목표',target_date:'2026-12-31',target_study_seconds:0,status:'active',created_at:now,updated_at:now}]:table==='study_sessions'?state.sessions:table==='study_todos'?state.todos:table==='study_session_todos'?state.todos.filter(t=>state.links.includes(t.id)).map(t=>({id:t.id,session_id:'session',todo_id:t.id,user_id:'owner',linked_at:now,completed_during_session:false})):[];return {data:single?(Array.isArray(data)?data[0]??null:data):data,error:null};}).then(resolve,reject);return (...args)=>{if(key==='maybeSingle'||key==='single')single=true;if(key==='insert')insert=args[0];return q;};}});return q;}
export const isSupabaseConfigured=true,supabaseUrl='https://fixture.invalid',supabaseAnonKey='test';
export const supabase={from:query,rpc(name,args){const q={then(resolve,reject){return Promise.resolve().then(()=>result(name,args)).then(resolve,reject);},abortSignal(){return q;}};return q;},auth:{getSession:async()=>({data:{session:authSession},error:null}),onAuthStateChange:callback=>{state.changeOwner=()=>{state.sessions=[];state.todos=[];state.reportFail=true;callback('SIGNED_IN',{...authSession,user:{...authSession.user,id:'other'}});};return {data:{subscription:{unsubscribe(){}}}};},getUser:async()=>({data:{user:authSession.user},error:null})},functions:{invoke:async()=>({data:{},error:null})}};
`;

async function withApp(width, run, mode='active') {
  const built=await build({entryPoints:[fileURLToPath(new URL('../src/main.tsx',import.meta.url))],bundle:true,write:false,outdir:'fixture',platform:'browser',format:'iife',jsx:'automatic',logLevel:'silent',define:{'import.meta.env':'{}'},plugins:[{name:'local-boundaries',setup(b){b.onResolve({filter:/^\.\/supabase$/},()=>({path:'backend',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:backend,loader:'js'}));b.onLoad({filter:/bodyPresenceDetection\.mjs$/},()=>({contents:'export async function createUpperBodyPresenceDetector(){return {detect:()=>true,close(){}}}',loader:'js'}));}}]});
  const js=built.outputFiles.find(f=>f.path.endsWith('.js')).text, css=built.outputFiles.find(f=>f.path.endsWith('.css'))?.text||'';
  const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':req.url==='/app.css'?'text/css':'text/html');res.end(req.url==='/app.js'?js:req.url==='/app.css'?css:'<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try {browser=await chromium.launch({headless:true,executablePath:process.env.FEED_BROWSER_EXECUTABLE||undefined,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});const page=await browser.newPage({viewport:{width,height:960}});page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-09-21T14:30:00Z')});await page.goto('http://127.0.0.1:'+server.address().port+'?mode='+mode);await page.locator('.topbar-actions button:not([disabled])').first().waitFor();if(mode==='active'||mode==='active-empty'){await page.getByRole('dialog',{name:'카메라 인증 필요'}).waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});}await run(page);assert.deepEqual(errors,[]);}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
}


for(const mode of ['empty-links','completed-links'])browserTest('mounted main: '+mode+' resumes through today selector and cancellation never links',()=>withApp(390,async page=>{
 const initial=await page.evaluate(()=>fixture.links.length);
 await page.getByRole('button',{name:'공부 계속하기',exact:true}).click();
 const selection=page.getByRole('dialog',{name:'이번 세션에서 할 일 선택'});await selection.waitFor();
 await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>fixture.links.length),initial);
 await page.getByRole('button',{name:'공부 계속하기',exact:true}).click();await selection.waitFor();
 await selection.getByPlaceholder('예: AWS 기출 1회 풀기').fill('재개할 새 공부');await selection.getByRole('button',{name:'추가',exact:true}).click();
 await selection.locator('.session-todo-choice-list input[type=checkbox]').evaluateAll(inputs=>{for(const input of inputs){if(input.checked && input.closest('label')?.textContent.includes('재개할 새 공부')===false)input.click();}});
 const radio=selection.getByRole('radio',{name:'재개할 새 공부',exact:true});if(await radio.count())await radio.check();
 await selection.getByRole('button',{name:'선택한 할 일로 재개'}).click();
 await page.getByRole('button',{name:'카메라 켜고 공부 계속하기',exact:true}).click();
 const confirmation=page.getByRole('dialog',{name:'공부와 일정 변경 확인'});await confirmation.waitFor();
 assert.equal(await page.evaluate(()=>fixture.links.length),initial);
 await page.getByRole('button',{name:'취소 · 그대로 두기'}).click();
 assert.equal(await page.evaluate(()=>fixture.links.length),initial);assert.ok(await page.evaluate(()=>fixture.sessions[0].paused_at));
 await page.getByRole('button',{name:'공부 계속하기',exact:true}).click();await selection.waitFor();
 await selection.locator('.session-todo-choice-list label').filter({hasText:'재개할 새 공부'}).locator('input').check();
 const focus=selection.getByRole('radio',{name:'재개할 새 공부',exact:true});if(await focus.count())await focus.check();
 await selection.getByRole('button',{name:'선택한 할 일로 재개'}).click();await page.getByRole('button',{name:'카메라 켜고 공부 계속하기',exact:true}).click();
 await confirmation.waitFor();await page.getByRole('button',{name:'변경 확인 후 재개'}).click();
 await page.locator('.actual-current').getByRole('heading',{name:'재개할 새 공부',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>fixture.links.includes('new')),true);
 assert.equal(await page.evaluate(()=>fixture.sessions[0].paused_at),null);
 assert.doesNotMatch(await page.locator('.actual-current').textContent(),/최초 시작|늦게 시작/);
 assert.equal(await page.evaluate(()=>fixture.calls.some(c=>c.name==='start_study_session'||c.name==='set_study_session_todos')),false);
},mode));

browserTest('mounted main: active legacy empty links can choose today focus without restarting session',()=>withApp(390,async page=>{
 await page.getByRole('button',{name:'집중할 할 일 선택',exact:true}).click();
 const selection=page.getByRole('dialog',{name:'이번 세션에서 할 일 선택'});await selection.waitFor();
 await selection.locator('.session-todo-choice-list input[type=checkbox]').first().check();
 await selection.getByRole('button',{name:'선택한 할 일로 전환'}).click();
 await page.getByRole('dialog',{name:'공부와 일정 변경 확인'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>fixture.links),[]);
 await page.getByRole('button',{name:'변경 확인 후 전환'}).click();
 await page.locator('.actual-current').getByRole('heading',{name:'집중 독서',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>fixture.calls.find(c=>c.name==='preview_actual_study_action').args.p_action),'switch');
},'active-empty'));

for(const width of [1440,390])browserTest('mounted main: focused progress, next-day switch, all collision dates, Escape/cancel at '+width+'px',()=>withApp(width,async page=>{
  await page.getByRole('heading',{name:'집중 독서',exact:true}).waitFor();
  assert.match(await page.locator('.session-todo-panel').textContent(),/30분 0초/);
  assert.match(await page.locator('.session-todo-panel').textContent(),/영구 반복/);
  assert.match(await page.locator('.session-todo-panel').textContent(),/자격증 목표/);
  const contrast=await page.locator('.actual-start').first().evaluate(el=>{
    const rgb=value=>value.match(/[0-9.]+/g).map(Number);
    const fg=rgb(getComputedStyle(el).color), panel=el.closest('.session-todo-panel'), bg=rgb(getComputedStyle(panel).backgroundColor), parent=rgb(getComputedStyle(panel.closest('.daily-visual')).backgroundColor);
    const alpha=bg[3]??1, composite=bg.slice(0,3).map((v,i)=>v*alpha+parent[i]*(1-alpha));
    const luminance=c=>c.map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
    const a=luminance(fg),b=luminance(composite);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
  });assert.ok(contrast>=4.5,'session metadata contrast '+contrast);
  await mkdir('output/playwright',{recursive:true});await page.locator('.session-todo-panel').scrollIntoViewIfNeeded();await page.screenshot({path:'output/playwright/actual-study-panel-'+width+'.png',fullPage:false});
  assert.equal(await page.getByRole('button',{name:'다음 날 알고리즘로 전환'}).isVisible(),false);
  await page.getByText('다음 할 일 (1)',{exact:true}).click();
  await page.getByRole('button',{name:'다음 날 알고리즘로 전환'}).click();
  const dialog=page.getByRole('dialog',{name:'공부와 일정 변경 확인'});await dialog.waitFor();await page.clock.runFor(32);
  assert.match(await dialog.textContent(),/2개/);assert.match(await dialog.textContent(),/2026\.09\.22 01:30/);
  assert.equal(await page.evaluate(()=>document.querySelector('[role=dialog]').contains(document.activeElement)),true);
  await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.querySelector('[role=dialog]').contains(document.activeElement)),true);
  await mkdir('output/playwright',{recursive:true});await page.screenshot({path:'output/playwright/actual-study-modal-'+width+'.png',fullPage:false});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});await page.clock.runFor(32);
  assert.equal(await page.getByRole('button',{name:'다음 날 알고리즘로 전환'}).evaluate(el=>el===document.activeElement),true);
  assert.equal(await page.evaluate(()=>fixture.calls.filter(c=>c.name==='confirm_actual_study_action').length),0);
}));

browserTest('mounted main: uncertain retry and stale proposal require renewed confirmation',()=>withApp(1440,async page=>{
 await page.getByRole('heading',{name:'집중 독서',exact:true}).waitFor();await page.getByText('다음 할 일 (1)',{exact:true}).click();await page.getByRole('button',{name:'다음 날 알고리즘로 전환'}).click();
 await page.evaluate(()=>fixture.failConfirm=true);await page.getByRole('button',{name:'변경 확인 후 전환'}).click();await page.getByText(/결과가 불확실/).waitFor();await page.getByRole('button',{name:'같은 요청 다시 확인'}).click();
 await page.getByRole('heading',{name:'다음 날 알고리즘',exact:true}).waitFor();
 const calls=await page.evaluate(()=>fixture.calls.filter(c=>c.name==='confirm_actual_study_action'));assert.deepEqual(calls[0].args,calls[1].args);
 assert.equal(await page.evaluate(()=>Boolean(localStorage.getItem('study-room-session-activity:owner:session'))),true);
 await page.getByText('다음 할 일 (1)',{exact:true}).click();await page.getByRole('button',{name:'집중 독서로 전환'}).click();await page.evaluate(()=>fixture.stale=true);await page.getByRole('button',{name:'변경 확인 후 전환'}).click();await page.getByText(/새 제안/).waitFor();assert.equal(await page.locator('.actual-current').getByRole('heading',{name:'다음 날 알고리즘',exact:true}).count(),1);
 await page.getByRole('button',{name:'변경 확인 후 전환'}).click();await page.getByRole('heading',{name:'집중 독서',exact:true}).waitFor();
}));

browserTest('mounted main: title-only quick add, explicit multiple focus and cancelled start never create session',()=>withApp(390,async page=>{
 await page.locator('.topbar-actions button').first().click();
 await page.getByRole('button',{name:'카메라 켜고 시작',exact:true}).click();
 const selection=page.getByRole('dialog',{name:'이번 세션에서 할 일 선택'});await selection.waitFor();
 await selection.getByPlaceholder('예: AWS 기출 1회 풀기').fill('제목만 새 공부');
 await selection.getByRole('button',{name:'추가',exact:true}).click();
 assert.equal(await page.evaluate(()=>fixture.todos.find(t=>t.id==='new').start_time),null);
 await selection.locator('.session-todo-choice-list input[type=checkbox]').first().check();
 assert.equal(await selection.getByRole('button',{name:'선택한 할 일로 시작'}).isDisabled(),true);
 await selection.getByRole('radio',{name:'제목만 새 공부',exact:true}).check();
 await selection.getByRole('button',{name:'선택한 할 일로 시작'}).click();
 await page.getByRole('dialog',{name:'공부와 일정 변경 확인'}).waitFor();
 assert.equal(await page.evaluate(()=>fixture.sessions.length),0);
 await page.getByRole('button',{name:'취소 · 그대로 두기'}).click();
 assert.equal(await page.evaluate(()=>fixture.calls.filter(c=>c.name==='confirm_actual_study_action').length),0);
 assert.equal(await page.evaluate(()=>fixture.sessions.length),0);
 assert.equal(await page.locator('.session-todo-panel').count(),0);
},'start'));

browserTest('mounted main: single-focus no-collision start commits through the existing button',()=>withApp(390,async page=>{
 await page.evaluate(()=>fixture.collision=false);
 await page.locator('.topbar-actions button').first().click();await page.getByRole('button',{name:'카메라 켜고 시작',exact:true}).click();
 const selection=page.getByRole('dialog',{name:'이번 세션에서 할 일 선택'});await selection.waitFor();
 await selection.getByRole('button',{name:'선택한 할 일로 시작'}).click();
 await page.locator('.actual-current').getByRole('heading',{name:'집중 독서',exact:true}).waitFor();
 assert.equal(await page.getByRole('dialog',{name:'공부와 일정 변경 확인'}).count(),0);
 const actions=await page.evaluate(()=>fixture.calls.filter(c=>c.name.includes('actual_study_action')));
 assert.equal(actions[0].name,'preview_actual_study_action');assert.equal(actions[0].args.p_current_todo_id,'a');assert.equal(actions[1].name,'confirm_actual_study_action');
},'start'));

browserTest('mounted main: legacy unknown resume asks focus without inventing first start',()=>withApp(390,async page=>{
 await page.getByText(/현재 집중할 일을 선택/).waitFor();
 await page.getByRole('radio',{name:'다음 날 알고리즘',exact:true}).check();
 await page.getByRole('button',{name:'공부 계속하기',exact:true}).click();
 await page.getByRole('button',{name:'카메라 켜고 공부 계속하기',exact:true}).click();
 await page.getByRole('dialog',{name:'공부와 일정 변경 확인'}).waitFor();
 await page.getByRole('button',{name:'변경 확인 후 재개'}).click();
 await page.locator('.actual-current').getByRole('heading',{name:'다음 날 알고리즘',exact:true}).waitFor();
 assert.match(await page.locator('.session-todo-panel').textContent(),/이전 공부시간 배분 미확인/);
 assert.doesNotMatch(await page.locator('.actual-current').textContent(),/최초 시작|늦게 시작/);
},'unknown'));

browserTest('mounted main: unrepresentable schedule shows Korean help without legacy start fallback',()=>withApp(1440,async page=>{
 await page.evaluate(()=>fixture.blocking='UNREPRESENTABLE_SCHEDULE');
 await page.getByText('다음 할 일 (1)',{exact:true}).click();
 await page.getByRole('button',{name:'다음 날 알고리즘로 전환'}).click();
 await page.getByText(/현재 시간표에 정확히 표시할 수 없어요/).waitFor();
 assert.equal(await page.evaluate(()=>fixture.calls.some(c=>c.name==='confirm_actual_study_action'||c.name==='start_study_session')),false);
}));

browserTest('mounted main: planning report failure does not erase study achievements and uses selected period',()=>withApp(1440,async page=>{
 await page.getByRole('link',{name:'내 페이지',exact:true}).click();
 const report=page.getByRole('region',{name:'계획 준수'});await report.getByText('0%',{exact:true}).waitFor();
 await report.getByText('할 일별 최초 시작 지연',{exact:true}).click();
 assert.match(await report.textContent(),/최초 120분 지연/);assert.match(await report.textContent(),/시작한 시간 지정 할 일 1개 기준/);
 await page.evaluate(()=>fixture.reportFail=true);
 await page.getByRole('button',{name:'월간',exact:true}).click();
 await report.getByRole('alert').waitFor();
 assert.equal(await page.locator('.study-report-ready').isVisible(),true);
 const last=await page.evaluate(()=>fixture.calls.filter(c=>c.name==='get_actual_study_report').at(-1).args);
 assert.deepEqual(last,{p_start_date:'2026-09-01',p_end_date:'2026-09-21'});
}));

browserTest('mounted main: duplicate pause is one request and late confirm cannot restore the old account',async()=>{
 await withApp(1440,async page=>{
  await page.evaluate(()=>{fixture.holdPause=true;const b=document.querySelector('.topbar-actions button');b.click();b.click();});
  await page.waitForFunction(()=>Boolean(fixture.releasePause));
  assert.equal(await page.evaluate(()=>fixture.calls.filter(c=>c.name==='pause_actual_study_session').length),1);
  await page.evaluate(()=>fixture.releasePause());
  await page.getByRole('button',{name:'공부 계속하기',exact:true}).waitFor();
 });
 await withApp(1440,async page=>{
  await page.getByText('다음 할 일 (1)',{exact:true}).click();await page.getByRole('button',{name:'다음 날 알고리즘로 전환'}).click();
  await page.evaluate(()=>fixture.holdConfirm=true);
  await page.getByRole('button',{name:'변경 확인 후 전환'}).click();
  await page.waitForFunction(()=>Boolean(fixture.releaseConfirm));
  await page.evaluate(()=>fixture.changeOwner());
  await page.getByRole('dialog',{name:'공부와 일정 변경 확인'}).waitFor({state:'detached'});
  await page.evaluate(()=>fixture.releaseConfirm());
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.session-todo-panel').count(),0);
 });
});

browserTest('mounted main: pause checkpoints hydrated total and freezes known progress',()=>withApp(390,async page=>{
 await page.getByRole('heading',{name:'집중 독서',exact:true}).waitFor();await page.getByRole('button',{name:'잠시 쉬기',exact:true}).click();await page.getByRole('button',{name:'공부 계속하기',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>fixture.calls.find(c=>c.name==='pause_actual_study_session').args.p_excluded_seconds),60);
 const before=await page.locator('.actual-progress').textContent();await page.clock.fastForward(5000);assert.equal(await page.locator('.actual-progress').textContent(),before);
}));

for (const width of [375, 1440]) browserTest(`mounted session plan: readable, accessible time checkbox at ${width}px`, () => withApp(width, async page => {
 await page.locator('.topbar-actions button').first().click();
 await page.getByRole('button', {name:'카메라 켜고 시작',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'이번 세션에서 할 일'});
 await dialog.waitFor();
 await mkdir('output/playwright',{recursive:true});
 const phase=process.env.SESSION_PLAN_SNAPSHOT_PHASE==='before'?'before':'after';
 await page.screenshot({path:`output/playwright/session-plan-${phase}-${width}.png`,fullPage:false});
 const headingBox=await dialog.getByRole('heading',{name:'이번 세션에서 할 일 선택'}).boundingBox();
 const closeBox=await dialog.getByRole('button',{name:'세션 할 일 선택 닫기'}).boundingBox();
 assert.ok(headingBox && closeBox && closeBox.y < headingBox.y+headingBox.height,'close button stays beside the heading');
 const checkbox=dialog.getByRole('checkbox',{name:/시간 지정/});
 const box=await checkbox.boundingBox();
 assert.ok(box && box.width>=18 && box.width<=24 && box.height>=18 && box.height<=24,`time checkbox size ${JSON.stringify(box)}`);
 assert.equal(await dialog.getByRole('textbox',{name:'새 할 일'}).count(),1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await dialog.getByRole('textbox',{name:'새 할 일'}).focus();
 await page.keyboard.press('Tab');
 assert.equal(await checkbox.evaluate(el=>el===document.activeElement),true);
 assert.equal(await checkbox.evaluate(el=>getComputedStyle(el.closest('.actual-time-toggle')).outlineStyle!=='none'),true);
 await checkbox.check();
 assert.equal(await dialog.locator('input[type="time"][aria-label="새 할 일 시작 시간 선택"]').count(),1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
} ,'start'));
