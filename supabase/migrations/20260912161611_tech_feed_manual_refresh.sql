-- Authenticated manual refresh: account cooldown plus shared topic/source leases.
create table public.tech_feed_refresh_requests(
 user_id uuid primary key references auth.users on delete cascade,
 requested_at timestamptz,lease uuid,lease_until timestamptz,result jsonb,preference_revision integer
);
alter table public.tech_feed_refresh_requests enable row level security;
revoke all on public.tech_feed_refresh_requests from public,anon,authenticated;
grant all on public.tech_feed_refresh_requests to service_role;
alter table public.tech_feed_sources add column manual_requested_at timestamptz;
alter table public.tech_feed_search_topics add column manual_requested_at timestamptz;

create function public.tech_feed_refresh_status(p_user_id uuid)returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('state',case when
 exists(select 1 from public.tech_feed_refresh_requests r where r.user_id=p_user_id and r.lease_until>now())
 or exists(select 1 from public.tech_feed_topic_memberships m join public.tech_feed_search_topics t on t.id=m.topic_id where m.user_id=p_user_id and t.lease_until>now())
 or exists(select 1 from public.tech_feed_subscriptions sub join public.tech_feed_sources s on s.id=sub.source_id where sub.user_id=p_user_id and sub.subscribed and s.permission_status='approved' and s.lease_until>now())
 then 'running'else 'idle'end);
$$;
create function public.tech_feed_refresh_begin(p_user_id uuid,p_expected_revision integer)returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.tech_feed_refresh_requests;p public.tech_feed_preferences;l uuid;begin
 if p_user_id is null or not exists(select 1 from public.profiles where user_id=p_user_id)then raise exception 'unauthorized';end if;
 -- Serialize with topic edits and pause; never spend on a silently changed topic.
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,98531));
 select * into p from public.tech_feed_preferences where user_id=p_user_id;
 if p_expected_revision is null or p_expected_revision<>coalesce(p.revision,0)then raise exception 'revision_conflict';end if;
 if coalesce(p.prompt,'')<>''and not p.receiving then return jsonb_build_object('state','paused');end if;
 insert into public.tech_feed_refresh_requests(user_id)values(p_user_id)on conflict do nothing;
 select * into r from public.tech_feed_refresh_requests where user_id=p_user_id for update;
 if r.lease_until>now()then return jsonb_build_object('state','running');end if;
 if r.requested_at>now()-interval '5 minutes'then
 return jsonb_build_object('state','cooldown','retry_after',ceil(extract(epoch from r.requested_at+interval '5 minutes'-now()))::integer);end if;
 l:=gen_random_uuid();update public.tech_feed_refresh_requests set requested_at=now(),lease=l,lease_until=now()+interval '90 seconds',result=null,preference_revision=p_expected_revision where user_id=p_user_id;
 return jsonb_build_object('state','started','lease',l);
end$$;
create function public.tech_feed_refresh_finish(p_user_id uuid,p_lease uuid,p_result jsonb)returns boolean
language plpgsql security invoker set search_path='' as $$begin
 update public.tech_feed_refresh_requests set lease=null,lease_until=null,result=p_result
 where user_id=p_user_id and lease=p_lease and lease_until>now();return found;
end$$;
create function public.tech_feed_refresh_claim_search(p_user_id uuid,p_refresh_lease uuid)returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t public.tech_feed_search_topics;l uuid;begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,98531));
 perform 1 from public.tech_feed_refresh_requests r left join public.tech_feed_preferences p using(user_id) where r.user_id=p_user_id and r.lease=p_refresh_lease and r.lease_until>now()and r.preference_revision=coalesce(p.revision,0);if not found then return null;end if;
 -- Inspect eligibility without a row lock; all collectors lock provider before topic.
 perform 1 from public.tech_feed_search_topics s join public.tech_feed_topic_memberships m on m.topic_id=s.id join public.tech_feed_preferences p on p.user_id=m.user_id
 where m.user_id=p_user_id and p.receiving and(s.lease_until is null or s.lease_until<now())
 and(s.failures=0 or s.run_after<=now())
 and coalesce(greatest(s.last_attempt_at,s.last_success_at,s.manual_requested_at),'-infinity'::timestamptz)<=now()-interval '5 minutes';
 if not found then return null;end if;
 if not exists(select 1 from public.tech_feed_search_provider where id and run_after<=now())then return null;end if;
 perform 1 from public.tech_feed_search_provider where id and run_after<=now()and(lease_until is null or lease_until<now())for update skip locked;
 if not found then return jsonb_build_object('busy',true);end if;
 select s.* into t from public.tech_feed_search_topics s
 join public.tech_feed_topic_memberships m on m.topic_id=s.id join public.tech_feed_preferences p on p.user_id=m.user_id
 where m.user_id=p_user_id and p.receiving and(s.lease_until is null or s.lease_until<now())
 and(s.failures=0 or s.run_after<=now())
 and coalesce(greatest(s.last_attempt_at,s.last_success_at,s.manual_requested_at),'-infinity'::timestamptz)<=now()-interval '5 minutes'
 for update of s skip locked;
 if not found then return null;end if;
 l:=gen_random_uuid();update public.tech_feed_search_provider set lease=l,lease_until=now()+interval '90 seconds'where id;
 update public.tech_feed_search_topics set lease=l,lease_until=now()+interval '90 seconds',manual_requested_at=now(),run_after=now()+interval '1 hour'where id=t.id;
 return jsonb_build_object('id',t.id,'lease',l,'canonical',t.canonical);
end$$;
create function public.tech_feed_refresh_claim_sources(p_user_id uuid,p_refresh_lease uuid)returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,98531));
 perform 1 from public.tech_feed_refresh_requests r left join public.tech_feed_preferences p using(user_id) where r.user_id=p_user_id and r.lease=p_refresh_lease and r.lease_until>now()and r.preference_revision=coalesce(p.revision,0);if not found then return '[]'::jsonb;end if;
 if exists(select 1 from public.tech_feed_preferences where user_id=p_user_id and prompt<>''and not receiving)then return '[]'::jsonb;end if;
 with claimed as(update public.tech_feed_sources set lease=gen_random_uuid(),lease_until=now()+interval '90 seconds',manual_requested_at=now()
 where id in(select s.id from public.tech_feed_sources s where s.permission_status='approved'
 and(s.lease_until is null or s.lease_until<now())and(s.failures=0 or s.run_after<=now())
 and coalesce(greatest(s.last_success_at,s.manual_requested_at),'-infinity'::timestamptz)<=now()-interval '5 minutes'
 and exists(select 1 from public.tech_feed_subscriptions sub where sub.source_id=s.id and sub.user_id=p_user_id and sub.subscribed)
 order by s.manual_requested_at nulls first,s.last_success_at nulls first,s.id for update skip locked limit 4)returning *)
 select coalesce(jsonb_agg(claimed),'[]'::jsonb)into result from claimed;
 return result;
end$$;
do $$declare f regprocedure;begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname like 'tech_feed_refresh_%'loop
 execute format('revoke all on function %s from public,anon,authenticated',f);execute format('grant execute on function %s to service_role',f);
 end loop;
end$$;
