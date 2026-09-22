import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {readFileSync,mkdirSync} from 'node:fs';

// Opt-in real browser regressions. Reuse an installed Playwright module/browser;
// the normal Node suite does not download a runtime or change dependencies.
let chromium;
try{({chromium}=await import(process.env.FEED_BROWSER_MODULE?pathToFileURL(process.env.FEED_BROWSER_MODULE).href:'playwright'));}catch{}
const browserTest=(name,run)=>test(name,{skip:!chromium&&'Optional browser runtime unavailable; set FEED_BROWSER_MODULE to an installed Playwright module'},run);
const fixtureSource=`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {FeedDailyBriefing} from '../src/FeedDailyBriefing';
const root=createRoot(document.getElementById('root'));
const state={owner:'owner-a',revision:0,timeZone:'Asia/Tokyo',total:32,fail:false,calls:[],pendingGeneration:false,generationAborted:false,releaseGeneration:null,date:'2026-09-15'};
const dto=()=>({local_date:state.date,time_zone:state.timeZone,total:state.total,source_count:3,categories:[{value:'news',label:'기술 소식',count:state.total}],topics:[{value:'Rust',label:'Rust',count:12}],eligible_count:29,analyzed_count:24,generated_at:'2026-09-15T01:00:00Z',status:'ready',stale:false,highlights:[{reason:'실제 장애 복구 과정과 설계 선택을 확인할 수 있어요.',learning:'타임아웃과 재시도의 기준',source:{id:'a',title:'CACHED_PRIVATE_HIGHLIGHT — 장애에서 배우는 백엔드 설계',url:'https://example.com/architecture'}},{reason:'새 도구의 구체적인 활용 예시가 있어요.',learning:'작은 프로젝트에 적용하기',source:{id:'b',title:'CACHED_PRIVATE_HIGHLIGHT — 개발 도구 활용',url:'https://example.com/tools'}},{reason:'성능 측정 방법을 비교할 수 있어요.',learning:'측정 조건과 한계 확인',source:{id:'c',title:'CACHED_PRIVATE_HIGHLIGHT — 시스템 성능 분석',url:'https://example.com/performance'}}],insights:[{title:'CACHED_PRIVATE_TITLE',body:'CACHED_PRIVATE_BODY',study_angle:'study',sources:[{id:'a',title:'CACHED_PRIVATE_SOURCE',url:'https://example.com/source'}]}]});
const api=async(action,payload,signal)=>{
 state.calls.push({action,payload,owner:state.owner});
 if(action==='briefing_generate'&&state.pendingGeneration){
   const result=dto();
   signal.addEventListener('abort',()=>{state.generationAborted=true;},{once:true});
   return await new Promise(resolve=>{state.releaseGeneration=()=>resolve(result);});
 }
 if(state.fail)throw new Error('FIXTURE_READ_FAILED');
 return dto();
};
function render(){root.render(<FeedDailyBriefing api={api} userId={state.owner} timeZone={state.timeZone} revision={state.revision}/>);}
window.fixture={state,render,reactivate(){window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));}};
Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});
render();
`;
async function withMounted(run,width=1280){
 const css=readFileSync(new URL('../src/techFeed.css',import.meta.url),'utf8').replace(/^@import[^;]+;/,'');
 const built=await build({stdin:{contents:fixtureSource,resolveDir:fileURLToPath(new URL('.',import.meta.url)),sourcefile:'feed-briefing-lifecycle-fixture.tsx',loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',logLevel:'silent'});
 const server=createServer((request,response)=>{response.setHeader('Content-Type',request.url==='/app.js'?'text/javascript':'text/html');response.end(request.url==='/app.js'?built.outputFiles[0].text:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:16px;background:#e4f1e9}'+css+'</style></head><body><div id="root" class="tech-feed"></div><script src="/app.js"></script></body></html>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.FEED_BROWSER_EXECUTABLE||undefined});
  const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(2000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date('2026-09-15T03:00:00Z')});
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForSelector('.feed-briefing-totals strong');
  await run(page);
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
}

browserTest('mounted same-scope revision failure retains statistics and hides unvalidated citations',async()=>withMounted(async page=>{
 await page.evaluate(()=>{fixture.state.fail=true;fixture.state.revision++;fixture.render();});
 await page.getByRole('alert').waitFor();
 assert.equal(await page.locator('.feed-briefing-totals strong').first().textContent(),'32');
 assert.equal(await page.locator('.feed-briefing-totals strong').nth(1).textContent(),'3');
 assert.doesNotMatch(await page.locator('body').textContent(),/CACHED_PRIVATE/);
 assert.match(await page.locator('body').textContent(),/마지막으로 확인한 통계/);
 assert.deepEqual(await page.evaluate(()=>fixture.state.calls.map(call=>call.action)),['briefing','briefing']);
}));

browserTest('mounted same-day focus and visibility events coalesce one read without generation or polling',async()=>withMounted(async page=>{
 await page.evaluate(()=>{fixture.state.total=33;fixture.reactivate();});
 await page.waitForTimeout(400);
 assert.equal(await page.locator('.feed-briefing-totals strong').first().textContent(),'33');
 assert.deepEqual(await page.evaluate(()=>fixture.state.calls.map(call=>call.action)),['briefing','briefing']);
 await page.waitForTimeout(400);
 assert.deepEqual(await page.evaluate(()=>fixture.state.calls.map(call=>call.action)),['briefing','briefing']);
}));

browserTest('mounted reactivation does not abort active generation and revalidates once after completion',async()=>withMounted(async page=>{
 await page.evaluate(()=>{fixture.state.pendingGeneration=true;});
 await page.getByRole('button',{name:'오늘 요약·추천 다시 보기',exact:true}).click();
 await page.waitForFunction(()=>Boolean(fixture.state.releaseGeneration));
 await page.evaluate(()=>{fixture.state.total=33;fixture.reactivate();});
 await page.waitForTimeout(400);
 assert.equal(await page.evaluate(()=>fixture.state.generationAborted),false);
 assert.deepEqual(await page.evaluate(()=>fixture.state.calls.map(call=>call.action)),['briefing','briefing_generate']);
 await page.evaluate(()=>fixture.state.releaseGeneration());
 await page.waitForTimeout(400);
 assert.equal(await page.locator('.feed-briefing-totals strong').first().textContent(),'33');
 assert.deepEqual(await page.evaluate(()=>fixture.state.calls.map(call=>call.action)),['briefing','briefing_generate','briefing']);
}));

browserTest('mounted account and local-day changes never retain another scope statistics after failure',async()=>{
 for(const change of ['account','day','timezone'])await withMounted(async page=>{
  if(change==='day')await page.clock.setFixedTime(new Date('2026-09-16T03:00:00Z'));
  await page.evaluate(change=>{
   fixture.state.fail=true;
   if(change==='account'){fixture.state.owner='owner-b';fixture.render();}
   if(change==='timezone'){fixture.state.timeZone='America/Los_Angeles';fixture.render();}
   if(change==='day')fixture.reactivate();
  },change);
  await page.getByRole('alert').waitFor();
  assert.equal(await page.locator('.feed-briefing-totals').count(),0);
  assert.doesNotMatch(await page.locator('body').textContent(),/CACHED_PRIVATE/);
 });
});

browserTest('mounted highlights show three sourced picks on desktop and mobile through the explicit summary action',async()=>{
 for(const width of [1440,390])await withMounted(async page=>{
  const picks=page.locator('.feed-highlights li');
  assert.equal(await picks.count(),3);
  assert.match(await picks.first().textContent(),/오늘 하나만 읽는다면/);
  assert.equal(await picks.first().getByRole('link',{name:'원문 읽기 ↗',exact:true}).getAttribute('href'),'https://example.com/architecture');
  const first=await picks.first().boundingBox(),themes=await page.locator('.feed-briefing-insights').boundingBox();
  assert.ok(first.y<themes.y);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  await page.getByRole('button',{name:'오늘 요약·추천 다시 보기',exact:true}).click();
  await page.waitForFunction(()=>fixture.state.calls.some(call=>call.action==='briefing_generate'));
  assert.equal(await page.evaluate(()=>fixture.state.calls.filter(call=>call.action==='briefing_generate').length),1);
  if(process.env.FEED_CAPTURE_DIR){
   mkdirSync(process.env.FEED_CAPTURE_DIR,{recursive:true});
   await page.locator('.feed-highlights').screenshot({path:process.env.FEED_CAPTURE_DIR+'/feed-highlights-'+width+'.png'});
  }
 },width);
});
