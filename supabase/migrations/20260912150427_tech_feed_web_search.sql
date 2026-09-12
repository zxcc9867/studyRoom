-- App-owned basic search: public evidence, private subscriptions, server-only jobs.
alter table public.tech_feed_preferences add column prompt text not null default '',add column receiving boolean not null default false,add column revision integer not null default 0 check(revision>=0);
alter table public.tech_feed_articles add column origin text not null default 'rss' check(origin in('rss','web_search'));
create table public.tech_feed_search_topics(id uuid primary key default gen_random_uuid(),canonical text not null unique check(length(canonical)between 3 and 300),run_after timestamptz not null default now(),last_success_at timestamptz,last_attempt_at timestamptz,status text not null default 'waiting' check(status in('waiting','ready','unavailable','quota_exhausted')),failures integer not null default 0,lease uuid,lease_until timestamptz,reserved_lease uuid);
create index tech_feed_search_due on public.tech_feed_search_topics(run_after,id);
create table public.tech_feed_topic_memberships(user_id uuid primary key references auth.users on delete cascade,topic_id uuid not null references public.tech_feed_search_topics on delete cascade);
create index tech_feed_topic_subscribers on public.tech_feed_topic_memberships(topic_id,user_id);
create table public.tech_feed_topic_articles(topic_id uuid not null references public.tech_feed_search_topics on delete cascade,article_id uuid not null references public.tech_feed_articles on delete cascade,snippet text not null check(length(snippet)<=2000),primary key(topic_id,article_id));
create index tech_feed_topic_article_access on public.tech_feed_topic_articles(article_id,topic_id);
create table public.tech_feed_search_provider(id boolean primary key default true check(id),lease uuid,lease_until timestamptz,status text not null default 'waiting',run_after timestamptz not null default now());
insert into public.tech_feed_search_provider(id)values(true);
create table public.tech_feed_search_budget(month date primary key,attempts integer not null default 0 check(attempts between 0 and 900));
do $$declare t text;begin
 foreach t in array array['tech_feed_search_topics','tech_feed_topic_memberships','tech_feed_topic_articles','tech_feed_search_provider','tech_feed_search_budget']loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);
 end loop;
end$$;
grant select on public.tech_feed_topic_memberships,public.tech_feed_topic_articles to authenticated;
create policy tech_feed_topic_owner on public.tech_feed_topic_memberships for select to authenticated using(user_id=(select auth.uid()));
create policy tech_feed_topic_article_owner on public.tech_feed_topic_articles for select to authenticated using(exists(select 1 from public.tech_feed_topic_memberships m where m.topic_id=tech_feed_topic_articles.topic_id and m.user_id=(select auth.uid())));
create policy tech_feed_search_article_read on public.tech_feed_articles for select to authenticated using(exists(select 1 from public.tech_feed_topic_articles a join public.tech_feed_topic_memberships m using(topic_id)where a.article_id=id and m.user_id=(select auth.uid())));
create or replace function public.tech_feed_access(p_user_id uuid,p_article_id uuid)returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.tech_feed_article_sources m join public.tech_feed_subscriptions s using(source_id)where m.article_id=p_article_id and s.user_id=p_user_id and s.subscribed)
 or exists(select 1 from public.tech_feed_topic_articles a join public.tech_feed_topic_memberships m using(topic_id)where a.article_id=p_article_id and m.user_id=p_user_id)
 or exists(select 1 from public.tech_feed_bookmarks where user_id=p_user_id and article_id=p_article_id)
 or exists(select 1 from public.tech_feed_todo_links where user_id=p_user_id and article_id=p_article_id);
$$;
alter function public.tech_feed_state(uuid)rename to tech_feed_source_state;
create function public.tech_feed_state(p_user_id uuid)returns jsonb language sql stable security invoker set search_path='' as $$
 select public.tech_feed_source_state(p_user_id)||jsonb_build_object('preferences',jsonb_build_object('prompt',coalesce(p.prompt,''),'receiving',coalesce(p.receiving,false),'revision',coalesce(p.revision,0)),'search_status',jsonb_build_object('state',case when not coalesce(p.receiving,false)then 'paused'when v.status in('unavailable','quota_exhausted')then v.status else coalesce(t.status,'waiting')end,'last_success_at',t.last_success_at))
 from (select p_user_id user_id)x left join public.tech_feed_preferences p using(user_id)left join public.tech_feed_topic_memberships m using(user_id)left join public.tech_feed_search_topics t on t.id=m.topic_id cross join public.tech_feed_search_provider v;
