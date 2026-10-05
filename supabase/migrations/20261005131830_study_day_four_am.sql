-- Attendance uses a local 04:00 study day. Existing session dates remain immutable.
create or replace function public.study_day_at(p_at timestamptz, p_time_zone text)
returns date language sql stable strict set search_path = ''
as $$ select (p_at at time zone p_time_zone)::date
  - case when (p_at at time zone p_time_zone)::time < time '04:00' then 1 else 0 end; $$;
revoke all on function public.study_day_at(timestamptz,text) from public, anon;
grant execute on function public.study_day_at(timestamptz,text) to authenticated, service_role;

-- Calendar todo reminders keep using local_reminder_at unchanged.
create or replace function public.study_reminder_at(p_local_date date, p_reminder_time time, p_time_zone text)
returns timestamptz language sql stable set search_path = ''
as $$ select ((p_local_date + case when p_reminder_time < time '04:00' then 1 else 0 end) + p_reminder_time) at time zone p_time_zone; $$;
revoke all on function public.study_reminder_at(date,time,text) from public, anon;
grant execute on function public.study_reminder_at(date,time,text) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.start_study_session(p_todo_ids uuid[])
 RETURNS public.study_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_local_date date;
  v_session public.study_sessions%rowtype;
  v_reminder_at timestamptz;
  v_deadline_at timestamptz;
  v_todo_ids uuid[];
  v_valid_todo_count integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from public.profiles where user_id = v_user_id;
  if not found then
    insert into public.profiles (user_id) values (v_user_id) returning * into v_profile;
  end if;

  v_local_date := public.study_day_at(now(), v_profile.time_zone);

  if exists (
    select 1 from public.study_recovery_requests rr
    where rr.user_id = v_user_id and rr.status = 'pending'
  ) then
    raise exception 'Recovery routine required';
  end if;

  select coalesce(array_agg(distinct todo_id), '{}'::uuid[])
    into v_todo_ids
  from unnest(coalesce(p_todo_ids, '{}'::uuid[])) as selected(todo_id);

  if cardinality(v_todo_ids) = 0 then
    raise exception 'At least one current-day todo is required';
  end if;

  select count(*)::integer
    into v_valid_todo_count
  from public.study_todos todo
  where todo.id = any(v_todo_ids)
    and todo.user_id = v_user_id
    and todo.local_date in (v_local_date, (now() at time zone v_profile.time_zone)::date)
    and todo.is_completed = false;

  if v_valid_todo_count <> cardinality(v_todo_ids) then
    raise exception 'Session todos must be owned, incomplete, and scheduled for today';
  end if;

  v_reminder_at := public.study_reminder_at(
    v_local_date,
    public.effective_reminder_time(v_local_date, v_profile.reminder_time),
    v_profile.time_zone
  );
  v_deadline_at := v_reminder_at + interval '30 minutes';

  insert into public.study_sessions (user_id, local_date, lease_expires_at)
  values (v_user_id, v_local_date, now() + interval '1 hour')
  returning * into v_session;

  insert into public.study_session_todos (user_id, session_id, todo_id)
  select v_user_id, v_session.id, todo_id from unnest(v_todo_ids) as selected(todo_id);

  if now() >= v_reminder_at and now() < v_deadline_at then
    insert into public.attendance_days (
      user_id, local_date, status, reminder_at, deadline_at, qualifying_session_id, marked_at
    ) values (
      v_user_id, v_local_date, 'present', v_reminder_at, v_deadline_at, v_session.id, now()
    )
    on conflict (user_id, local_date) do update
      set status = 'present',
          reminder_at = excluded.reminder_at,
          deadline_at = excluded.deadline_at,
          qualifying_session_id = excluded.qualifying_session_id,
          marked_at = excluded.marked_at;
  end if;

  return v_session;
end;
$function$;

