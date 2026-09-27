-- Preserve the owner-visible discovery universe for daily briefing statistics.
-- Freshness is a list/facet view concern, not a rewrite of when an item was discovered.
create or replace function public.tech_feed_visible(p_user_id uuid,p_view text default 'latest',p_from timestamptz default null,p_until timestamptz default null)
returns setof public.tech_feed_articles language sql stable security invoker set search_path='' as $$
 select a.* from public.tech_feed_articles a where(p_from is null or a.discovered_at>=p_from)and(p_until is null or a.discovered_at<p_until)and
 ((p_view='saved'and exists(select 1 from public.tech_feed_bookmarks b where b.user_id=p_user_id and b.article_id=a.id))
 or(p_view in('latest','deep_read')and(exists(select 1 from public.tech_feed_article_sources m join public.tech_feed_subscriptions s using(source_id)where m.article_id=a.id and s.user_id=p_user_id and s.subscribed)
 or exists(select 1 from public.tech_feed_topic_articles ta join public.tech_feed_topic_memberships tm using(topic_id)where ta.article_id=a.id and tm.user_id=p_user_id))));
$$;

create or replace function public.tech_feed_filter_candidates(p_user_id uuid,p_view text default 'latest')
returns jsonb language plpgsql stable security invoker set search_path='' as $$begin
 if p_view not in('latest','deep_read','saved')then raise exception 'invalid_input';end if;
 return jsonb_build_object('prompt',coalesce((select prompt from public.tech_feed_preferences where user_id=p_user_id),''),
 'items',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'excerpt',a.excerpt,'category',a.category,'category_method',a.category_method,
 'summary_status',a.summary_status,'rules_version',a.rules_version,'topics',a.topics,'sources',public.tech_feed_article_facets(p_user_id,a.id)))
 from public.tech_feed_visible(p_user_id,p_view)a where
 p_view='saved' or (p_view='latest'and a.published_at between now()-interval '30 days' and now())
 or (p_view='deep_read'and(a.published_at is null or a.published_at<now()-interval '30 days' or a.published_at>now()))),'[]'));
end$$;

create or replace function public.tech_feed_list(p_user_id uuid,p_view text default 'latest',p_interest text default null,p_source_id uuid default null,p_cursor text default null,p_source_key text default null,p_article_ids uuid[] default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$declare result jsonb;begin
 if p_view not in('latest','deep_read','saved')or(p_interest is not null and p_interest not in('ai','frontend','backend','cloud','tools'))then raise exception 'invalid_input';end if;
 with filtered as(select a.*,a.discovered_at sort_at,exists(select 1 from public.tech_feed_bookmarks b where b.user_id=p_user_id and b.article_id=a.id)saved,
 (select todo_id from public.tech_feed_todo_links l where l.user_id=p_user_id and l.article_id=a.id)todo_id from public.tech_feed_visible(p_user_id,p_view)a
 where(p_view='saved' or (p_view='latest'and a.published_at between now()-interval '30 days' and now())
 or (p_view='deep_read'and(a.published_at is null or a.published_at<now()-interval '30 days' or a.published_at>now())))
 and(p_interest is null or p_interest=any(a.interests))and(p_source_id is null or exists(select 1 from public.tech_feed_article_sources m where m.article_id=a.id and m.source_id=p_source_id))
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

revoke all on function public.tech_feed_visible(uuid,text,timestamptz,timestamptz),public.tech_feed_filter_candidates(uuid,text),public.tech_feed_list(uuid,text,text,uuid,text,text,uuid[]) from public,anon,authenticated;
grant execute on function public.tech_feed_visible(uuid,text,timestamptz,timestamptz),public.tech_feed_filter_candidates(uuid,text),public.tech_feed_list(uuid,text,text,uuid,text,text,uuid[]) to service_role;

-- Historical discoveries remain in honest daily counts, but old or undated
-- introductions are never evidence for today's AI insight/highlight.
create or replace function public.tech_feed_briefing_excerpt_allowed(p_user_id uuid,p_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.tech_feed_articles a where a.id=p_id and length(btrim(a.excerpt))>=160
 and a.published_at between now()-interval '30 days' and now()
 and a.url!~*'^https?://([^/]+\.)?(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|dailymotion\.com)([:/]|$)'
 and not exists(select 1 from public.tech_feed_media m where m.article_id=a.id and m.source_url=a.url and m.status='ready'and m.video is not null)
 and((a.excerpt_source_id is not null and exists(select 1 from public.tech_feed_sources s join public.tech_feed_subscriptions sub on sub.source_id=s.id
 where s.id=a.excerpt_source_id and s.permission_status='approved'and s.summary_allowed and sub.user_id=p_user_id and sub.subscribed))
 or(a.origin='web_search'and a.excerpt_source_id is null and exists(select 1 from public.tech_feed_topic_articles ta join public.tech_feed_topic_memberships tm using(topic_id)where ta.article_id=a.id and tm.user_id=p_user_id))));
$$;
revoke all on function public.tech_feed_briefing_excerpt_allowed(uuid,uuid) from public,anon,authenticated;
grant execute on function public.tech_feed_briefing_excerpt_allowed(uuid,uuid) to service_role;
