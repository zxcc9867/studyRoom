import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
let chromium;
try {({chromium}=await import(process.env.FEED_BROWSER_MODULE?pathToFileURL(process.env.FEED_BROWSER_MODULE).href:'playwright'));}catch{}

test('real module cleanup failure mounts actionable gate, keeps probes unknown and retries into common login/native auth', {skip:!chromium&&'Chrome runtime required'}, async()=>{
  const built=await build({stdin:{contents:`import {supabase} from './apps/web/src/supabase';import './apps/web/src/main';window.realClient=supabase;`,resolveDir:fileURLToPath(new URL('../../..',import.meta.url)),loader:'ts'},bundle:true,write:false,outdir:'fixture',platform:'browser',format:'iife',jsx:'automatic',logLevel:'silent',define:{'import.meta.env':'{"VITE_SUPABASE_URL":"https://bootstrap-fixture.supabase.co","VITE_SUPABASE_ANON_KEY":"fixture-public-key","VITE_GOOGLE_AUTH_ENABLED":"true"}'}});
  const js=built.outputFiles.find(f=>f.path.endsWith('.js')).text;
  const browser=await chromium.launch({headless:true,executablePath:process.env.FEED_BROWSER_EXECUTABLE||undefined});
  const userId='11111111-1111-4111-8111-111111111111';
  try{
    const page=await browser.newPage();page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));let authRequests=0;
    await page.addInitScript(userId=>{
      window.bootstrapFixture={cleanupBlocked:true,removalAttempts:0,calls:[],writes:[],nativeUser:null};const f=bootstrapFixture,listeners=new Set();
      localStorage.setItem('study-room-attendance-auth-session',JSON.stringify({access_token:'stale-fixture',refresh_token:'stale-fixture',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'stale-user'}}));
      localStorage.setItem('study-room:device-study:'+userId,'idle');localStorage.setItem('preference-to-preserve','yes');
      const remove=Storage.prototype.removeItem,set=Storage.prototype.setItem;
      Storage.prototype.removeItem=function(key){if(this===localStorage&&key==='study-room-attendance-auth-session'){f.removalAttempts++;if(f.cleanupBlocked)throw new Error('fixture private storage failure');}return remove.call(this,key);};
      Storage.prototype.setItem=function(key,value){if(this===localStorage&&key==='study-room-attendance-auth-session')f.writes.push(key);return set.call(this,key,value);};
      f.emit=event=>listeners.forEach(cb=>cb(event));
      window.studyRoomDesktop={protocolVersion:1,onEvent:cb=>{listeners.add(cb);return()=>listeners.delete(cb);},request:async m=>{
        f.calls.push(m);let value={};
        if(m.action==='authStatus')value={userId:f.nativeUser};
        if(m.action==='webTicket')value={type:'STUDY_WEB_AUTH_TICKET',requestId:m.id,userId:f.nativeUser,tokenHash:'fixture-ticket'};
        if(m.action==='info')value={platform:'windows',version:'0.1.0',build:'1',protocolVersion:1,secureStorage:false};
        return{id:m.id,ok:true,value};
      }};
    },userId);
    await page.route('https://bootstrap-fixture.supabase.co/**',async route=>{
      const url=new URL(route.request().url());
      if(url.pathname.startsWith('/auth/v1/')){
        authRequests++;await route.fulfill({json:{access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer',user:{id:userId,aud:'authenticated',role:'authenticated',email:'fixture@example.test',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-10-25T00:00:00Z'}}});return;
      }
      if(url.pathname.endsWith('/profiles')&&route.request().method()==='GET'){await route.fulfill({json:{user_id:userId,email:'fixture@example.test',time_zone:'Asia/Tokyo',reminder_time:'09:00',email_reminders_enabled:false}});return;}
      if(url.pathname.endsWith('/study_device_snapshot')){await route.fulfill({json:{accepted:true,server_now:new Date().toISOString(),active_session:null,session:null,tracking:null,camera:null}});return;}
      if(url.pathname.endsWith('/get_study_period_summary')){await route.fulfill({json:{completed_seconds:0,completed_session_count:0,anomaly_session_count:0,cross_date_session_count:0}});return;}
      await route.fulfill({json:[]});
    });
    await page.route('https://study-room-attendance.vercel.app/**',route=>route.fulfill({contentType:'text/html',body:'<html><body><div id="root"></div><script>'+js.replaceAll('</script','<\\/script')+'</script></body></html>'}));
    await page.goto('https://study-room-attendance.vercel.app/');
    const alert=page.locator('.login-shell .login-panel[role="alert"]');await alert.waitFor();
    assert.match(await alert.innerText(),/저장소/);assert.equal(await page.locator('.topbar-actions').count(),0);
    assert.equal(await page.evaluate(async()=>(await realClient.auth.getSession()).data.session),null);
    assert.equal(authRequests,0);assert.equal(await page.evaluate(()=>bootstrapFixture.calls.some(c=>['authStatus','webTicket'].includes(c.action))),false);
    await page.evaluate(()=>bootstrapFixture.emit({type:'state-requested',requestId:'cleanup-error-probe'}));
    await page.waitForFunction(()=>bootstrapFixture.calls.some(c=>c.id==='cleanup-error-probe'));
    assert.deepEqual(await page.evaluate(()=>bootstrapFixture.calls.find(c=>c.id==='cleanup-error-probe').payload),{userId:null,ready:false,session:null,cameraActive:false,operationPending:true,activity:'unknown'});
    const retry=alert.getByRole('button',{name:'다시 연결',exact:true});await retry.click();await alert.waitFor();
    assert.ok(await page.evaluate(()=>bootstrapFixture.removalAttempts)>=2);assert.equal(authRequests,0);assert.equal(await page.evaluate(()=>bootstrapFixture.calls.some(c=>['authStatus','webTicket'].includes(c.action))),false);
    await page.evaluate(()=>{bootstrapFixture.cleanupBlocked=false;bootstrapFixture.emit({type:'auth-changed'});});
    await alert.waitFor();
    await page.evaluate(()=>bootstrapFixture.emit({type:'state-requested',requestId:'cleanup-retry-required'}));
    await page.waitForFunction(()=>bootstrapFixture.calls.some(c=>c.id==='cleanup-retry-required'));
    assert.equal(await page.evaluate(()=>bootstrapFixture.calls.some(c=>['authStatus','webTicket'].includes(c.action))),false);
    assert.equal(await page.evaluate(()=>bootstrapFixture.calls.find(c=>c.id==='cleanup-retry-required').payload.activity),'unknown');
    await retry.click();
    await page.getByRole('heading',{name:'독서실에 로그인',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>localStorage.getItem('study-room-attendance-auth-session')),null);assert.equal(await page.evaluate(()=>localStorage.getItem('preference-to-preserve')),'yes');
    await page.evaluate(userId=>{bootstrapFixture.nativeUser=userId;bootstrapFixture.emit({type:'auth-changed'});},userId);
    await page.locator('.topbar-actions button').first().waitFor();
    assert.equal(await page.evaluate(async()=>(await realClient.auth.getSession()).data.session?.user.id),userId);
    assert.equal(authRequests,1);assert.equal(await page.evaluate(()=>bootstrapFixture.calls.filter(c=>c.action==='webTicket').length),1);
    assert.equal(await page.evaluate(()=>localStorage.getItem('study-room-attendance-auth-session')),null);assert.deepEqual(await page.evaluate(()=>bootstrapFixture.writes),[]);assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
