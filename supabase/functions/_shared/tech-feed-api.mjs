import {runManualRefresh} from './tech-feed-refresh.mjs';
import {INTERESTS,normalizeUrl,fetchFeed,pilotEnabled} from './tech-feed-core.mjs';
import {canonicalTopic,feedAccess,searchState} from './tech-feed-topics.mjs';
export const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
export function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});}
function invalid(){throw Error('invalid_input');}
export function uuid(value){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))invalid();return value;}
async function readBody(request){
 const reader=request.body?.getReader();if(!reader)invalid();
 const deadline=AbortSignal.timeout(5000);let total=0,text='';const decoder=new TextDecoder();
 const abort=()=>{void reader.cancel();};deadline.addEventListener('abort',abort,{once:true});
 try{while(true){const {value,done}=await reader.read();if(deadline.aborted)invalid();if(done)break;total+=value.byteLength;if(total>16384)invalid();text+=decoder.decode(value,{stream:true});}text+=decoder.decode();const data=JSON.parse(text);if(!data||typeof data!=='object'||Array.isArray(data))invalid();return data;}
 catch{invalid();}finally{deadline.removeEventListener('abort',abort);void reader.cancel().catch(()=>{});reader.releaseLock();}
}
function todo(data){
 const article_id=uuid(data.article_id),title=typeof data.title==='string'?data.title.trim():'';
 if(!title||title.length>180||/[\x00-\x1f]/.test(title)||typeof data.local_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(data.local_date))invalid();
 const date=new Date(data.local_date+'T00:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==data.local_date)invalid();
 const time=value=>{if(value==null)return null;if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(value))invalid();return value.slice(0,5);};
 const start_time=time(data.start_time),end_time=time(data.end_time);
 if((start_time===null)!==(end_time===null)||start_time!==null&&start_time===end_time)invalid();
 return{article_id,title,local_date:data.local_date,start_time,end_time,goal_id:data.goal_id==null?null:uuid(data.goal_id)};
}
const errorMessages={
 revision_conflict:[409,'다른 기기에서 설정이 변경되었습니다. 새로고침 후 다시 시도해 주세요.'],
 unauthorized:[401,'로그인이 필요합니다.'],disabled:[403,'기술 피드를 사용할 수 없습니다.'],
 invalid_input:[400,'입력 내용을 확인해 주세요.'],invalid_url:[400,'공개 HTTPS 피드 주소를 입력해 주세요.'],
 invalid_feed:[400,'RSS 또는 Atom 피드를 확인할 수 없습니다.'],source_limit:[400,'사용자 소스는 최대 10개까지 구독할 수 있습니다.'],
 not_found:[404,'항목을 찾을 수 없습니다.'],rate_limit:[429,'잠시 후 다시 시도해 주세요.'],
 source_failed:[502,'피드를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'],
 unsafe_address:[400,'허용되지 않는 피드 주소입니다.'],unsafe_connection:[400,'안전한 피드 연결을 확인할 수 없습니다.'],
 redirect_limit:[400,'피드 주소의 이동을 확인할 수 없습니다.'],source_timeout:[504,'피드 응답이 지연되고 있습니다.'],
};
export function createTechFeedHandler({authenticate,env,transport}){
 return async request=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return reply({error:'POST 요청만 허용됩니다.'},405);
  try{
   const {id,store}=await authenticate(request),data=await readBody(request),action=data.action;
   if(action==='timezone'){
    if(typeof data.time_zone!=='string'||data.time_zone.length>80)invalid();
    let zone;try{zone=new Intl.DateTimeFormat('en',{timeZone:data.time_zone}).resolvedOptions().timeZone;}catch{invalid();}
    await store.saveTimezone(zone);return reply({ok:true});
   }
   const config=env();
   const withStatus=state=>({...state,enabled:true,service_available:config.TECH_FEED_ENABLED==='true'&&Boolean((state.preferences?.receiving&&config.TAVILY_API_KEY?.trim()&&!['quota_exhausted','unavailable'].includes(state.search_status?.state))||((!state.preferences?.prompt||state.preferences.receiving)&&state.sources?.some(s=>s.subscribed&&s.permission_status==='approved'))),search_status:searchState(state,config)});
   if(action==='topics_save'||action==='receiving'){
    if(typeof data.receiving!=='boolean'||!Number.isSafeInteger(data.expected_revision)||data.expected_revision<0)invalid();
    const state=action==='topics_save'?await store.configure({...canonicalTopic(data.prompt),receiving:data.receiving,expected_revision:data.expected_revision}):await store.receiving({receiving:data.receiving,expected_revision:data.expected_revision});
    const result=withStatus(state);return reply({preferences:result.preferences,search_status:result.search_status});
   }
   if(!feedAccess(id,config)||(config.TECH_FEED_ACCESS_MODE!=='self_service'&&!pilotEnabled(id,config))){
    if(action==='state'){
     const state=await store.state();
     return reply({enabled:false,sources:[],interests:[],last_success_at:null,preferences:state.preferences||{prompt:'',receiving:false,revision:0},search_status:{...searchState(state,config),state:'paused'},service_available:false});
    }
    if(!feedAccess(id,config)||!['list','save','add_todo'].includes(action)||action==='list'&&data.view!=='saved')throw Error('disabled');
   }
   if(action==='state')return reply(withStatus(await store.state()));
   if(action==='refresh_status')return reply({...await store.refreshStatus(),search:searchState(await store.state(),config)});
   if(action==='refresh'){
    if(!Number.isSafeInteger(data.expected_revision)||data.expected_revision<0)invalid();
    return reply(await runManualRefresh({store,userId:id,expectedRevision:data.expected_revision,env:config,transport,signal:request.signal}));
   }
   if(action==='list'){
    const view=data.view||'latest';if(!['latest','saved'].includes(view)||data.interest!=null&&!INTERESTS.includes(data.interest))invalid();
    const source=data.source_id==null?null:uuid(data.source_id);
    if(data.cursor!=null&&(typeof data.cursor!=='string'||data.cursor.length>128||!/^[0-9T .:+Z-]+\|[0-9a-f-]{36}$/i.test(data.cursor)))invalid();
    return reply(await store.list(view,data.interest||null,source,data.cursor||null));
   }
   if(action==='preview'||action==='add_source'){
    let url;try{url=normalizeUrl(data.url);}catch{throw Error('invalid_url');}
    if(!await store.previewAllowed())throw Error('rate_limit');
    const feed=await fetchFeed({url},transport,request.signal);
    if(action==='preview')return reply({url,name:feed.name,items:feed.items.slice(0,5).map(({title,url})=>({title,url}))});
    return reply(await store.mutate('add_source',{url,name:feed.name}));
   }
   if(action==='subscribe'){
    if(typeof data.subscribed!=='boolean')invalid();
    return reply(await store.mutate(action,{source_id:uuid(data.source_id),subscribed:data.subscribed}));
   }
   if(action==='interests'){
    if(!Array.isArray(data.interests)||data.interests.length>5||!data.interests.every(x=>INTERESTS.includes(x)))invalid();
    return reply(await store.mutate(action,{interests:[...new Set(data.interests)]}));
   }
   if(action==='save'){
    if(typeof data.saved!=='boolean')invalid();
    return reply(await store.mutate(action,{article_id:uuid(data.article_id),saved:data.saved}));
   }
   if(action==='add_todo')return reply(await store.mutate(action,todo(data)));
   throw Error('invalid_input');
  }catch(error){
   const [status,message]=errorMessages[error?.message]||[500,'요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'];
   return reply({error:message},status);
  }
 };
}
