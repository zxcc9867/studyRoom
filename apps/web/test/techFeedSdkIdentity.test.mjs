import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {createTechFeedClient} from '../src/techFeed.mjs';
test('real Supabase Functions transport uses the verified owner Authorization header',async()=>{
 let sessions=0,sent;
 const client=createClient('https://fixture.invalid','synthetic-public-key',{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:async(_url,init)=>{sent=new Headers(init.headers).get('authorization');return new Response('{"ok":true}',{headers:{'Content-Type':'application/json'}});}},
 });
 client.auth.getSession=async()=>({data:{session:{user:{id:++sessions===1?'owner':'other'},access_token:sessions===1?'owner-token':'other-token'}},error:null});
 await assert.rejects(createTechFeedClient(client,'owner')('timezone',{time_zone:'Asia/Tokyo'}),/로그인/);
 assert.equal(sent,'Bearer owner-token');
});
