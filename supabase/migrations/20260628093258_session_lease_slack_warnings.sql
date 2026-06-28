alter table public.study_sessions
  add column if not exists lease_expires_at timestamptz,
  add column if not exists lease_warning_sent_at timestamptz;

update public.study_sessions
set lease_expires_at = coalesce(lease_expires_at, started_at + interval '1 hour')
where status = 'active'
  and lease_expires_at is null;

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
  ) then
    raise exception 'Recovery routine required';
  end if;

  v_reminder_at := public.local_reminder_at(
    v_local_date,
    public.effective_reminder_time(v_local_date, v_profile.reminder_time),
    v_profile.time_zone
  );
  v_deadline_at := v_reminder_at + interval '30 minutes';

  insert into public.study_sessions (user_id, local_date, lease_expires_at)
  values (v_user_id, v_local_date, now() + interval '1 hour')
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

create or replace function public.extend_study_session_lease(
  p_session_id uuid,
  p_extension_minutes integer default 60
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
  if p_extension_minutes <> 60 then
    raise exception 'Study session lease extension must be 60 minutes';
  end if;

  update public.study_sessions
  set lease_expires_at = greatest(coalesce(lease_expires_at, now()), now()) + make_interval(mins => p_extension_minutes),
      lease_warning_sent_at = null
  where id = p_session_id
    and status = 'active'
    and (v_user_id is null or user_id = v_user_id)
  returning * into v_session;

  if not found then
    raise exception 'Active study session not found';
  end if;

  return v_session;
end;
$$;

create or replace function public.get_due_session_lease_warnings(p_now timestamptz default now())
returns table (
  user_id uuid,
  session_id uuid,
  target_id uuid,
  channel_id text,
  local_date date,
  started_at timestamptz,
  lease_expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    ss.user_id,
    ss.id as session_id,
    nt.id as target_id,
    nt.destination as channel_id,
    ss.local_date,
    ss.started_at,
    ss.lease_expires_at
  from public.study_sessions ss
  join public.notification_targets nt
    on nt.user_id = ss.user_id
  where ss.status = 'active'
    and ss.lease_expires_at is not null
    and ss.lease_warning_sent_at is null
    and p_now >= ss.lease_expires_at - interval '5 minutes'
    and p_now < ss.lease_expires_at
    and nt.kind = 'slack'
    and nt.enabled = true
    and nt.destination is not null;
$$;

revoke execute on function public.extend_study_session_lease(uuid, integer) from public;
revoke execute on function public.get_due_session_lease_warnings(timestamptz) from public;

grant execute on function public.extend_study_session_lease(uuid, integer) to authenticated;
grant execute on function public.extend_study_session_lease(uuid, integer) to service_role;
grant execute on function public.get_due_session_lease_warnings(timestamptz) to service_role;