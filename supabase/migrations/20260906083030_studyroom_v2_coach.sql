-- Additive server-owned coach state. Authenticated clients receive owner reads;
-- validated Edge handlers perform writes, and multi-row mutations use RPC locks.
create table public.coach_pilot_users(user_id uuid primary key references auth.users on delete cascade);
alter table public.coach_pilot_users enable row level security;
revoke all on public.coach_pilot_users from public,anon,authenticated;
grant all on public.coach_pilot_users to service_role;
create table public.coach_settings (
 user_id uuid primary key references auth.users on delete cascade, enabled boolean not null default false,
 summary_time time not null default '09:00', quiet_start time not null default '22:00', quiet_end time not null default '08:00',
 buffer_minutes int not null default 10 check(buffer_minutes between 0 and 120), min_slot_minutes int not null default 15 check(min_slot_minutes between 5 and 120),
 availability jsonb not null default '[]',channels jsonb not null default '{"slack":false,"web_push":false,"email":false}',
 muted_until timestamptz,version int not null default 1,updated_at timestamptz not null default now()
);
create table public.coach_careers (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,
 title text not null,experience text not null default '',target_date date,interests jsonb not null default '[]',skills jsonb not null default '[]',
 confirmed boolean not null default false,status text not null default 'active' check(status in('active','archived')),version int not null default 1,metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index coach_one_active_career on public.coach_careers(user_id) where status='active';
create table public.coach_connections (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,provider text not null check(provider in('google','github')),
 status text not null default 'disconnected' check(status in('connected','error','disconnected')),config jsonb not null default '{}',encrypted_credentials text,
 last_synced_at timestamptz,last_error text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,provider)
);
create table public.coach_events (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,source text not null default 'internal' check(source in('internal','google')),
 external_id text,connection_id uuid references public.coach_connections on delete cascade,title text not null,
 start_at timestamptz,end_at timestamptz,start_date date,end_date date,all_day boolean not null default false,time_zone text not null,
 repeat_weekdays jsonb not null default '[]',repeat_until date,created_at timestamptz not null default now(),
 check((all_day and start_date is not null and end_date is not null and start_date<end_date and start_at is null and end_at is null) or (not all_day and start_at is not null and end_at is not null and start_at<end_at and start_date is null and end_date is null))
);
create unique index coach_events_external on public.coach_events(user_id,source,external_id) where external_id is not null;
create index coach_events_owner on public.coach_events(user_id);
-- Only coach-scheduled todos have immutable instant anchors. Existing date-only
-- todos and historical attendance retain their original semantics.
alter table public.study_todos add column coach_start_at timestamptz,add column coach_end_at timestamptz;
alter table public.study_todos add constraint coach_todo_instants check((coach_start_at is null and coach_end_at is null) or (coach_start_at is not null and coach_end_at is not null and coach_start_at<coach_end_at));
create function public.coach_sync_todo_instants() returns trigger language plpgsql security invoker set search_path='' as $$declare z text;begin
 if new.coach_start_at is not null and (new.local_date,new.start_time,new.end_time) is distinct from (old.local_date,old.start_time,old.end_time) then
  select coalesce(time_zone,'Asia/Seoul') into z from public.profiles where user_id=new.user_id;
  z:=coalesce(z,'Asia/Seoul');
  if new.start_time is null or new.end_time is null then new.coach_start_at:=null;new.coach_end_at:=null;
  elsif (new.local_date,new.start_time,new.end_time) is distinct from ((new.coach_start_at at time zone z)::date,(new.coach_start_at at time zone z)::time,(new.coach_end_at at time zone z)::time) then
   new.coach_start_at:=(new.local_date+new.start_time) at time zone z;
   new.coach_end_at:=((new.local_date+case when new.end_time<=new.start_time then 1 else 0 end)+new.end_time) at time zone z;
  end if;
 end if;return new;
