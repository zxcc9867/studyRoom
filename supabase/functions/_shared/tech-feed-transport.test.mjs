import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {fetchFeed} from './tech-feed-core.mjs';
import {createPinnedTransport} from './tech-feed-transport.mjs';

function fixture({addresses=[{address:'93.184.216.34',family:4}],status=200,headers={},body='public',remote='93.184.216.34',authorized=true,route}={}) {
 const calls=[];
 const transport=createPinnedTransport({resolve:async()=>addresses,connect:(options)=>{
  calls.push(['tls',options]);const socket=new EventEmitter();socket.authorized=authorized;socket.remoteAddress=remote;socket.destroy=()=>{};
  queueMicrotask(()=>socket.emit('secureConnect'));return socket;
 },request:(url,options,callback)=>{
  const req=new EventEmitter();req.destroy=e=>{if(e)queueMicrotask(()=>req.emit('error',e));};req.end=()=>{
   options.agent.createConnection({},(error)=>{if(error)return req.destroy(error);calls.push(['request',url.href,options.headers]);
    const reply=route?route(url):{body,status,headers};
    const response=Readable.from([Buffer.from(reply.body||'')]);response.statusCode=reply.status;response.headers=reply.headers||{};callback(response);
   });
  };return req;
 }});return {transport,calls};
}
test('DNS private/mixed answers block before connection and cannot be bypassed by rebinding',async()=>{
 for(const addresses of [[{address:'127.0.0.1',family:4}],[{address:'8.8.8.8',family:4},{address:'10.0.0.1',family:4}],[]]){
  const f=fixture({addresses});await assert.rejects(f.transport('https://example.com/rss'));assert.equal(f.calls.length,0);
 }
 const f=fixture();const r=await f.transport('https://example.com/rss');assert.equal(r.text,'public');
 assert.equal(f.calls[0][1].host,'93.184.216.34');assert.equal(f.calls[0][1].servername,'example.com');assert.equal(f.calls[0][1].rejectUnauthorized,true);
 assert.equal(f.calls.filter(x=>x[0]==='request').length,1);
});
test('TLS mismatched peer or failed certificate cannot publish request',async()=>{
 for(const options of [{remote:'127.0.0.1'},{authorized:false}]){const f=fixture(options);await assert.rejects(f.transport('https://example.com/'));assert.equal(f.calls.filter(x=>x[0]==='request').length,0);}
});
test('redirect destination is independently revalidated and private target refused',async()=>{
 const f=fixture({status:302,headers:{location:'https://127.0.0.1/private'}});await assert.rejects(f.transport('https://example.com/rss'));
 assert.equal(f.calls.filter(x=>x[0]==='request').length,1);
});
test('bounded transport rejects compressed and oversized bodies and honors cancellation',async()=>{
 await assert.rejects(fixture({body:'x'.repeat(1024*1024+1)}).transport('https://example.com/'));
 await assert.rejects(fixture({headers:{'content-encoding':'gzip'}}).transport('https://example.com/'));
 const c=new AbortController();c.abort();const f=fixture();await assert.rejects(f.transport('https://example.com/',{signal:c.signal}));assert.equal(f.calls.length,0);
});

test('redirected 301 and 302 feeds resolve relative article URLs against the validated final endpoint',async()=>{
 for(const status of [301,302])for(const crossOrigin of [false,true]){
  const initial='https://redirect.example/feed.xml',final='https://'+(crossOrigin?'publisher.example':'redirect.example')+'/news/feed.xml';
  const source={url:initial,etag:'old',last_modified:'yesterday'};let returned;
  const f=fixture({route:url=>url.href===initial?{status,headers:{location:final}}:{status:200,body:'<rss><channel><title>Feed</title><item><title>New</title><link>posts/new</link></item></channel></rss>'}});
  const result=await fetchFeed(source,async(...args)=>{returned=await f.transport(...args);return returned;});
  assert.equal(result.items[0].url,new URL('posts/new',final).href);
  assert.equal(returned.url,final);assert.equal(source.url,initial);
  const requests=f.calls.filter(x=>x[0]==='request');assert.equal(requests.length,2);
  assert.equal(requests[0][2]['If-None-Match'],'old');
  assert.equal(requests[1][2]['If-None-Match'],crossOrigin?undefined:'old');
  assert.equal(requests[1][2]['If-Modified-Since'],crossOrigin?undefined:'yesterday');
  assert.equal(f.calls.filter(x=>x[0]==='tls').length,2);
 }
});
