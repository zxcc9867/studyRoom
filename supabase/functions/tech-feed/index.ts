import {createTechFeedHandler} from '../_shared/tech-feed-api.mjs';
import {authenticateFeed} from '../_shared/tech-feed-store.ts';
import {publicTransport} from '../_shared/tech-feed-transport.mjs';

export const handler=createTechFeedHandler({authenticate:authenticateFeed,env:()=>Deno.env.toObject(),transport:publicTransport});
if(import.meta.main)Deno.serve(handler);
