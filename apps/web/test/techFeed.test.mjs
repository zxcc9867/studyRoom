import test from 'node:test';
import assert from 'node:assert/strict';
import { createTechFeedClient, mergeFeedPage, safeFeedUrl, summaryLabel, feedTodoDraft } from '../src/techFeed.mjs';

test('pagination preserves visible order and ignores overlapping IDs', () => {
  assert.deepEqual(mergeFeedPage([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }]), [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
});
test('original article links reject executable schemes and credentials', () => {
  assert.equal(safeFeedUrl('javascript:alert(1)'), null);
  assert.equal(safeFeedUrl('https://user:pass@example.com/a'), null);
  assert.equal(safeFeedUrl('https://example.com/a'), 'https://example.com/a');
});
test('summary labels never describe a source excerpt as an AI result', () => {
  assert.equal(summaryLabel({ summary_status: 'ready', summary: null }), '출처 소개');
  assert.equal(summaryLabel({ summary_status: 'pending', summary: null }), 'AI 요약 대기 · 출처 소개');
});
test('study action fills a plain untimed draft and preserves original article ID', () => {
  assert.deepEqual(feedTodoDraft({id:'a',title:'A new database'}, '2026-09-12'), {article_id:'a',title:'A new database 읽고 정리하기',local_date:'2026-09-12',start_time:null,end_time:null});
});
test('API verifies identity before sending a mutation', async () => {
  let invoked = false;
  const client = createTechFeedClient({auth:{getSession:async()=>({data:{session:{user:{id:'other'}}}})},functions:{invoke:async()=>{invoked=true;}}}, 'owner');
  await assert.rejects(client('save', {article_id:'a',saved:true}), /로그인/);
  assert.equal(invoked, false);
});
test('API discards responses after an account switch and sanitizes transport errors', async () => {
  let identity = 'owner';
  const supabase = {auth:{getSession:async()=>({data:{session:{user:{id:identity}}}})},functions:{invoke:async()=>{identity='other';return {data:{items:[]},error:null};}}};
  await assert.rejects(createTechFeedClient(supabase,'owner')('list'), /로그인/);
  identity='owner'; supabase.functions.invoke=async()=>({data:null,error:Error('token secret')});
  await assert.rejects(createTechFeedClient(supabase,'owner')('state'), e=>!e.message.includes('secret') && /연결/.test(e.message));
});