end $$;
revoke all on function public.coach_sync_todo_instants() from public,anon,authenticated;
create trigger coach_sync_todo_instants before update on public.study_todos for each row execute function public.coach_sync_todo_instants();
create table public.coach_repositories (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,connection_id uuid not null references public.coach_connections on delete cascade,
 owner text not null,name text not null,private boolean not null default false,ai_enabled boolean not null default false,head_sha text,analyzed_sha text,
 analysis jsonb not null default '[]',last_checked_at timestamptz,created_at timestamptz not null default now(),unique(user_id,owner,name)
);
create table public.coach_recommendations (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,career_id uuid not null references public.coach_careers on delete cascade,
 local_date date not null,status text not null default 'pending' check(status in('pending','accepted','skipped','expired')),title text not null,reason text not null,
 skill_id text,acceptance text not null,duration_minutes int not null check(duration_minutes between 5 and 240),start_at timestamptz not null,end_at timestamptz not null,
 source text not null check(source in('ai','rules','github')),evidence jsonb not null default '[]',feedback text check(feedback in('helpful','difficult','known','skip')),
 todo_id uuid references public.study_todos on delete set null,payload jsonb not null default '{}',created_at timestamptz not null default now(),check(end_at>start_at)
);
create index coach_recommendations_today on public.coach_recommendations(user_id,local_date,status);
create table public.coach_jobs (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,kind text not null check(kind in('roadmap','recommendations','google_sync','github_analysis')),
 payload jsonb not null default '{}',status text not null default 'pending' check(status in('pending','running','done','failed')),
 lease uuid,lease_until timestamptz,attempts int not null default 0,run_after timestamptz not null default now(),created_at timestamptz not null default now(),error_code text
);
create unique index coach_jobs_active on public.coach_jobs(user_id,kind) where status in('pending','running');
create index coach_jobs_due on public.coach_jobs(run_after) where status in('pending','running');
create table public.coach_deliveries (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,recommendation_id uuid references public.coach_recommendations on delete cascade,
 local_date date not null,kind text not null check(kind in('summary','opportunity')),channel text not null check(channel in('slack','web_push','email')),target_id text not null,
 status text not null default 'pending' check(status in('pending','sending','sent','failed','unknown','cancelled')),scheduled_at timestamptz not null,sent_at timestamptz,created_at timestamptz not null default now(),
 unique(user_id,local_date,kind,channel,target_id)
);
create table public.coach_oauth_states(id text primary key,user_id uuid not null references auth.users on delete cascade,provider text not null,expires_at timestamptz not null,config jsonb not null default '{}');
create table public.coach_ai_usage(user_id uuid not null references auth.users on delete cascade,local_date date not null,attempts int not null default 0 check(attempts between 0 and 6),primary key(user_id,local_date));
do $$ declare t text; begin
 foreach t in array array['coach_settings','coach_careers','coach_events','coach_recommendations','coach_jobs','coach_connections','coach_repositories','coach_deliveries','coach_oauth_states','coach_ai_usage'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  if t not in('coach_connections','coach_oauth_states','coach_ai_usage') then
   execute format('grant select on public.%I to authenticated',t);
   execute format('create policy coach_owner_read on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
  end if;
 end loop;
end $$;

create function coaching_private.reserve_ai(p_user_id uuid default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare u uuid; d date; n int;
begin
 if auth.jwt()->>'role'='service_role' then u:=p_user_id; else u:=auth.uid(); end if;
 if u is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' then raise exception 'unauthorized' using errcode='42501'; end if;
 select (now() at time zone coalesce(time_zone,'Asia/Seoul'))::date into d from public.profiles where user_id=u;
 d:=coalesce(d,(now() at time zone 'Asia/Seoul')::date);
 perform pg_advisory_xact_lock(hashtextextended(u::text,8763));
 insert into public.coach_ai_usage(user_id,local_date,attempts) values(u,d,1)
 on conflict(user_id,local_date) do update set attempts=public.coach_ai_usage.attempts+1 where public.coach_ai_usage.attempts<6 returning attempts into n;
 return n is not null;
end $$;
revoke all on function coaching_private.reserve_ai(uuid) from public,anon;
grant usage on schema coaching_private to service_role;
grant execute on function coaching_private.reserve_ai(uuid) to authenticated,service_role;
create function public.coach_reserve_ai(p_user_id uuid default null) returns boolean language sql security invoker set search_path='' as $$ select coaching_private.reserve_ai(p_user_id); $$;
revoke all on function public.coach_reserve_ai(uuid) from public,anon;
grant execute on function public.coach_reserve_ai(uuid) to authenticated,service_role;

create function public.coach_enqueue(p_user_id uuid,p_kind text,p_payload jsonb default '{}',p_run_after timestamptz default now()) returns uuid
language plpgsql security invoker set search_path='' as $$ declare jid uuid; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,8764));
 select id into jid from public.coach_jobs where user_id=p_user_id and kind=p_kind and status in('pending','running');
 if jid is null then insert into public.coach_jobs(user_id,kind,payload,run_after) values(p_user_id,p_kind,p_payload,p_run_after) returning id into jid; end if;
 return jid;
end $$;
create function public.coach_claim_jobs(p_limit int default 2) returns setof public.coach_jobs
language plpgsql security invoker set search_path='' as $$begin
 update public.coach_jobs set status='failed',error_code='lease_exhausted' where status='running' and lease_until<now() and attempts>=3;
 return query update public.coach_jobs set status='running',lease=gen_random_uuid(),lease_until=now()+interval '90 seconds',attempts=attempts+1
 where id in(select id from public.coach_jobs where run_after<=now() and attempts<3 and (status='pending' or (status='running' and lease_until<now())) order by run_after for update skip locked limit least(greatest(p_limit,1),4)) returning *;
end $$;
create function public.coach_finish_job(p_id uuid,p_lease uuid,p_status text,p_error text default null) returns boolean
language plpgsql security invoker set search_path='' as $$ begin
 if p_status not in('done','failed') then raise exception 'invalid_status'; end if;
 update public.coach_jobs set status=p_status,error_code=p_error,lease_until=null where id=p_id and lease=p_lease and status='running';return found;
end $$;

-- Every mutation invalidates versioned outstanding work. Saves and acceptance use
-- the same per-user lock, so plan changes cannot race with recommendation writes.
create function public.coach_wall_at(p_day date,p_time time,p_zone text,p_end boolean default false) returns timestamptz
language plpgsql stable security invoker set search_path='' as $$declare base timestamptz; candidate timestamptz; best timestamptz;delta int;begin
 base:=(p_day+p_time) at time zone p_zone;
 -- Covers one-hour and half-hour DST transitions, including both folds.
 for delta in -120..120 loop
  candidate:=base+make_interval(mins=>delta);
  if candidate at time zone p_zone=p_day+p_time then
   if best is null or (p_end and candidate>best) or (not p_end and candidate<best) then best:=candidate;end if;
  end if;
 end loop;return best;
end $$;
create function public.coach_mutate(p_user_id uuid,p_action text,p_input jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
<<mutation>>
declare s public.coach_settings%rowtype;c public.coach_careers%rowtype;r public.coach_recommendations%rowtype;e public.coach_events%rowtype;
 z text; a timestamptz;b timestamptz;d date;tid uuid;ev_start timestamptz;ev_end timestamptz;anchor date;occ date;n int;av jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,8764));
 insert into public.coach_settings(user_id) values(p_user_id) on conflict do nothing;
 select * into s from public.coach_settings where user_id=p_user_id for update;
 select coalesce(time_zone,'Asia/Seoul') into z from public.profiles where user_id=p_user_id;z:=coalesce(z,'Asia/Seoul');
 if p_action='settings' then
  if p_input?'time_zone' then
   if not exists(select 1 from pg_timezone_names where name=p_input->>'time_zone') then raise exception 'invalid_zone'; end if;
   update public.profiles set time_zone=p_input->>'time_zone' where user_id=p_user_id;
   update public.study_todos set local_date=(coach_start_at at time zone (p_input->>'time_zone'))::date,start_time=(coach_start_at at time zone (p_input->>'time_zone'))::time,end_time=(coach_end_at at time zone (p_input->>'time_zone'))::time where user_id=p_user_id and coach_start_at>now() and not is_completed;
  end if;
  update public.coach_settings set enabled=coalesce((p_input->>'enabled')::boolean,enabled),summary_time=coalesce((p_input->>'summary_time')::time,summary_time),quiet_start=coalesce((p_input->>'quiet_start')::time,quiet_start),quiet_end=coalesce((p_input->>'quiet_end')::time,quiet_end),buffer_minutes=coalesce((p_input->>'buffer_minutes')::int,buffer_minutes),min_slot_minutes=coalesce((p_input->>'min_slot_minutes')::int,min_slot_minutes),availability=coalesce(p_input->'availability',availability),channels=coalesce(p_input->'channels',channels),version=version+1,updated_at=now() where user_id=p_user_id;
 elsif p_action='save_career' then
  select * into c from public.coach_careers where user_id=p_user_id and status='active';
  if c.id is not null and c.title=p_input->>'title' then
   update public.coach_careers set experience=p_input->>'experience',target_date=(p_input->>'target_date')::date,interests=p_input->'interests',skills=p_input->'skills',confirmed=(p_input->>'confirmed')::boolean,version=version+1,updated_at=now() where id=c.id;
  else
   update public.coach_careers set status='archived',updated_at=now() where user_id=p_user_id and status='active';
   insert into public.coach_careers(user_id,title,experience,target_date,interests,skills,confirmed) values(p_user_id,p_input->>'title',p_input->>'experience',(p_input->>'target_date')::date,p_input->'interests',p_input->'skills',(p_input->>'confirmed')::boolean);
  end if;
  update public.coach_settings set version=version+1,updated_at=now() where user_id=p_user_id;
 elsif p_action='save_event' then
  if p_input?'id' then
   select * into e from public.coach_events where id=(p_input->>'id')::uuid and user_id=p_user_id and source='internal';if e.id is null then raise exception 'missing_event';end if;
   delete from public.coach_events where id=e.id;
  end if;
  insert into public.coach_events(id,user_id,title,start_at,end_at,start_date,end_date,all_day,time_zone,repeat_weekdays,repeat_until) values(coalesce(e.id,gen_random_uuid()),p_user_id,p_input->>'title',(p_input->>'start_at')::timestamptz,(p_input->>'end_at')::timestamptz,(p_input->>'start_date')::date,(p_input->>'end_date')::date,(p_input->>'all_day')::boolean,p_input->>'time_zone',p_input->'repeat_weekdays',(p_input->>'repeat_until')::date);
  update public.coach_settings set version=version+1,updated_at=now() where user_id=p_user_id;
 elsif p_action='delete_event' then
  delete from public.coach_events where id=(p_input->>'id')::uuid and user_id=p_user_id and source='internal';if not found then raise exception 'missing_event';end if;
  update public.coach_settings set version=version+1,updated_at=now() where user_id=p_user_id;
 elsif p_action='accept' then
  select * into r from public.coach_recommendations where id=(p_input->>'id')::uuid and user_id=p_user_id for update;
  if r.id is null then raise exception 'missing_recommendation';end if;
  if r.status='accepted' then return jsonb_build_object('todo_id',r.todo_id);end if;
  if not s.enabled or r.status<>'pending' or r.payload->>'input_version' is distinct from s.version::text then raise exception 'stale_recommendation';end if;
  a:=coalesce((p_input->>'start_at')::timestamptz,r.start_at);b:=a+make_interval(mins=>r.duration_minutes);d:=(a at time zone z)::date;
  if a<now() or d<>r.local_date or (b at time zone z)::date<>d then raise exception 'invalid_start';end if;
  if not coalesce((select range_agg(tstzrange(bounds.a,bounds.b,'[)')) @> tstzrange(mutation.a,mutation.b,'[)') from (select public.coach_wall_at(d,(w->>'start')::time,z,false) a,public.coach_wall_at(d,(w->>'end')::time,z,true) b from jsonb_array_elements(s.availability) w where (w->>'weekday')::int=extract(dow from d)::int) bounds where bounds.a is not null and bounds.b is not null and bounds.a<bounds.b),false) then raise exception 'outside_availability';end if;
  if exists(select 1 from public.coach_connections where user_id=p_user_id and provider='google' and status<>'disconnected' and (status<>'connected' or last_synced_at is null or last_synced_at<now()-interval '20 minutes')) then raise exception 'calendar_stale';end if;
  for e in select * from public.coach_events where user_id=p_user_id loop
   if jsonb_array_length(e.repeat_weekdays)=0 then
    ev_start:=case when e.all_day then e.start_date::timestamp at time zone z else e.start_at end;ev_end:=case when e.all_day then e.end_date::timestamp at time zone z else e.end_at end;
    if a<ev_end+make_interval(mins=>s.buffer_minutes) and b>ev_start-make_interval(mins=>s.buffer_minutes) then raise exception 'schedule_conflict';end if;
   else
    anchor:=case when e.all_day then e.start_date else (e.start_at at time zone e.time_zone)::date end;
    for n in -8..2 loop
     occ:=d+n;
     if occ>=anchor and (e.repeat_until is null or occ<=e.repeat_until) and e.repeat_weekdays @> to_jsonb(array[extract(dow from occ)::int]) then
      if e.all_day then ev_start:=public.coach_wall_at(occ,'00:00',z,false);ev_end:=public.coach_wall_at(occ+(e.end_date-e.start_date),'00:00',z,true);
      else ev_start:=public.coach_wall_at(occ,(e.start_at at time zone e.time_zone)::time,e.time_zone,false);ev_end:=public.coach_wall_at(occ+((e.end_at at time zone e.time_zone)::date-anchor),(e.end_at at time zone e.time_zone)::time,e.time_zone,true);end if;
      if a<ev_end+make_interval(mins=>s.buffer_minutes) and b>ev_start-make_interval(mins=>s.buffer_minutes) then raise exception 'schedule_conflict';end if;
     end if;
    end loop;
   end if;
  end loop;
  if exists(select 1 from public.study_todos t where t.user_id=p_user_id and not t.is_completed and t.start_time is not null and t.local_date between d-1 and d+1 and a<coalesce(t.coach_end_at,(((t.local_date+case when t.end_time<=t.start_time then 1 else 0 end)+t.end_time) at time zone z)) + make_interval(mins=>s.buffer_minutes) and b>coalesce(t.coach_start_at,((t.local_date+t.start_time) at time zone z)) - make_interval(mins=>s.buffer_minutes)) then raise exception 'schedule_conflict';end if;
  if r.payload->>'source_todo_id' is not null then
   select id into tid from public.study_todos where id=(r.payload->>'source_todo_id')::uuid and user_id=p_user_id and not is_completed and start_time is null for update;
   if tid is null then raise exception 'stale_recommendation';end if;
   update public.study_todos set local_date=d,start_time=(a at time zone z)::time,end_time=(b at time zone z)::time,coach_start_at=a,coach_end_at=b where id=tid;
  else
   insert into public.study_todos(user_id,local_date,title,start_time,end_time,coach_start_at,coach_end_at) values(p_user_id,d,r.title,(a at time zone z)::time,(b at time zone z)::time,a,b) returning id into tid;
  end if;
  update public.coach_recommendations set status='accepted',todo_id=tid,start_at=a,end_at=b where id=r.id;
  update public.coach_deliveries set status='cancelled' where recommendation_id=r.id and status='pending';
  return jsonb_build_object('todo_id',tid);
 elsif p_action='feedback' then
  if p_input->>'feedback' not in('helpful','difficult','known','skip') then raise exception 'invalid_feedback';end if;
  update public.coach_recommendations set feedback=p_input->>'feedback',status=case when p_input->>'feedback' in('known','skip') and status='pending' then 'skipped' else status end where id=(p_input->>'id')::uuid and user_id=p_user_id;
  if not found then raise exception 'missing_recommendation';end if;
  update public.coach_deliveries set status='cancelled' where recommendation_id=(p_input->>'id')::uuid and status='pending';return '{"ok":true}';
 elsif p_action='mute_today' then
  update public.coach_settings set muted_until=(((now() at time zone z)::date+1)::timestamp at time zone z) where user_id=p_user_id;
  update public.coach_deliveries set status='cancelled' where user_id=p_user_id and status='pending';return '{"ok":true}';
 else raise exception 'invalid_action';end if;
 update public.coach_recommendations set status='expired' where user_id=p_user_id and status='pending';
 update public.coach_jobs set status='failed',error_code='input_changed' where user_id=p_user_id and kind in('roadmap','recommendations') and status in('pending','running');
 if not exists(select 1 from public.coach_settings where user_id=p_user_id and enabled) then
  update public.coach_jobs set status='failed',error_code='disabled' where user_id=p_user_id and status in('pending','running');
 end if;
 update public.coach_deliveries set status='cancelled' where user_id=p_user_id and status='pending';
 return '{"ok":true}';
