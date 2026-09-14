import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTechFeedClient} from '../src/techFeed.mjs';

const entry=new URL('../src/FeedDailyBriefing.tsx',import.meta.url),mod={exports:{}};
if(existsSync(entry)){
 const bundle=await build({entryPoints:[entry.pathname.replace(/^\/(\w:)/,'$1')],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',jsx:'automatic',logLevel:'silent'});
 new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
}
const data={local_date:'2026-09-14',time_zone:'Asia/Tokyo',total:32,source_count:3,categories:[{value:'unknown',label:'분류 근거 부족',count:2}],topics:[{value:'Rust',label:'Rust',count:12}],eligible_count:29,analyzed_count:24,generated_at:'2026-09-14T04:00:00Z',status:'ready',stale:true,insights:[{title:'Rust 실무',body:'실제 소개의 경향',study_angle:'작은 예제로 확인',sources:[{id:'a',title:'원문 근거',url:'https://example.com/article'},{id:'b',title:'잘못된 링크',url:'javascript:alert(1)'}]}]};
test('daily briefing displays truthful sample totals, stale cache time and safe server citations',()=>{
 assert.equal(typeof mod.exports.FeedBriefingContent,'function');
 const html=renderToStaticMarkup(React.createElement(mod.exports.FeedBriefingContent,{data,busy:false,error:'',onGenerate(){},onReload(){}}));
 assert.match(html,/오늘 수집된 내 피드/);assert.match(html,/최초 수집 시각 기준/);
 assert.match(html,/전체 32건 중 소개가 충분한 24건 분석/);assert.match(html,/분류 근거 부족/);
 assert.match(html,/요약 갱신/);assert.match(html,/2026-09-14T04:00:00Z/);assert.match(html,/원문 근거/);
 assert.doesNotMatch(html,/<script|href="javascript:/);
});
test('quota and paused states retain valid insights without hiding feed controls',()=>{
 assert.equal(typeof mod.exports.FeedBriefingContent,'function');
 for(const status of ['quota_exhausted','paused','insufficient','unavailable','generating']){
  const html=renderToStaticMarkup(React.createElement(mod.exports.FeedBriefingContent,{data:{...data,status},busy:false,error:'',onGenerate(){},onReload(){}}));
  assert.match(html,/실제 소개의 경향/);assert.match(html,/role="status"/);
  if(status==='paused')assert.match(html,/중지/);
  if(status==='quota_exhausted')assert.match(html,/한도/);
 }
});
test('briefing generate gets a bounded 35-second transport deadline without changing other action deadlines',async()=>{
 const original=AbortSignal.timeout,deadlines=[];
 AbortSignal.timeout=ms=>{deadlines.push(ms);return original(ms);};
 try{
  const supabase={auth:{getSession:async()=>({data:{session:{user:{id:'owner'},access_token:'synthetic'}},error:null})},functions:{invoke:async()=>({data:{ok:true},error:null})}};
  const api=createTechFeedClient(supabase,'owner');
  await api('briefing_generate');await api('briefing');await api('list');await api('refresh');
  assert.deepEqual(deadlines,[35000,20000,20000,60000]);
 }finally{AbortSignal.timeout=original;}
});

test('date boundary schedules local midnight across normal and 25-hour DST days',()=>{
 assert.equal(typeof mod.exports.feedLocalDate,'function');
 assert.equal(mod.exports.feedLocalDate(new Date('2026-09-14T15:01:00Z'),'Asia/Tokyo'),'2026-09-15');
 assert.equal(mod.exports.feedLocalDate(new Date('2026-09-14T15:01:00Z'),'America/Los_Angeles'),'2026-09-14');
 const japan=mod.exports.nextFeedDayDelay(new Date('2026-09-14T14:59:00Z'),'Asia/Tokyo');
 assert.ok(japan>=60000&&japan<=61100);
 const dst=mod.exports.nextFeedDayDelay(new Date('2026-11-01T07:00:00Z'),'America/Los_Angeles');
 assert.ok(dst>=25*60*60*1000&&dst<=25*60*60*1000+1100);
});

test('failed initial stats announce failure rather than a permanent loading state',()=>{
 const html=renderToStaticMarkup(React.createElement(mod.exports.FeedBriefingContent,{data:null,busy:false,error:'연결 실패',onGenerate(){},onReload(){}}));
 assert.match(html,/통계를 확인하지 못했어요/);assert.match(html,/브리핑 상태 다시 확인/);
 assert.doesNotMatch(html,/통계를 불러오고 있어요/);
});
