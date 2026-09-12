import {feedAdmin,createFeedStore,askFeedAi} from '../_shared/tech-feed-store.ts';
import {publicTransport} from '../_shared/tech-feed-transport.mjs';
import {reply} from '../_shared/tech-feed-api.mjs';
import {runFeedWorker,workerAuthorized} from '../_shared/tech-feed-worker-core.mjs';

export async function handler(request:Request){
 if(request.method!=='POST')return reply({error:'POST 요청만 허용됩니다.'},405);
 if(!workerAuthorized(request.headers.get('x-tech-feed-secret'),Deno.env.get('TECH_FEED_WORKER_SECRET')))return reply({error:'인증이 필요합니다.'},401);
 const env=Deno.env.toObject();
 if(env.TECH_FEED_ENABLED!=='true')return reply({ok:true,disabled:true});
 const pilotIds=(env.TECH_FEED_PILOT_USER_IDS||'').split(',').map(x=>x.trim()).filter(x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x));
 if(!pilotIds.length)return reply({ok:true,disabled:true});
 try{
  const admin=feedAdmin(),store=createFeedStore(admin,null);
  const result=await runFeedWorker({store,pilotIds,transport:publicTransport,
   ask:(owner:string,messages:unknown[],signal:AbortSignal,claims:any[])=>askFeedAi(admin,owner,messages,signal,Deno.env.toObject(),globalThis.fetch,()=>store.reserveSummaryCall(claims.map(x=>x.article.id),claims.map(x=>x.lease),owner)),
   signal:AbortSignal.any([request.signal,AbortSignal.timeout(50000)])});
  return reply({ok:true,...result});
 }catch{return reply({error:'기술 피드 작업을 완료하지 못했습니다.'},500);}
}
if(import.meta.main)Deno.serve(handler);
