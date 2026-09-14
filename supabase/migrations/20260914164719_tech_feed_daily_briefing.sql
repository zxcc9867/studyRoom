-- Rules use public content only. Per-user topic matches are derived in Edge.
alter table public.tech_feed_articles
 add column category_method text check(category_method in('ai','rules')),
 add column rules_version integer not null default 0,add column topics text[] not null default '{}',
 add column classification_lease uuid,add column classification_lease_until timestamptz,add column classification_input text;
create index tech_feed_classification_due on public.tech_feed_articles(rules_version,classification_lease_until,id);
create index tech_feed_article_topics on public.tech_feed_articles using gin(topics);
create index tech_feed_article_discovered on public.tech_feed_articles(discovered_at,id);
create function public.tech_feed_classification_claim(p_version integer,p_limit integer default 50)returns jsonb language plpgsql security invoker set search_path='' as $$
declare r record;token uuid;result jsonb:='[]';begin
 if p_version<1 then raise exception 'invalid_input';end if;
 for r in select a.* from public.tech_feed_articles a where a.rules_version<p_version and(a.classification_lease_until is null or a.classification_lease_until<=now())
 order by a.rules_version,a.id for update skip locked limit greatest(0,least(coalesce(p_limit,50),50))loop
  token:=gen_random_uuid();update public.tech_feed_articles set classification_lease=token,classification_lease_until=now()+interval '90 seconds',
  classification_input=md5(jsonb_build_array(r.title,r.excerpt,r.category,r.category_method,r.summary_status)::text)where id=r.id;
  result:=result||jsonb_build_array(jsonb_build_object('id',r.id,'title',r.title,'excerpt',r.excerpt,'category',r.category,'category_method',r.category_method,'summary_status',r.summary_status,'lease',token));
 end loop;return result;
end$$;
create function public.tech_feed_classification_finish(p_id uuid,p_lease uuid,p_version integer,p_category text,p_method text,p_topics text[])returns boolean language plpgsql security invoker set search_path='' as $$begin
 if p_version<1 or coalesce(cardinality(p_topics),0)>12 or exists(select 1 from unnest(p_topics)t where length(t)not between 1 and 32)
 or p_method not in('ai','rules')or p_category not in('news','practice','deep_dive')then return false;end if;
 update public.tech_feed_articles a set category=p_category,category_method=p_method,topics=coalesce(p_topics,'{}'),rules_version=p_version,
 classification_lease=null,classification_lease_until=null,classification_input=null
 where a.id=p_id and a.classification_lease=p_lease and a.classification_lease_until>now()and a.rules_version<p_version
 and a.classification_input=md5(jsonb_build_array(a.title,a.excerpt,a.category,a.category_method,a.summary_status)::text);return found;
end$$;
create function public.tech_feed_classification_finish_batch(p_items jsonb)returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb;n integer:=0;stale integer:=0;begin
 if jsonb_typeof(p_items) is distinct from 'array'or jsonb_array_length(p_items)>50 then raise exception 'invalid_input';end if;
 for item in select value from jsonb_array_elements(p_items)loop
  if public.tech_feed_classification_finish((item->>'id')::uuid,(item->>'lease')::uuid,(item->>'rules_version')::integer,item->>'category',item->>'method',array(select jsonb_array_elements_text(item->'tags')))then n:=n+1;else stale:=stale+1;end if;
 end loop;return jsonb_build_object('classified',n,'stale',stale);
end$$;
create function public.tech_feed_classification_changed()returns trigger language plpgsql set search_path='' as $$begin
 if new.title is distinct from old.title or new.excerpt is distinct from old.excerpt then new.rules_version:=0;new.topics:='{}';end if;
 if new.summary_status='ready'and new.category is not null and(new.summary is distinct from old.summary or new.summary_status is distinct from old.summary_status or new.summary_lease is distinct from old.summary_lease)then new.category_method:='ai';
 elsif new.category is null then new.category_method:=null;end if;return new;
end$$;
create trigger tech_feed_classification_changed before update on public.tech_feed_articles for each row execute function public.tech_feed_classification_changed();

