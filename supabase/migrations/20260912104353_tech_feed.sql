-- Shared public content, private membership, and service-only collection writes.
create table public.tech_feed_sources(
 id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 120),
 url text not null unique check(url like 'https://%' and length(url)<=2048),
 kind text not null default 'rss' check(kind in('rss','hn')),recommended boolean not null default false,
 created_by uuid references auth.users on delete set null,
 permission_status text not null default 'pending' check(permission_status in('approved','pending','blocked')),
 summary_allowed boolean not null default false,permission_note text,
 etag text,last_modified text,last_success_at timestamptz,last_error text,
 failures int not null default 0,run_after timestamptz not null default now(),
 hn_pending_ids bigint[] not null default '{}',hn_high_water bigint not null default 0,hn_snapshot_high_water bigint not null default 0,
 lease uuid,lease_until timestamptz,created_at timestamptz not null default now(),
 check(not summary_allowed or permission_status='approved')
);
create table public.tech_feed_subscriptions(
 user_id uuid not null references auth.users on delete cascade,source_id uuid not null references public.tech_feed_sources on delete cascade,
 subscribed boolean not null default true,created_at timestamptz not null default now(),primary key(user_id,source_id)
);
create table public.tech_feed_preferences(
 user_id uuid primary key references auth.users on delete cascade,interests text[] not null default '{}',
 check(interests <@ array['ai','frontend','backend','cloud','tools']::text[])
);
create table public.tech_feed_articles(
 id uuid primary key default gen_random_uuid(),url text not null unique check(url like 'https://%' and length(url)<=2048),
 title text not null check(length(title) between 1 and 300),published_at timestamptz,discovered_at timestamptz not null default now(),
 excerpt text not null default '' check(length(excerpt)<=2000),excerpt_source_id uuid references public.tech_feed_sources on delete set null,summary jsonb,
 summary_status text not null default 'pending' check(summary_status in('pending','ready','insufficient','failed')),
 category text check(category in('news','practice','deep_dive')),interests text[] not null default '{}',
 summary_lease uuid,summary_attempt_lease uuid,summary_lease_until timestamptz,summary_attempts int not null default 0,summary_retry_at timestamptz,
 check(interests <@ array['ai','frontend','backend','cloud','tools']::text[]),
 check((summary_status='ready' and summary is not null) or (summary_status<>'ready' and summary is null))
);
create table public.tech_feed_article_sources(
 article_id uuid not null references public.tech_feed_articles on delete cascade,source_id uuid not null references public.tech_feed_sources on delete cascade,
 guid text not null check(length(guid)<=1024),primary key(source_id,guid),unique(article_id,source_id)
);
create table public.tech_feed_bookmarks(
 user_id uuid not null references auth.users on delete cascade,article_id uuid not null references public.tech_feed_articles on delete cascade,
 created_at timestamptz not null default now(),primary key(user_id,article_id)
);
create table public.tech_feed_todo_links(
 user_id uuid not null references auth.users on delete cascade,article_id uuid not null references public.tech_feed_articles on delete cascade,
 todo_id uuid not null references public.study_todos on delete cascade,created_at timestamptz not null default now(),primary key(user_id,article_id),unique(todo_id)
);
create table public.tech_feed_runs(
 id uuid primary key default gen_random_uuid(),started_at timestamptz not null default now(),finished_at timestamptz,
 status text not null default 'running'check(status in('running','completed','partial','failed','abandoned')),
 collection_success int not null default 0 check(collection_success between 0 and 1000),
 collection_failed int not null default 0 check(collection_failed between 0 and 1000),
 summary_success int not null default 0 check(summary_success between 0 and 1000),
 summary_failed int not null default 0 check(summary_failed between 0 and 1000),
 summary_deferred int not null default 0 check(summary_deferred between 0 and 1000),
 error_code text check(error_code in('source_failed','summary_failed','worker_failed','worker_timeout','worker_expired'))
);
create index tech_feed_runs_started on public.tech_feed_runs(started_at);
alter table public.tech_feed_runs enable row level security;
revoke all on public.tech_feed_runs from public,anon,authenticated;
grant all on public.tech_feed_runs to service_role;
create table public.tech_feed_seen(
 source_id uuid not null references public.tech_feed_sources on delete cascade,guid_hash text not null,url_hash text not null,
 primary key(source_id,guid_hash)
);
create index tech_feed_seen_url on public.tech_feed_seen(url_hash);
create table public.tech_feed_preview_usage(
 user_id uuid primary key references auth.users on delete cascade,window_start timestamptz not null default now(),attempts int not null default 0
);
alter table public.tech_feed_seen enable row level security;
alter table public.tech_feed_preview_usage enable row level security;
revoke all on public.tech_feed_seen,public.tech_feed_preview_usage from public,anon,authenticated;
grant all on public.tech_feed_seen,public.tech_feed_preview_usage to service_role;
create index tech_feed_subscription_source on public.tech_feed_subscriptions(source_id,user_id) where subscribed;
create index tech_feed_article_order on public.tech_feed_articles((coalesce(published_at,discovered_at)) desc,id desc);
create index tech_feed_article_mapping on public.tech_feed_article_sources(article_id);
create index tech_feed_due on public.tech_feed_sources(run_after) where permission_status='approved';
create index tech_feed_bookmark_article on public.tech_feed_bookmarks(article_id);
create index tech_feed_todo_article on public.tech_feed_todo_links(article_id);

