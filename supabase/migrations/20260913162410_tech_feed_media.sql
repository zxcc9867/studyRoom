-- Original-page metadata only. No full article or binary media is persisted.
create table public.tech_feed_media(
 article_id uuid primary key references public.tech_feed_articles(id)on delete cascade,
 source_url text not null,image_url text,video jsonb,
 status text not null default 'pending' check(status in('pending','ready','empty','failed')),
 sponsor_user_id uuid references auth.users(id)on delete set null,
 lease uuid,lease_until timestamptz,retry_after timestamptz not null default now(),
 checked_at timestamptz,attempts integer not null default 0,
 check(image_url is null or(length(image_url)<=2048 and image_url like 'https://%')),
 check(video is null or(
  video->>'provider'='youtube'and video->>'id'~'^[A-Za-z0-9_-]{11}$'
  or video->>'provider'='vimeo'and video->>'id'~'^[0-9]{1,12}$'))
);
create index tech_feed_media_sponsor on public.tech_feed_media(sponsor_user_id);
alter table public.tech_feed_media enable row level security;
revoke all on public.tech_feed_media from public,anon,authenticated;
grant all on public.tech_feed_media to service_role;

create function public.tech_feed_media_claim(p_recipients uuid[],p_limit integer default 3)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare item record; token uuid; result jsonb:='[]'::jsonb;
begin
 if coalesce(cardinality(p_recipients),0)=0 then return result;end if;
 -- Serialize only this short claim transaction; network work never holds a lock.
 perform pg_catalog.pg_advisory_xact_lock(6091401);
 for item in select a.id,a.url,owner.user_id from public.tech_feed_articles a
 cross join lateral(select u.id user_id from unnest(p_recipients)u(id)
  where public.tech_feed_summary_owner(a.id,u.id)order by u.id limit 1)owner
 left join public.tech_feed_media m on m.article_id=a.id
 where(m.lease_until is null or m.lease_until<=now())
 and(m.article_id is null or m.source_url<>a.url or m.retry_after<=now())
 order by coalesce(a.published_at,a.discovered_at)desc,a.id desc
 limit greatest(0,least(coalesce(p_limit,3),3))
 loop
  token:=gen_random_uuid();
  insert into public.tech_feed_media(article_id,source_url,sponsor_user_id,lease,lease_until,attempts)
  values(item.id,item.url,item.user_id,token,now()+interval '90 seconds',1)
  on conflict(article_id)do update set source_url=excluded.source_url,sponsor_user_id=excluded.sponsor_user_id,
   image_url=null,video=null,status='pending',lease=excluded.lease,lease_until=excluded.lease_until,attempts=public.tech_feed_media.attempts+1;
  result:=result||jsonb_build_array(jsonb_build_object('id',item.id,'url',item.url,'lease',token));
 end loop;
 return result;
end;$$;
create function public.tech_feed_media_allowed(p_id uuid,p_lease uuid)returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.tech_feed_media m join public.tech_feed_articles a on a.id=m.article_id
 where m.article_id=p_id and m.lease=p_lease and m.lease_until>now()and m.source_url=a.url
 and public.tech_feed_summary_owner(a.id,m.sponsor_user_id));
$$;
create function public.tech_feed_media_finish(p_id uuid,p_lease uuid,p_media jsonb,p_error text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare image text; clip jsonb; changed integer;
begin
 if p_error is null then
  image:=p_media->>'image_url';clip:=nullif(p_media->'video','null'::jsonb);
  if image is not null and(length(image)>2048 or image not like 'https://%')then return false;end if;
  if clip is not null and not coalesce((clip->>'provider'='youtube'and clip->>'id'~'^[A-Za-z0-9_-]{11}$'
    or clip->>'provider'='vimeo'and clip->>'id'~'^[0-9]{1,12}$'),false)then return false;end if;
 end if;
 update public.tech_feed_media m set image_url=image,video=clip,
  status=case when p_error='deferred'then 'pending'when p_error is not null then 'failed'when image is not null or clip is not null then 'ready'else 'empty'end,
  checked_at=case when p_error='deferred'then checked_at else now()end,lease=null,lease_until=null,
  retry_after=case when p_error='deferred'then now()when p_error is not null then now()+interval '1 day'else now()+interval '7 days'end
 where m.article_id=p_id and m.lease=p_lease and m.lease_until>now()
 and exists(select 1 from public.tech_feed_articles a where a.id=m.article_id and a.url=m.source_url);
 get diagnostics changed=row_count;return changed=1;
end;$$;
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
 'media',case when m.status='ready' then jsonb_build_object('image_url',m.image_url,'video',m.video)else null end,
 'title_ko',t.title_ko,'excerpt_ko',t.excerpt_ko,'translation_status',coalesce(t.status,'pending'),
 'excerpt',a.excerpt,'summary',a.summary,'summary_status',a.summary_status,'category',a.category,'interests',a.interests,'saved',a.saved,'todo_id',a.todo_id,
 'origin',case when a.excerpt_source_id is not null then 'rss'else a.origin end,
 'excerpt_provenance',case when a.excerpt_source_id is not null or a.origin='rss'then 'source_excerpt'else 'search_snippet'end,
 'matched_topics',coalesce((select jsonb_agg(p.prompt)from public.tech_feed_topic_articles ta join public.tech_feed_topic_memberships tm using(topic_id)join public.tech_feed_preferences p using(user_id)where ta.article_id=a.id and tm.user_id=p_user_id),'[]'::jsonb),
 'sources',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name)order by s.name)from public.tech_feed_article_sources m join public.tech_feed_sources s on s.id=m.source_id where m.article_id=a.id and(s.recommended or s.created_by=p_user_id or exists(select 1 from public.tech_feed_subscriptions sub where sub.user_id=p_user_id and sub.source_id=s.id))),'[]'::jsonb))item,a.sort_at,a.id from page a left join public.tech_feed_translations t on t.article_id=a.id and t.source_title=a.title and t.source_excerpt=coalesce(a.excerpt,'') left join public.tech_feed_media m on m.article_id=a.id and m.source_url=a.url)
 select jsonb_build_object('items',coalesce((select jsonb_agg(item order by sort_at desc,id desc)from mapped),'[]'::jsonb),
 'next_cursor',case when(select count(*)from visible)>20 then(select sort_at::text||'|'||id::text from page order by sort_at,id limit 1)else null end)into result;
 return result;
end$$;

revoke all on function public.tech_feed_media_claim(uuid[],integer),public.tech_feed_media_allowed(uuid,uuid),public.tech_feed_media_finish(uuid,uuid,jsonb,text)from public,anon,authenticated;
grant execute on function public.tech_feed_media_claim(uuid[],integer),public.tech_feed_media_allowed(uuid,uuid),public.tech_feed_media_finish(uuid,uuid,jsonb,text)to service_role;
