import {normalizeUrl,plainText} from './tech-feed-core.mjs';
import {canonicalTopic} from './tech-feed-topics.mjs';
const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
export function createTavilySearch({env,fetchImpl=globalThis.fetch}){
 const key=env.TAVILY_API_KEY?.trim();
 async function request(path,body,signal){
  if(!key)throw Error('not_configured');
  const bounded=AbortSignal.any([AbortSignal.timeout(15000),...(signal?[signal]:[])]);
  let reader;
  try{
   bounded.throwIfAborted();
   const result=await fetchImpl('https://api.tavily.com/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:bounded});
   if([429,432,433].includes(result.status))throw Error('quota_exhausted');
   if(!result.ok||Number(result.headers.get('content-length')||0)>1048576)throw Error('unavailable');
   reader=result.body?.getReader();if(!reader)throw Error('unavailable');
   let size=0,text='';const decoder=new TextDecoder();
   const cancel=()=>{void reader.cancel().catch(()=>{});};bounded.addEventListener('abort',cancel,{once:true});
   try{while(true){const {value,done}=await reader.read();bounded.throwIfAborted();if(done)break;size+=value.byteLength;if(size>1048576)throw Error('unavailable');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();return JSON.parse(text);}
   finally{bounded.removeEventListener('abort',cancel);}
  }catch(error){throw Error(error?.message==='quota_exhausted'?'quota_exhausted':'unavailable');}
  finally{if(reader){void reader.cancel().catch(()=>{});reader.releaseLock();}}
 }
 return{
  availability:()=>key?'waiting':'not_configured',
  async checkUsage(signal){
   const data=await request('usage',null,signal),a=data?.account,k=data?.key;
   if(!a||!k||!['free','researcher'].includes(String(a.current_plan).toLowerCase())||![a.plan_usage,a.plan_limit,a.paygo_usage,a.paygo_limit,k.usage,k.limit].every(finite)||a.plan_limit<=0||a.plan_limit>1000||k.limit<=0||k.limit>1000||a.paygo_usage!==0||a.paygo_limit!==0)throw Error('unavailable');
   if(a.plan_limit-a.plan_usage<1||k.limit-k.usage<1)throw Error('quota_exhausted');
   return{remaining:Math.min(a.plan_limit-a.plan_usage,k.limit-k.usage)};
  },
  async search(query,signal){
   const {prompt}=canonicalTopic(query);
   const data=await request('search',{query:prompt,search_depth:'basic',auto_parameters:false,include_answer:false,include_raw_content:false,include_images:false,include_usage:true,max_results:5,topic:'general',time_range:'week'},signal);
   if(!Array.isArray(data?.results)||data.results.length>100)throw Error('unavailable');
   const items=[],seen=new Set();
   for(const row of data.results.slice(0,5))try{
    if(typeof row?.title!=='string'||typeof row.url!=='string')continue;
    const url=normalizeUrl(row.url),title=plainText(row.title,300);if(!title||seen.has(url))continue;
    const timestamp=typeof row.published_date==='string'?Date.parse(row.published_date):NaN;
    items.push({url,title,excerpt:typeof row.content==='string'?plainText(row.content,2000):'',published_at:Number.isFinite(timestamp)&&timestamp<=Date.now()?new Date(timestamp).toISOString():null,origin:'web_search',excerpt_provenance:'search_snippet'});seen.add(url);
   }catch{/* Keep other safe public links; never retrieve result pages. */}
   return items;
  },
 };
}
