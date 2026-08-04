-- Server-owned lease enforcement prevents a closed browser from persisting unbounded study time.
create index if not exists study_sessions_active_lease_expiry_idx
  on public.study_sessions (lease_expires_at)
  where status = 'active' and lease_expires_at is not null;

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
  v_ended_at timestamptz;
  v_elapsed_seconds integer := 0;
  v_effective_excluded_seconds integer := 0;
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

  v_ended_at := least(
    now(),
    coalesce(v_session.lease_expires_at, v_session.started_at + interval '1 hour')
  );
  v_elapsed_seconds := greatest(
    0,
    floor(extract(epoch from (v_ended_at - v_session.started_at)))::integer
  );
  v_effective_excluded_seconds := least(
    v_elapsed_seconds,
    greatest(0, coalesce(p_excluded_seconds, 0))
  );
  v_total_paused_seconds := greatest(0, coalesce(v_session.paused_seconds, 0))
    + case
        when v_session.paused_at is null then 0
        else greatest(0, floor(extract(epoch from (v_ended_at - v_session.paused_at)))::integer)
      end;

  update public.study_sessions
  set ended_at = v_ended_at,
      duration_seconds = greatest(
        0,
        v_elapsed_seconds - v_effective_excluded_seconds - v_total_paused_seconds
      ),
      paused_at = null,
      paused_seconds = v_total_paused_seconds,
      status = 'completed',
      updated_at = now()
  where id = v_session.id
    and user_id = v_user_id
    and status = 'active'
  returning * into v_session;

  select profile.time_zone
    into v_time_zone
  from public.profiles profile
  where profile.user_id = v_user_id;

  v_time_zone := coalesce(v_time_zone, 'UTC');

  if v_session.ended_at > v_session.started_at then
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
  end if;

  return v_session;
end;
$$;

comment on function public.end_study_session(uuid, integer) is
  'Ends the authenticated active session no later than its server-owned lease expiry and excludes paused or camera-absent time.';

create or replace function public.close_expired_study_sessions(
  p_now timestamptz default now()
)
returns table (
  session_id uuid,
  user_id uuid,
  ended_at timestamptz,
  duration_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_row public.study_sessions%rowtype;
  v_ended_at timestamptz;
  v_total_paused_seconds integer;
  v_time_zone text;
  v_local_date date;
  v_now timestamptz := coalesce(p_now, now());
begin
  for expired_row in
    select session_row.*
    from public.study_sessions session_row
    where session_row.status = 'active'
      and coalesce(session_row.lease_expires_at, session_row.started_at + interval '1 hour') <= v_now
    order by coalesce(session_row.lease_expires_at, session_row.started_at + interval '1 hour'), session_row.id
    limit 100
    for update skip locked
  loop
    v_ended_at := least(
      v_now,
      coalesce(expired_row.lease_expires_at, expired_row.started_at + interval '1 hour')
    );
    v_total_paused_seconds := greatest(0, coalesce(expired_row.paused_seconds, 0))
      + case
          when expired_row.paused_at is null then 0
          else greatest(0, floor(extract(epoch from (v_ended_at - expired_row.paused_at)))::integer)
        end;

    update public.study_sessions session_row
    set ended_at = v_ended_at,
        duration_seconds = greatest(
          0,
          floor(extract(epoch from (v_ended_at - session_row.started_at)))::integer
            - v_total_paused_seconds
        ),
        paused_at = null,
        paused_seconds = v_total_paused_seconds,
        status = 'completed',
        updated_at = v_now
    where session_row.id = expired_row.id
      and session_row.status = 'active'
    returning * into expired_row;

    if not found then
      continue;
    end if;

    select profile.time_zone
      into v_time_zone
    from public.profiles profile
    where profile.user_id = expired_row.user_id;

    v_time_zone := coalesce(v_time_zone, 'UTC');

    if expired_row.ended_at > expired_row.started_at then
      for v_local_date in
        select day_value::date
        from generate_series(
          (expired_row.started_at at time zone v_time_zone)::date::timestamp,
          ((expired_row.ended_at - interval '1 microsecond') at time zone v_time_zone)::date::timestamp,
          interval '1 day'
        ) as day_value
      loop
        perform public.promote_attendance_by_daily_study_total(
          expired_row.user_id,
          v_local_date,
          v_ended_at,
          expired_row.id
        );
      end loop;
    end if;

    return query
    select expired_row.id, expired_row.user_id, expired_row.ended_at, expired_row.duration_seconds;
  end loop;
end;
$$;

comment on function public.close_expired_study_sessions(timestamptz) is
  'Service-role batch cleanup for active sessions whose server lease has expired. Locks rows with SKIP LOCKED and ends each at its lease deadline.';

revoke all on function public.end_study_session(uuid, integer) from public, anon;
grant execute on function public.end_study_session(uuid, integer) to authenticated;

revoke all on function public.close_expired_study_sessions(timestamptz) from public, anon, authenticated;
grant execute on function public.close_expired_study_sessions(timestamptz) to service_role;