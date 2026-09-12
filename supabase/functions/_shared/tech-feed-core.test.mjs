import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, publicIp, parseFeed, parseHn, validateSummary, summarizeBatch, fetchFeed, mapArticle, initialItems, pilotEnabled } from './tech-feed-core.mjs';

test('URL validation rejects credentials, private targets, token queries and non-HTTPS', () => {
  for (const url of ['http://example.com/rss','https://u:p@example.com/rss','https://127.1/rss','https://[::1]/','https://example.com/?token=a','https://localhost/','https://example.com:444/']) assert.throws(()=>normalizeUrl(url));
  assert.equal(normalizeUrl('https://EXAMPLE.com/rss?utm_source=x#fragment'),'https://example.com/rss');
});
test('public IP classifier fails closed on private, special and mapped IPv6 addresses', () => {
  for (const ip of ['127.0.0.1','10.1.2.3','169.254.169.254','100.64.0.1','192.0.2.1','198.18.0.1','224.0.0.1','::1','::ffff:8.8.8.8','2001:db8::1','fc00::1','garbage']) assert.equal(publicIp(ip),false,ip);
  assert.equal(publicIp('8.8.8.8'),true); assert.equal(publicIp('2606:4700:4700::1111'),true);
});
test('real RSS/Atom parser handles CDATA, entities, namespaces, relative links and unsafe HTML', () => {
  const rss=parseFeed('<rss version="2.0"><channel><title>A &amp; B</title><item><guid>x</guid><title><![CDATA[One > Two]]></title><link>https://example.com/a?utm_source=x</link><description><![CDATA[<p>Hello <b>world</b></p><script>steal()</script>]]></description><pubDate>Fri, 11 Sep 2026 10:00:00 GMT</pubDate></item></channel></rss>','https://example.com/rss');
  assert.equal(rss.name,'A & B'); assert.equal(rss.items[0].title,'One > Two'); assert.equal(rss.items[0].excerpt,'Hello world'); assert.equal(rss.items[0].published_at,'2026-09-11T10:00:00.000Z');
  const atom=parseFeed('<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom</title><entry><id>id-1</id><title>Nested</title><link rel="self" href="/api"/><link rel="alternate" href="/post"/><summary type="html">Safe &amp; useful</summary></entry></feed>','https://example.com/feed');
  assert.equal(atom.items[0].url,'https://example.com/post'); assert.equal(atom.items[0].published_at,null);
  for(const xml of ['<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>','<rss><channel></rss>','<html>not a feed</html>']) assert.throws(()=>parseFeed(xml,'https://example.com/'));
});
test('HN adapter rejects deleted/unsafe stories and keeps provider dates and excerpt provenance', () => {
  assert.equal(parseHn({id:2,deleted:true}),null);
  const item=parseHn({id:42,type:'story',title:'Ask HN',text:'<p>Useful text</p>',time:1726000000});
  assert.equal(item.url,'https://news.ycombinator.com/item?id=42'); assert.equal(item.guid,'hn:42'); assert.equal(item.excerpt,'Useful text');
});
test('initial import keeps at most fifty recent dated articles without redating old content',()=>{
  const rows=[{published_at:null},{published_at:'2020-01-01T00:00:00Z'},...Array.from({length:60},()=>({published_at:'2026-09-11T00:00:00Z'}))];
  assert.equal(initialItems(rows,null,Date.parse('2026-09-12')).length,50);
  assert.equal(initialItems(rows,'2026-09-11',Date.parse('2026-09-12')).length,62);
});
test('conditional 304 skips parser and carries cache validators',async()=>{
  const result=await fetchFeed({url:'https://example.com/rss',etag:'abc',last_modified:'yesterday'},async(url,options)=>{assert.equal(options.headers['If-None-Match'],'abc');return {status:304,headers:{},text:''};});
  assert.equal(result.notModified,true); assert.deepEqual(result.items,[]);
});
test('AI validates fields and preserves URLs; insufficient/quota/provider failure never fabricates summary',async()=>{
  assert.equal(validateSummary('{broken'),null);
  assert.equal(validateSummary({technology:'a',change:'b',usage:'c',url:'https://evil.test'}),null);
  let calls=0;
  const rows=[{id:'one',excerpt:'short',permission_status:'approved'},{id:'two',excerpt:'x'.repeat(240),permission_status:'pending'}];
  assert.deepEqual((await summarizeBatch(rows,async()=>{calls++;return null;})).map(x=>x.summary_status),['insufficient','pending']); assert.equal(calls,0);
  const valid=[{id:'three',excerpt:'x'.repeat(240),permission_status:'approved'}];
  assert.equal((await summarizeBatch(valid,async()=>null))[0].summary_status,'failed');
  assert.equal((await summarizeBatch(valid,async()=>{throw Error('quota')}))[0].summary_status,'failed');
  assert.equal((await summarizeBatch(valid,async()=>({text:JSON.stringify({items:[{id:'three',technology:'기술',change:'변경',usage:'활용'}]})})))[0].summary_status,'ready');
});
test('wire article mapping returns only server-owned fields and pilot defaults off',()=>{
  const row={id:'a',title:'Title',url:'https://example.com/',discovered_at:'2026-09-12',source_rows:[{id:'s',name:'Source'}]};
  assert.deepEqual(mapArticle(row),{id:'a',title:'Title',url:'https://example.com/',published_at:null,discovered_at:'2026-09-12',excerpt:'',summary:null,summary_status:'pending',category:null,interests:[],sources:[{id:'s',name:'Source'}],saved:false,todo_id:null});
  assert.equal(pilotEnabled('u',{}),false); assert.equal(pilotEnabled('u',{TECH_FEED_ENABLED:'true',TECH_FEED_PILOT_USER_IDS:' u '}),true);
});

test('IPv6 transition spellings are never accepted as public destinations',()=>{
 for(const ip of ['2001::1','2001:0000::1','2001:0020::1','2001:0002::1','2001:0db8::1'])assert.equal(publicIp(ip),false,ip);
 assert.equal(publicIp('2001:4860:4860::8888'),true);
});

test('AI category is a separately validated enum and never contaminates the three-field summary DTO',async()=>{
 for(const category of ['news','practice','deep_dive','invalid',undefined]){
  const item={id:'category-test',technology:'기술',change:'변경',usage:'활용',...(category===undefined?{}:{category})};
  const [row]=await summarizeBatch([{id:item.id,title:'Article',excerpt:'x'.repeat(200),permission_status:'approved'}],async()=>({text:JSON.stringify({items:[item]})}));
  assert.equal(row.summary_status,'ready');
  assert.deepEqual(row.summary,{technology:'기술',change:'변경',usage:'활용'});
  assert.equal(row.category,['news','practice','deep_dive'].includes(category)?category:null);
 }
});

test('AI malformed item arrays fail normally and mixed arrays retain one valid matching summary',async()=>{
 const row={id:'safe',excerpt:'x'.repeat(200),permission_status:'approved'};
 const good={id:'safe',technology:'기술',change:'변경',usage:'활용',category:'practice'};
 for(const items of [[null],[null,false,42,'text',[],{}],[null,[],good,false]]){
  let calls=0;const [result]=await summarizeBatch([row],async()=>{calls++;return{text:JSON.stringify({items})};});
  assert.equal(calls,1);
  assert.equal(result.summary_status,items.includes(good)?'ready':'failed');
  assert.equal(result.category,items.includes(good)?'practice':null);
  assert.deepEqual(result.summary,items.includes(good)?{technology:'기술',change:'변경',usage:'활용'}:null);
 }
});
