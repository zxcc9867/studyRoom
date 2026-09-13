import test from 'node:test';
import assert from 'node:assert/strict';
import {focusedSearchQuery} from './tech-feed-query.mjs';
import {createTavilySearch} from './tech-feed-search.mjs';

test('arbitrary interests rotate through blogs, case studies and guides, not a fixed vendor list',()=>{
 const queries=Array.from({length:6},(_,cursor)=>focusedSearchQuery('Rust, 네트워크',cursor));
 assert.deepEqual(queries,[
  'Rust engineering blog 기술 블로그','네트워크 engineering blog 기술 블로그',
  'Rust engineering case study architecture','네트워크 engineering case study architecture',
  'Rust technical guide tutorial best practices','네트워크 technical guide tutorial best practices',
 ]);
 assert.match(focusedSearchQuery('분산 시스템',3),/^분산 시스템 /);
 assert.ok(Array.from(focusedSearchQuery('가'.repeat(300),0)).length<=300);
});

test('search excludes video and listing pages and keeps dated evergreen blog text without extra calls',async()=>{
 let calls=0,body;
 const search=createTavilySearch({env:{TAVILY_API_KEY:'test'},fetchImpl:async(url,options)=>{
  calls++;body=JSON.parse(options.body);
  return Response.json({results:[
   {title:'Video',url:'https://www.youtube.com/watch?v=abc',content:'00:00:00 Intro 00:01:04 Guest'},
   {title:'All posts',url:'https://engineering.example.com/blog/',content:'Our latest posts'},
   {title:'Rust service design',url:'https://engineering.example.com/blog/rust-service',published_date:'2025-11-10',content:'Subscribe to our newsletter. We describe how a Rust service handles retries. Follow us on social media.'},
   {title:'Networking guide',url:'https://example.org/networking/timeouts',content:'Set the deadline to 00:00:30 when testing the timeout.'},
  ]});
 }});
 const items=await search.search('Rust engineering blog');
 assert.equal(calls,1);
 assert.deepEqual(items.map(item=>item.title),['Rust service design','Networking guide']);
 assert.equal(items[0].excerpt,'We describe how a Rust service handles retries.');
 assert.equal(items[0].published_at,'2025-11-10T00:00:00.000Z');
 assert.equal(items[1].excerpt,'Set the deadline to 00:00:30 when testing the timeout.');
 assert.equal(body.time_range,'year');
 assert.equal(body.include_published_date,true);
 assert.ok(body.exclude_domains.includes('youtube.com'));
 assert.equal(body.search_depth,'basic');assert.equal(body.auto_parameters,false);
 assert.equal(body.include_raw_content,false);
});

test('timestamp chapter lists are not presented as article content; useful surrounding paragraphs survive',async()=>{
 const search=createTavilySearch({env:{TAVILY_API_KEY:'test'},fetchImpl:async()=>Response.json({results:[
  {title:'Notes',url:'https://example.org/notes/service',content:'This article explains backpressure. 00:00:00 - Introduction 00:01:04 - Guest speaker 00:03:54 - Demo [...] Queues absorb short traffic bursts.'},
  {title:'Chapters only',url:'https://example.org/notes/video',content:'00:00:00 - Intro 00:01:04 - Guest'},
 ]})});
 const items=await search.search('backpressure');
 assert.equal(items[0].excerpt,'This article explains backpressure. Queues absorb short traffic bursts.');
 assert.equal(items[1].excerpt,'');
});

test('query permalinks remain articles, but a bare blog homepage is not collected',async()=>{
 const search=createTavilySearch({env:{TAVILY_API_KEY:'test'},fetchImpl:async()=>Response.json({results:[
  {title:'Company incident analysis',url:'https://blog.example.com/?p=123',content:'Connection pools caused the incident.'},
  {title:'Home',url:'https://blog.example.com/',content:'All posts'},
 ]})});
 const items=await search.search('connection pools');
 assert.deepEqual(items.map(item=>item.url),['https://blog.example.com/?p=123']);
});

test('technical incident timelines and ordinary text after chapter boundaries are preserved',async()=>{
 const {cleanFeedIntroduction}=await import('../../../packages/core/src/feedContent.mjs');
 const timeline='Incident timeline: 12:00 - Requests fail. 12:05 - Rollback complete. Root cause was pool exhaustion.';
 assert.equal(cleanFeedIntroduction(timeline),timeline);
 const zeroTimeline='00:00 - Requests fail. 00:05 - Rollback complete. Root cause was pool exhaustion.';
 assert.equal(cleanFeedIntroduction(zeroTimeline),zeroTimeline);
 assert.equal(cleanFeedIntroduction('00:00:00 - Intro\n00:01:04 - Demo\n\nQueues absorb short traffic bursts.'),'Queues absorb short traffic bursts.');
 assert.match(cleanFeedIntroduction('00:00:00 - Intro 00:01:04 - Demo Queues absorb short traffic bursts.'),/Queues absorb short traffic bursts/);
});

test('collection preserves paragraph boundaries before removing promotional text and HTML',async()=>{
 for(const content of [
  'Subscribe to our newsletter\n\nRust retries are bounded. Queues absorb short traffic bursts.',
  '<script>bad\ncontent()</script><p>Subscribe to our newsletter</p><p>Rust retries are bounded. Queues absorb short traffic bursts.</p>',
 ]){
  const search=createTavilySearch({env:{TAVILY_API_KEY:'test'},fetchImpl:async()=>Response.json({results:[{title:'Retries',url:'https://example.com/retries',content}]})});
  const [item]=await search.search('Rust');
  assert.equal(item.excerpt,'Rust retries are bounded. Queues absorb short traffic bursts.');
 }
});
