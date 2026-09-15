-- Shared free-AI budget resize, worker/user split and failure refund.
--
-- The previous daily ceiling of 6 was sized in the career-coach era for a user
-- pressing a button a few times a day. The technology feed reused it while a
-- scheduled worker consumes it, so the worker drained the whole day within
-- minutes and user-initiated briefings never reserved a call. The limit is an
-- application guard, not an OpenRouter one: free models cost nothing and the
-- client already forbids paid routing.
--
-- attempts stays the user-facing budget and is refundable when a provider call
-- produces nothing usable. calls counts every request actually sent and is never
-- refunded, so a reserve/refund retry loop still terminates.

alter table public.coach_ai_usage drop constraint if exists coach_ai_usage_attempts_check;
alter table public.coach_ai_usage add constraint coach_ai_usage_attempts_check check(attempts between 0 and 15);
alter table public.coach_ai_usage add column if not exists calls int not null default 0 check(calls between 0 and 40);

-- Existing rows predate the counter; treat past charged attempts as real calls.
update public.coach_ai_usage set calls=attempts where calls=0 and attempts>0;

drop function if exists public.coach_reserve_ai(uuid);
drop function if exists coaching_private.reserve_ai(uuid);

create function coaching_private.reserve_ai(p_user_id uuid default null,p_cap int default 15) returns boolean
language plpgsql security definer set search_path='' as $$
declare u uuid; d date; n int; cap int;
begin
 if auth.jwt()->>'role'='service_role' then u:=p_user_id; else u:=auth.uid(); end if;
 if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' then raise exception 'unauthorized' using errcode='42501'; end if;
 -- A caller may request a smaller share than the shared budget but never a larger one.
 cap:=least(greatest(coalesce(p_cap,15),0),15);
 if cap<1 then return false; end if;
 select (now() at time zone coalesce(time_zone,'Asia/Seoul'))::date into d from public.profiles where user_id=u;
 d:=coalesce(d,(now() at time zone 'Asia/Seoul')::date);
 perform pg_advisory_xact_lock(hashtextextended(u::text,8763));
 insert into public.coach_ai_usage(user_id,local_date,attempts,calls) values(u,d,1,1)
 on conflict(user_id,local_date) do update set attempts=public.coach_ai_usage.attempts+1,calls=public.coach_ai_usage.calls+1
 where public.coach_ai_usage.attempts<cap and public.coach_ai_usage.calls<40 returning attempts into n;
 return n is not null;
end $$;

create function coaching_private.refund_ai(p_user_id uuid default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare u uuid; d date; n int;
begin
 if auth.jwt()->>'role'='service_role' then u:=p_user_id; else u:=auth.uid(); end if;
 if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' then raise exception 'unauthorized' using errcode='42501'; end if;
 select (now() at time zone coalesce(time_zone,'Asia/Seoul'))::date into d from public.profiles where user_id=u;
 d:=coalesce(d,(now() at time zone 'Asia/Seoul')::date);
 perform pg_advisory_xact_lock(hashtextextended(u::text,8763));
 -- calls is deliberately untouched: the request was really sent.
 update public.coach_ai_usage set attempts=attempts-1
 where user_id=u and local_date=d and attempts>0 returning attempts into n;
 return n is not null;
end $$;

revoke all on function coaching_private.reserve_ai(uuid,int) from public,anon;
revoke all on function coaching_private.refund_ai(uuid) from public,anon;
grant execute on function coaching_private.reserve_ai(uuid,int) to authenticated,service_role;
grant execute on function coaching_private.refund_ai(uuid) to authenticated,service_role;

create function public.coach_reserve_ai(p_user_id uuid default null,p_cap int default 15) returns boolean
language sql security invoker set search_path='' as $$ select coaching_private.reserve_ai(p_user_id,p_cap); $$;
create function public.coach_refund_ai(p_user_id uuid default null) returns boolean
language sql security invoker set search_path='' as $$ select coaching_private.refund_ai(p_user_id); $$;

revoke all on function public.coach_reserve_ai(uuid,int) from public,anon;
revoke all on function public.coach_refund_ai(uuid) from public,anon;
grant execute on function public.coach_reserve_ai(uuid,int) to authenticated,service_role;
grant execute on function public.coach_refund_ai(uuid) to authenticated,service_role;

-- The scheduled summary worker keeps three of the fifteen calls for explicit
-- user actions (daily briefing and restart coaching).
create or replace function public.tech_feed_begin_summary_attempt(p_ids uuid[],p_leases uuid[],p_user_id uuid)returns boolean
language plpgsql security invoker set search_path='' as $$declare r record;n int:=0;begin
 if cardinality(p_ids)not between 1 and 3 or cardinality(p_ids)<>cardinality(p_leases)or(select count(distinct x)from unnest(p_ids)x)<>cardinality(p_ids)then return false;end if;
 -- Serialize preference changes with sponsorship. A paused owner cannot reserve a later call.
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,98531));
 for r in select a.id from public.tech_feed_articles a join unnest(p_ids,p_leases)c(id,lease)on c.id=a.id
 where a.summary_lease=c.lease and a.summary_lease_until>now()and a.summary_attempts<3 and a.summary_attempt_lease is distinct from a.summary_lease
 and public.tech_feed_summary_owner(a.id,p_user_id)order by a.id for update of a loop n:=n+1;end loop;
 if n<>cardinality(p_ids)then return false;end if;
 if not public.coach_reserve_ai(p_user_id,12)then return false;end if;
 update public.tech_feed_articles a set summary_attempts=a.summary_attempts+1,summary_attempt_lease=a.summary_lease where a.id=any(p_ids);return true;
end$$;

-- Collection is specified as hourly and the job is even named so, but it was
-- scheduled every minute, which is what let it exhaust the day's budget at once.
do $$ begin
 if exists(select 1 from pg_namespace where nspname='cron') then
  perform cron.alter_job(jobid,schedule=>'0 * * * *') from cron.job where jobname='study-room-tech-feed-hourly';
 end if;
end $$;