$$;
create function public.tech_feed_configure(p_user_id uuid,p_prompt text,p_canonical text,p_receiving boolean,p_expected_revision integer)returns jsonb language plpgsql security invoker set search_path='' as $$
declare tid uuid;r integer;begin
 if p_user_id is null or not exists(select 1 from public.profiles where user_id=p_user_id)then raise exception 'unauthorized';end if;
 if p_prompt is null or length(p_prompt)not between 3 and 300 or p_canonical is null or length(p_canonical)not between 3 and 300 or p_expected_revision is null or p_expected_revision<0 or p_receiving is null then raise exception 'invalid_input';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,98531));
 insert into public.tech_feed_preferences(user_id)values(p_user_id)on conflict do nothing;
 select revision into r from public.tech_feed_preferences where user_id=p_user_id for update;
 if r<>p_expected_revision then raise exception 'revision_conflict';end if;
 insert into public.tech_feed_search_topics(canonical)values(p_canonical)on conflict(canonical)do update set canonical=excluded.canonical returning id into tid;
 insert into public.tech_feed_topic_memberships(user_id,topic_id)values(p_user_id,tid)on conflict(user_id)do update set topic_id=excluded.topic_id;
 update public.tech_feed_preferences set prompt=p_prompt,receiving=p_receiving,revision=r+1 where user_id=p_user_id;
 if p_receiving then insert into public.tech_feed_subscriptions(user_id,source_id)select p_user_id,id from public.tech_feed_sources where recommended and permission_status='approved'on conflict do nothing;end if;
 return public.tech_feed_state(p_user_id);
end$$;
create function public.tech_feed_receiving(p_user_id uuid,p_receiving boolean,p_expected_revision integer)returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.tech_feed_preferences;c text;begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,98531));
 select * into p from public.tech_feed_preferences where user_id=p_user_id for update;if not found then raise exception 'invalid_input';end if;
 select t.canonical into c from public.tech_feed_topic_memberships m join public.tech_feed_search_topics t on t.id=m.topic_id where m.user_id=p_user_id;
 return public.tech_feed_configure(p_user_id,p.prompt,c,p_receiving,p_expected_revision);
end$$;
create function public.tech_feed_recipients()returns uuid[] language sql stable security invoker set search_path='' as $$select coalesce(array_agg(user_id),'{}')from public.tech_feed_preferences where receiving$$;
create function public.tech_feed_search_claim(p_recipients uuid[] default null)returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.tech_feed_search_topics;l uuid;begin
 perform 1 from public.tech_feed_search_provider where id and run_after<=now()and(lease_until is null or lease_until<now())for update skip locked;if not found then return null;end if;
 select * into t from public.tech_feed_search_topics s where run_after<=now()and(lease_until is null or lease_until<now())and exists(select 1 from public.tech_feed_topic_memberships m join public.tech_feed_preferences p using(user_id)where m.topic_id=s.id and p.receiving and(p_recipients is null or m.user_id=any(p_recipients)))order by run_after,last_attempt_at nulls first,id for update skip locked limit 1;
 if not found then return null;end if;
 l:=gen_random_uuid();update public.tech_feed_search_provider set lease=l,lease_until=now()+interval '90 seconds'where id;
 update public.tech_feed_search_topics set lease=l,lease_until=now()+interval '90 seconds',run_after=now()+interval '1 hour'where id=t.id;
 return jsonb_build_object('id',t.id,'lease',l,'canonical',t.canonical);
end$$;
create function public.tech_feed_search_reserve(p_id uuid,p_lease uuid,p_cap integer default 900)returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;begin
 perform 1 from public.tech_feed_search_provider where id and lease=p_lease and lease_until>now()for update;if not found then return false;end if;
 perform 1 from public.tech_feed_search_topics where id=p_id and lease=p_lease and lease_until>now()and reserved_lease is distinct from p_lease for update;if not found then return false;end if;
 insert into public.tech_feed_search_budget(month)values(date_trunc('month',now()at time zone 'UTC')::date)on conflict do nothing;
 update public.tech_feed_search_budget set attempts=attempts+1 where month=date_trunc('month',now()at time zone 'UTC')::date and attempts<least(greatest(coalesce(p_cap,900),0),900)returning attempts into n;
 if n is null then update public.tech_feed_search_provider set status='quota_exhausted'where id;return false;end if;
 update public.tech_feed_search_topics set reserved_lease=p_lease,last_attempt_at=now()where id=p_id;return true;
