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
  v_deadline_at := v_reminder_at + interval '15 minutes';

  insert into public.study_sessions (user_id, local_date)
  values (v_user_id, v_local_date)
  returning * into v_session;

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

  return v_session;
end;
$$;

grant execute on function public.start_study_session() to authenticated;
