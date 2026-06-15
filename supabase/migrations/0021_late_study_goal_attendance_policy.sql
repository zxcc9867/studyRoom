-- late_study_goal_attendance_policy

alter table public.profiles
  alter column reminder_time set default time '20:30';

update public.profiles
set reminder_time = time '20:30'
where reminder_time = time '21:00';

create or replace function public.study_attendance_goal_seconds(p_local_date date)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when extract(isodow from p_local_date) in (6, 7) then 4 * 60 * 60
    else 2 * 60 * 60
  end;
$$;

grant execute on function public.study_attendance_goal_seconds(date) to authenticated, service_role;

create or replace function public.effective_reminder_time(p_local_date date, p_reminder_time time)
returns time
language sql
immutable
set search_path = public
as $$
  select case
    when extract(isodow from p_local_date) in (6, 7) then time '14:00'
    else coalesce(p_reminder_time, time '20:30')
  end;
$$;

grant execute on function public.effective_reminder_time(date, time) to authenticated, service_role;

create or replace function public.daily_completed_study_seconds(
  p_user_id uuid,
  p_local_date date
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(duration_seconds), 0)::integer
  from public.study_sessions
  where user_id = p_user_id
    and local_date = p_local_date
    and status = 'completed';
$$;

revoke all on function public.daily_completed_study_seconds(uuid, date) from public;
grant execute on function public.daily_completed_study_seconds(uuid, date) to service_role;