-- A single visible universe, without cursor/filter restrictions.
create function public.tech_feed_visible(p_user_id uuid,p_view text default 'latest',p_from timestamptz default null,p_until timestamptz default null)returns setof public.tech_feed_articles language sql stable security invoker set search_path='' as $$
 select a.* from public.tech_feed_articles a where(p_from is null or a.discovered_at>=p_from)and(p_until is null or a.discovered_at<p_until)and((p_view='saved'and exists(select 1 from public.tech_feed_bookmarks b where b.user_id=p_user_id and b.article_id=a.id))
 or(p_view='latest'and(exists(select 1 from public.tech_feed_article_sources m join public.tech_feed_subscriptions s using(source_id)where m.article_id=a.id and s.user_id=p_user_id and s.subscribed)
 or exists(select 1 from public.tech_feed_topic_articles ta join public.tech_feed_topic_memberships tm using(topic_id)where ta.article_id=a.id and tm.user_id=p_user_id))));
$$;
create function public.tech_feed_article_facets(p_user_id uuid,p_article_id uuid)returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('value',x.value,'label',x.label)order by x.value),'[]')from(
 select 'rss:'||s.id::text value,s.name label from public.tech_feed_article_sources m join public.tech_feed_sources s on s.id=m.source_id where m.article_id=p_article_id
 and(s.recommended or s.created_by=p_user_id or exists(select 1 from public.tech_feed_subscriptions sub where sub.user_id=p_user_id and sub.source_id=s.id))
 union all select 'host:'||lower(split_part(split_part(regexp_replace(a.url,'^https?://',''), '/',1),':',1)),lower(split_part(split_part(regexp_replace(a.url,'^https?://',''), '/',1),':',1))
 from public.tech_feed_articles a where a.id=p_article_id and a.origin='web_search'and a.excerpt_source_id is null)x;
$$;
create function public.tech_feed_filter_candidates(p_user_id uuid,p_view text default 'latest')returns jsonb language plpgsql stable security invoker set search_path='' as $$begin
 if p_view not in('latest','saved')then raise exception 'invalid_input';end if;
 return jsonb_build_object('prompt',coalesce((select prompt from public.tech_feed_preferences where user_id=p_user_id),''),
 'items',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'excerpt',a.excerpt,'category',a.category,'category_method',a.category_method,
 'summary_status',a.summary_status,'rules_version',a.rules_version,'topics',a.topics,'sources',public.tech_feed_article_facets(p_user_id,a.id)))from public.tech_feed_visible(p_user_id,p_view)a),'[]'));
