import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as presentation from '../src/feedPresentation.mjs';

const require=createRequire(import.meta.url);
async function load(name){
 const entry=new URL('../src/'+name+'.tsx',import.meta.url);
 if(!existsSync(entry))return {};
 const bundle=await build({entryPoints:[entry.pathname.replace(/^\/(\w:)/,'$1')],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'});
 const mod={exports:{}};
 new Function('require','module','exports',bundle.outputFiles[0].text)(require,mod,mod.exports);
 return mod.exports;
}
const {FeedArticleCard}=await load('TechFeedSection');
const {FeedArticleText}=await load('FeedArticleText');
const {FeedViewFilters}=await load('FeedViewFilters');
const article={id:'a',title:'Rust tutorial',url:'https://example.com/article',published_at:null,discovered_at:'2026-09-14T00:00:00Z',sources:[],summary_status:'pending',summary:null,excerpt:'### Build\n\nUse **Rust** with `C#` examples.',category:null,interests:['backend'],matched_topics:['Rust 개발과 서비스 아키텍처에 대한 최신 소식을 찾아주세요'],saved:false,todo_id:null};
const render=(component,props)=>renderToStaticMarkup(React.createElement(component,props));

test('card cleans preview markers, uses rule category, and suppresses whole interest prompts',()=>{
 const html=render(FeedArticleCard,{article,timeZone:'Asia/Tokyo',busy:false,onSave(){},onPlan(){}});
 assert.match(html,/실무·튜토리얼/);
 assert.match(html,/Build Use Rust with C# examples/);
 assert.doesNotMatch(html,/###|\*\*Rust\*\*|미분류|소식을 찾아주세요/);
 const unknown=render(FeedArticleCard,{article:{...article,title:'A note',excerpt:'Just a note.'},timeZone:'Asia/Tokyo',busy:false,onSave(){},onPlan(){}});
 assert.doesNotMatch(unknown,/미분류|실무·튜토리얼/);
});

test('expanded text renders headings lists code and safe links while keeping HTML and media inert',()=>{
 assert.equal(typeof FeedArticleText,'function');
 const html=render(FeedArticleText,{text:'# Heading\n\nA **bold** and *soft* `x` [link](https://example.com/doc).\n\n- one\n- two\n\n```js\nconst x = "**literal**";\n```\n\n<script>bad()</script> ![alt](https://evil.test/image) [bad](javascript:alert)'});
 assert.match(html,/role="heading" aria-level="1"/);
 assert.match(html,/<strong>bold<\/strong>/);assert.match(html,/<em>soft<\/em>/);
 assert.match(html,/<ul><li>one<\/li><li>two<\/li><\/ul>/);
 assert.match(html,/<pre[^>]*tabindex="0"[^>]*><code[^>]*>const x =/);
 assert.match(html,/noopener noreferrer/);assert.match(html,/\*\*literal\*\*/);
 assert.doesNotMatch(html,/<script|<img|<iframe|href="javascript:/);
});

test('display policy preserves paragraphs and code spacing but removes promotion and chapter lists',()=>{
 assert.equal(typeof presentation.feedStructuredIntroduction,'function');
 assert.equal(presentation.feedStructuredIntroduction('# Title\n\n- first\n- second\n\n```js\n  const x = 1;\n```'),'# Title\n\n- first\n- second\n\n```js\n  const x = 1;\n```');
 assert.equal(presentation.feedStructuredIntroduction('Subscribe to our newsletter.\n\n# Rust\n\nUseful technical facts.\nFollow us on social media.'),'# Rust\n\nUseful technical facts.');
 const result=presentation.feedStructuredIntroduction('00:00 - Intro\n01:30 - Guests\n\n# Actual article\n\nTechnical facts.');
 assert.doesNotMatch(result,/00:00|01:30|Guests/);assert.match(result,/# Actual article\n\nTechnical facts/);
});

test('short structured text can expand and preview is cleaned before the 260 character limit',()=>{
 const view=presentation.feedExcerptView('### Intro\n\n**short**');
 assert.equal(view.preview,'Intro short');assert.equal(view.expandable,true);
 assert.equal(presentation.feedExcerptView('**'+ 'x'.repeat(260)+'**').preview,'x'.repeat(260));
});

test('collapsed dynamic filter renders a topic beyond page twenty, hosts and filtered total',()=>{
 assert.equal(typeof FeedViewFilters,'function');
 const html=render(FeedViewFilters,{facets:{total:32,topics:[{value:'Rust',label:'Rust',count:12}],sources:[{value:'host:engineering.example.com',label:'engineering.example.com',count:32}]},topic:'Rust',source:'',total:12,busy:false,loading:false,error:'',onTopic(){},onSource(){},onReset(){},onRetry(){}});
 assert.match(html,/모아둔 글 필터/);assert.match(html,/결과 12건/);assert.match(html,/<option value="Rust" selected="">Rust · 12/);
 assert.match(html,/host:engineering.example.com/);assert.match(html,/초기화/);
 assert.doesNotMatch(html,/<details[^>]* open|전체 분야|웹·프론트엔드/);
});
