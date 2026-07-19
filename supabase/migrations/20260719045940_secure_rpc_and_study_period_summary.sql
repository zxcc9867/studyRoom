-- Keep internal attendance/notification helpers off the public Data API and
-- provide one authenticated, timezone-aware source of truth for study totals.

create or replace function public.daily_completed_study_seconds(
  p_user_id uuid,
  p_local_date date
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_time_zone text;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_total integer;
begin
  select profile.time_zone
    into v_time_zone
  from public.profiles profile
  where profile.user_id = p_user_id;

  v_time_zone := coalesce(v_time_zone, 'UTC');
  v_period_start := p_local_date::timestamp at time zone v_time_zone;
  v_period_end := (p_local_date + 1)::timestamp at time zone v_time_zone;

  select coalesce(round(sum(
    case
      when extract(epoch from (session_row.ended_at - session_row.started_at)) <= 0 then 0
      else extract(epoch from (
        least(session_row.ended_at, v_period_end)
        - greatest(session_row.started_at, v_period_start)
      )) * least(
        1,
        greatest(0, session_row.duration_seconds)::numeric
        / extract(epoch from (session_row.ended_at - session_row.started_at))
      )
    end
  )), 0)::integer
    into v_total
  from public.study_sessions session_row
  where session_row.user_id = p_user_id
    and session_row.status = 'completed'
    and session_row.ended_at is not null
    and session_row.started_at < v_period_end
    and session_row.ended_at > v_period_start;

  return v_total;
end;
$$;

comment on function public.daily_completed_study_seconds(uuid, date) is
  'Returns completed study seconds allocated to one local day. Cross-midnight sessions are split proportionally after excluded time.';

create or replace function public.get_study_period_summary(
  p_start_date date,
  p_end_date date
)
returns table(
  completed_seconds bigint,
  completed_session_count integer,
  anomaly_session_count integer,
  cross_date_session_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_time_zone text;
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Invalid study summary date range';
  end if;

  if p_end_date - p_start_date > 370 then
    raise exception 'Study summary date range cannot exceed 371 days';
  end if;

  select profile.time_zone
    into v_time_zone
  from public.profiles profile
  where profile.user_id = v_user_id;

  v_time_zone := coalesce(v_time_zone, 'UTC');
  v_period_start := p_start_date::timestamp at time zone v_time_zone;
  v_period_end := (p_end_date + 1)::timestamp at time zone v_time_zone;

  return query
  with period_sessions as (
    select
      session_row.id,
      session_row.started_at,
      session_row.ended_at,
      greatest(0, session_row.duration_seconds)::numeric as counted_seconds,
      extract(epoch from (session_row.ended_at - session_row.started_at))::numeric as elapsed_seconds,
      extract(epoch from (
        least(session_row.ended_at, v_period_end)
        - greatest(session_row.started_at, v_period_start)
      ))::numeric as overlap_seconds
    from public.study_sessions session_row
    where session_row.user_id = v_user_id
      and session_row.status = 'completed'
      and session_row.ended_at is not null
      and session_row.started_at < v_period_end
      and session_row.ended_at > v_period_start
  )
  select
    coalesce(round(sum(
      case
        when period_sessions.elapsed_seconds <= 0 then 0
        else period_sessions.overlap_seconds
          * least(1, period_sessions.counted_seconds / period_sessions.elapsed_seconds)
      end
    )), 0)::bigint as completed_seconds,
    count(*)::integer as completed_session_count,
    count(*) filter (where period_sessions.counted_seconds > 12 * 60 * 60)::integer as anomaly_session_count,
    count(*) filter (
      where (period_sessions.started_at at time zone v_time_zone)::date
        <> ((period_sessions.ended_at - interval '1 microsecond') at time zone v_time_zone)::date
    )::integer as cross_date_session_count
  from period_sessions;
end;
$$;

comment on function public.get_study_period_summary(date, date) is
  'Authenticated study summary for a local-date range. Includes data-quality counts without silently excluding long sessions.';

create or replace function public.end_study_session(
  p_session_id uuid,
  p_excluded_seconds integer default 0
)
returns public.study_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_session public.study_sessions%rowtype;
  v_time_zone text;
  v_local_date date;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.study_sessions
  set ended_at = now(),
      duration_seconds = greatest(
        0,
        floor(extract(epoch from (now() - started_at)))::integer
          - greatest(0, coalesce(p_excluded_seconds, 0))
      ),
      status = 'completed'
  where id = p_session_id
    and user_id = v_user_id
    and status = 'active'
  returning * into v_session;

  if not found then
    raise exception 'Active study session not found';
  end if;

  select profile.time_zone
    into v_time_zone
  from public.profiles profile
  where profile.user_id = v_user_id;

  v_time_zone := coalesce(v_time_zone, 'UTC');

  for v_local_date in
    select day_value::date
    from generate_series(
      (v_session.started_at at time zone v_time_zone)::date::timestamp,
      ((v_session.ended_at - interval '1 microsecond') at time zone v_time_zone)::date::timestamp,
      interval '1 day'
    ) as day_value
  loop
    perform public.promote_attendance_by_daily_study_total(
      v_user_id,
      v_local_date,
      now(),
      v_session.id
    );
  end loop;

  return v_session;
end;
$$;

-- Internal cron/trigger helpers. These functions either expose private
-- destinations or mutate attendance for every user, so only service_role may
-- call them directly.
revoke all on function public.daily_completed_study_seconds(uuid, date) from public, anon, authenticated;
grant execute on function public.daily_completed_study_seconds(uuid, date) to service_role;

revoke all on function public.get_due_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.get_due_reminders(timestamptz) to service_role;

revoke all on function public.mark_missed_attendance(timestamptz) from public, anon, authenticated;
grant execute on function public.mark_missed_attendance(timestamptz) to service_role;

revoke all on function public.get_due_session_lease_warnings(timestamptz) from public, anon, authenticated;
grant execute on function public.get_due_session_lease_warnings(timestamptz) to service_role;

revoke all on function public.get_due_todo_schedule_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.get_due_todo_schedule_reminders(timestamptz) to service_role;

revoke all on function public.promote_attendance_by_daily_study_total(uuid, date, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.promote_attendance_by_daily_study_total(uuid, date, timestamptz, uuid) to service_role;

revoke all on function public.clear_future_todo_schedule_deliveries(uuid[], timestamptz) from public, anon, authenticated;
grant execute on function public.clear_future_todo_schedule_deliveries(uuid[], timestamptz) to service_role;

revoke all on function public.clear_future_todo_schedule_deliveries_on_todo_change() from public, anon, authenticated;
grant execute on function public.clear_future_todo_schedule_deliveries_on_todo_change() to service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

-- User-facing RPCs keep only the roles that actually call them.
revoke all on function public.end_study_session(uuid, integer) from public, anon;
grant execute on function public.end_study_session(uuid, integer) to authenticated;

revoke all on function public.extend_todo_schedule(uuid, integer) from public, anon;
grant execute on function public.extend_todo_schedule(uuid, integer) to authenticated, service_role;

revoke all on function public.get_study_period_summary(date, date) from public, anon;
grant execute on function public.get_study_period_summary(date, date) to authenticated;
