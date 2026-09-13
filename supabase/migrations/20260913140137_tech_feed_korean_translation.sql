-- Shared Korean translation cache; Free-only provider budget is separate from coaching.
create table public.tech_feed_translations(
 article_id uuid primary key references public.tech_feed_articles(id)on delete cascade,
 source_title text not null,source_excerpt text not null,
 title_ko text,excerpt_ko text,status text not null default 'pending'check(status in('pending','ready','failed')),
 sponsor_user_id uuid references auth.users(id)on delete set null,
 lease uuid,lease_until timestamptz,reserved_lease uuid,retry_after timestamptz not null default now(),
 attempts integer not null default 0,updated_at timestamptz not null default now(),
 check(title_ko is null or length(title_ko)between 1 and 1000),
 check(excerpt_ko is null or length(excerpt_ko)<=6000)
);
create table public.tech_feed_translation_provider(
 singleton boolean primary key default true check(singleton),
 lease uuid,lease_until timestamptz,run_after timestamptz not null default now(),
 status text not null default 'waiting'check(status in('waiting','ready','unavailable','quota_exhausted')),
 last_success_at timestamptz
);
insert into public.tech_feed_translation_provider(singleton)values(true);
create table public.tech_feed_translation_budget(
 month date primary key,characters integer not null default 0 check(characters>=0),
 attempts integer not null default 0 check(attempts>=0)
);
alter table public.tech_feed_translations enable row level security;
alter table public.tech_feed_translation_provider enable row level security;
alter table public.tech_feed_translation_budget enable row level security;
revoke all on public.tech_feed_translations,public.tech_feed_translation_provider,public.tech_feed_translation_budget from public,anon,authenticated;
grant all on public.tech_feed_translations,public.tech_feed_translation_provider,public.tech_feed_translation_budget to service_role;

create function public.tech_feed_translation_claim(p_recipients uuid[],p_limit integer default 3)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare provider public.tech_feed_translation_provider; job record; token uuid:=gen_random_uuid(); result jsonb:='[]';
begin
 select * into provider from public.tech_feed_translation_provider where singleton for update;
 if provider.lease_until>now()or provider.run_after>now()then return result;end if;
 for job in
  select a.id,a.title,coalesce(a.excerpt,'')excerpt,owner.id user_id
  from public.tech_feed_articles a
  cross join lateral(select u.id from unnest(p_recipients)u(id)
   where public.tech_feed_summary_owner(a.id,u.id)order by u.id limit 1)owner
  left join public.tech_feed_translations t on t.article_id=a.id
  where length(a.title)between 1 and 300 and length(coalesce(a.excerpt,''))<=2000
   and (t.article_id is null or t.lease_until is null or t.lease_until<=now())
   and (t.article_id is null or t.source_title<>a.title or t.source_excerpt<>coalesce(a.excerpt,'')
    or(t.status<>'ready'and t.retry_after<=now()))
  order by a.discovered_at desc,a.id limit greatest(0,least(3,p_limit))
 loop
  insert into public.tech_feed_translations(article_id,source_title,source_excerpt,sponsor_user_id,lease,lease_until)
   values(job.id,job.title,job.excerpt,job.user_id,token,now()+interval '90 seconds')
  on conflict(article_id)do update set source_title=excluded.source_title,source_excerpt=excluded.source_excerpt,
   sponsor_user_id=excluded.sponsor_user_id,lease=excluded.lease,lease_until=excluded.lease_until,
   reserved_lease=null,title_ko=null,excerpt_ko=null,status='pending',updated_at=now();
  result:=result||jsonb_build_array(jsonb_build_object('id',job.id,'lease',token,'title',job.title,'excerpt',job.excerpt));
 end loop;
 if jsonb_array_length(result)>0 then
  update public.tech_feed_translation_provider set lease=token,lease_until=now()+interval '90 seconds',status='waiting'where singleton;
 end if;
 return result;
end;$$;

create function public.tech_feed_translation_reserve(p_ids uuid[],p_lease uuid,p_cap integer default 450000)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare provider public.tech_feed_translation_provider; amount integer; period date:=(date_trunc('month',now()at time zone 'UTC'))::date; owner uuid;
begin
 if cardinality(p_ids)not between 1 and 3 or (select count(distinct x)from unnest(p_ids)x)<>cardinality(p_ids)then return jsonb_build_object('state','deferred');end if;
 -- Same owner locks as topic/pause mutations; a paused owner cannot sponsor a new call.
 for owner in select distinct sponsor_user_id from public.tech_feed_translations where article_id=any(p_ids)order by sponsor_user_id loop
  perform pg_advisory_xact_lock(hashtextextended(owner::text,98531));
 end loop;
 select * into provider from public.tech_feed_translation_provider where singleton for update;
 if provider.lease is distinct from p_lease or provider.lease_until<=now()then return jsonb_build_object('state','deferred');end if;
 if(select count(*)from public.tech_feed_translations t join public.tech_feed_articles a on a.id=t.article_id
   where t.article_id=any(p_ids)and t.lease=p_lease and t.lease_until>now()and t.reserved_lease is null
    and t.source_title=a.title and t.source_excerpt=coalesce(a.excerpt,'')
    and public.tech_feed_summary_owner(a.id,t.sponsor_user_id))<>cardinality(p_ids)then return jsonb_build_object('state','deferred');end if;
 select sum(length(source_title)+length(source_excerpt))into amount from public.tech_feed_translations where article_id=any(p_ids);
 insert into public.tech_feed_translation_budget(month)values(period)on conflict do nothing;
 update public.tech_feed_translation_budget set characters=characters+amount,attempts=attempts+1
  where month=period and characters+amount<=greatest(0,least(450000,p_cap));
 if not found then return jsonb_build_object('state','quota_exhausted');end if;
 update public.tech_feed_translations set reserved_lease=p_lease,attempts=attempts+1,updated_at=now()where article_id=any(p_ids);
 return jsonb_build_object('state','reserved');
