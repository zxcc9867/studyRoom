import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
let chromium;
try { ({chromium} = await import(process.env.FEED_BROWSER_MODULE ? pathToFileURL(process.env.FEED_BROWSER_MODULE).href : 'playwright')); } catch {}
const browserTest = (name, run) => test(name, {skip: !chromium && 'Set FEED_BROWSER_MODULE and FEED_BROWSER_EXECUTABLE for mounted main application tests'}, run);

async function readableText(locator) {
 return locator.evaluate(element=>{
  const channels=value=>value.match(/[\d.]+/g).map(Number);
  const luminance=rgb=>rgb.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  let background=[255,255,255];const ancestors=[];
  for(let node=element;node;node=node.parentElement)ancestors.unshift(node);
  for(const node of ancestors){const c=channels(getComputedStyle(node).backgroundColor),a=c[3]??1;background=c.slice(0,3).map((v,i)=>v*a+background[i]*(1-a));}
  const style=getComputedStyle(element),foreground=luminance(channels(style.color)),surface=luminance(background);
  return {contrast:(Math.max(foreground,surface)+.05)/(Math.min(foreground,surface)+.05),fontSize:parseFloat(style.fontSize)};
 });
}

async function designSnapshot(page,name,width) {
 await mkdir('output/playwright',{recursive:true});
 if(name.startsWith('settings'))await page.evaluate(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));
 const phase=process.env.APP_THEME_SNAPSHOT_PHASE==='before'?'before':'after';
 await page.screenshot({path:`output/playwright/app-theme-${name}-${phase}-${width}.png`,fullPage:true});
}

for(const width of [375,1440]) browserTest(`app settings: direct navigation and grouped controls preserve study and history at ${width}px`,()=>withApp(width,async page=>{
 const nav=page.locator(width===375?'.mobile-navigation':'.desktop-navigation');
 if(width===375)assert.deepEqual(await nav.getByRole('link').allTextContents(),['오늘','목표','기술 피드','공부 숲','설정']);
 await nav.getByRole('link',{name:'설정',exact:true}).click();
 const panel=page.locator('#settings');await panel.getByRole('heading',{name:'설정',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>location.hash),'#settings');
 for(const title of ['계정','공부·화면','알림','휴대폰','앱 정보'])assert.equal(await panel.getByRole('heading',{name:title,exact:true}).isVisible(),true);
 assert.equal(await panel.locator('.settings-notifications').getAttribute('open'),null);
 assert.equal(await panel.getByRole('combobox',{name:/시간대 검색·선택/}).count(),1);
 assert.doesNotMatch(await panel.locator('.app-device-settings').textContent(),/설치된 버전/);
 assert.equal(await panel.getByRole('link',{name:'Android 설치 안내',exact:true}).getAttribute('href'),'/download/android');
 await panel.getByRole('button',{name:'휴대폰 상태 다시 확인',exact:true}).click();
 assert.equal(await page.evaluate(()=>fixture.sessions[0].ended_at),null);
 assert.equal(await page.evaluate(()=>fixture.calls.some(c=>/start_study|pause_actual|confirm_actual/.test(c.name))),false);
 await designSnapshot(page,'settings',width);
 await readableGroup(panel.locator('h1,h2,h3,p,dt,dd,summary,button,a'));
 await touchControls(panel.locator('button,a,summary,input:not([type=checkbox])'));
 await touchControls(nav.locator('a'));
 const summary=panel.locator('.settings-notifications > summary');await summary.focus();await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle!=='none'),true);
 await panel.getByRole('link',{name:'내 페이지',exact:true}).click();
 await page.locator('#me').getByRole('heading',{name:'완료한 일 이력'}).waitFor();
 assert.equal(await page.locator('#me .profile-timezone').count(),0);
 await page.locator('a[href="#settings"]:visible').first().click();
 await page.locator('#settings').getByRole('button',{name:'화면 구성',exact:true}).click();
 await page.getByRole('button',{name:'순서 저장',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>location.hash),'#today');
 await page.locator('a[href="#settings"]:visible').first().click();
 await page.evaluate(()=>{
  const elements=[...document.querySelectorAll('h1,h2,h3,p,dt,dd,summary,button,a,input,label,small,span,strong')];
  const sizes=elements.map(el=>parseFloat(getComputedStyle(el).fontSize)*2);
  elements.forEach((el,i)=>el.style.fontSize=sizes[i]+'px');
 });
 await designSnapshot(page,'settings-enlarged',width);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
}));

for(const state of ['ready','failed','failure','legacy']) browserTest(`app settings: native ${state} uses real snapshot or fixed guidance`,()=>withApp(375,async page=>{
 await page.evaluate(state=>{
  window.nativeMessages=[];
  window.studyRoomNativeSettings=state!=='legacy';
  window.ReactNativeWebView={postMessage(raw){const m=JSON.parse(raw);window.nativeMessages.push(m);if(m.type==='STUDY_WEB_SETTINGS_INFO'&&['ready','failed'].includes(state))window.dispatchEvent(new CustomEvent('study-room-native-message',{detail:{type:'STUDY_NATIVE_SETTINGS_INFO',requestId:m.requestId,snapshot:{versionName:'0.2.2',versionCode:5,updaterStatus:state==='failed'?'failed':'downloading',permissions:{camera:'denied',notifications:'granted',focus:'unknown'}}}}));}};
 },state);
 await page.locator('.mobile-navigation a[href="#settings"]').click();
 const info=page.locator('.app-device-settings');await info.waitFor();
 if(['ready','failed'].includes(state)){
  await info.getByText('0.2.2 · 빌드 5',{exact:true}).waitFor();
  assert.match(await info.textContent(),state==='failed'?/업데이트 확인 실패/:/다운로드 중/);
  assert.match(await page.locator('.settings-phone').textContent(),/카메라.*미허용/s);
  await info.getByRole('button',{name:'앱 업데이트 열기',exact:true}).click();
  await page.getByRole('button',{name:'휴대폰 연결 설정 열기',exact:true}).click();
  await page.getByRole('button',{name:'앱 권한 설정 열기',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>nativeMessages.filter(m=>m.type==='STUDY_WEB_OPEN_SETTINGS').map(m=>m.target)),['update','focus','permissions']);
 }else{
  if(state==='failure')await page.clock.runFor(5001);
  await info.getByRole('link',{name:'Android 설치 안내',exact:true}).waitFor();
  assert.equal(await info.getByRole('button',{name:'앱 업데이트 열기',exact:true}).count(),0);
  assert.doesNotMatch(await info.textContent(),/설치된 버전/);
  assert.match(await info.textContent(),state==='failure'?/확인하지 못했어요/:/새 설정 기능/);
 }
 await designSnapshot(page,`settings-native-${state}`,375);
 assert.equal(await page.evaluate(()=>nativeMessages.some(m=>/CAMERA_PERMISSION_REQUEST|INSTALL|DOWNLOAD/.test(m.type))),false);
 if(state==='failure'){
  await page.evaluate(()=>{window.ReactNativeWebView.postMessage=raw=>{const m=JSON.parse(raw);if(m.type==='STUDY_WEB_SETTINGS_INFO')window.dispatchEvent(new CustomEvent('study-room-native-message',{detail:{type:'STUDY_NATIVE_SETTINGS_INFO',requestId:m.requestId,snapshot:{versionName:'0.2.2',versionCode:5,updaterStatus:'failed',permissions:{camera:'unknown',notifications:'unknown',focus:'unknown'}}}}));};});
  await info.getByRole('button',{name:'앱 정보 다시 확인',exact:true}).click();
  await info.getByText('0.2.2 · 빌드 5',{exact:true}).waitFor();
 }
}));

