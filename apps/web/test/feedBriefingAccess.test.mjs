import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const bundle=await build({entryPoints:[new URL('../src/FeedDailyBriefing.tsx',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',jsx:'automatic',logLevel:'silent'});
const mod={exports:{}};
new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);

test('a failed cache revalidation hides previously cited content while retaining observed statistics',()=>{
 assert.equal(typeof mod.exports.feedBriefingAfterError,'function');
 const previous={local_date:'2026-09-14',time_zone:'Asia/Tokyo',total:32,source_count:3,categories:[],topics:[],eligible_count:29,analyzed_count:24,generated_at:'2026-09-14T04:00:00Z',status:'ready',stale:false,insights:[{title:'PRIVATE_CACHED_TITLE',body:'PRIVATE_CACHED_BODY',study_angle:'study',sources:[{id:'a',title:'PRIVATE_CACHED_SOURCE',url:'https://example.com/revoked'}]}]};
 const result=mod.exports.feedBriefingAfterError(previous);
 assert.equal(result.total,32);assert.equal(result.source_count,3);
 assert.deepEqual(result.insights,[]);assert.equal(result.analyzed_count,0);assert.equal(result.generated_at,null);
 const html=renderToStaticMarkup(React.createElement(mod.exports.FeedBriefingContent,{data:result,busy:false,error:'다시 확인해 주세요.',onGenerate(){},onReload(){}}));
 assert.match(html,/수집된 글/);assert.match(html,/32/);assert.match(html,/브리핑 상태 다시 확인/);
 assert.doesNotMatch(html,/PRIVATE_CACHED|example.com\/revoked|24건 분석/);
 assert.equal(mod.exports.feedBriefingAfterError(null),null);
 assert.equal(previous.insights.length,1);
});

test('failed access revalidation discards obsolete provider cooldown and requires state refresh first',()=>{
 const previous={local_date:'2026-10-10',time_zone:'Asia/Seoul',total:5,source_count:2,categories:[],topics:[],eligible_count:5,analyzed_count:0,generated_at:null,status:'unavailable',stale:false,insights:[],failure_reason:'provider_unavailable',can_retry:true,retry_at:'2026-10-10T01:01:00Z'};
 const result=mod.exports.feedBriefingAfterError(previous);
 assert.equal(result.failure_reason,'unknown');assert.equal(result.retry_at,null);assert.equal(result.can_retry,false);
 assert.equal(mod.exports.feedBriefingRetryState(result).canGenerate,false);
 assert.equal(previous.failure_reason,'provider_unavailable');assert.equal(previous.can_retry,true);
 const html=renderToStaticMarkup(React.createElement(mod.exports.FeedBriefingContent,{data:result,busy:false,error:'다시 확인해 주세요.',onGenerate(){},onReload(){}}));
 assert.match(html,/상태를 다시 확인해 주세요/);assert.match(html,/브리핑 상태 다시 확인/);assert.doesNotMatch(html,/OpenRouter|요약 다시 시도/);
});
