alter table public.study_todos
  add column if not exists start_time time;

alter table public.study_todos
  add column if not exists end_time time;

alter table public.study_todos
  drop constraint if exists study_todos_time_window_check;

alter table public.study_todos
  add constraint study_todos_time_window_check check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null and start_time < end_time)
  );

create index if not exists study_todos_user_date_time_idx
  on public.study_todos (user_id, local_date desc, start_time asc, position asc, created_at asc);
