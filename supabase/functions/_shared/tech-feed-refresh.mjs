import {runFeedWorker} from './tech-feed-worker-core.mjs';
import {runSearchWorker} from './tech-feed-search-worker.mjs';
import {createTavilySearch} from './tech-feed-search.mjs';

function waitForProvider(signal){
 return new Promise((resolve,reject)=>{
  signal.throwIfAborted();
  const cancel=()=>{clearTimeout(timer);reject(signal.reason);};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},2000);
  signal.addEventListener('abort',cancel,{once:true});
 });
}
export async function runManualRefresh({store,userId,expectedRevision,env,transport,signal,search=createTavilySearch({env})}){
 const state=await store.state();
 if(env.TECH_FEED_ENABLED!=='true'||state.preferences?.prompt&&!state.preferences.receiving)return{state:'paused'};
 const rssAvailable=state.sources?.some(s=>s.subscribed&&s.permission_status==='approved');
 const searchAvailable=Boolean(env.TAVILY_API_KEY?.trim()&&state.preferences?.prompt&&state.preferences.receiving);
 if(!rssAvailable&&!searchAvailable)return{state:!env.TAVILY_API_KEY?.trim()?'not_configured':'no_sources'};
 const gate=await store.beginRefresh(expectedRevision);
 if(gate.state!=='started')return gate;
 const bounded=AbortSignal.any([AbortSignal.timeout(40000),...(signal?[signal]:[])]);
 const configuredCap=Number(env.TECH_FEED_SEARCH_MONTHLY_CAP??900);
 const cap=Number.isFinite(configuredCap)?Math.min(900,Math.max(0,Math.floor(configuredCap))):900;
 let result={state:'unavailable'},runId;
 try{
  runId=await store.startRun?.();
  // Search and bounded RSS batch are independent. Manual discovery does not
  // consume additional AI calls; scheduled summaries retain their existing quota.
  const [rss,web]=await Promise.all([
   rssAvailable?runFeedWorker({store:{...store,startRun:undefined,finishRun:undefined,
    claimSources:()=>store.claimManualSources(gate.lease),claimSummaries:async()=>[],cleanup:async()=>{}},
    pilotIds:[userId],transport,ask:async()=>({deferred:true}),signal:bounded})
    .catch(()=>({collected:0,failed:1})):Promise.resolve({collected:0,failed:0}),
   searchAvailable?runSearchWorker({store:{...store,claimSearch:async()=>{
    for(;;){
     bounded.throwIfAborted();
     const job=await store.claimManualSearch(gate.lease);
     if(!job?.busy)return job;
     // An unrelated topic owns the provider. Waiting never reserves a paid call.
     await waitForProvider(bounded);
    }
   },
    reserveSearch:(id,lease)=>store.reserveSearch(id,lease,cap)},search,signal:bounded})
    :Promise.resolve({state:env.TAVILY_API_KEY?.trim()?'waiting':'not_configured',attempted:0,collected:0,failed:0}),
  ]);
  if(searchAvailable&&web.state==='waiting'){
   const latest=(await store.state()).search_status;
   if(['quota_exhausted','unavailable','paused','not_configured'].includes(latest?.state))web.state=latest.state;
  }
  const checked=rss.collected>0||web.attempted>0&&web.state==='ready';
  const failed=Boolean(rss.failed||web.failed||['quota_exhausted','unavailable'].includes(web.state)||bounded.aborted);
  result={state:checked?(failed?'partial':'ready'):failed?'unavailable':'cooldown',rss,search:web,retry_after:300};
 }finally{
  // A failed request cannot remove a newer lease or refund a search attempt.
  const finished=await store.finishRefresh(gate.lease,result);
  if(!finished)result={...result,state:'unavailable'};
  if(runId)await store.finishRun(runId,{...(result.rss||{}),search:result.search||{}},result.state==='unavailable'?'manual_refresh_failed':null);
 }
 // Another subscriber/cron can own the same work; clients only poll status.
 if((await store.refreshStatus()).state==='running')return{...result,state:'running'};
 return result;
}
