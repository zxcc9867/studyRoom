import test from 'node:test';
import assert from 'node:assert/strict';
const free={key:{usage:0,limit:1000},account:{current_plan:'Researcher',plan_usage:0,plan_limit:1000,paygo_usage:0,paygo_limit:0}};
const response=x=>Response.json(x);
test('missing search key makes no request',async()=>{
 const {createTavilySearch}=await import('./tech-feed-search.mjs');let calls=0;
 const search=createTavilySearch({env:{},fetchImpl:async()=>{calls++;}});
 assert.equal(search.availability(),'not_configured');await assert.rejects(search.search('AWS Lambda'),/not_configured/);assert.equal(calls,0);
});
test('free account validation fails closed for unknown, missing, paid, paygo and exhausted usage',async()=>{
 const {createTavilySearch}=await import('./tech-feed-search.mjs');
 for(const payload of [{}, {...free,account:{...free.account,current_plan:'Pro'}},{...free,account:{...free.account,paygo_limit:1}},{...free,account:{...free.account,plan_limit:1001}},{...free,key:{usage:0}},{...free,key:{usage:1000,limit:1000}},{...free,account:{...free.account,plan_usage:-1}}]){
  let posts=0;const search=createTavilySearch({env:{TAVILY_API_KEY:'synthetic'},fetchImpl:async(url,init)=>{if(init.method==='POST')posts++;return response(payload);}});
  await assert.rejects(search.checkUsage(),/unavailable|quota_exhausted/);assert.equal(posts,0);
 }
});
test('search payload is fixed basic and results are sanitized without fetching pages',async()=>{
 const {createTavilySearch}=await import('./tech-feed-search.mjs');const requests=[];
 const search=createTavilySearch({env:{TAVILY_API_KEY:'synthetic',TAVILY_SEARCH_DEPTH:'advanced',TAVILY_BASE_URL:'https://bad.invalid'},fetchImpl:async(url,init)=>{
  requests.push({url,init});return response({results:[{title:'<b>AWS</b>',url:'https://example.com/a?utm_source=x',content:'<script>bad()</script>Real snippet',published_date:'2999-01-01'},{title:'Duplicate',url:'https://example.com/a',content:'x'},{title:'Private',url:'https://127.0.0.1/a'},{title:{bad:true},url:'https://example.org/a'}]});
 }});
 const items=await search.search('AWS Lambda');assert.equal(items.length,1);assert.equal(items[0].url,'https://example.com/a');assert.equal(items[0].excerpt,'Real snippet');assert.equal(items[0].published_at,null);assert.equal(items[0].excerpt_provenance,'search_snippet');
 assert.equal(requests.length,1);assert.equal(requests[0].url,'https://api.tavily.com/search');assert.equal(requests[0].init.redirect,'error');
 assert.deepEqual(JSON.parse(requests[0].init.body),{query:'AWS Lambda',search_depth:'basic',auto_parameters:false,include_answer:false,include_raw_content:false,include_images:false,include_usage:true,max_results:5,topic:'general',time_range:'week'});
});
test('usage and search reject rate limits, malformed/oversized bodies and aborts',async()=>{
 const {createTavilySearch}=await import('./tech-feed-search.mjs');
 for(const factory of [()=>new Response('',{status:429}),()=>new Response('',{status:432}),()=>new Response('',{status:433}),()=>new Response('bad json'),()=>new Response('x'.repeat(1048577)),()=>response({results:{}})]){
  const search=createTavilySearch({env:{TAVILY_API_KEY:'synthetic'},fetchImpl:async()=>factory()});await assert.rejects(search.search('AWS Lambda'),/unavailable|quota_exhausted/);
 }
 const search=createTavilySearch({env:{TAVILY_API_KEY:'synthetic'},fetchImpl:async(_,init)=>{assert.ok(init.signal);init.signal.throwIfAborted();}});
 await assert.rejects(search.search('AWS Lambda',AbortSignal.abort()),/unavailable/);
});


test('less than one remaining credit is exhausted and provider request has a 15-second deadline',async()=>{
 const {createTavilySearch}=await import('./tech-feed-search.mjs');
 const partial=createTavilySearch({env:{TAVILY_API_KEY:'synthetic'},fetchImpl:async()=>response({...free,key:{usage:999.5,limit:1000}})});
 await assert.rejects(partial.checkUsage(),/quota_exhausted/);
 const deadline=createTavilySearch({env:{TAVILY_API_KEY:'synthetic'},fetchImpl:async(_,init)=>new Promise((resolve,reject)=>{const hold=setTimeout(resolve,20000);init.signal.addEventListener('abort',()=>{clearTimeout(hold);reject(init.signal.reason);},{once:true});})});
 const start=Date.now();await assert.rejects(deadline.search('AWS Lambda'),/unavailable/);assert.ok(Date.now()-start>=14000&&Date.now()-start<19000);
});
test('usage endpoint uses the dedicated key and handles healthy Free plus rate-limited preflight',async()=>{
 const {createTavilySearch}=await import('./tech-feed-search.mjs');let calls=0;
 const search=createTavilySearch({env:{TAVILY_API_KEY:'synthetic'},fetchImpl:async(url,init)=>{
  calls++;assert.equal(url,'https://api.tavily.com/usage');assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'Bearer synthetic');assert.equal(init.body,undefined);
  return response({...free,key:{usage:998,limit:1000},account:{...free.account,current_plan:'FREE'}});
 }});
 assert.deepEqual(await search.checkUsage(),{remaining:2});assert.equal(calls,1);
 for(const status of [429,432,433]){
  const limited=createTavilySearch({env:{TAVILY_API_KEY:'synthetic'},fetchImpl:async()=>new Response('',{status})});
  await assert.rejects(limited.checkUsage(),/quota_exhausted/);
 }
});
