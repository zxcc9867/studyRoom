-- Forward-only actual study tracking. Legacy lifecycle RPC bodies remain unchanged.
create schema if not exists actual_study_private;
revoke all on schema actual_study_private from public, anon, authenticated;

create table public.study_todo_plans (
  todo_id uuid primary key,
  user_id uuid not null,
  original_local_date date not null,
  original_start_at timestamptz,
  original_end_at timestamptz,
  target_seconds integer,
  time_zone text not null,
  tracking_started_at timestamptz not null default now(),
  evaluation_eligible boolean not null,
  foreign key (todo_id,user_id) references public.study_todos(id,user_id) on delete cascade,
  check ((target_seconds is null and original_start_at is null and original_end_at is null)
    or (target_seconds > 0 and original_end_at > original_start_at))
);
create table public.study_actual_sessions (
  session_id uuid primary key,
  user_id uuid not null,
  current_todo_id uuid,
  tracking_started_at timestamptz not null default now(),
  excluded_seconds integer not null default 0 check(excluded_seconds>=0),
  unknown_allocation boolean not null default false,
  foreign key(session_id,user_id) references public.study_sessions(id,user_id) on delete cascade,
  foreign key(current_todo_id,user_id) references public.study_todos(id,user_id) on delete set null (current_todo_id)
);
create table public.study_todo_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_id uuid not null,
  todo_id uuid not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  accepted_seconds integer not null default 0 check(accepted_seconds>=0),
  excluded_seconds integer not null default 0 check(excluded_seconds>=0),
  foreign key(session_id,user_id) references public.study_sessions(id,user_id) on delete cascade,
  foreign key(todo_id,user_id) references public.study_todos(id,user_id) on delete cascade,
  check(ended_at is null or ended_at>=started_at),
  check(ended_at is null or accepted_seconds+excluded_seconds<=floor(extract(epoch from ended_at-started_at)))
);
create unique index study_todo_segments_one_open_user on public.study_todo_segments(user_id) where ended_at is null;
create index study_todo_segments_todo on public.study_todo_segments(user_id,todo_id,started_at);
create index study_todo_segments_session on public.study_todo_segments(session_id,started_at);
create table public.study_schedule_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  todo_id uuid not null,
  before_interval jsonb not null,
  after_interval jsonb not null,
  created_at timestamptz not null default now(),
  unique(user_id,request_id,todo_id),
  foreign key(todo_id,user_id) references public.study_todos(id,user_id) on delete cascade
);
create table actual_study_private.requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  preview jsonb not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id,request_id)
);
alter table actual_study_private.requests enable row level security;

