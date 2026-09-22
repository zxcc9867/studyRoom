import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const bundle=await build({entryPoints:[new URL('../src/FeedDailyBriefing.tsx',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',jsx:'automatic',logLevel:'silent'}),mod={exports:{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
const data={local_date:'2026-09-21',time_zone:'Asia/Tokyo',total:12,source_count:3,categories:[],topics:[],eligible_count:8,analyzed_count:8,generated_at:'2026-09-21T03:00:00Z',status:'ready',stale:false,insights:[{title:'흐름',body:'오늘의 요약',study_angle:'공부 관점',sources:[]}],highlights:[{reason:'구체적인 장애 대응 사례',learning:'재시도 설계',source:{id:'a',title:'AWS 복구 사례',url:'https://example.com/a'}},{reason:'추가 추천',learning:'코드 확인',source:{id:'b',title:'도구 활용',url:'javascript:alert(1)'}}]};
function render(value){return renderToStaticMarkup(React.createElement(mod.exports.FeedBriefingContent,{data:value,busy:false,error:'',onGenerate(){},onReload(){}}));}
test('primary pick precedes themes and exposes reason, learning and safe original link',()=>{
 const html=render(data);assert.match(html,/오늘 하나만 읽는다면/);assert.match(html,/AWS 복구 사례/);assert.match(html,/구체적인 장애 대응 사례/);assert.match(html,/재시도 설계/);
 assert.ok(html.indexOf('AWS 복구 사례')<html.indexOf('오늘의 요약'));assert.match(html,/href="https:\/\/example.com\/a"/);assert.doesNotMatch(html,/href="javascript:/);
});
test('read failure clears highlights with insights rather than retaining unvalidated recommendations',()=>{
 const result=mod.exports.feedBriefingAfterError(data);assert.deepEqual(result.highlights,[]);assert.doesNotMatch(render(result),/AWS 복구 사례/);
});
test('empty picks explicitly avoid claiming an essential read',()=>{
 const html=render({...data,highlights:[]});assert.match(html,/추천할 만큼 근거가 충분한 글이 없어요/);assert.doesNotMatch(html,/오늘 하나만 읽는다면/);
});

test('generation action explains that the same request provides both summary and recommendations',()=>{
 const html=render({...data,status:'idle',insights:[],highlights:[]});
 assert.match(html,/오늘 요약·추천 보기/);assert.match(html,/최대 3개/);
});
