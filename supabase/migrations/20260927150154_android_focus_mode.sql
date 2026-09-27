-- A focus signal is derived from the server-owned session, never from a push payload.
create table public.study_focus_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  desired_focus boolean not null default false,
  lease_expires_at timestamptz,
  changed_at timestamptz not null default now(),
  last_signal_at timestamptz
);

create table public.study_focus_devices (
  user_id uuid primary key references auth.users(id) on delete cascade,
  installation_id uuid not null,
  expo_push_token text not null,
  opted_in boolean not null default false,
  permission_granted boolean not null default false,
  applied_revision bigint,
  applied_focus boolean,
  last_ack_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  constraint study_focus_devices_token_check check (length(expo_push_token) between 20 and 256)
);

create index study_focus_state_pending_signal_idx
  on public.study_focus_state (changed_at)
  where last_signal_at is null or last_signal_at < changed_at;

alter table public.study_focus_state enable row level security;
alter table public.study_focus_devices enable row level security;

create policy "Owner reads focus state" on public.study_focus_state
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Owner reads focus device" on public.study_focus_devices
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.refresh_study_focus_state(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_session public.study_sessions%rowtype;
  v_desired boolean := false;
  v_lease timestamptz;
begin
  select * into v_session from public.study_sessions
    where user_id = p_user_id and status = 'active'
    order by started_at desc limit 1;
  if found and v_session.paused_at is null and v_session.lease_expires_at > now() then
    v_desired := true;
    v_lease := v_session.lease_expires_at;
  end if;

  insert into public.study_focus_state (user_id, desired_focus, lease_expires_at)
  values (p_user_id, v_desired, v_lease)
  on conflict (user_id) do update
  set revision = public.study_focus_state.revision + 1,
      desired_focus = excluded.desired_focus,
      lease_expires_at = excluded.lease_expires_at,
      changed_at = now()
  where (public.study_focus_state.desired_focus, public.study_focus_state.lease_expires_at)
        is distinct from (excluded.desired_focus, excluded.lease_expires_at);
end;
$$;

create or replace function public.study_focus_session_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.refresh_study_focus_state(case when tg_op = 'DELETE' then old.user_id else new.user_id end);
  return coalesce(new, old);
end;
$$;

create trigger study_focus_session_changed
  after insert or update of status, paused_at, lease_expires_at or delete on public.study_sessions
  for each row execute function public.study_focus_session_changed();

create or replace function public.register_study_focus_device(
  p_installation_id uuid, p_expo_push_token text, p_opted_in boolean,
  p_permission_granted boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_installation_id is null or
    (p_expo_push_token not like 'ExpoPushToken[%' and p_expo_push_token not like 'ExponentPushToken[%')
    or length(p_expo_push_token) not between 20 and 256 then
    raise exception 'Invalid focus device';
  end if;
  insert into public.study_focus_devices
    (user_id, installation_id, expo_push_token, opted_in, permission_granted)
  values (v_user_id, p_installation_id, p_expo_push_token, p_opted_in, p_permission_granted)
  on conflict (user_id) do update
  set installation_id = excluded.installation_id,
      expo_push_token = excluded.expo_push_token,
      opted_in = excluded.opted_in,
      permission_granted = excluded.permission_granted,
      applied_revision = case when public.study_focus_devices.installation_id = excluded.installation_id
        then public.study_focus_devices.applied_revision else null end,
      applied_focus = case when public.study_focus_devices.installation_id = excluded.installation_id
        then public.study_focus_devices.applied_focus else null end,
      last_ack_at = case when public.study_focus_devices.installation_id = excluded.installation_id
        then public.study_focus_devices.last_ack_at else null end,
      updated_at = now();
  perform public.refresh_study_focus_state(v_user_id);
end;
$$;

create or replace function public.ack_study_focus_device(
  p_installation_id uuid, p_revision bigint, p_applied_focus boolean,
  p_permission_granted boolean, p_error text default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_state public.study_focus_state%rowtype;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  select * into v_state from public.study_focus_state where user_id = v_user_id;
  if not found or p_revision is distinct from v_state.revision
    or (p_error is null and p_applied_focus is distinct from
      (v_state.desired_focus and v_state.lease_expires_at > now())) then
    return false;
  end if;
  update public.study_focus_devices
  set applied_revision = p_revision,
      applied_focus = p_applied_focus,
      permission_granted = p_permission_granted,
      last_ack_at = now(),
      last_error = left(p_error, 300),
      updated_at = now()
  where user_id = v_user_id and installation_id = p_installation_id and opted_in;
  return found;
end;
$$;

create or replace function public.unregister_study_focus_device(p_installation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated'; end if;
  delete from public.study_focus_devices
  where user_id = (select auth.uid()) and installation_id = p_installation_id;
end;
$$;

create or replace function public.get_study_focus_snapshot()
returns jsonb language sql security definer set search_path = '' stable as $$
  select case when (select auth.uid()) is null then null else jsonb_build_object(
    'server_time', now(),
    'revision', coalesce(state.revision, 0),
    'desired_focus', coalesce(state.desired_focus and state.lease_expires_at > now(), false),
    'lease_expires_at', state.lease_expires_at,
    'device_connected', device.user_id is not null,
    'installation_id', device.installation_id,
    'opted_in', coalesce(device.opted_in, false),
    'permission_granted', coalesce(device.permission_granted, false),
    'applied_revision', device.applied_revision,
    'applied_focus', device.applied_focus,
    'last_ack_at', device.last_ack_at,
    'last_error', device.last_error
  ) end
  from (select (select auth.uid()) as user_id) owner
  left join public.study_focus_state state on state.user_id = owner.user_id
  left join public.study_focus_devices device on device.user_id = owner.user_id;
$$;

revoke all on public.study_focus_state, public.study_focus_devices from anon;
revoke insert, update, delete on public.study_focus_state, public.study_focus_devices from authenticated;
grant select on public.study_focus_state, public.study_focus_devices to authenticated;
revoke all on function public.refresh_study_focus_state(uuid),
  public.study_focus_session_changed() from public, anon, authenticated;
revoke all on function public.register_study_focus_device(uuid,text,boolean,boolean),
  public.ack_study_focus_device(uuid,bigint,boolean,boolean,text),
  public.unregister_study_focus_device(uuid),
  public.get_study_focus_snapshot() from public, anon;
grant execute on function public.register_study_focus_device(uuid,text,boolean,boolean),
  public.ack_study_focus_device(uuid,bigint,boolean,boolean,text),
  public.unregister_study_focus_device(uuid),
  public.get_study_focus_snapshot() to authenticated;

-- Existing active sessions need a state row, but no notification is sent before opt-in.
select public.refresh_study_focus_state(user_id)
from public.study_sessions where status = 'active' group by user_id;
