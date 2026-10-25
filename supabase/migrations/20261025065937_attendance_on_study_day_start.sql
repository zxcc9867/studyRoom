-- Attendance is earned by a persisted start on its immutable 04:00 study day.
-- Duration targets remain learning goals, never attendance requirements.
-- Prevent a concurrent legacy Slack submission/start from crossing the one-time repair.
lock table public.study_sessions, public.attendance_days, public.study_recovery_requests in share row exclusive mode;

alter table public.study_recovery_requests
  add column resolved_at timestamptz,
  add column resolution_reason text;
alter table public.study_recovery_requests drop constraint study_recovery_requests_status_check;
alter table public.study_recovery_requests add constraint study_recovery_requests_status_check
  check (status in ('pending', 'submitted', 'consolidated', 'resolved'));
alter table public.study_recovery_requests add constraint study_recovery_requests_resolution_check
  check (status <> 'resolved' or (resolved_at is not null and resolution_reason is not null));

-- Repair ONLY the study day open at deployment, without rewriting any learning row.
with current_days as (
  select p.user_id, public.study_day_at(now(),p.time_zone) as local_date,
    public.study_reminder_at(public.study_day_at(now(),p.time_zone),
      public.effective_reminder_time(public.study_day_at(now(),p.time_zone),p.reminder_time),p.time_zone) as reminder_at,
    ((public.study_day_at(now(),p.time_zone)+1)+time '04:00') at time zone p.time_zone as deadline_at
  from public.profiles p
), qualified as (
  select d.*, s.id as session_id from current_days d
  left join lateral (select ss.id from public.study_sessions ss
    where ss.user_id=d.user_id and ss.local_date=d.local_date and ss.status in ('active','completed') and ss.started_at<=now()
    order by ss.started_at,ss.id limit 1) s on true
)
insert into public.attendance_days as existing(user_id,local_date,status,reminder_at,deadline_at,qualifying_session_id,marked_at)
select q.user_id,q.local_date,case when q.session_id is null then 'pending' else 'present' end,
  q.reminder_at,q.deadline_at,q.session_id,now() from qualified q
on conflict (user_id,local_date) do update set
  status=excluded.status,
  reminder_at=excluded.reminder_at,deadline_at=excluded.deadline_at,
  qualifying_session_id=coalesce(excluded.qualifying_session_id,existing.qualifying_session_id),marked_at=now();

-- A combined request may still cover real historical misses: retain those, not today's premature miss.
with affected as (
  select rr.id,public.study_day_at(now(),p.time_zone) as current_day
  from public.study_recovery_requests rr join public.profiles p on p.user_id=rr.user_id
  where rr.status='pending' and rr.trigger_type='missed_attendance'
    and public.study_day_at(now(),p.time_zone) between rr.covered_start_date and rr.covered_end_date
), remaining as (
  select a.id,min(ad.local_date) as first_day,max(ad.local_date) as last_day,count(ad.local_date)::integer as days
  from affected a join public.study_recovery_requests rr on rr.id=a.id
  left join public.attendance_days ad on ad.user_id=rr.user_id and ad.status='missed'
    and ad.local_date between rr.covered_start_date and rr.covered_end_date and ad.local_date<>a.current_day
  group by a.id
)
update public.study_recovery_requests rr set
  local_date=case when r.days>0 then r.first_day else rr.local_date end,
  covered_start_date=coalesce(r.first_day,rr.covered_start_date),
  covered_end_date=coalesce(r.last_day,rr.covered_end_date),
  covered_missed_days=case when r.days>0 then r.days else rr.covered_missed_days end,
  status=case when r.days>0 then 'pending' else 'resolved' end,
  resolved_at=case when r.days=0 then now() else null end,
  resolution_reason=case when r.days=0 then 'attendance_start_policy_current_day' else null end
from remaining r where rr.id=r.id and rr.status='pending';

