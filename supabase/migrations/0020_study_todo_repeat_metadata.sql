alter table public.study_todos
  add column if not exists repeat_group_id uuid;

alter table public.study_todos
  add column if not exists repeat_mode text not null default 'single';

alter table public.study_todos
  add column if not exists repeat_weekdays smallint[] not null default '{}'::smallint[];

alter table public.study_todos
  add column if not exists repeat_until date;

do $$
begin
  alter table public.study_todos
    add constraint study_todos_repeat_mode_check
    check (repeat_mode in ('single', 'weekly'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.study_todos
    add constraint study_todos_repeat_weekdays_check
    check (repeat_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.study_todos
    add constraint study_todos_repeat_consistency_check
    check (
      (
        repeat_mode = 'single'
        and repeat_group_id is null
        and repeat_until is null
        and coalesce(array_length(repeat_weekdays, 1), 0) = 0
      )
      or (
        repeat_mode = 'weekly'
        and repeat_group_id is not null
        and repeat_until is not null
        and coalesce(array_length(repeat_weekdays, 1), 0) > 0
      )
    );
exception
  when duplicate_object then null;
end $$;

create index if not exists study_todos_repeat_group_idx
  on public.study_todos (user_id, repeat_group_id)
  where repeat_group_id is not null;

grant select, insert, update, delete on public.study_todos to authenticated;
