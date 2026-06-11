create table if not exists public.study_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  title text not null,
  is_completed boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_todos_title_check check (length(btrim(title)) > 0)
);

create index if not exists study_todos_user_date_idx
  on public.study_todos (user_id, local_date desc, position asc, created_at asc);

alter table public.study_todos enable row level security;

drop policy if exists "Users can read their study todos" on public.study_todos;
create policy "Users can read their study todos"
  on public.study_todos for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their study todos" on public.study_todos;
create policy "Users can insert their study todos"
  on public.study_todos for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their study todos" on public.study_todos;
create policy "Users can update their study todos"
  on public.study_todos for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their study todos" on public.study_todos;
create policy "Users can delete their study todos"
  on public.study_todos for delete
  using ((select auth.uid()) = user_id);

drop trigger if exists study_todos_touch_updated_at on public.study_todos;
create trigger study_todos_touch_updated_at
  before update on public.study_todos
  for each row execute function public.touch_updated_at();
