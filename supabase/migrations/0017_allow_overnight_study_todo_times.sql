alter table public.study_todos
  drop constraint if exists study_todos_time_window_check;

alter table public.study_todos
  add constraint study_todos_time_window_check check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null and start_time <> end_time)
  );

comment on constraint study_todos_time_window_check on public.study_todos
  is 'Allows same-day and overnight todo time windows; equal start and end times remain invalid.';
