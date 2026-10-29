import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';

let chromium;
try {({chromium}=await import(process.env.FEED_BROWSER_MODULE?pathToFileURL(process.env.FEED_BROWSER_MODULE).href:'playwright'));} catch {}

const fixture=`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {FeedArticleCard} from '../src/TechFeedSection';
import {FeedViewFilters} from '../src/FeedViewFilters';
import {feedOriginalLanguage} from '../../../packages/core/src/feedLanguage.mjs';
const articles=[
 {id:'english',title:'AWS architecture guide',title_ko:'AWS 아키텍처 가이드',excerpt:'This article explains the production architecture in detail.',excerpt_ko:'운영 아키텍처를 설명합니다.',translation_status:'ready',url:'https://example.com/english',published_at:'2026-09-23T00:00:00Z',discovered_at:'2026-09-23T00:00:00Z',sources:[],summary_status:'ready',summary:{technology:'This explains the production architecture.',change:'The architecture changes how requests run.',usage:'Use this to inspect production requests.'},category:null,interests:[],saved:false,todo_id:null,origin:'web_search',matched_topics:[]},
 {id:'korean',title:'AWS 아키텍처를 개선한 사례',excerpt:'실제 서비스에서 적용한 아키텍처와 문제 해결 방법을 설명합니다.',translation_status:'pending',url:'https://example.com/korean',published_at:'2026-09-23T00:00:00Z',discovered_at:'2026-09-23T00:00:00Z',sources:[],summary_status:'pending',summary:null,category:null,interests:[],saved:false,todo_id:null,origin:'web_search',matched_topics:[]},
 {id:'waiting',title:'PostgreSQL query planning',excerpt:'This introduction has not been translated yet.',translation_status:'pending',url:'https://example.com/waiting',published_at:'2026-09-23T00:00:00Z',discovered_at:'2026-09-23T00:00:00Z',sources:[],summary_status:'pending',summary:null,category:null,interests:[],saved:false,todo_id:null,origin:'web_search',matched_topics:[]}
];
function App(){
 const [language,setLanguage]=React.useState('');
 const visible=articles.filter(item=>!language||feedOriginalLanguage(item.title,item.excerpt)===language);
 return <div className="tech-feed"><FeedViewFilters facets={{total:3,topics:[],sources:[],languages:[{value:'ko',label:'한국어 원문',count:1},{value:'en',label:'영어 원문',count:2}]}} topic="" source="" language={language} total={visible.length} busy={false} loading={false} error="" onTopic={()=>{}} onSource={()=>{}} onLanguage={setLanguage} onReset={()=>setLanguage('')} onRetry={()=>{}}/><div className="feed-list">{visible.map(article=><FeedArticleCard key={article.id} article={article} translationService="quota_exhausted" timeZone="Asia/Seoul" busy={false} onSave={()=>{}} onPlan={()=>{}}/>)}</div></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
`;

test('PC and 375px mobile preserve Korean reading, explain unavailable translation, and filter original languages',{skip:!chromium&&'Optional browser runtime unavailable'},async()=>{
 const built=await build({stdin:{contents:fixture,resolveDir:fileURLToPath(new URL('.',import.meta.url)),sourcefile:'feed-language-fixture.tsx',loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'});
 const css=readFileSync(new URL('../src/techFeed.css',import.meta.url),'utf8').replace(/^@import[^;]+;/,'');
 const server=createServer((request,response)=>{response.setHeader('Content-Type',request.url==='/app.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8');response.end(request.url==='/app.js'?built.outputFiles[0].text:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:16px;background:#e4f1e9}'+css+'</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.FEED_BROWSER_EXECUTABLE||undefined});
  for(const width of [1440,375]){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:'+server.address().port);
   page.setDefaultTimeout(3000);
   assert.deepEqual(errors,[]);
   await page.waitForSelector('.feed-card');
   assert.equal(await page.locator('.feed-card').count(),3);
   assert.deepEqual(await page.locator('.feed-language-tag').allTextContents(),['# 영어 원문','# 한국어 원문','# 영어 원문']);
   const translated=page.locator('.feed-card').first();
   assert.equal(await translated.locator('.feed-excerpt').textContent(),'운영 아키텍처를 설명합니다.');
   assert.match(await translated.locator('.feed-translation-status').textContent(),/한국어 번역/);
   assert.doesNotMatch(await translated.locator('.feed-translation-status').textContent(),/한도/);
   await translated.getByRole('button',{name:'영어 AI 요약 펼치기'}).click();
   assert.match(await translated.locator('.feed-article-text').first().textContent(),/운영 아키텍처를 설명합니다/);
   assert.match(await translated.locator('.feed-summary').textContent(),/This explains the production architecture/);
   assert.equal(await translated.locator('.feed-summary dd').first().getAttribute('lang'),'en');
   await translated.getByRole('button',{name:'내용 접기'}).click();
   await translated.getByText('원문 텍스트 보기',{exact:true}).click();
   assert.equal(await translated.locator('.feed-original-text').getAttribute('open'),'');
   assert.match(await translated.locator('.feed-original-text').textContent(),/AWS architecture guide/);
   assert.equal(await translated.getByRole('link',{name:'원문 읽기'}).getAttribute('href'),'https://example.com/english');
   const waiting=page.locator('.feed-card').nth(2);
   assert.match(await waiting.locator('.feed-translation-status').textContent(),/무료 번역 한도에 도달.*영어 원문 표시/);
   assert.ok(await waiting.locator('.feed-translation-status').evaluate(element=>element.getBoundingClientRect().bottom<=element.nextElementSibling.getBoundingClientRect().top));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if(process.env.FEED_CAPTURE_DIR){mkdirSync(process.env.FEED_CAPTURE_DIR,{recursive:true});await page.screenshot({path:process.env.FEED_CAPTURE_DIR+'/feed-translation-'+width+'.png',fullPage:true});}
   await page.getByRole('button',{name:/한국어 원문/}).click();
   assert.equal(await page.locator('.feed-card').count(),1);
   assert.match(await page.locator('.feed-card h3').textContent(),/AWS 아키텍처를 개선한 사례/);
   assert.equal(await page.getByRole('button',{name:/한국어 원문/}).getAttribute('aria-pressed'),'true');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if(process.env.FEED_CAPTURE_DIR){mkdirSync(process.env.FEED_CAPTURE_DIR,{recursive:true});await page.screenshot({path:process.env.FEED_CAPTURE_DIR+'/feed-language-'+width+'.png',fullPage:true});}
   await page.getByRole('button',{name:/^전체 3$/}).click();
   assert.equal(await page.locator('.feed-card').count(),3);
   assert.deepEqual(errors,[]);
   await page.close();
  }
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