do $$
declare t text;
begin
  foreach t in array array['study_todo_plans','study_actual_sessions','study_todo_segments','study_schedule_adjustments'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
  end loop;
end $$;

create function actual_study_private.interval_json(p_start timestamptz,p_end timestamptz,p_zone text)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('start_at',p_start,'end_at',p_end,
   'local_date',(p_start at time zone p_zone)::date,'end_date',(p_end at time zone p_zone)::date,
   'start_time',(p_start at time zone p_zone)::time,'end_time',(p_end at time zone p_zone)::time)
$$;

create function actual_study_private.snapshot_todo()
returns trigger language plpgsql security definer set search_path='' as $$
declare z text; a timestamptz; b timestamptz;
begin
 select coalesce(time_zone,'Asia/Tokyo') into z from public.profiles where user_id=new.user_id;
 z:=coalesce(z,'Asia/Tokyo');
 if new.start_time is not null and new.end_time is not null then
   a:=(new.local_date+new.start_time) at time zone z;
   b:=((new.local_date+case when new.end_time<=new.start_time then 1 else 0 end)+new.end_time) at time zone z;
 end if;
 insert into public.study_todo_plans(todo_id,user_id,original_local_date,original_start_at,original_end_at,target_seconds,time_zone,evaluation_eligible)
 values(new.id,new.user_id,new.local_date,a,b,extract(epoch from b-a)::integer,z,new.local_date>=(now() at time zone z)::date)
 on conflict(todo_id) do update set
   original_local_date=excluded.original_local_date,
   original_start_at=excluded.original_start_at,original_end_at=excluded.original_end_at,
   target_seconds=excluded.target_seconds,time_zone=excluded.time_zone,
   evaluation_eligible=excluded.evaluation_eligible
 where study_todo_plans.target_seconds is null and excluded.target_seconds is not null;
 return new;
end $$;

-- Untimed originals may acquire their FIRST timed plan; timed originals never change.
create trigger actual_study_snapshot_todo after insert or update of start_time,end_time,local_date
on public.study_todos for each row execute function actual_study_private.snapshot_todo();

insert into public.study_todo_plans(todo_id,user_id,original_local_date,original_start_at,original_end_at,target_seconds,time_zone,evaluation_eligible)
select t.id,t.user_id,t.local_date,x.a,x.b,extract(epoch from x.b-x.a)::integer,z.zone,
 t.local_date>=(now() at time zone z.zone)::date
from public.study_todos t left join public.profiles p on p.user_id=t.user_id
cross join lateral(select coalesce(p.time_zone,'Asia/Tokyo') zone)z
cross join lateral(select
 case when t.start_time is not null then (t.local_date+t.start_time) at time zone z.zone end a,
 case when t.end_time is not null then ((t.local_date+case when t.end_time<=t.start_time then 1 else 0 end)+t.end_time) at time zone z.zone end b)x;

create function actual_study_private.close_segment(p_session uuid,p_at timestamptz)
returns void language sql set search_path='' as $$
 update public.study_todo_segments set ended_at=greatest(started_at,p_at),
 accepted_seconds=greatest(0,floor(extract(epoch from p_at-started_at))::integer)
 where session_id=p_session and ended_at is null
$$;

-- Checkpoints normally concern only the current focus. Legacy callers that missed
-- checkpoints are conservatively debited newest-first; no unknown time is allocated.
create function actual_study_private.debit_segments(p_session uuid,p_seconds integer)
returns void language plpgsql set search_path='' as $$
declare r record; n integer:=greatest(0,p_seconds); d integer;
begin
 for r in select id,accepted_seconds from public.study_todo_segments
   where session_id=p_session and ended_at is not null and accepted_seconds>0
   order by started_at desc,id desc for update
 loop
   exit when n=0;
   d:=least(n,r.accepted_seconds);
   update public.study_todo_segments set accepted_seconds=accepted_seconds-d,excluded_seconds=excluded_seconds+d where id=r.id;
   n:=n-d;
 end loop;
 if n>0 then update public.study_actual_sessions set unknown_allocation=true where session_id=p_session; end if;
end $$;

create function actual_study_private.session_transition()
returns trigger language plpgsql security definer set search_path='' as $$
declare st public.study_actual_sessions%rowtype; boundary timestamptz; gross integer; deduction integer; allocated integer;
begin
 select * into st from public.study_actual_sessions where session_id=new.id for update;
 if not found then return new; end if;
 boundary:=least(now(),coalesce(new.ended_at,new.paused_at,now()),coalesce(new.lease_expires_at,new.started_at+interval '1 hour'));
 if old.status='active' and (new.status<>'active' or (old.paused_at is null and new.paused_at is not null)) then
   perform actual_study_private.close_segment(new.id,boundary);
 end if;
 if old.status='active' and new.status<>'active' then
   gross:=greatest(0,floor(extract(epoch from boundary-new.started_at))::integer-new.paused_seconds);
   deduction:=greatest(st.excluded_seconds,gross-new.duration_seconds);
   perform actual_study_private.debit_segments(new.id,greatest(0,deduction-st.excluded_seconds));
   new.duration_seconds:=least(new.duration_seconds,greatest(0,gross-deduction));
   select coalesce(sum(accepted_seconds),0)::integer into allocated from public.study_todo_segments where session_id=new.id;
   perform actual_study_private.debit_segments(new.id,greatest(0,allocated-new.duration_seconds));
   update public.study_actual_sessions set excluded_seconds=deduction where session_id=new.id;
 elsif old.paused_at is not null and new.paused_at is null and new.status='active'
   and now()<coalesce(new.lease_expires_at,new.started_at+interval '1 hour') and st.current_todo_id is not null then
   insert into public.study_todo_segments(user_id,session_id,todo_id,started_at)
   values(new.user_id,new.id,st.current_todo_id,now());
 end if;
 return new;
end $$;
create trigger actual_study_session_transition before update on public.study_sessions
for each row execute function actual_study_private.session_transition();

create function actual_study_private.known_seconds(p_todo uuid,p_now timestamptz)
returns integer language sql stable set search_path='' as $$
 select coalesce(sum(case when g.ended_at is not null then g.accepted_seconds else
   greatest(0,floor(extract(epoch from least(p_now,coalesce(s.paused_at,p_now),coalesce(s.lease_expires_at,s.started_at+interval '1 hour'))-g.started_at))::integer)
 end),0)::integer from public.study_todo_segments g join public.study_sessions s on s.id=g.session_id where g.todo_id=p_todo
$$;
-- A historical session link is not evidence of a precise first start.
create function actual_study_private.todo_unknown(p_todo uuid)
returns boolean language sql stable set search_path='' as $$
 select exists(
   select 1 from public.study_session_todos l join public.study_sessions s on s.id=l.session_id
   left join public.study_actual_sessions a on a.session_id=s.id
   where l.todo_id=p_todo and (
     (a.session_id is null and s.started_at<now()) or coalesce(a.unknown_allocation,false)
   )
 )
$$;

create function public.get_actual_study_state(p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); s public.study_sessions%rowtype; st public.study_actual_sessions%rowtype; items jsonb;
begin
 if u is null then raise exception 'Not authenticated'; end if;
 select * into s from public.study_sessions where id=p_session_id and user_id=u;
 if not found then raise exception 'Study session not found'; end if;
 select * into st from public.study_actual_sessions where session_id=s.id;
 select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object(
   'original_start_at',p.original_start_at,'original_end_at',p.original_end_at,'target_seconds',p.target_seconds,
   'first_started_at',case when not actual_study_private.todo_unknown(t.id) then (select min(started_at) from public.study_todo_segments where todo_id=t.id) end,
   'first_tracked_at',(select min(started_at) from public.study_todo_segments where todo_id=t.id),
   'known_seconds',actual_study_private.known_seconds(t.id,now()),
   'open_started_at',(select started_at from public.study_todo_segments where todo_id=t.id and ended_at is null),
   'remaining_seconds',case when p.target_seconds is not null then greatest(0,p.target_seconds-actual_study_private.known_seconds(t.id,now())) end,
   'adjustment_count',(select count(*) from public.study_schedule_adjustments where todo_id=t.id),
   'unknown_allocation',actual_study_private.todo_unknown(t.id),
   'evaluation_eligible',p.evaluation_eligible and not actual_study_private.todo_unknown(t.id)) order by l.linked_at,t.id),'[]'::jsonb)
 into items from public.study_session_todos l join public.study_todos t on t.id=l.todo_id
 left join public.study_todo_plans p on p.todo_id=t.id where l.session_id=s.id and l.user_id=u;
 return jsonb_build_object('session_id',s.id,'current_todo_id',st.current_todo_id,'tracking_started_at',st.tracking_started_at,
  'excluded_seconds',coalesce(st.excluded_seconds,0),'unknown_allocation',coalesce(st.unknown_allocation,true),
  'server_now',now(),'todos',items);
