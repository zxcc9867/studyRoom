import {createClient,type SupabaseClient} from "jsr:@supabase/supabase-js@2.57.4";
import {createOpenRouterClient,getOpenRouterConfig} from "./coach-openrouter.mjs";
import {pilotEnabled} from "./tech-feed-core.mjs";

function checked(result:{data:any;error:any}):any {
 if(result.error){
  const allowed=["not_found","source_limit","invalid_input","unauthorized"];
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
 const rpc=async(name:string,args:Record<string,unknown>)=>checked(await admin.rpc(name,args));
 return {
  startRun:()=>rpc("tech_feed_start_run",{}),
  finishRun:(id:string,counts:unknown,error:string|null)=>rpc("tech_feed_finish_run",{p_id:id,p_counts:counts,p_error:error}),
  state:()=>rpc("tech_feed_state",{p_user_id:owner}),
  list:(view:string,interest:string|null,source:string|null,cursor:string|null)=>rpc("tech_feed_list",{p_user_id:owner,p_view:view,p_interest:interest,p_source_id:source,p_cursor:cursor}),
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
 if(signal?.aborted||!pilotEnabled(user,env))return{deferred:true};
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
