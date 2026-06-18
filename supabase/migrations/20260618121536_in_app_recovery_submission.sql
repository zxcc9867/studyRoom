drop function if exists public.submit_study_recovery_request(uuid, text, text, text);

create or replace function public.submit_study_recovery_request(
  p_request_id uuid,
  p_reason text,
  p_makeup_todo_title text,
  p_pledge_todo_title text
)
returns public.study_recovery_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.study_recovery_requests%rowtype;
  v_updated public.study_recovery_requests%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_makeup_title text := nullif(btrim(coalesce(p_makeup_todo_title, '')), '');
  v_pledge_title text := nullif(btrim(coalesce(p_pledge_todo_title, '')), '');
  v_makeup_todo_id uuid;
  v_pledge_todo_id uuid;
  v_makeup_position integer;
  v_pledge_position integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_reason is null then
    raise exception 'Recovery reason is required';
  end if;
  if length(v_reason) > 400 then
    raise exception 'Recovery reason must be 400 characters or fewer';
  end if;

  if v_makeup_title is null then
    raise exception 'Makeup todo title is required';
  end if;
  if length(v_makeup_title) > 120 then
    raise exception 'Makeup todo title must be 120 characters or fewer';
  end if;

  if v_pledge_title is null then
    raise exception 'Pledge todo title is required';
  end if;
  if length(v_pledge_title) > 120 then
    raise exception 'Pledge todo title must be 120 characters or fewer';
  end if;

  select *
  into v_request
  from public.study_recovery_requests
  where id = p_request_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Recovery request not found';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Recovery request already submitted';
  end if;

  select coalesce(max(position), -1) + 1
  into v_makeup_position
  from public.study_todos
  where user_id = v_user_id
    and local_date = v_request.local_date;

  insert into public.study_todos (user_id, local_date, title, position)
  values (v_user_id, v_request.local_date, v_makeup_title, v_makeup_position)
  returning id into v_makeup_todo_id;

  select coalesce(max(position), -1) + 1
  into v_pledge_position
  from public.study_todos
  where user_id = v_user_id
    and local_date = v_request.local_date + 1;

  insert into public.study_todos (user_id, local_date, title, position)
  values (v_user_id, v_request.local_date + 1, v_pledge_title, v_pledge_position)
  returning id into v_pledge_todo_id;

  update public.study_recovery_requests
  set status = 'submitted',
      reason = v_reason,
      makeup_todo_title = v_makeup_title,
      pledge_todo_title = v_pledge_title,
      makeup_todo_id = v_makeup_todo_id,
      pledge_todo_id = v_pledge_todo_id,
      submitted_at = now()
  where id = v_request.id
    and user_id = v_user_id
    and status = 'pending'
  returning * into v_updated;

  if not found then
    raise exception 'Recovery request already submitted';
  end if;

  return v_updated;
end;
$$;

revoke all on function public.submit_study_recovery_request(uuid, text, text, text) from public;
grant execute on function public.submit_study_recovery_request(uuid, text, text, text) to authenticated;
