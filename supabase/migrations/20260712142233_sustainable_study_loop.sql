alter table public.profiles
  add column if not exists adaptive_reminders_enabled boolean not null default false,
  add column if not exists adaptive_reminder_last_adjusted_at timestamptz;

create table if not exists public.study_session_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null unique references public.study_sessions(id) on delete cascade,
  focus_score smallint not null check (focus_score between 1 and 5),
  energy_score smallint not null check (energy_score between 1 and 5),
  interruption_reason text check (
    interruption_reason is null or interruption_reason in ('none', 'phone', 'environment', 'fatigue', 'schedule', 'other')
  ),
  note text check (note is null or length(note) <= 500),
  next_action text check (next_action is null or length(next_action) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_session_reflections_user_created_idx
  on public.study_session_reflections (user_id, created_at desc);

alter table public.study_session_reflections enable row level security;

drop policy if exists "Users can read their study session reflections" on public.study_session_reflections;
create policy "Users can read their study session reflections"
  on public.study_session_reflections for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their study session reflections" on public.study_session_reflections;
create policy "Users can insert their study session reflections"
  on public.study_session_reflections for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their study session reflections" on public.study_session_reflections;
create policy "Users can update their study session reflections"
  on public.study_session_reflections for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.study_session_reflections from public, anon, authenticated;
grant select, insert, update on public.study_session_reflections to authenticated;
grant all on public.study_session_reflections to service_role;

create table if not exists public.study_forest_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  island_theme text not null default 'spring' check (island_theme in ('spring', 'harvest', 'moonlight')),
  cottage_accent text not null default 'mint' check (cottage_accent in ('mint', 'coral', 'honey')),
  featured_reward text not null default 'none' check (featured_reward in ('none', 'birdhouse', 'picnic', 'campfire')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.study_forest_preferences enable row level security;

drop policy if exists "Users can read their forest preferences" on public.study_forest_preferences;
create policy "Users can read their forest preferences"
  on public.study_forest_preferences for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their forest preferences" on public.study_forest_preferences;
create policy "Users can insert their forest preferences"
  on public.study_forest_preferences for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their forest preferences" on public.study_forest_preferences;
create policy "Users can update their forest preferences"
  on public.study_forest_preferences for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.study_forest_preferences from public, anon, authenticated;
grant select, insert, update on public.study_forest_preferences to authenticated;
grant all on public.study_forest_preferences to service_role;

drop function if exists public.start_study_session();

create function public.start_study_session(p_todo_ids uuid[])
returns public.study_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_local_date date;
  v_session public.study_sessions%rowtype;
  v_reminder_at timestamptz;
  v_deadline_at timestamptz;
  v_todo_ids uuid[];
  v_valid_todo_count integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from public.profiles where user_id = v_user_id;
  if not found then
    insert into public.profiles (user_id) values (v_user_id) returning * into v_profile;
  end if;

  v_local_date := (now() at time zone v_profile.time_zone)::date;

  if exists (
    select 1 from public.study_recovery_requests rr
    where rr.user_id = v_user_id and rr.status = 'pending'
  ) then
    raise exception 'Recovery routine required';
  end if;

  select coalesce(array_agg(distinct todo_id), '{}'::uuid[])
    into v_todo_ids
  from unnest(coalesce(p_todo_ids, '{}'::uuid[])) as selected(todo_id);

  if cardinality(v_todo_ids) = 0 then
    raise exception 'At least one current-day todo is required';
  end if;

  select count(*)::integer
    into v_valid_todo_count
  from public.study_todos todo
  where todo.id = any(v_todo_ids)
    and todo.user_id = v_user_id
    and todo.local_date = v_local_date
    and todo.is_completed = false;

  if v_valid_todo_count <> cardinality(v_todo_ids) then
    raise exception 'Session todos must be owned, incomplete, and scheduled for today';
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

  insert into public.study_session_todos (user_id, session_id, todo_id)
  select v_user_id, v_session.id, todo_id from unnest(v_todo_ids) as selected(todo_id);

  if now() >= v_reminder_at and now() < v_deadline_at then
    insert into public.attendance_days (
      user_id, local_date, status, reminder_at, deadline_at, qualifying_session_id, marked_at
    ) values (
      v_user_id, v_local_date, 'present', v_reminder_at, v_deadline_at, v_session.id, now()
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

revoke all on function public.start_study_session(uuid[]) from public, anon;
grant execute on function public.start_study_session(uuid[]) to authenticated, service_role;

create or replace function public.complete_study_session(
  p_session_id uuid,
  p_excluded_seconds integer,
  p_completed_todo_ids uuid[],
  p_focus_score integer,
  p_energy_score integer,
  p_interruption_reason text default null,
  p_note text default null,
  p_next_action text default null
)
returns public.study_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.study_sessions%rowtype;
  v_ended_session public.study_sessions%rowtype;
  v_todo_ids uuid[];
  v_valid_todo_count integer;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_focus_score not between 1 and 5 then raise exception 'Focus score must be between 1 and 5'; end if;
  if p_energy_score not between 1 and 5 then raise exception 'Energy score must be between 1 and 5'; end if;

  select * into v_session
  from public.study_sessions
  where id = p_session_id and user_id = v_user_id and status = 'active'
  for update;
  if not found then raise exception 'Active study session not found'; end if;

  select coalesce(array_agg(distinct todo_id), '{}'::uuid[])
    into v_todo_ids
  from unnest(coalesce(p_completed_todo_ids, '{}'::uuid[])) as selected(todo_id);

  if cardinality(v_todo_ids) > 0 then
    select count(*)::integer into v_valid_todo_count
    from public.study_todos todo
    where todo.id = any(v_todo_ids)
      and todo.user_id = v_user_id
      and todo.local_date = v_session.local_date
      and todo.is_completed = false;
    if v_valid_todo_count <> cardinality(v_todo_ids) then
      raise exception 'Completed todos must be owned, incomplete, and scheduled for the session date';
    end if;

    update public.study_todos set is_completed = true where id = any(v_todo_ids) and user_id = v_user_id;
    update public.study_session_todos
      set completed_during_session = true
      where session_id = p_session_id and user_id = v_user_id and todo_id = any(v_todo_ids);
  end if;

  v_ended_session := public.end_study_session(p_session_id, greatest(0, coalesce(p_excluded_seconds, 0)));

  insert into public.study_session_reflections (
    user_id, session_id, focus_score, energy_score, interruption_reason, note, next_action, updated_at
  ) values (
    v_user_id,
    p_session_id,
    p_focus_score,
    p_energy_score,
    nullif(btrim(coalesce(p_interruption_reason, '')), ''),
    nullif(left(btrim(coalesce(p_note, '')), 500), ''),
    nullif(left(btrim(coalesce(p_next_action, '')), 160), ''),
    now()
  )
  on conflict (session_id) do update
    set focus_score = excluded.focus_score,
        energy_score = excluded.energy_score,
        interruption_reason = excluded.interruption_reason,
        note = excluded.note,
        next_action = excluded.next_action,
        updated_at = now();

  return v_ended_session;
end;
$$;

revoke all on function public.complete_study_session(uuid, integer, uuid[], integer, integer, text, text, text) from public, anon;
grant execute on function public.complete_study_session(uuid, integer, uuid[], integer, integer, text, text, text)
  to authenticated, service_role;

create or replace function public.refresh_adaptive_reminder_after_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_sample_count integer;
  v_median_minutes integer;
  v_rounded_minutes integer;
begin
  select * into v_profile from public.profiles where user_id = new.user_id;
  if not found or v_profile.adaptive_reminders_enabled = false then return new; end if;

  with daily_first as (
    select distinct on (session.local_date)
      session.local_date,
      extract(hour from session.started_at at time zone v_profile.time_zone)::integer * 60
        + extract(minute from session.started_at at time zone v_profile.time_zone)::integer as start_minute
    from public.study_sessions session
    where session.user_id = new.user_id
      and session.status = 'completed'
      and session.local_date between new.local_date - 27 and new.local_date
    order by session.local_date, session.started_at
  )
  select count(*)::integer,
         percentile_disc(0.5) within group (order by start_minute)::integer
    into v_sample_count, v_median_minutes
  from daily_first;

  if v_sample_count < 3 or v_median_minutes is null then return new; end if;
  v_rounded_minutes := greatest(360, least(1380, round(v_median_minutes / 15.0)::integer * 15));

  update public.profiles
    set reminder_time = make_time(v_rounded_minutes / 60, mod(v_rounded_minutes, 60), 0),
        adaptive_reminder_last_adjusted_at = now()
    where user_id = new.user_id;
  return new;
end;
$$;

revoke all on function public.refresh_adaptive_reminder_after_session() from public, anon, authenticated;

drop trigger if exists study_sessions_refresh_adaptive_reminder on public.study_sessions;
create trigger study_sessions_refresh_adaptive_reminder
  after update of status, ended_at on public.study_sessions
  for each row
  when (new.status = 'completed' and old.status is distinct from new.status)
  execute function public.refresh_adaptive_reminder_after_session();
