alter table public.notification_targets
  add column if not exists slack_user_id text;

alter table public.notification_targets
  drop constraint if exists notification_targets_slack_user_id_check;

alter table public.notification_targets
  add constraint notification_targets_slack_user_id_check check (
    slack_user_id is null
    or (kind = 'slack' and slack_user_id ~ '^[UW][A-Z0-9]{8,}$')
  );

drop function if exists public.get_due_session_lease_warnings(timestamptz);

create function public.get_due_session_lease_warnings(p_now timestamptz default now())
returns table (
  user_id uuid,
  session_id uuid,
  target_id uuid,
  channel_id text,
  slack_user_id text,
  local_date date,
  started_at timestamptz,
  lease_expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    ss.user_id,
    ss.id as session_id,
    nt.id as target_id,
    nt.destination as channel_id,
    nt.slack_user_id,
    ss.local_date,
    ss.started_at,
    ss.lease_expires_at
  from public.study_sessions ss
  join public.notification_targets nt
    on nt.user_id = ss.user_id
  where ss.status = 'active'
    and ss.lease_expires_at is not null
    and ss.lease_warning_sent_at is null
    and p_now >= ss.lease_expires_at - interval '5 minutes'
    and p_now < ss.lease_expires_at
    and nt.kind = 'slack'
    and nt.enabled = true
    and nt.destination is not null;
$$;

revoke execute on function public.get_due_session_lease_warnings(timestamptz) from public;
grant execute on function public.get_due_session_lease_warnings(timestamptz) to service_role;
