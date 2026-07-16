-- session_lease_max_remaining: keep one-hour extensions within a two-hour remaining-time ceiling.
create or replace function public.extend_study_session_lease(
  p_session_id uuid,
  p_extension_minutes integer default 60
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
  if p_extension_minutes <> 60 then
    raise exception 'Study session lease extension must be 60 minutes';
  end if;

  update public.study_sessions
  set lease_expires_at = least(
        greatest(coalesce(lease_expires_at, now()), now()) + make_interval(mins => p_extension_minutes),
        now() + interval '2 hours'
      ),
      lease_warning_sent_at = null
  where id = p_session_id
    and status = 'active'
    and (v_user_id is null or user_id = v_user_id)
  returning * into v_session;

  if not found then
    raise exception 'Active study session not found';
  end if;

  return v_session;
end;
$$;

revoke all on function public.extend_study_session_lease(uuid, integer) from public, anon;
grant execute on function public.extend_study_session_lease(uuid, integer) to authenticated, service_role;