end $$;

create function public.checkpoint_actual_study_exclusion(p_session_id uuid,p_excluded_seconds integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); s public.study_sessions%rowtype; st public.study_actual_sessions%rowtype; gross integer; boundary timestamptz;
begin
 if u is null then raise exception 'Not authenticated'; end if;
 select * into s from public.study_sessions where id=p_session_id and user_id=u and status='active' for update;
 if not found then raise exception 'Active study session not found'; end if;
 boundary:=least(now(),coalesce(s.paused_at,now()),coalesce(s.lease_expires_at,s.started_at+interval '1 hour'));
 gross:=greatest(0,floor(extract(epoch from boundary-s.started_at))::integer-s.paused_seconds);
 insert into public.study_actual_sessions(session_id,user_id,unknown_allocation)
 values(s.id,u,true) on conflict do nothing;
 select * into st from public.study_actual_sessions where session_id=s.id for update;
 if p_excluded_seconds is null or p_excluded_seconds<st.excluded_seconds or p_excluded_seconds>gross then
   raise exception 'ACTUAL_STUDY_INVALID_EXCLUSION';
 end if;
 if p_excluded_seconds>st.excluded_seconds then
   perform actual_study_private.close_segment(s.id,boundary);
   perform actual_study_private.debit_segments(s.id,p_excluded_seconds-st.excluded_seconds);
   update public.study_actual_sessions set excluded_seconds=p_excluded_seconds where session_id=s.id;
   if s.paused_at is null and now()<coalesce(s.lease_expires_at,s.started_at+interval '1 hour') and st.current_todo_id is not null then
     insert into public.study_todo_segments(user_id,session_id,todo_id,started_at) values(u,s.id,st.current_todo_id,now());
   end if;
 end if;
 return public.get_actual_study_state(s.id);
