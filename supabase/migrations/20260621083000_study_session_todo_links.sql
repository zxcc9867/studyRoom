create unique index if not exists study_sessions_id_user_id_uidx
  on public.study_sessions (id, user_id);

create unique index if not exists study_todos_id_user_id_uidx
  on public.study_todos (id, user_id);

create table if not exists public.study_session_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  todo_id uuid not null,
  linked_at timestamptz not null default now(),
  completed_during_session boolean not null default false,
  constraint study_session_todos_session_todo_key unique (session_id, todo_id),
  constraint study_session_todos_session_user_fk
    foreign key (session_id, user_id)
    references public.study_sessions(id, user_id)
    on delete cascade,
  constraint study_session_todos_todo_user_fk
    foreign key (todo_id, user_id)
    references public.study_todos(id, user_id)
    on delete cascade
);

create index if not exists study_session_todos_user_session_idx
  on public.study_session_todos (user_id, session_id);

create index if not exists study_session_todos_user_todo_idx
  on public.study_session_todos (user_id, todo_id);

alter table public.study_session_todos enable row level security;

drop policy if exists "Users can read their study session todo links"
  on public.study_session_todos;
create policy "Users can read their study session todo links"
  on public.study_session_todos
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their study session todo links"
  on public.study_session_todos;
create policy "Users can insert their study session todo links"
  on public.study_session_todos
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their study session todo links"
  on public.study_session_todos;
create policy "Users can update their study session todo links"
  on public.study_session_todos
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their study session todo links"
  on public.study_session_todos;
create policy "Users can delete their study session todo links"
  on public.study_session_todos
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.study_session_todos to authenticated;