end$$;
create function public.tech_feed_search_finish(p_id uuid,p_lease uuid,p_items jsonb,p_error text default null)returns boolean language plpgsql security invoker set search_path='' as $$
declare t public.tech_feed_search_topics;item jsonb;aid uuid;begin
 perform 1 from public.tech_feed_search_provider where id and lease=p_lease and lease_until>now()for update;if not found then return false;end if;
 select * into t from public.tech_feed_search_topics where id=p_id and lease=p_lease and lease_until>now()for update;if not found then return false;end if;
 if p_error is null then
  if t.reserved_lease is distinct from p_lease or jsonb_typeof(p_items)<>'array'or jsonb_array_length(p_items)>5 then raise exception 'invalid_input';end if;
  for item in select value from jsonb_array_elements(p_items)loop
   insert into public.tech_feed_articles as existing(url,title,published_at,excerpt,origin,interests,summary_status)values(item->>'url',item->>'title',(item->>'published_at')::timestamptz,coalesce(item->>'excerpt',''),'web_search',coalesce(array(select jsonb_array_elements_text(item->'interests')),'{}'),case when length(coalesce(item->>'excerpt',''))>=160 then 'pending'else 'insufficient'end)on conflict(url)do update set
    title=excluded.title,excerpt=excluded.excerpt,interests=excluded.interests,
    summary=case when (existing.title is distinct from excluded.title or existing.excerpt is distinct from excluded.excerpt)then null else existing.summary end,
    summary_status=case when (existing.title is distinct from excluded.title or existing.excerpt is distinct from excluded.excerpt)then excluded.summary_status else existing.summary_status end,
    category=case when (existing.title is distinct from excluded.title or existing.excerpt is distinct from excluded.excerpt)then null else existing.category end,
    summary_attempts=case when (existing.title is distinct from excluded.title or existing.excerpt is distinct from excluded.excerpt)then 0 else existing.summary_attempts end,
    summary_lease=case when (existing.title is distinct from excluded.title or existing.excerpt is distinct from excluded.excerpt)then null else existing.summary_lease end,
    summary_attempt_lease=case when (existing.title is distinct from excluded.title or existing.excerpt is distinct from excluded.excerpt)then null else existing.summary_attempt_lease end,
    summary_lease_until=case when (existing.title is distinct from excluded.title or existing.excerpt is distinct from excluded.excerpt)then null else existing.summary_lease_until end,
    summary_retry_at=case when (existing.title is distinct from excluded.title or existing.excerpt is distinct from excluded.excerpt)then null else existing.summary_retry_at end
    -- Attribution alone does not own the excerpt; an adopted RSS excerpt has excerpt_source_id.
    -- Search-owned evidence can refresh without changing original sort dates.
    where existing.origin='web_search'and existing.excerpt_source_id is null;
   select id into aid from public.tech_feed_articles where url=item->>'url';
   insert into public.tech_feed_topic_articles(topic_id,article_id,snippet)values(p_id,aid,coalesce(item->>'excerpt',''))on conflict(topic_id,article_id)do update set snippet=excluded.snippet;
  end loop;
  update public.tech_feed_search_topics set status='ready',last_success_at=now(),failures=0,run_after=now()+interval '1 hour',lease=null,lease_until=null where id=p_id;
 else
  update public.tech_feed_search_topics set status=case when p_error='quota_exhausted'then p_error else 'unavailable'end,failures=least(failures+1,10),run_after=now()+make_interval(hours=>least(24,power(2,least(failures,5))::integer)),lease=null,lease_until=null where id=p_id;
 end if;
 update public.tech_feed_search_provider set lease=null,lease_until=null,status=case when p_error='quota_exhausted'then p_error when p_error is not null then 'unavailable'else 'waiting'end,run_after=now()+case when p_error is null then interval '0 seconds'else interval '15 minutes'end where id;
 return true;