end $$;

create function public.pause_actual_study_session(p_session_id uuid,p_excluded_seconds integer default 0)
returns public.study_sessions language plpgsql security definer set search_path='' as $$
begin
 perform public.checkpoint_actual_study_exclusion(p_session_id,p_excluded_seconds);
 return public.pause_study_session(p_session_id);
end $$;

create function actual_study_private.revision(p_user uuid,p_session uuid)
returns text language sql stable set search_path='' as $$
 select md5(jsonb_build_object(
 'todos',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]')from public.study_todos t where t.user_id=p_user),
 'plans',(select coalesce(jsonb_agg(to_jsonb(p) order by p.todo_id),'[]')from public.study_todo_plans p where p.user_id=p_user),
 'profile',(select to_jsonb(p) from public.profiles p where p.user_id=p_user),
 'session',(select to_jsonb(s)-'updated_at' from public.study_sessions s where s.id=p_session and s.user_id=p_user),
 'active',(select jsonb_agg(s.id order by s.id) from public.study_sessions s where s.user_id=p_user and s.status='active'),
 'tracking',(select to_jsonb(s) from public.study_actual_sessions s where s.session_id=p_session and s.user_id=p_user),
 'segments',(select coalesce(jsonb_agg(to_jsonb(g) order by g.id),'[]') from public.study_todo_segments g where g.user_id=p_user),
 'links',(select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]') from public.study_session_todos l where l.user_id=p_user),
 'recovery',(select exists(select 1 from public.study_recovery_requests where user_id=p_user and status='pending'))
 )::text)
$$;

create function actual_study_private.preview(p_action text,p_todo_ids uuid[],p_current_todo_id uuid,p_session_id uuid,p_excluded_seconds integer,p_minute timestamptz)
returns jsonb language plpgsql stable set search_path='' as $$
declare
 u uuid:=auth.uid(); z text; ids uuid[]; s public.study_sessions%rowtype; st public.study_actual_sessions%rowtype;
 t public.study_todos%rowtype; p public.study_todo_plans%rowtype; r record;
 problem text; changes jsonb:='[]'; result jsonb; remaining integer; known integer; gross integer; pending integer;
 a timestamptz; b timestamptz; cursor_end timestamptz; new_end timestamptz; duration integer;
 count_todos integer; scan_count integer:=0;
