import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {getDashboardSectionFromHash} from '../src/dashboardRoute.mjs';
const require=createRequire(import.meta.url), mod={exports:{}};
const bundle=await build({entryPoints:[new URL('../src/TechFeedSection.tsx',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'});
new Function('require','module','exports',bundle.outputFiles[0].text)(require,mod,mod.exports);
const article={id:'a',title:'새 도구 <script>alert(1)</script>',url:'https://example.com/post',published_at:'2026-09-12T00:00:00Z',discovered_at:'2026-09-12T01:00:00Z',sources:[{id:'s',name:'테스트 출처'}],summary_status:'pending',summary:null,excerpt:'이것은 출처 소개입니다.',category:null,interests:[],saved:false,todo_id:null};
const render=a=>renderToStaticMarkup(React.createElement(mod.exports.FeedArticleCard,{article:a,timeZone:'Asia/Seoul',busy:false,onSave(){},onPlan(){}}));
test('feed route is recognized without replacing default Today',()=>{assert.equal(getDashboardSectionFromHash('#feed'),'feed');assert.equal(getDashboardSectionFromHash(''),'today');});
test('article renders safe original link and escapes source markup',()=>{const html=render(article);assert.match(html,/noopener noreferrer/);assert.match(html,/href="https:\/\/example.com\/post"/);assert.doesNotMatch(html,/<script>/);assert.match(html,/출처 소개/);assert.doesNotMatch(render({...article,url:'javascript:alert(1)'}),/href=/);});
test('saved and linked cards convey persistent state without relying on color',()=>{const html=render({...article,saved:true,todo_id:'todo'});assert.match(html,/aria-pressed="true"/);assert.match(html,/할 일에 추가됨/);assert.match(html,/disabled=""/);});
test('ready summary previews the technology and offers expansion without showing the source excerpt',()=>{const html=render({...article,summary_status:'ready',summary:{technology:'기술 설명',change:'변화 설명',usage:'활용 설명'}});assert.match(html,/기술 설명/);assert.match(html,/AI 요약 펼치기/);assert.match(html,/aria-expanded="false"/);assert.doesNotMatch(html,/이것은 출처 소개입니다/);});

test('article hashtag distinguishes original language from a Korean translation',()=>{
 const english=render({...article,title:'AWS architecture guide',excerpt:'This article explains the architecture in production.',title_ko:'AWS 아키텍처 가이드',excerpt_ko:'운영 사례입니다.',translation_status:'ready'});
 assert.match(english,/# 영어 원문/);
 assert.match(english,/AWS 아키텍처 가이드/);
 assert.match(english,/DeepL 자동 번역/);
 const korean=render({...article,title:'AWS를 적용한 한국어 사례',excerpt:'실제 운영 사례와 구현 방법을 자세히 설명합니다.',title_ko:'다른 번역 제목',excerpt_ko:'다른 번역 소개',translation_status:'ready'});
 assert.match(korean,/# 한국어 원문/);
 assert.match(korean,/AWS를 적용한 한국어 사례/);
 assert.doesNotMatch(korean,/다른 번역 제목|DeepL 자동 번역|한국어 번역 대기/);
});
test('an old publication newly discovered in the feed labels both dates',()=>{
 const html=render({...article,published_at:'2020-01-01T00:00:00Z',discovered_at:'2026-09-23T15:00:00Z'});
 assert.match(html,/발견/);
 assert.match(html,/원문 발행/);
 assert.match(html,/dateTime="2026-09-23T15:00:00Z"/);
 assert.match(html,/dateTime="2020-01-01T00:00:00Z"/);
});
