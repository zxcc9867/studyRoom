import assert from 'node:assert/strict';
import {Agent,request} from 'node:https';
import {handler as workerHandler} from '../tech-feed-worker/index.ts';
import {handler as apiHandler} from '../tech-feed/index.ts';

Deno.test('Deno HTTPS honors custom connection gate before any HTTP request or DNS',async()=>{
 const agent=new Agent({keepAlive:false});let calls=0;
 agent.createConnection=(_options,callback)=>{calls++;if(!callback)throw Error('PIN_GATE');callback(Error('PIN_GATE'),undefined as any);return undefined as any;};
 try{
  await assert.rejects(new Promise((resolve,reject)=>{const req=request('https://must-not-resolve.invalid',{agent},resolve);req.on('error',reject);req.end();}),/PIN_GATE/);
  assert.equal(calls,1);
 }finally{agent.destroy();}
});
Deno.test('real Edge entrypoints deny unsupported methods and unauthenticated worker without network',async()=>{
 assert.equal((await apiHandler(new Request('https://local.example/',{method:'GET'}))).status,405);
 assert.equal((await workerHandler(new Request('https://local.example/',{method:'POST'}))).status,401);
});
