-- Send the configured-time reminder even when attendance is already complete.
-- Reminder claims are stored on the attendance row so the minute cron remains idempotent.

alter table public.attendance_days
  add column if not exists initial_reminder_claimed_at timestamptz,
  add column if not exists nudge_reminder_claimed_at timestamptz;

comment on column public.attendance_days.initial_reminder_claimed_at is
  'The instant the configured-time attendance reminder was claimed for dispatch.';

comment on column public.attendance_days.nudge_reminder_claimed_at is
  'The instant the 15-minute attendance nudge was claimed for dispatch.';

drop function if exists public.get_due_reminders(timestamptz);

create or replace function public.get_due_reminders(p_now timestamptz default now())
returns table (
  user_id uuid,
  email text,
  time_zone text,
  local_date date,
  reminder_at timestamptz,
  deadline_at timestamptz,
  reminder_stage text,
  attendance_already_present boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Attendance qualification is independent from reminder delivery. A user who
  -- has already qualified stays present, but still receives the configured-time reminder.
  with due as (
    select
      profile.user_id,
      (p_now at time zone profile.time_zone)::date as local_date,
      public.local_reminder_at(
        (p_now at time zone profile.time_zone)::date,
        public.effective_reminder_time(
          (p_now at time zone profile.time_zone)::date,
          profile.reminder_time
        ),
        profile.time_zone
      ) as reminder_at
    from public.profiles profile
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
      (p_now at time zone profile.time_zone)::date as local_date,
      public.local_reminder_at(
        (p_now at time zone profile.time_zone)::date,
        public.effective_reminder_time(
          (p_now at time zone profile.time_zone)::date,
          profile.reminder_time
        ),
        profile.time_zone
      ) as reminder_at
    from public.profiles profile
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
$$;

comment on function public.get_due_reminders(timestamptz) is
  'Atomically claims initial and nudge reminders. Initial reminders include already-present attendance; nudges remain pending-only.';

create or replace function public.mark_missed_attendance(p_now timestamptz default now())
returns table (
  user_id uuid,
  local_date date,
  reminder_at timestamptz,
  deadline_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  with session_qualified as (
    select distinct on (attendance.user_id, attendance.local_date)
      attendance.user_id,
      attendance.local_date,
      session_row.id as session_id
    from public.attendance_days attendance
    join public.study_sessions session_row
      on session_row.user_id = attendance.user_id
     and session_row.local_date = attendance.local_date
    where attendance.status = 'pending'
      and p_now >= attendance.deadline_at
      and (
        (
          session_row.started_at >= attendance.reminder_at
          and session_row.started_at < attendance.deadline_at
        )
        or (
          session_row.started_at <= attendance.reminder_at
          and coalesce(session_row.ended_at, p_now) >= attendance.reminder_at
        )
      )
    order by attendance.user_id, attendance.local_date, session_row.started_at
  )
  update public.attendance_days attendance
  set status = 'present',
      qualifying_session_id = session_qualified.session_id,
      marked_at = p_now
  from session_qualified
  where attendance.user_id = session_qualified.user_id
    and attendance.local_date = session_qualified.local_date
    and attendance.status = 'pending';

  with goal_qualified as (
    select attendance.user_id, attendance.local_date
    from public.attendance_days attendance
    where attendance.status = 'pending'
      and p_now >= attendance.deadline_at
      and public.daily_completed_study_seconds(attendance.user_id, attendance.local_date)
        >= public.study_attendance_goal_seconds(attendance.local_date)
  )
  update public.attendance_days attendance
  set status = 'present',
      marked_at = p_now
  from goal_qualified
  where attendance.user_id = goal_qualified.user_id
    and attendance.local_date = goal_qualified.local_date
    and attendance.status = 'pending';

  return query
  update public.attendance_days ad
  set status = 'missed',
      marked_at = p_now
  where ad.status = 'pending'
    and p_now >= ad.deadline_at
    and not exists (
      select 1
      from public.study_sessions session_row
      where session_row.user_id = ad.user_id
        and session_row.local_date = ad.local_date
        and (
          (
            session_row.started_at >= ad.reminder_at
            and session_row.started_at < ad.deadline_at
          )
          or (
            session_row.started_at <= ad.reminder_at
            and coalesce(session_row.ended_at, p_now) >= ad.reminder_at
          )
        )
    )
    and public.daily_completed_study_seconds(ad.user_id, ad.local_date)
      < public.study_attendance_goal_seconds(ad.local_date)
  returning ad.user_id, ad.local_date, ad.reminder_at, ad.deadline_at;
end;
$$;

comment on function public.mark_missed_attendance(timestamptz) is
  'Marks only pending attendance as missed after the deadline; present attendance is never downgraded.';

revoke all on function public.get_due_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.get_due_reminders(timestamptz) to service_role;

revoke all on function public.mark_missed_attendance(timestamptz) from public, anon, authenticated;
grant execute on function public.mark_missed_attendance(timestamptz) to service_role;
