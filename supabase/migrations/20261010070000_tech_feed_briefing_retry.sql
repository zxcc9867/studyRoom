-- Preserve old RPCs while adding owner-bound, exactly-once attempt settlement.
alter table public.tech_feed_briefings
 add column failure_reason text check(failure_reason in('provider_unavailable','rate_limited','timeout','configuration_error','invalid_response','network_error','unknown')),
 add column retry_at timestamptz,
 add column retry_count integer not null default 0 check(retry_count between 0 and 1),
 add column reserved_date date;

alter function public.tech_feed_briefing_snapshot(uuid,integer,timestamptz) rename to tech_feed_briefing_snapshot_before_retry;
create function public.tech_feed_briefing_snapshot(p_user_id uuid,p_version integer,p_now timestamptz default now())
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare s jsonb;c public.tech_feed_briefings;cooldown public.tech_feed_briefings;
begin
 s:=public.tech_feed_briefing_snapshot_before_retry(p_user_id,p_version,p_now);
 select * into c from public.tech_feed_briefings where user_id=p_user_id and local_date=(s->>'local_date')::date and time_zone=s->>'time_zone';
 -- A timezone/day change must not evade a still-active provider cooldown.
 select * into cooldown from public.tech_feed_briefings where user_id=p_user_id and retry_at>p_now order by retry_at desc limit 1;
 return s||jsonb_build_object('failure_reason',coalesce(cooldown.failure_reason,c.failure_reason),'retry_at',coalesce(cooldown.retry_at,c.retry_at));
end$$;

alter function public.tech_feed_briefing_claim(uuid,integer,text,uuid[]) rename to tech_feed_briefing_claim_before_retry;
create function public.tech_feed_briefing_claim(p_user_id uuid,p_version integer,p_hash text,p_ids uuid[])
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s jsonb;c public.tech_feed_briefings;answer jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,98531));
 s:=public.tech_feed_briefing_snapshot(p_user_id,p_version);
 if not(s->>'receiving')::boolean then return '{"status":"paused"}';end if;
 if s->'cache' is not null and s->'cache'<>'null'::jsonb and not(s->'cache'->>'stale')::boolean then return '{"status":"ready"}';end if;
 if(s->>'generating')::boolean then return '{"status":"generating"}';end if;
 if (s->>'retry_at')::timestamptz>now()then return '{"status":"unavailable"}';end if;
 -- Only new, date-tracked reservations can be recovered safely. Legacy reservations
 -- may already have been refunded by their caller and are deliberately untouched.
 for c in select * from public.tech_feed_briefings where user_id=p_user_id and reserved_date is not null
 and reserved_lease=lease and lease_until<=now() for update loop
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,8763));
  update public.coach_ai_usage set attempts=attempts-1 where user_id=p_user_id and local_date=c.reserved_date and attempts>0;
  update public.tech_feed_briefings set reserved_date=null,reserved_lease=null where user_id=p_user_id and local_date=c.local_date and time_zone=c.time_zone;
 end loop;
 answer:=public.tech_feed_briefing_claim_before_retry(p_user_id,p_version,p_hash,p_ids);
 if answer->>'status'='claimed' then
  update public.tech_feed_briefings set retry_count=0,reserved_date=null,failure_reason=null,retry_at=null where user_id=p_user_id and lease=(answer->>'lease')::uuid;
 end if;
 return answer;
end$$;

create function public.tech_feed_briefing_reserve_attempt(p_user_id uuid,p_lease uuid,p_attempt integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.tech_feed_briefings;answer jsonb;zone text;day date;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,98531));
 select * into c from public.tech_feed_briefings where user_id=p_user_id and lease=p_lease and lease_until>now()for update;
 if not found or p_attempt not in(0,1)or p_attempt is distinct from c.retry_count then return '{"status":"unavailable"}';end if;
 if c.reserved_lease=p_lease then return '{"status":"generating"}';end if;
 -- Keep the reservation's actual budget date stable while coach_reserve_ai reads it.
 select coalesce(time_zone,'Asia/Seoul')into zone from public.profiles where user_id=p_user_id for share;
 day:=(now()at time zone coalesce(zone,'Asia/Seoul'))::date;
 answer:=public.tech_feed_briefing_reserve(p_user_id,p_lease);
 if answer->>'status'='reserved' then
  update public.tech_feed_briefings set reserved_date=day where user_id=p_user_id and lease=p_lease;
 end if;
 return answer;