do $$declare t text;begin
 foreach t in array array['tech_feed_sources','tech_feed_subscriptions','tech_feed_preferences','tech_feed_articles','tech_feed_article_sources','tech_feed_bookmarks','tech_feed_todo_links'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end$$;
-- A shared custom URL must not reveal its original registrant or worker internals.
revoke select on public.tech_feed_sources from authenticated;
grant select(id,name,url,kind,recommended,permission_status,last_success_at,last_error)on public.tech_feed_sources to authenticated;
create policy tech_feed_subscription_owner on public.tech_feed_subscriptions for select to authenticated using(user_id=(select auth.uid()));
create policy tech_feed_preferences_owner on public.tech_feed_preferences for select to authenticated using(user_id=(select auth.uid()));
create policy tech_feed_bookmark_owner on public.tech_feed_bookmarks for select to authenticated using(user_id=(select auth.uid()));
create policy tech_feed_todo_owner on public.tech_feed_todo_links for select to authenticated using(user_id=(select auth.uid()));
create policy tech_feed_source_read on public.tech_feed_sources for select to authenticated using(
 recommended or created_by=(select auth.uid()) or exists(select 1 from public.tech_feed_subscriptions s where s.source_id=id and s.user_id=(select auth.uid()))
);
create policy tech_feed_mapping_read on public.tech_feed_article_sources for select to authenticated using(
 exists(select 1 from public.tech_feed_subscriptions s where s.source_id=tech_feed_article_sources.source_id and s.user_id=(select auth.uid()) and s.subscribed)
 or exists(select 1 from public.tech_feed_bookmarks b where b.article_id=tech_feed_article_sources.article_id and b.user_id=(select auth.uid()))
 or exists(select 1 from public.tech_feed_todo_links l where l.article_id=tech_feed_article_sources.article_id and l.user_id=(select auth.uid()))
);
create policy tech_feed_article_read on public.tech_feed_articles for select to authenticated using(
 exists(select 1 from public.tech_feed_article_sources m join public.tech_feed_subscriptions s on s.source_id=m.source_id where m.article_id=id and s.user_id=(select auth.uid()) and s.subscribed)
 or exists(select 1 from public.tech_feed_bookmarks b where b.article_id=id and b.user_id=(select auth.uid()))
 or exists(select 1 from public.tech_feed_todo_links l where l.article_id=id and l.user_id=(select auth.uid()))
);

-- Availability is not permission. A human-reviewed policy record is required before approval.
insert into public.tech_feed_sources(name,url,kind,recommended,permission_note)values
 ('GeekNews','https://news.hada.io/rss/news','rss',true,'Pending publisher permission review'),
 ('Hacker News','https://hacker-news.firebaseio.com/v0/newstories.json','hn',true,'Pending API/content reuse review'),
 ('Hugging Face','https://huggingface.co/blog/feed.xml','rss',true,'Pending publisher permission review'),
 ('Simon Willison','https://simonwillison.net/atom/everything/','rss',true,'Pending publisher permission review'),
 ('AWS What''s New','https://aws.amazon.com/about-aws/whats-new/recent/feed/','rss',true,'Pending publisher permission review'),
 ('GitHub Changelog','https://github.blog/changelog/feed/','rss',true,'Pending publisher permission review'),
 ('Toss','https://toss.tech/rss.xml','rss',true,'Pending publisher permission review'),
 ('Woowahan','https://techblog.woowahan.com/feed/','rss',true,'Pending publisher permission review');

create function public.tech_feed_preview_reserve(p_user_id uuid)returns boolean language plpgsql security invoker set search_path='' as $$declare n int;begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,98532));
 insert into public.tech_feed_preview_usage(user_id,attempts)values(p_user_id,1)
 on conflict(user_id)do update set attempts=case when public.tech_feed_preview_usage.window_start<=now()-interval '15 minutes'then 1 else public.tech_feed_preview_usage.attempts+1 end,
 window_start=case when public.tech_feed_preview_usage.window_start<=now()-interval '15 minutes'then now()else public.tech_feed_preview_usage.window_start end
 where public.tech_feed_preview_usage.attempts<5 or public.tech_feed_preview_usage.window_start<=now()-interval '15 minutes' returning attempts into n;
 return n is not null;