CREATE OR REPLACE FUNCTION actual_study_private.preview(p_action text, p_todo_ids uuid[], p_current_todo_id uuid, p_session_id uuid, p_excluded_seconds integer, p_minute timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
 and (case when p_action='start' then d.local_date in(public.study_day_at(now(), z),(now() at time zone z)::date)
   else d.local_date in(coalesce(s.local_date,public.study_day_at(now(), z)),public.study_day_at(now(), z),(now() at time zone z)::date) or exists(select 1 from public.study_session_todos l where l.session_id=s.id and l.todo_id=d.id and l.user_id=u)end);
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
end $function$;

-- Sum recognized time once on the persisted start day, never split at midnight.
create or replace function public.daily_completed_study_seconds(p_user_id uuid, p_local_date date)
returns integer language sql stable security definer set search_path = ''
as $$ select least(2147483647, coalesce(round(sum(
  least(greatest(0, s.duration_seconds)::numeric,
    greatest(0, extract(epoch from s.ended_at - s.started_at)))
)),0))::integer
from public.study_sessions s where s.user_id=p_user_id and s.local_date=p_local_date
  and s.status='completed' and s.ended_at is not null; $$;
revoke all on function public.daily_completed_study_seconds(uuid,date) from public, anon, authenticated;
grant execute on function public.daily_completed_study_seconds(uuid,date) to service_role;

create or replace function public.get_study_period_summary(p_start_date date, p_end_date date)
returns table(completed_seconds bigint, completed_session_count integer, anomaly_session_count integer, cross_date_session_count integer)
language plpgsql stable security definer set search_path = ''
as $$
declare u uuid := (select auth.uid()); z text;
begin
  if u is null then raise exception 'Not authenticated'; end if;
  if p_start_date is null or p_end_date is null or p_end_date<p_start_date then raise exception 'Invalid study summary date range'; end if;
  if p_end_date-p_start_date>370 then raise exception 'Study summary date range cannot exceed 371 days'; end if;
  select coalesce(time_zone,'UTC') into z from public.profiles where user_id=u;
  z:=coalesce(z,'UTC');
  return query select
    coalesce(round(sum(least(greatest(0,s.duration_seconds)::numeric,
      greatest(0,extract(epoch from s.ended_at-s.started_at))))),0)::bigint,
    count(*)::integer,
    count(*) filter(where s.duration_seconds>12*60*60)::integer,
    count(*) filter(where (s.started_at at time zone z)::date<>
      ((s.ended_at-interval '1 microsecond')at time zone z)::date)::integer
  from public.study_sessions s where s.user_id=u and s.status='completed' and s.ended_at is not null
    and s.local_date between p_start_date and p_end_date;
end; $$;
revoke all on function public.get_study_period_summary(date,date) from public, anon;
grant execute on function public.get_study_period_summary(date,date) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_due_reminders(p_now timestamp with time zone DEFAULT now())
 RETURNS TABLE(user_id uuid, email text, time_zone text, local_date date, reminder_at timestamp with time zone, deadline_at timestamp with time zone, reminder_stage text, attendance_already_present boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- Attendance qualification is independent from reminder delivery. A user who
  -- has already qualified stays present, but still receives the configured-time reminder.
  with due as (
    select
      profile.user_id,
      candidate.local_date,
      public.study_reminder_at(
        candidate.local_date,
        public.effective_reminder_time(
          candidate.local_date,
          profile.reminder_time
        ),
        profile.time_zone
      ) as reminder_at
    from public.profiles profile
    cross join lateral (values
      (public.study_day_at(p_now,profile.time_zone)),
      (public.study_day_at(p_now,profile.time_zone)-1)
    ) candidate(local_date)
  ),
  session_qualified as (
    select
      due_row.user_id,
      due_row.local_date,
      due_row.reminder_at,
      due_row.reminder_at + interval '30 minutes' as deadline_at,
      session_row.id as session_id
    from due due_row
    join lateral (
      select study_session.id
      from public.study_sessions study_session
      where study_session.user_id = due_row.user_id
        and study_session.local_date = due_row.local_date
        and study_session.started_at <= due_row.reminder_at
        and coalesce(study_session.ended_at, p_now) >= due_row.reminder_at
      order by study_session.started_at
      limit 1
    ) session_row on true
    where p_now >= due_row.reminder_at
      and p_now < due_row.reminder_at + interval '1 minute'
  ),
  goal_qualified as (
    select
      due_row.user_id,
      due_row.local_date,
      due_row.reminder_at,
      due_row.reminder_at + interval '30 minutes' as deadline_at
    from due due_row
    where p_now >= due_row.reminder_at
      and p_now < due_row.reminder_at + interval '1 minute'
      and public.daily_completed_study_seconds(due_row.user_id, due_row.local_date)
        >= public.study_attendance_goal_seconds(due_row.local_date)
  ),
  present_candidates as (
    select
      session_qualified.user_id,
      session_qualified.local_date,
      session_qualified.reminder_at,
      session_qualified.deadline_at,
      session_qualified.session_id
    from session_qualified
    union all
    select
      goal_qualified.user_id,
      goal_qualified.local_date,
      goal_qualified.reminder_at,
      goal_qualified.deadline_at,
      null::uuid as session_id
    from goal_qualified
  )
  insert into public.attendance_days (
    user_id,
    local_date,
    status,
    reminder_at,
    deadline_at,
    qualifying_session_id,
    marked_at
  )
  select distinct on (candidate.user_id, candidate.local_date)
    candidate.user_id,
    candidate.local_date,
    'present',
    candidate.reminder_at,
    candidate.deadline_at,
    candidate.session_id,
    p_now
  from present_candidates candidate
  order by candidate.user_id, candidate.local_date, candidate.session_id nulls last
  on conflict on constraint attendance_days_pkey do update
    set status = 'present',
        reminder_at = excluded.reminder_at,
        deadline_at = excluded.deadline_at,
        qualifying_session_id = coalesce(
          excluded.qualifying_session_id,
          public.attendance_days.qualifying_session_id
        ),
        marked_at = excluded.marked_at
    where public.attendance_days.status is distinct from 'missed';

  return query
  with due as (
    select
      profile.user_id,
      profile.email,
      profile.time_zone,
      candidate.local_date,
      public.study_reminder_at(
        candidate.local_date,
        public.effective_reminder_time(
          candidate.local_date,
          profile.reminder_time
        ),
        profile.time_zone
      ) as reminder_at
    from public.profiles profile
    cross join lateral (values
      (public.study_day_at(p_now,profile.time_zone)),
      (public.study_day_at(p_now,profile.time_zone)-1)
    ) candidate(local_date)
  ),
  initial_claimed as (
    insert into public.attendance_days (
      user_id,
      local_date,
      status,
      reminder_at,
      deadline_at,
      marked_at,
      initial_reminder_claimed_at
    )
    select
      due_row.user_id,
      due_row.local_date,
      'pending',
      due_row.reminder_at,
      due_row.reminder_at + interval '30 minutes',
      p_now,
      p_now
    from due due_row
    where p_now >= due_row.reminder_at
      and p_now < due_row.reminder_at + interval '1 minute'
    on conflict on constraint attendance_days_pkey do update
      set reminder_at = excluded.reminder_at,
          deadline_at = excluded.deadline_at,
          initial_reminder_claimed_at = excluded.initial_reminder_claimed_at
      where public.attendance_days.status is distinct from 'missed'
        and public.attendance_days.initial_reminder_claimed_at is null
    returning
      public.attendance_days.user_id,
      public.attendance_days.local_date,
      public.attendance_days.reminder_at,
      public.attendance_days.deadline_at,
      public.attendance_days.status
  ),
  nudge_claimed as (
    update public.attendance_days ad
    set nudge_reminder_claimed_at = p_now
    from due due_row
    where ad.user_id = due_row.user_id
      and ad.local_date = due_row.local_date
      and p_now >= due_row.reminder_at + interval '15 minutes'
      and p_now < due_row.reminder_at + interval '16 minutes'
      and ad.status = 'pending'
      and ad.nudge_reminder_claimed_at is null
      and not exists (
        select 1
        from public.study_sessions session_row
        where session_row.user_id = due_row.user_id
          and session_row.local_date = due_row.local_date
          and (
            (
              session_row.started_at >= due_row.reminder_at
              and session_row.started_at < due_row.reminder_at + interval '30 minutes'
            )
            or (
              session_row.started_at <= due_row.reminder_at
              and coalesce(session_row.ended_at, p_now) >= due_row.reminder_at
            )
          )
      )
      and public.daily_completed_study_seconds(due_row.user_id, due_row.local_date)
        < public.study_attendance_goal_seconds(due_row.local_date)
    returning
      ad.user_id,
      ad.local_date,
      ad.reminder_at,
      ad.deadline_at,
      ad.status
  ),
  claimed as (
    select
      initial_claimed.user_id,
      initial_claimed.local_date,
      initial_claimed.reminder_at,
      initial_claimed.deadline_at,
      'initial'::text as reminder_stage,
      (initial_claimed.status = 'present') as attendance_already_present
    from initial_claimed
    union all
    select
      nudge_claimed.user_id,
      nudge_claimed.local_date,
      nudge_claimed.reminder_at,
      nudge_claimed.deadline_at,
      'nudge'::text as reminder_stage,
      false as attendance_already_present
    from nudge_claimed
  )
  select
    claimed.user_id,
    due.email,
    due.time_zone,
    claimed.local_date,
    claimed.reminder_at,
    claimed.deadline_at,
    claimed.reminder_stage,
    claimed.attendance_already_present
  from claimed
  join due
    on due.user_id = claimed.user_id
   and due.local_date = claimed.local_date;
end;
$function$;

CREATE OR REPLACE FUNCTION public.promote_attendance_by_daily_study_total(p_user_id uuid, p_local_date date, p_now timestamp with time zone DEFAULT now(), p_qualifying_session_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_profile public.profiles%rowtype;
  v_reminder_at timestamptz;
  v_deadline_at timestamptz;
  v_total_seconds integer;
begin
  select * into v_profile
  from public.profiles
  where user_id = p_user_id;

  if not found then
    return false;
  end if;

  v_total_seconds := public.daily_completed_study_seconds(p_user_id, p_local_date);

  if v_total_seconds < public.study_attendance_goal_seconds(p_local_date) then
    return false;
  end if;

  v_reminder_at := public.study_reminder_at(
    p_local_date,
    public.effective_reminder_time(p_local_date, v_profile.reminder_time),
    v_profile.time_zone
  );
  v_deadline_at := v_reminder_at + interval '30 minutes';

  insert into public.attendance_days (
    user_id,
    local_date,
    status,
    reminder_at,
    deadline_at,
    qualifying_session_id,
    marked_at
  )
  values (
    p_user_id,
    p_local_date,
    'present',
    v_reminder_at,
    v_deadline_at,
    p_qualifying_session_id,
    p_now
  )
  on conflict on constraint attendance_days_pkey do update
    set status = 'present',
        reminder_at = excluded.reminder_at,
        deadline_at = excluded.deadline_at,
        qualifying_session_id = coalesce(excluded.qualifying_session_id, public.attendance_days.qualifying_session_id),
        marked_at = excluded.marked_at;

  update public.study_recovery_requests
  set status = 'submitted',
      reason = coalesce(reason, 'Daily study goal completed after missed attendance.'),
      submitted_at = coalesce(submitted_at, p_now),
      followup_sent_at = coalesce(followup_sent_at, p_now)
  where user_id = p_user_id
    and local_date = p_local_date
    and trigger_type = 'missed_attendance'
    and status = 'pending';

  return true;
end;
$function$;

notify pgrst, 'reload schema';
revoke all on function public.get_due_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.get_due_reminders(timestamptz) to service_role;
revoke all on function public.promote_attendance_by_daily_study_total(uuid,date,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.promote_attendance_by_daily_study_total(uuid,date,timestamptz,uuid) to service_role;
