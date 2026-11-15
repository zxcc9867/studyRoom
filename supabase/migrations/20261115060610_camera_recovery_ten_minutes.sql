-- Prospective: keep existing requests and five-minute evidence, but do not count
-- that evidence under the new rule without a fresh qualifying absent report.
-- Roll back, if needed, with a new migration restoring the preceding function
-- definition. Keep this column and its evidence; do not edit either migration.
set local lock_timeout = '3s';

-- Drain heartbeats running the old function before changing the evidence table;
-- the migration runner keeps both DDL statements and this lock in one transaction.
lock table public.study_camera_sessions in share row exclusive mode;

alter table study_device_private.camera_recovery_episodes
  add column qualified_10m_at timestamptz;

create or replace function study_device_private.record_camera_recovery_episode()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  episode_start timestamptz;
  study_date date;
begin
  -- Reconnects can report "watching"; only an accepted absent heartbeat qualifies.
  if new.status <> 'absent' then return new; end if;
  episode_start := new.absence_since;
  if episode_start is null or new.last_seen_at < episode_start + interval '10 minutes' then
    return new;
  end if;

  select s.local_date into strict study_date
  from public.study_sessions s where s.id = new.session_id and s.user_id = new.user_id;
  -- Once accepted under this rule there is no need to lock again on later heartbeats.
  -- An episode that crossed ten minutes before this migration can still qualify
  -- if it receives a fresh absent report after deployment.
  if old.absence_since = episode_start and old.last_seen_at >= episode_start + interval '10 minutes'
    and exists (
      select 1 from study_device_private.camera_recovery_episodes e
      where e.user_id = new.user_id and e.local_date = study_date
        and e.session_id = new.session_id and e.absence_since = episode_start
        and e.qualified_10m_at is not null
    ) then
    return new;
  end if;

  -- Serialize qualification across sessions for the same owner and study day.
  perform pg_advisory_xact_lock(hashtextextended('camera-recovery:' || new.user_id::text || ':' || study_date::text, 0));
  if exists (
    select 1 from public.study_recovery_requests r
    where r.user_id = new.user_id and r.local_date = study_date and r.trigger_type = 'camera_absence_repeat'
  ) then
    return new;
  end if;

  insert into study_device_private.camera_recovery_episodes as e
    (user_id, local_date, session_id, absence_since, qualified_10m_at)
  values (new.user_id, study_date, new.session_id, episode_start, new.last_seen_at)
  on conflict (user_id, local_date, session_id, absence_since) do update
    set qualified_10m_at = excluded.qualified_10m_at
    where e.qualified_10m_at is null;
  if found and (
    select count(*) from study_device_private.camera_recovery_episodes e
    where e.user_id = new.user_id and e.local_date = study_date and e.qualified_10m_at is not null
  ) >= 3 then
    insert into public.study_recovery_requests
      (user_id, local_date, trigger_type, covered_start_date, covered_end_date, covered_missed_days, status)
    values (new.user_id, study_date, 'camera_absence_repeat', study_date, study_date, 1, 'pending')
    on conflict (user_id, local_date, trigger_type) where status = 'pending' do nothing;
  end if;
  return new;
end $$;