begin
 if u is null then raise exception 'Not authenticated'; end if;
 select coalesce(time_zone,'Asia/Tokyo') into z from public.profiles where user_id=u; z:=coalesce(z,'Asia/Tokyo');
 select coalesce(array_agg(distinct x order by x),'{}'::uuid[])into ids from unnest(p_todo_ids)x where x is not null;
 select * into s from public.study_sessions where id=p_session_id and user_id=u;
 select * into st from public.study_actual_sessions where session_id=s.id;
 select * into t from public.study_todos where id=p_current_todo_id and user_id=u;
 select * into p from public.study_todo_plans where todo_id=t.id;
 if p_action is null or p_action not in('start','resume','switch') then problem:='INVALID_ACTION';
 elsif cardinality(ids)=0 or p_current_todo_id is null or not(p_current_todo_id=any(ids)) then problem:='CURRENT_TODO_REQUIRED';
 elsif t.id is null or t.is_completed then problem:='INVALID_CURRENT_TODO';
 elsif p_action='start' and (p_session_id is not null or exists(select 1 from public.study_sessions where user_id=u and status='active')) then problem:='ACTIVE_SESSION_EXISTS';
 elsif p_action<>'start' and (s.id is null or s.status<>'active') then problem:='ACTIVE_SESSION_NOT_FOUND';
 elsif p_action<>'start' and now()>=coalesce(s.lease_expires_at,s.started_at+interval '1 hour') then problem:='LEASE_EXPIRED';
 elsif p_action='resume' and s.paused_at is null then problem:='SESSION_NOT_PAUSED';
 elsif p_action='switch' and s.paused_at is not null then problem:='SESSION_PAUSED';
 elsif p_action='switch' and st.current_todo_id=p_current_todo_id then problem:='ALREADY_CURRENT_TODO';
 elsif p_action='start' and exists(select 1 from public.study_recovery_requests where user_id=u and status='pending') then problem:='RECOVERY_REQUIRED';
 end if;
 select count(*)::integer into count_todos from public.study_todos d where d.user_id=u and d.id=any(ids) and not d.is_completed
 and (case when p_action='start' then d.local_date=(now() at time zone z)::date
   else d.local_date=(now() at time zone z)::date or exists(select 1 from public.study_session_todos l where l.session_id=s.id and l.todo_id=d.id and l.user_id=u)end);
 if count_todos<>cardinality(ids) then problem:=coalesce(problem,'INVALID_SELECTION'); end if;
 if p_action='start' then gross:=0; else
 gross:=greatest(0,floor(extract(epoch from least(now(),coalesce(s.paused_at,now()),coalesce(s.lease_expires_at,s.started_at+interval '1 hour'))-s.started_at))::integer-s.paused_seconds);
 end if;
 if p_excluded_seconds is null or p_excluded_seconds<coalesce(st.excluded_seconds,0) or p_excluded_seconds>gross then problem:=coalesce(problem,'INVALID_EXCLUSION'); end if;
 pending:=greatest(0,coalesce(p_excluded_seconds,0)-coalesce(st.excluded_seconds,0));
 known:=actual_study_private.known_seconds(t.id,p_minute);
 if st.current_todo_id=t.id then known:=greatest(0,known-pending); end if;
 if p.target_seconds is not null then remaining:=greatest(0,p.target_seconds-known); end if;
 if problem is null and remaining>0 then
   a:=(t.local_date+t.start_time) at time zone z;
   b:=((t.local_date+case when t.end_time<=t.start_time then 1 else 0 end)+t.end_time) at time zone z;
   cursor_end:=p_minute+make_interval(secs=>remaining);
   if (a,b) is distinct from (p_minute,cursor_end) then
     changes:=changes||jsonb_build_array(jsonb_build_object('todo_id',t.id,'title',t.title,
       'before',actual_study_private.interval_json(a,b,z),'after',actual_study_private.interval_json(p_minute,cursor_end,z)));
   end if;
   for r in
     select d.*, (d.local_date+d.start_time)at time zone z a,
       ((d.local_date+case when d.end_time<=d.start_time then 1 else 0 end)+d.end_time)at time zone z b,
       pl.target_seconds
     from public.study_todos d left join public.study_todo_plans pl on pl.todo_id=d.id
     where d.user_id=u and not d.is_completed and d.id<>t.id and d.start_time is not null
     order by (d.local_date+d.start_time)at time zone z,d.id
   loop
     -- Intervals wholly before the proposed focus are historical and stay put.
     if r.b<=p_minute then continue; end if;
     if r.a>=cursor_end then exit; end if;
     known:=actual_study_private.known_seconds(r.id,p_minute);
     if st.current_todo_id=r.id then known:=greatest(0,known-pending); end if;
     duration:=case when r.target_seconds is null then extract(epoch from r.b-r.a)::integer
       else greatest(0,r.target_seconds-known) end;
     if duration=0 then continue; end if;
     scan_count:=scan_count+1;
     if scan_count>2000 then problem:='CASCADE_LIMIT';exit;end if;
     new_end:=cursor_end+make_interval(secs=>duration);
     changes:=changes||jsonb_build_array(jsonb_build_object('todo_id',r.id,'title',r.title,
       'before',actual_study_private.interval_json(r.a,r.b,z),'after',actual_study_private.interval_json(cursor_end,new_end,z)));
     cursor_end:=new_end;
   end loop;
 end if;
 -- The legacy planner stores one date and two clocks, not an end date.
 -- Reject any DST/long interval that cannot round-trip through those exact
 -- persisted fields; a complete preview must never silently lose a day.
 if problem is null and exists(
   select 1 from jsonb_array_elements(changes)c
   cross join lateral(select
     (c->'after'->>'local_date')::date d,
     (c->'after'->>'start_time')::time a,
     (c->'after'->>'end_time')::time b,
     (c->'after'->>'start_at')::timestamptz expected_start,
     (c->'after'->>'end_at')::timestamptz expected_end)x
   where x.a=x.b
     or ((x.d+x.a)at time zone z) is distinct from x.expected_start
     or (((x.d+case when x.b<=x.a then 1 else 0 end)+x.b)at time zone z) is distinct from x.expected_end
 ) then
   problem:='UNREPRESENTABLE_SCHEDULE';
   changes:='[]'::jsonb;
 end if;

 result:=jsonb_build_object('version',1,'action',p_action,'session_id',p_session_id,'todo_ids',ids,
   'current_todo_id',p_current_todo_id,'excluded_seconds',p_excluded_seconds,'proposed_at',p_minute,
   'expires_at',p_minute+interval '1 minute','time_zone',z,'remaining_seconds',remaining,
   'revision',actual_study_private.revision(u,p_session_id),'changes',changes,
   'cascade_complete',problem is distinct from 'CASCADE_LIMIT' and problem is distinct from 'UNREPRESENTABLE_SCHEDULE','blocking_error',problem);
 return result;