end$$;
-- Preserve the original five positional arguments; remove overload ambiguity.
drop function public.tech_feed_list(uuid,text,text,uuid,text);
create function public.tech_feed_list(p_user_id uuid,p_view text default 'latest',p_interest text default null,p_source_id uuid default null,p_cursor text default null,p_source_key text default null,p_article_ids uuid[] default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$declare result jsonb;begin
 if p_view not in('latest','saved')or(p_interest is not null and p_interest not in('ai','frontend','backend','cloud','tools'))then raise exception 'invalid_input';end if;
 with filtered as(select a.*,coalesce(a.published_at,a.discovered_at)sort_at,exists(select 1 from public.tech_feed_bookmarks b where b.user_id=p_user_id and b.article_id=a.id)saved,
 (select todo_id from public.tech_feed_todo_links l where l.user_id=p_user_id and l.article_id=a.id)todo_id from public.tech_feed_visible(p_user_id,p_view)a
 where(p_interest is null or p_interest=any(a.interests))and(p_source_id is null or exists(select 1 from public.tech_feed_article_sources m where m.article_id=a.id and m.source_id=p_source_id))
 and(p_source_key is null or exists(select 1 from jsonb_array_elements(public.tech_feed_article_facets(p_user_id,a.id))s where s->>'value'=p_source_key))and(p_article_ids is null or a.id=any(p_article_ids))),
 visible as(select * from filtered where p_cursor is null or(sort_at,id)<(split_part(p_cursor,'|',1)::timestamptz,split_part(p_cursor,'|',2)::uuid)order by sort_at desc,id desc limit 21),
 page as(select * from visible order by sort_at desc,id desc limit 20),mapped as(select jsonb_build_object(
 'id',a.id,'title',a.title,'url',a.url,'published_at',a.published_at,'discovered_at',a.discovered_at,
 'media',case when m.status='ready'then jsonb_build_object('image_url',m.image_url,'video',m.video)else null end,
 'title_ko',t.title_ko,'excerpt_ko',t.excerpt_ko,'translation_status',coalesce(t.status,'pending'),
 'excerpt',a.excerpt,'summary',a.summary,'summary_status',a.summary_status,'category',a.category,'interests',a.interests,'saved',a.saved,'todo_id',a.todo_id,
 'topics',a.topics,'category_method',a.category_method,'rules_version',a.rules_version,
 'origin',case when a.excerpt_source_id is not null then 'rss'else a.origin end,'excerpt_provenance',case when a.excerpt_source_id is not null or a.origin='rss'then 'source_excerpt'else 'search_snippet'end,
 'matched_topics',coalesce((select jsonb_agg(p.prompt)from public.tech_feed_topic_articles ta join public.tech_feed_topic_memberships tm using(topic_id)join public.tech_feed_preferences p using(user_id)where ta.article_id=a.id and tm.user_id=p_user_id),'[]'),
 'sources',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name)order by s.name)from public.tech_feed_article_sources x join public.tech_feed_sources s on s.id=x.source_id where x.article_id=a.id and(s.recommended or s.created_by=p_user_id or exists(select 1 from public.tech_feed_subscriptions sub where sub.user_id=p_user_id and sub.source_id=s.id))),'[]'))item,a.sort_at,a.id
 from page a left join public.tech_feed_translations t on t.article_id=a.id and t.source_title=a.title and t.source_excerpt=coalesce(a.excerpt,'')left join public.tech_feed_media m on m.article_id=a.id and m.source_url=a.url)
 select jsonb_build_object('_prompt',coalesce((select prompt from public.tech_feed_preferences where user_id=p_user_id),''),'items',coalesce((select jsonb_agg(item order by sort_at desc,id desc)from mapped),'[]'),'total',(select count(*)from filtered),
 'next_cursor',case when(select count(*)from visible)>20 then(select sort_at::text||'|'||id::text from page order by sort_at,id limit 1)else null end)into result;return result;
end$$;

create table public.tech_feed_briefings(
 user_id uuid not null references auth.users on delete cascade,local_date date not null,time_zone text not null,
 analyzer_version integer not null,input_hash text,input_ids uuid[] not null default '{}',lease uuid,lease_until timestamptz,reserved_lease uuid,
 result jsonb,result_hash text,result_ids uuid[] not null default '{}',result_version integer,result_access jsonb,
 generated_at timestamptz,last_error text,updated_at timestamptz not null default now(),
 primary key(user_id,local_date,time_zone),check(cardinality(input_ids)<=24),check(cardinality(result_ids)<=24));
create index tech_feed_briefing_cleanup on public.tech_feed_briefings(updated_at);
alter table public.tech_feed_briefings enable row level security;
revoke all on public.tech_feed_briefings from public,anon,authenticated;
-- Only harmless owner metadata is directly readable. Result/input columns must
-- go through the API, which revalidates every analyzed article after revocation.
grant select(user_id,local_date,time_zone,generated_at)on public.tech_feed_briefings to authenticated;grant all on public.tech_feed_briefings to service_role;
create policy tech_feed_briefing_owner on public.tech_feed_briefings for select to authenticated using(user_id=(select auth.uid()));
-- Ignore receiving here, so pausing retains safe statistics/cache; actual reservations require receiving.
create function public.tech_feed_briefing_excerpt_allowed(p_user_id uuid,p_id uuid)returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.tech_feed_articles a where a.id=p_id and length(btrim(a.excerpt))>=160
 and a.url!~*'^https?://([^/]+\.)?(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|dailymotion\.com)([:/]|$)'
 and not exists(select 1 from public.tech_feed_media m where m.article_id=a.id and m.source_url=a.url and m.status='ready'and m.video is not null)
 and((a.excerpt_source_id is not null and exists(select 1 from public.tech_feed_sources s join public.tech_feed_subscriptions sub on sub.source_id=s.id
 where s.id=a.excerpt_source_id and s.permission_status='approved'and s.summary_allowed and sub.user_id=p_user_id and sub.subscribed))
 or(a.origin='web_search'and a.excerpt_source_id is null and exists(select 1 from public.tech_feed_topic_articles ta join public.tech_feed_topic_memberships tm using(topic_id)where ta.article_id=a.id and tm.user_id=p_user_id))));
