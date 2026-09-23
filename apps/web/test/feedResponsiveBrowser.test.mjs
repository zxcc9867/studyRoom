import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

let chromium;
try {({chromium}=await import(process.env.FEED_BROWSER_MODULE?pathToFileURL(process.env.FEED_BROWSER_MODULE).href:'playwright'));} catch {}
const require=createRequire(import.meta.url);
async function component(path){
 const built=await build({entryPoints:[new URL(path,import.meta.url).pathname.replace(/^\/(\w:)/,'$1')],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'});
 const mod={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,mod,mod.exports);return mod.exports;
}
const {FeedBriefingContent}=await component('../src/FeedDailyBriefing.tsx');
const {FeedArticleCard}=await component('../src/TechFeedSection.tsx');
const data={local_date:'2026-09-23',time_zone:'Asia/Tokyo',total:9,source_count:4,categories:[{value:'practice',label:'실무·튜토리얼',count:4}],topics:[{value:'AI',label:'AI',count:6},{value:'AWS',label:'AWS',count:4}],analyzed_count:6,generated_at:'2026-09-23T06:00:00Z',status:'ready',stale:false,insights:[{title:'실무 적용 사례',body:'공개 소개에서 확인한 경향',study_angle:'직접 따라 해보기',sources:[]}],highlights:[{reason:'구체적인 구현 단계',learning:'배포 과정',source:{id:'pick',title:'AWS 배포 사례',url:'https://example.com/pick'}}]};
const article={title:'운영 환경의 기술 아키텍처 가이드',excerpt:'실제 서비스 아키텍처와 장애 대응 과정을 살펴볼 수 있습니다.',url:'https://example.com/article',published_at:'2026-09-23T06:00:00Z',discovered_at:'2026-09-23T06:00:00Z',sources:[{id:'source',name:'기술 블로그'}],summary_status:'pending',summary:null,category:'practice',interests:[],saved:false,todo_id:null,origin:'web_search',matched_topics:[]};
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8')+readFileSync(new URL('../src/techFeed.css',import.meta.url),'utf8').replace(/^@import[^;]+;/,'');
const briefing=renderToStaticMarkup(React.createElement(FeedBriefingContent,{data,busy:false,error:'',onGenerate(){},onReload(){}}));
const cards=Array.from({length:4},(_,i)=>renderToStaticMarkup(React.createElement(FeedArticleCard,{article:{...article,id:String(i)},busy:false,timeZone:'Asia/Tokyo',onSave(){},onPlan(){}}))).join('');
const html='<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><main class="dashboard-shell"><aside class="sidebar"><h1>독서실</h1></aside><section class="workspace feed-workspace"><section class="tech-feed"><header class="feed-header"><div><p class="eyebrow">THE LEARNING POST</p><h2>오늘의 발견, 내일의 공부.</h2></div></header>'+briefing+'<div class="feed-toolbar"><strong>새로운 발견</strong></div><div class="feed-list">'+cards+'</div></section></section></main></body></html>';
test('technology feed uses desktop width and columns while mobile keeps one readable column',{skip:!chromium&&'Optional browser runtime unavailable'},async()=>{
 const server=createServer((_,response)=>{response.setHeader('Content-Type','text/html; charset=utf-8');response.end(html);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.FEED_BROWSER_EXECUTABLE||undefined});
  for(const width of [375,1440,2200]){
   const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
   await page.goto('http://127.0.0.1:'+server.address().port);
   const layout=await page.evaluate(()=>{
    const feed=document.querySelector('.tech-feed'),cards=[...document.querySelectorAll('.feed-card')],workspace=document.querySelector('.workspace');
    return {overflow:document.documentElement.scrollWidth>innerWidth,feedWidth:feed.getBoundingClientRect().width,workspaceWidth:workspace.getBoundingClientRect().width,firstX:cards[0].getBoundingClientRect().x,secondX:cards[1].getBoundingClientRect().x};
   });
   if(process.env.FEED_CAPTURE_DIR){mkdirSync(process.env.FEED_CAPTURE_DIR,{recursive:true});await page.screenshot({path:process.env.FEED_CAPTURE_DIR+'/feed-'+(process.env.FEED_CAPTURE_PHASE||'check')+'-'+width+'.png',fullPage:true});}
   assert.equal(layout.overflow,false,'horizontal overflow at '+width);
   if(width===375){assert.equal(layout.firstX,layout.secondX);assert.ok(layout.feedWidth>=320);}
   if(width===1440){assert.ok(layout.feedWidth>=1000,'desktop feed should use available width');assert.ok(layout.secondX>layout.firstX+100);}
   if(width===2200){assert.ok(layout.feedWidth>=1500,'wide desktop should use available width');assert.ok(layout.secondX>layout.firstX+100);}
   await page.close();
  }
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