end$$;
create function public.tech_feed_access(p_user_id uuid,p_article_id uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.tech_feed_article_sources m join public.tech_feed_subscriptions s using(source_id) where m.article_id=p_article_id and s.user_id=p_user_id and s.subscribed)
 or exists(select 1 from public.tech_feed_bookmarks where user_id=p_user_id and article_id=p_article_id)
 or exists(select 1 from public.tech_feed_todo_links where user_id=p_user_id and article_id=p_article_id);
$$;
create function public.tech_feed_state(p_user_id uuid)returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('enabled',true,'sources',coalesce((select jsonb_agg(jsonb_build_object(
 'id',s.id,'name',s.name,'url',s.url,'kind',s.kind,'recommended',s.recommended,'subscribed',coalesce(sub.subscribed,false),
 'permission_status',s.permission_status,'last_success_at',s.last_success_at,'last_error',s.last_error) order by s.recommended desc,s.name)
 from public.tech_feed_sources s left join public.tech_feed_subscriptions sub on sub.source_id=s.id and sub.user_id=p_user_id
 where s.recommended or s.created_by=p_user_id or sub.user_id is not null),'[]'::jsonb),
 'interests',coalesce((select to_jsonb(interests) from public.tech_feed_preferences where user_id=p_user_id),'[]'::jsonb),
 'last_success_at',(select max(s.last_success_at)from public.tech_feed_sources s join public.tech_feed_subscriptions sub on sub.source_id=s.id where sub.user_id=p_user_id and sub.subscribed));
