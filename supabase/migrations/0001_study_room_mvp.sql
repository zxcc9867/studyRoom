create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  time_zone text not null default 'Asia/Tokyo',
  reminder_time time not null default '21:00',
  email_reminders_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_reminder_minute_check check (date_part('second', reminder_time) = 0)
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_sessions_status_check check (status in ('active', 'completed', 'cancelled')),
  constraint study_sessions_duration_check check (duration_seconds >= 0),
  constraint study_sessions_time_range_check check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists study_sessions_one_active_per_user_idx
  on public.study_sessions (user_id)
  where status = 'active';

create index if not exists study_sessions_user_date_idx
  on public.study_sessions (user_id, local_date desc, started_at desc);

create table if not exists public.attendance_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  status text not null default 'pending',
  reminder_at timestamptz not null,
  deadline_at timestamptz not null,
  qualifying_session_id uuid references public.study_sessions(id) on delete set null,
  marked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date),
  constraint attendance_days_status_check check (status in ('pending', 'present', 'missed')),
  constraint attendance_days_deadline_check check (deadline_at > reminder_at)
);

create index if not exists attendance_days_user_date_idx
  on public.attendance_days (user_id, local_date desc);

create table if not exists public.notification_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  destination text,
  subscription jsonb,
  target_key text generated always as (coalesce(destination, subscription->>'endpoint')) stored,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_targets_kind_check check (kind in ('expo', 'web_push', 'email')),
  constraint notification_targets_payload_check check (
    (kind in ('expo', 'email') and destination is not null)
    or (kind = 'web_push' and subscription is not null)
  )
);

create unique index if not exists notification_targets_unique_destination_idx
  on public.notification_targets (user_id, kind, target_key);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid references public.notification_targets(id) on delete set null,
  local_date date not null,
  channel text not null,
  status text not null,
  error_message text,
  created_at timestamptz not null default now(),
  constraint notification_deliveries_channel_check check (channel in ('expo', 'web_push', 'email')),
  constraint notification_deliveries_status_check check (status in ('sent', 'failed'))
);

create index if not exists notification_deliveries_user_created_idx
  on public.notification_deliveries (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.study_sessions enable row level security;
alter table public.attendance_days enable row level security;
alter table public.notification_targets enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile"
  on public.profiles for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
  on public.profiles for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their profile" on public.profiles;
create policy "Users can insert their profile"
  on public.profiles for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read their study sessions" on public.study_sessions;
create policy "Users can read their study sessions"
  on public.study_sessions for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their study sessions" on public.study_sessions;
create policy "Users can insert their study sessions"
  on public.study_sessions for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their study sessions" on public.study_sessions;
create policy "Users can update their study sessions"
  on public.study_sessions for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read their attendance days" on public.attendance_days;
create policy "Users can read their attendance days"
  on public.attendance_days for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their notification targets" on public.notification_targets;
create policy "Users can read their notification targets"
  on public.notification_targets for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their notification targets" on public.notification_targets;
create policy "Users can manage their notification targets"
  on public.notification_targets for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read their notification deliveries" on public.notification_deliveries;
create policy "Users can read their notification deliveries"
  on public.notification_deliveries for select
  using ((select auth.uid()) = user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists study_sessions_touch_updated_at on public.study_sessions;
create trigger study_sessions_touch_updated_at
  before update on public.study_sessions
  for each row execute function public.touch_updated_at();

drop trigger if exists attendance_days_touch_updated_at on public.attendance_days;
create trigger attendance_days_touch_updated_at
  before update on public.attendance_days
  for each row execute function public.touch_updated_at();

drop trigger if exists notification_targets_touch_updated_at on public.notification_targets;
create trigger notification_targets_touch_updated_at
  before update on public.notification_targets
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do update
    set email = excluded.email;

  if new.email is not null then
    insert into public.notification_targets (user_id, kind, destination)
    values (new.id, 'email', new.email)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.local_reminder_at(p_local_date date, p_reminder_time time, p_time_zone text)
returns timestamptz
language sql
stable
as $$
  select (p_local_date::text || ' ' || p_reminder_time::text)::timestamp at time zone p_time_zone;
$$;

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

create or replace function public.end_study_session(p_session_id uuid)
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
      duration_seconds = greatest(0, floor(extract(epoch from (now() - started_at)))::integer),
      status = 'completed'
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

create or replace function public.get_due_reminders(p_now timestamptz default now())
returns table (
  user_id uuid,
  email text,
  time_zone text,
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
  with due as (
    select
      p.user_id,
      p.email,
      p.time_zone,
      (p_now at time zone p.time_zone)::date as local_date,
      public.local_reminder_at((p_now at time zone p.time_zone)::date, p.reminder_time, p.time_zone) as reminder_at
    from public.profiles p
  ),
  due_now as (
    select
      d.user_id,
      d.email,
      d.time_zone,
      d.local_date,
      d.reminder_at,
      d.reminder_at + interval '15 minutes' as deadline_at
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
  )
  insert into public.attendance_days (user_id, local_date, status, reminder_at, deadline_at, marked_at)
  select user_id, local_date, 'pending', reminder_at, deadline_at, p_now
  from due_now
  on conflict (user_id, local_date) do update
    set reminder_at = excluded.reminder_at,
        deadline_at = excluded.deadline_at,
        marked_at = excluded.marked_at
  returning attendance_days.user_id,
            (select profiles.email from public.profiles where profiles.user_id = attendance_days.user_id),
            (select profiles.time_zone from public.profiles where profiles.user_id = attendance_days.user_id),
            attendance_days.local_date,
            attendance_days.reminder_at,
            attendance_days.deadline_at;
end;
$$;

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
    and p_now > ad.deadline_at
    and not exists (
      select 1
      from public.study_sessions ss
      where ss.user_id = ad.user_id
        and ss.started_at >= ad.reminder_at
        and ss.started_at <= ad.deadline_at
    )
  returning ad.user_id, ad.local_date, ad.reminder_at, ad.deadline_at;
end;
$$;

grant execute on function public.start_study_session() to authenticated;
grant execute on function public.end_study_session(uuid) to authenticated;
grant execute on function public.get_due_reminders(timestamptz) to service_role;
grant execute on function public.mark_missed_attendance(timestamptz) to service_role;
