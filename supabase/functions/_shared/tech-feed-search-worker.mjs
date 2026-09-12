import {classifyArticle} from './tech-feed-topics.mjs';
export async function runSearchWorker({store,search,signal=AbortSignal.timeout(35000),now=()=>new Date()}){
 const result={state:'waiting',attempted:0,collected:0,failed:0};let job;
 try{
  if(search.availability()==='not_configured')return{...result,state:'not_configured'};
  signal.throwIfAborted();job=await store.claimSearch();if(!job)return result;
  // Claim includes the provider-wide mutex. No POST happens before BOTH gates.
  await search.checkUsage(signal);signal.throwIfAborted();
  if(!await store.reserveSearch(job.id,job.lease))throw Error('quota_exhausted');
  result.attempted=1;
  const items=(await search.search(job.canonical,signal)).map(classifyArticle);
  if(!await store.finishSearch(job.id,job.lease,items,null))throw Error('unavailable');
  result.collected=items.length;result.state='ready';return result;
 }catch(error){
  result.state=['quota_exhausted','not_configured'].includes(error?.message)?error.message:'unavailable';result.failed=1;
  if(job)try{await store.finishSearch(job.id,job.lease,[],result.state);}catch{/* An expired lease can be reclaimed; attempts are never refunded. */}
  return result;
 }
}