end$$;
-- Selection is owner-filtered before pagination; saved view ignores current filters.
create or replace function public.tech_feed_list(p_user_id uuid,p_view text default 'latest',p_interest text default null,p_source_id uuid default null,p_cursor text default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;begin
 if p_view not in('latest','saved')or(p_interest is not null and p_interest not in('ai','frontend','backend','cloud','tools'))then raise exception 'invalid_input';end if;
 with visible as(
 select a.*,coalesce(a.published_at,a.discovered_at)sort_at,exists(select 1 from public.tech_feed_bookmarks b where b.user_id=p_user_id and b.article_id=a.id)saved,
 (select todo_id from public.tech_feed_todo_links l where l.user_id=p_user_id and l.article_id=a.id)todo_id
 from public.tech_feed_articles a where
 ((p_view='saved'and exists(select 1 from public.tech_feed_bookmarks b where b.user_id=p_user_id and b.article_id=a.id))
 or(p_view='latest'and(
 exists(select 1 from public.tech_feed_article_sources m join public.tech_feed_subscriptions s using(source_id)where m.article_id=a.id and s.user_id=p_user_id and s.subscribed)
 or exists(select 1 from public.tech_feed_topic_articles ta join public.tech_feed_topic_memberships tm using(topic_id)where ta.article_id=a.id and tm.user_id=p_user_id))
 and(p_interest is null or p_interest=any(a.interests))
 and(p_source_id is null or exists(select 1 from public.tech_feed_article_sources m where m.article_id=a.id and m.source_id=p_source_id))))
 and(p_cursor is null or(coalesce(a.published_at,a.discovered_at),a.id)<(split_part(p_cursor,'|',1)::timestamptz,split_part(p_cursor,'|',2)::uuid))
 order by coalesce(a.published_at,a.discovered_at)desc,a.id desc limit 21),
 page as(select * from visible order by sort_at desc,id desc limit 20),
 mapped as(select jsonb_build_object('id',a.id,'title',a.title,'url',a.url,'published_at',a.published_at,'discovered_at',a.discovered_at,
 'excerpt',a.excerpt,'summary',a.summary,'summary_status',a.summary_status,'category',a.category,'interests',a.interests,'saved',a.saved,'todo_id',a.todo_id,
 'origin',case when a.excerpt_source_id is not null then 'rss'else a.origin end,
 'excerpt_provenance',case when a.excerpt_source_id is not null or a.origin='rss'then 'source_excerpt'else 'search_snippet'end,
 'matched_topics',coalesce((select jsonb_agg(p.prompt)from public.tech_feed_topic_articles ta join public.tech_feed_topic_memberships tm using(topic_id)join public.tech_feed_preferences p using(user_id)where ta.article_id=a.id and tm.user_id=p_user_id),'[]'::jsonb),
 'sources',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name)order by s.name)from public.tech_feed_article_sources m join public.tech_feed_sources s on s.id=m.source_id where m.article_id=a.id and(s.recommended or s.created_by=p_user_id or exists(select 1 from public.tech_feed_subscriptions sub where sub.user_id=p_user_id and sub.source_id=s.id))),'[]'::jsonb))item,a.sort_at,a.id from page a)
 select jsonb_build_object('items',coalesce((select jsonb_agg(item order by sort_at desc,id desc)from mapped),'[]'::jsonb),
 'next_cursor',case when(select count(*)from visible)>20 then(select sort_at::text||'|'||id::text from page order by sort_at,id limit 1)else null end)into result;
 return result;
end$$;
create function public.tech_feed_summary_owner(p_article_id uuid,p_user_id uuid)returns boolean language sql stable security invoker set search_path='' as $$
 select not exists(select 1 from public.tech_feed_preferences p where p.user_id=p_user_id and p.prompt<>''and not p.receiving)
 and exists(select 1 from public.tech_feed_articles a where a.id=p_article_id and (
 (a.excerpt_source_id is not null and exists(select 1 from public.tech_feed_sources s join public.tech_feed_subscriptions sub on sub.source_id=s.id where s.id=a.excerpt_source_id and s.permission_status='approved'and s.summary_allowed and sub.subscribed and sub.user_id=p_user_id))
 or(a.origin='web_search'and a.excerpt_source_id is null and exists(select 1 from public.tech_feed_topic_articles ta join public.tech_feed_topic_memberships tm using(topic_id)join public.tech_feed_preferences p using(user_id)where ta.article_id=a.id and tm.user_id=p_user_id and p.receiving))));
