alter table public.study_todos
  add column if not exists repeat_forever boolean not null default false;

alter table public.study_todos
  drop constraint if exists study_todos_repeat_consistency_check;

alter table public.study_todos
  add constraint study_todos_repeat_consistency_check
  check (
    (
      repeat_mode = 'single'
      and repeat_group_id is null
      and repeat_until is null
      and repeat_forever = false
      and coalesce(array_length(repeat_weekdays, 1), 0) = 0
    )
    or (
      repeat_mode = 'weekly'
      and repeat_group_id is not null
      and (repeat_forever = true or repeat_until is not null)
      and coalesce(array_length(repeat_weekdays, 1), 0) > 0
    )
  );