end $$;

create function public.coach_save_result(p_id uuid,p_lease uuid,p_version int,p_result jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$declare j public.coach_jobs%rowtype;v int;item jsonb;begin
 select * into j from public.coach_jobs where id=p_id; if j.id is null then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(j.user_id::text,8764));
 select version into v from public.coach_settings where user_id=j.user_id and enabled;
 if v is distinct from p_version then return false;end if;
 perform 1 from public.coach_jobs where id=p_id and status='running' and lease=p_lease and lease_until>clock_timestamp() for update;
 if not found then return false;end if;
 if j.kind='roadmap' then update public.coach_careers set skills=p_result->'skills',metadata=p_result-'skills',updated_at=now() where user_id=j.user_id and status='active' and not confirmed;
 elsif j.kind='recommendations' then
  update public.coach_recommendations set status='expired' where user_id=j.user_id and local_date=(p_result->>'local_date')::date and status='pending';
  for item in select * from jsonb_array_elements(p_result->'recommendations') loop
   insert into public.coach_recommendations(user_id,career_id,local_date,title,reason,skill_id,acceptance,duration_minutes,start_at,end_at,source,evidence,payload)
   values(j.user_id,(p_result->>'career_id')::uuid,(p_result->>'local_date')::date,item->>'title',item->>'reason',item->>'skill_id',item->>'acceptance',(item->>'duration_minutes')::int,(item->>'start_at')::timestamptz,(item->>'end_at')::timestamptz,item->>'source',coalesce(item->'evidence','[]'),coalesce(item->'payload','{}')||jsonb_build_object('input_version',p_version));
  end loop;
 end if;
 update public.coach_jobs set status='done',lease_until=null where id=p_id and lease=p_lease;return true;
