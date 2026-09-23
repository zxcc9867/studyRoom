export type FeedSource = {
  id:string; name:string; url:string; kind:'rss'|'hn'; recommended:boolean; subscribed:boolean;
  permission_status:'approved'|'pending'|'blocked'; last_success_at:string|null; last_error:string|null;
};
export type FeedArticle = {
  media?:null|{image_url:string|null;video:null|{provider:'youtube'|'vimeo';id:string}};
  title_ko?:string|null; excerpt_ko?:string|null; translation_status?:'pending'|'ready'|'failed';
  id:string; title:string; url:string; published_at:string|null; discovered_at:string; excerpt:string; original_language?:'ko'|'en'|'unknown';
  summary:null|{technology:string;change:string;usage:string}; summary_status:'pending'|'ready'|'insufficient'|'failed';
  topics?:string[];category_method?:'ai'|'rules'|null;rules_version?:number;
  category:null|'news'|'practice'|'deep_dive'; interests:string[]; sources:{id:string;name:string}[]; saved:boolean; todo_id:string|null;
  origin:'rss'|'web_search'; matched_topics:string[]; excerpt_provenance:'source_excerpt'|'search_snippet';
};
export type FeedPreferences = {prompt:string;receiving:boolean;revision:number};
export type FeedSearchStatus = {
  state:'not_configured'|'paused'|'waiting'|'ready'|'quota_exhausted'|'unavailable';last_success_at:string|null;
};
export type FeedPreferenceResponse = {preferences:FeedPreferences;search_status:FeedSearchStatus};
export type FeedState = FeedPreferenceResponse & {
  translation_service?:FeedSearchStatus['state'];
  enabled:boolean;service_available:boolean;sources:FeedSource[];interests:string[];last_success_at:string|null;
};
export type FeedPage = {items:FeedArticle[];next_cursor:string|null;total:number};
export type FeedPreview = {url:string;name:string;items:{title:string;url:string}[]};
export type FeedTodoDraft = {article_id:string;title:string;local_date:string;start_time:string|null;end_time:string|null};

export type FeedApi=(action:string,payload?:Record<string,unknown>,signal?:AbortSignal)=>Promise<any>;
export type FeedFacet={value:string;label:string;count:number};
export type FeedFacets={total:number;topics:FeedFacet[];sources:FeedFacet[];languages?:FeedFacet[]};
export type FeedBriefing={
  local_date:string;time_zone:string;total:number;source_count:number;categories:FeedFacet[];topics:FeedFacet[];
  eligible_count:number;analyzed_count:number;generated_at:string|null;
  status:'idle'|'ready'|'generating'|'insufficient'|'quota_exhausted'|'unavailable'|'paused';stale:boolean;
  highlights?:{reason:string;learning:string;source:{id:string;title:string;url:string}}[];
  insights:{title:string;body:string;study_angle:string;sources:{id:string;title:string;url:string}[]}[];
};
