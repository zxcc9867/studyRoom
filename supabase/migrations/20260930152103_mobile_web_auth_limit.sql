-- Bound server-generated mobile-to-web login tickets per authenticated owner.
create table public.mobile_web_auth_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts between 0 and 11)
);

alter table public.mobile_web_auth_limits enable row level security;
revoke all on table public.mobile_web_auth_limits from public, anon, authenticated;

create function public.try_issue_mobile_web_auth_ticket(p_user_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_attempts integer;
begin
  if p_user_id is null then return false; end if;

  insert into public.mobile_web_auth_limits (user_id, window_started_at, attempts)
  values (p_user_id, now(), 1)
  on conflict (user_id) do update
  set window_started_at = case
        when public.mobile_web_auth_limits.window_started_at <= now() - interval '5 minutes'
          then now()
        else public.mobile_web_auth_limits.window_started_at
      end,
      attempts = case
        when public.mobile_web_auth_limits.window_started_at <= now() - interval '5 minutes'
          then 1
        else least(public.mobile_web_auth_limits.attempts + 1, 11)
      end
  returning attempts into v_attempts;

  return v_attempts <= 10;
end;
$$;

revoke all on function public.try_issue_mobile_web_auth_ticket(uuid) from public, anon, authenticated;
grant execute on function public.try_issue_mobile_web_auth_ticket(uuid) to service_role;