end $$;

create function public.coach_google_snapshot(p_user_id uuid,p_connection_id uuid,p_events jsonb,p_expected_config jsonb default null,p_job_id uuid default null,p_lease uuid default null) returns boolean
language plpgsql security invoker set search_path='' as $$ declare e jsonb;before_times jsonb;after_times jsonb;begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,8764));
 if not exists(select 1 from public.coach_settings where user_id=p_user_id and enabled) then return false;end if;
 if p_job_id is not null or p_lease is not null then
  perform 1 from public.coach_jobs where id=p_job_id and user_id=p_user_id and kind='google_sync' and status='running' and lease=p_lease and lease_until>clock_timestamp() for update;
  if not found then return false;end if;
 end if;
 perform 1 from public.coach_connections where id=p_connection_id and user_id=p_user_id and provider='google' and status in('connected','error') and (p_expected_config is null or config=p_expected_config) for update;
 if not found then return false;end if;
 select coalesce(jsonb_agg(jsonb_build_array(external_id,start_at,end_at,start_date,end_date,all_day,time_zone) order by external_id),'[]') into before_times from public.coach_events where user_id=p_user_id and connection_id=p_connection_id and source='google';
 delete from public.coach_events where user_id=p_user_id and connection_id=p_connection_id and source='google';
 for e in select * from jsonb_array_elements(p_events) loop
  insert into public.coach_events(user_id,source,connection_id,external_id,title,start_at,end_at,start_date,end_date,all_day,time_zone)
  values(p_user_id,'google',p_connection_id,e->>'external_id',e->>'title',(e->>'start_at')::timestamptz,(e->>'end_at')::timestamptz,(e->>'start_date')::date,(e->>'end_date')::date,(e->>'all_day')::boolean,coalesce(e->>'time_zone','UTC'));
 end loop;
 select coalesce(jsonb_agg(jsonb_build_array(external_id,start_at,end_at,start_date,end_date,all_day,time_zone) order by external_id),'[]') into after_times from public.coach_events where user_id=p_user_id and connection_id=p_connection_id and source='google';
 if before_times is distinct from after_times then
  update public.coach_settings set version=version+1,updated_at=now() where user_id=p_user_id;
  update public.coach_recommendations set status='expired' where user_id=p_user_id and status='pending';
  update public.coach_jobs set status='failed',error_code='input_changed' where user_id=p_user_id and kind='recommendations' and status in('pending','running');
  update public.coach_deliveries set status='cancelled' where user_id=p_user_id and status='pending';
 end if;
 update public.coach_connections set last_synced_at=now(),last_error=null,status='connected',updated_at=now() where id=p_connection_id;return true;
