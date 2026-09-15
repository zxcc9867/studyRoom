import {createClient,type SupabaseClient} from "jsr:@supabase/supabase-js@2.57.4";
import {createOpenRouterClient,getOpenRouterConfig} from "./coach-openrouter.mjs";
import {classifyListItem,feedFacets} from "./tech-feed-briefing.mjs";
import {feedAccess} from "./tech-feed-topics.mjs";

function checked(result:{data:any;error:any}):any {
 if(result.error){
  const allowed=["not_found","source_limit","invalid_input","unauthorized","revision_conflict"];
  throw Error(allowed.includes(result.error.message)?result.error.message:"storage_failed");
 }
 return result.data;
}
export function feedAdmin(){
 return createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{
  auth:{persistSession:false,autoRefreshToken:false},
  global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.any([AbortSignal.timeout(10000),...(init?.signal?[init.signal]:[])])})},
 });
}
export function createFeedStore(admin:SupabaseClient,owner:string|null){
 const rpc=async(name:string,args:Record<string,unknown>,signal?:AbortSignal)=>{const query=admin.rpc(name,args);return checked(await(signal?query.abortSignal(signal):query));};
 return {
  claimClassification:(version:number,limit=50)=>rpc("tech_feed_classification_claim",{p_version:version,p_limit:limit}),
  finishClassificationBatch:(items:unknown[])=>rpc("tech_feed_classification_finish_batch",{p_items:items}),
  briefingSnapshot:(version:number,signal?:AbortSignal)=>rpc("tech_feed_briefing_snapshot",{p_user_id:owner,p_version:version},signal),
  claimBriefing:(version:number,hash:string,ids:string[],signal?:AbortSignal)=>rpc("tech_feed_briefing_claim",{p_user_id:owner,p_version:version,p_hash:hash,p_ids:ids},signal),
  reserveBriefing:(lease:string,signal?:AbortSignal)=>rpc("tech_feed_briefing_reserve",{p_user_id:owner,p_lease:lease},signal),
  finishBriefing:(lease:string,result:unknown,error:string|null,signal?:AbortSignal)=>rpc("tech_feed_briefing_finish",{p_user_id:owner,p_lease:lease,p_result:result,p_error:error},signal),
  facets:async(view:string)=>feedFacets(await rpc("tech_feed_filter_candidates",{p_user_id:owner,p_view:view})),
  claimMedia:(recipients:string[],limit=3)=>rpc("tech_feed_media_claim",{p_recipients:recipients,p_limit:limit}),
  mediaAllowed:(id:string,lease:string)=>rpc("tech_feed_media_allowed",{p_id:id,p_lease:lease}),
  finishMedia:(id:string,lease:string,media:unknown,error:string|null)=>rpc("tech_feed_media_finish",{p_id:id,p_lease:lease,p_media:media,p_error:error}),
  translationStatus:()=>rpc("tech_feed_translation_status",{}),
  claimTranslations:(recipients:string[],limit=3)=>rpc("tech_feed_translation_claim",{p_recipients:recipients,p_limit:limit}),
  reserveTranslation:(ids:string[],lease:string,cap=450000)=>rpc("tech_feed_translation_reserve",{p_ids:ids,p_lease:lease,p_cap:cap}),
  finishTranslation:(ids:string[],lease:string,items:unknown[],error:string|null)=>rpc("tech_feed_translation_finish",{p_ids:ids,p_lease:lease,p_items:items,p_error:error}),
  beginRefresh:(revision:number)=>rpc("tech_feed_refresh_begin",{p_user_id:owner,p_expected_revision:revision}),
  refreshStatus:()=>rpc("tech_feed_refresh_status",{p_user_id:owner}),
  finishRefresh:(lease:string,result:unknown)=>rpc("tech_feed_refresh_finish",{p_user_id:owner,p_lease:lease,p_result:result}),
  claimManualSearch:(lease:string)=>rpc("tech_feed_refresh_claim_search",{p_user_id:owner,p_refresh_lease:lease}),
  claimManualSources:(lease:string)=>rpc("tech_feed_refresh_claim_sources",{p_user_id:owner,p_refresh_lease:lease}),
  startRun:()=>rpc("tech_feed_start_run",{}),
  finishRun:(id:string,counts:unknown,error:string|null)=>rpc("tech_feed_finish_run",{p_id:id,p_counts:counts,p_error:error}),
  configure:(data:{prompt:string;canonical:string;receiving:boolean;expected_revision:number})=>rpc("tech_feed_configure",{p_user_id:owner,p_prompt:data.prompt,p_canonical:data.canonical,p_receiving:data.receiving,p_expected_revision:data.expected_revision}),
  receiving:(data:{receiving:boolean;expected_revision:number})=>rpc("tech_feed_receiving",{p_user_id:owner,p_receiving:data.receiving,p_expected_revision:data.expected_revision}),
  recipients:()=>rpc("tech_feed_recipients",{}),
  claimSearch:(recipients:string[]|null=null)=>rpc("tech_feed_search_claim",{p_recipients:recipients}),
  reserveSearch:(id:string,lease:string,cap=900)=>rpc("tech_feed_search_reserve",{p_id:id,p_lease:lease,p_cap:cap}),
  finishSearch:(id:string,lease:string,items:unknown[],error:string|null)=>rpc("tech_feed_search_finish",{p_id:id,p_lease:lease,p_items:items,p_error:error}),
  state:()=>rpc("tech_feed_state",{p_user_id:owner}),
  async list(view:string,interest:string|null,source:string|null,cursor:string|null,topic:string|null=null,sourceKey:string|null=null){
   let ids:string[]|null=null;
   if(topic){
    const candidates=await rpc("tech_feed_filter_candidates",{p_user_id:owner,p_view:view});
    ids=candidates.items.filter((item:any)=>classifyListItem(item,candidates.prompt).topics.includes(topic)).map((item:any)=>item.id);
   }
   const result=await rpc("tech_feed_list",{p_user_id:owner,p_view:view,p_interest:interest,p_source_id:source,p_cursor:cursor,p_source_key:sourceKey,p_article_ids:ids});
   const{_prompt,...response}=result;
   return{...response,...(Array.isArray(result.items)?{items:result.items.map((item:any)=>classifyListItem(item,_prompt||''))}:{})};
  },
  mutate:(action:string,data:unknown)=>rpc("tech_feed_mutate",{p_user_id:owner,p_action:action,p_data:data}),
  previewAllowed:()=>rpc("tech_feed_preview_reserve",{p_user_id:owner}),
  async saveTimezone(zone:string){
   const result=checked(await admin.from("profiles").update({time_zone:zone}).eq("user_id",owner!).select("user_id").maybeSingle());
   if(!result)throw Error("not_found");
  },
  claimSources:(pilots:string[],limit:number)=>rpc("tech_feed_claim_sources",{p_pilot_ids:pilots,p_limit:limit}),
  stageHn:(id:string,lease:string,ids:number[],high:number)=>rpc("tech_feed_stage_hn",{p_id:id,p_lease:lease,p_ids:ids,p_high_water:high}),
  finishSource:(id:string,lease:string,items:unknown[],error:string|null,etag:string|null,modified:string|null,checkpoint:unknown=null)=>rpc("tech_feed_finish_source",{p_id:id,p_lease:lease,p_items:items,p_error:error,p_etag:etag,p_last_modified:modified,p_checkpoint:checkpoint}),
  reserveSummaryCall:(ids:string[],leases:string[],user:string)=>rpc("tech_feed_begin_summary_attempt",{p_ids:ids,p_leases:leases,p_user_id:user}),
  // The briefing runs on an owner-bound store and names nobody; the ownerless
  // worker names the recipient of the batch it just wasted. An undefined id would
  // reach the RPC as null and be rejected as unauthorized.
  refundAiCall:(user:string|null=owner)=>rpc("coach_refund_ai",{p_user_id:user}),
  claimSummaries:(pilots:string[])=>rpc("tech_feed_claim_summaries",{p_pilot_ids:pilots}),
  finishSummary:(id:string,lease:string,user:string,summary:unknown,status:string,category:string|null=null)=>rpc("tech_feed_finish_summary",{p_id:id,p_lease:lease,p_user_id:user,p_summary:summary,p_status:status,p_category:category}),
  cleanup:()=>rpc("tech_feed_cleanup",{}),
 };
}
export async function authenticateFeed(request:Request,admin=feedAdmin()){
 const token=request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
 if(!token)throw Error("unauthorized");
 const {data,error}=await admin.auth.getUser(token);
 if(error||!data.user||data.user.is_anonymous)throw Error("unauthorized");
 return{id:data.user.id,store:createFeedStore(admin,data.user.id)};
}
export async function askFeedAi(admin:SupabaseClient,user:string,messages:unknown[],signal?:AbortSignal,env:Record<string,string>=Deno.env.toObject(),fetchImpl:typeof fetch=globalThis.fetch,reserve?:()=>Promise<boolean>){
 if(signal?.aborted||env.TECH_FEED_ENABLED!=='true'||!feedAccess(user,env))return{deferred:true};
 try{
  const config=getOpenRouterConfig(env);
  if(!config.enabled)return{deferred:true};
  const allowed=reserve?await reserve():checked(await admin.rpc("coach_reserve_ai",{p_user_id:user}));
  if(!allowed)return{deferred:true};
 }catch{return{deferred:true};}
 try{
  return await createOpenRouterClient({env:{...env,OPENROUTER_TIMEOUT_MS:"20000",OPENROUTER_MAX_TOKENS:"2048"},fetchImpl}).generateText({messages,signal});
 }catch{return null;}
}
