import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
let chromium;
try {({chromium}=await import(process.env.FEED_BROWSER_MODULE?pathToFileURL(process.env.FEED_BROWSER_MODULE).href:'playwright'));}catch{}
let built;
async function withRealAuth(platform,secureStorage,run){
  built??=build({stdin:{contents:`import {supabase} from './apps/web/src/supabase';import {consumeEmbeddedTicket} from './apps/web/src/embeddedAuth.mjs';window.realAuth={client:supabase,exchange:()=>consumeEmbeddedTicket(supabase,{type:'STUDY_WEB_AUTH_TICKET',requestId:'fixture',userId:'11111111-1111-4111-8111-111111111111',tokenHash:'fixture-ticket'},'fixture')};`,resolveDir:fileURLToPath(new URL('../../..',import.meta.url)),loader:'ts'},bundle:true,write:false,platform:'browser',format:'iife',logLevel:'silent',define:{'import.meta.env':'{"VITE_SUPABASE_URL":"https://renderer-fixture.supabase.co","VITE_SUPABASE_ANON_KEY":"fixture-public-key"}'}});
  const js=(await built).outputFiles[0].text;
  const browser=await chromium.launch({headless:true,executablePath:process.env.FEED_BROWSER_EXECUTABLE||undefined});
  try{
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(({platform,secureStorage})=>{
      window.storageWrites=[];window.storageRemovals=[];
      localStorage.setItem('study-room:device-study:owner','session-proof');localStorage.setItem('unrelated-preference','preserve');
      if(platform==='desktop'){
        if(!sessionStorage.getItem('seeded'))localStorage.setItem('study-room-attendance-auth-session',JSON.stringify({access_token:'old-fixture',refresh_token:'old-fixture'}));
        sessionStorage.setItem('seeded','yes');
        window.studyRoomDesktop={protocolVersion:1,request:async m=>({id:m.id,ok:true,value:{secureStorage}}),onEvent:()=>()=>{}};
      }
      if(platform==='android')window.ReactNativeWebView={postMessage(){}};
      const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;
      Storage.prototype.setItem=function(k,v){if(this===localStorage)storageWrites.push({key:k,credential:/fixture-access|fixture-refresh/.test(v)});return set.call(this,k,v);};
      Storage.prototype.removeItem=function(k){if(this===localStorage)storageRemovals.push(k);return remove.call(this,k);};
    },{platform,secureStorage});
    let refreshes=0,verifies=0;
    await page.route('https://renderer-fixture.supabase.co/auth/v1/**',async route=>{
      const url=new URL(route.request().url());
      if(url.pathname.endsWith('/verify'))verifies++;else if(url.pathname.endsWith('/token')&&url.searchParams.get('grant_type')==='refresh_token')refreshes++;else throw new Error('unexpected real SDK endpoint '+url.pathname);
      await route.fulfill({json:{access_token:'fixture-access-'+refreshes,refresh_token:'fixture-refresh-'+refreshes,expires_in:3600,token_type:'bearer',user:{id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'fixture@example.test',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-10-25T00:00:00Z'}}});
    });
    await page.route('https://study-room-attendance.vercel.app/**',route=>route.fulfill({contentType:'text/html',body:'<html><body><script>'+js.replaceAll('</script','<\\/script')+'</script></body></html>'}));
    await page.goto('https://study-room-attendance.vercel.app/');
    await run(page);
    assert.equal(verifies,1);assert.equal(refreshes,1);assert.deepEqual(errors,[]);
  }finally{await browser.close();}
}
for(const secureStorage of [true,false])test(`real desktop SDK ticket and refresh never persist browser credentials (native secureStorage=${secureStorage})`,{skip:!chromium&&'Chrome runtime required'},()=>withRealAuth('desktop',secureStorage,async page=>{
  assert.equal(await page.evaluate(async()=>(await realAuth.client.auth.getSession()).data.session),null);
  await page.evaluate(()=>realAuth.exchange());
  const refreshError=await page.evaluate(async()=>!!(await realAuth.client.auth.refreshSession()).error);assert.equal(refreshError,false);
  const storage=await page.evaluate(()=>({auth:localStorage.getItem('study-room-attendance-auth-session'),writes:storageWrites,removals:storageRemovals,study:localStorage.getItem('study-room:device-study:owner'),preference:localStorage.getItem('unrelated-preference')}));
  assert.equal(storage.auth,null);assert.equal(storage.writes.some(w=>w.credential||w.key==='study-room-attendance-auth-session'),false);
  assert.deepEqual(storage.removals.filter(k=>!k.startsWith('lswt-')),['study-room-attendance-auth-session']);assert.equal(storage.study,'session-proof');assert.equal(storage.preference,'preserve');
  await page.reload();assert.equal(await page.evaluate(async()=>(await realAuth.client.auth.getSession()).data.session),null);
}));
for(const platform of ['web','android'])test(`real ${platform} SDK keeps existing browser persistence`,{skip:!chromium&&'Chrome runtime required'},()=>withRealAuth(platform,true,async page=>{
  await page.evaluate(()=>realAuth.exchange());await page.evaluate(()=>realAuth.client.auth.refreshSession());
  assert.equal(await page.evaluate(()=>!!localStorage.getItem('study-room-attendance-auth-session')),true);
}));
