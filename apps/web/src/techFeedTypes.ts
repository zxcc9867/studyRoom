export type FeedSource = {
  id:string; name:string; url:string; kind:'rss'|'hn'; recommended:boolean; subscribed:boolean;
  permission_status:'approved'|'pending'|'blocked'; last_success_at:string|null; last_error:string|null;
};
export type FeedArticle = {
  id:string; title:string; url:string; published_at:string|null; discovered_at:string; excerpt:string;
  summary:null|{technology:string;change:string;usage:string}; summary_status:'pending'|'ready'|'insufficient'|'failed';
  category:null|'news'|'practice'|'deep_dive'; interests:string[]; sources:{id:string;name:string}[]; saved:boolean; todo_id:string|null;
  origin:'rss'|'web_search'; matched_topics:string[]; excerpt_provenance:'source_excerpt'|'search_snippet';
};
export type FeedPreferences = {prompt:string;receiving:boolean;revision:number};
export type FeedSearchStatus = {
  state:'not_configured'|'paused'|'waiting'|'ready'|'quota_exhausted'|'unavailable';last_success_at:string|null;
};
export type FeedPreferenceResponse = {preferences:FeedPreferences;search_status:FeedSearchStatus};
export type FeedState = FeedPreferenceResponse & {
  enabled:boolean;service_available:boolean;sources:FeedSource[];interests:string[];last_success_at:string|null;
};
export type FeedPage = {items:FeedArticle[];next_cursor:string|null};
export type FeedPreview = {url:string;name:string;items:{title:string;url:string}[]};
export type FeedTodoDraft = {article_id:string;title:string;local_date:string;start_time:string|null;end_time:string|null};