end $$;
create function public.coach_repository_result(p_user_id uuid,p_repo_id uuid,p_connection_id uuid,p_expected_config jsonb,p_expected_ai_enabled boolean,p_sha text,p_analysis jsonb,p_job_id uuid default null,p_lease uuid default null) returns boolean
language plpgsql security invoker set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,8764));
 if not exists(select 1 from public.coach_settings where user_id=p_user_id and enabled) then return false;end if;
 if p_job_id is not null or p_lease is not null then
  perform 1 from public.coach_jobs where id=p_job_id and user_id=p_user_id and kind='github_analysis' and status='running' and lease=p_lease and lease_until>clock_timestamp() for update;
  if not found then return false;end if;
 end if;
 perform 1 from public.coach_connections where id=p_connection_id and user_id=p_user_id and provider='github' and status='connected' and config=p_expected_config for update;
 if not found then return false;end if;
 update public.coach_repositories set head_sha=p_sha,analyzed_sha=p_sha,analysis=p_analysis,last_checked_at=now() where id=p_repo_id and user_id=p_user_id and connection_id=p_connection_id and ai_enabled=p_expected_ai_enabled;return found;
end $$;

-- OAuth exchange occurs outside the transaction; a claimed, unexpired state is
-- checked again under the same lock used for disconnect before saving tokens.
create function public.coach_complete_connection(p_state_id text,p_claim_id text,p_provider text,p_config jsonb,p_encrypted_credentials text) returns boolean
language plpgsql security invoker set search_path='' as $$declare u uuid;begin
 select user_id into u from public.coach_oauth_states where id=p_state_id;
 if u is null then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,8764));
 perform 1 from public.coach_oauth_states where id=p_state_id and user_id=u and provider=p_provider and config->>'claim_id'=p_claim_id and expires_at>now() for update;
 if not found then return false;end if;
 insert into public.coach_connections(user_id,provider,status,config,encrypted_credentials,updated_at)
 values(u,p_provider,'connected',p_config,p_encrypted_credentials,now())
 on conflict(user_id,provider) do update set status='connected',config=excluded.config,encrypted_credentials=excluded.encrypted_credentials,last_synced_at=null,last_error=null,updated_at=now();
 delete from public.coach_oauth_states where id=p_state_id;
 return true;
