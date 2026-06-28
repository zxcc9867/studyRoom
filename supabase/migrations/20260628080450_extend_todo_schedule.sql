create or replace function public.extend_todo_schedule(
  p_todo_id uuid,
  p_extension_minutes integer
)
returns table (
  todo_id uuid,
  title text,
  local_date date,
  start_time time,
  end_time time
)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_todo public.study_todos%rowtype;
  request_user uuid := auth.uid();
begin
  if p_extension_minutes is null or p_extension_minutes not between 1 and 120 then
    raise exception 'Extension minutes must be between 1 and 120';
  end if;

  select *
    into selected_todo
    from public.study_todos
   where id = p_todo_id
   for update;

  if not found then
    raise exception 'Todo schedule was not found';
  end if;

  if request_user is not null and request_user <> selected_todo.user_id then
    raise exception 'Todo schedule does not belong to the current user';
  end if;

  if selected_todo.is_completed = true then
    raise exception 'Completed todo schedules cannot be extended';
  end if;

  if selected_todo.start_time is null or selected_todo.end_time is null then
    raise exception 'Todo schedule must have start and end times';
  end if;

  return query
  with candidate_todos as (
    select st.id
      from public.study_todos st
     where st.user_id = selected_todo.user_id
       and st.local_date = selected_todo.local_date
       and st.is_completed = false
       and st.start_time is not null
       and st.end_time is not null
       and st.start_time >= selected_todo.start_time
  ), updated_todos as (
    update public.study_todos st
       set start_time = case
             when st.id = selected_todo.id then st.start_time
             else (((st.local_date::text || ' ' || st.start_time::text)::timestamp + make_interval(mins => p_extension_minutes))::time)
           end,
           end_time = (((st.local_date::text || ' ' || st.end_time::text)::timestamp + make_interval(mins => p_extension_minutes))::time),
           updated_at = now()
      from candidate_todos ct
     where st.id = ct.id
     returning st.id, st.title, st.local_date, st.start_time, st.end_time
  )
  select updated_todos.id,
         updated_todos.title,
         updated_todos.local_date,
         updated_todos.start_time,
         updated_todos.end_time
    from updated_todos
   order by updated_todos.start_time, updated_todos.title;
end;
$$;

revoke all on function public.extend_todo_schedule(uuid, integer) from public;
grant execute on function public.extend_todo_schedule(uuid, integer) to service_role;
grant execute on function public.extend_todo_schedule(uuid, integer) to authenticated;