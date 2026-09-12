import {timingSafeEqual} from 'node:crypto';
import {fetchFeed,initialItems,parseHn,summarizeBatch} from './tech-feed-core.mjs';
export function workerAuthorized(supplied,expected){
 if(typeof expected!=='string'||expected.length<32||typeof supplied!=='string')return false;
 const left=Buffer.from(supplied),right=Buffer.from(expected);
 return left.length===right.length&&timingSafeEqual(left,right);
}
function classify(item){
 const text=(item.title+' '+item.excerpt).toLowerCase(),interests=[];
 if(/\bai\b|\bllm\b|machine learning|인공지능|hugging face|gpt|claude|모델/.test(text))interests.push('ai');
 if(/react|frontend|css|javascript|browser|프론트/.test(text))interests.push('frontend');
 if(/backend|database|postgres|api\b|백엔드|데이터베이스/.test(text))interests.push('backend');
 if(/aws|cloud|kubernetes|클라우드|azure/.test(text))interests.push('cloud');
 if(/github|tool|editor|cli\b|도구/.test(text))interests.push('tools');
 return{...item,interests};
}
async function hnFeed(source,transport,signal,store){
 if(source.url!=='https://hacker-news.firebaseio.com/v0/newstories.json')throw Error('source_failed');
 let pending=Array.isArray(source.hn_pending_ids)?source.hn_pending_ids.map(Number):[];
 if(!pending.length){
  const response=await transport(source.url,{headers:{Accept:'application/json'},signal});
  if(response.status!==200)throw Error('source_failed');
  const raw=JSON.parse(response.text);if(!Array.isArray(raw)||raw.length>1000||!raw.every(x=>Number.isSafeInteger(x)&&x>0))throw Error('source_failed');
  const ids=[...new Set(raw)].sort((a,b)=>b-a),high=ids[0]||Number(source.hn_high_water)||0;
  pending=source.last_success_at?ids.filter(x=>x>Number(source.hn_high_water||0)).sort((a,b)=>a-b):ids.slice(0,50);
  // Persist the bounded API snapshot BEFORE item I/O, so failures cannot lose its tail.
  if(!await store.stageHn(source.id,source.lease,pending,high))throw Error('source_failed');
 }
 const selected=pending.slice(0,50),items=[];let cursor=0,failures=0;
 await Promise.all(Array.from({length:Math.min(4,selected.length)},async()=>{
  while(cursor<selected.length&&!signal.aborted){const id=selected[cursor++];
   try{const r=await transport('https://hacker-news.firebaseio.com/v0/item/'+id+'.json',{headers:{Accept:'application/json'},signal});if(r.status!==200)throw Error('source_failed');const item=parseHn(JSON.parse(r.text));if(item)items.push(item);}catch{failures++;}
  }
 }));
 if(failures||signal.aborted)throw Error('source_failed');
 return{items:items.sort((a,b)=>String(b.published_at).localeCompare(String(a.published_at))),etag:null,last_modified:null,checkpoint:{pending_ids:pending.slice(selected.length)}};
}
async function executeFeedWorker({store,pilotIds,transport,ask,signal,stats}){
 const result=stats;
 if(!pilotIds.length)return result;
 const sources=await store.claimSources(pilotIds,2);
 for(const source of sources){
  if(signal.aborted)break;
  if(source.permission_status!=='approved')continue;
  try{
   const feed=source.kind==='hn'?await hnFeed(source,transport,signal,store):await fetchFeed(source,transport,signal);
   const items=initialItems(feed.items,source.last_success_at).map(classify);
   const saved=await store.finishSource(source.id,source.lease,items,null,feed.etag||null,feed.last_modified||null,feed.checkpoint);
   if(saved)result.collected++;else result.failed++;
  }catch{
   result.failed++;
   try{await store.finishSource(source.id,source.lease,[],'source_failed',null,null);}catch{/* lease expiry permits retry */}
  }
 }
 if(!signal.aborted){
  const claims=await store.claimSummaries(pilotIds),groups=new Map();
  for(const claim of claims){
   if(!pilotIds.includes(claim.user_id)||claim.article.permission_status!=='approved')continue;
   if(!groups.has(claim.user_id))groups.set(claim.user_id,[]);
   groups.get(claim.user_id).push(claim);
  }
  for(const [owner,group]of groups){
   if(signal.aborted)break;
   const summaries=await summarizeBatch(group.map(x=>x.article),(messages)=>ask(owner,messages,signal,group));
   for(const summary of summaries){
    const claim=group.find(x=>x.article.id===summary.id);
    if(!summary.deferred&&!['ready','failed','insufficient'].includes(summary.summary_status))continue;
    const saved=await store.finishSummary(summary.id,claim.lease,owner,summary.summary,summary.deferred?'deferred':summary.summary_status,summary.category||null);
    if(saved&&summary.summary_status==='ready')result.summarized++;
    if(saved&&summary.deferred)result.summary_deferred++;
    else if(saved&&summary.summary_status==='failed')result.summary_failed++;
   }
  }
 }
 if(!signal.aborted)await store.cleanup();
 return result;
}

export async function runFeedWorker(options){
 const stats={collected:0,failed:0,summarized:0,summary_failed:0,summary_deferred:0};
 const signal=options.signal||AbortSignal.timeout(50000);
 const runId=await options.store.startRun?.();let error=null;
 try{
  await executeFeedWorker({...options,signal,stats});
  if(signal.aborted)error='worker_timeout';
  return stats;
 }catch(cause){error='worker_failed';throw cause;}
 finally{if(runId)await options.store.finishRun(runId,stats,error);}
}