$$;
create function public.tech_feed_briefing_snapshot(p_user_id uuid,p_version integer,p_now timestamptz default now())returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare zone text;day date;items jsonb;fingerprint text;c public.tech_feed_briefings;cache jsonb:=null;is_receiving boolean;begin
 select coalesce(p.time_zone,'Asia/Seoul')into zone from public.profiles p where p.user_id=p_user_id;if zone is null then raise exception 'not_found';end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=zone)then zone:='Asia/Seoul';end if;day:=(p_now at time zone zone)::date;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'url',a.url,'title',a.title,'excerpt',a.excerpt,'discovered_at',a.discovered_at,
 'category',a.category,'category_method',a.category_method,'summary_status',a.summary_status,'rules_version',a.rules_version,'topics',a.topics,
 'eligible',public.tech_feed_briefing_excerpt_allowed(p_user_id,a.id),'excerpt_source_id',a.excerpt_source_id,'sources',public.tech_feed_article_facets(p_user_id,a.id))order by a.id),'[]')into items
 from public.tech_feed_visible(p_user_id,'latest',day::timestamp at time zone zone,(day+1)::timestamp at time zone zone)a;
 fingerprint:=md5(jsonb_build_array(p_version,zone,day,items,coalesce((select prompt from public.tech_feed_preferences where user_id=p_user_id),''))::text);
 select * into c from public.tech_feed_briefings where user_id=p_user_id and local_date=day and time_zone=zone;
 if c.result is not null and c.result_version=p_version and not exists(select 1 from unnest(c.result_ids)id where not exists(
 select 1 from jsonb_array_elements(items)a where a->>'id'=id::text and(a->>'eligible')::boolean and c.result_access->id::text=jsonb_build_array(a->>'url',a->>'excerpt_source_id')))
 then cache:=jsonb_build_object('result',c.result,'generated_at',c.generated_at,'stale',c.result_hash<>fingerprint);end if;
 is_receiving:=not exists(select 1 from public.tech_feed_preferences p where p.user_id=p_user_id and not p.receiving);
 return jsonb_build_object('local_date',day,'time_zone',zone,'articles',items,'input_hash',fingerprint,
 'prompt',coalesce((select prompt from public.tech_feed_preferences where user_id=p_user_id),''),'receiving',is_receiving,'cache',cache,
 'generating',coalesce(c.lease is not null and c.lease_until>p_now,false),'last_error',c.last_error);
end$$;
create function public.tech_feed_briefing_claim(p_user_id uuid,p_version integer,p_hash text,p_ids uuid[])returns jsonb language plpgsql security invoker set search_path='' as $$declare s jsonb;token uuid;begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,98531));s:=public.tech_feed_briefing_snapshot(p_user_id,p_version);
 if not(s->>'receiving')::boolean then return '{"status":"paused"}';end if;
 if s->'cache' is not null and s->'cache'<>'null'::jsonb and not(s->'cache'->>'stale')::boolean then return '{"status":"ready"}';end if;
 if(s->>'generating')::boolean then return '{"status":"generating"}';end if;
 if p_hash is distinct from s->>'input_hash'then return '{"status":"unavailable"}';end if;
 if coalesce(cardinality(p_ids),0)<2 then return '{"status":"insufficient"}';end if;
 if cardinality(p_ids)>24 or(select count(distinct id)from unnest(p_ids)id)<>cardinality(p_ids)
 or exists(select 1 from unnest(p_ids)id where not exists(select 1 from jsonb_array_elements(s->'articles')a where a->>'id'=id::text and(a->>'eligible')::boolean))then return '{"status":"unavailable"}';end if;
 token:=gen_random_uuid();insert into public.tech_feed_briefings(user_id,local_date,time_zone,analyzer_version,input_hash,input_ids,lease,lease_until)
 values(p_user_id,(s->>'local_date')::date,s->>'time_zone',p_version,p_hash,p_ids,token,now()+interval '90 seconds')
 on conflict(user_id,local_date,time_zone)do update set analyzer_version=excluded.analyzer_version,input_hash=excluded.input_hash,input_ids=excluded.input_ids,lease=excluded.lease,lease_until=excluded.lease_until,reserved_lease=null,last_error=null,updated_at=now();
 return jsonb_build_object('status','claimed','lease',token);