$$;
create function public.tech_feed_list(p_user_id uuid,p_view text default 'latest',p_interest text default null,p_source_id uuid default null,p_cursor text default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;begin
 if p_view not in('latest','saved')or(p_interest is not null and p_interest not in('ai','frontend','backend','cloud','tools'))then raise exception 'invalid_input';end if;
 with visible as(
 select a.*,coalesce(a.published_at,a.discovered_at) sort_at,exists(select 1 from public.tech_feed_bookmarks b where b.user_id=p_user_id and b.article_id=a.id) saved,
 (select todo_id from public.tech_feed_todo_links l where l.user_id=p_user_id and l.article_id=a.id) todo_id
 from public.tech_feed_articles a where
 ((p_view='saved' and exists(select 1 from public.tech_feed_bookmarks b where b.user_id=p_user_id and b.article_id=a.id))
 or(p_view='latest' and exists(select 1 from public.tech_feed_article_sources m join public.tech_feed_subscriptions s using(source_id) where m.article_id=a.id and s.user_id=p_user_id and s.subscribed)))
 and(p_interest is null or p_interest=any(a.interests))
 and(p_source_id is null or exists(select 1 from public.tech_feed_article_sources m where m.article_id=a.id and m.source_id=p_source_id))
 and(p_cursor is null or (coalesce(a.published_at,a.discovered_at),a.id)<(split_part(p_cursor,'|',1)::timestamptz,split_part(p_cursor,'|',2)::uuid))
 order by coalesce(a.published_at,a.discovered_at) desc,a.id desc limit 21),
 page as(select * from visible order by sort_at desc,id desc limit 20),
 mapped as(select jsonb_build_object('id',a.id,'title',a.title,'url',a.url,'published_at',a.published_at,'discovered_at',a.discovered_at,
 'excerpt',a.excerpt,'summary',a.summary,'summary_status',a.summary_status,'category',a.category,'interests',a.interests,'saved',a.saved,'todo_id',a.todo_id,
 'sources',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) order by s.name)from public.tech_feed_article_sources m join public.tech_feed_sources s on s.id=m.source_id where m.article_id=a.id and(s.recommended or s.created_by=p_user_id or exists(select 1 from public.tech_feed_subscriptions sub where sub.user_id=p_user_id and sub.source_id=s.id))),'[]'::jsonb)) item,a.sort_at,a.id from page a)
 select jsonb_build_object('items',coalesce((select jsonb_agg(item order by sort_at desc,id desc)from mapped),'[]'::jsonb),
 'next_cursor',case when(select count(*)from visible)>20 then(select sort_at::text||'|'||id::text from page order by sort_at,id limit 1)else null end)into result;
 return result;
end$$;

