-- Prospective only. No changes to existing recovery, warning or learning rows.
-- Rollback by forward migration: drop the heartbeat trigger, retain episode evidence,
-- and keep Edge delivery-only until an alternative creation policy is approved.
set local lock_timeout = '3s';

create table study_device_private.camera_recovery_episodes (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  session_id uuid not null,
  absence_since timestamptz not null,
  primary key (user_id, local_date, session_id, absence_since)
);
alter table study_device_private.camera_recovery_episodes enable row level security;
revoke all on study_device_private.camera_recovery_episodes from public, anon, authenticated, service_role;

create function study_device_private.record_camera_recovery_episode()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  episode_start timestamptz;
  study_date date;
begin
  -- A reconnect can publish "watching" without a detector sample. Only
  -- a fresh absent report can prove that the interval reached five minutes.
  if new.status <> 'absent' then return new; end if;
  episode_start := new.absence_since;
  if episode_start is null or new.last_seen_at < episode_start + interval '5 minutes'
    or (old.absence_since = episode_start and old.last_seen_at >= episode_start + interval '5 minutes') then
    return new;
  end if;

  select s.local_date into strict study_date
  from public.study_sessions s where s.id = new.session_id and s.user_id = new.user_id;
  -- Serialize qualification across sessions for the same owner and study day.
  perform pg_advisory_xact_lock(hashtextextended('camera-recovery:' || new.user_id::text || ':' || study_date::text, 0));
  if exists (
    select 1 from public.study_recovery_requests r
    where r.user_id = new.user_id and r.local_date = study_date and r.trigger_type = 'camera_absence_repeat'
  ) then
    return new;
  end if;

  insert into study_device_private.camera_recovery_episodes (user_id, local_date, session_id, absence_since)
  values (new.user_id, study_date, new.session_id, episode_start)
  on conflict do nothing;
  if found and (
    select count(*) from study_device_private.camera_recovery_episodes e
    where e.user_id = new.user_id and e.local_date = study_date
  ) >= 3 then
    insert into public.study_recovery_requests
      (user_id, local_date, trigger_type, covered_start_date, covered_end_date, covered_missed_days, status)
    values (new.user_id, study_date, 'camera_absence_repeat', study_date, study_date, 1, 'pending')
    on conflict (user_id, local_date, trigger_type) where status = 'pending' do nothing;
  end if;
  return new;
end $$;
revoke all on function study_device_private.record_camera_recovery_episode() from public, anon, authenticated, service_role;

-- Accepted camera reports renew expiry. Warning claims and exclusion checkpoints
-- do not, so they cannot qualify another absence episode.
create trigger camera_recovery_on_heartbeat
after update of expires_at on public.study_camera_sessions
for each row execute function study_device_private.record_camera_recovery_episode();

-- A stale Edge worker may still hold a successful warning claim at cutover.
-- Deny untrusted direct writes while allowing the existing postgres-owned
-- camera RPC to create a request in its heartbeat transaction.
create function study_device_private.guard_camera_recovery_insert()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated', 'service_role') then
    raise exception 'Camera recovery requires a qualified heartbeat' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function study_device_private.guard_camera_recovery_insert() from public, anon, authenticated, service_role;

create trigger camera_recovery_server_only
before insert on public.study_recovery_requests
for each row when (new.trigger_type = 'camera_absence_repeat')
execute function study_device_private.guard_camera_recovery_insert();