$$;
create or replace function public.tech_feed_begin_summary_attempt(p_ids uuid[],p_leases uuid[],p_user_id uuid)returns boolean
language plpgsql security invoker set search_path='' as $$declare r record;n int:=0;begin
 if cardinality(p_ids)not between 1 and 3 or cardinality(p_ids)<>cardinality(p_leases)or(select count(distinct x)from unnest(p_ids)x)<>cardinality(p_ids)then return false;end if;
 -- Serialize preference changes with sponsorship. A paused owner cannot reserve a later call.
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,98531));
 for r in select a.id from public.tech_feed_articles a join unnest(p_ids,p_leases)c(id,lease)on c.id=a.id
 where a.summary_lease=c.lease and a.summary_lease_until>now()and a.summary_attempts<3 and a.summary_attempt_lease is distinct from a.summary_lease
 and public.tech_feed_summary_owner(a.id,p_user_id)order by a.id for update of a loop n:=n+1;end loop;
 if n<>cardinality(p_ids)then return false;end if;
 if not public.coach_reserve_ai(p_user_id)then return false;end if;
 update public.tech_feed_articles a set summary_attempts=a.summary_attempts+1,summary_attempt_lease=a.summary_lease where a.id=any(p_ids);return true;
end$$;
create or replace function public.tech_feed_claim_summaries(p_pilot_ids uuid[])returns table(article jsonb,user_id uuid,lease uuid)
language plpgsql security invoker set search_path='' as $$declare r record;l uuid;u uuid;begin
 for r in select a.* from public.tech_feed_articles a where a.summary_status in('pending','failed')and length(a.excerpt)>=160 and a.summary_attempts<3
 and(a.summary_retry_at is null or a.summary_retry_at<=now())and(a.summary_lease_until is null or a.summary_lease_until<now())
 and exists(select 1 from unnest(p_pilot_ids)x where public.tech_feed_summary_owner(a.id,x)and public.tech_feed_ai_eligible(x))
 order by a.discovered_at desc,a.id for update skip locked limit 3 loop
  select x into u from unnest(p_pilot_ids)x where public.tech_feed_summary_owner(r.id,x)and public.tech_feed_ai_eligible(x)order by x limit 1;
  l:=gen_random_uuid();update public.tech_feed_articles set summary_lease=l,summary_lease_until=now()+interval '90 seconds'where id=r.id;
  article:=to_jsonb(r)||'{"permission_status":"approved"}'::jsonb;user_id:=u;lease:=l;return next;
 end loop;
end$$;
create or replace function public.tech_feed_finish_summary(p_id uuid,p_lease uuid,p_user_id uuid,p_summary jsonb,p_status text,p_category text default null)returns boolean language plpgsql security invoker set search_path='' as $$begin
 if p_status not in('ready','failed','insufficient','deferred')then raise exception 'invalid_input';end if;
 if p_status='ready'and(p_summary is null or jsonb_typeof(p_summary)<>'object'or(select count(*)from jsonb_object_keys(p_summary))<>3
 or not(p_summary?'technology'and p_summary?'change'and p_summary?'usage')
 or exists(select 1 from jsonb_each(p_summary)where jsonb_typeof(value)<>'string'or length(value#>>'{}')not between 1 and 500))then raise exception 'invalid_input';end if;
 update public.tech_feed_articles a set category=case when p_status='ready'and p_category in('news','practice','deep_dive')then p_category else null end,
 summary=case when p_status='ready'then p_summary else null end,summary_status=case when p_status='deferred'then 'pending'else p_status end,
 summary_lease=null,summary_lease_until=null,summary_retry_at=now()+case when p_status='deferred'then interval '15 minutes'else interval '1 day'end
 where a.id=p_id and a.summary_lease=p_lease and a.summary_lease_until>now()and(p_status in('deferred','insufficient')or a.summary_attempt_lease=a.summary_lease)
 and public.tech_feed_summary_owner(a.id,p_user_id);return found;
end$$;
do $$declare f regprocedure;begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname like 'tech_feed_%'loop
 execute format('revoke all on function %s from public,anon,authenticated',f);execute format('grant execute on function %s to service_role',f);
 end loop;
end$$;

create or replace function public.tech_feed_claim_sources(p_pilot_ids uuid[],p_limit int default 2)returns setof public.tech_feed_sources
language plpgsql security invoker set search_path='' as $$begin
 return query update public.tech_feed_sources set lease=gen_random_uuid(),lease_until=now()+interval '90 seconds'
 where id in(select s.id from public.tech_feed_sources s where s.permission_status='approved'and s.run_after<=now()and(s.lease_until is null or s.lease_until<now())
 and exists(select 1 from public.tech_feed_subscriptions sub where sub.source_id=s.id and sub.subscribed and sub.user_id=any(p_pilot_ids)
 and not exists(select 1 from public.tech_feed_preferences p where p.user_id=sub.user_id and p.prompt<>''and not p.receiving))
 order by s.run_after,s.id for update skip locked limit least(greatest(p_limit,1),4))returning *;
end$$;
