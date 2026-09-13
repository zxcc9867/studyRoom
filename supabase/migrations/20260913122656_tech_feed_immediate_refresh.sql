-- Explicit refresh bypasses freshness, never active leases, backoff or free quota.
-- Existing SECURITY INVOKER signatures/ACLs and provider-before-topic lock order remain.
alter table public.tech_feed_search_topics add column query_cursor integer not null default 0 check(query_cursor>=0);

create or replace function public.tech_feed_refresh_begin(p_user_id uuid,p_expected_revision integer)returns jsonb
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
 l:=gen_random_uuid();update public.tech_feed_refresh_requests set requested_at=now(),lease=l,lease_until=now()+interval '90 seconds',result=null,preference_revision=p_expected_revision where user_id=p_user_id;
 return jsonb_build_object('state','started','lease',l);
end$$;

create or replace function public.tech_feed_refresh_claim_search(p_user_id uuid,p_refresh_lease uuid)returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t public.tech_feed_search_topics;l uuid;begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,98531));
 perform 1 from public.tech_feed_refresh_requests r left join public.tech_feed_preferences p using(user_id) where r.user_id=p_user_id and r.lease=p_refresh_lease and r.lease_until>now()and r.preference_revision=coalesce(p.revision,0);if not found then return null;end if;
 -- Inspect eligibility without a row lock; all collectors lock provider before topic.
 perform 1 from public.tech_feed_search_topics s join public.tech_feed_topic_memberships m on m.topic_id=s.id join public.tech_feed_preferences p on p.user_id=m.user_id
 where m.user_id=p_user_id and p.receiving and(s.lease_until is null or s.lease_until<now())
 and(s.failures=0 or s.run_after<=now());
 if not found then return null;end if;
 if not exists(select 1 from public.tech_feed_search_provider where id and run_after<=now())then return null;end if;
 perform 1 from public.tech_feed_search_provider where id and run_after<=now()and(lease_until is null or lease_until<now())for update skip locked;
 if not found then return jsonb_build_object('busy',true);end if;
 select s.* into t from public.tech_feed_search_topics s
 join public.tech_feed_topic_memberships m on m.topic_id=s.id join public.tech_feed_preferences p on p.user_id=m.user_id
 where m.user_id=p_user_id and p.receiving and(s.lease_until is null or s.lease_until<now())
 and(s.failures=0 or s.run_after<=now())
 for update of s skip locked;
 if not found then return null;end if;
 l:=gen_random_uuid();update public.tech_feed_search_provider set lease=l,lease_until=now()+interval '90 seconds'where id;
 update public.tech_feed_search_topics set lease=l,lease_until=now()+interval '90 seconds',manual_requested_at=now(),run_after=now()+interval '1 hour'where id=t.id;
 return jsonb_build_object('id',t.id,'lease',l,'canonical',t.canonical,'query_cursor',t.query_cursor);
end$$;

create or replace function public.tech_feed_refresh_claim_sources(p_user_id uuid,p_refresh_lease uuid)returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,98531));
 perform 1 from public.tech_feed_refresh_requests r left join public.tech_feed_preferences p using(user_id) where r.user_id=p_user_id and r.lease=p_refresh_lease and r.lease_until>now()and r.preference_revision=coalesce(p.revision,0);if not found then return '[]'::jsonb;end if;
 if exists(select 1 from public.tech_feed_preferences where user_id=p_user_id and prompt<>''and not receiving)then return '[]'::jsonb;end if;
 with claimed as(update public.tech_feed_sources set lease=gen_random_uuid(),lease_until=now()+interval '90 seconds',manual_requested_at=now()
 where id in(select s.id from public.tech_feed_sources s where s.permission_status='approved'
 and(s.lease_until is null or s.lease_until<now())and(s.failures=0 or s.run_after<=now())
 and exists(select 1 from public.tech_feed_subscriptions sub where sub.source_id=s.id and sub.user_id=p_user_id and sub.subscribed)
 order by s.manual_requested_at nulls first,s.last_success_at nulls first,s.id for update skip locked limit 4)returning *)
 select coalesce(jsonb_agg(claimed),'[]'::jsonb)into result from claimed;
 return result;
end$$;

create or replace function public.tech_feed_search_claim(p_recipients uuid[] default null)returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.tech_feed_search_topics;l uuid;begin
 perform 1 from public.tech_feed_search_provider where id and run_after<=now()and(lease_until is null or lease_until<now())for update skip locked;if not found then return null;end if;
 select * into t from public.tech_feed_search_topics s where run_after<=now()and(lease_until is null or lease_until<now())and exists(select 1 from public.tech_feed_topic_memberships m join public.tech_feed_preferences p using(user_id)where m.topic_id=s.id and p.receiving and(p_recipients is null or m.user_id=any(p_recipients)))order by run_after,last_attempt_at nulls first,id for update skip locked limit 1;
 if not found then return null;end if;
 l:=gen_random_uuid();update public.tech_feed_search_provider set lease=l,lease_until=now()+interval '90 seconds'where id;
 update public.tech_feed_search_topics set lease=l,lease_until=now()+interval '90 seconds',run_after=now()+interval '1 hour'where id=t.id;
 return jsonb_build_object('id',t.id,'lease',l,'canonical',t.canonical,'query_cursor',t.query_cursor);
end$$;

create or replace function public.tech_feed_search_reserve(p_id uuid,p_lease uuid,p_cap integer default 900)returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;begin
 perform 1 from public.tech_feed_search_provider where id and lease=p_lease and lease_until>now()for update;if not found then return false;end if;
 perform 1 from public.tech_feed_search_topics where id=p_id and lease=p_lease and lease_until>now()and reserved_lease is distinct from p_lease for update;if not found then return false;end if;
 insert into public.tech_feed_search_budget(month)values(date_trunc('month',now()at time zone 'UTC')::date)on conflict do nothing;
 update public.tech_feed_search_budget set attempts=attempts+1 where month=date_trunc('month',now()at time zone 'UTC')::date and attempts<least(greatest(coalesce(p_cap,900),0),900)returning attempts into n;
 if n is null then update public.tech_feed_search_provider set status='quota_exhausted'where id;return false;end if;
 update public.tech_feed_search_topics set reserved_lease=p_lease,last_attempt_at=now(),query_cursor=(query_cursor+1)%2147483647 where id=p_id;return true;
end$$;
