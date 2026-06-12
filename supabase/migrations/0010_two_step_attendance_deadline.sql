drop function if exists public.get_due_reminders(timestamptz);

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
          and ss.started_at >= d.reminder_at
          and ss.started_at < d.reminder_at + interval '30 minutes'
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
        and ss.started_at >= ad.reminder_at
        and ss.started_at < ad.deadline_at
    )
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
  v_reminder_at := public.local_reminder_at(v_local_date, v_profile.reminder_time, v_profile.time_zone);
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
