-- dashboard_planner_preferences

create or replace function public.is_valid_today_section_order(today_section_order jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(today_section_order) = 'array'
    and not exists (
      select 1
      from jsonb_array_elements_text(today_section_order) as section_id(value)
      where section_id.value not in ('topbar', 'attendance', 'focus', 'tasks')
    );
$$;

alter table public.profiles
  add column if not exists today_task_view text not null default 'checklist';

alter table public.profiles
  add column if not exists today_section_order jsonb not null default '["topbar", "attendance", "focus", "tasks"]'::jsonb;

alter table public.profiles
  drop constraint if exists profiles_today_task_view_check,
  add constraint profiles_today_task_view_check
    check (today_task_view in ('checklist', 'planner'));

alter table public.profiles
  drop constraint if exists profiles_today_section_order_check,
  add constraint profiles_today_section_order_check
    check (public.is_valid_today_section_order(today_section_order));

grant select, insert, update on public.profiles to authenticated;
