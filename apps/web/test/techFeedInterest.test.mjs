import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {
  applyPreferenceResponse,
  createTechFeedClient,
  interestPromptResult,
  interestSavePayload,
  isRevisionConflict,
  receivingPayload,
  searchStatusLabel,
} from '../src/techFeed.mjs';

test('interest validation accepts a public topic and rejects private or malformed input', () => {
  assert.deepEqual(interestPromptResult('  AWS   Lambda  '), {prompt:'AWS Lambda',error:null});
  for (const value of [
    'a',
    'x'.repeat(301),
    'person@example.com',
    'https://example.com',
    'example.com/news',
    'sk-abcdefghijklmnopqrstuvwxyz123456',
    'AWS\nLambda',
    'Bearer abcdefghijklmnopqrstuvwxyz123456',
  ]) assert.ok(interestPromptResult(value).error, value);
});

test('search status distinguishes waiting, unavailable configuration, quota, and pause', () => {
  assert.equal(searchStatusLabel({state:'quota_exhausted'}), '웹 검색 무료 한도를 모두 사용했어요');
  assert.notEqual(searchStatusLabel({state:'not_configured'}), searchStatusLabel({state:'waiting'}));
  assert.notEqual(searchStatusLabel({state:'paused'}), searchStatusLabel({state:'unavailable'}));
});

test('interest and receiving actions carry the current revision and deliberate receiving state', () => {
  const preferences={prompt:'React 성능',receiving:false,revision:7};
  assert.deepEqual(interestSavePayload(preferences,'  PostgreSQL   성능  '), {
    prompt:'PostgreSQL 성능',receiving:true,expected_revision:7,
  });
  assert.deepEqual(receivingPayload(preferences,false), {receiving:false,expected_revision:7});
  assert.deepEqual(receivingPayload(preferences,true), {receiving:true,expected_revision:7});
});

test('matching settings response updates only preferences and search status', () => {
  const current={
    enabled:true,service_available:false,sources:[{id:'rss'}],interests:['cloud'],last_success_at:null,
    preferences:{prompt:'old',receiving:false,revision:2},search_status:{state:'paused',last_success_at:null},
  };
  const response={
    preferences:{prompt:'new topic',receiving:true,revision:3},
    search_status:{state:'not_configured',last_success_at:null},
  };
  assert.deepEqual(applyPreferenceResponse(current,response), {...current,...response});
});

test('HTTP 409 is exposed as a retryable revision conflict without leaking transport details', async () => {
  const supabase={
    auth:{getSession:async()=>({data:{session:{user:{id:'owner'},access_token:'synthetic-token'}},error:null})},
    functions:{invoke:async()=>({data:null,error:{context:{status:409},message:'database details'}})},
  };
  await assert.rejects(createTechFeedClient(supabase,'owner')('topics_save',{
    prompt:'PostgreSQL 성능',receiving:true,expected_revision:1,
  }), error => isRevisionConflict(error) && !error.message.includes('database'));
});

const require=createRequire(import.meta.url), mod={exports:{}};
const bundle=await build({
  entryPoints:[new URL('../src/FeedInterestSettings.tsx',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')],
  bundle:true,write:false,format:'cjs',platform:'node',packages:'external',jsx:'automatic',logLevel:'silent',
});
new Function('require','module','exports',bundle.outputFiles[0].text)(require,mod,mod.exports);

test('interest settings renders a labelled bounded input, consent notice, and usable controls while collection is unavailable', () => {
  const html=renderToStaticMarkup(React.createElement(mod.exports.FeedInterestSettings,{
    preferences:{prompt:'웹 접근성',receiving:true,revision:4},
    searchStatus:{state:'not_configured',last_success_at:null},
    serviceAvailable:false,draft:'웹 접근성',busy:false,conflict:false,
    onDraftChange(){},onSave(){},onReceivingChange(){},onRetry(){},
  }));
  assert.match(html,/관심 내용/);
  assert.match(html,/maxLength="300"/);
  assert.match(html,/개인정보나 비밀 정보/);
  assert.match(html,/검색 서비스/);
  assert.match(html,/웹 검색이 아직 연결되지 않았어요/);
  assert.match(html,/수신 잠시 멈추기/);
  assert.doesNotMatch(html,/disabled=""[^>]*name="feed-interest-prompt"/);
});

test('stale settings state keeps the typed draft visible and offers an explicit retry', () => {
  const html=renderToStaticMarkup(React.createElement(mod.exports.FeedInterestSettings,{
    preferences:{prompt:'서버의 최신 관심사',receiving:false,revision:9},
    searchStatus:{state:'paused',last_success_at:null},
    serviceAvailable:false,draft:'아직 저장하지 않은 React 관심사',busy:false,conflict:true,
    onDraftChange(){},onSave(){},onReceivingChange(){},onRetry(){},
  }));
  assert.match(html,/아직 저장하지 않은 React 관심사/);
  assert.match(html,/다른 곳에서 설정이 변경/);
  assert.match(html,/현재 내용으로 다시 저장/);
});