end$$;

create function public.tech_feed_briefing_retry(p_user_id uuid,p_lease uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.tech_feed_briefings;s jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,98531));
 select * into c from public.tech_feed_briefings where user_id=p_user_id and lease=p_lease and lease_until>now()for update;
 if not found or c.retry_count<>0 or c.reserved_lease is distinct from p_lease or c.reserved_date is null then return '{"status":"unavailable"}';end if;
 s:=public.tech_feed_briefing_snapshot(p_user_id,c.analyzer_version);
 if not(s->>'receiving')::boolean then return '{"status":"paused"}';end if;
 if s->>'input_hash' is distinct from c.input_hash then return '{"status":"unavailable"}';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,8763));
 update public.coach_ai_usage set attempts=attempts-1 where user_id=p_user_id and local_date=c.reserved_date and attempts>0;
 update public.tech_feed_briefings set reserved_lease=null,reserved_date=null,retry_count=1 where user_id=p_user_id and lease=p_lease;
 return '{"status":"retry"}';
end$$;

create function public.tech_feed_briefing_complete(p_user_id uuid,p_lease uuid,p_result jsonb,p_error text,p_attempt integer,p_retry_after_ms integer default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare c public.tech_feed_briefings;done boolean;reason text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,98531));
 select * into c from public.tech_feed_briefings where user_id=p_user_id and lease=p_lease for update;
 if not found or p_attempt not in(0,1)or p_attempt is distinct from c.retry_count then return false;end if;
 if p_error is null then
  done:=public.tech_feed_briefing_finish(p_user_id,p_lease,p_result,null);
  if not done then return false;end if;
  update public.tech_feed_briefings set failure_reason=null,retry_at=null,reserved_date=null where user_id=p_user_id and local_date=c.local_date and time_zone=c.time_zone;
  return true;
 end if;
 -- A caller may have timed out before learning that the DB reserved its call.
 -- Settlement uses the DB token and original date, never the caller's boolean.
 if c.reserved_lease=p_lease and c.reserved_date is not null then
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,8763));
  update public.coach_ai_usage set attempts=attempts-1 where user_id=p_user_id and local_date=c.reserved_date and attempts>0;
 end if;
 reason:=case when p_error in('provider_unavailable','rate_limited','timeout','configuration_error','invalid_response','network_error','unknown')then p_error else null end;
 update public.tech_feed_briefings set lease=null,lease_until=null,reserved_lease=null,reserved_date=null,
 last_error=case when p_error in('paused','quota_exhausted','insufficient')then p_error else 'unavailable'end,
 failure_reason=reason,retry_at=case when reason is null then null when reason='rate_limited'then now()+interval '120 seconds'else now()+interval '60 seconds'end+case when reason is null then interval '0 seconds' else greatest(0,least(coalesce(p_retry_after_ms,0),3600000)-case when reason='rate_limited'then 120000 else 60000 end)*interval '1 millisecond'end,
 updated_at=now()where user_id=p_user_id and lease=p_lease;
 return true;
end$$;

-- No user IDs, reservations, cooldown state or settlement are browser writable.
revoke all on function public.tech_feed_briefing_snapshot(uuid,integer,timestamptz)from public,anon,authenticated;
revoke all on function public.tech_feed_briefing_claim(uuid,integer,text,uuid[])from public,anon,authenticated;
revoke all on function public.tech_feed_briefing_reserve_attempt(uuid,uuid,integer)from public,anon,authenticated;
revoke all on function public.tech_feed_briefing_retry(uuid,uuid)from public,anon,authenticated;
revoke all on function public.tech_feed_briefing_complete(uuid,uuid,jsonb,text,integer,integer)from public,anon,authenticated;
grant execute on function public.tech_feed_briefing_snapshot(uuid,integer,timestamptz)to service_role;
grant execute on function public.tech_feed_briefing_claim(uuid,integer,text,uuid[])to service_role;
grant execute on function public.tech_feed_briefing_reserve_attempt(uuid,uuid,integer)to service_role;
grant execute on function public.tech_feed_briefing_retry(uuid,uuid)to service_role;
grant execute on function public.tech_feed_briefing_complete(uuid,uuid,jsonb,text,integer,integer)to service_role;
