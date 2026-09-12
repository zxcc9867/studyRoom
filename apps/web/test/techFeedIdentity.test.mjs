import test from 'node:test';
import assert from 'node:assert/strict';
import { createTechFeedClient } from '../src/techFeed.mjs';

test('mutation pins verified token even if account changes during invocation',async()=>{
 let identity='owner', sent;
 const supabase={auth:{getSession:async()=>({data:{session:{user:{id:identity},access_token:`token-${identity}`}}})},functions:{invoke:async(_name,options)=>{
  identity='other'; sent=options.headers?.Authorization || `Bearer token-${identity}`;
  return {data:{ok:true},error:null};
 }}};
 await assert.rejects(createTechFeedClient(supabase,'owner')('timezone',{time_zone:'Asia/Tokyo'}),/로그인/);
 assert.equal(sent,'Bearer token-owner');
});
