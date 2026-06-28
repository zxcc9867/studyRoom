create or replace function public.clear_future_todo_schedule_deliveries(
  p_todo_ids uuid[],
  p_changed_at timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  if p_todo_ids is null or array_length(p_todo_ids, 1) is null then
    return 0;
  end if;

  delete from public.study_todo_schedule_deliveries delivery
  using public.study_todos todo
  where delivery.todo_id = any(p_todo_ids)
    and todo.id = delivery.todo_id
    and (auth.uid() is null or todo.user_id = auth.uid())
    and delivery.scheduled_at >= p_changed_at;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.clear_future_todo_schedule_deliveries(uuid[], timestamptz) from public;
grant execute on function public.clear_future_todo_schedule_deliveries(uuid[], timestamptz) to authenticated;
grant execute on function public.clear_future_todo_schedule_deliveries(uuid[], timestamptz) to service_role;

create or replace function public.clear_future_todo_schedule_deliveries_on_todo_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.start_time is distinct from new.start_time
    or old.end_time is distinct from new.end_time
    or old.is_completed is distinct from new.is_completed
  then
    perform public.clear_future_todo_schedule_deliveries(array[new.id], now());
  end if;

  return new;
end;
$$;

drop trigger if exists study_todos_clear_future_schedule_deliveries on public.study_todos;
create trigger study_todos_clear_future_schedule_deliveries
  after update of start_time, end_time, is_completed on public.study_todos
  for each row execute function public.clear_future_todo_schedule_deliveries_on_todo_change();
