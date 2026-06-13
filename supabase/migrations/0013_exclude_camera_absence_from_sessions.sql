drop function if exists public.end_study_session(uuid);

create or replace function public.end_study_session(
  p_session_id uuid,
  p_excluded_seconds integer default 0
)
returns public.study_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.study_sessions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.study_sessions
  set ended_at = now(),
      duration_seconds = greatest(
        0,
        floor(extract(epoch from (now() - started_at)))::integer - greatest(0, p_excluded_seconds)
      ),
      status = 'completed'
  where id = p_session_id
    and user_id = v_user_id
    and status = 'active'
  returning * into v_session;

  if not found then
    raise exception 'Active study session not found';
  end if;

  return v_session;
end;
$$;

grant execute on function public.end_study_session(uuid, integer) to authenticated;
