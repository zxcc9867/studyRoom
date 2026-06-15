create table if not exists public.study_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  trigger_type text not null,
  status text not null default 'pending',
  reason text,
  makeup_todo_title text,
  pledge_todo_title text,
  makeup_todo_id uuid references public.study_todos(id) on delete set null,
  pledge_todo_id uuid references public.study_todos(id) on delete set null,
  slack_channel_id text,
  slack_message_ts text,
  slack_submitter_id text,
  followup_sent_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_recovery_requests_trigger_type_check check (
    trigger_type in ('missed_attendance', 'camera_absence_repeat')
  ),
  constraint study_recovery_requests_status_check check (status in ('pending', 'submitted')),
  constraint study_recovery_requests_reason_length_check check (reason is null or length(reason) <= 400),
  constraint study_recovery_requests_makeup_title_length_check check (
    makeup_todo_title is null or length(makeup_todo_title) <= 120
  ),
  constraint study_recovery_requests_pledge_title_length_check check (
    pledge_todo_title is null or length(pledge_todo_title) <= 120
  )
);

create unique index if not exists study_recovery_requests_one_pending_per_trigger_idx
  on public.study_recovery_requests (user_id, local_date, trigger_type)
  where status = 'pending';

create index if not exists study_recovery_requests_user_created_idx
  on public.study_recovery_requests (user_id, created_at desc);

create index if not exists study_recovery_requests_pending_followup_idx
  on public.study_recovery_requests (status, created_at)
  where status = 'pending' and followup_sent_at is null;

alter table public.study_recovery_requests enable row level security;

drop policy if exists "Users can read their study recovery requests" on public.study_recovery_requests;
create policy "Users can read their study recovery requests"
  on public.study_recovery_requests for select
  using ((select auth.uid()) = user_id);

grant select on public.study_recovery_requests to authenticated;

drop trigger if exists study_recovery_requests_touch_updated_at on public.study_recovery_requests;
create trigger study_recovery_requests_touch_updated_at
  before update on public.study_recovery_requests
  for each row execute function public.touch_updated_at();

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

  if exists (
    select 1
    from public.study_recovery_requests rr
    where rr.user_id = v_user_id
      and rr.status = 'pending'
  ) then
    raise exception 'Recovery routine required';
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
