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
