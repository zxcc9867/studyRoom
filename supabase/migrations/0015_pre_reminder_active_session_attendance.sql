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
      public.local_reminder_at((p_now at time zone p.time_zone)::date, p.reminder_time, p.time_zone) as reminder_at
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
  select
    qualified.user_id,
    qualified.local_date,
    'present',
    qualified.reminder_at,
    qualified.deadline_at,
    qualified.session_id,
    p_now
  from qualified
  on conflict on constraint attendance_days_pkey do update
    set status = 'present',
        reminder_at = excluded.reminder_at,
        deadline_at = excluded.deadline_at,
        qualifying_session_id = excluded.qualifying_session_id,
        marked_at = excluded.marked_at
    where public.attendance_days.status is distinct from 'missed';

  return query
  with due as (
    select
      p.user_id,
      p.email,
      p.time_zone,
      (p_now at time zone p.time_zone)::date as local_date,
      public.local_reminder_at((p_now at time zone p.time_zone)::date, p.reminder_time, p.time_zone) as reminder_at
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
  returning ad.user_id, ad.local_date, ad.reminder_at, ad.deadline_at;
end;
$$;

grant execute on function public.mark_missed_attendance(timestamptz) to service_role;