CREATE OR REPLACE FUNCTION public.start_study_session(p_todo_ids uuid[])
 RETURNS public.study_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_local_date date;
  v_session public.study_sessions%rowtype;
  v_reminder_at timestamptz;
  v_deadline_at timestamptz;
  v_todo_ids uuid[];
  v_valid_todo_count integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from public.profiles where user_id = v_user_id;
  if not found then
    insert into public.profiles (user_id) values (v_user_id) returning * into v_profile;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('attendance-start:'||v_user_id::text,0));
  v_local_date := public.study_day_at(now(), v_profile.time_zone);

  if exists (
    select 1 from public.study_recovery_requests rr
    where rr.user_id = v_user_id and rr.status = 'pending'
  ) then
    raise exception 'Recovery routine required';
  end if;

  select coalesce(array_agg(distinct todo_id), '{}'::uuid[])
    into v_todo_ids
  from unnest(coalesce(p_todo_ids, '{}'::uuid[])) as selected(todo_id);

  if cardinality(v_todo_ids) = 0 then
    raise exception 'At least one current-day todo is required';
  end if;

  select count(*)::integer
    into v_valid_todo_count
  from public.study_todos todo
  where todo.id = any(v_todo_ids)
    and todo.user_id = v_user_id
    and todo.local_date in (v_local_date, (now() at time zone v_profile.time_zone)::date)
    and todo.is_completed = false;

  if v_valid_todo_count <> cardinality(v_todo_ids) then
    raise exception 'Session todos must be owned, incomplete, and scheduled for today';
  end if;

  v_reminder_at := public.study_reminder_at(
    v_local_date,
    public.effective_reminder_time(v_local_date, v_profile.reminder_time),
    v_profile.time_zone
  );
  v_deadline_at := ((v_local_date+1)+time '04:00') at time zone v_profile.time_zone;

  insert into public.study_sessions (user_id, local_date, lease_expires_at)
  values (v_user_id, v_local_date, now() + interval '1 hour')
  returning * into v_session;

  insert into public.study_session_todos (user_id, session_id, todo_id)
  select v_user_id, v_session.id, todo_id from unnest(v_todo_ids) as selected(todo_id);

    insert into public.attendance_days (
      user_id, local_date, status, reminder_at, deadline_at, qualifying_session_id, marked_at
    ) values (
      v_user_id, v_local_date, 'present', v_reminder_at, v_deadline_at, v_session.id, now()
    )
    on conflict (user_id, local_date) do update
      set status = 'present',
          reminder_at = excluded.reminder_at,
          deadline_at = excluded.deadline_at,
          qualifying_session_id = excluded.qualifying_session_id,
          marked_at = excluded.marked_at;

  return v_session;
end;
$function$;
revoke all on function public.start_study_session(uuid[]) from public,anon;
grant execute on function public.start_study_session(uuid[]) to authenticated,service_role;

-- Compatibility entry point retained for completion/lease callers. It never revises a past day,
-- awards attendance from duration, or pretends a recovery was submitted by the user.
create or replace function public.promote_attendance_by_daily_study_total(
  p_user_id uuid,p_local_date date,p_now timestamptz default now(),p_qualifying_session_id uuid default null
) returns boolean language plpgsql security definer set search_path='' as $$
declare p public.profiles%rowtype; sid uuid; r timestamptz; e timestamptz;
begin
  select * into p from public.profiles where user_id=p_user_id;
  if not found or p_local_date<>public.study_day_at(p_now,p.time_zone) then return false; end if;
  select s.id into sid from public.study_sessions s
    where s.user_id=p_user_id and s.local_date=p_local_date and s.status in ('active','completed') and s.started_at<=p_now
    order by (s.id=p_qualifying_session_id) desc nulls last,s.started_at,s.id limit 1;
  if sid is null then return false; end if;
  r:=public.study_reminder_at(p_local_date,public.effective_reminder_time(p_local_date,p.reminder_time),p.time_zone);
  e:=((p_local_date+1)+time '04:00') at time zone p.time_zone;
  insert into public.attendance_days as ad(user_id,local_date,status,reminder_at,deadline_at,qualifying_session_id,marked_at)
    values(p_user_id,p_local_date,'present',r,e,sid,p_now)
    on conflict(user_id,local_date) do update set status='present',reminder_at=excluded.reminder_at,
      deadline_at=excluded.deadline_at,qualifying_session_id=excluded.qualifying_session_id,marked_at=excluded.marked_at;
  return true;