browserTest('app settings: login guidance has no account queries or invented native version',()=>withApp(375,async page=>{
 const before=await page.evaluate(()=>fixture.calls.length);
 await page.getByRole('button',{name:'앱 설정 안내',exact:true}).click();
 const guide=page.getByRole('dialog',{name:'앱 설정 안내'});await guide.waitFor();
 assert.equal(await guide.getByRole('link',{name:'Android 설치 안내',exact:true}).isVisible(),true);
 await designSnapshot(page,'settings-preauth',375);
 assert.doesNotMatch(await guide.textContent(),/설치된 버전|로그아웃|이메일|내 페이지/);
 assert.equal(await page.evaluate(()=>fixture.calls.length),before);
 await page.keyboard.press('Escape');await guide.waitFor({state:'detached'});
},'login'));

browserTest('app settings: timezone and alarm saves preserve authenticated transport and past study',()=>withApp(375,async page=>{
 await page.locator('.mobile-navigation a[href="#settings"]').click();
 const panel=page.locator('#settings');
 await panel.getByRole('combobox',{name:/시간대 검색·선택/}).fill('Asia/Seoul');
 await panel.getByRole('button',{name:'시간대 저장',exact:true}).click();
 await panel.getByText('시간대를 저장했어요. 앞으로의 일정과 알림에 적용됩니다.',{exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>fixture.calls.find(c=>c.name==='tech-feed'&&c.args.action==='timezone').args),{action:'timezone',time_zone:'Asia/Seoul'});
 await panel.locator('.settings-notifications > summary').click();
 await panel.getByRole('button',{name:'알람 편집',exact:true}).click();
 await panel.getByLabel('평일 알림 시간',{exact:true}).fill('21:15');
 await panel.getByRole('checkbox',{name:'이메일 보완 알림 사용'}).check();
 await panel.getByRole('button',{name:'알람 저장',exact:true}).click();
 await panel.getByRole('button',{name:'알람 편집',exact:true}).waitFor();
 const saved=await page.evaluate(()=>fixture.calls.filter(c=>c.name==='profiles.upsert').at(-1).args);
 assert.equal(saved.user_id,'owner');assert.equal(saved.reminder_time,'21:15');assert.equal(saved.email_reminders_enabled,true);
 assert.equal(await page.evaluate(()=>fixture.sessions[0].ended_at),null);
 assert.equal(await page.evaluate(()=>fixture.calls.some(c=>/start_study|pause_actual|confirm_actual/.test(c.name))),false);
 await readableGroup(panel.locator('.settings-notification-content p,.settings-notification-content span,.settings-notification-content label,.settings-notification-content strong'));
 await touchControls(panel.locator('.settings-notification-content button,.settings-notification-content input:not([type=checkbox])'));
}));

browserTest('app settings: layout preference save keeps study session then explicit logout uses existing auth',()=>withApp(375,async page=>{
 await page.locator('.mobile-navigation a[href="#settings"]').click();
 await page.getByRole('button',{name:'화면 구성',exact:true}).click();
 await page.getByRole('button',{name:'순서 저장',exact:true}).click();
 await page.locator('.section-order-editor').waitFor({state:'detached'});
 const preference=await page.evaluate(()=>fixture.calls.find(c=>c.name==='profiles.upsert'&&Array.isArray(c.args.today_section_order)).args);
 assert.ok(Array.isArray(preference.today_section_order));assert.equal(preference.user_id,'owner');
 assert.equal(await page.evaluate(()=>fixture.sessions[0].ended_at),null);
 await page.locator('.mobile-navigation a[href="#settings"]').click();
 await page.getByRole('button',{name:'로그아웃',exact:true}).click();
 await page.locator('.login-panel').waitFor();
 assert.equal(await page.evaluate(()=>fixture.calls.filter(c=>c.name==='auth.signOut').length),1);
}));

browserTest('app settings: pending native response cannot display previous account snapshot',()=>withApp(375,async page=>{
 await page.evaluate(()=>{window.nativeMessages=[];window.studyRoomNativeSettings=true;window.ReactNativeWebView={postMessage(raw){nativeMessages.push(JSON.parse(raw));}};});
 await page.locator('.mobile-navigation a[href="#settings"]').click();
 await page.waitForFunction(()=>nativeMessages.some(m=>m.type==='STUDY_WEB_SETTINGS_INFO'));
 const first=await page.evaluate(()=>nativeMessages.find(m=>m.type==='STUDY_WEB_SETTINGS_INFO').requestId);
 await page.evaluate(()=>fixture.changeOwner());
 await page.waitForFunction(()=>nativeMessages.filter(m=>m.type==='STUDY_WEB_SETTINGS_INFO').length>=2);
 await page.evaluate(requestId=>window.dispatchEvent(new CustomEvent('study-room-native-message',{detail:{type:'STUDY_NATIVE_SETTINGS_INFO',requestId,snapshot:{versionName:'stale-old-account',versionCode:5,updaterStatus:'ready',permissions:{camera:'granted',notifications:'granted',focus:'granted'}}}})),first);
 await page.clock.runFor(5001);
 assert.doesNotMatch(await page.locator('.app-device-settings').textContent(),/stale-old-account|설치된 버전/);
}));