end;$$;

create function public.tech_feed_translation_finish(p_ids uuid[],p_lease uuid,p_items jsonb,p_error text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare provider public.tech_feed_translation_provider; item jsonb; current_row record; good boolean;
begin
 select * into provider from public.tech_feed_translation_provider where singleton for update;
 if provider.lease is distinct from p_lease or provider.lease_until<=now()then return false;end if;
 if cardinality(p_ids)not between 1 and 3 or(select count(distinct x)from unnest(p_ids)x)<>cardinality(p_ids)
  or(select count(*)from public.tech_feed_translations where article_id=any(p_ids)and lease=p_lease and lease_until>now())<>cardinality(p_ids)
  then return false;end if;
 if p_error is null then
  if jsonb_typeof(p_items)<>'array'or jsonb_array_length(p_items)<>cardinality(p_ids)
   or exists(select 1 from public.tech_feed_translations where article_id=any(p_ids)and reserved_lease is distinct from p_lease)
   then return false;end if;
  if(select count(distinct x->>'id')from jsonb_array_elements(p_items)x where(x->>'id')=any(p_ids::text[])
    and jsonb_typeof(x->'title_ko')='string'and length(x->>'title_ko')between 1 and 1000
    and jsonb_typeof(x->'excerpt_ko')='string'and length(x->>'excerpt_ko')<=6000)<>cardinality(p_ids)
    then return false;end if;
 end if;
 for current_row in select t.*,a.title,a.excerpt from public.tech_feed_translations t
  join public.tech_feed_articles a on a.id=t.article_id where t.article_id=any(p_ids)
 loop
  good:=current_row.source_title=current_row.title and current_row.source_excerpt=coalesce(current_row.excerpt,'');
  select x into item from jsonb_array_elements(p_items)x where x->>'id'=current_row.article_id::text limit 1;
  update public.tech_feed_translations set
   status=case when not good or p_error='deferred' then 'pending'when p_error is null then 'ready'else 'failed'end,
   title_ko=case when good and p_error is null then item->>'title_ko'else null end,
   excerpt_ko=case when good and p_error is null then item->>'excerpt_ko'else null end,
   lease=null,lease_until=null,reserved_lease=null,
   retry_after=case when p_error is null or p_error='deferred' then now()else now()+interval '15 minutes'end,updated_at=now()
   where article_id=current_row.article_id;
 end loop;
 update public.tech_feed_translation_provider set lease=null,lease_until=null,
  status=case when p_error='deferred'then 'waiting'when p_error is null then 'ready'when p_error='quota_exhausted'then 'quota_exhausted'else 'unavailable'end,
  run_after=case when p_error='deferred'then now()when p_error='quota_exhausted'then now()+interval '1 hour'when p_error is not null then now()+interval '5 minutes'else now()end,
  last_success_at=case when p_error is null then now()else last_success_at end where singleton;
 return true;
end;$$;

create function public.tech_feed_translation_status()returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('state',status,'last_success_at',last_success_at)from public.tech_feed_translation_provider where singleton;
$$;
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
 'title_ko',t.title_ko,'excerpt_ko',t.excerpt_ko,'translation_status',coalesce(t.status,'pending'),
 'excerpt',a.excerpt,'summary',a.summary,'summary_status',a.summary_status,'category',a.category,'interests',a.interests,'saved',a.saved,'todo_id',a.todo_id,
 'origin',case when a.excerpt_source_id is not null then 'rss'else a.origin end,
 'excerpt_provenance',case when a.excerpt_source_id is not null or a.origin='rss'then 'source_excerpt'else 'search_snippet'end,
 'matched_topics',coalesce((select jsonb_agg(p.prompt)from public.tech_feed_topic_articles ta join public.tech_feed_topic_memberships tm using(topic_id)join public.tech_feed_preferences p using(user_id)where ta.article_id=a.id and tm.user_id=p_user_id),'[]'::jsonb),
 'sources',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name)order by s.name)from public.tech_feed_article_sources m join public.tech_feed_sources s on s.id=m.source_id where m.article_id=a.id and(s.recommended or s.created_by=p_user_id or exists(select 1 from public.tech_feed_subscriptions sub where sub.user_id=p_user_id and sub.source_id=s.id))),'[]'::jsonb))item,a.sort_at,a.id from page a left join public.tech_feed_translations t on t.article_id=a.id and t.source_title=a.title and t.source_excerpt=coalesce(a.excerpt,''))
 select jsonb_build_object('items',coalesce((select jsonb_agg(item order by sort_at desc,id desc)from mapped),'[]'::jsonb),
 'next_cursor',case when(select count(*)from visible)>20 then(select sort_at::text||'|'||id::text from page order by sort_at,id limit 1)else null end)into result;
 return result;
end$$;

revoke all on function public.tech_feed_translation_claim(uuid[],integer),public.tech_feed_translation_reserve(uuid[],uuid,integer),public.tech_feed_translation_finish(uuid[],uuid,jsonb,text),public.tech_feed_translation_status()from public,anon,authenticated;
grant execute on function public.tech_feed_translation_claim(uuid[],integer),public.tech_feed_translation_reserve(uuid[],uuid,integer),public.tech_feed_translation_finish(uuid[],uuid,jsonb,text),public.tech_feed_translation_status()to service_role;