end; $$;
revoke all on function public.promote_attendance_by_daily_study_total(uuid,date,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.promote_attendance_by_daily_study_total(uuid,date,timestamptz,uuid) to service_role;

-- Scheduled initial reminders and 15-minute nudges remain. Nudges cannot outlive their study day.
create or replace function public.get_due_reminders(p_now timestamptz default now())
returns table(user_id uuid,email text,time_zone text,local_date date,reminder_at timestamptz,
  deadline_at timestamptz,reminder_stage text,attendance_already_present boolean)
language plpgsql security definer set search_path='' as $$
declare p public.profiles%rowtype; d date; r timestamptz; e timestamptz; claimed public.attendance_days%rowtype;
begin
  for p in select profile.* from public.profiles profile where profile.created_at<=p_now order by profile.user_id loop
    d:=public.study_day_at(p_now,p.time_zone);
    r:=public.study_reminder_at(d,public.effective_reminder_time(d,p.reminder_time),p.time_zone);
    e:=((d+1)+time '04:00') at time zone p.time_zone;
    if p_now>=r and p_now<r+interval '1 minute' then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('attendance-start:'||p.user_id::text,0));
      perform public.promote_attendance_by_daily_study_total(p.user_id,d,p_now,null);
      insert into public.attendance_days as ad(user_id,local_date,status,reminder_at,deadline_at,marked_at,initial_reminder_claimed_at)
        values(p.user_id,d,'pending',r,e,p_now,p_now)
        on conflict on constraint attendance_days_pkey do update set reminder_at=excluded.reminder_at,
          deadline_at=excluded.deadline_at,initial_reminder_claimed_at=excluded.initial_reminder_claimed_at
          where ad.status<>'missed' and ad.initial_reminder_claimed_at is null
        returning ad.* into claimed;
      if found then
        return query select p.user_id,p.email,p.time_zone,d,r,e,'initial'::text,claimed.status='present';
      end if;
    elsif p_now>=r+interval '15 minutes' and p_now<r+interval '16 minutes' and p_now<e then
      update public.attendance_days ad set nudge_reminder_claimed_at=p_now
        where ad.user_id=p.user_id and ad.local_date=d and ad.status='pending' and ad.nudge_reminder_claimed_at is null
          and not exists(select 1 from public.study_sessions s where s.user_id=p.user_id and s.local_date=d and s.status in ('active','completed') and s.started_at<=p_now)
        returning ad.* into claimed;
      if found then return query select p.user_id,p.email,p.time_zone,d,r,e,'nudge'::text,false; end if;
    end if;
  end loop;
end; $$;
revoke all on function public.get_due_reminders(timestamptz) from public,anon,authenticated;
grant execute on function public.get_due_reminders(timestamptz) to service_role;

create index if not exists attendance_days_pending_user_date_idx
  on public.attendance_days(user_id,local_date) where status='pending';

-- Create the just-ended day even without a reminder, and catch up existing pending days
-- after a cron outage. Never manufacture every historical gap or revisit a final past day.
create or replace function public.mark_missed_attendance(p_now timestamptz default now())
returns table(user_id uuid,local_date date,reminder_at timestamptz,deadline_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare p public.profiles%rowtype; d date; r timestamptz; e timestamptz; sid uuid;
begin
  for p in select profile.* from public.profiles profile where profile.created_at<=p_now order by profile.user_id loop
    d:=public.study_day_at(p_now,p.time_zone)-1;
    if d<public.study_day_at(p.created_at,p.time_zone) then continue; end if;
    e:=((d+1)+time '04:00') at time zone p.time_zone;
    if p_now<e then continue; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('attendance-start:'||p.user_id::text,0));
    r:=public.study_reminder_at(d,public.effective_reminder_time(d,p.reminder_time),p.time_zone);
    insert into public.attendance_days as ad(user_id,local_date,status,reminder_at,deadline_at,marked_at)
      values(p.user_id,d,'pending',r,e,p_now) on conflict on constraint attendance_days_pkey do nothing;
    for d in select ad.local_date from public.attendance_days ad
      where ad.user_id=p.user_id and ad.status='pending'
        and ad.local_date>=public.study_day_at(p.created_at,p.time_zone)
        and ad.local_date<public.study_day_at(p_now,p.time_zone)
      order by ad.local_date loop
    e:=((d+1)+time '04:00') at time zone p.time_zone;
    if p_now<e then continue; end if;
    select s.id into sid from public.study_sessions s
      where s.user_id=p.user_id and s.local_date=d and s.status in ('active','completed') and s.started_at<=p_now order by s.started_at,s.id limit 1;
    if sid is not null then
      update public.attendance_days ad set status='present',qualifying_session_id=sid,marked_at=p_now,deadline_at=e
        where ad.user_id=p.user_id and ad.local_date=d and ad.status='pending';
    else
      return query update public.attendance_days ad set status='missed',marked_at=p_now,deadline_at=e
        where ad.user_id=p.user_id and ad.local_date=d and ad.status='pending'
        returning ad.user_id,ad.local_date,ad.reminder_at,ad.deadline_at;
    end if;
    end loop;
  end loop;
end; $$;
revoke all on function public.mark_missed_attendance(timestamptz) from public,anon,authenticated;
grant execute on function public.mark_missed_attendance(timestamptz) to service_role;

notify pgrst,'reload schema';