browserTest('app settings: phone recheck shows pending and failure without claiming a local permission change',()=>withApp(375,async page=>{
 await page.locator('.mobile-navigation a[href="#settings"]').click();
 await page.evaluate(()=>fixture.holdFocus=true);
 await page.getByRole('button',{name:'휴대폰 상태 다시 확인',exact:true}).click();
 const checking=page.getByRole('button',{name:'휴대폰 상태 확인 중',exact:true});await checking.waitFor();
 assert.equal(await checking.isDisabled(),true);
 await page.evaluate(()=>{fixture.holdFocus=false;fixture.releaseFocus();});
 await page.locator('.settings-phone').getByText('휴대폰 적용 상태를 확인하지 못했습니다.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'휴대폰 상태 다시 확인',exact:true}).isEnabled(),true);
 assert.equal(await page.evaluate(()=>fixture.sessions[0].ended_at),null);
}));

browserTest('app settings: failed updater opening has an inline actionable error',()=>withApp(375,async page=>{
 await page.evaluate(()=>{window.studyRoomNativeSettings=true;window.ReactNativeWebView={postMessage(raw){const m=JSON.parse(raw);if(m.type==='STUDY_WEB_SETTINGS_INFO')window.dispatchEvent(new CustomEvent('study-room-native-message',{detail:{type:'STUDY_NATIVE_SETTINGS_INFO',requestId:m.requestId,snapshot:{versionName:'0.2.2',versionCode:5,updaterStatus:'failed',permissions:{camera:'unknown',notifications:'unknown',focus:'unknown'}}}}));else throw new Error('test transport failure');}};});
 await page.locator('.mobile-navigation a[href="#settings"]').click();
 const info=page.locator('.app-device-settings');
 await info.getByRole('button',{name:'앱 업데이트 열기',exact:true}).click();
 await info.getByRole('alert').waitFor();
 assert.match(await info.getByRole('alert').textContent(),/앱을 다시 열고/);
}));

for(const width of [375,1440]) {
 browserTest(`app theme: recovery dialog is readable, contained and keyboard accessible at ${width}px`,()=>withApp(width,async page=>{
  await page.getByRole('dialog',{name:'회복 루틴 작성'}).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog',{name:'회복 루틴 작성'}).waitFor({state:'detached'});
  await page.getByRole('button',{name:'회복 루틴 작성',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'회복 루틴 작성'});await dialog.waitFor();
  await designSnapshot(page,'recovery',width);
  const heading=await dialog.getByRole('heading').boundingBox(),close=await dialog.getByRole('button',{name:'회복 루틴 모달 닫기'}).boundingBox();
  const copy=await readableText(dialog.locator('.reminder-copy'));
  assert.ok(copy.contrast>=4.5 && copy.fontSize>=15 && copy.fontSize<=18,JSON.stringify(copy));
  assert.ok(close.y<heading.y+heading.height && close.width>=44 && close.height>=44,'close stays beside heading');
  assert.equal(await dialog.evaluate(el=>getComputedStyle(el).borderTopWidth),'1px');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await dialog.getByRole('textbox',{name:'결석/이탈 사유'}).fill('디자인 검증용 입력');
  await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>fixture.calls.some(c=>c.name==='submit_study_recovery')),false);
 },'recovery'));

 browserTest(`app theme: camera diagnosis keeps AA contrast for normal and idle status at ${width}px`,()=>withApp(width,async page=>{
  const tools=page.locator('.focus-tools');await tools.locator('summary').first().click();
  for(const state of ['idle','normal']){
   if(state==='normal'){
    await tools.getByRole('button',{name:'카메라 감시 켜기',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('video')?.srcObject?.getVideoTracks()[0]?.readyState==='live');
    await page.clock.runFor(1000);
   }
   await designSnapshot(page,`camera-${state}`,width);
   const texts=tools.locator('.camera-diagnostic').locator('span,strong,p,li');
   for(let i=0;i<await texts.count();i++){
    const metric=await readableText(texts.nth(i));
    assert.ok(metric.contrast>=4.5,`${state}: ${await texts.nth(i).textContent()} contrast ${metric.contrast}`);
    assert.ok(metric.fontSize>=14,`${state}: font ${metric.fontSize}`);
   }
  }
 }));

 browserTest(`app theme: all pages share surfaces, readable hierarchy and no direction pad at ${width}px`,()=>withApp(width,async page=>{
  const metrics=[];
  for(const [route,selector] of [['goals','.goals-panel'],['forest','.study-forest-panel'],['feed','.tech-feed'],['me','.my-page-panel'],['settings','.settings-panel']]){
   if(width===375 && route==='me'){
    await page.locator('.mobile-navigation a[href="#settings"]').click();
    await page.locator('#settings a[href="#me"]').click();
   }else await page.locator(`a[href="#${route}"]:visible`).first().click();
   await page.waitForTimeout(50);await page.clock.runFor(500);
   const panel=page.locator(selector);await panel.waitFor();
   await designSnapshot(page,route,width);
   metrics.push(await panel.evaluate(el=>({route:location.hash,border:getComputedStyle(el).borderTopWidth,background:getComputedStyle(el).backgroundColor,radius:getComputedStyle(el).borderTopLeftRadius,overflow:document.documentElement.scrollWidth>innerWidth})));
   if(route==='forest'){
    assert.equal(await page.getByRole('button',{name:'위로 이동',exact:true}).count(),0);
    await panel.focus();await page.keyboard.press('ArrowRight');
    assert.equal(await panel.getAttribute('tabindex'),'0');
    assert.match(await panel.locator('.forest-movement-hint').textContent(),/터치.*키보드/);
    await panel.locator('.forest-growth-details > summary').click();
    const roadmap=panel.getByRole('list',{name:'나무 성장 단계'});
    assert.equal(await roadmap.isVisible(),true);
    for(const label of await roadmap.locator('small').all())assert.ok((await readableText(label)).contrast>=4.5);
   }
  }
  await page.locator('a[href="#today"]:visible').first().click();
  for(const [domain,label] of [['plan','계획'],['record','기록']]){
   await page.getByRole('button',{name:label,exact:true}).click();await page.clock.runFor(32);
   await designSnapshot(page,domain,width);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,domain);
   if(domain==='plan'){
    const button=page.locator('.todo-edit').first(),icon=button.locator('svg');
    const control=await button.boundingBox(),glyph=await icon.boundingBox();
    assert.ok(control.width>=44&&control.height>=44&&glyph.width>=16&&glyph.height>=16,'todo edit icon retains its 44px target and visible glyph');
   }
  }
  for(const metric of metrics){
   assert.equal(metric.border,'1px',metric.route);
   assert.equal(metric.background,'rgb(255, 253, 245)',metric.route);
   assert.equal(metric.radius,'16px',metric.route);
   assert.equal(metric.overflow,false,metric.route);
  }
 }));

 browserTest(`app theme: disabled session selection is distinct and readable at ${width}px`,()=>withApp(width,async page=>{
  await page.locator('.topbar-actions button').first().click();
  await page.getByRole('button',{name:'카메라 켜고 시작',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'이번 세션에서 할 일'});
  await dialog.waitFor();
  const start=dialog.getByRole('button',{name:'선택한 할 일로 시작'});
  const choices=dialog.locator('.session-todo-choice-list input[type=checkbox]');
  await choices.first().waitFor();
  for(const choice of await choices.all())await choice.uncheck();
  assert.equal(await start.isDisabled(),true);
  await page.clock.runFor(200);
  const disabled=await start.evaluate(el=>getComputedStyle(el).backgroundColor);
  const metric=await readableText(start);
  assert.ok(metric.contrast>=4.5,JSON.stringify({disabled,...metric}));
  await choices.first().check();assert.equal(await start.isEnabled(),true);
  await page.clock.runFor(200);
  const enabled=await start.evaluate(el=>getComputedStyle(el).backgroundColor);
  assert.notEqual(disabled,enabled,'inactive action differs without relying on hover or cursor');
  const input=dialog.locator('.session-todo-title-field input');
  const editable=await input.evaluate(el=>getComputedStyle(el).backgroundColor);
  await input.evaluate(el=>{el.disabled=true;});
  assert.notEqual(await input.evaluate(el=>getComputedStyle(el).backgroundColor),editable,'disabled input preserves the common muted surface');
  assert.ok((await readableText(input)).contrast>=4.5);
 },'start'));
}

