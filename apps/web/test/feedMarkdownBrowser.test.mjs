import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';

let chromium;
try {({chromium}=await import(process.env.FEED_BROWSER_MODULE?pathToFileURL(process.env.FEED_BROWSER_MODULE).href:'playwright'));} catch {}

const introduction='Scene stability improved. ##### Projection accuracy #### RTX sensors ##### Calibration charts.\n\nUse C# and `#include`.';
const translated='씬 분할이 개선되었습니다. ##### 투영 정확도 #### RTX 센서 ##### 보정 차트로 구성합니다.\n\nC# 및 `#include` 예제를 확인하세요.';
const fixture=`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {FeedArticleCard} from '../src/TechFeedSection';
const article={id:'translated',title:'Release notes',title_ko:'릴리스 노트',excerpt:${JSON.stringify(introduction)},excerpt_ko:${JSON.stringify(translated)},translation_status:'ready',url:'https://example.com/release#section',published_at:'2026-10-10T00:00:00Z',discovered_at:'2026-10-10T00:00:00Z',sources:[],summary_status:'pending',summary:null,category:'news',interests:[],saved:false,todo_id:null,origin:'web_search',matched_topics:[]};
createRoot(document.getElementById('root')).render(<div className="tech-feed"><FeedArticleCard article={article} timeZone="Asia/Tokyo" busy={false} onSave={()=>{}} onPlan={()=>{}}/><FeedArticleCard article={{...article,id:'summary',summary_status:'ready',summary:{technology:'설명 ##### 어떤 기술인지',change:'변화 #### 핵심 변화',usage:'활용 ##### 적용 상황'}}} timeZone="Asia/Tokyo" busy={false} onSave={()=>{}} onPlan={()=>{}}/></div>);
`;

test('375px and 1440px feed previews, expanded translations, summaries and originals hide heading markers',{skip:!chromium&&'Optional browser runtime unavailable'},async()=>{
 const built=await build({stdin:{contents:fixture,resolveDir:fileURLToPath(new URL('.',import.meta.url)),sourcefile:'feed-markdown-fixture.tsx',loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'});
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8')+readFileSync(new URL('../src/techFeed.css',import.meta.url),'utf8').replace(/^@import[^;]+;/,'');
 const server=createServer((request,response)=>{response.setHeader('Content-Type',request.url==='/app.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8');response.end(request.url==='/app.js'?built.outputFiles[0].text:'<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.FEED_BROWSER_EXECUTABLE||undefined});
  for(const width of [375,1440]){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:'+server.address().port);
   const cards=page.locator('.feed-card');
   await cards.first().waitFor();
   assert.doesNotMatch(await cards.first().locator('.feed-excerpt').innerText(),/#{2,}/);
   await cards.first().getByRole('button',{name:'내용 더 보기',exact:true}).click();
   const expanded=cards.first().locator('.feed-article-text').first();
   assert.doesNotMatch(await expanded.innerText(),/#{2,}/);
   assert.match(await expanded.innerText(),/보정 차트로 구성합니다/);
   assert.match(await expanded.innerText(),/C# 및 #include/);
   assert.equal(await cards.first().getByRole('link',{name:'원문 읽기',exact:true}).getAttribute('href'),'https://example.com/release#section');
   assert.equal(await cards.first().locator('.feed-language-tag').innerText(),'# 영어 원문');
   await cards.first().getByText('원문 텍스트 보기',{exact:true}).click();
   assert.doesNotMatch(await cards.first().locator('.feed-original-text').innerText(),/#{2,}/);
   assert.match(await cards.first().locator('.feed-original-text').innerText(),/Calibration charts/);
   await cards.nth(1).getByRole('button',{name:'AI 요약 펼치기',exact:true}).click();
   assert.doesNotMatch(await cards.nth(1).locator('.feed-summary').innerText(),/#{2,}/);
   assert.match(await cards.nth(1).locator('.feed-summary').innerText(),/핵심 변화/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.deepEqual(errors,[]);
   if(process.env.FEED_CAPTURE_DIR){mkdirSync(process.env.FEED_CAPTURE_DIR,{recursive:true});await page.screenshot({path:process.env.FEED_CAPTURE_DIR+'/feed-markdown-'+width+'.png',fullPage:true});}
   await page.close();
  }
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
