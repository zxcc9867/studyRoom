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

Deno.test('response decoding does not rely on the optional global Buffer in hosted Edge',async()=>{
 const script=`
 import assert from 'node:assert/strict';
 import {EventEmitter} from 'node:events';
 import {Readable} from 'node:stream';
 import {createPinnedTransport} from './supabase/functions/_shared/tech-feed-transport.mjs';
 delete globalThis.Buffer;
 const transport=createPinnedTransport({
  resolve:async()=>[{address:'93.184.216.34',family:4}],
  connect:()=>{const socket=new EventEmitter();socket.authorized=true;socket.remoteAddress='93.184.216.34';socket.destroy=()=>{};queueMicrotask(()=>socket.emit('secureConnect'));return socket;},
  request:(_url,options,callback)=>{const req=new EventEmitter();req.destroy=()=>{};req.end=()=>options.agent.createConnection({},error=>{
   if(error){req.emit('error',error);return;}
   const response=Readable.from([new TextEncoder().encode('public metadata')]);response.statusCode=200;response.headers={'content-type':'text/html'};callback(response);
  });return req;}
 });
 const result=await transport('https://example.com/article');assert.equal(result.text,'public metadata');
 `;
 const output=await new Deno.Command(Deno.execPath(),{args:['eval','--no-config','--node-modules-dir=none',script],stdout:'piped',stderr:'piped'}).output();
 assert.equal(output.code,0,new TextDecoder().decode(output.stderr));
});
