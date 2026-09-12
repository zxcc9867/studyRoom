export type FeedSource = {
  id:string; name:string; url:string; kind:'rss'|'hn'; recommended:boolean; subscribed:boolean;
  permission_status:'approved'|'pending'|'blocked'; last_success_at:string|null; last_error:string|null;
};
export type FeedArticle = {
  id:string; title:string; url:string; published_at:string|null; discovered_at:string; excerpt:string;
  summary:null|{technology:string;change:string;usage:string}; summary_status:'pending'|'ready'|'insufficient'|'failed';
  category:null|'news'|'practice'|'deep_dive'; interests:string[]; sources:{id:string;name:string}[]; saved:boolean; todo_id:string|null;
};
export type FeedState = {enabled:boolean;sources:FeedSource[];interests:string[];last_success_at:string|null};
export type FeedPage = {items:FeedArticle[];next_cursor:string|null};
export type FeedPreview = {url:string;name:string;items:{title:string;url:string}[]};
export type FeedTodoDraft = {article_id:string;title:string;local_date:string;start_time:string|null;end_time:string|null};
