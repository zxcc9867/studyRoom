create table if not exists public.study_todo_schedule_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  todo_id uuid not null references public.study_todos(id) on delete cascade,
  target_id uuid not null references public.notification_targets(id) on delete cascade,
  local_date date not null,
  reminder_type text not null,
  scheduled_at timestamptz not null,
  status text not null default 'pending',
  notification_delivery_id uuid references public.notification_deliveries(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_todo_schedule_deliveries_type_check check (reminder_type in ('start', 'end_soon')),
  constraint study_todo_schedule_deliveries_status_check check (status in ('pending', 'sent', 'failed')),
  constraint study_todo_schedule_deliveries_unique unique (todo_id, target_id, reminder_type, scheduled_at)
);

create index if not exists study_todo_schedule_deliveries_user_date_idx
  on public.study_todo_schedule_deliveries (user_id, local_date desc, scheduled_at desc);

alter table public.study_todo_schedule_deliveries enable row level security;

drop policy if exists "Users can read their todo schedule deliveries" on public.study_todo_schedule_deliveries;
create policy "Users can read their todo schedule deliveries"
  on public.study_todo_schedule_deliveries for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop trigger if exists study_todo_schedule_deliveries_touch_updated_at on public.study_todo_schedule_deliveries;
create trigger study_todo_schedule_deliveries_touch_updated_at
  before update on public.study_todo_schedule_deliveries
  for each row execute function public.touch_updated_at();

grant select on public.study_todo_schedule_deliveries to authenticated;

create or replace function public.get_due_todo_schedule_reminders(p_now timestamptz default now())
returns table (
  user_id uuid,
  target_id uuid,
  channel_id text,
  todo_id uuid,
  local_date date,
  title text,
  start_time time,
  end_time time,
  reminder_type text,
  scheduled_at timestamptz,
  next_todo_title text,
  next_start_time time,
  next_end_time time
)
language sql
stable
security definer
set search_path = public
as $$
  with timed_todos as (
    select
      st.user_id,
      nt.id as target_id,
      nt.destination as channel_id,
      st.id as todo_id,
      st.local_date,
      st.title,
      st.start_time,
      st.end_time,
      public.local_reminder_at(st.local_date, st.start_time, p.time_zone) as start_scheduled_at,
      (((case when st.end_time > st.start_time then st.local_date else st.local_date + 1 end)::text || ' ' || st.end_time::text)::timestamp at time zone p.time_zone) as end_scheduled_at
    from public.study_todos st
    join public.profiles p
      on p.user_id = st.user_id
    join public.notification_targets nt
      on nt.user_id = st.user_id
     and nt.kind = 'slack'
     and nt.enabled = true
     and nt.destination is not null
    where st.is_completed = false
      and st.start_time is not null
      and st.end_time is not null
      and st.start_time <> st.end_time
  ),
  candidates as (
    select
      tt.user_id,
      tt.target_id,
      tt.channel_id,
      tt.todo_id,
      tt.local_date,
      tt.title,
      tt.start_time,
      tt.end_time,
      'start'::text as reminder_type,
      tt.start_scheduled_at as scheduled_at
    from timed_todos tt
    where p_now >= tt.start_scheduled_at
      and p_now < tt.start_scheduled_at + interval '1 minute'

    union all

    select
      tt.user_id,
      tt.target_id,
      tt.channel_id,
      tt.todo_id,
      tt.local_date,
      tt.title,
      tt.start_time,
      tt.end_time,
      'end_soon'::text as reminder_type,
      tt.end_scheduled_at - interval '5 minutes' as scheduled_at
    from timed_todos tt
    where p_now >= tt.end_scheduled_at - interval '5 minutes'
      and p_now < tt.end_scheduled_at - interval '4 minutes'
      and tt.end_scheduled_at - interval '5 minutes' >= tt.start_scheduled_at
  )
  select
    c.user_id,
    c.target_id,
    c.channel_id,
    c.todo_id,
    c.local_date,
    c.title,
    c.start_time,
    c.end_time,
    c.reminder_type,
    c.scheduled_at,
    next_todo.title as next_todo_title,
    next_todo.start_time as next_start_time,
    next_todo.end_time as next_end_time
  from candidates c
  left join lateral (
    select st2.title, st2.start_time, st2.end_time
    from public.study_todos st2
    where st2.user_id = c.user_id
      and st2.local_date = c.local_date
      and st2.id <> c.todo_id
      and st2.is_completed = false
      and st2.start_time is not null
      and st2.end_time is not null
      and st2.start_time <> st2.end_time
      and st2.start_time >= c.end_time
    order by st2.start_time asc, st2.position asc, st2.created_at asc
    limit 1
  ) next_todo on c.reminder_type = 'end_soon'
  where not exists (
    select 1
    from public.study_todo_schedule_deliveries existing
    where existing.todo_id = c.todo_id
      and existing.target_id = c.target_id
      and existing.reminder_type = c.reminder_type
      and existing.scheduled_at = c.scheduled_at
  );
$$;

revoke all on function public.get_due_todo_schedule_reminders(timestamptz) from public;
grant execute on function public.get_due_todo_schedule_reminders(timestamptz) to service_role;
