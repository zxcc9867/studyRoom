import test from 'node:test';
import assert from 'node:assert/strict';
test('cancelling provider contention finalizes without reserving or calling search',async()=>{
 const {runManualRefresh}=await import('./tech-feed-refresh.mjs');const f=fixture(),controller=new AbortController();let claims=0;
 f.signal=controller.signal;f.store.claimManualSearch=async()=>{claims++;controller.abort();return{busy:true};};
 f.search.checkUsage=async()=>{throw Error('unexpected provider access');};
 const result=await runManualRefresh(f);assert.equal(result.search.state,'unavailable');assert.equal(claims,1);
 assert.equal(f.events.filter(x=>x[0]==='finish').length,1);assert.equal(f.events.some(x=>x[0]==='reserve'||x[0]==='search'),false);
});
test('provider failure backoff remains partial even when RSS succeeds',async()=>{
 const {runManualRefresh}=await import('./tech-feed-refresh.mjs');const f=fixture();const initial=f.store.state;
 f.store.state=async()=>({...await initial(),search_status:{state:'unavailable'}});f.store.claimManualSearch=async()=>null;
 const result=await runManualRefresh(f);assert.equal(result.state,'partial');assert.equal(result.search.state,'unavailable');
});
test('RSS success still waits for a shared search to complete',async()=>{
 const {runManualRefresh}=await import('./tech-feed-refresh.mjs');const f=fixture();f.store.claimManualSearch=async()=>null;f.store.refreshStatus=async()=>({state:'running'});
 assert.equal((await runManualRefresh(f)).state,'running');
});
test('provider mutex contention retries the claim without consuming a search attempt',async()=>{
 const {runManualRefresh}=await import('./tech-feed-refresh.mjs');const f=fixture();let claims=0;
 f.store.claimManualSearch=async()=>++claims===1?{busy:true}:{id:'topic',canonical:'aws lambda',lease:'search-lease'};
 const result=await runManualRefresh(f);assert.equal(result.state,'ready');assert.equal(claims,2);assert.equal(f.events.filter(x=>x[0]==='reserve').length,1);
});
const env={TECH_FEED_ENABLED:'true',TAVILY_API_KEY:'test-only',TECH_FEED_SEARCH_MONTHLY_CAP:'900'};
function fixture(){
 const events=[];const source={id:'source',url:'https://example.com/rss',kind:'rss',permission_status:'approved',lease:'source-lease'};
 const store={state:async()=>({preferences:{prompt:'AWS Lambda',receiving:true},sources:[{subscribed:true,permission_status:'approved'}]}),
 beginRefresh:async()=>({state:'started',lease:'refresh'}),refreshStatus:async()=>({state:'idle'}),finishRefresh:async(lease,result)=>{events.push(['finish',lease,result]);return true;},
 claimManualSources:async()=>[source],finishSource:async(id,lease,items)=>{events.push(['rss',items.length]);return true;},
 claimManualSearch:async()=>({id:'topic',canonical:'aws lambda',lease:'search-lease'}),reserveSearch:async(id,lease,cap)=>{events.push(['reserve',cap]);return true;},finishSearch:async(id,lease,items,error)=>{events.push(['search',items.length,error]);return true;}};
 const transport=async()=>({status:200,text:'<rss><channel><title>Public</title><item><title>AWS news</title><link>https://example.com/news</link></item></channel></rss>',headers:{}});
 const search={availability:()=> 'configured',checkUsage:async()=>{},search:async()=>[{title:'AWS news',url:'https://example.com/search',excerpt:'Public release details',published_at:null}]};
 return{store,transport,search,events,env,userId:'owner',expectedRevision:1};
}
test('manual execution reaches actual RSS/search pipeline and preserves shared monthly cap',async()=>{
 const {runManualRefresh}=await import('./tech-feed-refresh.mjs');const f=fixture();const result=await runManualRefresh(f);
 assert.equal(result.state,'ready');assert.equal(result.rss.collected,1);assert.equal(result.search.collected,1);
 assert.deepEqual(f.events.find(x=>x[0]==='reserve'),['reserve',900]);assert.equal(f.events.filter(x=>x[0]==='finish').length,1);
});
test('quota failure still collects RSS and finalizes request without paid retry',async()=>{
 const {runManualRefresh}=await import('./tech-feed-refresh.mjs');const f=fixture();f.search.checkUsage=async()=>{throw Error('quota_exhausted');};
 const result=await runManualRefresh(f);assert.equal(result.state,'partial');assert.equal(result.search.state,'quota_exhausted');assert.equal(result.rss.collected,1);assert.equal(f.events.some(x=>x[0]==='reserve'),false);
});
test('running and cooldown gates never claim new provider or source work',async()=>{
 const {runManualRefresh}=await import('./tech-feed-refresh.mjs');
 for(const state of ['running','cooldown']){const f=fixture();f.store.beginRefresh=async()=>({state,retry_after:120});const result=await runManualRefresh(f);assert.equal(result.state,state);assert.deepEqual(f.events,[]);}
});
test('missing search key allows eligible RSS but does not claim search work',async()=>{
 const {runManualRefresh}=await import('./tech-feed-refresh.mjs');const f=fixture();f.env={TECH_FEED_ENABLED:'true'};
 const result=await runManualRefresh(f);assert.equal(result.rss.collected,1);assert.equal(result.search.state,'not_configured');assert.equal(f.events.some(x=>x[0]==='reserve'),false);
});