end $$;

create function public.preview_actual_study_action(p_action text,p_todo_ids uuid[],p_current_todo_id uuid,p_session_id uuid default null,p_excluded_seconds integer default 0)
returns jsonb language sql stable security definer set search_path='' as $$
 select actual_study_private.preview(p_action,p_todo_ids,p_current_todo_id,p_session_id,p_excluded_seconds,date_trunc('minute',now()))
$$;

create function public.confirm_actual_study_action(p_preview jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='3s' set statement_timeout='10s' as $$
declare
 u uuid:=auth.uid(); previous actual_study_private.requests%rowtype;
 s public.study_sessions%rowtype; st public.study_actual_sessions%rowtype; ids uuid[]; p jsonb; change jsonb;
 action text:=p_preview->>'action'; sid uuid:=(p_preview->>'session_id')::uuid; focus uuid:=(p_preview->>'current_todo_id')::uuid;
 minute_at timestamptz:=(p_preview->>'proposed_at')::timestamptz; response jsonb; counter integer:=(p_preview->>'excluded_seconds')::integer;
begin
 if u is null then raise exception 'Not authenticated'; end if;
 if p_request_id is null or p_preview is null then raise exception 'ACTUAL_STUDY_INVALID_REQUEST'; end if;
 -- Serialize retries for one user. Row locks protect legacy pause/end callers.
 perform pg_advisory_xact_lock(hashtextextended(u::text,91321));
 select * into previous from actual_study_private.requests where user_id=u and request_id=p_request_id;
 if found then
   if previous.preview<>p_preview then raise exception 'ACTUAL_STUDY_REQUEST_REUSED'; end if;
   return previous.response;
 end if;
 if sid is not null then perform 1 from public.study_sessions where id=sid and user_id=u for update; end if;
 -- Also exclude phantom inserts/deletes by clients using legacy table writes.
 lock table public.study_todos, public.study_session_todos in share row exclusive mode;
 perform 1 from public.profiles where user_id=u for share;
 if minute_at is null or minute_at<>date_trunc('minute',now()) then raise exception 'ACTUAL_STUDY_STALE_PREVIEW'; end if;
 select array_agg(x::uuid order by x::uuid) into ids from jsonb_array_elements_text(p_preview->'todo_ids')x;
 p:=actual_study_private.preview(action,ids,focus,sid,counter,minute_at);
 if p<>p_preview or p->>'blocking_error' is not null or (p->>'cascade_complete')::boolean is not true then
   raise exception 'ACTUAL_STUDY_STALE_PREVIEW';
 end if;
 if action='start' then
   s:=public.start_study_session(ids);
   sid:=s.id;
   insert into public.study_actual_sessions(session_id,user_id,unknown_allocation)values(sid,u,false);
 else
   perform public.checkpoint_actual_study_exclusion(sid,counter);
   perform actual_study_private.close_segment(sid,least(now(),coalesce((select lease_expires_at from public.study_sessions where id=sid),now())));
 end if;
 -- New selections join only after preview acceptance, inside the same transaction.
 -- Preserve historical links and never allocate the session's unknown past to them.
 insert into public.study_session_todos(session_id,todo_id,user_id)
 select sid,x,u from unnest(ids)x on conflict(session_id,todo_id) do nothing;
 -- Set focus before legacy resume trigger opens the resumed interval.
 update public.study_actual_sessions set current_todo_id=focus where session_id=sid;
 if action='resume' then s:=public.resume_study_session(sid);
 else
   insert into public.study_todo_segments(user_id,session_id,todo_id,started_at)values(u,sid,focus,now());
   select * into s from public.study_sessions where id=sid;
 end if;
 for change in select value from jsonb_array_elements(p->'changes') loop
   update public.study_todos set local_date=(change->'after'->>'local_date')::date,
     start_time=(change->'after'->>'start_time')::time,end_time=(change->'after'->>'end_time')::time,
     coach_start_at=case when coach_start_at is null then null else (change->'after'->>'start_at')::timestamptz end,
     coach_end_at=case when coach_end_at is null then null else (change->'after'->>'end_at')::timestamptz end
   where id=(change->>'todo_id')::uuid and user_id=u;
   insert into public.study_schedule_adjustments(user_id,request_id,todo_id,before_interval,after_interval)
   values(u,p_request_id,(change->>'todo_id')::uuid,change->'before',change->'after');
 end loop;
 response:=jsonb_build_object('request_id',p_request_id,'session',to_jsonb(s),'preview',p,'tracking',public.get_actual_study_state(sid));
 insert into actual_study_private.requests(user_id,request_id,preview,response)values(u,p_request_id,p_preview,response);
 return response;
end $$;

create function public.get_actual_study_report(p_start_date date,p_end_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); result jsonb;
begin
 if u is null then raise exception 'Not authenticated'; end if;
 if p_start_date is null or p_end_date is null or p_end_date<p_start_date or p_end_date-p_start_date>370 then raise exception 'Invalid actual study report date range'; end if;
 with plans as (
 select t.id todo_id,t.title,p.original_start_at,
   (select min(started_at)from public.study_todo_segments where todo_id=t.id)first_started_at,
   (select count(*)from public.study_schedule_adjustments where todo_id=t.id)adjustment_count
 from public.study_todo_plans p join public.study_todos t on t.id=p.todo_id
 where p.user_id=u and p.evaluation_eligible and not actual_study_private.todo_unknown(t.id) and p.target_seconds is not null
 and p.original_local_date between p_start_date and p_end_date
 ), measured as (
 select *,case when first_started_at is not null then greatest(0,floor(extract(epoch from first_started_at-original_start_at)/60))::integer end delay_minutes,
   first_started_at is null and original_start_at<=now() is_unstarted,
   date_trunc('minute',first_started_at)<=date_trunc('minute',original_start_at) on_time
 from plans)
 select jsonb_build_object('scheduled_count',count(*),'started_count',count(first_started_at),
   'on_time_count',count(*)filter(where on_time),'on_time_ratio',count(*)filter(where on_time)::numeric/nullif(count(first_started_at),0),
   'adjustment_count',coalesce(sum(adjustment_count),0),'unstarted_count',count(*)filter(where is_unstarted),
   'plans',coalesce(jsonb_agg(to_jsonb(measured)-'on_time' order by original_start_at,todo_id),'[]'))
 into result from measured;
 return result;
end $$;

-- Helpers are never callable directly, including through RPC.
revoke all on all functions in schema actual_study_private from public,anon,authenticated;
revoke all on all tables in schema actual_study_private from public,anon,authenticated;
revoke all on function public.preview_actual_study_action(text,uuid[],uuid,uuid,integer) from public,anon;
revoke all on function public.confirm_actual_study_action(jsonb,uuid) from public,anon;
revoke all on function public.get_actual_study_state(uuid) from public,anon;
revoke all on function public.get_actual_study_report(date,date) from public,anon;
revoke all on function public.checkpoint_actual_study_exclusion(uuid,integer) from public,anon;
revoke all on function public.pause_actual_study_session(uuid,integer) from public,anon;
grant execute on function public.preview_actual_study_action(text,uuid[],uuid,uuid,integer) to authenticated;
grant execute on function public.confirm_actual_study_action(jsonb,uuid) to authenticated;
grant execute on function public.get_actual_study_state(uuid) to authenticated;
grant execute on function public.get_actual_study_report(date,date) to authenticated;
grant execute on function public.checkpoint_actual_study_exclusion(uuid,integer) to authenticated;
grant execute on function public.pause_actual_study_session(uuid,integer) to authenticated;

-- Same legacy signature and reflection/attendance behavior. A linked todo remains
-- completable after its adjusted schedule crosses the session's original date.
create or replace function public.complete_study_session(
 p_session_id uuid,p_excluded_seconds integer,p_completed_todo_ids uuid[],
 p_focus_score integer,p_energy_score integer,p_interruption_reason text default null,
 p_note text default null,p_next_action text default null
)
returns public.study_sessions language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); s public.study_sessions%rowtype; ended public.study_sessions%rowtype;
 ids uuid[]; valid_count integer;
