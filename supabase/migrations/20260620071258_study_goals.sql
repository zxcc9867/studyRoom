create table if not exists public.study_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  target_date date not null,
  target_study_seconds integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_goals_title_check check (length(btrim(title)) > 0),
  constraint study_goals_target_study_seconds_check check (target_study_seconds >= 0),
  constraint study_goals_status_check check (status in ('active', 'completed', 'archived')),
  constraint study_goals_id_user_id_key unique (id, user_id)
);

create index if not exists study_goals_user_status_date_idx
  on public.study_goals (user_id, status, target_date asc, created_at asc);

alter table public.study_goals enable row level security;

drop policy if exists "Users can read their study goals" on public.study_goals;
create policy "Users can read their study goals"
  on public.study_goals for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their study goals" on public.study_goals;
create policy "Users can insert their study goals"
  on public.study_goals for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their study goals" on public.study_goals;
create policy "Users can update their study goals"
  on public.study_goals for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their study goals" on public.study_goals;
create policy "Users can delete their study goals"
  on public.study_goals for delete
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.study_goals to authenticated;

drop trigger if exists study_goals_touch_updated_at on public.study_goals;
create trigger study_goals_touch_updated_at
  before update on public.study_goals
  for each row execute function public.touch_updated_at();

alter table public.study_todos
  add column if not exists goal_id uuid;

alter table public.study_todos
  drop constraint if exists study_todos_goal_owner_fk;

alter table public.study_todos
  add constraint study_todos_goal_owner_fk
  foreign key (goal_id, user_id) references public.study_goals(id, user_id);

create index if not exists study_todos_goal_idx
  on public.study_todos (goal_id, local_date asc, position asc, created_at asc)
  where goal_id is not null;
