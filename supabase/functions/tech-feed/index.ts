import {createTechFeedHandler} from '../_shared/tech-feed-api.mjs';
import {authenticateFeed,feedAdmin,askFeedAi} from '../_shared/tech-feed-store.ts';
import {publicTransport} from '../_shared/tech-feed-transport.mjs';

declare const EdgeRuntime:{waitUntil(work:Promise<unknown>):void};
export const handler=createTechFeedHandler({authenticate:authenticateFeed,env:()=>Deno.env.toObject(),transport:publicTransport,
 askBriefing:(user:string,messages:unknown[],signal:AbortSignal,config:Record<string,string>,reserve:()=>Promise<boolean>)=>askFeedAi(feedAdmin(),user,messages,signal,config,globalThis.fetch,reserve),
 scheduleEnrichment:(work:Promise<unknown>)=>EdgeRuntime.waitUntil(work)});
if(import.meta.main)Deno.serve(handler);