for (const width of [375, 1440]) browserTest(`dashboard redesign: shared focus hierarchy and navigation at ${width}px`, () => withApp(width, async page => {
 await page.getByRole('heading',{name:'집중 독서',exact:true}).waitFor();
 await mkdir('output/playwright',{recursive:true});
 const phase=process.env.DASHBOARD_SNAPSHOT_PHASE==='before'?'before':'after';
 await page.screenshot({path:`output/playwright/dashboard-${phase}-${width}.png`,fullPage:true});
 const card=page.getByRole('region',{name:'집중 공부'});
 assert.equal(await card.getByRole('heading',{name:'집중 독서',exact:true}).count(),1);
 const timer=card.getByRole('timer',{name:'이번 세션 공부시간'});
 assert.match(await timer.textContent(),/^\d{2}:\d{2}:\d{2}$/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const timerBox=await timer.boundingBox();assert.ok(timerBox.y<700,'timer is on the first screen');
 assert.equal(await page.locator('.focus-tools').getAttribute('open'),null);
 if(width===375){
  await page.locator('.mobile-navigation a[href="#settings"]').click();
  assert.equal(await page.locator('#settings').getByRole('link',{name:'내 페이지',exact:true}).isVisible(),true);
  assert.equal(await page.locator('#settings').getByRole('button',{name:'화면 구성',exact:true}).isVisible(),true);
  await page.locator('.mobile-navigation a[href="#today"]').click();
 }
 await page.getByRole('button',{name:'잠시 쉬기',exact:true}).click();
 await page.getByRole('button',{name:'공부 계속하기',exact:true}).waitFor();
 const frozen=await timer.textContent();await page.clock.fastForward(5000);assert.equal(await timer.textContent(),frozen);
 await page.getByRole('button',{name:'계획',exact:true}).click();
 assert.equal(await page.getByRole('region',{name:'오늘 할 일',exact:true}).isVisible(),true);
 await page.getByRole('button',{name:'기록',exact:true}).click();
 assert.equal(await page.getByText('9월 누적',{exact:true}).isVisible(),true);
}));

browserTest('dashboard redesign: idle hides end and preserves preparation flow',()=>withApp(375,async page=>{
 assert.equal(await page.locator('.topbar-actions').getByRole('button',{name:'종료',exact:true}).count(),0);
 assert.equal(await page.getByRole('timer',{name:'이번 세션 공부시간'}).textContent(),'00:00:00');
},'start'));

browserTest('dashboard redesign: connection error is visible while controls remain collapsed',()=>withApp(375,async page=>{
 await page.evaluate(()=>fixture.focusError=true);await page.clock.fastForward(15001);
 const warning=page.locator('.focus-status-warning');await warning.getByText(/휴대폰 연결 테스트 오류/).waitFor();
 assert.equal(await warning.isVisible(),true);
 assert.equal(await warning.evaluate(el=>Boolean(el.closest('details'))),false);
 assert.equal(await page.locator('.focus-tools').getAttribute('open'),null);
 await page.locator('.focus-tools > summary').click();
 assert.equal(await page.getByRole('button',{name:'카메라 감시 켜기',exact:true}).isVisible(),true);
}));

browserTest('dashboard redesign: expiring lease is visible without opening settings',()=>withApp(375,async page=>{
 const warning=page.locator('.focus-status-warning');await warning.getByText(/세션 유지 시간이/).waitFor();
 assert.equal(await warning.isVisible(),true);
 assert.equal(await warning.getByRole('button',{name:'+1시간 연장',exact:true}).isVisible(),true);
 assert.equal(await page.locator('.focus-tools').getAttribute('open'),null);
},'lease'));

browserTest('dashboard redesign: one timer and one camera diagnostic remain reachable in settings',()=>withApp(375,async page=>{
 assert.equal(await page.getByRole('timer',{name:'이번 세션 공부시간'}).count(),1);
 const tools=page.locator('.focus-tools');await tools.locator('summary').first().click();
 assert.equal(await tools.locator('video').count(),1);
 assert.equal(await tools.getByRole('timer').count(),0);
 assert.equal(await tools.locator('.camera-monitor').count(),1);
 assert.equal(await tools.locator('.camera-diagnostic strong').isVisible(),true);
 assert.ok(await tools.locator('.camera-diagnostic li').count()>0,'diagnostic provides actionable checks');
 assert.equal(await tools.getByRole('button',{name:'카메라 감시 켜기',exact:true}).isVisible(),true);
}));

for(const width of [375,1440])browserTest(`dashboard redesign: recovery warning stays visible and compact at ${width}px`,()=>withApp(width,async page=>{
 const warning=page.locator('.recovery-blocker').filter({hasText:'회복 루틴 필요'});
 await warning.waitFor();
 const dialog=page.getByRole('dialog');if(await dialog.count())await page.keyboard.press('Escape');
 assert.equal(await warning.isVisible(),true);
 assert.equal(await warning.evaluate(el=>Boolean(el.closest('details'))),false);
 assert.equal(await warning.getByRole('button',{name:'회복 루틴 작성',exact:true}).isVisible(),true);
 assert.match(await warning.textContent(),/출석 실패/);
 const box=await warning.boundingBox();assert.ok(box.height<=220,`recovery card height ${box.height}`);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await warning.getByRole('button',{name:'회복 루틴 작성',exact:true}).click();
 assert.equal(await page.getByRole('dialog').isVisible(),true);
 assert.equal(await page.evaluate(()=>fixture.sessions.length),0);
},'recovery'));

browserTest('dashboard redesign: collapsing camera settings preserves the live track and video node',()=>withApp(375,async page=>{
 const tools=page.locator('.focus-tools');await tools.locator('summary').first().click();
 await tools.getByRole('button',{name:'카메라 감시 켜기',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('video')?.srcObject?.getVideoTracks()[0]?.readyState==='live');
 await page.evaluate(()=>{window.cameraTestNode=document.querySelector('video');window.cameraTestTrack=window.cameraTestNode.srcObject.getVideoTracks()[0];});
 await tools.locator('summary').first().click();await page.clock.runFor(1000);
 assert.equal(await page.evaluate(()=>document.querySelector('video')===window.cameraTestNode&&document.querySelector('video').srcObject.getVideoTracks()[0]===window.cameraTestTrack&&window.cameraTestTrack.readyState==='live'),true);
 await tools.locator('summary').first().click();await tools.getByRole('button',{name:'카메라 감시 끄기',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.cameraTestTrack.readyState),'ended');
}));

browserTest('camera return: ended track is replaced on foreground without restarting study',()=>withApp(390,async page=>{
 const tools=page.locator('.focus-tools');await tools.locator('summary').first().click();
 await tools.getByRole('button',{name:'카메라 감시 켜기',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('video')?.srcObject?.getVideoTracks()[0]?.readyState==='live');
 await page.evaluate(()=>{
  window.oldCameraTrack=document.querySelector('video').srcObject.getVideoTracks()[0];
  window.oldCameraTrack.stop();
  document.dispatchEvent(new Event('visibilitychange'));
 });
 await page.waitForFunction(()=>{const track=document.querySelector('video')?.srcObject?.getVideoTracks()[0];return track&&track!==window.oldCameraTrack&&track.readyState==='live';});
 await page.clock.runFor(5000);
 assert.equal(await page.evaluate(()=>fixture.sessions[0].id),'session');
 assert.equal(await page.evaluate(()=>fixture.calls.some(c=>['start_study_session','confirm_actual_study_action','pause_actual_study_session'].includes(c.name))),false);
 assert.equal(await page.evaluate(()=>fixture.excluded),60);
}));

browserTest('camera return: revoked permission never prompts or repeatedly acquires video',()=>withApp(390,async page=>{
 const tools=page.locator('.focus-tools');await tools.locator('summary').first().click();
 await tools.getByRole('button',{name:'카메라 감시 켜기',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('video')?.srcObject);
 await page.evaluate(()=>{
  window.autoCameraRequests=0;const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia=(options)=>{window.autoCameraRequests++;return original(options);};
  navigator.permissions.query=async()=>({state:'denied'});
  document.querySelector('video').srcObject.getTracks().forEach(t=>t.stop());
  document.dispatchEvent(new Event('visibilitychange'));
 });
 await tools.getByRole('button',{name:'카메라 감시 켜기',exact:true}).waitFor();
 await page.clock.runFor(30000);
 assert.equal(await page.evaluate(()=>window.autoCameraRequests),0);
 assert.match(await tools.textContent(),/권한/);
}));

for(const change of ['pause','ended','owner','manual-off','lease'])browserTest('camera return: '+change+' prevents late or automatic camera startup',()=>withApp(390,async page=>{
 const tools=page.locator('.focus-tools');await tools.locator('summary').first().click();
 await tools.getByRole('button',{name:'카메라 감시 켜기',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('video')?.srcObject);
 await page.clock.pauseAt(await page.evaluate(()=>new Date(Date.now()+5000)));
 await page.evaluate(()=>{
  window.autoCameraRequests=0;const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia=(options)=>{window.autoCameraRequests++;return original(options);};
  document.querySelector('video').srcObject.getTracks().forEach(t=>t.stop());
 });
 if(change==='manual-off')await tools.getByRole('button',{name:'카메라 감시 끄기',exact:true}).click();
 else if(change==='owner')await page.evaluate(()=>fixture.changeOwner());
 else if(change==='lease')await page.clock.fastForward(10*60*60*1000);
 else await page.evaluate(change=>{if(change==='pause')fixture.sessions[0].paused_at=new Date().toISOString();else fixture.sessions[0].ended_at=new Date().toISOString();},change);
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await page.clock.runFor(16000);
 assert.equal(await page.evaluate(()=>window.autoCameraRequests),0,change);
 assert.equal(await page.evaluate(()=>document.querySelector('video')?.srcObject?.getVideoTracks().some(t=>t.readyState==='live')??false),false);
}));

browserTest('camera return: unhealthy replacement does not reset the single automatic attempt',()=>withApp(390,async page=>{
 const tools=page.locator('.focus-tools');await tools.locator('summary').first().click();
 await tools.getByRole('button',{name:'카메라 감시 켜기',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('video')?.srcObject);
 await page.evaluate(()=>{
  window.autoCameraRequests=0;const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia=async options=>{window.autoCameraRequests++;const stream=await original(options);stream.getTracks().forEach(t=>t.stop());return stream;};
  document.querySelector('video').srcObject.getTracks().forEach(t=>t.stop());document.dispatchEvent(new Event('visibilitychange'));
 });
 await page.waitForFunction(()=>window.autoCameraRequests===1);
 await page.clock.runFor(30000);
 assert.equal(await page.evaluate(()=>window.autoCameraRequests),1);
 assert.equal(await tools.getByRole('button',{name:'카메라 감시 켜기',exact:true}).isVisible(),true);
}));

for(const action of ['manual-off','pause','owner','background','unmount'])browserTest('camera return: late media after '+action+' is stopped',()=>withApp(390,async page=>{
 const tools=page.locator('.focus-tools');await tools.locator('summary').first().click();
 await tools.getByRole('button',{name:'카메라 감시 켜기',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('video')?.srcObject);
 await page.evaluate(()=>{
  const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{window.releaseCamera=async()=>{window.lateCameraStream=await original({video:true,audio:false});resolve(window.lateCameraStream);};});
  document.querySelector('video').srcObject.getTracks().forEach(t=>t.stop());document.dispatchEvent(new Event('visibilitychange'));
 });
 await page.waitForFunction(()=>!!window.releaseCamera);
 if(action==='manual-off')await tools.getByRole('button',{name:'카메라 감시 끄기',exact:true}).click();
 if(action==='pause')await page.getByRole('button',{name:'잠시 쉬기',exact:true}).click();
 if(action==='owner')await page.evaluate(()=>fixture.changeOwner());
 if(action==='unmount')await page.evaluate(()=>window.fixtureRoot.unmount());
 if(action==='background')await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
 await page.evaluate(()=>window.releaseCamera());
 await page.waitForFunction(()=>window.lateCameraStream.getTracks().every(t=>t.readyState==='ended'));
 if(action==='background')await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});
 assert.equal(await page.evaluate(()=>document.querySelector('video')?.srcObject?.getTracks().some(t=>t.readyState==='live')??false),false);
}));

browserTest('camera return: old cancelled recovery cannot stop a newer manual camera',()=>withApp(390,async page=>{
 const tools=page.locator('.focus-tools');await tools.locator('summary').first().click();
 await tools.getByRole('button',{name:'카메라 감시 켜기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('video')?.srcObject);
 await page.evaluate(()=>{
  const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);window.pendingMedia=[];
  navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>window.pendingMedia.push(async()=>{const stream=await original({video:true,audio:false});resolve(stream);return stream;}));
  document.querySelector('video').srcObject.getTracks().forEach(t=>t.stop());document.dispatchEvent(new Event('visibilitychange'));
 });
 await page.waitForFunction(()=>window.pendingMedia.length===1);
 await tools.getByRole('button',{name:'카메라 감시 끄기',exact:true}).click();
 await tools.getByRole('button',{name:'카메라 감시 켜기',exact:true}).click();await page.waitForFunction(()=>window.pendingMedia.length===2);
 await page.evaluate(async()=>{window.newManualStream=await window.pendingMedia[1]();});
 await page.waitForFunction(()=>document.querySelector('video')?.srcObject===window.newManualStream);
 await page.evaluate(async()=>{window.oldCancelledStream=await window.pendingMedia[0]();});
 await page.waitForFunction(()=>window.oldCancelledStream.getTracks().every(t=>t.readyState==='ended'));
 assert.equal(await page.evaluate(()=>window.newManualStream.getVideoTracks()[0].readyState),'live');
 assert.equal(await tools.getByRole('button',{name:'카메라 감시 끄기',exact:true}).isVisible(),true);
}));

for(const change of ['pause','ended'])browserTest('camera return: server '+change+' during media acquisition discards the late stream',()=>withApp(390,async page=>{
 const tools=page.locator('.focus-tools');await tools.locator('summary').first().click();
 await tools.getByRole('button',{name:'카메라 감시 켜기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('video')?.srcObject);
 await page.evaluate(()=>{
  const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{window.releaseCamera=async()=>{window.lateCameraStream=await original({video:true,audio:false});resolve(window.lateCameraStream);};});
  document.querySelector('video').srcObject.getTracks().forEach(t=>t.stop());document.dispatchEvent(new Event('visibilitychange'));
 });
 await page.waitForFunction(()=>!!window.releaseCamera);
 await page.evaluate(change=>{fixture.sessions[0]={...fixture.sessions[0],...(change==='pause'?{paused_at:new Date().toISOString()}:{status:'completed',ended_at:new Date().toISOString()})};},change);
 await page.evaluate(()=>window.releaseCamera());
 await page.waitForFunction(()=>window.lateCameraStream.getTracks().every(t=>t.readyState==='ended'));
}));

browserTest('camera return: observed remote pause closes an already live camera',()=>withApp(390,async page=>{
 const tools=page.locator('.focus-tools');await tools.locator('summary').first().click();
 await tools.getByRole('button',{name:'카메라 감시 켜기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('video')?.srcObject);
 await page.evaluate(()=>{window.remotePausedTrack=document.querySelector('video').srcObject.getVideoTracks()[0];fixture.sessions[0]={...fixture.sessions[0],paused_at:new Date().toISOString()};window.dispatchEvent(new Event('focus'));});
 await page.waitForFunction(()=>window.remotePausedTrack.readyState==='ended');
 assert.equal(await page.getByRole('button',{name:'공부 계속하기',exact:true}).isVisible(),true);
}));

const backend = `
const now='2026-09-21T14:30:00Z';
const todo=(id,title,date='2026-09-21')=>({id,user_id:'owner',title,local_date:date,start_time:'23:00:00',end_time:'01:00:00',is_completed:false,position:0,goal_id:'goal',repeat_group_id:'repeat',repeat_mode:'weekly',repeat_weekdays:[1],repeat_until:null,repeat_forever:true,created_at:now,original_start_at:'2026-09-21T14:00:00Z',original_end_at:'2026-09-21T16:00:00Z',target_seconds:7200,first_started_at:'2026-09-21T14:00:00Z',first_tracked_at:'2026-09-21T14:00:00Z',known_seconds:1800,open_started_at:'2026-09-21T14:00:00Z',remaining_seconds:5400,adjustment_count:1,evaluation_eligible:true,unknown_allocation:false});
const row={id:'session',user_id:'owner',local_date:'2026-09-21',started_at:'2026-09-21T14:00:00Z',ended_at:null,duration_seconds:0,status:'active',lease_expires_at:'2026-09-22T00:00:00Z',lease_warning_sent_at:null,paused_at:null,paused_seconds:0};
const state=window.fixture={calls:[],todos:[todo('a','집중 독서'),todo('b','다음 날 알고리즘','2026-09-22')],sessions:[row],collision:true,stale:false,failConfirm:false,blocking:null,reportFail:false,excluded:60,current:'a'};
state.links=['a','b'];
const mode=new URLSearchParams(location.search).get('mode');
if(['empty-links','completed-links','active-empty'].includes(mode)){state.links=mode==='completed-links'?['a']:[];state.current=null;state.sessions[0].paused_at=mode==='active-empty'?null:now;state.todos[0].is_completed=mode==='completed-links';state.todos[1].local_date='2026-09-21';state.todos.forEach(t=>{t.first_started_at=null;t.unknown_allocation=true;t.evaluation_eligible=false;});}
if(mode==='start'||mode==='recovery'){state.sessions=[];state.todos.forEach(t=>t.local_date='2026-09-21');}
state.recoveries=mode==='recovery'?[{id:'recovery',local_date:'2026-09-20',covered_start_date:'2026-09-20',covered_end_date:'2026-09-20',covered_missed_days:1,trigger_type:'missed_attendance',status:'pending',reason:null,makeup_todo_title:null,pledge_todo_title:null,created_at:now}]:[];
if(mode==='lease')state.sessions[0].lease_expires_at='2026-09-21T14:34:00Z';
if(mode==='unknown'){state.current=null;state.sessions[0].paused_at=now;state.todos.forEach(t=>{t.first_started_at=null;t.unknown_allocation=true;t.evaluation_eligible=false;});}
if(mode==='precheck'){state.sessions=[];state.recoveries=Array.from({length:5},(_,i)=>({id:'submitted-'+i,local_date:'2026-09-21',trigger_type:'missed_attendance',status:'submitted',reason:'일정 조정',makeup_todo_title:'보충 독서',pledge_todo_title:'다시 시작',created_at:now}));}
const authSession=mode==='login'?null:{access_token:'test-only',user:{id:'owner',email:'fixture@example.test',user_metadata:{}}};
state.profile={user_id:'owner',time_zone:'Asia/Tokyo',reminder_time:'09:00',email_reminders_enabled:false};
const track=()=>({session_id:'session',current_todo_id:state.current,tracking_started_at:row.started_at,excluded_seconds:state.excluded,unknown_allocation:false,server_now:now,todos:state.todos.filter(t=>state.links.includes(t.id)).map(t=>({...t,open_started_at:state.sessions[0]?.paused_at||t.id!==state.current?null:row.started_at}))});
function result(name,args){state.calls.push({name,args});
 if(name==='get_study_focus_snapshot'&&state.holdFocus)return new Promise(resolve=>{state.releaseFocus=()=>resolve({data:null,error:{message:'test focus failure'}});});
 if(name==='get_study_focus_snapshot')return {data:state.focusError?{device_connected:true,opted_in:true,permission_granted:true,last_error:'휴대폰 연결 테스트 오류'}:null,error:null};
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
function query(table){let single=false,insert=null;const q=new Proxy({}, {get(_,key){if(key==='then')return (resolve,reject)=>Promise.resolve().then(()=>{if(insert && table==='study_todos'){const added={...todo('new',''),...insert[0],id:'new'};state.todos.push(added);return {data:added,error:null};}let data=table==='profiles'?state.profile:table==='study_goals'?[{id:'goal',title:'자격증 목표',target_date:'2026-12-31',target_study_seconds:0,status:'active',created_at:now,updated_at:now}]:table==='study_sessions'?state.sessions:table==='study_todos'?state.todos:table==='study_recovery_requests'?state.recoveries:table==='study_session_todos'?state.todos.filter(t=>state.links.includes(t.id)).map(t=>({id:t.id,session_id:'session',todo_id:t.id,user_id:'owner',linked_at:now,completed_during_session:false})):[];return {data:single?(Array.isArray(data)?data[0]??null:data):data,error:null};}).then(resolve,reject);return (...args)=>{if(key==='maybeSingle'||key==='single')single=true;if(key==='insert')insert=args[0];if(key==='upsert'){state.calls.push({name:table+'.upsert',args:args[0]});if(table==='profiles')state.profile={...state.profile,...args[0]};}return q;};}});return q;}
export const isSupabaseConfigured=true,supabaseUrl='https://fixture.invalid',supabaseAnonKey='test';
const feedArticles=Array.from({length:4},(_,index)=>({id:'article-'+index,title:['실무에서 살펴보는 백엔드 아키텍처','클라우드 운영과 관측 가능성','AI 개발 도구를 안전하게 활용하는 방법','새로운 웹 기술을 작은 프로젝트로 익히기'][index],excerpt:'공개 기술 블로그의 소개를 바탕으로 구현 과정과 실제 적용 시 고려할 점을 살펴봅니다. 원문에서 구체적인 예제와 설계의 근거를 확인할 수 있어요.',url:'https://example.test/article/'+index,published_at:now,discovered_at:now,summary:null,summary_status:'pending',category:'practice',interests:['backend'],topics:['백엔드'],sources:[{id:'source',name:'기술 블로그'}],saved:false,todo_id:null,origin:'rss',matched_topics:[],excerpt_provenance:'source_excerpt'}));
const feedResponse=action=>action==='state'?{enabled:true,service_available:true,sources:[],interests:[],last_success_at:now,preferences:{prompt:'AI와 백엔드 기술',receiving:true,revision:1},search_status:{state:'ready',last_success_at:now}}:action==='list'?{items:feedArticles,next_cursor:null,total:4}:action==='facets'?{total:4,topics:[],sources:[],languages:[{value:'ko',label:'한국어 원문',count:4}]}:action==='briefing'?{local_date:'2026-09-21',time_zone:'Asia/Tokyo',total:4,source_count:1,categories:[],topics:[{value:'backend',label:'백엔드',count:4}],eligible_count:4,analyzed_count:0,generated_at:null,status:'idle',stale:false,insights:[],highlights:[]}:{};
let authCallback;
export const supabase={
 from:query,
 rpc(name,args){const q={then(resolve,reject){return Promise.resolve().then(()=>result(name,args)).then(resolve,reject);},abortSignal(){return q;}};return q;},
 auth:{
  getSession:async()=>({data:{session:authSession},error:null}),
  signOut:async()=>{state.calls.push({name:'auth.signOut'});authCallback('SIGNED_OUT',null);return {error:null};},
  onAuthStateChange:callback=>{authCallback=callback;state.changeOwner=()=>{state.sessions=[];state.todos=[];state.reportFail=true;callback('SIGNED_IN',{...authSession,user:{...authSession.user,id:'other'}});};return {data:{subscription:{unsubscribe(){}}}};},
  getUser:async()=>({data:{user:authSession?.user??null},error:null})
 },
 functions:{invoke:async(name,{body}={})=>{state.calls.push({name,args:body});if(name==='tech-feed'&&body.action==='timezone')state.profile.time_zone=body.time_zone;return {data:name==='tech-feed'?feedResponse(body.action):{},error:null};}}
};
`;

async function withApp(width, run, mode='active') {
  const built=await build({entryPoints:[fileURLToPath(new URL('../src/main.tsx',import.meta.url))],bundle:true,write:false,outdir:'fixture',platform:'browser',format:'iife',jsx:'automatic',logLevel:'silent',define:{'import.meta.env':'{}'},plugins:[{name:'local-boundaries',setup(b){b.onResolve({filter:/^\.\/supabase$/},()=>({path:'backend',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:backend,loader:'js'}));b.onLoad({filter:/bodyPresenceDetection\.mjs$/},()=>({contents:'export async function createUpperBodyPresenceDetector(){return {detect:()=>true,close(){}}}',loader:'js'}));b.onLoad({filter:/[\\/]src[\\/]main\.tsx$/},async({path})=>({contents:(await readFile(path,'utf8')).replace('createRoot(document.getElementById("root")!).render','(window.fixtureRoot = createRoot(document.getElementById("root")!)).render'),loader:'tsx'}));}}]});
  const js=built.outputFiles.find(f=>f.path.endsWith('.js')).text, css=built.outputFiles.find(f=>f.path.endsWith('.css'))?.text||'';
  const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':req.url==='/app.css'?'text/css':'text/html');res.end(req.url==='/app.js'?js:req.url==='/app.css'?css:'<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try {browser=await chromium.launch({headless:true,executablePath:process.env.FEED_BROWSER_EXECUTABLE||undefined,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});const page=await browser.newPage({viewport:{width,height:960}});page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-09-21T14:30:00Z')});await page.goto('http://127.0.0.1:'+server.address().port+'?mode='+mode,{timeout:15000});await page.locator(mode==='login'?'.login-panel':'.topbar-actions button:not([disabled])').first().waitFor();if(mode==='active'||mode==='active-empty'){await page.getByRole('dialog',{name:'카메라 인증 필요'}).waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});}await run(page);assert.deepEqual(errors,[]);}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
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

for (const width of [375, 1440]) browserTest(`mounted actual study panel: secondary text stays readable at ${width}px`, () => withApp(width, async page => {
 const panel=page.locator('.session-todo-panel.actual-study-panel');
 await panel.getByRole('heading',{name:'집중 독서',exact:true}).waitFor();
 await mkdir('output/playwright',{recursive:true});
 await panel.screenshot({path:`output/playwright/actual-study-readability-after-${width}.png`});
 const metrics=await panel.evaluate(root=>{
  const rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number);
  const luminance=value=>rgb(value).map(channel=>{const v=channel/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;}).reduce((sum,v,index)=>sum+v*[0.2126,0.7152,0.0722][index],0);
  const background=luminance(getComputedStyle(root).backgroundColor);
  return ['.actual-start','.actual-progress span','.actual-schedule dt','.actual-schedule dd','.actual-state','.actual-next summary','.todo-meta-chip','.todo-goal-chip'].map(selector=>{
   const element=root.querySelector(selector),style=getComputedStyle(element),foreground=luminance(style.color);
   const channels=style.backgroundColor.match(/[\d.]+/g).map(Number),surface=channels.length===4&&channels[3]===0?background:luminance(style.backgroundColor);
   return {selector,fontSize:parseFloat(style.fontSize),contrast:(Math.max(foreground,surface)+0.05)/(Math.min(foreground,surface)+0.05)};
  });
 });
 for(const metric of metrics){
  assert.ok(metric.fontSize>=(metric.selector.includes('chip')?14:15),`${metric.selector} font ${metric.fontSize}px at ${width}px`);
  assert.ok(metric.contrast>=7,`${metric.selector} contrast ${metric.contrast.toFixed(2)} at ${width}px`);
 }
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
}));

browserTest('mounted actual study panel: mobile schedule uses the full card width', () => withApp(375, async page => {
 const panel=page.locator('.session-todo-panel.actual-study-panel');
 await panel.getByRole('heading',{name:'집중 독서',exact:true}).waitFor();
 const panelBox=await panel.boundingBox();
 const labelBox=await panel.locator('.actual-schedule dt').first().boundingBox();
 const valueBox=await panel.locator('.actual-schedule dd').first().boundingBox();
 assert.ok(panelBox && labelBox && valueBox);
 assert.ok(valueBox.width>=panelBox.width-50,`schedule value width ${valueBox.width}px within ${panelBox.width}px panel`);
 assert.ok(valueBox.y>=labelBox.y+labelBox.height,'schedule time appears below its label');
}));

async function readableGroup(locator) {
 assert.ok(await locator.count()>0,'visible text is present');
 for(const text of await locator.all()) {
  if(!await text.isVisible())continue;
  const metric=await readableText(text);
  assert.ok(metric.contrast>=4.5 && metric.fontSize>=14,`${await text.textContent()}: ${JSON.stringify(metric)}`);
 }
}

async function touchControls(locator) {
 for(const control of await locator.all()) {
  if(!await control.isVisible())continue;
  const box=await control.boundingBox();
  assert.ok(box.height>=44 && box.width>=44,`${await control.textContent()}: ${JSON.stringify(box)}`);
 }
}

for(const width of [375,1440]) {
 browserTest(`design completeness: break and return promise use calm cards and accessible actions at ${width}px`,()=>withApp(width,async page=>{
  await page.getByRole('button',{name:'잠시 쉬기',exact:true}).click();
  const card=page.locator('.session-break');await card.waitFor();
  await designSnapshot(page,'break-complete',width);
  await readableGroup(card.locator('span:not(.session-break-icon),strong,small,p,button'));
  await touchControls(card.locator('button'));
  assert.equal(await card.evaluate(el=>getComputedStyle(el).backgroundImage),'none');
  assert.equal(await card.locator('.break-return-plan').evaluate(el=>getComputedStyle(el).borderTopWidth),'1px');
  assert.equal(await page.locator('.dashboard-attendance').textContent(),'휴식 중');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }));

 browserTest(`design completeness: precheck uses common card and readable copy at ${width}px`,()=>withApp(width,async page=>{
  const card=page.locator('.recovery-precheck');await card.waitFor();
  await designSnapshot(page,'precheck-complete',width);
  assert.equal(await card.evaluate(el=>getComputedStyle(el).borderTopWidth),'1px');
  assert.equal(await card.evaluate(el=>getComputedStyle(el).boxShadow),'none');
  await readableGroup(card.locator('p,strong'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 },'precheck'));

 browserTest(`design completeness: camera header and messages remain legible at ${width}px`,()=>withApp(width,async page=>{
  const tools=page.locator('.focus-tools');await tools.locator('summary').first().click();
  await readableGroup(tools.locator('.camera-monitor-head,.camera-message,.camera-warning-note,.session-lease span,.session-lease small'));
  await readableGroup(page.locator('.dashboard-page-heading p,.dashboard-attendance,.focus-attendance-rule,.session-clock > span,.focus-plan-card small,.focus-record-link,.focus-tools > summary > span'));
 }));

 browserTest(`design completeness: edit time and repeat choices have AA contrast and touch targets at ${width}px`,()=>withApp(width,async page=>{
  await page.getByRole('button',{name:'계획',exact:true}).click();
  await page.locator('.todo-edit').first().click();
  const dialog=page.locator('.todo-modal');await dialog.waitFor();
  await designSnapshot(page,'edit-complete',width);
  await readableGroup(dialog.locator('.todo-mode-toggle button,.weekday-picker button,.goal-link-row'));
  await touchControls(dialog.locator('.todo-mode-toggle button,.weekday-picker button'));
  await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  await page.locator('a[href="#goals"]:visible').first().click();
  await page.getByRole('button',{name:'새 목표',exact:true}).click();
  await page.locator('.goal-link-panel').waitFor();
  await readableGroup(page.locator('.goal-link-row strong,.goal-link-row small'));
  assert.equal(await page.locator('.goal-link-panel').evaluate(el=>getComputedStyle(el).borderTopWidth),'1px');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }));

 browserTest(`design completeness: reflection score and heading share dialog hierarchy at ${width}px`,()=>withApp(width,async page=>{
  await page.locator('.topbar-actions').getByRole('button',{name:'종료',exact:true}).click();
  const dialog=page.locator('.session-reflection-modal');await dialog.waitFor();
  await designSnapshot(page,'reflection-complete',width);
  await readableGroup(dialog.locator('.reflection-score-field button,legend'));
  await touchControls(dialog.locator('.reflection-score-field button'));
  const heading=await dialog.getByRole('heading').boundingBox(),close=await dialog.getByRole('button',{name:'회고 닫기',exact:true}).boundingBox();
  assert.ok(close.y<heading.y+heading.height && close.x>heading.x,'close is beside the heading');
  await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>fixture.sessions[0].ended_at),null);
 }));

 browserTest(`design completeness: record milestones use readable calm surfaces at ${width}px`,()=>withApp(width,async page=>{
  await page.getByRole('button',{name:'기록',exact:true}).click();
  await readableGroup(page.locator('.daily-habit-card small,.daily-habit-card p,.study-summary span'));
  assert.equal(await page.locator('.study-summary > div').first().evaluate(el=>getComputedStyle(el).borderTopWidth),'1px');
  assert.equal(await page.locator('.daily-habit-card').evaluate(el=>getComputedStyle(el).backgroundImage),'none');
 }));

 browserTest(`design completeness: feed language controls and scene badges have readable text at ${width}px`,()=>withApp(width,async page=>{
  await page.locator('a[href="#feed"]:visible').first().click();await page.locator('.tech-feed').waitFor();
  await readableGroup(page.locator('.feed-language-filter label,.feed-language-filter button,.feed-language-filter button small,.feed-summary p,.feed-evidence span,.feed-card-actions a,.feed-card-actions button,.feed-settings-panel > summary,.feed-daily-briefing header p'));
  await touchControls(page.locator('.feed-language-filter button'));
  await page.locator('a[href="#forest"]:visible').first().click();
  await page.locator('.study-forest-3d-badge').waitFor();
  await readableGroup(page.locator('.study-forest-3d-badge span'));
 }));

 browserTest(`design completeness: login shares paper and accessible type at ${width}px`,()=>withApp(width,async page=>{
  const panel=page.locator('.login-panel');await panel.waitFor();await designSnapshot(page,'login-complete',width);
  assert.equal(await panel.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 253, 245)');
  assert.equal(await panel.evaluate(el=>getComputedStyle(el).borderTopWidth),'1px');
  assert.ok(await panel.locator('h1').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)<=32));
  await readableGroup(panel.locator('p,label,button,.login-divider span'));
  await touchControls(panel.locator('button,input'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 },'login'));
}