create function public.tech_feed_mutate(p_user_id uuid,p_action text,p_data jsonb default '{}')returns jsonb language plpgsql security invoker set search_path='' as $$
declare sid uuid;aid uuid;tid uuid;gid uuid;existing public.tech_feed_sources;interests text[];
begin
 if p_user_id is null or not exists(select 1 from public.profiles where user_id=p_user_id)then raise exception 'unauthorized';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,98531));
 if p_action='interests' then
  select coalesce(array_agg(distinct value),'{}') into interests from jsonb_array_elements_text(p_data->'interests');
  if not interests <@ array['ai','frontend','backend','cloud','tools']::text[] then raise exception 'invalid_input';end if;
  insert into public.tech_feed_preferences(user_id,interests)values(p_user_id,interests)on conflict(user_id)do update set interests=excluded.interests;
 elsif p_action in('subscribe','add_source')then
  if p_action='add_source'then
   select * into existing from public.tech_feed_sources where url=p_data->>'url';sid:=existing.id;
  else sid:=(p_data->>'source_id')::uuid;select * into existing from public.tech_feed_sources where id=sid;
   if not found or not(existing.recommended or existing.created_by=p_user_id or exists(select 1 from public.tech_feed_subscriptions where source_id=sid and user_id=p_user_id))then raise exception 'not_found';end if;
  end if;
  if (p_action='add_source' or coalesce((p_data->>'subscribed')::boolean,false))and not coalesce(existing.recommended,false)
   and not exists(select 1 from public.tech_feed_subscriptions where user_id=p_user_id and source_id=sid and subscribed)
   and(select count(*)from public.tech_feed_subscriptions s join public.tech_feed_sources f on f.id=s.source_id where s.user_id=p_user_id and s.subscribed and not f.recommended)>=10 then raise exception 'source_limit';end if;
  if sid is null then
   insert into public.tech_feed_sources(name,url,created_by)values(left(p_data->>'name',120),p_data->>'url',p_user_id)
   on conflict(url)do update set url=excluded.url returning id into sid;
  end if;
  insert into public.tech_feed_subscriptions(user_id,source_id,subscribed)values(p_user_id,sid,case when p_action='add_source'then true else(p_data->>'subscribed')::boolean end)
  on conflict(user_id,source_id)do update set subscribed=excluded.subscribed;
  if p_action='add_source'then return jsonb_build_object('source',(select value from jsonb_array_elements(public.tech_feed_state(p_user_id)->'sources')where value->>'id'=sid::text));end if;
 elsif p_action in('save','add_todo')then
  aid:=(p_data->>'article_id')::uuid;
  if not public.tech_feed_access(p_user_id,aid)then raise exception 'not_found';end if;
  if p_action='save'then
   if(p_data->>'saved')::boolean then insert into public.tech_feed_bookmarks(user_id,article_id)values(p_user_id,aid)on conflict do nothing;
   else delete from public.tech_feed_bookmarks where user_id=p_user_id and article_id=aid;end if;
  else
   select todo_id into tid from public.tech_feed_todo_links where user_id=p_user_id and article_id=aid;
   if tid is not null then return jsonb_build_object('todo_id',tid);end if;
   if length(btrim(coalesce(p_data->>'title','')))=0 or length(p_data->>'title')>180 or p_data->>'local_date' is null then raise exception 'invalid_input';end if;
   gid:=(p_data->>'goal_id')::uuid;
   if gid is not null and not exists(select 1 from public.study_goals where id=gid and user_id=p_user_id)then raise exception 'not_found';end if;
   insert into public.study_todos(user_id,title,local_date,start_time,end_time,goal_id)values(p_user_id,btrim(p_data->>'title'),(p_data->>'local_date')::date,(p_data->>'start_time')::time,(p_data->>'end_time')::time,gid)returning id into tid;
   insert into public.tech_feed_todo_links(user_id,article_id,todo_id)values(p_user_id,aid,tid);
   return jsonb_build_object('todo_id',tid);
  end if;
 else raise exception 'invalid_input';
 end if;
 return '{"ok":true}'::jsonb;
end$$;
create function public.tech_feed_claim_sources(p_pilot_ids uuid[],p_limit int default 2)returns setof public.tech_feed_sources
language plpgsql security invoker set search_path='' as $$begin
 return query update public.tech_feed_sources set lease=gen_random_uuid(),lease_until=now()+interval '90 seconds'
 where id in(select s.id from public.tech_feed_sources s where s.permission_status='approved' and s.run_after<=now()and(s.lease_until is null or s.lease_until<now())
 and exists(select 1 from public.tech_feed_subscriptions sub where sub.source_id=s.id and sub.subscribed and sub.user_id=any(p_pilot_ids))
 order by s.run_after,s.id for update skip locked limit least(greatest(p_limit,1),4))returning *;
end$$;
create function public.tech_feed_stage_hn(p_id uuid,p_lease uuid,p_ids bigint[],p_high_water bigint)returns boolean
language plpgsql security invoker set search_path='' as $$begin
 if cardinality(p_ids)>1000 or exists(select 1 from unnest(p_ids)x where x<=0)or p_high_water<0 then raise exception 'invalid_input';end if;
 update public.tech_feed_sources set hn_pending_ids=p_ids,hn_snapshot_high_water=p_high_water
 where id=p_id and lease=p_lease and lease_until>now()and permission_status='approved'and kind='hn'and cardinality(hn_pending_ids)=0;
 return found;