begin
 if u is null then raise exception 'Not authenticated';end if;
 if p_focus_score not between 1 and 5 then raise exception 'Focus score must be between 1 and 5';end if;
 if p_energy_score not between 1 and 5 then raise exception 'Energy score must be between 1 and 5';end if;
 select * into s from public.study_sessions where id=p_session_id and user_id=u and status='active' for update;
 if not found then raise exception 'Active study session not found';end if;
 select coalesce(array_agg(distinct x),'{}'::uuid[])into ids from unnest(coalesce(p_completed_todo_ids,'{}'::uuid[]))x;
 if cardinality(ids)>0 then
   select count(*)::integer into valid_count from public.study_todos t
   where t.id=any(ids) and t.user_id=u and not t.is_completed
   and (t.local_date=s.local_date or exists(
     select 1 from public.study_session_todos l where l.session_id=s.id and l.todo_id=t.id and l.user_id=u));
   if valid_count<>cardinality(ids) then raise exception 'Completed todos must be owned, incomplete, and linked or scheduled for the session date';end if;
   update public.study_todos set is_completed=true where id=any(ids) and user_id=u;
   update public.study_session_todos set completed_during_session=true where session_id=s.id and user_id=u and todo_id=any(ids);
 end if;
 ended:=public.end_study_session(s.id,greatest(0,coalesce(p_excluded_seconds,0)));
 insert into public.study_session_reflections(user_id,session_id,focus_score,energy_score,interruption_reason,note,next_action,updated_at)
 values(u,s.id,p_focus_score,p_energy_score,nullif(btrim(coalesce(p_interruption_reason,'')),''),
   nullif(left(btrim(coalesce(p_note,'')),500),''),nullif(left(btrim(coalesce(p_next_action,'')),160),''),now())
 on conflict(session_id)do update set focus_score=excluded.focus_score,energy_score=excluded.energy_score,
   interruption_reason=excluded.interruption_reason,note=excluded.note,next_action=excluded.next_action,updated_at=now();
 return ended;
end $$;
revoke all on function public.complete_study_session(uuid,integer,uuid[],integer,integer,text,text,text) from public,anon;
grant execute on function public.complete_study_session(uuid,integer,uuid[],integer,integer,text,text,text) to authenticated;