end$$;
create function public.tech_feed_briefing_reserve(p_user_id uuid,p_lease uuid)returns jsonb language plpgsql security invoker set search_path='' as $$declare c public.tech_feed_briefings;s jsonb;begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,98531));select * into c from public.tech_feed_briefings where user_id=p_user_id and lease=p_lease and lease_until>now()for update;
 if not found then return '{"status":"unavailable"}';end if;s:=public.tech_feed_briefing_snapshot(p_user_id,c.analyzer_version);
 if not(s->>'receiving')::boolean then return '{"status":"paused"}';end if;
 if s->>'input_hash' is distinct from c.input_hash then return '{"status":"unavailable"}';end if;
 if c.reserved_lease=p_lease then return '{"status":"generating"}';end if;
 if not public.coach_reserve_ai(p_user_id)then return '{"status":"quota_exhausted"}';end if;
 update public.tech_feed_briefings set reserved_lease=p_lease where user_id=p_user_id and lease=p_lease;return '{"status":"reserved"}';
end$$;
create function public.tech_feed_briefing_finish(p_user_id uuid,p_lease uuid,p_result jsonb,p_error text default null)returns boolean language plpgsql security invoker set search_path='' as $$declare c public.tech_feed_briefings;s jsonb;access_map jsonb;begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,98531));select * into c from public.tech_feed_briefings where user_id=p_user_id and lease=p_lease and lease_until>now()for update;
 if not found then return false;end if;s:=public.tech_feed_briefing_snapshot(p_user_id,c.analyzer_version);
 if p_error is null then
  if c.reserved_lease is distinct from p_lease or not(s->>'receiving')::boolean or s->>'input_hash' is distinct from c.input_hash then return false;end if;
  if jsonb_typeof(p_result)<>'object'or jsonb_typeof(p_result->'insights')<>'array'or jsonb_array_length(p_result->'insights')not between 1 and 3 or(p_result->>'analyzed_count')::integer<>cardinality(c.input_ids)then return false;end if;
  if exists(select 1 from jsonb_array_elements(p_result->'insights')i where jsonb_typeof(i->'source_ids')<>'array'or jsonb_array_length(i->'source_ids')not between 1 and 3
  or exists(select 1 from jsonb_array_elements_text(i->'source_ids')id where not id=any(c.input_ids::text[])))then return false;end if;
  select jsonb_object_agg(a->>'id',jsonb_build_array(a->>'url',a->>'excerpt_source_id'))into access_map from jsonb_array_elements(s->'articles')a where(a->>'id')::uuid=any(c.input_ids);
  update public.tech_feed_briefings set result=p_result,result_hash=c.input_hash,result_ids=c.input_ids,result_version=c.analyzer_version,result_access=access_map,
  generated_at=now(),lease=null,lease_until=null,reserved_lease=null,last_error=null,updated_at=now()where user_id=p_user_id and lease=p_lease;
 else update public.tech_feed_briefings set lease=null,lease_until=null,reserved_lease=null,last_error=case when p_error in('paused','quota_exhausted','insufficient')then p_error else 'unavailable'end,updated_at=now()where user_id=p_user_id and lease=p_lease;
 end if;return true;
end$$;
alter function public.tech_feed_cleanup()rename to tech_feed_cleanup_before_briefing;
create function public.tech_feed_cleanup()returns integer language plpgsql security invoker set search_path='' as $$declare n integer;begin
 delete from public.tech_feed_briefings where(user_id,local_date,time_zone)in(select user_id,local_date,time_zone from public.tech_feed_briefings where updated_at<now()-interval '90 days'and(lease_until is null or lease_until<=now())order by updated_at limit 100);
 n:=public.tech_feed_cleanup_before_briefing();return n;
end$$;
-- Browsers cannot invoke user-ID/worker RPCs or internal helpers.
do $$declare f regprocedure;begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname like 'tech_feed_%'loop
 execute format('revoke all on function %s from public,anon,authenticated',f);execute format('grant execute on function %s to service_role',f);end loop;
end$$;
