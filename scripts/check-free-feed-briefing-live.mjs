// Synthetic free-provider smoke; no user data or database writes.
import assert from 'node:assert/strict';
import {runBriefing,briefingAiFailure,briefingRetryAfter} from '../supabase/functions/_shared/tech-feed-briefing.mjs';
import {createOpenRouterClient,getOpenRouterConfig} from '../supabase/functions/_shared/coach-openrouter.mjs';
const env={...process.env,TECH_FEED_ENABLED:'true',OPENROUTER_TIMEOUT_MS:'20000',OPENROUTER_MAX_TOKENS:'2048'};
const config=getOpenRouterConfig(env);
if(!config.enabled)console.log('Free feed live check: skipped; no server key configured.');
else{
 const now=new Date(),models=[];let calls=0,hint=null,reserved=false,refunds=0;
 const snapshot={local_date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(now),time_zone:'Asia/Seoul',prompt:'',input_hash:'synthetic',receiving:true,cache:null,articles:[
 ['Typed list exercise','Synthetic exercise: filter a typed list of study tasks, compare interface and inference, then test empty input and duplicates. Check invalid field access with the type checker.'],
 ['HTTP retry exercise','Synthetic exercise: a fake HTTP client returns a gateway error then success. Permit one retry within a deadline. Test cancellation and permanent authentication failures.']
 ].map(([title,excerpt],i)=>({id:'synthetic-'+i,title,excerpt:excerpt.repeat(2),url:'https://example.test/'+i,eligible:true,discovered_at:now.toISOString(),published_at:now.toISOString(),sources:[{value:'host:example.test',label:'Example'}]}))};
 const store={
  briefingSnapshot:async()=>structuredClone(snapshot),
  claimBriefing:async()=>({status:'claimed',lease:'synthetic'}),
  reserveBriefing:async()=>{assert.ok(!reserved&&calls<2);reserved=true;calls++;return{status:'reserved'};},
  retryBriefing:async()=>{assert.ok(reserved);reserved=false;refunds++;return{status:'retry'};},
  completeBriefing:async(_lease,result,error,_signal,_attempt,wait)=>{
   if(result&&!error)snapshot.cache={result,generated_at:new Date().toISOString(),stale:false};
   else{if(reserved)refunds++;snapshot.last_error='unavailable';snapshot.failure_reason=error;snapshot.retry_at=new Date(Date.now()+Math.max(60000,wait||0)).toISOString();}
   reserved=false;return true;
  }
 };
 const client=createOpenRouterClient({env,fetchImpl:async(input,init)=>{hint=null;const r=await fetch(input,init);hint=briefingRetryAfter(r.headers.get('Retry-After'));return r;}});
 const ask=async(messages,signal,reserve)=>{
  if(!await reserve())return{deferred:true};
  try{const result=await client.generateText({messages,signal});models.push(result.model);return result;}
  catch(error){return{failure:briefingAiFailure({code:error.code,status:error.status,retry_after_ms:hint})};}
 };
 const result=await runBriefing({store,ask,env,generate:true});
 assert.ok(['ready','unavailable'].includes(result.status)&&calls<=2);
 if(result.status==='ready'){assert.equal(result.analyzed_count,2);const count=calls;assert.equal((await runBriefing({store,ask,env})).status,'ready');assert.equal(calls,count);}
 else assert.ok(result.failure_reason);
 console.log('Free feed live check: '+JSON.stringify({status:result.status,failure_reason:result.failure_reason||null,configured_router:config.model,actual_models:models,calls,refunds})+'. Synthetic input; no user data or DB writes; no paid fallback.');
}
