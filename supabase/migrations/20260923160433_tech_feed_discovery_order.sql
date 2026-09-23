-- Latest and saved cards use first discovery; original publication remains metadata.
create or replace function public.tech_feed_list(p_user_id uuid,p_view text default 'latest',p_interest text default null,p_source_id uuid default null,p_cursor text default null,p_source_key text default null,p_article_ids uuid[] default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$declare result jsonb;begin
 if p_view not in('latest','saved')or(p_interest is not null and p_interest not in('ai','frontend','backend','cloud','tools'))then raise exception 'invalid_input';end if;
 with filtered as(select a.*,a.discovered_at sort_at,exists(select 1 from public.tech_feed_bookmarks b where b.user_id=p_user_id and b.article_id=a.id)saved,
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
