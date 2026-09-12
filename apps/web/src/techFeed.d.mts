import type { SupabaseClient } from '@supabase/supabase-js';
import type { FeedArticle, FeedTodoDraft } from './techFeedTypes';
export const FEED_INTERESTS: [string,string][];
export const FEED_CATEGORIES: Record<string,string>;
export function safeFeedUrl(value: string): string | null;
export function mergeFeedPage<T extends {id:string}>(current:T[], incoming:T[]):T[];
export function summaryLabel(article:Pick<FeedArticle,'summary'|'summary_status'>):string;
export function feedTodoDraft(article:Pick<FeedArticle,'id'|'title'>,date:string):FeedTodoDraft;
export function createTechFeedClient(supabase:SupabaseClient,userId:string):(action:string,payload?:Record<string,unknown>,signal?:AbortSignal)=>Promise<any>;