create or replace function public.promote_attendance_by_daily_study_total(
  p_user_id uuid,
  p_local_date date,
  p_now timestamptz default now(),
  p_qualifying_session_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
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

  v_reminder_at := public.local_reminder_at(
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
$$;

revoke all on function public.promote_attendance_by_daily_study_total(uuid, date, timestamptz, uuid) from public;
grant execute on function public.promote_attendance_by_daily_study_total(uuid, date, timestamptz, uuid) to service_role;

create or replace function public.get_due_reminders(p_now timestamptz default now())
returns table (
  user_id uuid,
  email text,
  time_zone text,
  local_date date,
  reminder_at timestamptz,
  deadline_at timestamptz,
  reminder_stage text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  with due as (
    select
      p.user_id,
      p.email,
      p.time_zone,
      (p_now at time zone p.time_zone)::date as local_date,
      public.local_reminder_at(
        (p_now at time zone p.time_zone)::date,
        public.effective_reminder_time((p_now at time zone p.time_zone)::date, p.reminder_time),
        p.time_zone
      ) as reminder_at
    from public.profiles p
  ),
  qualified as (
    select
      d.user_id,
      d.local_date,
      d.reminder_at,
      d.reminder_at + interval '30 minutes' as deadline_at,
      ss.id as session_id
    from due d
    join lateral (
      select study_sessions.id
      from public.study_sessions
      where study_sessions.user_id = d.user_id
        and study_sessions.local_date = d.local_date
        and study_sessions.started_at <= d.reminder_at
        and coalesce(study_sessions.ended_at, p_now) >= d.reminder_at
      order by study_sessions.started_at
      limit 1
    ) ss on true
    where p_now >= d.reminder_at
      and p_now < d.reminder_at + interval '1 minute'
  ),
  goal_qualified as (
    select
      d.user_id,
      d.local_date,
      d.reminder_at,
      d.reminder_at + interval '30 minutes' as deadline_at
    from due d
    where p_now >= d.reminder_at
      and p_now < d.reminder_at + interval '1 minute'
      and public.daily_completed_study_seconds(d.user_id, d.local_date) >= public.study_attendance_goal_seconds(d.local_date)
  ),
  present_candidates as (
    select
      qualified.user_id,
      qualified.local_date,
      qualified.reminder_at,
      qualified.deadline_at,
      qualified.session_id
    from qualified
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
  select distinct on (present_candidates.user_id, present_candidates.local_date)
    present_candidates.user_id,
    present_candidates.local_date,
    'present',
    present_candidates.reminder_at,
    present_candidates.deadline_at,
    present_candidates.session_id,
    p_now
  from present_candidates
  order by present_candidates.user_id, present_candidates.local_date, present_candidates.session_id nulls last
  on conflict on constraint attendance_days_pkey do update
    set status = 'present',
        reminder_at = excluded.reminder_at,
        deadline_at = excluded.deadline_at,
        qualifying_session_id = coalesce(excluded.qualifying_session_id, public.attendance_days.qualifying_session_id),
        marked_at = excluded.marked_at
    where public.attendance_days.status is distinct from 'missed';

  return query
  with due as (
    select
      p.user_id,
      p.email,
      p.time_zone,
      (p_now at time zone p.time_zone)::date as local_date,
      public.local_reminder_at(
        (p_now at time zone p.time_zone)::date,
        public.effective_reminder_time((p_now at time zone p.time_zone)::date, p.reminder_time),
        p.time_zone
      ) as reminder_at
    from public.profiles p
  ),
  initial_due as (
    select
      d.user_id,
      d.email,
      d.time_zone,
      d.local_date,
      d.reminder_at,
      d.reminder_at + interval '30 minutes' as deadline_at,
      'initial'::text as reminder_stage
    from due d
    where p_now >= d.reminder_at
      and p_now < d.reminder_at + interval '1 minute'
      and not exists (
        select 1
        from public.attendance_days ad
        where ad.user_id = d.user_id
          and ad.local_date = d.local_date
          and ad.status in ('present', 'missed')
      )
      and not exists (
        select 1
        from public.study_sessions ss
        where ss.user_id = d.user_id
          and ss.local_date = d.local_date
          and ss.started_at <= d.reminder_at
          and coalesce(ss.ended_at, p_now) >= d.reminder_at
      )
      and public.daily_completed_study_seconds(d.user_id, d.local_date) < public.study_attendance_goal_seconds(d.local_date)
  ),
  nudge_due as (
    select
      d.user_id,
      d.email,
      d.time_zone,
      d.local_date,
      d.reminder_at,
      d.reminder_at + interval '30 minutes' as deadline_at,
      'nudge'::text as reminder_stage
    from due d
    join public.attendance_days ad
      on ad.user_id = d.user_id
     and ad.local_date = d.local_date
    where p_now >= d.reminder_at + interval '15 minutes'
      and p_now < d.reminder_at + interval '16 minutes'
      and ad.status = 'pending'
      and not exists (
        select 1
        from public.study_sessions ss
        where ss.user_id = d.user_id
          and ss.local_date = d.local_date
          and (
            (ss.started_at >= d.reminder_at and ss.started_at < d.reminder_at + interval '30 minutes')
            or (ss.started_at <= d.reminder_at and coalesce(ss.ended_at, p_now) >= d.reminder_at)
          )
      )
      and public.daily_completed_study_seconds(d.user_id, d.local_date) < public.study_attendance_goal_seconds(d.local_date)
  ),
  due_now as (
    select * from initial_due
    union all
    select * from nudge_due
  ),
  upserted as (
    insert into public.attendance_days (user_id, local_date, status, reminder_at, deadline_at, marked_at)
    select dn.user_id, dn.local_date, 'pending', dn.reminder_at, dn.deadline_at, p_now
    from due_now dn
    on conflict on constraint attendance_days_pkey do update
      set reminder_at = excluded.reminder_at,
          deadline_at = excluded.deadline_at,
          marked_at = excluded.marked_at
    returning attendance_days.user_id,
              attendance_days.local_date,
              attendance_days.reminder_at,
              attendance_days.deadline_at
  )
  select upserted.user_id,
         (select profiles.email from public.profiles where profiles.user_id = upserted.user_id),
         (select profiles.time_zone from public.profiles where profiles.user_id = upserted.user_id),
         upserted.local_date,
         upserted.reminder_at,
         upserted.deadline_at,
         dn.reminder_stage
  from upserted
  join due_now dn
    on dn.user_id = upserted.user_id
   and dn.local_date = upserted.local_date;
end;
$$;

grant execute on function public.get_due_reminders(timestamptz) to service_role;

create or replace function public.mark_missed_attendance(p_now timestamptz default now())
returns table (
  user_id uuid,
  local_date date,
  reminder_at timestamptz,
  deadline_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  with qualified as (
    select distinct on (ad.user_id, ad.local_date)
      ad.user_id,
      ad.local_date,
      ss.id as session_id
    from public.attendance_days ad
    join public.study_sessions ss
      on ss.user_id = ad.user_id
     and ss.local_date = ad.local_date
    where ad.status = 'pending'
      and p_now >= ad.deadline_at
      and (
        (ss.started_at >= ad.reminder_at and ss.started_at < ad.deadline_at)
        or (ss.started_at <= ad.reminder_at and coalesce(ss.ended_at, p_now) >= ad.reminder_at)
      )
    order by ad.user_id, ad.local_date, ss.started_at
  )
  update public.attendance_days ad
  set status = 'present',
      qualifying_session_id = qualified.session_id,
      marked_at = p_now
  from qualified
  where ad.user_id = qualified.user_id
    and ad.local_date = qualified.local_date
    and ad.status = 'pending';

  with goal_qualified as (
    select ad.user_id, ad.local_date
    from public.attendance_days ad
    where ad.status = 'pending'
      and p_now >= ad.deadline_at
      and public.daily_completed_study_seconds(ad.user_id, ad.local_date) >= public.study_attendance_goal_seconds(ad.local_date)
  )
  update public.attendance_days ad
  set status = 'present',
      marked_at = p_now
  from goal_qualified
  where ad.user_id = goal_qualified.user_id
    and ad.local_date = goal_qualified.local_date
    and ad.status = 'pending';

  return query
  update public.attendance_days ad
  set status = 'missed',
      marked_at = p_now
  where ad.status = 'pending'
    and p_now >= ad.deadline_at
    and not exists (
      select 1
      from public.study_sessions ss
      where ss.user_id = ad.user_id
        and ss.local_date = ad.local_date
        and (
          (ss.started_at >= ad.reminder_at and ss.started_at < ad.deadline_at)
          or (ss.started_at <= ad.reminder_at and coalesce(ss.ended_at, p_now) >= ad.reminder_at)
        )
    )
    and public.daily_completed_study_seconds(ad.user_id, ad.local_date) < public.study_attendance_goal_seconds(ad.local_date)
  returning ad.user_id, ad.local_date, ad.reminder_at, ad.deadline_at;
end;
$$;

grant execute on function public.mark_missed_attendance(timestamptz) to service_role;

create or replace function public.start_study_session()
returns public.study_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_local_date date;
  v_session public.study_sessions%rowtype;
  v_reminder_at timestamptz;
  v_deadline_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from public.profiles where user_id = v_user_id;

  if not found then
    insert into public.profiles (user_id)
    values (v_user_id)
    returning * into v_profile;
  end if;

  v_local_date := (now() at time zone v_profile.time_zone)::date;

  if exists (
    select 1
    from public.study_recovery_requests rr
    where rr.user_id = v_user_id
      and rr.status = 'pending'
      and (rr.trigger_type <> 'missed_attendance' or rr.local_date <> v_local_date)
  ) then
    raise exception 'Recovery routine required';
  end if;

  v_reminder_at := public.local_reminder_at(
    v_local_date,
    public.effective_reminder_time(v_local_date, v_profile.reminder_time),
    v_profile.time_zone
  );
  v_deadline_at := v_reminder_at + interval '30 minutes';

  insert into public.study_sessions (user_id, local_date)
  values (v_user_id, v_local_date)
  returning * into v_session;

  if now() >= v_reminder_at and now() < v_deadline_at then
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
      v_user_id,
      v_local_date,
      'present',
      v_reminder_at,
      v_deadline_at,
      v_session.id,
      now()
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
$$;

grant execute on function public.start_study_session() to authenticated;

drop function if exists public.end_study_session(uuid);

create or replace function public.end_study_session(
  p_session_id uuid,
  p_excluded_seconds integer default 0
)
returns public.study_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.study_sessions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.study_sessions
  set ended_at = now(),
      duration_seconds = greatest(
        0,
        floor(extract(epoch from (now() - started_at)))::integer - greatest(0, p_excluded_seconds)
      ),
      status = 'completed'
  where id = p_session_id
    and user_id = v_user_id
    and status = 'active'
  returning * into v_session;

  if not found then
    raise exception 'Active study session not found';
  end if;

  perform public.promote_attendance_by_daily_study_total(
    v_user_id,
    v_session.local_date,
    now(),
    v_session.id
  );

  return v_session;
end;
$$;

grant execute on function public.end_study_session(uuid, integer) to authenticated;
