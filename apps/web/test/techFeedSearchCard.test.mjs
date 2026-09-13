import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const require=createRequire(import.meta.url), mod={exports:{}};
const bundle=await build({
  entryPoints:[new URL('../src/TechFeedSection.tsx',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')],
  bundle:true,write:false,format:'cjs',platform:'node',packages:'external',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent',
});
new Function('require','module','exports',bundle.outputFiles[0].text)(require,mod,mod.exports);

const article={
  id:'search-result',title:'PostgreSQL query planning',url:'https://engineering.example.com/postgres/plans',
  published_at:null,discovered_at:'2026-09-12T01:00:00Z',sources:[],summary_status:'pending',summary:null,
  excerpt:'This is the provider result snippet.',excerpt_provenance:'search_snippet',origin:'web_search',
  matched_topics:['PostgreSQL 성능'],category:null,interests:['backend'],saved:false,todo_id:null,
};
const render=value=>renderToStaticMarkup(React.createElement(mod.exports.FeedArticleCard,{
  article:value,timeZone:'Asia/Seoul',busy:false,onSave(){},onPlan(){},
}));

test('web-search card identifies search-result evidence and the original host',()=>{
  const html=render(article);
  assert.match(html,/웹 검색/);
  assert.match(html,/engineering\.example\.com/);
  assert.match(html,/검색 결과 소개/);
  assert.match(html,/발견/);
  assert.doesNotMatch(html,/원문 발췌/);
});

test('actual AI summary remains labelled as AI rather than a search introduction',()=>{
  const html=render({...article,summary_status:'ready',summary:{technology:'데이터베이스 기술',change:'플래너 변경',usage:'쿼리 점검'}});
  assert.match(html,/AI 요약 · 원문 확인 권장/);
  assert.match(html,/데이터베이스 기술/);
  assert.doesNotMatch(html,/AI가 작성한 원문/);
});
test('ready Korean translation is default and original text stays in a collapsed disclosure',()=>{
 const html=render({...article,translation_status:'ready',title_ko:'PostgreSQL 쿼리 계획',excerpt_ko:'검색 결과의 한국어 소개입니다.'});
 assert.match(html,/<h3>PostgreSQL 쿼리 계획<\/h3>/);assert.match(html,/검색 결과의 한국어 소개입니다/);
 assert.match(html,/<details[^>]*><summary>원문 텍스트 보기<\/summary>/);assert.match(html,/PostgreSQL query planning/);
 assert.match(html,/DeepL 자동 번역/);assert.doesNotMatch(html,/<details[^>]* open/);
});
test('failed or pending translations preserve English originals without claiming translation',()=>{
 for(const translation_status of ['pending','failed']){const html=render({...article,translation_status,title_ko:'stale',excerpt_ko:'stale'});assert.match(html,/<h3>PostgreSQL query planning<\/h3>/);assert.doesNotMatch(html,/stale/);assert.match(html,/번역.*대기/);}
});
test('translation output is escaped and cannot replace the original URL',()=>{
 const html=render({...article,translation_status:'ready',title_ko:'번역 <script>bad</script>',excerpt_ko:'<img src=x onerror=bad>'});
 assert.doesNotMatch(html,/<script>|<img /);assert.match(html,/engineering.example.com\/postgres\/plans/);
});

test('long introductions expose an accessible expansion control, not a silent line clamp',()=>{
 const html=render({...article,excerpt:'Long introduction '.repeat(40)});
 assert.match(html,/aria-expanded="false"/);
 assert.match(html,/내용 더 보기/);
});
test('pagination marks the current page and disables the unavailable next page',()=>{
 assert.equal(typeof mod.exports.FeedPagination,'function');
 const html=renderToStaticMarkup(React.createElement(mod.exports.FeedPagination,{
  page:2,numbers:[1,2],hasNext:false,busy:false,onPage(){},
 }));
 assert.match(html,/aria-label="피드 페이지"/);
 assert.match(html,/aria-current="page"/);
 assert.match(html,/<button[^>]*disabled[^>]*aria-label="다음 페이지"/);
});