end$$;
create function public.tech_feed_finish_source(p_id uuid,p_lease uuid,p_items jsonb,p_error text default null,p_etag text default null,p_last_modified text default null,p_checkpoint jsonb default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare item jsonb;aid uuid;s public.tech_feed_sources;begin
 select * into s from public.tech_feed_sources where id=p_id and lease=p_lease and lease_until>now()and permission_status='approved'for update;
 if not found then return false;end if;
 if p_error is null then
  if jsonb_typeof(p_items)<>'array'or jsonb_array_length(p_items)>2000 then raise exception 'invalid_input';end if;
  for item in select value from jsonb_array_elements(p_items)loop
   if exists(select 1 from public.tech_feed_seen where source_id=p_id and guid_hash=md5(item->>'guid'))then continue;end if;
   if exists(select 1 from public.tech_feed_seen where url_hash=md5(item->>'url'))
    and not exists(select 1 from public.tech_feed_articles where url=item->>'url')then
    insert into public.tech_feed_seen(source_id,guid_hash,url_hash)values(p_id,md5(item->>'guid'),md5(item->>'url'))on conflict do nothing;
    continue;
   end if;
   insert into public.tech_feed_seen(source_id,guid_hash,url_hash)values(p_id,md5(item->>'guid'),md5(item->>'url'))on conflict do nothing;
   select article_id into aid from public.tech_feed_article_sources where source_id=p_id and guid=item->>'guid';
   if aid is null then
    insert into public.tech_feed_articles(url,title,published_at,excerpt,excerpt_source_id,interests,summary_status)
    values(item->>'url',item->>'title',(item->>'published_at')::timestamptz,coalesce(item->>'excerpt',''),p_id,coalesce(array(select jsonb_array_elements_text(item->'interests')),'{}'),case when length(coalesce(item->>'excerpt',''))<160 then 'insufficient'else 'pending'end)
    on conflict(url)do update set
     excerpt=case when public.tech_feed_articles.summary_status='insufficient'and length(excluded.excerpt)>length(public.tech_feed_articles.excerpt)then excluded.excerpt else public.tech_feed_articles.excerpt end,
     excerpt_source_id=case when public.tech_feed_articles.summary_status='insufficient'and length(excluded.excerpt)>length(public.tech_feed_articles.excerpt)then excluded.excerpt_source_id else public.tech_feed_articles.excerpt_source_id end,
     interests=case when cardinality(public.tech_feed_articles.interests)=0 then excluded.interests else public.tech_feed_articles.interests end,
     summary_status=case when public.tech_feed_articles.summary_status='insufficient'and length(excluded.excerpt)>=160 then 'pending'else public.tech_feed_articles.summary_status end
     returning id into aid;
    insert into public.tech_feed_article_sources(article_id,source_id,guid)values(aid,p_id,item->>'guid')on conflict do nothing;
   end if;
  end loop;
  if p_checkpoint is not null then
   if s.kind<>'hn'or jsonb_typeof(p_checkpoint->'pending_ids')<>'array'or jsonb_array_length(p_checkpoint->'pending_ids')>1000 then raise exception 'invalid_input';end if;
   update public.tech_feed_sources set hn_pending_ids=array(select value::bigint from jsonb_array_elements_text(p_checkpoint->'pending_ids')),
   hn_high_water=case when jsonb_array_length(p_checkpoint->'pending_ids')=0 then greatest(hn_high_water,hn_snapshot_high_water)else hn_high_water end where id=p_id;
  end if;
  update public.tech_feed_sources set last_success_at=now(),last_error=null,failures=0,
  run_after=case when kind='hn'and cardinality(hn_pending_ids)>0 then now()else now()+interval '1 hour'end,
  etag=p_etag,last_modified=p_last_modified,lease=null,lease_until=null where id=p_id;
 else
  update public.tech_feed_sources set last_error='수집에 실패했습니다. 자동으로 다시 시도합니다.',failures=least(failures+1,10),
  run_after=now()+make_interval(hours=>least(24,power(2,least(failures,5))::int)),lease=null,lease_until=null where id=p_id;
 end if;return true;
end$$;
create function public.tech_feed_ai_eligible(p_user_id uuid)returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((select u.attempts from public.coach_ai_usage u join public.profiles p on p.user_id=u.user_id
 where u.user_id=p_user_id and u.local_date=(now()at time zone coalesce(p.time_zone,'Asia/Seoul'))::date),0)<6;
$$;
create function public.tech_feed_begin_summary_attempt(p_ids uuid[],p_leases uuid[],p_user_id uuid)returns boolean
language plpgsql security invoker set search_path='' as $$declare r record;n int:=0;begin
 if cardinality(p_ids)not between 1 and 3 or cardinality(p_ids)<>cardinality(p_leases)
 or(select count(distinct x)from unnest(p_ids)x)<>cardinality(p_ids)then return false;end if;
 for r in select a.id from public.tech_feed_articles a join unnest(p_ids,p_leases)c(id,lease)on c.id=a.id
 where a.summary_lease=c.lease and a.summary_lease_until>now()and a.summary_attempts<3
 and a.summary_attempt_lease is distinct from a.summary_lease
 and exists(select 1 from public.tech_feed_sources s join public.tech_feed_subscriptions sub on sub.source_id=s.id
 where s.id=a.excerpt_source_id and s.permission_status='approved'and s.summary_allowed and sub.subscribed and sub.user_id=p_user_id)
 order by a.id for update of a loop n:=n+1;end loop;
 if n<>cardinality(p_ids)then return false;end if;
 if not public.coach_reserve_ai(p_user_id)then return false;end if;
 update public.tech_feed_articles a set summary_attempts=a.summary_attempts+1,summary_attempt_lease=a.summary_lease where a.id=any(p_ids);
 return true;
end$$;
create function public.tech_feed_claim_summaries(p_pilot_ids uuid[])returns table(article jsonb,user_id uuid,lease uuid)
language plpgsql security invoker set search_path='' as $$declare r record;l uuid;u uuid;begin
 for r in select a.* from public.tech_feed_articles a where a.summary_status in('pending','failed')and length(a.excerpt)>=160 and a.summary_attempts<3
 and(a.summary_retry_at is null or a.summary_retry_at<=now())and(a.summary_lease_until is null or a.summary_lease_until<now())
 and exists(select 1 from public.tech_feed_article_sources m join public.tech_feed_sources s on s.id=m.source_id join public.tech_feed_subscriptions sub on sub.source_id=s.id
 where m.article_id=a.id and s.id=a.excerpt_source_id and s.permission_status='approved'and s.summary_allowed and sub.subscribed and sub.user_id=any(p_pilot_ids)and public.tech_feed_ai_eligible(sub.user_id))
 order by a.discovered_at desc,a.id for update skip locked limit 3 loop
  select sub.user_id into u from public.tech_feed_article_sources m join public.tech_feed_sources s on s.id=m.source_id join public.tech_feed_subscriptions sub on sub.source_id=s.id
  where m.article_id=r.id and s.id=r.excerpt_source_id and s.permission_status='approved'and s.summary_allowed and sub.subscribed and sub.user_id=any(p_pilot_ids)and public.tech_feed_ai_eligible(sub.user_id)order by sub.created_at,sub.user_id limit 1;
  l:=gen_random_uuid();update public.tech_feed_articles set summary_lease=l,summary_lease_until=now()+interval '90 seconds' where id=r.id;
  article:=to_jsonb(r)||'{"permission_status":"approved"}'::jsonb;user_id:=u;lease:=l;return next;
 end loop;
end$$;
create function public.tech_feed_finish_summary(p_id uuid,p_lease uuid,p_user_id uuid,p_summary jsonb,p_status text,p_category text default null)returns boolean
language plpgsql security invoker set search_path='' as $$begin
 if p_status not in('ready','failed','insufficient','deferred')then raise exception 'invalid_input';end if;
 if p_status='ready'and(p_summary is null or jsonb_typeof(p_summary)<>'object'or(select count(*)from jsonb_object_keys(p_summary))<>3
 or not(p_summary?'technology'and p_summary?'change'and p_summary?'usage')
 or exists(select 1 from jsonb_each(p_summary)where jsonb_typeof(value)<>'string'or length(value#>>'{}')not between 1 and 500))then raise exception 'invalid_input';end if;
 update public.tech_feed_articles a set category=case when p_status='ready'and p_category in('news','practice','deep_dive')then p_category else null end,
 summary=case when p_status='ready'then p_summary else null end,summary_status=case when p_status='deferred'then 'pending'else p_status end,
 summary_lease=null,summary_lease_until=null,summary_retry_at=now()+case when p_status='deferred'then interval '15 minutes'else interval '1 day'end
 where a.id=p_id and a.summary_lease=p_lease and a.summary_lease_until>now()
 and(p_status in('deferred','insufficient')or a.summary_attempt_lease=a.summary_lease)
 and exists(select 1 from public.tech_feed_article_sources m join public.tech_feed_sources s on s.id=m.source_id join public.tech_feed_subscriptions sub on sub.source_id=s.id
 where m.article_id=a.id and s.id=a.excerpt_source_id and s.permission_status='approved'and s.summary_allowed and sub.subscribed and sub.user_id=p_user_id);
 return found;
end$$;
create function public.tech_feed_start_run()returns uuid language sql security invoker set search_path='' as $$
 insert into public.tech_feed_runs default values returning id;
$$;
create function public.tech_feed_finish_run(p_id uuid,p_counts jsonb,p_error text default null)returns boolean language plpgsql security invoker set search_path='' as $$begin
 update public.tech_feed_runs set finished_at=now(),
 collection_success=coalesce((p_counts->>'collected')::int,0),collection_failed=coalesce((p_counts->>'failed')::int,0),
 summary_success=coalesce((p_counts->>'summarized')::int,0),summary_failed=coalesce((p_counts->>'summary_failed')::int,0),summary_deferred=coalesce((p_counts->>'summary_deferred')::int,0),
 status=case when p_error is not null then 'failed'when coalesce((p_counts->>'failed')::int,0)+coalesce((p_counts->>'summary_failed')::int,0)>0 then 'partial'else 'completed'end,
 error_code=case when p_error='worker_timeout'then 'worker_timeout'when p_error is not null then 'worker_failed'
 when coalesce((p_counts->>'failed')::int,0)>0 then 'source_failed'when coalesce((p_counts->>'summary_failed')::int,0)>0 then 'summary_failed'else null end
 where id=p_id and status='running';return found;
end$$;
create function public.tech_feed_cleanup()returns integer language plpgsql security invoker set search_path='' as $$declare n int;begin
 update public.tech_feed_runs set status='abandoned',finished_at=now(),error_code='worker_expired'where id in(select id from public.tech_feed_runs where status='running'and started_at<now()-interval '10 minutes'order by started_at limit 500);
 delete from public.tech_feed_runs where id in(select id from public.tech_feed_runs where started_at<now()-interval '30 days'order by started_at limit 500);
 delete from public.tech_feed_articles where id in(select a.id from public.tech_feed_articles a where a.discovered_at<now()-interval '90 days'
 and not exists(select 1 from public.tech_feed_bookmarks b where b.article_id=a.id)
 and not exists(select 1 from public.tech_feed_todo_links l where l.article_id=a.id)
 and(a.summary_lease_until is null or a.summary_lease_until<now())order by a.discovered_at limit 500);
 get diagnostics n=row_count;return n;
end$$;
-- Explicit grants: none of these user-ID-accepting RPCs may be called by a browser.
do $$declare f regprocedure;begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname like 'tech_feed_%' loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to service_role',f);
 end loop;
end$$;