end $$;

create function public.coach_disconnect(p_user_id uuid,p_provider text) returns boolean
language plpgsql security invoker set search_path='' as $$begin
 if p_provider not in('google','github') then raise exception 'invalid_provider';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,8764));
 delete from public.coach_oauth_states where user_id=p_user_id and provider=p_provider;
 update public.coach_connections set status='disconnected',encrypted_credentials=null,config='{}',last_synced_at=null,last_error=null,updated_at=now() where user_id=p_user_id and provider=p_provider;
 if p_provider='google' then delete from public.coach_events where user_id=p_user_id and source='google';
 else delete from public.coach_repositories where user_id=p_user_id;end if;
 update public.coach_settings set version=version+1,updated_at=now() where user_id=p_user_id;
 update public.coach_recommendations set status='expired' where user_id=p_user_id and status='pending';
 update public.coach_jobs set status='failed',error_code='disconnected' where user_id=p_user_id and status in('pending','running') and (kind='recommendations' or kind=case when p_provider='google' then 'google_sync' else 'github_analysis' end);
 update public.coach_deliveries set status='cancelled' where user_id=p_user_id and status='pending';
 return true;
end $$;

-- Provider authorization is checked before this RPC; the connection generation
-- is checked again atomically so a slow selection cannot resurrect disconnected
-- repository access or restore consent from a previous authorization.
create function public.coach_select_repository(p_user_id uuid,p_connection_id uuid,p_expected_config jsonb,p_repository jsonb,p_selected boolean default true) returns boolean
language plpgsql security invoker set search_path='' as $$begin
 if coalesce(p_repository->>'owner','') !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,99}$' or coalesce(p_repository->>'name','') !~ '^[A-Za-z0-9_.-]{1,100}$' then raise exception 'invalid_repository';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,8764));
 perform 1 from public.coach_connections where id=p_connection_id and user_id=p_user_id and provider='github' and status='connected' and config=p_expected_config for update;
 if not found then return false;end if;
 if p_selected then
  if jsonb_typeof(p_repository->'private') is distinct from 'boolean' or jsonb_typeof(p_repository->'ai_enabled') is distinct from 'boolean' then raise exception 'invalid_repository';end if;
  insert into public.coach_repositories(user_id,connection_id,owner,name,private,ai_enabled,analyzed_sha,analysis,last_checked_at)
  values(p_user_id,p_connection_id,p_repository->>'owner',p_repository->>'name',(p_repository->>'private')::boolean,(p_repository->>'ai_enabled')::boolean,null,'[]',null)
  on conflict(user_id,owner,name) do update set connection_id=excluded.connection_id,private=excluded.private,ai_enabled=excluded.ai_enabled,analyzed_sha=null,analysis='[]',last_checked_at=null;
 else
  delete from public.coach_repositories where user_id=p_user_id and connection_id=p_connection_id and owner=p_repository->>'owner' and name=p_repository->>'name';
 end if;
 update public.coach_settings set version=version+1,updated_at=now() where user_id=p_user_id;
 update public.coach_recommendations set status='expired' where user_id=p_user_id and status='pending';
 update public.coach_jobs set status='failed',error_code='input_changed' where user_id=p_user_id and kind in('github_analysis','recommendations') and status in('pending','running');
 update public.coach_deliveries set status='cancelled' where user_id=p_user_id and status='pending';
 return true;
end $$;
do $$declare f record;begin for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('coach_enqueue','coach_claim_jobs','coach_finish_job','coach_mutate','coach_save_result','coach_google_snapshot','coach_repository_result','coach_wall_at','coach_complete_connection','coach_disconnect','coach_select_repository') loop execute format('revoke all on function %s from public,anon,authenticated',f.sig);execute format('grant execute on function %s to service_role',f.sig);end loop;end $$;
