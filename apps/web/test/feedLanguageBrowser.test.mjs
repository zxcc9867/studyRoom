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
 {id:'english',title:'AWS architecture guide',title_ko:'AWS 아키텍처 가이드',excerpt:'This article explains the production architecture in detail.',excerpt_ko:'운영 아키텍처를 설명합니다.',translation_status:'ready',url:'https://example.com/english',published_at:'2026-09-23T00:00:00Z',discovered_at:'2026-09-23T00:00:00Z',sources:[],summary_status:'pending',summary:null,category:null,interests:[],saved:false,todo_id:null,origin:'web_search',matched_topics:[]},
 {id:'korean',title:'AWS 아키텍처를 개선한 사례',excerpt:'실제 서비스에서 적용한 아키텍처와 문제 해결 방법을 설명합니다.',translation_status:'pending',url:'https://example.com/korean',published_at:'2026-09-23T00:00:00Z',discovered_at:'2026-09-23T00:00:00Z',sources:[],summary_status:'pending',summary:null,category:null,interests:[],saved:false,todo_id:null,origin:'web_search',matched_topics:[]}
];
function App(){
 const [language,setLanguage]=React.useState('');
 const visible=articles.filter(item=>!language||feedOriginalLanguage(item.title,item.excerpt)===language);
 return <div className="tech-feed"><FeedViewFilters facets={{total:2,topics:[],sources:[],languages:[{value:'ko',label:'한국어 원문',count:1},{value:'en',label:'영어 원문',count:1}]}} topic="" source="" language={language} total={visible.length} busy={false} loading={false} error="" onTopic={()=>{}} onSource={()=>{}} onLanguage={setLanguage} onReset={()=>setLanguage('')} onRetry={()=>{}}/><div className="feed-list">{visible.map(article=><FeedArticleCard key={article.id} article={article} timeZone="Asia/Seoul" busy={false} onSave={()=>{}} onPlan={()=>{}}/>)}</div></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
`;

test('PC and 390px mobile show original-language tags and switch to Korean articles',{skip:!chromium&&'Optional browser runtime unavailable'},async()=>{
 const built=await build({stdin:{contents:fixture,resolveDir:fileURLToPath(new URL('.',import.meta.url)),sourcefile:'feed-language-fixture.tsx',loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'});
 const css=readFileSync(new URL('../src/techFeed.css',import.meta.url),'utf8').replace(/^@import[^;]+;/,'');
 const server=createServer((request,response)=>{response.setHeader('Content-Type',request.url==='/app.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8');response.end(request.url==='/app.js'?built.outputFiles[0].text:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:16px;background:#e4f1e9}'+css+'</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.FEED_BROWSER_EXECUTABLE||undefined});
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:'+server.address().port);
   page.setDefaultTimeout(3000);
   await page.waitForTimeout(150);
   assert.deepEqual(errors,[]);
   await page.waitForSelector('.feed-card');
   assert.equal(await page.locator('.feed-card').count(),2);
   assert.deepEqual(await page.locator('.feed-language-tag').allTextContents(),['# 영어 원문','# 한국어 원문']);
   await page.getByRole('button',{name:/한국어 원문/}).click();
   assert.equal(await page.locator('.feed-card').count(),1);
   assert.match(await page.locator('.feed-card h3').textContent(),/AWS 아키텍처를 개선한 사례/);
   assert.equal(await page.getByRole('button',{name:/한국어 원문/}).getAttribute('aria-pressed'),'true');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if(process.env.FEED_CAPTURE_DIR){mkdirSync(process.env.FEED_CAPTURE_DIR,{recursive:true});await page.screenshot({path:process.env.FEED_CAPTURE_DIR+'/feed-language-'+width+'.png',fullPage:true});}
   await page.getByRole('button',{name:/^전체 2$/}).click();
   assert.equal(await page.locator('.feed-card').count(),2);
   assert.deepEqual(errors,[]);
   await page.close();
  }
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
