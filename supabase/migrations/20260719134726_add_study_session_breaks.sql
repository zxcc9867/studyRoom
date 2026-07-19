alter table public.study_sessions
  add column if not exists paused_at timestamptz,
  add column if not exists paused_seconds integer not null default 0;

alter table public.study_sessions
  drop constraint if exists study_sessions_paused_seconds_check;

alter table public.study_sessions
  add constraint study_sessions_paused_seconds_check
  check (paused_seconds >= 0);

alter table public.study_sessions
  drop constraint if exists study_sessions_pause_state_check;

alter table public.study_sessions
  add constraint study_sessions_pause_state_check
  check (status = 'active' or paused_at is null);

comment on column public.study_sessions.paused_at is
  'Start timestamp of the current explicit user break. The session remains active while paused.';

comment on column public.study_sessions.paused_seconds is
  'Whole seconds accumulated from completed explicit user breaks.';

create or replace function public.pause_study_session(p_session_id uuid)
returns public.study_sessions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_session public.study_sessions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.study_sessions
  set paused_at = coalesce(paused_at, now()),
      updated_at = now()
  where id = p_session_id
    and user_id = v_user_id
    and status = 'active'
  returning * into v_session;

  if not found then
    raise exception 'Active study session not found';
  end if;

  return v_session;
end;
$$;

comment on function public.pause_study_session(uuid) is
  'Pauses the authenticated user active session without changing its active status or lease.';

create or replace function public.resume_study_session(p_session_id uuid)
returns public.study_sessions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_session public.study_sessions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.study_sessions
  set paused_seconds = paused_seconds
        + case
            when paused_at is null then 0
            else greatest(0, floor(extract(epoch from (now() - paused_at)))::integer)
          end,
      paused_at = null,
      updated_at = now()
  where id = p_session_id
    and user_id = v_user_id
    and status = 'active'
  returning * into v_session;

  if not found then
    raise exception 'Active study session not found';
  end if;

  return v_session;
end;
$$;

comment on function public.resume_study_session(uuid) is
  'Resumes the authenticated user active session and atomically accumulates the current break.';

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
  v_ended_at timestamptz := now();
  v_total_paused_seconds integer := 0;
  v_time_zone text;
  v_local_date date;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into v_session
  from public.study_sessions
  where id = p_session_id
    and user_id = v_user_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'Active study session not found';
  end if;

  v_total_paused_seconds := greatest(0, coalesce(v_session.paused_seconds, 0))
    + case
        when v_session.paused_at is null then 0
        else greatest(0, floor(extract(epoch from (v_ended_at - v_session.paused_at)))::integer)
      end;

  update public.study_sessions
  set ended_at = v_ended_at,
      duration_seconds = greatest(
        0,
        floor(extract(epoch from (v_ended_at - started_at)))::integer
          - greatest(0, coalesce(p_excluded_seconds, 0))
          - v_total_paused_seconds
      ),
      paused_at = null,
      paused_seconds = v_total_paused_seconds,
      status = 'completed'
  where id = v_session.id
    and user_id = v_user_id
    and status = 'active'
  returning * into v_session;

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
      v_ended_at,
      v_session.id
    );
  end loop;

  return v_session;
end;
$$;

revoke all on function public.pause_study_session(uuid) from public, anon;
revoke all on function public.resume_study_session(uuid) from public, anon;
revoke all on function public.end_study_session(uuid, integer) from public, anon;

grant execute on function public.pause_study_session(uuid) to authenticated, service_role;
grant execute on function public.resume_study_session(uuid) to authenticated, service_role;
grant execute on function public.end_study_session(uuid, integer) to authenticated;
