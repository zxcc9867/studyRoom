import {translationErrorCode} from './tech-feed-translation.mjs';
export async function runTranslationWorker({store,pilotIds,translator,signal}){
 const result={state:translator?.availability()||'not_configured',translated:0,attempted:0,characters:0,failed:0};
 if(result.state!=='waiting'||signal?.aborted)return result;
 let jobs=[];
 try{
  jobs=await store.claimTranslations(pilotIds,3);
  if(!jobs.length)return result;
  const texts=[],indices=jobs.map(job=>{const title=texts.push(job.title)-1;const excerpt=job.excerpt?.trim()?texts.push(job.excerpt)-1:null;return{title,excerpt};});
  const amount=texts.reduce((sum,text)=>sum+[...text].length,0);
  const usage=await translator.checkUsage(signal);
  if(usage.remaining<amount)throw Error('quota_exhausted');
  signal?.throwIfAborted();
  const reservation=await store.reserveTranslation(jobs.map(j=>j.id),jobs[0].lease,450000);
  if(reservation?.state!=='reserved')throw Error(reservation?.state==='quota_exhausted'?'quota_exhausted':'deferred');
  result.attempted=1;result.characters=amount;
  const translated=await translator.translate(texts,signal);
  const items=jobs.map((job,i)=>({id:job.id,title_ko:translated[indices[i].title],excerpt_ko:indices[i].excerpt===null?'':translated[indices[i].excerpt]}));
  if(items.some(item=>!item.title_ko?.trim()||[...item.title_ko].length>1000||typeof item.excerpt_ko!=='string'||[...item.excerpt_ko].length>6000))throw Error('unavailable');
  if(!await store.finishTranslation(jobs.map(j=>j.id),jobs[0].lease,items,null))throw Error('unavailable');
  result.state='ready';result.translated=jobs.length;
 }catch(error){
  const code=translationErrorCode(error);if(code)result.error_code=code;
  const deferred=error?.message==='deferred';
  result.state=deferred?'waiting':error?.message==='quota_exhausted'?'quota_exhausted':'unavailable';result.failed=deferred?0:1;
  if(jobs.length)try{await store.finishTranslation(jobs.map(j=>j.id),jobs[0].lease,[],deferred?'deferred':result.state);}catch{/* Expired leases are retried; reserved characters are never refunded. */}
 }
 return result;
}
