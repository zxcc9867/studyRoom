import test from 'node:test';
import assert from 'node:assert/strict';
import {extractArticleMedia,runMediaWorker} from './tech-feed-media.mjs';
test('original metadata provides the first representative image and allowlisted video',()=>{
 const result=extractArticleMedia(`<html><head><meta property="og:image" content="/cover.png?a=1&amp;b=2"><meta property="og:image" content="/other.png"><meta property="og:video" content="https://www.youtube.com/embed/M7lc1UVf-VE"></head></html>`,'https://blog.example.com/post');
 assert.equal(result.image_url,'https://blog.example.com/cover.png?a=1&b=2');assert.equal(result.video.id,'M7lc1UVf-VE');
});
test('Twitter fallback, embedded video and metadata restrictions are conservative',()=>{
 assert.equal(extractArticleMedia('<meta name="twitter:image" content="https://cdn.example.com/a.png">','https://example.com/post').image_url,'https://cdn.example.com/a.png');
 assert.equal(extractArticleMedia('<iframe src="https://player.vimeo.com/video/123456"></iframe>','https://example.com/post').video.id,'123456');
 for(const html of ['<script>"<meta property=og:image content=https://evil.example/x>"</script>','<meta name=robots content=noimageindex><meta property=og:image content=https://example.com/a.png>','<meta property=og:image content=http://127.0.0.1/a>'])assert.equal(extractArticleMedia(html,'https://example.com/post').image_url,null);
 assert.equal(extractArticleMedia('<iframe src="https://evil.example/x"></iframe>','https://example.com/post').video,null);
});
test('bounded metadata worker isolates failures and rechecks recipient before network access',async()=>{
 let fetched=0;const finished=[];
 const store={claimMedia:async()=>[1,2,3,4].map(id=>({id,lease:'lease',url:'https://example.com/'+id})),mediaAllowed:async id=>id!==2,finishMedia:async(...args)=>{finished.push(args);return true;}};
 const result=await runMediaWorker({store,pilotIds:['owner'],transport:async()=>{fetched++;if(fetched===2)throw Error('blocked');return{status:200,url:'https://example.com/post',headers:{'content-type':'text/html'},text:'<meta property="og:image" content="/cover.png">'};}});
 assert.equal(fetched,2);assert.equal(finished.length,3);assert.equal(result.ready,1);assert.equal(result.failed,1);
 assert.equal(finished.find(x=>x[0]===2)[3],'deferred');
});
test('non-HTML and aborted workers do not fabricate media',async()=>{
 let calls=0;const store={claimMedia:async()=>{calls++;return[];}};
 await runMediaWorker({store,pilotIds:['owner'],signal:AbortSignal.abort(),transport:async()=>{throw Error('unexpected');}});assert.equal(calls,0);
});

test('existing public video links need no full player-page fetch',async()=>{
 let calls=0;let saved;
 const store={claimMedia:async()=>[{id:'old-video',lease:'lease',url:'https://www.youtube.com/watch?v=zJu6_0j9X3Y'}],mediaAllowed:async()=>true,finishMedia:async(_id,_lease,media)=>{saved=media;return true;}};
 const result=await runMediaWorker({store,pilotIds:['owner'],transport:async()=>{calls++;throw Error('player page rejects crawlers');}});
 assert.equal(calls,0);assert.equal(result.ready,1);assert.deepEqual(saved.video,{provider:'youtube',id:'zJu6_0j9X3Y'});
});
